import { Calendar, Clock, Heart, ChevronRight, Video, X, Loader2, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { SessionCardSkeleton } from "@/components/LoadingSkeletons";
import GoalsWidget from "./GoalsWidget";
import CrisisHelpline from "./CrisisHelpline";

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
  profile,
  upcoming,
  past,
  cancellling,
  bookingsLoading,
  wellnessStreak,
  unlockedBadges,
  handleCancelBooking,
  setActivePage,
  fmt,
  fmtT,
  getSessionTimeState,
  formatTimeUntil,
  getInitials,
}: PatientDashboardProps) {
  const { t } = useLanguage();

  return (
    <div className="p-4 sm:p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl text-foreground tracking-tight">
            Bonjour{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5 font-sans">Bienvenue dans votre espace personnel Majal.</p>
        </div>
        <Link to="/psychologues" className="self-start md:self-auto px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold no-underline hover:bg-teal-mid transition-all hover:-translate-y-0.5 shadow-sm">
          Réserver une nouvelle séance
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { icon: <Calendar className="w-5 h-5" />, color: "text-primary bg-teal-pale border-primary/10",   label: "Séances totales",   value: upcoming.length + past.filter(b => b.status === "done").length },
          { icon: <Clock className="w-5 h-5" />,    color: "text-blue-700 bg-blue-50 border-blue-100",    label: "Heures de thérapie", value: `${Math.round(past.filter(b=>b.status==="done").reduce((s,b)=>s+b.duration_minutes,0)/60)}h` },
          { icon: <Heart className="w-5 h-5" />,    color: "text-rose-600 bg-rose-50 border-rose-100",    label: "Séances à venir",   value: upcoming.length },
          { icon: <span className="text-xl animate-pulse">🔥</span>, color: "text-orange-600 bg-orange-50 border-orange-100", label: t("space.streak"), value: `${wellnessStreak} jours` },
        ].map(s => (
          <div key={s.label} className="dashboard-card p-6 flex items-center gap-5 hover:shadow transition-shadow duration-300">
            <div className={`p-3 rounded-2xl border ${s.color}`}>{s.icon}</div>
            <div>
              <div className="text-xs text-muted-foreground font-sans font-medium uppercase tracking-wider">{s.label}</div>
              <div className="font-serif text-3xl text-foreground mt-1 font-semibold">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-card p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
          <h3 className="font-serif text-lg font-semibold text-foreground">Prochaines séances</h3>
          <button onClick={() => setActivePage("sessions")} className="text-primary text-sm font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer hover:text-teal-mid transition-colors">
            Voir tout <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {bookingsLoading ? (
          <div className="space-y-4">{[1,2,3].map(i => <SessionCardSkeleton key={i} />)}</div>
        ) : upcoming.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-teal-hero flex items-center justify-center mx-auto mb-4 border border-teal-light/10">
              <Calendar className="w-6 h-6 text-primary/70" />
            </div>
            <p className="text-sm font-medium">Aucune séance programmée à venir.</p>
            <p className="text-xs text-muted-foreground/80 mt-1 max-w-xs mx-auto">Besoin d'aide ? Prenez un rendez-vous avec l'un de nos praticiens certifiés.</p>
            <Link to="/psychologues" className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold no-underline hover:bg-teal-mid transition-all">
              Trouver un psychologue
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {upcoming.slice(0, 3).map(b => (
              <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border border-border/50 rounded-2xl hover:border-primary/35 hover:bg-teal-hero/30 transition-all duration-300">
                <div className="flex items-center gap-4">
                  {b.psychologist_avatar ? (
                    <img src={b.psychologist_avatar} alt={b.psychologist_name} className="w-12 h-12 rounded-full object-cover border border-primary/20 shrink-0 shadow-sm" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/10 shadow-sm">
                      {getInitials(b.psychologist_name)}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-base text-foreground">{b.psychologist_name}</div>
                    <div className="text-xs text-primary/95 font-medium mt-0.5">{b.psychologist_specialty || "Psychologue Clinicien"}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground/75" />
                      <span>{fmt(b.booked_at)} · {fmtT(b.booked_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2.5 shrink-0 self-end sm:self-center">
                  {(() => {
                    const timeState = getSessionTimeState(b.booked_at, b.duration_minutes);
                    const timeLabel = timeState === "upcoming" ? `Ouvre dans ${formatTimeUntil(b.booked_at)}` : null;
                    return (
                      <button
                        onClick={() => {
                          if (timeState !== "active") {
                            if (timeState === "upcoming") toast.info("La session n'est pas encore ouverte. Vous pourrez la rejoindre 15 minutes avant l'heure prévue.");
                            else toast.info("Cette session est terminée.");
                            return;
                          }
                          if (b.video_room_url) {
                            window.open(b.video_room_url, "_blank");
                          } else {
                            toast.info("Le salon vidéo n'a pas encore été lancé par votre thérapeute.");
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 ${timeState === "active" ? "bg-primary text-primary-foreground hover:bg-teal-mid" : "bg-gray-100 text-gray-400 cursor-not-allowed"} rounded-xl text-xs font-semibold border-none transition-all shadow-sm hover:shadow`}
                      >
                        <Video className="w-4 h-4" /> {timeState === "ended" ? "Terminée" : timeLabel || "Rejoindre"}
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => handleCancelBooking(b.id)}
                    disabled={cancelling === b.id}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-destructive/20 text-destructive bg-transparent rounded-xl text-xs font-semibold cursor-pointer hover:bg-destructive/5 transition-all disabled:opacity-50"
                  >
                    {cancelling === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    {t("space.cancel")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="dashboard-card p-6">
          <h3 className="font-serif text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border/40">
            {t("space.streaks.badges") || "Mes badges et exploits"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {unlockedBadges.map(badge => (
              <div key={badge.id} className="flex items-center gap-3 p-3.5 border border-border/40 rounded-2xl bg-teal-pale/20 hover:scale-105 transition-all duration-300 shadow-xs cursor-pointer group">
                <span className="text-3xl filter drop-shadow-sm group-hover:animate-bounce">{badge.emoji}</span>
                <div>
                  <div className="font-semibold text-sm text-foreground">{badge.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-sans leading-tight">{badge.desc}</div>
                </div>
              </div>
            ))}
          </div>
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
          <Link to="/psychologues" className="inline-block px-8 py-3.5 bg-white text-primary rounded-full text-sm font-semibold no-underline hover:-translate-y-0.5 hover:shadow-lg transition-all">
            {t("space.findPsyBtn")}
          </Link>
        </div>
      </div>
    </div>
  );
}
