import { Users, Calendar, TrendingUp, Clock, Phone, ChevronRight, Video, Loader2, Check, X, DollarSign } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SessionCardSkeleton } from "@/components/LoadingSkeletons";
import { getInitials } from "@/lib/utils";
import type { Page } from "./PsySidebar";

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
  status: "pending" | "confirmed" | "cancelled" | "done";
  duration_minutes: number;
  patient_id: string;
  patient_name?: string;
  patient_avatar?: string;
  price?: number;
  video_room_url?: string | null;
}

interface PsyDashboardProps {
  profileData: { full_name: string; avatar_url?: string };
  approvalStatus: string;
  totalUniquePatients: number;
  sessionsThisMonth: number;
  earningsThisMonth: number;
  upcomingBookings: Booking[];
  immediateRequests: { id: string; patient_id: string; status: string; created_at: string }[];
  handleRequestResponse: (requestId: string, accept: boolean) => Promise<void>;
  respondingToRequest: string | null;
  bookings: Booking[];
  bookingsLoading: boolean;
  updateBookingStatus: (id: string, newStatus: Booking["status"]) => Promise<void>;
  updating: string | null;
  handleStartCall: (bookingId: string) => Promise<void>;
  startingCall: string | null;
  realWeeklyEarnings: { day: string; amount: number }[];
  maxEarning: number;
  realPatients: { id: string; name: string; initials: string; sessions: number; lastSeen: string }[];
  setActivePage: (p: Page) => void;
}

