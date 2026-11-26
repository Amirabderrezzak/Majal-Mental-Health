import { useEscapeKey } from "@/lib/a11y";
import { specialtyLabel } from "@/lib/specialty";
import { useState, useEffect } from "react";
import { Calendar, Clock, Check, X, Loader2, ChevronRight, Video, Star } from "lucide-react";
import { toast } from "sonner";
import { useNow } from "@/hooks/useNow";
import { joinSession, apiPost } from "@/lib/sessionApi";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { SessionCalendar } from "@/components/SessionCalendar";
import { SessionsListSkeleton, SessionHistorySkeleton } from "@/components/LoadingSkeletons";
import { isSameDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ClinicSettings, DEFAULT_CLINIC_SETTINGS, ExistingBooking, getAvailableSlots, algiersDayRange, algiersParts, algiersSlotToDate } from "@/lib/availability";

// "YYYY-MM-DD" (date input) -> calendar-day parts, read as an Algiers day.
const ymd = (v: string) => { const [y, m, d] = v.split("-").map(Number); return { y, mo: m - 1, d }; };

interface Booking {
  id: string;
  booked_at: string;
  status: "pending" | "confirmed" | "cancelled" | "done" | "no-show";
  duration_minutes: number;
  price: number | null;
  psychologist_id: string;
  psychologist_name?: string;
  psychologist_avatar?: string;
  psychologist_specialty?: string;
  video_room_url?: string | null;
  reschedule_count?: number;
  session_kind?: string;
  no_show_party?: string | null;
  verifying?: boolean;
  /** Open request to move this session to a time the therapist must accept. */
  pending_request?: { id: string; proposed_at: string; message: string | null; initiated_by?: string } | null;
}

interface PatientSessionsProps {
  upcoming: Booking[];
  past: Booking[];
  cancelling: string | null;
  bookingsLoading: boolean;
  handleCancelBooking: (id: string) => void;
  handleReschedule: (booking: Booking, date: string, time: string) => Promise<void>;
  locale: string;
  fmt: (iso: string) => string;
  fmtT: (iso: string) => string;
  getInitials: (name?: string) => string;
  /** Reload bookings + requests after a request is sent or withdrawn. */
  onRequestsChanged?: () => void;
}

