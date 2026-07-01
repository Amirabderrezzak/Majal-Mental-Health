import { useState } from "react";
import { Video, Loader2 } from "lucide-react";
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
}

export default function PsySessions({
  bookings, bookingsLoading, updateBookingStatus, updating,
  handleStartCall, startingCall, statusLabels
}: PsySessionsProps) {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedCalDate, setSelectedCalDate] = useState<Date | undefined>(undefined);

  const filteredBookings = viewMode === "calendar" && selectedCalDate
    ? bookings.filter((b) => isSameDay(new Date(b.booked_at), selectedCalDate))
    : bookings;

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
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
              >Liste</button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border-none ${
                  viewMode === "calendar" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >Calendrier</button>
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
                  <div className="text-xs text-muted-foreground mt-0.5">{new Date(s.booked_at).toLocaleDateString("fr-FR")} · {s.duration_minutes} min</div>
                </div>
              </div>
              <div className="text-sm font-semibold text-foreground w-20 text-center font-sans">
                {new Date(s.booked_at).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
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
                      <button onClick={() => updateBookingStatus(s.id, "confirmed")} disabled={updating === s.id} className="bg-teal-pale text-primary border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-primary hover:text-white transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm">{t("psy.dashboard.confirm")}</button>
                      <button onClick={() => updateBookingStatus(s.id, "cancelled")} disabled={updating === s.id} className="bg-red-50 text-red-600 border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-red-100 transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm">{t("psy.dashboard.reject")}</button>
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
                            className={`${timeState === "active" ? "bg-primary text-primary-foreground hover:bg-teal-mid" : "bg-gray-100 text-gray-400 cursor-not-allowed"} border-none rounded-xl px-3.5 py-2 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm`}
                          >
                            {startingCall === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                            {timeState === "ended" ? "Terminée" : timeLabel || t("psy.dashboard.startVideo")}
                          </button>
                        );
                      })()}
                      <button onClick={() => updateBookingStatus(s.id, "done")} disabled={updating === s.id} className="bg-gray-100 text-gray-700 border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-gray-200 transition-all disabled:opacity-50 shadow-sm">{t("psy.dashboard.markDone")}</button>
                      <button onClick={() => updateBookingStatus(s.id, "cancelled")} disabled={updating === s.id} className="bg-red-50 text-red-600 border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-red-100 transition-all disabled:opacity-50 shadow-sm">{t("space.cancel")}</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
