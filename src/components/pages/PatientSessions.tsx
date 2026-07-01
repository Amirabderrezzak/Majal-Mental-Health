import { useState } from "react";
import { Calendar, Clock, Check, X, Loader2, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { SessionCalendar } from "@/components/SessionCalendar";
import { SessionsListSkeleton, SessionHistorySkeleton } from "@/components/LoadingSkeletons";
import { isSameDay } from "date-fns";

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
}

interface PatientSessionsProps {
  upcoming: Booking[];
  past: Booking[];
  cancellling: string | null;
  bookingsLoading: boolean;
  handleCancelBooking: (id: string) => void;
  handleReschedule: (booking: Booking, date: string, time: string) => Promise<void>;
  locale: string;
  fmt: (iso: string) => string;
  fmtT: (iso: string) => string;
  getInitials: (name?: string) => string;
}

export default function PatientSessions({
  upcoming,
  past,
  cancellling,
  bookingsLoading,
  handleCancelBooking,
  handleReschedule,
  locale,
  fmt,
  fmtT,
  getInitials,
}: PatientSessionsProps) {
  const { t, dir } = useLanguage();
  const rtl = dir === "rtl";
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedCalDate, setSelectedCalDate] = useState<Date | undefined>(undefined);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [rescheduleStep, setRescheduleStep] = useState(1);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const allBookings = [...upcoming, ...past];

  const getAvailableSlots = () => {
    if (!rescheduleDate) return [];
    const slots = [];
    for (let h = 8; h < 20; h++) {
      slots.push(`${String(h).padStart(2, "0")}:00`);
      slots.push(`${String(h).padStart(2, "0")}:30`);
    }
    return slots;
  };

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

  const RescheduleModal = () => {
    if (!rescheduleBooking) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setRescheduleBooking(null); setRescheduleStep(1); setRescheduleDate(""); setRescheduleTime(""); }} />
        <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200">

          <div className="flex items-center justify-center gap-2 mb-6">
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
          </div>

          {rescheduleStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground">Reporter cette séance</h3>
              <p className="text-sm text-muted-foreground">Vous allez reporter votre séance avec :</p>
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
              <button
                onClick={() => setRescheduleStep(2)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all"
              >
                Choisir un nouveau créneau
              </button>
            </div>
          )}

          {rescheduleStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground">Choisir une nouvelle date</h3>
              <input
                type="date"
                value={rescheduleDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={e => setRescheduleDate(e.target.value)}
                className="w-full px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none focus:border-primary focus:bg-card transition-all font-sans"
              />
              <div className="flex gap-3">
                <button onClick={() => setRescheduleStep(1)} className="px-4 py-3 border border-border/50 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer hover:bg-accent/40 transition-all">Retour</button>
                <button
                  onClick={() => rescheduleDate && setRescheduleStep(3)}
                  disabled={!rescheduleDate}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-50"
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {rescheduleStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground">Choisir un horaire</h3>
              <p className="text-xs text-muted-foreground">{new Date(rescheduleDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                {getAvailableSlots().map(slot => (
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
              <div className="flex gap-3">
                <button onClick={() => setRescheduleStep(2)} className="px-4 py-3 border border-border/50 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer hover:bg-accent/40 transition-all">Retour</button>
                <button
                  onClick={() => rescheduleTime && setRescheduleStep(4)}
                  disabled={!rescheduleTime}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-50"
                >
                  Confirmer
                </button>
              </div>
            </div>
          )}

          {rescheduleStep === 4 && (
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground">Confirmer le report</h3>
              <div className="p-5 rounded-2xl border border-border/50 bg-teal-hero/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {getInitials(rescheduleBooking.psychologist_name)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{rescheduleBooking.psychologist_name}</div>
                    <div className="text-xs text-muted-foreground">Psychologue</div>
                  </div>
                </div>
                <div className="border-t border-border/30 pt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold">{new Date(rescheduleDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold">{rescheduleTime}</span>
                    <span className="text-muted-foreground">· {rescheduleBooking.duration_minutes} min</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">Un email de confirmation sera envoyé au thérapeute.</p>
              <div className="flex gap-3">
                <button onClick={() => setRescheduleStep(3)} className="px-4 py-3 border border-border/50 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer hover:bg-accent/40 transition-all">Retour</button>
                <button
                  onClick={handleConfirmReschedule}
                  disabled={rescheduling}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {rescheduling && <Loader2 className="w-4 h-4 animate-spin" />}
                  {rescheduling ? "Report en cours..." : "Confirmer le report"}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => { setRescheduleBooking(null); setRescheduleStep(1); setRescheduleDate(""); setRescheduleTime(""); }}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-all border-none bg-transparent cursor-pointer"
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
          >Liste</button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border-none ${
              viewMode === "calendar" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
            }`}
          >Calendrier</button>
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
                {selectedCalDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
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
                          <div className="text-xs text-primary font-medium mt-0.5">{b.psychologist_specialty || "Psychologue"}</div>
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
                    <div className="text-xs text-primary font-medium mt-0.5">{b.psychologist_specialty || "Psychologue"}</div>
                    <div className="text-xs text-muted-foreground mt-1">{fmt(b.booked_at)} · {fmtT(b.booked_at)} · {b.duration_minutes} {t("space.minutesLabel")}</div>
                    {b.price && <div className="text-xs text-muted-foreground/80 mt-0.5">{b.price.toLocaleString()} {t("space.priceCurrency")}</div>}
                  </div>
                </div>
                <div className="flex sm:flex-col items-end gap-2.5 self-end sm:self-center">
                  <span className={`badge-pill ${b.status === "confirmed" ? "badge-pill-confirmed" : b.status === "no-show" ? "badge-pill-cancelled" : "badge-pill-pending"}`}>
                    {b.status === "confirmed" ? t("space.status.confirmed") : b.status === "no-show" ? "Absent" : t("space.status.pending")}
                  </span>
                  <button 
                    onClick={() => handleCancelBooking(b.id)}
                    disabled={cancelling === b.id}
                    className="text-xs text-destructive bg-transparent border-none cursor-pointer hover:underline hover:text-red-700 font-semibold disabled:opacity-50 flex items-center gap-1"
                  >
                    {cancelling === b.id ? <Loader2 className="w-3 h-3 animate-spin"/> : null} 
                    {t("space.cancelSessionBtn")}
                  </button>
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
                    Reporter
                  </button>
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
                    missed ? "bg-amber-100 border-amber-500 text-amber-600" :
                    "bg-destructive/10 border-destructive text-destructive"
                  }`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : missed ? <X className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`bg-card rounded-2xl p-5 flex items-center justify-between gap-4 ${rtl ? "me-3 border-e-4" : "ms-3 border-s-4"} shadow-sm border border-border/40 ${
                    done ? "border-primary" :
                    missed ? "border-amber-400" :
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
                    <span className={`badge-pill ${done ? "badge-pill-done" : missed ? "badge-pill-cancelled" : "badge-pill-cancelled"}`}>
                      {done ? t("space.status.done") : missed ? "Absent" : t("space.status.cancelled")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>)}
      <RescheduleModal />
    </div>
  );
}
