import { useState } from "react";
import { Video, Loader2, CalendarClock } from "lucide-react";
import { algiersParts, algiersSlotToDate } from "@/lib/availability";
import { fmtDate, fmtTime } from "@/lib/sessionApi";
import { useLanguage } from "@/contexts/LanguageContext";
import { SessionCalendar } from "@/components/SessionCalendar";
import { SessionsListSkeleton } from "@/components/LoadingSkeletons";
import { getInitials } from "@/lib/utils";
import { isSameDay } from "date-fns";

const SESSION_OPEN_MINUTES = 15;

const getSessionTimeState = (booked_at: string, duration_minutes: number) => {
  const now = new Date();
  const start = new Date(booked_at);
  const end = new Date(start.getTime() + (duration_minutes || 60) * 60 * 1000);
  const earlyBuffer = SESSION_OPEN_MINUTES * 60 * 1000;
  if (now < new Date(start.getTime() - earlyBuffer)) return "upcoming" as const;
  if (now > end) return "ended" as const;
  return "active" as const;
};

const formatTimeUntil = (booked_at: string) => {
  const now = new Date();
  const start = new Date(booked_at);
  const diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) return "";
  const mins = Math.ceil(diffMs / 60000);
  // Days for long waits ("30j 21h", not "741h 49min").
  if (mins >= 24 * 60) return `${Math.floor(mins / 1440)}j${Math.floor((mins % 1440) / 60) > 0 ? ` ${Math.floor((mins % 1440) / 60)}h` : ""}`;
  if (mins >= 60) return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}min` : ""}`;
  return `${mins}min`;
};

interface Booking {
  id: string;
  booked_at: string;
  status: "pending" | "confirmed" | "cancelled" | "done" | "no-show";
  duration_minutes: number;
  patient_id: string;
  patient_name?: string;
  patient_avatar?: string;
  price?: number;
  video_room_url?: string | null;
}

interface PsySessionsProps {
  bookings: Booking[];
  bookingsLoading: boolean;
  updateBookingStatus: (id: string, newStatus: Booking["status"]) => Promise<void>;
  updating: string | null;
  handleStartCall: (bookingId: string) => Promise<void>;
  startingCall: string | null;
  statusLabels: Record<string, string>;
  /** Rendered above the list (pending "propose another time" requests). */
  topSlot?: React.ReactNode;
  /** Open reschedule request per booking (either side). */
  requestsByBooking?: Record<string, { id: string; proposed_at: string; initiated_by: string }>;
  /** Therapist proposes another time for a paid session (instead of cancelling). */
  onPropose?: (bookingId: string, proposedAtIso: string, message: string) => Promise<boolean>;
  onWithdrawProposal?: (requestId: string) => Promise<void>;
}

