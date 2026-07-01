import { useState } from "react";
import { Calendar, Clock, Heart, ChevronRight, Video, X, Loader2, TrendingUp, Sparkles, Timer, Award, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNow } from "@/hooks/useNow";
import { SessionCardSkeleton } from "@/components/LoadingSkeletons";
import GoalsWidget from "./GoalsWidget";
import CrisisHelpline from "./CrisisHelpline";

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

const formatCountdown = (booked_at: string, now: Date) => {
  const diffMs = new Date(booked_at).getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
};

interface Booking {
  id: string;
  booked_at: string;
  status: "pending" | "confirmed" | "cancelled" | "done";
  duration_minutes: number;
  price: number | null;
  psychologist_id: string;
  psychologist_name?: string;
  psychologist_avatar?: string;
  psychologist_specialty?: string;
  video_room_url?: string | null;
}

interface PatientDashboardProps {
  profile: { full_name: string };
  upcoming: Booking[];
  past: Booking[];
  cancellling: string | null;
  bookingsLoading: boolean;
  wellnessStreak: number;
  unlockedBadges: { id: string; name: string; emoji: string; desc: string }[];
  handleCancelBooking: (id: string) => void;
  setActivePage: (page: string) => void;
  fmt: (iso: string) => string;
  fmtT: (iso: string) => string;
  getSessionTimeState: (booked_at: string, duration_minutes: number) => "upcoming" | "active" | "ended";
  formatTimeUntil: (booked_at: string) => string;
  getInitials: (name?: string) => string;
}

