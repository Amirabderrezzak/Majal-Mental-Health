import { useState, useRef, useCallback, useMemo } from "react";
import { Calendar, Clock, Heart, ChevronRight, Video, X, Loader2, TrendingUp, Sparkles, Timer, Award, PhoneCall, MessageSquare, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNow } from "@/hooks/useNow";
import { SessionCardSkeleton } from "@/components/LoadingSkeletons";
import GoalsWidget from "./GoalsWidget";
import CrisisHelpline from "./CrisisHelpline";

const SESSION_OPEN_MINUTES = 15;

const formatRelativeTime = (booked_at: string, now: Date, t: (k: string) => string) => {
  const start = new Date(booked_at);
  const diffMs = start.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const mins = Math.ceil(abs / 60000);
  if (diffMs < 0) {
    if (mins < 60) return t("pd.rel.ago").replace("{n}", String(mins));
    return t("pd.rel.agoH").replace("{n}", String(Math.floor(mins / 60)));
  }
  if (mins < 1) return t("pd.rel.justNow");
  if (mins < 60) return t("pd.rel.in").replace("{n}", String(mins));
  if (mins < 120) return t("pd.rel.in1h").replace("{n}", String(mins % 60));
  return t("pd.rel.inH")
    .replace("{n}", String(Math.floor(mins / 60)))
    .replace("{m}", String(mins % 60));
};