export default function PsySessions({
  bookings, bookingsLoading, updateBookingStatus, updating,
  handleStartCall, startingCall, statusLabels, topSlot,
  requestsByBooking = {}, onPropose, onWithdrawProposal,
}: PsySessionsProps) {
  const { t, lang } = useLanguage();
  const locale = lang === "ar" ? "ar-DZ" : "fr-FR";
  // "Propose another time" dialog
  const [proposeFor, setProposeFor] = useState<Booking | null>(null);
  const [pDate, setPDate] = useState("");
  const [pTime, setPTime] = useState("");
  const [pMessage, setPMessage] = useState("");
  const [proposing, setProposing] = useState(false);
  const todayAlgiers = (() => { const a = algiersParts(new Date()); return `${a.y}-${String(a.mo + 1).padStart(2, "0")}-${String(a.d).padStart(2, "0")}`; })();
  const closePropose = () => { setProposeFor(null); setPDate(""); setPTime(""); setPMessage(""); };
  const submitPropose = async () => {
    if (!proposeFor || !pDate || !pTime || !onPropose) return;
    const [y, m, d] = pDate.split("-").map(Number);
    setProposing(true);
    const ok = await onPropose(proposeFor.id, algiersSlotToDate(y, m - 1, d, pTime).toISOString(), pMessage.trim());
    setProposing(false);
    if (ok) closePropose();
  };
  // Rendered by calling it (not as <ProposeDialog />) so inputs keep focus.
  const ProposeDialog = () => !proposeFor ? null : (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="propose-title">
      <div className="absolute inset-0 bg-black/40" onClick={closePropose} />
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 md:p-8 space-y-4">
        <h3 id="propose-title" className="font-serif text-lg font-semibold text-foreground">{t("psy.propose.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("psy.propose.intro").replace("{name}", proposeFor.patient_name || t("psy.common.patient"))}{" "}
          <strong className="text-foreground">{fmtDate(proposeFor.booked_at, locale, { weekday: "long", day: "numeric", month: "long" })} · {fmtTime(proposeFor.booked_at, locale)}</strong>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            {t("res.date")}
            <input type="date" value={pDate} min={todayAlgiers} onChange={(e) => setPDate(e.target.value)}
              className="px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none focus:border-primary font-sans" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            {t("space.request.timeLabel")}
            <input type="time" step={900} value={pTime} onChange={(e) => setPTime(e.target.value)}
              className="px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none focus:border-primary font-sans" />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          {t("space.request.messageLabel")}
          <textarea value={pMessage} maxLength={500} rows={3} onChange={(e) => setPMessage(e.target.value)} placeholder={t("psy.propose.placeholder")}
            className="px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none focus:border-primary font-sans resize-none" />
        </label>
        <p className="text-xs text-muted-foreground">{t("psy.propose.note")}</p>
        <div className="flex gap-3">
          <button onClick={closePropose} className="px-4 py-3 border border-border/50 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer hover:bg-accent/40">{t("common.back")}</button>
          <button onClick={submitPropose} disabled={!pDate || !pTime || proposing}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid disabled:opacity-50 flex items-center justify-center gap-2">
            {proposing && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("psy.propose.send")}
          </button>
        </div>
      </div>
    </div>
  );
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedCalDate, setSelectedCalDate] = useState<Date | undefined>(undefined);

  const filteredBookings = viewMode === "calendar" && selectedCalDate
    ? bookings.filter((b) => isSameDay(new Date(b.booked_at), selectedCalDate))
    : bookings;

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
      {topSlot}
      <div className="dashboard-card overflow-hidden">
        <div className="p-5 border-b border-border/40 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.dashboard.allSessions")}</h3>
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
          <span className="text-xs font-semibold px-3 py-1 bg-teal-pale text-primary rounded-full border border-primary/5">
            {viewMode === "calendar" && selectedCalDate
              ? `${filteredBookings.length} sur ${bookings.length}`
              : `${bookings.length} ${t("psy.dashboard.nav.sessions")}`
            }
          </span>
        </div>

        {viewMode === "calendar" && (
          <SessionCalendar
            bookings={bookings}
            selected={selectedCalDate}
            onSelect={setSelectedCalDate}
          />
        )}

        <div className="divide-y divide-border/30">
          {bookingsLoading ? <SessionsListSkeleton /> :
           filteredBookings.length === 0 ? <div className="text-muted-foreground text-center py-12 text-sm">{t("psy.dashboard.noSessions")}</div> :
           filteredBookings.map((s) => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-teal-hero/30 transition-colors flex-wrap justify-between">
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {s.patient_avatar ? (
                  <img src={s.patient_avatar} alt={s.patient_name} className="w-11 h-11 rounded-full object-cover border border-primary/10 shrink-0 shadow-sm" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/5 shadow-sm">
                    {getInitials(s.patient_name)}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-sm text-foreground">{s.patient_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{new Date(s.booked_at).toLocaleDateString("fr-FR", { timeZone: "Africa/Algiers" })} · {s.duration_minutes} min</div>
                </div>
              </div>
              <div className="text-sm font-semibold text-foreground w-20 text-center font-sans">
                {new Date(s.booked_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Algiers" })}
              </div>

              <div className="flex items-center gap-3.5 flex-wrap">
                <span className={`badge-pill ${
                  s.status === "confirmed" ? "badge-pill-confirmed" :
                  s.status === "pending" ? "badge-pill-pending" :
                  s.status === "done" ? "badge-pill-done" : "badge-pill-cancelled"
                }`}>
                  {statusLabels[s.status]}
                </span>

                <div className="flex gap-2">
                  {s.status === "pending" && (
                    <>
                      <button onClick={() => updateBookingStatus(s.id, "cancelled")} disabled={updating === s.id} className="bg-destructive/10 text-destructive border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-destructive/10 transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm">{t("psy.dashboard.reject")}</button>
                    </>
                  )}
                  {s.status === "confirmed" && (
                    <>
                      {(() => {
                        const timeState = getSessionTimeState(s.booked_at, s.duration_minutes);
                        const timeLabel = timeState === "upcoming" ? `Ouvre dans ${formatTimeUntil(s.booked_at)}` : null;
                        return (
                          <button
                            onClick={() => handleStartCall(s.id)}
                            disabled={startingCall === s.id || timeState !== "active"}
                            title={timeLabel || undefined}
                            className={`${timeState === "active" ? "bg-primary text-primary-foreground hover:bg-teal-mid" : "bg-muted text-muted-foreground cursor-not-allowed"} border-none rounded-xl px-3.5 py-2 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm`}
                          >
                            {startingCall === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                            {timeState === "ended" ? "Terminée" : timeLabel || t("psy.dashboard.startVideo")}
                          </button>
                        );
                      })()}
                      <button onClick={() => updateBookingStatus(s.id, "done")} disabled={updating === s.id || new Date(s.booked_at).getTime() > Date.now()} title={new Date(s.booked_at).getTime() > Date.now() ? "Disponible une fois la séance commencée" : undefined} className="bg-muted text-foreground border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-accent/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">{t("psy.dashboard.markDone")}</button>
                      {(() => {
                        const req = requestsByBooking[s.id];
                        if (req && req.initiated_by === "psychologist") {
                          return (
                            <span className="flex items-center gap-2 text-xs rounded-xl border border-warning/30 bg-warning/10 px-3 py-1.5">
                              <span className="text-foreground">{t("psy.propose.pending")} <strong>{fmtDate(req.proposed_at, locale)} · {fmtTime(req.proposed_at, locale)}</strong></span>
                              <button onClick={() => onWithdrawProposal?.(req.id)} className="text-destructive font-semibold bg-transparent border-none cursor-pointer hover:underline p-0">{t("space.request.withdraw")}</button>
                            </span>
                          );
                        }
                        if (req || new Date(s.booked_at).getTime() <= Date.now() || !onPropose) return null;
                        return (
                          <button onClick={() => setProposeFor(s)} className="bg-teal-pale text-primary border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-teal-pale/70 transition-all flex items-center gap-1.5 shadow-sm">
                            <CalendarClock className="w-3.5 h-3.5" /> {t("psy.propose.cta")}
                          </button>
                        );
                      })()}
                      <button onClick={() => { if (window.confirm(t("psy.sessions.cancelConfirm"))) updateBookingStatus(s.id, "cancelled"); }} disabled={updating === s.id} className="bg-destructive/10 text-destructive border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-destructive/10 transition-all disabled:opacity-50 shadow-sm">{t("space.cancel")}</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {ProposeDialog()}
    </div>
  );
}