export default function PatientSessions({
  upcoming,
  past,
  cancelling,
  bookingsLoading,
  handleCancelBooking,
  handleReschedule,
  locale,
  fmt,
  fmtT,
  getInitials,
  onRequestsChanged,
}: PatientSessionsProps) {
  const { t, dir } = useLanguage();
  const rtl = dir === "rtl";
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const now = useNow(30_000);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const sessionOpen = (b: Booking) => {
    const start = new Date(b.booked_at).getTime();
    return now.getTime() >= start - 15 * 60000 && now.getTime() <= start + (b.duration_minutes || 60) * 60000;
  };
  // Mirrors the server rules (api/bookings.ts): confirmed, scheduled, ≥ 2 h away.
  // Moving into a free slot is limited to 2 times; proposing a time the
  // therapist accepts is always possible (one open request at a time).
  const canMove = (b: Booking) =>
    b.status === "confirmed" && b.session_kind !== "instant" && !b.pending_request &&
    new Date(b.booked_at).getTime() - now.getTime() >= 2 * 3600 * 1000;
  const canPickFreeSlot = (b: Booking) => canMove(b) && (b.reschedule_count ?? 0) < 2;
  const canReschedule = canMove;
  const onJoin = async (b: Booking) => {
    setJoiningId(b.id);
    try { await joinSession(b.id); }
    catch (err: any) { toast.error(err?.message || t("space.dashboard.toast.roomNotStarted")); }
    finally { setJoiningId(null); }
  };
  const [selectedCalDate, setSelectedCalDate] = useState<Date | undefined>(undefined);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [rescheduleStep, setRescheduleStep] = useState(1);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  // "Propose another time" (step 5): any date/time, accepted by the therapist.
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const todayAlgiers = (() => { const a = algiersParts(new Date()); return `${a.y}-${String(a.mo + 1).padStart(2, "0")}-${String(a.d).padStart(2, "0")}`; })();
  const openCustom = () => { setCustomDate(rescheduleDate); setCustomTime(""); setCustomMessage(""); setRescheduleStep(5); };
  const sendRequest = async () => {
    if (!rescheduleBooking || !customDate || !customTime) return;
    const [y, m, d] = customDate.split("-").map(Number);
    setRequesting(true);
    try {
      await apiPost("/api/bookings?action=reschedule-request", {
        booking_id: rescheduleBooking.id,
        proposed_at: algiersSlotToDate(y, m - 1, d, customTime).toISOString(),
        message: customMessage.trim() || undefined,
      });
      toast.success(t("space.request.sent"));
      closeReschedule();
      onRequestsChanged?.();
    } catch (err: any) {
      toast.error(err?.message || t("space.request.error"));
    } finally {
      setRequesting(false);
    }
  };
  // The therapist proposed another time: accept (session moves, nothing to pay)
  // or decline (session stays; the therapist may then cancel with a full refund).
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const answerProposal = async (requestId: string, accept: boolean) => {
    setAnsweringId(requestId);
    try {
      await apiPost("/api/bookings?action=reschedule-respond", { request_id: requestId, accept });
      toast.success(accept ? t("space.proposal.accepted") : t("space.proposal.declined"));
      onRequestsChanged?.();
    } catch (err: any) {
      toast.error(err?.message || t("space.request.error"));
      onRequestsChanged?.();
    } finally {
      setAnsweringId(null);
    }
  };
  const withdrawRequest = async (requestId: string) => {
    setWithdrawingId(requestId);
    try {
      await apiPost("/api/bookings?action=reschedule-cancel", { request_id: requestId });
      toast.success(t("space.request.withdrawn"));
      onRequestsChanged?.();
    } catch (err: any) {
      toast.error(err?.message || t("space.request.error"));
    } finally {
      setWithdrawingId(null);
    }
  };
  const allBookings = [...upcoming, ...past];

  // Real availability for the reschedule wizard: the psychologist's clinic
  // settings (working hours/days/buffer/vacation mode) plus their existing
  // bookings that day, rather than a generic 08:00–20:00 hardcoded list.
  const [rescheduleClinicSettings, setRescheduleClinicSettings] = useState<ClinicSettings>(DEFAULT_CLINIC_SETTINGS);
  const [rescheduleDayBookings, setRescheduleDayBookings] = useState<ExistingBooking[]>([]);

  useEffect(() => {
    if (!rescheduleBooking) return;
    supabase
      .from("psychologist_directory")
      .select("clinic_settings")
      .eq("user_id", rescheduleBooking.psychologist_id)
      .single()
      .then(({ data }) => {
        const cs = (data as any)?.clinic_settings;
        setRescheduleClinicSettings(cs && typeof cs === "object" ? { ...DEFAULT_CLINIC_SETTINGS, ...cs } : DEFAULT_CLINIC_SETTINGS);
      });
  }, [rescheduleBooking?.psychologist_id]);

  useEffect(() => {
    if (!rescheduleBooking || !rescheduleDate) {
      setRescheduleDayBookings([]);
      return;
    }
    const { y, mo, d } = ymd(rescheduleDate);
    const { start: startOfDay, end: endOfDay } = algiersDayRange(y, mo, d);
    supabase
      .from("psychologist_availability")
      .select("booked_at, duration_minutes")
      .eq("psychologist_id", rescheduleBooking.psychologist_id)
      .gte("booked_at", startOfDay)
      .lt("booked_at", endOfDay)
      .then(({ data, error }) => {
        if (error) { console.error("Error fetching booked slots for reschedule:", error); return; }
        // Exclude the booking being rescheduled itself — otherwise its
        // current slot would show as taken when the patient just wants to
        // pick a different time on the same day.
        setRescheduleDayBookings(
          (data || []).filter((b: any) => new Date(b.booked_at).toISOString() !== new Date(rescheduleBooking.booked_at).toISOString())
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the booking id/slot, not the object identity
  }, [rescheduleBooking?.id, rescheduleBooking?.booked_at, rescheduleDate]);

  const availableRescheduleSlots = rescheduleDate
    ? getAvailableSlots(new Date(ymd(rescheduleDate).y, ymd(rescheduleDate).mo, ymd(rescheduleDate).d), rescheduleClinicSettings, rescheduleDayBookings, rescheduleBooking?.duration_minutes)
    : [];

  const handleConfirmReschedule = async () => {
    if (!rescheduleBooking || !rescheduleDate || !rescheduleTime) return;
    setRescheduling(true);
    await handleReschedule(rescheduleBooking, rescheduleDate, rescheduleTime);
    setRescheduling(false);
    setRescheduleBooking(null);
    setRescheduleStep(1);
    setRescheduleDate("");
    setRescheduleTime("");
  };

  const closeReschedule = () => { setRescheduleBooking(null); setRescheduleStep(1); setRescheduleDate(""); setRescheduleTime(""); setCustomDate(""); setCustomTime(""); setCustomMessage(""); };
  useEscapeKey(rescheduleBooking !== null, closeReschedule);

  const RescheduleModal = () => {
    if (!rescheduleBooking) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t("space.reschedule.title")}>
        <div className="absolute inset-0 bg-black/40" onClick={() => { setRescheduleBooking(null); setRescheduleStep(1); setRescheduleDate(""); setRescheduleTime(""); }} />
        <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200">

          {rescheduleStep <= 4 && <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3, 4].map(step => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  rescheduleStep >= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {rescheduleStep > step ? <Check className="w-4 h-4" /> : step}
                </div>
                {step < 4 && <div className={`w-8 h-0.5 ${rescheduleStep > step ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>}

          {rescheduleStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.reschedule.title")}</h3>
              <p className="text-sm text-muted-foreground">{t("space.reschedule.intro")}</p>
              <div className="p-4 rounded-2xl border border-border/50 bg-teal-hero/10 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {getInitials(rescheduleBooking.psychologist_name)}
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">{rescheduleBooking.psychologist_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {fmt(rescheduleBooking.booked_at)} · {fmtT(rescheduleBooking.booked_at)}
                  </div>
                </div>
              </div>
              {canPickFreeSlot(rescheduleBooking) ? (
                <button
                  onClick={() => setRescheduleStep(2)}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all"
                >
                  {t("space.reschedule.pickSlot")}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3">{t("space.request.limitReached")}</p>
              )}
              <button
                onClick={openCustom}
                className="w-full py-3 rounded-xl border border-primary/30 text-primary text-sm font-semibold bg-transparent cursor-pointer hover:bg-teal-pale transition-all"
              >
                {t("space.request.openCta")}
              </button>
            </div>
          )}

          {rescheduleStep === 5 && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.request.title")}</h3>
              <p className="text-sm text-muted-foreground">{t("space.request.intro")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                  {t("res.date")}
                  <input type="date" value={customDate} min={todayAlgiers} onChange={(e) => setCustomDate(e.target.value)}
                    className="px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none focus:border-primary focus:bg-card font-sans" />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                  {t("space.request.timeLabel")}
                  <input type="time" step={900} value={customTime} onChange={(e) => setCustomTime(e.target.value)}
                    className="px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none focus:border-primary focus:bg-card font-sans" />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                {t("space.request.messageLabel")}
                <textarea value={customMessage} maxLength={500} rows={3} onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder={t("space.request.messagePlaceholder")}
                  className="px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none focus:border-primary focus:bg-card font-sans resize-none" />
              </label>
              <p className="text-xs text-muted-foreground">{t("space.request.note")}</p>
              <div className="flex gap-3">
                <button onClick={() => setRescheduleStep(1)} className="px-4 py-3 border border-border/50 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer hover:bg-accent/40 transition-all">{t("common.back")}</button>
                <button
                  onClick={sendRequest}
                  disabled={!customDate || !customTime || requesting}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {requesting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("space.request.send")}
                </button>
              </div>
            </div>
          )}

          {rescheduleStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.reschedule.pickDate")}</h3>
              <input
                type="date"
                value={rescheduleDate}
                min={(() => { const a = algiersParts(new Date()); return `${a.y}-${String(a.mo + 1).padStart(2, "0")}-${String(a.d).padStart(2, "0")}`; })()}
                onChange={e => setRescheduleDate(e.target.value)}
                className="w-full px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none focus:border-primary focus:bg-card transition-all font-sans"
              />
              <div className="flex gap-3">
                <button onClick={() => setRescheduleStep(1)} className="px-4 py-3 border border-border/50 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer hover:bg-accent/40 transition-all">{t("common.back")}</button>
                <button
                  onClick={() => rescheduleDate && setRescheduleStep(3)}
                  disabled={!rescheduleDate}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-50"
                >
                  {t("common.continue")}
                </button>
              </div>
            </div>
          )}

          {rescheduleStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.reschedule.pickTime")}</h3>
              <p className="text-xs text-muted-foreground">{new Date(`${rescheduleDate}T12:00:00Z`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</p>
              <button type="button" onClick={openCustom} className="text-xs text-primary font-semibold underline bg-transparent border-none cursor-pointer p-0">
                {t("space.request.noSlotFits")}
              </button>
              {availableRescheduleSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("res.noSlotsThisDay") || "Aucun créneau disponible ce jour-là."}</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pe-1">
                  {availableRescheduleSlots.map(slot => (
                    <button
                      key={slot}
                      onClick={() => setRescheduleTime(slot)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        rescheduleTime === slot
                          ? "bg-primary border-primary text-primary-foreground shadow-sm"
                          : "bg-white border-border/50 hover:bg-accent/40 text-foreground"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setRescheduleStep(2)} className="px-4 py-3 border border-border/50 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer hover:bg-accent/40 transition-all">{t("common.back")}</button>
                <button
                  onClick={() => rescheduleTime && setRescheduleStep(4)}
                  disabled={!rescheduleTime}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-50"
                >
                  {t("common.confirm")}
                </button>
              </div>
            </div>
          )}

          {rescheduleStep === 4 && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.reschedule.confirmTitle")}</h3>
              <div className="p-5 rounded-2xl border border-border/50 bg-teal-hero/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {getInitials(rescheduleBooking.psychologist_name)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{rescheduleBooking.psychologist_name}</div>
                    <div className="text-xs text-muted-foreground">{t("space.defaultPsy")}</div>
                  </div>
                </div>
                <div className="border-t border-border/30 pt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold">{new Date(`${rescheduleDate}T12:00:00Z`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold">{rescheduleTime}</span>
                    <span className="text-muted-foreground">· {rescheduleBooking.duration_minutes} min</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">{t("space.reschedule.emailNote")}</p>
              <div className="flex gap-3">
                <button onClick={() => setRescheduleStep(3)} className="px-4 py-3 border border-border/50 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer hover:bg-accent/40 transition-all">{t("common.back")}</button>
                <button
                  onClick={handleConfirmReschedule}
                  disabled={rescheduling}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {rescheduling && <Loader2 className="w-4 h-4 animate-spin" />}
                  {rescheduling ? t("space.reschedule.saving") : t("space.reschedule.confirmTitle")}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => { setRescheduleBooking(null); setRescheduleStep(1); setRescheduleDate(""); setRescheduleTime(""); }}
            className="absolute top-4 end-4 p-1.5 rounded-lg hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-all border-none bg-transparent cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="dashboard-card p-4 flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.sessionsTitle")}</h3>
        <div className="flex rounded-lg border border-border/50 overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border-none ${
              viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
            }`}
          >{t("common.viewList")}</button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border-none ${
              viewMode === "calendar" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
            }`}
          >{t("common.viewCalendar")}</button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <>
          <SessionCalendar
            bookings={allBookings}
            selected={selectedCalDate}
            onSelect={setSelectedCalDate}
          />

          {selectedCalDate && (
            <div className="dashboard-card p-6">
              <h3 className="font-serif text-lg font-semibold text-foreground mb-4 pb-4 border-b border-border/40">
                {selectedCalDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                <span className="text-sm font-normal text-muted-foreground ms-2">
                  ({allBookings.filter(b => isSameDay(new Date(b.booked_at), selectedCalDate)).length} séance(s))
                </span>
              </h3>
              {allBookings.filter(b => isSameDay(new Date(b.booked_at), selectedCalDate)).length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground font-medium">Aucune séance ce jour</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {allBookings
                    .filter(b => isSameDay(new Date(b.booked_at), selectedCalDate))
                    .sort((a, b) => new Date(a.booked_at).getTime() - new Date(b.booked_at).getTime())
                    .map(b => (
                    <div key={b.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        {b.psychologist_avatar ? (
                          <img src={b.psychologist_avatar} alt={b.psychologist_name} className="w-11 h-11 rounded-full object-cover border border-primary/20 shrink-0 shadow-sm" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/10 shadow-sm">
                            {getInitials(b.psychologist_name)}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-sm text-foreground">{b.psychologist_name}</div>
                          <div className="text-xs text-primary font-medium mt-0.5">{specialtyLabel(b.psychologist_specialty, t, "Psychologue")}</div>
                          <div className="text-xs text-muted-foreground mt-1">{fmtT(b.booked_at)} · {b.duration_minutes} min</div>
                        </div>
                      </div>
                      <span className={`badge-pill ${
                        b.status === "confirmed" ? "badge-pill-confirmed" :
                        b.status === "pending" ? "badge-pill-pending" :
                        b.status === "done" ? "badge-pill-done" :
                        b.status === "no-show" ? "badge-pill-cancelled" : "badge-pill-cancelled"
                      }`}>
                        {b.status === "confirmed" ? t("space.status.confirmed") :
                         b.status === "pending" ? t("space.status.pending") :
                         b.status === "done" ? t("space.status.done") :
                         b.status === "no-show" ? "Absent" : t("space.status.cancelled")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="dashboard-card p-6">
            <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">
              {t("space.upcomingSessionsCount")} ({upcoming.length})
            </h3>
        {bookingsLoading ? (
          <SessionsListSkeleton />
        ) : upcoming.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
            <p className="text-sm font-medium">{t("space.noSessionsPlanned")}</p>
            <Link to="/psychologues" className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold no-underline hover:bg-teal-mid transition-all">
              {t("space.bookSession")}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {upcoming.map(b => (
              <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-4">
                  {b.psychologist_avatar ? (
                    <img src={b.psychologist_avatar} alt={b.psychologist_name} className="w-11 h-11 rounded-full object-cover border border-primary/20 shrink-0 shadow-sm" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/10 shadow-sm">
                      {getInitials(b.psychologist_name)}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-sm text-foreground">{b.psychologist_name}</div>
                    <div className="text-xs text-primary font-medium mt-0.5">{specialtyLabel(b.psychologist_specialty, t, "Psychologue")}</div>
                    <div className="text-xs text-muted-foreground mt-1">{fmt(b.booked_at)} · {fmtT(b.booked_at)} · {b.duration_minutes} {t("space.minutesLabel")}</div>
                    {b.price != null && b.price > 0 && <div className="text-xs text-muted-foreground/80 mt-0.5"><bdi>{b.price.toLocaleString()} {t("space.priceCurrency")}</bdi></div>}
                  </div>
                </div>
                <div className="flex sm:flex-col items-end gap-2.5 self-end sm:self-center">
                  <span className={`badge-pill ${b.status === "confirmed" ? "badge-pill-confirmed" : "badge-pill-pending"}`}>
                    {b.verifying ? t("space.status.verifying") : b.status === "confirmed" ? t("space.status.confirmed") : t("space.status.pending")}
                  </span>
                  {b.status === "confirmed" && sessionOpen(b) && (
                    <button
                      onClick={() => onJoin(b)}
                      disabled={joiningId === b.id}
                      className="text-xs text-primary-foreground bg-primary border-none rounded-lg px-3 py-1.5 cursor-pointer hover:bg-teal-mid font-semibold flex items-center gap-1 disabled:opacity-60"
                    >
                      {joiningId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
                      {t("pd.joinNow")}
                    </button>
                  )}
                  {b.pending_request?.initiated_by === "psychologist" && (
                    <div className="text-xs rounded-xl border border-primary/30 bg-teal-pale px-3 py-2.5 max-w-[300px] text-start" role="group" aria-label={t("space.proposal.title")}>
                      <div className="font-semibold text-foreground">{t("space.proposal.title")}</div>
                      <div className="text-foreground mt-0.5"><strong>{fmt(b.pending_request.proposed_at)} · {fmtT(b.pending_request.proposed_at)}</strong></div>
                      {b.pending_request.message && <div className="text-muted-foreground mt-1 whitespace-pre-line">« {b.pending_request.message} »</div>}
                      <div className="text-muted-foreground mt-1">{t("space.proposal.noPay")}</div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => answerProposal(b.pending_request!.id, true)} disabled={answeringId === b.pending_request.id}
                          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid disabled:opacity-50">
                          {t("space.proposal.accept")}
                        </button>
                        <button onClick={() => answerProposal(b.pending_request!.id, false)} disabled={answeringId === b.pending_request.id}
                          className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold border-none cursor-pointer disabled:opacity-50">
                          {t("space.proposal.decline")}
                        </button>
                      </div>
                    </div>
                  )}
                  {b.pending_request && b.pending_request.initiated_by !== "psychologist" && (
                    <div className="text-xs rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 max-w-[260px] text-end">
                      <div className="font-semibold text-foreground">{t("space.request.pendingTitle")}</div>
                      <div className="text-muted-foreground mt-0.5">{fmt(b.pending_request.proposed_at)} · {fmtT(b.pending_request.proposed_at)}</div>
                      <button onClick={() => withdrawRequest(b.pending_request!.id)} disabled={withdrawingId === b.pending_request.id}
                        className="mt-1 text-xs text-destructive font-semibold bg-transparent border-none cursor-pointer hover:underline p-0 disabled:opacity-50">
                        {t("space.request.withdraw")}
                      </button>
                    </div>
                  )}
                  {!b.verifying && (
                  <button 
                    onClick={() => handleCancelBooking(b.id)}
                    disabled={cancelling === b.id}
                    className="text-xs text-destructive bg-transparent border-none cursor-pointer hover:underline hover:text-destructive font-semibold disabled:opacity-50 flex items-center gap-1"
                  >
                    {cancelling === b.id ? <Loader2 className="w-3 h-3 animate-spin"/> : null} 
                    {t("space.cancelSessionBtn")}
                  </button>
                  )}
                  {canReschedule(b) && (
                  <button
                    onClick={() => {
                      setRescheduleBooking(b);
                      setRescheduleStep(1);
                      setRescheduleDate("");
                      setRescheduleTime("");
                    }}
                    className="text-xs text-primary bg-transparent border-none cursor-pointer hover:underline hover:text-teal-mid font-semibold flex items-center gap-1"
                  >
                    <Calendar className="w-3 h-3" />
                    {t("space.reschedule.btn")}
                  </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-card p-6">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">
          {t("space.historyCount")} ({past.length})
        </h3>
        {bookingsLoading ? (
          <SessionHistorySkeleton />
        ) : past.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground font-medium">{t("space.noHistory")}</p>
        ) : (
          <div className={`relative ${rtl ? "pr-8" : "pl-8"}`}>
            <div className={`absolute ${rtl ? "right-[15px]" : "left-[15px]"} top-2 bottom-2 w-[2px] bg-border/60`} />
            {past.map((b) => {
              const done = b.status === "done";
              const missed = b.status === "no-show";
              return (
                <div key={b.id} className="relative mb-6 last:mb-0">
                  <div className={`absolute ${rtl ? "-right-8" : "-left-8"} top-3 w-7 h-7 rounded-full flex items-center justify-center z-10 border-2 ${
                    done ? "bg-primary border-primary text-primary-foreground" :
                    missed ? "bg-warning/10 border-warning/30 text-warning" :
                    "bg-destructive/10 border-destructive text-destructive"
                  }`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : missed ? <X className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`bg-card rounded-2xl p-5 flex items-center justify-between gap-4 ${rtl ? "me-3 border-e-4" : "ms-3 border-s-4"} shadow-sm border border-border/40 ${
                    done ? "border-primary" :
                    missed ? "border-warning/30" :
                    "border-destructive"
                  }`}>
                    <div className="flex items-center gap-4">
                      {b.psychologist_avatar ? (
                        <img src={b.psychologist_avatar} alt={b.psychologist_name} className="w-10 h-10 rounded-full object-cover border border-primary/10 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {getInitials(b.psychologist_name)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-sm text-foreground">{b.psychologist_name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{fmt(b.booked_at)} · {fmtT(b.booked_at)}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`badge-pill ${done ? "badge-pill-done" : "badge-pill-cancelled"}`}>
                        {done ? t("space.status.done") : missed ? t(`space.status.missed.${b.no_show_party || "patient"}`) : t("space.status.cancelled")}
                      </span>
                      {done && (
                        <Link to={`/profil/${b.psychologist_id}?review=${b.id}`} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                          <Star className="w-3 h-3" /> {t("space.review.leave")}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>)}
      {/* Called, not rendered as <RescheduleModal />: a component defined inside
          render is a new type every render, so React remounted the dialog and
          text fields lost focus on each keystroke. */}
      {RescheduleModal()}
    </div>
  );
}
