import { useState, useCallback, useRef } from "react";
import { Users, Calendar, TrendingUp, Clock, Phone, ChevronRight, Video, Loader2, Check, X, AlertCircle, UserCheck, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNow } from "@/hooks/useNow";
import { SessionCardSkeleton } from "@/components/LoadingSkeletons";
import { getInitials } from "@/lib/utils";
import type { Page } from "./PsySidebar";

const SESSION_OPEN_MINUTES = 15;

const getSessionTimeState = (booked_at: string, duration_minutes: number, now: Date) => {
  const start = new Date(booked_at);
  const end = new Date(start.getTime() + (duration_minutes || 60) * 60 * 1000);
  const earlyBuffer = SESSION_OPEN_MINUTES * 60 * 1000;
  if (now < new Date(start.getTime() - earlyBuffer)) return "upcoming" as const;
  if (now > end) return "ended" as const;
  return "active" as const;
};

const formatRelativeTime = (booked_at: string, now: Date) => {
  const start = new Date(booked_at);
  const diffMs = start.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const mins = Math.ceil(abs / 60000);
  if (diffMs < 0) {
    if (mins < 60) return `Il y a ${mins}min`;
    return `Il y a ${Math.floor(mins / 60)}h`;
  }
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Dans ${mins}min`;
  if (mins < 120) return `Dans 1h${mins % 60 > 0 ? `${mins % 60}min` : ""}`;
  return `Dans ${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${mins % 60}min` : ""}`;
};

const formatDateLabel = (booked_at: string, now: Date) => {
  const start = new Date(booked_at);
  const diffDays = Math.floor((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const timeStr = start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Aujourd'hui à ${timeStr}`;
  if (diffDays === 1) return `Demain à ${timeStr}`;
  if (diffDays < 7) return `${start.toLocaleDateString("fr-FR", { weekday: "long" })} à ${timeStr}`;
  return `${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${timeStr}`;
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

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending:   { label: "En attente",    icon: <Clock className="w-3 h-3" />,     className: "bg-amber-50 text-amber-700 border border-amber-200" },
  confirmed: { label: "Confirmé",      icon: <Check className="w-3 h-3" />,     className: "bg-teal-50 text-teal-700 border border-teal-200" },
  done:      { label: "Terminé",       icon: <Sparkles className="w-3 h-3" />,  className: "bg-gray-100 text-gray-600 border border-gray-200" },
  cancelled: { label: "Annulé",        icon: <X className="w-3 h-3" />,         className: "bg-red-50 text-red-600 border border-red-200" },
};

export default function PsyDashboard({
  profileData, approvalStatus, totalUniquePatients, sessionsThisMonth,
  earningsThisMonth, upcomingBookings, immediateRequests, handleRequestResponse,
  respondingToRequest, bookings, bookingsLoading, updateBookingStatus, updating,
  handleStartCall, startingCall, realWeeklyEarnings, maxEarning, realPatients, setActivePage
}: PsyDashboardProps) {
  const { t, dir } = useLanguage();
  const now = useNow(30_000);
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, string>>({});
  const sessionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeBookings = bookings.filter(b => b.status === "confirmed" || b.status === "pending");

  const doUpdate = useCallback(async (id: string, newStatus: Booking["status"]) => {
    setOptimisticStatuses(p => ({ ...p, [id]: newStatus }));
    try {
      await updateBookingStatus(id, newStatus);
    } catch {
      setOptimisticStatuses(p => { const c = { ...p }; delete c[id]; return c; });
    }
  }, [updateBookingStatus]);

  const timeStateBorder = (state: "upcoming" | "active" | "ended") => {
    if (state === "active") return "border-l-4 border-l-emerald-400 bg-gradient-to-r from-emerald-50/40 to-transparent";
    if (state === "upcoming") return "border-l-4 border-l-blue-300";
    return "";
  };

  return (
    <div className="p-4 sm:p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl text-foreground tracking-tight">{t("psy.dashboard.welcome")}, {profileData.full_name.split(" ")[0]} 👋</h2>
          <p className="text-muted-foreground text-sm mt-1.5 font-sans">{t("psy.dashboard.welcomeSub")}</p>
        </div>
        <div className={`text-xs font-semibold px-4 py-2 rounded-full border flex items-center gap-1.5 ${
          approvalStatus === "approved" ? "bg-teal-50 text-teal-700 border-teal-200" :
          approvalStatus === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
          "bg-red-50 text-red-600 border-red-200"
        }`}>
          {approvalStatus === "approved" ? <UserCheck className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {approvalStatus === "approved" ? "Compte vérifié" : approvalStatus === "pending" ? "Vérification en cours..." : "Action requise"}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: t("psy.dashboard.stat.totalPatients"),   value: totalUniquePatients,   icon: <Users className="w-5 h-5" />,     color: "text-primary bg-teal-pale border-primary/10",  trend: "+12%" },
          { label: t("psy.dashboard.stat.sessionsMonth"),   value: sessionsThisMonth,      icon: <Calendar className="w-5 h-5" />,  color: "text-blue-700 bg-blue-50 border-blue-100",     trend: null },
          { label: t("psy.dashboard.stat.earnings"),        value: earningsThisMonth > 0 ? `${(earningsThisMonth / 1000).toFixed(0)}k` : "0", icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-700 bg-emerald-50 border-emerald-100", trend: null },
          { label: t("psy.dashboard.stat.upcoming"),        value: upcomingBookings.length, icon: <Clock className="w-5 h-5" />,    color: "text-amber-700 bg-amber-50 border-amber-100", trend: null },
        ].map((stat) => (
          <div key={stat.label} className="dashboard-card p-6 flex items-center gap-5 hover:shadow-md transition-all duration-300 group">
            <div className={`p-3 rounded-2xl border ${stat.color} group-hover:scale-110 transition-transform duration-300`}>{stat.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground font-sans font-medium uppercase tracking-wider">{stat.label}</div>
              <div className="font-serif text-2xl text-foreground mt-1 font-semibold">{stat.value}</div>
              {stat.trend && <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">{stat.trend} vs mois dernier</div>}
            </div>
          </div>
        ))}
      </div>

      {immediateRequests.length > 0 && (
        <div className="dashboard-card p-5 border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50/30 to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Phone className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-base font-semibold text-foreground">Demandes de session immédiate</h3>
              <p className="text-xs text-muted-foreground">{immediateRequests.length} en attente</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold animate-pulse">{immediateRequests.length}</span>
          </div>
          <div className="space-y-2.5">
            {immediateRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-emerald-100 shadow-xs hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Nouvelle demande</p>
                    <p className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRequestResponse(req.id, true)} disabled={respondingToRequest === req.id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs">
                    {respondingToRequest === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Accepter
                  </button>
                  <button onClick={() => handleRequestResponse(req.id, false)} disabled={respondingToRequest === req.id}
                    className="px-4 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5" />
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="dashboard-card overflow-hidden">
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.dashboard.upcomingSessions")}</h3>
                {activeBookings.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{activeBookings.length}</span>
                )}
              </div>
              <button onClick={() => setActivePage("sessions")} className="text-primary text-sm font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer hover:text-teal-mid transition-colors">
                Voir tout <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="px-6 pb-6 space-y-3">
            {bookingsLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <SessionCardSkeleton key={i} />)}</div>
            ) : activeBookings.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-teal-hero flex items-center justify-center mx-auto mb-4 border border-teal-light/10">
                  <Calendar className="w-7 h-7 text-primary/60" />
                </div>
                <p className="text-sm font-medium text-foreground">Aucune séance à venir</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">Les nouvelles réservations apparaîtront ici dès qu'elles seront confirmées par les patients.</p>
              </div>
            ) : (
              activeBookings.slice(0, 5).map((s) => {
                const effectiveStatus = optimisticStatuses[s.id] || s.status;
                const timeState = effectiveStatus === "pending" || effectiveStatus === "confirmed"
                  ? getSessionTimeState(s.booked_at, s.duration_minutes, now) : "ended";
                const statusCfg = statusConfig[effectiveStatus] || statusConfig.cancelled;
                const isActive = timeState === "active" && effectiveStatus === "confirmed";
                const isUpcoming = timeState === "upcoming";

                return (
                  <div key={s.id}
                    ref={el => sessionRefs.current[s.id] = el}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                      effectiveStatus !== "pending" && effectiveStatus !== "confirmed"
                        ? "border-gray-100 bg-gray-50/50 opacity-60"
                        : isActive
                        ? "border-emerald-200 bg-emerald-50/40 shadow-sm"
                        : "border-border/50 bg-card hover:border-primary/30 hover:bg-teal-hero/20"
                    } ${timeStateBorder(timeState)}`}>
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {s.patient_avatar ? (
                        <img src={s.patient_avatar} alt={s.patient_name} className="w-10 h-10 rounded-full object-cover border border-primary/10 shrink-0 shadow-xs" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/5 shadow-xs">
                          {getInitials(s.patient_name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-foreground truncate">{s.patient_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[11px] ${isActive ? "text-emerald-700 font-semibold" : "text-muted-foreground"} flex items-center gap-1`}>
                            <Clock className="w-3 h-3" />
                            {isActive ? "En cours" : isUpcoming ? formatRelativeTime(s.booked_at, now) : formatDateLabel(s.booked_at, now)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">· {s.duration_minutes}min</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {effectiveStatus === "pending" ? (
                        <>
                          <span className={`text-[10px] px-2 py-1 rounded-full font-semibold flex items-center gap-1 ${statusCfg.className}`}>
                            {statusCfg.icon} {statusCfg.label}
                          </span>
                          <button onClick={() => doUpdate(s.id, "confirmed")} disabled={updating === s.id}
                            className="bg-primary text-primary-foreground border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-teal-mid active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1 shadow-xs">
                            {updating === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Confirmer
                          </button>
                          <button onClick={() => doUpdate(s.id, "cancelled")} disabled={updating === s.id}
                            className="bg-red-50 text-red-600 border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`text-[10px] px-2 py-1 rounded-full font-semibold flex items-center gap-1 ${statusCfg.className}`}>
                            {statusCfg.icon}
                            {isActive ? "En direct" : statusCfg.label}
                          </span>
                          {isActive && (
                            <button onClick={() => handleStartCall(s.id)} disabled={startingCall === s.id}
                              className="bg-emerald-600 text-white border-none rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1.5 shadow-xs">
                              {startingCall === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                              Rejoindre
                            </button>
                          )}
                          {effectiveStatus === "confirmed" && !isActive && (
                            <button onClick={() => doUpdate(s.id, "done")} disabled={updating === s.id}
                              className="bg-gray-100 text-gray-600 border-none rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50">
                              Terminer
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="dashboard-card p-6">
          <div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("psy.dashboard.weeklyEarnings")}</h3>
            <div className="relative h-44 mt-4">
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
                      <span className="absolute -top-7 bg-foreground text-background text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-sm z-20 whitespace-nowrap">
                        {e.amount.toLocaleString()} DA
                      </span>
                      <div className="w-5 sm:w-6 bg-primary/10 hover:bg-primary/20 transition-all rounded-t-md relative cursor-pointer"
                        style={{ height: `${pct}%`, minHeight: e.amount > 0 ? "8px" : "4px" }}>
                        {e.amount > 0 && <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-primary rounded-t-md" />}
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
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.dashboard.recentPatients")}</h3>
            {realPatients.length > 0 && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{realPatients.length}</span>}
          </div>
          <button onClick={() => setActivePage("patients")} className="text-primary text-sm font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer hover:text-teal-mid transition-colors">
            {t("space.viewAll")} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {realPatients.length === 0 && !bookingsLoading ? (
            <div className="text-center py-8 col-span-full">
              <div className="w-14 h-14 rounded-2xl bg-teal-hero flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-foreground">Aucun patient pour le moment</p>
              <p className="text-xs text-muted-foreground mt-1">Les patients apparaîtront ici après avoir réservé une séance avec vous.</p>
            </div>
          ) : realPatients.slice(0, 4).map((p) => {
            const matchingBooking = bookings.find(b => b.patient_id === p.id);
            const avatarUrl = matchingBooking?.patient_avatar;
            return (
              <div key={p.id} className="flex items-center gap-3.5 p-4 border border-border/40 rounded-2xl bg-teal-hero/10 hover:bg-teal-hero/30 hover:border-primary/20 transition-all duration-300 group cursor-pointer">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={p.name} className="w-10 h-10 rounded-full object-cover border border-primary/10 shrink-0 shadow-xs group-hover:scale-110 transition-transform" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/5 shadow-xs group-hover:scale-110 transition-transform">
                    {p.initials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-sans">{p.sessions} séance{p.sessions > 1 ? "s" : ""}</div>
                  <div className="text-[10px] text-primary font-medium mt-0.5 font-sans">Dernière visite : {p.lastSeen}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}