export default function PatientDashboard({
  profile, upcoming, past, cancellling, bookingsLoading, wellnessStreak,
  unlockedBadges, handleCancelBooking, setActivePage, fmt, fmtT,
  getSessionTimeState: getSessionTimeStateOld, formatTimeUntil, getInitials,
}: PatientDashboardProps) {
  const { t } = useLanguage();
  const now = useNow(30_000);
  const totalDone = past.filter(b => b.status === "done").length;
  const totalHours = Math.round(past.filter(b => b.status === "done").reduce((s, b) => s + b.duration_minutes, 0) / 60);
  const nextSession = upcoming[0];
  const nextCountdown = nextSession ? formatCountdown(nextSession.booked_at, now) : null;

  const timeStateBorder = (state: "upcoming" | "active" | "ended") => {
    if (state === "active") return "border-l-4 border-l-emerald-400 bg-gradient-to-r from-emerald-50/40 to-transparent";
    if (state === "upcoming") return "border-l-4 border-l-blue-300";
    return "";
  };

  return (
    <div className="p-4 sm:p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl text-foreground tracking-tight">
            Bonjour{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5 font-sans">Bienvenue dans votre espace personnel Majal.</p>
        </div>
        <Link to="/psychologues" className="self-start md:self-auto px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold no-underline hover:bg-teal-mid hover:-translate-y-0.5 active:scale-95 transition-all shadow-sm flex items-center gap-2">
          Réserver une séance <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {nextSession && nextCountdown && (
        <div className="bg-gradient-to-br from-primary to-teal-dark rounded-3xl p-6 shadow-card relative overflow-hidden">
          <div className="absolute -top-16 -left-16 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                <Timer className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Prochaine séance</p>
                <p className="text-white text-xl font-bold mt-0.5">{nextSession.psychologist_name}</p>
                <p className="text-white/80 text-sm mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {fmt(nextSession.booked_at)} · {fmtT(nextSession.booked_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-3xl font-bold text-white tracking-tight">{nextCountdown}</div>
                <div className="text-white/70 text-xs font-semibold">avant la séance</div>
              </div>
              <button
                onClick={() => setActivePage("sessions")}
                className="px-5 py-3 rounded-xl bg-white/15 text-white text-sm font-semibold border border-white/20 hover:bg-white/25 active:scale-95 transition-all cursor-pointer backdrop-blur-xs"
              >
                Détails
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { icon: <Sparkles className="w-5 h-5" />, color: "text-primary bg-teal-pale border-primary/10", label: "Séances terminées", value: totalDone, subtitle: `${totalHours}h de thérapie` },
          { icon: <Calendar className="w-5 h-5" />, color: "text-blue-700 bg-blue-50 border-blue-100", label: "À venir", value: upcoming.length, subtitle: upcoming.length === 1 ? "séance programmée" : "séances programmées" },
          { icon: <Heart className="w-5 h-5" />, color: "text-rose-600 bg-rose-50 border-rose-100", label: "Série actuelle", value: `${wellnessStreak} jours`, subtitle: "d'affilée" },
          { icon: <Award className="w-5 h-5" />, color: "text-amber-600 bg-amber-50 border-amber-100", label: "Badges débloqués", value: unlockedBadges.length, subtitle: "exploits" },
        ].map(s => (
          <div key={s.label} className="dashboard-card p-6 flex items-center gap-5 hover:shadow-md transition-all duration-300 group">
            <div className={`p-3 rounded-2xl border ${s.color} group-hover:scale-110 transition-transform duration-300`}>{s.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground font-sans font-medium uppercase tracking-wider">{s.label}</div>
              <div className="font-serif text-2xl text-foreground mt-1 font-semibold">{s.value}</div>
              <div className="text-[10px] text-muted-foreground/80 mt-0.5">{s.subtitle}</div>
            </div>
          </div>
        ))}
      </div>

      {totalDone > 0 && (
        <div className="dashboard-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-lg font-semibold text-foreground">Mon parcours thérapeutique</h3>
            <span className="text-xs text-muted-foreground">{totalDone} séance{totalDone > 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-1000" style={{ width: `${Math.min((totalDone / 20) * 100, 100)}%` }} />
            </div>
            <span className="text-xs font-semibold text-primary whitespace-nowrap">{totalDone}/20 séances</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{totalDone < 5 ? "Excellent début ! Continuez sur votre lancée." : totalDone < 10 ? "Belle progression, vous êtes sur la bonne voie." : "Vous êtes très engagé dans votre démarche, bravo !"}</p>
        </div>
      )}

      <div className="dashboard-card p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg font-semibold text-foreground">Prochaines séances</h3>
            {upcoming.length > 0 && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{upcoming.length}</span>}
          </div>
          <button onClick={() => setActivePage("sessions")} className="text-primary text-sm font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer hover:text-teal-mid transition-colors">
            Voir tout <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {bookingsLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <SessionCardSkeleton key={i} />)}</div>
        ) : upcoming.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-teal-hero flex items-center justify-center mx-auto mb-4 border border-teal-light/10">
              <Calendar className="w-7 h-7 text-primary/60" />
            </div>
            <p className="text-sm font-medium text-foreground">Aucune séance programmée</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">Besoin d'aide ? Prenez rendez-vous avec l'un de nos praticiens certifiés.</p>
            <Link to="/psychologues" className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold no-underline hover:bg-teal-mid hover:-translate-y-0.5 active:scale-95 transition-all">
              Trouver un psychologue
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.slice(0, 3).map(b => {
              const timeState = getSessionTimeStateOld(b.booked_at, b.duration_minutes);
              return (
                <div key={b.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border rounded-2xl transition-all duration-300 ${
                  timeState === "active"
                    ? "border-emerald-200 bg-emerald-50/40 shadow-sm"
                    : "border-border/50 hover:border-primary/35 hover:bg-teal-hero/30"
                } ${timeStateBorder(timeState)}`}>
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {b.psychologist_avatar ? (
                      <img src={b.psychologist_avatar} alt={b.psychologist_name} className="w-12 h-12 rounded-full object-cover border border-primary/20 shrink-0 shadow-xs" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/10 shadow-xs">
                        {getInitials(b.psychologist_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-base text-foreground truncate">{b.psychologist_name}</div>
                      <div className="text-xs text-primary/95 font-medium mt-0.5">{b.psychologist_specialty || "Psychologue Clinicien"}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs flex items-center gap-1 ${timeState === "active" ? "text-emerald-700 font-semibold" : "text-muted-foreground"}`}>
                          <Clock className="w-3 h-3" />
                          {timeState === "active" ? "En direct" : timeState === "upcoming" ? formatRelativeTime(b.booked_at, now) : "Terminée"}
                        </span>
                        {timeState !== "active" && <span className="text-[10px] text-muted-foreground/60">· {fmt(b.booked_at)} · {fmtT(b.booked_at)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2.5 shrink-0 self-end sm:self-center">
                    {(() => {
                      const timeLabel = timeState === "upcoming" ? `Ouvre dans ${formatTimeUntil(b.booked_at)}"` : null;
                      return (
                        <button onClick={() => {
                          if (timeState !== "active") {
                            if (timeState === "upcoming") toast.info("La session n'est pas encore ouverte. Vous pourrez la rejoindre 15 minutes avant l'heure prévue.");
                            else toast.info("Cette session est terminée.");
                            return;
                          }
                          if (b.video_room_url) window.open(b.video_room_url, "_blank");
                          else toast.info("Le salon vidéo n'a pas encore été lancé par votre thérapeute.");
                        }}
                          className={`flex items-center gap-2 px-4 py-2.5 ${timeState === "active" ? "bg-primary text-primary-foreground hover:bg-teal-mid" : "bg-gray-100 text-gray-400 cursor-not-allowed"} rounded-xl text-xs font-semibold border-none transition-all active:scale-95 shadow-xs`}>
                          <Video className="w-4 h-4" /> {timeState === "ended" ? "Terminée" : timeLabel || "Rejoindre"}
                        </button>
                      );
                    })()}
                    {timeState !== "ended" && (
                      <button onClick={() => handleCancelBooking(b.id)} disabled={cancelling === b.id}
                        className="flex items-center gap-1.5 px-4 py-2.5 border border-destructive/20 text-destructive bg-transparent rounded-xl text-xs font-semibold cursor-pointer hover:bg-destructive/5 active:scale-95 transition-all disabled:opacity-50">
                        {cancelling === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        {t("space.cancel")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="dashboard-card p-6">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border/40">
          <h3 className="font-serif text-lg font-semibold text-foreground">Mes badges et exploits</h3>
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">{unlockedBadges.length}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {unlockedBadges.map(badge => (
            <div key={badge.id} className="flex items-center gap-3 p-3.5 border border-border/40 rounded-2xl bg-teal-pale/20 hover:scale-[1.02] hover:border-amber-200 hover:bg-amber-50/30 transition-all duration-300 shadow-xs cursor-pointer group">
              <span className="text-3xl filter drop-shadow-sm group-hover:animate-bounce">{badge.emoji}</span>
              <div>
                <div className="font-semibold text-sm text-foreground">{badge.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 font-sans leading-tight">{badge.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GoalsWidget />
        <CrisisHelpline />
      </div>

      <div className="bg-gradient-to-br from-teal-cta to-teal-dark rounded-3xl p-8 text-center shadow-card relative overflow-hidden">
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-white/5 rounded-full blur-xl" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-white/5 rounded-full blur-xl" />
        <div className="relative z-10">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-sm">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-serif text-2xl text-white mb-2">{t("space.continuePath")}</h3>
          <p className="text-sm text-teal-pale/85 mb-6 max-w-md mx-auto leading-relaxed font-sans">{t("space.findPsySubtitle")}</p>
          <Link to="/psychologues" className="inline-block px-8 py-3.5 bg-white text-primary rounded-full text-sm font-semibold no-underline hover:-translate-y-0.5 hover:shadow-lg active:scale-95 transition-all">
            {t("space.findPsyBtn")}
          </Link>
        </div>
      </div>
    </div>
  );
}