export default function PsyDashboard({
  profileData, approvalStatus, totalUniquePatients, sessionsThisMonth,
  earningsThisMonth, upcomingBookings, immediateRequests, handleRequestResponse,
  respondingToRequest, bookings, bookingsLoading, updateBookingStatus, updating,
  handleStartCall, startingCall, realWeeklyEarnings, maxEarning, realPatients, setActivePage
}: PsyDashboardProps) {
  const { t, lang, dir } = useLanguage();

  return (
    <div className="p-4 sm:p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl text-foreground tracking-tight">
            {t("psy.dashboard.welcome")}, {profileData.full_name.split(" ")[0]} 👋
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5 font-sans">{t("psy.dashboard.welcomeSub")}</p>
        </div>
        <div className="text-xs font-semibold px-4 py-2 bg-teal-pale text-primary rounded-full border border-primary/10">
          Statut : {approvalStatus === "approved" ? "Compte Vérifié ✓" : approvalStatus === "pending" ? "Vérification en cours..." : "Action requise"}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: t("psy.dashboard.stat.totalPatients"),   value: totalUniquePatients,                                                              icon: <Users className="w-5 h-5" />,     color: "text-primary bg-teal-pale border-primary/10" },
          { label: t("psy.dashboard.stat.sessionsMonth"),   value: sessionsThisMonth,                                                                icon: <Calendar className="w-5 h-5" />,  color: "text-blue-700 bg-blue-50 border-blue-100" },
          { label: t("psy.dashboard.stat.earnings"),        value: earningsThisMonth > 0 ? `${(earningsThisMonth / 1000).toFixed(0)}k` : "0",       icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
          { label: t("psy.dashboard.stat.upcoming"),        value: upcomingBookings.length,                                                         icon: <Clock className="w-5 h-5" />,     color: "text-amber-700 bg-amber-50 border-amber-100" },
        ].map((stat) => (
          <div key={stat.label} className="dashboard-card p-6 flex items-center gap-5">
            <div className={`p-3 rounded-2xl border ${stat.color} shrink-0`}>{stat.icon}</div>
            <div>
              <div className="text-xs text-muted-foreground font-sans font-medium uppercase tracking-wider">{stat.label}</div>
              <div className="font-serif text-2xl text-foreground mt-1 font-semibold">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {immediateRequests.length > 0 && (
        <div className="dashboard-card p-6 border-l-4 border-emerald-500">
          <h3 className="font-serif text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-emerald-600" />
            {t("psy.incomingRequests") || "Demandes de session immédiate"}
            <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{immediateRequests.length}</span>
          </h3>
          <div className="space-y-3">
            {immediateRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <div>
                  <p className="text-sm font-medium text-foreground">Patient demande une session immédiate</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(req.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRequestResponse(req.id, true)}
                    disabled={respondingToRequest === req.id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {respondingToRequest === req.id && <Loader2 className="w-3 h-3 animate-spin" />}
                    {t("psy.accept") || "Accepter"}
                  </button>
                  <button
                    onClick={() => handleRequestResponse(req.id, false)}
                    disabled={respondingToRequest === req.id}
                    className="px-4 py-2 rounded-xl bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {respondingToRequest === req.id && <Loader2 className="w-3 h-3 animate-spin" />}
                    {t("psy.decline") || "Refuser"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="dashboard-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
              <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.dashboard.upcomingSessions")}</h3>
              <button onClick={() => setActivePage("sessions")} className="text-primary text-sm font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer hover:text-teal-mid transition-colors">
                {t("space.viewAll")} <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {bookingsLoading ? (
                <div className="space-y-4">{[1,2,3].map(i => <SessionCardSkeleton key={i} />)}</div>
              ) : bookings.filter(b => b.status === "confirmed" || b.status === "pending").length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-10">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
                  {t("psy.dashboard.noUpcoming")}
                </div>
              ) : (
                bookings.filter(b => b.status === "confirmed" || b.status === "pending").slice(0, 4).map((s) => (
                  <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border/50 rounded-2xl hover:border-primary/30 hover:bg-teal-hero/20 transition-all duration-300">
                    <div className="flex items-center gap-3.5">
                      {s.patient_avatar ? (
                        <img src={s.patient_avatar} alt={s.patient_name} className="w-11 h-11 rounded-full object-cover border border-primary/10 shrink-0 shadow-sm" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/5 shadow-sm">
                          {getInitials(s.patient_name)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-sm text-foreground">{s.patient_name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 font-sans">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground/75" />
                          <span>{new Date(s.booked_at).toLocaleDateString("fr-FR")} · {new Date(s.booked_at).toLocaleTimeString("fr-FR", {hour: '2-digit', minute:'2-digit'})} ({s.duration_minutes} min)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0 self-end sm:self-center">
                      {s.status === "pending" ? (
                        <>
                          <button
                            onClick={() => updateBookingStatus(s.id, "confirmed")}
                            disabled={updating === s.id}
                            className="bg-teal-pale text-primary border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-teal-mid hover:text-white transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {t("psy.dashboard.confirm")}
                          </button>
                          <button
                            onClick={() => updateBookingStatus(s.id, "cancelled")}
                            disabled={updating === s.id}
                            className="bg-red-50 text-red-600 border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-red-100 transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm"
                          >
                            <X className="w-3.5 h-3.5" />
                            {t("psy.dashboard.reject")}
                          </button>
                        </>
                      ) : (
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
                          <button
                            onClick={() => updateBookingStatus(s.id, "done")}
                            disabled={updating === s.id}
                            className="bg-gray-100 text-gray-700 border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-gray-200 transition-all disabled:opacity-50 shadow-sm"
                          >
                            {t("psy.dashboard.markDone")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("psy.dashboard.weeklyEarnings")}</h3>
            <div className="relative h-44 mt-6">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="w-full border-t border-dashed border-border/40" />
                <div className="w-full border-t border-dashed border-border/40" />
                <div className="w-full border-t border-dashed border-border/40" />
                <div className="w-full border-t border-border/60" />
              </div>

              <div className="absolute inset-0 flex items-end justify-between gap-1.5 px-2">
                {realWeeklyEarnings.map((e) => {
                  const pct = maxEarning > 0 ? (e.amount / maxEarning) * 100 : 0;
                  return (
                    <div key={e.day} className="flex-1 h-full flex flex-col justify-end items-center relative group">
                      <span className="absolute -top-7 bg-foreground text-background text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-sm z-20 whitespace-nowrap">
                        {e.amount.toLocaleString()} DA
                      </span>
                      <div
                        className="w-5 sm:w-6 bg-primary/10 hover:bg-primary/20 transition-all rounded-t-md relative cursor-pointer"
                        style={{ height: `${pct}%`, minHeight: e.amount > 0 ? "8px" : "4px" }}
                      >
                        {e.amount > 0 && (
                          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-primary rounded-t-md" />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-2 block">{e.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("psy.dashboard.weekTotal")}</div>
              <div className="font-serif text-2xl text-primary font-bold mt-0.5">
                {realWeeklyEarnings.reduce((s, e) => s + e.amount, 0).toLocaleString()} DA
              </div>
            </div>
            <TrendingUp className="w-7 h-7 text-primary/40" />
          </div>
        </div>
      </div>

      <div className="dashboard-card p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
          <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.dashboard.recentPatients")}</h3>
          <button onClick={() => setActivePage("patients")} className="text-primary text-sm font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer hover:text-teal-mid transition-colors">
            {t("space.viewAll")} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {realPatients.length === 0 && !bookingsLoading ? (
            <div className="text-sm text-muted-foreground text-center py-6 col-span-full">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
              {t("psy.dashboard.noPatients")}
            </div>
          ) : realPatients.slice(0, 4).map((p) => {
            const matchingBooking = bookings.find(b => b.patient_id === p.id);
            const avatarUrl = matchingBooking?.patient_avatar;

            return (
              <div key={p.id} className="flex items-center gap-3.5 p-4 border border-border/40 rounded-2xl bg-teal-hero/10 hover:bg-teal-hero/30 transition-all duration-300">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={p.name} className="w-10 h-10 rounded-full object-cover border border-primary/10 shrink-0 shadow-sm" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/5 shadow-sm">
                    {p.initials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-sans leading-none">{p.sessions} {t("psy.dashboard.sessionCount")}</div>
                  <div className="text-[10px] text-primary font-medium mt-1 font-sans leading-none">{t("psy.dashboard.lastVisit")} : {p.lastSeen}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