const formatCountdown = (booked_at: string, now: Date, t: (k: string) => string) => {
  const diffMs = new Date(booked_at).getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return t("pd.cd.days").replace("{d}", String(days)).replace("{h}", String(hours));
  if (hours > 0) return t("pd.cd.hours").replace("{h}", String(hours)).replace("{m}", String(mins));
  return t("pd.cd.mins").replace("{m}", String(mins));
};

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
  getSessionTimeState: getSessionTimeStateFromProps, formatTimeUntil, getInitials,
}: PatientDashboardProps) {
  const { t } = useLanguage();
  const now = useNow(30_000);
  const [wellnessTab, setWellnessTab] = useState<"goals" | "helpline">("goals");
  const lastTapRef = useRef(0);

  const totalDone = past.filter(b => b.status === "done").length;
  const totalHours = Math.round(past.filter(b => b.status === "done").reduce((s, b) => s + b.duration_minutes, 0) / 60);
  const nextSession = upcoming[0];
  const nextCountdown = nextSession ? formatCountdown(nextSession.booked_at, now, t) : null;

  const recentDone = useMemo(() =>
    [...past].filter(b => b.status === "done").sort((a, b) => new Date(b.booked_at).getTime() - new Date(a.booked_at).getTime()).slice(0, 5),
    [past]
  );

  const isNextWithin24h = nextSession && now < new Date(nextSession.booked_at) && new Date(nextSession.booked_at).getTime() - now.getTime() < 86400000;

  const activeSession = upcoming.find(b => getSessionTimeStateFromProps(b.booked_at, b.duration_minutes) === "active");

  const handleDoubleTap = useCallback(() => {
    const time = Date.now();
    if (time - lastTapRef.current < 300) {
      if (nextSession?.video_room_url) {
        window.open(nextSession.video_room_url, "_blank");
      } else {
        toast.info(t("space.dashboard.toast.roomNotStarted"));
      }
    }
    lastTapRef.current = time;
  }, [nextSession]);

  const handleJoinClick = useCallback((b: Booking) => {
    const state = getSessionTimeStateFromProps(b.booked_at, b.duration_minutes);
    if (state !== "active") {
      if (state === "upcoming") toast.info(t("space.dashboard.toast.notOpen"));
      else toast.info(t("space.dashboard.toast.ended"));
      return;
    }
    if (b.video_room_url) window.open(b.video_room_url, "_blank");
    else toast.info(t("space.dashboard.toast.roomNotStarted"));
  }, [getSessionTimeStateFromProps]);

  const timeStateBorder = (state: "upcoming" | "active" | "ended") => {
    if (state === "active") return "border-l-4 border-l-primary bg-gradient-to-r from-teal-pale to-transparent";
    if (state === "upcoming") return "border-l-4 border-l-primary/30";
    return "";
  };

  return (
    <div className="p-4 sm:p-6 space-y-8 animate-in fade-in duration-500 pb-24 lg:pb-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl text-foreground tracking-tight">
            {t("space.dashboard.greeting")}{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5 font-sans">{t("space.dashboard.welcomeMsg")}</p>
        </div>
        <Link to="/psychologues" className="self-start md:self-auto px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold no-underline hover:bg-teal-mid hover:-translate-y-0.5 active:scale-95 transition-all shadow-sm flex items-center gap-2">
          {t("space.bookSession")} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ══ BLOCK 1: Ma séance ══ */}
      <section>
        <h3 className="font-serif text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" />
          {t("pd.mySession")}
        </h3>
        {nextSession && nextCountdown ? (
          <>
            <div
              onClick={handleDoubleTap}
              className={`bg-gradient-to-br from-primary to-teal-dark rounded-3xl p-6 shadow-card relative overflow-hidden cursor-pointer select-none ${
                getSessionTimeStateFromProps(nextSession.booked_at, nextSession.duration_minutes) === "active"
                  ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-0"
                  : ""
              }`}
              title={t("pd.dblClickHint")}
            >
              <div className="absolute -top-16 -left-16 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
              <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                    <Timer className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">
                      {getSessionTimeStateFromProps(nextSession.booked_at, nextSession.duration_minutes) === "active"
                        ? t("pd.sessionLive")
                        : t("pd.nextSession")}
                    </p>
                    <p className="text-white text-xl font-bold mt-0.5">{nextSession.psychologist_name}</p>
                    <p className="text-white/80 text-sm mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {fmt(nextSession.booked_at)} · {fmtT(nextSession.booked_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {getSessionTimeStateFromProps(nextSession.booked_at, nextSession.duration_minutes) === "active" ? (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                        <span className="text-lg font-bold text-primary-foreground">{t("pd.live")}</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-3xl font-bold text-white tracking-tight">{nextCountdown}</div>
                        <div className="text-white/70 text-xs font-semibold">{t("pd.beforeSession")}</div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleJoinClick(nextSession); }}
                    className={`px-5 py-3 rounded-xl text-sm font-semibold border transition-all active:scale-95 cursor-pointer ${
                      getSessionTimeStateFromProps(nextSession.booked_at, nextSession.duration_minutes) === "active"
                        ? "bg-primary text-white border-primary/25 hover:bg-teal-pale0 shadow-lg shadow-card"
                        : "bg-white/15 text-white border-white/20 hover:bg-white/25"
                    }`}
                  >
                    {getSessionTimeStateFromProps(nextSession.booked_at, nextSession.duration_minutes) === "active"
                      ? t("pd.joinNow")
                      : t("pd.details")}
                  </button>
                </div>
              </div>
            </div>

            {isNextWithin24h && (
              <div className="mt-4 p-5 border border-primary/20 rounded-2xl bg-gradient-to-r from-teal-pale/30 to-transparent shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-foreground">{t("pd.prepSession")}</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {t("pd.prepStart")} <strong>{nextSession.psychologist_name}</strong> {t("pd.prepEnd")}
                      {nextSession.video_room_url
                        ? t("pd.prepRoomReady")
                        : t("pd.prepLinkLater")}
                    </p>
                    <div className="flex gap-2.5 mt-3">
                      {nextSession.video_room_url && (
                        <button
                          onClick={() => window.open(nextSession.video_room_url!, "_blank")}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all active:scale-95"
                        >
                           <Video className="w-3.5 h-3.5" /> {t("pd.accessRoom")}
                        </button>
                      )}
                      <button
                        onClick={() => setWellnessTab("goals")}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/60 text-foreground text-xs font-semibold bg-transparent cursor-pointer hover:bg-teal-hero/30 transition-all active:scale-95"
                      >
                         {t("pd.viewNotes")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="dashboard-card p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-hero flex items-center justify-center mx-auto mb-4 border border-teal-light/10">
              <Calendar className="w-7 h-7 text-primary/60" />
            </div>
            <p className="text-sm font-medium text-foreground">{t("pd.noSessions")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("pd.bookHint")}</p>
            <Link to="/psychologues" className="inline-block mt-5 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold no-underline hover:bg-teal-mid hover:-translate-y-0.5 active:scale-95 transition-all">
              {t("space.dashboard.findPsyBtn")}
            </Link>
          </div>
        )}
      </section>

      {/* ══ BLOCK 2: Mon parcours ══ */}
      <section>
        <h3 className="font-serif text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          {t("pd.myJourney")}
        </h3>

        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { icon: <Sparkles className="w-4 h-4" />, color: "text-primary bg-teal-pale border-primary/10", label: t("pd.stat.sessions"), value: totalDone },
            { icon: <Clock className="w-4 h-4" />, color: "text-primary bg-teal-pale border-border", label: t("pd.stat.hours"), value: totalHours },
            { icon: <Heart className="w-4 h-4" />, color: "text-rose-600 bg-rose-50 border-rose-100", label: t("pd.stat.streak"), value: `${wellnessStreak}j` },
          ].map(s => (
            <div key={s.label} className="dashboard-card p-4 flex flex-col items-center gap-2 hover:shadow-md transition-all duration-300 group text-center">
              <div className={`p-2 rounded-xl border ${s.color} group-hover:scale-110 transition-transform duration-300`}>{s.icon}</div>
              <div>
                <div className="font-serif text-xl text-foreground font-semibold">{s.value}</div>
                <div className="text-[10px] text-muted-foreground font-sans font-medium uppercase tracking-wider">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {totalDone > 0 && (
          <div className="dashboard-card p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">{t("pd.therapy")}</span>
              <span className="text-xs text-muted-foreground">{totalDone}/20 {t("pd.sessionsWord")}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary transition-all duration-1000" style={{ width: `${Math.min((totalDone / 20) * 100, 100)}%` }} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{totalDone < 5 ? t("pd.progress.low") : totalDone < 10 ? t("pd.progress.mid") : t("pd.progress.high")}</p>
          </div>
        )}

        {recentDone.length > 0 && (
          <div className="dashboard-card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-foreground">{t("pd.recentSessions")}</span>
              <button onClick={() => setActivePage("sessions")} className="text-primary text-xs font-semibold bg-transparent border-none cursor-pointer hover:text-teal-mid transition-colors">
                Voir tout <ChevronRight className="w-3 h-3 inline" />
              </button>
            </div>
            <div className="space-y-0">
              {recentDone.map((b, i) => (
                <div key={b.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full border-2 ${i === 0 ? "bg-primary border-primary" : "bg-card border-muted-foreground/30"} shrink-0 mt-1`} />
                    {i < recentDone.length - 1 && <div className="w-px flex-1 bg-border/60 min-h-[32px]" />}
                  </div>
                  <div className="pb-4 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground truncate">{b.psychologist_name || t("prof.defaultName")}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{fmt(b.booked_at)}</span>
                    </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{b.duration_minutes} {t("pd.minWord")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ══ BLOCK 3: Mes prochains RDV ══ */}
      <section>
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/40">
          <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            {t("pd.myUpcomingRdv")}
            {upcoming.length > 0 && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold ml-1">{upcoming.length}</span>}
          </h3>
          <button onClick={() => setActivePage("sessions")} className="text-primary text-sm font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer hover:text-teal-mid transition-colors">
            Voir tout <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {bookingsLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <SessionCardSkeleton key={i} />)}</div>
        ) : upcoming.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">{t("pd.noUpcoming")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.slice(0, 3).map(b => {
              const timeState = getSessionTimeStateFromProps(b.booked_at, b.duration_minutes);
              const isActive = timeState === "active";
              return (
                <div
                  key={b.id}
                  onClick={() => isActive && handleJoinClick(b)}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border rounded-2xl transition-all duration-300 ${
                    isActive
                      ? "border-primary/25 bg-teal-pale shadow-md shadow-card ring-1 ring-primary/20 cursor-pointer"
                      : "border-border/50 hover:border-primary/35 hover:bg-teal-hero/30"
                  } ${timeStateBorder(timeState)}`}
                >
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
                       <div className="text-xs text-primary/95 font-medium mt-0.5">{b.psychologist_specialty || t("pd.defaultSpecialty")}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {isActive ? (
                          <span className="text-xs flex items-center gap-1.5 text-primary font-semibold">
                            <span className="w-2 h-2 rounded-full bg-teal-pale0 animate-pulse" />
                             {t("pd.roomOpen")}
                          </span>
                        ) : (
                          <>
                            <span className="text-xs flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3 h-3" />
                               {timeState === "upcoming" ? formatRelativeTime(b.booked_at, now, t) : t("pd.ended")}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60">· {fmt(b.booked_at)} · {fmtT(b.booked_at)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2.5 shrink-0 self-end sm:self-center">
                    {(() => {
                      const timeLabel = timeState === "upcoming" ? `${t("pd.opensIn")} ${formatTimeUntil(b.booked_at)}` : null;
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleJoinClick(b); }}
                          className={`flex items-center gap-2 px-4 py-2.5 ${
                            isActive
                              ? "bg-primary text-primary-foreground hover:bg-teal-mid shadow-sm"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          } rounded-xl text-xs font-semibold border-none transition-all active:scale-95`}
                        >
                          <Video className="w-4 h-4" />
                          {timeState === "ended" ? t("pd.ended") : timeLabel || t("space.join")}
                        </button>
                      );
                    })()}
                    {timeState !== "ended" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCancelBooking(b.id); }}
                        disabled={cancelling === b.id}
                        className="flex items-center gap-1.5 px-4 py-2.5 border border-destructive/20 text-destructive bg-transparent rounded-xl text-xs font-semibold cursor-pointer hover:bg-destructive/5 active:scale-95 transition-all disabled:opacity-50"
                      >
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
      </section>

      {/* ══ BLOCK 4: Mon bien-être ══ */}
      <section>
        <h3 className="font-serif text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          {t("pd.wellbeing")}
        </h3>

        <div className="flex gap-1 mb-5 p-1 bg-accent/40 rounded-xl border border-border/30 w-fit">
          <button
            onClick={() => setWellnessTab("goals")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer transition-all ${
              wellnessTab === "goals"
                ? "bg-card text-foreground shadow-xs"
                : "bg-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("pd.goalsNotes")}
          </button>
          <button
            onClick={() => setWellnessTab("helpline")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer transition-all ${
              wellnessTab === "helpline"
                ? "bg-card text-foreground shadow-xs"
                : "bg-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("pd.emergency")}
          </button>
        </div>

        {wellnessTab === "goals" ? <GoalsWidget /> : <CrisisHelpline />}

        {unlockedBadges.length > 0 && (
          <div className="mt-5 dashboard-card p-5">
            <div className="flex items-center gap-2 mb-4">
               <h4 className="font-serif text-base font-semibold text-foreground">{t("pd.badges")}</h4>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">{unlockedBadges.length}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {unlockedBadges.map(badge => (
                <div key={badge.id} className="flex items-center gap-2 px-3.5 py-2 border border-border/40 rounded-xl bg-teal-pale/20 hover:border-amber-200 hover:bg-amber-50/30 transition-all cursor-default">
                  <span className="text-xl">{badge.emoji}</span>
                  <div>
                    <div className="font-semibold text-xs text-foreground">{badge.name}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{badge.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Bottom CTA — only when no upcoming sessions */}
      {upcoming.length === 0 && (
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
      )}

      {/* ══ Floating action bar (mobile only) ══ */}
      <div
        className="fixed bottom-0 left-0 right-0 lg:hidden z-50 border-t border-border/50 bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around py-2.5 px-2">
          {activeSession ? (
            <button
              onClick={() => handleJoinClick(activeSession)}
              className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl bg-primary text-primary-foreground border-none cursor-pointer active:scale-95 transition-all"
            >
              <Video className="w-5 h-5" />
               <span className="text-[10px] font-semibold">{t("space.join")}</span>
            </button>
          ) : nextSession ? (
            <div className="flex flex-col items-center gap-0.5 px-4 py-1 text-muted-foreground">
              <Clock className="w-5 h-5" />
               <span className="text-[10px] font-semibold whitespace-nowrap">{formatTimeUntil(nextSession.booked_at) || t("pd.opensIn")}</span>
            </div>
          ) : (
            <Link to="/psychologues" className="flex flex-col items-center gap-0.5 px-4 py-1 text-primary no-underline">
              <Calendar className="w-5 h-5" />
               <span className="text-[10px] font-semibold">{t("space.bookSession")}</span>
            </Link>
          )}

          <button
            onClick={() => setActivePage("messages")}
            className="flex flex-col items-center gap-0.5 px-4 py-1 text-muted-foreground bg-transparent border-none cursor-pointer hover:text-foreground transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
             <span className="text-[10px] font-semibold">{t("space.nav.messages")}</span>
          </button>

          <button
            onClick={() => setWellnessTab("helpline")}
            className="flex flex-col items-center gap-0.5 px-4 py-1 text-red-500 bg-transparent border-none cursor-pointer hover:text-red-600 transition-colors"
          >
            <PhoneCall className="w-5 h-5" />
             <span className="text-[10px] font-semibold">{t("pd.emergency")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
