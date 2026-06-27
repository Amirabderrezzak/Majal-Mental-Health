import { useState, useEffect } from "react";
import {
  LayoutDashboard, Calendar, Search, User, Bell, LogOut,
  Menu, X, Clock, Check, Video, MessageSquare, ChevronRight,
  Loader2, TrendingUp, Heart, Lock, BookOpen, Wind, PhoneCall, Plus, Trash2, Play, Square, Compass, Users
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ChatWindow from "@/components/ChatWindow";
import { getInitials } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";


type Page = "dashboard" | "sessions" | "messages" | "explore" | "forum" | "journal" | "coping" | "profil" | "notifications";

interface NavItem {
  id: Page;
  labelKey: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: "dashboard",     labelKey: "space.dashboard",    icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "sessions",      labelKey: "space.nav.sessions", icon: <Calendar className="w-4 h-4" /> },
  { id: "messages",      labelKey: "space.nav.messages", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "explore",       labelKey: "space.nav.explore",  icon: <Compass className="w-4 h-4" /> },
  { id: "forum",         labelKey: "space.nav.forum",    icon: <Users className="w-4 h-4" /> },
  { id: "journal",       labelKey: "space.nav.journal",  icon: <BookOpen className="w-4 h-4" /> },
  { id: "coping",        labelKey: "space.nav.coping",   icon: <Wind className="w-4 h-4" /> },
  { id: "profil",        labelKey: "space.profile",      icon: <User className="w-4 h-4" /> },
  { id: "notifications", labelKey: "space.notifications",icon: <Bell className="w-4 h-4" /> },
];

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
  price: number | null;
  psychologist_id: string;
  psychologist_name?: string;
  psychologist_avatar?: string;
  psychologist_specialty?: string;
  video_room_url?: string | null;
}

interface Profile {
  full_name: string;
  phone: string;
  language: string;
  avatar_url?: string;
}

// Static tab wrappers defined outside to prevent React from unmounting/remounting child components on parent re-renders
const DashboardWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const SessionsWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const MessagesWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const ExploreWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const ForumWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const JournalWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const CopingWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const ProfilWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const NotificationsWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;

export default function MonEspace() {
  const { user, signOut } = useAuth();
  const { t, lang, dir } = useLanguage();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- Social Media Features States ---
  const [selectedStoryTherapist, setSelectedStoryTherapist] = useState<{ name: string; avatar?: string; stories: { text: string; bg: string }[] } | null>(null);
  const [currentStorySlide, setCurrentStorySlide] = useState(0);

  const [activeRoom, setActiveRoom] = useState<{ id: string; title: string; host: string; hostAvatar?: string; listeners: { id: string; name: string }[]; speakers: { id: string; name: string }[] } | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [gratitudes, setGratitudes] = useState<{ id: string; text: string; color: string; rotation: number }[]>([]);
  const [forumThreads, setForumThreads] = useState<{ id: string; category: string; title: string; author: string; content: string; date: string; replies: { author: string; content: string; isPsy?: boolean; date: string }[] }[]>([]);
  const [selectedThread, setSelectedThread] = useState<any | null>(null);
  const [forumCategory, setForumCategory] = useState("all");
  
  const [wellnessStreak, setWellnessStreak] = useState(5);
  const [unlockedBadges, setUnlockedBadges] = useState<{ id: string; name: string; emoji: string; desc: string }[]>([]);

  // Load social mock data and streaks
  const fetchGratitudes = async () => {
    const { data } = await (supabase as any)
      .from("gratitudes")
      .select("*")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setGratitudes(
        data.map((g) => ({
          id: g.id,
          text: g.content,
          color: g.color,
          rotation: Number(g.rotation),
        }))
      );
    } else {
      const defGrats = [
        { id: "1", text: "Reconnaissant d'avoir un espace sécurisé pour m'exprimer.", color: "bg-teal-pale/50", rotation: -2 },
        { id: "2", text: "Ma séance d'aujourd'hui m'a fait énormément de bien !", color: "bg-amber-100/50", rotation: 3 },
        { id: "3", text: "Le chant des oiseaux ce matin m'a calmé l'esprit.", color: "bg-blue-100/50", rotation: -1 },
        { id: "4", text: "J'ai réussi à affronter ma phobie aujourd'hui.", color: "bg-rose-100/50", rotation: 1.5 },
      ];
      setGratitudes(defGrats);
    }
  };

  const fetchForumThreads = async () => {
    const { data: threadsData } = await (supabase as any)
      .from("forum_threads")
      .select("id, category, title, content, created_at, author_id")
      .order("created_at", { ascending: false });

    if (threadsData) {
      const threadIds = threadsData.map((t) => t.id);
      const { data: repliesData } = await (supabase as any)
        .from("forum_replies")
        .select("id, thread_id, content, created_at, author_id, profiles(full_name, user_type)")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: true });

      const mapped = threadsData.map((t) => {
        const repliesForThread = repliesData?.filter((r) => r.thread_id === t.id) || [];
        return {
          id: t.id,
          category: t.category,
          title: t.title,
          author: "Anonyme",
          content: t.content,
          date: t.created_at,
          replies: repliesForThread.map((r: any) => ({
            author: r.profiles?.user_type === "psychologue" ? r.profiles?.full_name || "Thérapeute" : "Anonyme",
            content: r.content,
            isPsy: r.profiles?.user_type === "psychologue",
            date: r.created_at,
          })),
        };
      });
      setForumThreads(mapped);
    }
  };

  // Load social database data, streaks, and realtime subscriptions
  useEffect(() => {
    if (!user) return;
    
    // Streaks & badges
    const storedStreak = localStorage.getItem(`majal_streak_${user.id}`);
    if (storedStreak) {
      setWellnessStreak(parseInt(storedStreak));
    } else {
      localStorage.setItem(`majal_streak_${user.id}`, "5");
    }

    setUnlockedBadges([
      { id: "1", name: "Pionnier Majal", emoji: "🌱", desc: "Création de compte complétée." },
      { id: "2", name: "Esprit Zen", emoji: "🧘", desc: "A complété 5 exercices de respiration." },
      { id: "3", name: "Explorateur", emoji: "🗺️", desc: "A lu 3 réflexions de thérapeutes." }
    ]);

    fetchGratitudes();
    fetchForumThreads();

    const gratitudeChannel = supabase
      .channel("public:gratitudes")
      .on("postgres_changes", { event: "*", schema: "public", table: "gratitudes" }, () => {
        fetchGratitudes();
      })
      .subscribe();

    const forumChannel = supabase
      .channel("public:forum")
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_threads" }, () => {
        fetchForumThreads();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_replies" }, () => {
        fetchForumThreads();
      })
      .subscribe();

    return () => {
      gratitudeChannel.unsubscribe();
      forumChannel.unsubscribe();
    };
  }, [user]);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("✅ Mot de passe mis à jour avec succès !");
      setNewPassword("");
    }
  };

  const [profile, setProfile] = useState<Profile>({ full_name: "", phone: "", language: "Français", avatar_url: "" });
  const [profileLoading, setProfileLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setProfile((p) => ({ ...p, avatar_url: publicUrl }));
      toast.success("✅ Photo de profil mise à jour !");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error(err.message || "Erreur lors de l'upload de l'avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [past, setPast]       = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [activeChatUserName, setActiveChatUserName] = useState<string>("");

  // ── Reschedule state ─────────────────────────────────────────────────────
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [rescheduleStep, setRescheduleStep] = useState(1);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  const locale = lang === "ar" ? "ar-SA" : "fr-FR";

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone, language, avatar_url").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) setProfile({ full_name: data.full_name ?? "", phone: data.phone ?? "", language: data.language ?? "Français", avatar_url: data.avatar_url ?? "" });
        setProfileLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchB = async () => {
      const { data } = await (supabase as any).from("bookings").select("id, booked_at, status, duration_minutes, price, psychologist_id, video_room_url")
        .eq("patient_id", user.id).order("booked_at", { ascending: true });
        
      const all: Booking[] = data ? (data as Booking[]) : [];
      
      // Fetch psychologist names
      if (all.length > 0) {
        const psyIds = [...new Set(all.map(b => b.psychologist_id))];
        const { data: psyProfiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url, specialty").in("user_id", psyIds);
        
        all.forEach(b => {
          const p = psyProfiles?.find(x => x.user_id === b.psychologist_id);
          b.psychologist_name = p?.full_name || "Un Psychologue";
          b.psychologist_avatar = p?.avatar_url || undefined;
          b.psychologist_specialty = p?.specialty || undefined;
        });
      }

      const now = new Date();
      setUpcoming(all.filter(b => {
        const isUpcomingOrActiveStatus = b.status === "pending" || b.status === "confirmed";
        const sessionEndTime = new Date(new Date(b.booked_at).getTime() + b.duration_minutes * 60 * 1000);
        return isUpcomingOrActiveStatus && sessionEndTime >= now;
      }));
      setPast(all.filter(b => {
        const isPastOrCancelledStatus = b.status === "done" || b.status === "cancelled";
        const sessionEndTime = new Date(new Date(b.booked_at).getTime() + b.duration_minutes * 60 * 1000);
        return isPastOrCancelledStatus || sessionEndTime < now;
      }).sort((a, b) => new Date(b.booked_at).getTime() - new Date(a.booked_at).getTime()));
      setBookingsLoading(false);
    };
    fetchB();

    const bookingsChannel = supabase
      .channel(`public:bookings:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        fetchB();
      })
      .subscribe();

    return () => {
      bookingsChannel.unsubscribe();
    };
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({ user_id: user.id, ...profile });
    setSaving(false);
    if (error) toast.error("Erreur lors de la sauvegarde.");
    else toast.success("✅ Profil mis à jour !");
  };

  const handleCancelBooking = async (id: string) => {
    setCancelling(id);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const response = await fetch("/api/bookings/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ booking_id: id, status: "cancelled" })
      });
      const data = await response.json();
      setCancelling(null);

      if (!response.ok || data.error) {
        toast.error(data.error || "Erreur lors de l'annulation.");
      } else {
        toast.success("✅ Séance annulée.");
        const cancelledBooking = upcoming.find(b => b.id === id);
        if (cancelledBooking) {
          setUpcoming(prev => prev.filter(b => b.id !== id));
          setPast(prev => [{ ...cancelledBooking, status: "cancelled" as const }, ...prev].sort((a, b) => new Date(b.booked_at).getTime() - new Date(a.booked_at).getTime()));
        }
      }
    } catch (err) {
      setCancelling(null);
      toast.error("Erreur de connexion lors de l'annulation.");
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleBooking || !rescheduleDate || !rescheduleTime) return;
    setRescheduling(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const newDateTime = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();

    try {
      const response = await fetch("/api/bookings/reschedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          booking_id: rescheduleBooking.id,
          new_booked_at: newDateTime
        })
      });
      const data = await response.json();
      setRescheduling(false);

      if (!response.ok || data.error) {
        toast.error(data.error || "Erreur lors du report.");
      } else {
        toast.success("✅ Séance reportée avec succès !");
        setUpcoming(prev => prev.map(b =>
          b.id === rescheduleBooking.id
            ? { ...b, booked_at: newDateTime }
            : b
        ));
        setRescheduleBooking(null);
        setRescheduleStep(1);
        setRescheduleDate("");
        setRescheduleTime("");
      }
    } catch (err) {
      setRescheduling(false);
      toast.error("Erreur de connexion lors du report.");
    }
  };


  const fmt  = (iso: string) => new Date(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  const fmtT = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const initials = getInitials(profile.full_name || user?.email || "?");

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside className={`fixed inset-y-0 ${dir === "rtl" ? "right-0 border-l" : "left-0 border-r"} z-50 w-64 bg-white border-border flex flex-col transform transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : (dir === "rtl" ? "translate-x-full" : "-translate-x-full")} lg:translate-x-0`}>
      <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary rounded-lg flex items-center justify-center font-serif text-[13px] text-primary bg-teal-pale/30">MJ</div>
            <span className="text-base font-serif text-foreground font-semibold">Majal</span>
          </div>
          <span className="text-[10px] text-primary font-semibold tracking-wider mt-1 block">{t("space.title").toUpperCase()}</span>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <ul className="space-y-1.5">
          {navItems.map(item => (
            <li key={item.id}>
              <button
                onClick={() => { setActivePage(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all bg-transparent border-none cursor-pointer glass-nav-item ${activePage === item.id ? "active bg-teal-pale text-primary font-semibold shadow-sm" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"}`}
              >
                <span className={`transition-transform duration-200 ${activePage === item.id ? "scale-110" : ""}`}>{item.icon}</span>
                <span className="flex-1 text-start">{t(item.labelKey)}</span>
                {item.id === "notifications" && unreadCount > 0 && (
                  <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm shrink-0">
                    {unreadCount}
                  </span>
                )}
              </button>
            </li>
          ))}
          <li className="pt-4 border-t border-border/40 mt-4">
            <Link
              to="/psychologues"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-all no-underline"
            >
              <Search className="w-4 h-4" />
              {t("space.sidebar.findPsy")}
            </Link>
          </li>
        </ul>
      </nav>

      <div className="px-5 py-4 border-t border-border/60 bg-teal-hero/30">
        <div className="flex items-center gap-3 mb-3">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-primary/20 shrink-0 shadow-sm" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/10 shadow-sm">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{profile.full_name || user?.email}</p>
            <p className="text-[10px] uppercase font-semibold text-primary/80 tracking-wider">{t("space.sidebar.patient")}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all bg-transparent border-none cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          {t("space.sidebar.logout")}
        </button>
      </div>
    </aside>
  );

  const TopBar = ({ title }: { title: string }) => (
    <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border/60 px-4 sm:px-6 py-4 flex items-center gap-4 shadow-sm">
      <button onClick={() => setSidebarOpen(true)} className="lg:hidden bg-transparent border-none cursor-pointer text-foreground hover:text-primary transition-colors">
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="font-serif text-xl font-semibold text-foreground leading-none">{title}</h1>
    </div>
  );

  // ── Crisis SOS Helpline Widget ─────────────────────────────────────────────
  const CrisisHelpline = () => (
    <div className="dashboard-card p-6 border-red-200/50 bg-red-50/20 backdrop-blur-md space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-red-100/70 text-red-600 shrink-0">
          <PhoneCall className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-serif text-base font-semibold text-red-900 leading-snug">{t("space.crisis.title")}</h4>
          <p className="text-xs text-red-800/80 mt-1 leading-normal font-sans">{t("space.crisis.desc")}</p>
        </div>
      </div>

      <div className="space-y-2.5 font-sans pt-2 border-t border-red-200/40">
        {[
          { label: "Numéro Vert National (Gendarmerie)", number: "1055" },
          { label: "Protection Civile", number: "14" },
          { label: "Police Secours", number: "1548" },
        ].map((h) => (
          <a
            key={h.number}
            href={`tel:${h.number}`}
            className="flex items-center justify-between p-3 rounded-xl border border-red-200/40 bg-white hover:bg-red-50/40 transition-all text-red-950 no-underline shadow-sm hover:shadow"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-red-800/80 leading-none truncate">{h.label}</div>
              <div className="text-sm font-bold mt-1 text-red-950 font-sans leading-none">{h.number}</div>
            </div>
            <div className="p-2 rounded-lg bg-red-50 text-red-600 shrink-0">
              <PhoneCall className="w-3.5 h-3.5" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );

  // ── Goals Widget & Session Prep Notepad ────────────────────────────────────
  const GoalsWidget = () => {
    const [goals, setGoals] = useState<{ id: string; text: string; completed: boolean }[]>([]);
    const [newGoalText, setNewGoalText] = useState("");
    const [prepNotes, setPrepNotes] = useState("");

    useEffect(() => {
      if (!user) return;
      // Load goals
      const storedGoals = localStorage.getItem(`majal_goals_${user.id}`);
      if (storedGoals) {
        try { setGoals(JSON.parse(storedGoals)); } catch (e) { console.error(e); }
      } else {
        // Default goals
        const def = [
          { id: "1", text: "Prendre conscience des mes émotions quotidiennes", completed: false },
          { id: "2", text: "Pratiquer 5 minutes de respiration carrée", completed: false },
          { id: "3", text: "Discuter ouvertement de mes craintes lors de la prochaine séance", completed: false }
        ];
        setGoals(def);
        localStorage.setItem(`majal_goals_${user.id}`, JSON.stringify(def));
      }

      // Load prep notes
      const storedNotes = localStorage.getItem(`majal_prep_notes_${user.id}`);
      if (storedNotes) setPrepNotes(storedNotes);
    }, []);

    const toggleGoal = (id: string) => {
      const updated = goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g);
      setGoals(updated);
      localStorage.setItem(`majal_goals_${user.id}`, JSON.stringify(updated));
    };

    const addGoal = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newGoalText.trim()) return;
      const newGoal = {
        id: Date.now().toString(),
        text: newGoalText.trim(),
        completed: false
      };
      const updated = [...goals, newGoal];
      setGoals(updated);
      localStorage.setItem(`majal_goals_${user.id}`, JSON.stringify(updated));
      setNewGoalText("");
      toast.success("✅ Nouvel objectif ajouté !");
    };

    const deleteGoal = (id: string) => {
      const updated = goals.filter(g => g.id !== id);
      setGoals(updated);
      localStorage.setItem(`majal_goals_${user.id}`, JSON.stringify(updated));
    };

    const savePrepNotes = (val: string) => {
      setPrepNotes(val);
      localStorage.setItem(`majal_prep_notes_${user.id}`, val);
    };

    const completedCount = goals.filter(g => g.completed).length;
    const progressPct = goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0;

    return (
      <div className="space-y-6">
        {/* Goals card */}
        <div className="dashboard-card p-6 space-y-5">
          <h3 className="font-serif text-lg font-semibold text-foreground flex items-center justify-between pb-4 border-b border-border/40">
            <span>{t("space.goals.title")}</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-pale text-primary border border-primary/5">{progressPct}%</span>
          </h3>

          {/* Progress bar */}
          <div className="w-full bg-accent/30 rounded-full h-2 overflow-hidden shadow-inner">
            <div className="bg-primary h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
          </div>

          {/* Goals list */}
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {goals.map(g => (
              <div key={g.id} className="flex items-center justify-between gap-3 p-3 border border-border/40 rounded-xl bg-teal-hero/5 hover:bg-teal-hero/15 transition-all">
                <label className="flex items-center gap-3 cursor-pointer select-none min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={g.completed}
                    onChange={() => toggleGoal(g.id)}
                    className="w-4 h-4 accent-primary cursor-pointer border-border rounded"
                  />
                  <span className={`text-sm text-foreground truncate ${g.completed ? "line-through text-muted-foreground" : ""}`}>{g.text}</span>
                </label>
                <button
                  onClick={() => deleteGoal(g.id)}
                  className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all border-none bg-transparent cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Goal form */}
          <form onSubmit={addGoal} className="flex gap-2">
            <input
              type="text"
              value={newGoalText}
              onChange={e => setNewGoalText(e.target.value)}
              placeholder={t("space.goals.placeholder")}
              className="flex-1 px-4 py-2.5 border border-border/70 rounded-xl text-xs bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans"
            />
            <button
              type="submit"
              className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-teal-mid transition-all border-none cursor-pointer shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Session prep card */}
        <div className="dashboard-card p-6 space-y-4">
          <h3 className="font-serif text-lg font-semibold text-foreground pb-4 border-b border-border/40">
            {t("space.goals.notepad")}
          </h3>
          <textarea
            value={prepNotes}
            onChange={e => savePrepNotes(e.target.value)}
            rows={4}
            placeholder={t("space.goals.notepadPlaceholder")}
            className="w-full px-4 py-3 border border-border/70 rounded-xl text-xs text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card font-sans transition-all resize-none leading-relaxed"
          />
          <div className="text-[10px] text-muted-foreground text-right font-sans italic">Sauvegarde automatique locale</div>
        </div>
      </div>
    );
  };

  // ── Journal Page ───────────────────────────────────────────────────────────
  const JournalPage = () => {
    const [journalEntries, setJournalEntries] = useState<{ id: string; date: string; mood: string; text: string }[]>([]);
    const [selectedMood, setSelectedMood] = useState<string>("calm");
    const [journalText, setJournalText] = useState<string>("");

    useEffect(() => {
      if (!user) return;
      const stored = localStorage.getItem(`majal_journal_entries_${user.id}`);
      if (stored) {
        try {
          setJournalEntries(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
    }, []);

    const saveJournalEntry = () => {
      if (!journalText.trim()) {
        toast.error("Veuillez écrire quelque chose avant d'enregistrer.");
        return;
      }
      const newEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        mood: selectedMood,
        text: journalText,
      };
      const updated = [newEntry, ...journalEntries];
      setJournalEntries(updated);
      localStorage.setItem(`majal_journal_entries_${user.id}`, JSON.stringify(updated));
      setJournalText("");
      toast.success("✅ Entrée de journal enregistrée avec succès !");
    };

    const deleteEntry = (id: string) => {
      const updated = journalEntries.filter(e => e.id !== id);
      setJournalEntries(updated);
      localStorage.setItem(`majal_journal_entries_${user.id}`, JSON.stringify(updated));
      toast.success("✅ Entrée supprimée.");
    };

    const moods = [
      { id: "happy", emoji: "🌟", color: "from-amber-400/25 to-yellow-500/25 text-amber-700 border-amber-300/40" },
      { id: "calm", emoji: "🧘", color: "from-teal-400/25 to-emerald-500/25 text-teal-800 border-teal-300/40" },
      { id: "neutral", emoji: "☁️", color: "from-gray-300/25 to-slate-400/25 text-slate-700 border-slate-300/40" },
      { id: "sad", emoji: "🌧️", color: "from-blue-400/25 to-indigo-500/25 text-blue-800 border-blue-300/40" },
      { id: "anxious", emoji: "⚡", color: "from-purple-400/25 to-fuchsia-500/25 text-purple-800 border-purple-300/40" },
      { id: "angry", emoji: "🌋", color: "from-red-400/25 to-rose-500/25 text-red-800 border-rose-300/40" },
    ];

    // Compute insights
    const moodCounts = journalEntries.reduce((acc, entry) => {
      acc[entry.mood] = (acc[entry.mood] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let primaryMood = "calm";
    let maxCount = 0;
    Object.entries(moodCounts).forEach(([m, count]) => {
      if (count > maxCount) {
        maxCount = count;
        primaryMood = m;
      }
    });

    const activePrimaryMood = moods.find(m => m.id === primaryMood);

    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-6">
            {/* New Entry Form */}
            <div className="dashboard-card p-6 md:p-8 space-y-6">
              <h3 className="font-serif text-xl font-semibold text-foreground">{t("space.journal.title")}</h3>
              
              <div className="space-y-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Comment vous sentez-vous ?
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {moods.map((m) => {
                    const active = selectedMood === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMood(m.id)}
                        className={`p-3 rounded-2xl border bg-gradient-to-br flex flex-col items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer border-solid ${
                          active 
                            ? `${m.color} ring-2 ring-primary scale-105 shadow-md` 
                            : "from-card to-card hover:bg-accent/40 border-border/50 scale-100"
                        }`}
                      >
                        <span className="text-2xl">{m.emoji}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {t(`space.journal.mood.${m.id}`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <textarea
                  value={journalText}
                  onChange={(e) => setJournalText(e.target.value)}
                  rows={5}
                  placeholder={t("space.journal.placeholder")}
                  className="w-full px-4 py-3 border border-border/70 rounded-2xl text-sm text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card font-sans transition-all resize-none leading-relaxed"
                />
              </div>

              <button
                onClick={saveJournalEntry}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all flex items-center justify-center gap-2 font-sans"
              >
                <BookOpen className="w-4 h-4" />
                {t("space.journal.save")}
              </button>
            </div>

            {/* Timeline */}
            <div className="dashboard-card p-6 md:p-8 space-y-6">
              <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.journal.history")}</h3>
              {journalEntries.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-25" />
                  <p className="text-sm font-medium">{t("space.journal.noEntries")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {journalEntries.map((e) => {
                    const moodDetail = moods.find(m => m.id === e.mood) || moods[2];
                    return (
                      <div key={e.id} className="p-5 border border-border/40 rounded-2xl hover:border-primary/25 transition-all duration-300 bg-teal-hero/10 relative group">
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{moodDetail.emoji}</span>
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-pale text-primary border border-primary/5">
                              {t(`space.journal.mood.${e.mood}`)}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-sans">
                              {new Date(e.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <button
                            onClick={() => deleteEntry(e.id)}
                            className="p-1 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-all border-none bg-transparent cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans font-normal">{e.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Insights & Helplines Sidebar */}
          <div className="space-y-6">
            {/* Insights card */}
            <div className="dashboard-card p-6 space-y-4 bg-gradient-to-br from-teal-pale/45 to-teal-hero/30 border border-primary/10">
              <h4 className="font-serif text-base font-semibold text-primary">{t("space.journal.insights")}</h4>
              {journalEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Écrivez des notes dans votre journal pour voir apparaître vos statistiques et tendances émotionnelles.
                </p>
              ) : (
                <div className="space-y-4 font-sans">
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("space.journal.insightsDesc")}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-3xl">{activePrimaryMood?.emoji}</span>
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {t(`space.journal.mood.${primaryMood}`)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Apparu {maxCount} fois sur {journalEntries.length} notes
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-border/30">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Répartition</div>
                    {moods.map(m => {
                      const count = moodCounts[m.id] || 0;
                      if (count === 0) return null;
                      const pct = Math.round((count / journalEntries.length) * 100);
                      return (
                        <div key={m.id} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-foreground">
                            <span>{m.emoji} {t(`space.journal.mood.${m.id}`)}</span>
                            <span>{count} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Crisis SOS Help inside journal as well */}
            <CrisisHelpline />
          </div>
        </div>
      </div>
    );
  };

  // ── Coping Page ────────────────────────────────────────────────────────────
  const CopingPage = () => {
    // Breathing state
    const [breathActive, setBreathActive] = useState(false);
    const [breathPhase, setBreathPhase] = useState<"inhale" | "hold1" | "exhale" | "hold2">("inhale");
    const [breathTimer, setBreathTimer] = useState(4);

    // Grounding state
    const [groundingStep, setGroundingStep] = useState(0); // 0: intro, 1 to 5 steps, 6: done

    useEffect(() => {
      let interval: any;
      if (breathActive) {
        interval = setInterval(() => {
          setBreathTimer((prev) => {
            if (prev === 1) {
              setBreathPhase((phase) => {
                if (phase === "inhale") return "hold1";
                if (phase === "hold1") return "exhale";
                if (phase === "exhale") return "hold2";
                return "inhale";
              });
              return 4;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setBreathTimer(4);
        setBreathPhase("inhale");
      }
      return () => clearInterval(interval);
    }, [breathActive]);

    const getBreathInstructions = () => {
      if (breathPhase === "inhale") return { text: t("space.coping.breath.inhale"), scale: 1.6, color: "bg-teal-pale text-teal-800 border-teal-300" };
      if (breathPhase === "hold1") return { text: t("space.coping.breath.hold"), scale: 1.6, color: "bg-amber-100 text-amber-800 border-amber-300" };
      if (breathPhase === "exhale") return { text: t("space.coping.breath.exhale"), scale: 1.0, color: "bg-blue-100 text-blue-800 border-blue-300" };
      return { text: t("space.coping.breath.hold"), scale: 1.0, color: "bg-amber-100 text-amber-800 border-amber-300" };
    };

    const breathInfo = getBreathInstructions();

    const groundingSteps = [
      { num: 5, sense: "👀 Vue", desc: "Regardez autour de vous et nommez 5 choses que vous pouvez voir.", descAr: "انظر حولك وسمِّ 5 أشياء يمكنك رؤيتها." },
      { num: 4, sense: "🤝 Toucher", desc: "Portez attention à votre corps et nommez 4 choses que vous pouvez toucher ou sentir physiquement.", descAr: "انتبه إلى جسدك وسمِّ 4 أشياء يمكنك لمسها أو الشعور بها جسديًا." },
      { num: 3, sense: "👂 Ouïe", desc: "Écoutez attentivement et identifiez 3 bruits distincts autour de vous.", descAr: "استمع جيداً وحدد 3 أصوات مختلفة من حولك." },
      { num: 2, sense: "👃 Odorat", desc: "Respirez doucement et identifiez 2 odeurs différentes dans votre environnement.", descAr: "تنفس ببطء وحدد رائحتين مختلفتين في محيطك." },
      { num: 1, sense: "👅 Goût", desc: "Prenez conscience d'une chose que vous pouvez goûter, ou concentrez-vous sur la sensation dans votre bouche.", descAr: "كن على دراية بشيء واحد يمكنك تذوقه، أو ركز على الإحساس في فمك." }
    ];

    return (
      <div className="p-4 sm:p-6 space-y-8 max-w-4xl animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Breathing Guide */}
          <div className="dashboard-card p-6 md:p-8 flex flex-col justify-between items-center text-center h-[500px]">
            <div className="w-full">
              <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.coping.breathing")}</h3>
              <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">{t("space.coping.breathingDesc")}</p>
            </div>

            {/* Breathing Circle Widget */}
            <div className="relative w-48 h-48 flex items-center justify-center my-6">
              {/* Outer Glow Ring */}
              <div 
                className="absolute inset-0 rounded-full border border-solid border-primary/20 bg-teal-pale/5 opacity-40 transition-all duration-[1000ms] ease-in-out" 
                style={{ transform: `scale(${breathActive ? breathInfo.scale * 1.15 : 1.0})` }}
              />
              {/* Main Breathing Circle */}
              <div 
                className={`w-36 h-36 rounded-full flex flex-col items-center justify-center border-4 border-solid ${breathInfo.color} shadow-lg transition-all duration-[1000ms] ease-in-out`}
                style={{ transform: `scale(${breathActive ? breathInfo.scale : 1.0})` }}
              >
                {breathActive ? (
                  <>
                    <span className="text-lg font-serif font-bold tracking-wide animate-pulse">{breathInfo.text}</span>
                    <span className="text-2xl font-bold mt-1.5 font-sans">{breathTimer}s</span>
                  </>
                ) : (
                  <Wind className="w-12 h-12 text-primary" />
                )}
              </div>
            </div>

            <button
              onClick={() => setBreathActive(!breathActive)}
              className={`w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 ${
                breathActive 
                  ? "bg-red-50 text-red-600 hover:bg-red-100" 
                  : "bg-primary text-primary-foreground hover:bg-teal-mid"
              }`}
            >
              {breathActive ? (
                <>
                  <Square className="w-4 h-4" />
                  {t("space.coping.breath.stop")}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {t("space.coping.breath.start")}
                </>
              )}
            </button>
          </div>

          {/* Grounding Exercise */}
          <div className="dashboard-card p-6 md:p-8 flex flex-col justify-between h-[500px]">
            <div className="w-full">
              <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.coping.grounding")}</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{t("space.coping.groundingDesc")}</p>
            </div>

            {/* Grounding Step Container */}
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              {groundingStep === 0 && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-teal-pale flex items-center justify-center mx-auto border border-solid border-primary/10">
                    <Heart className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Prêt pour l'ancrage ?</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Cet exercice vous aide à vous reconnecter au moment présent lorsque votre esprit s'emballe ou s'inquiète.
                  </p>
                </div>
              )}

              {groundingStep > 0 && groundingStep <= 5 && (() => {
                const step = groundingSteps[groundingStep - 1];
                return (
                  <div className="text-center space-y-5 animate-in fade-in duration-300">
                    <div className="w-20 h-20 rounded-full bg-teal-pale border-2 border-solid border-primary/10 flex items-center justify-center mx-auto text-3xl font-serif font-bold text-primary shadow-inner">
                      {step.num}
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-primary uppercase tracking-widest">{step.sense}</div>
                      <p className="text-sm font-semibold text-foreground px-4 leading-relaxed font-sans">{lang === "ar" ? step.descAr : step.desc}</p>
                    </div>
                  </div>
                );
              })()}

              {groundingStep === 6 && (
                <div className="text-center space-y-4 animate-in zoom-in duration-300">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-solid border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-md">
                    <Check className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Exercice terminé !</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Prenez une grande respiration lente. Vous avez fait un pas important pour prendre soin de vous.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {groundingStep > 0 && (
                <button
                  onClick={() => setGroundingStep((prev) => prev - 1)}
                  className="px-4 py-3 border border-solid border-border/50 hover:bg-accent/40 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer transition-all"
                >
                  Retour
                </button>
              )}
              <button
                onClick={() => {
                  if (groundingStep === 6) {
                    setGroundingStep(0);
                  } else {
                    setGroundingStep((prev) => prev + 1);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all text-center"
              >
                {groundingStep === 0 ? "Commencer" : groundingStep === 5 ? "Terminer" : groundingStep === 6 ? "Recommencer" : "Suivant"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Live Audio Modal (Bottom Sheet) ─────────────────────────────────────────
  const LiveAudioModal = () => {
    if (!activeRoom) return null;
    const isRtl = dir === "rtl";

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        {/* Backdrop overlay */}
        <div 
          className="absolute inset-0 bg-foreground/40 backdrop-blur-xs transition-opacity duration-300"
          onClick={() => {
            setActiveRoom(null);
            setIsSpeaking(false);
          }}
        />
        {/* Bottom Sheet container */}
        <div className="relative w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl p-6 md:p-8 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto flex flex-col justify-between border-t border-solid border-primary/10">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-solid border-border/40">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
              </span>
              <div>
                <h3 className="font-serif text-base font-semibold text-foreground truncate max-w-md">{activeRoom.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
                  {t("space.explore.speakers")} : {activeRoom.speakers.length + 1} · {t("space.explore.listeners")} : {activeRoom.listeners.length}
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                setActiveRoom(null);
                setIsSpeaking(false);
              }}
              className="p-1.5 rounded-lg hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-all border-none bg-transparent cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Speakers grid */}
          <div className="py-6 space-y-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.explore.speakers")}</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-6 text-center">
              
              {/* Host Speaker (Therapist) */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative flex items-center justify-center">
                  {/* Pulsing Audio Soundwaves simulator */}
                  <div className="absolute w-20 h-20 rounded-full bg-primary/15 animate-pulse duration-1000" />
                  <div className="absolute w-24 h-24 rounded-full bg-primary/5 animate-pulse duration-2000" />
                  {activeRoom.hostAvatar ? (
                    <img src={activeRoom.hostAvatar} alt={activeRoom.host} className="w-16 h-16 rounded-full object-cover border-2 border-solid border-primary relative z-10 shadow-md" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-teal-pale border-2 border-solid border-primary flex items-center justify-center text-primary font-bold text-lg relative z-10 shadow-md">
                      {getInitials(activeRoom.host)}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 z-20 bg-primary text-primary-foreground text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-solid border-white">
                    HOST
                  </span>
                </div>
                <div className="text-xs font-semibold text-foreground truncate w-20">{activeRoom.host}</div>
                <div className="text-[9px] text-primary uppercase font-bold tracking-wider leading-none">Psychologue</div>
              </div>

              {/* Other Speakers */}
              {activeRoom.speakers.map((s) => {
                const speaking = isSpeaking && s.id === user?.id;
                return (
                  <div key={s.id} className="flex flex-col items-center gap-2">
                    <div className="relative flex items-center justify-center">
                      {speaking && (
                        <>
                          <div className="absolute w-18 h-18 rounded-full bg-primary/20 animate-pulse" />
                          <div className="absolute w-22 h-22 rounded-full bg-primary/5 animate-pulse" />
                        </>
                      )}
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-foreground font-semibold text-base border-2 border-solid relative z-10 shadow ${
                        speaking ? "bg-teal-pale border-primary" : "bg-accent/40 border-border/80"
                      }`}>
                        {getInitials(s.name)}
                      </div>
                      {!speaking && (
                        <span className="absolute bottom-0 right-0 z-20 bg-gray-500 text-white text-[8px] font-bold p-0.5 rounded-full border border-solid border-white">
                          🔇
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-foreground truncate w-20">{s.name}</div>
                    <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider leading-none">
                      {s.id === user?.id ? "Moi" : "Membre"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Listeners list */}
          <div className="border-t border-solid border-border/40 pt-4 pb-6 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.explore.listeners")}</h4>
            <div className="flex flex-wrap gap-3.5">
              {activeRoom.listeners.map((l) => (
                <div key={l.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/40 text-xs font-semibold text-foreground border border-solid border-border/20">
                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px]">{getInitials(l.name)}</div>
                  <span>{l.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Controls bar */}
          <div className="pt-4 border-t border-solid border-border/40 flex items-center justify-between gap-4 font-sans">
            <button
              onClick={() => {
                setActiveRoom(null);
                setIsSpeaking(false);
              }}
              className="px-5 py-3 border border-solid border-destructive/20 text-destructive bg-transparent hover:bg-destructive/5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
            >
              {t("space.explore.leaveRoom")}
            </button>

            <div className="flex gap-2">
              {activeRoom.speakers.some(s => s.id === user?.id) ? (
                <button
                  onClick={() => setIsSpeaking(!isSpeaking)}
                  className={`px-5 py-3 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all flex items-center gap-1.5 shadow-sm ${
                    isSpeaking ? "bg-teal-pale text-primary" : "bg-primary text-primary-foreground hover:bg-teal-mid"
                  }`}
                >
                  {isSpeaking ? "Mute" : "Parler"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!user) return;
                    // Move to speaker list
                    setActiveRoom(prev => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        listeners: prev.listeners.filter(l => l.id !== user.id),
                        speakers: [...prev.speakers, { id: user.id, name: profile.full_name || "Moi" }]
                      };
                    });
                    setIsSpeaking(true);
                    toast.success("🎙️ Vous êtes maintenant intervenant !");
                  }}
                  className="px-5 py-3 bg-primary text-primary-foreground hover:bg-teal-mid rounded-xl text-xs font-semibold border-none cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {t("space.explore.requestSpeak")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Explore Page ───────────────────────────────────────────────────────────
  const ExplorePage = () => {
    const [mockStories, setMockStories] = useState<{ name: string; avatar?: string; stories: { text: string; bg: string }[] }[]>([]);
    const [audioRooms, setAudioRooms] = useState<{ id: string; title: string; host: string; hostAvatar?: string; listeners: { id: string; name: string }[]; speakers: { id: string; name: string }[] }[]>([]);
    const [newGratText, setNewGratText] = useState("");
    const [postingGrat, setPostingGrat] = useState(false);
    
    // Slide progression effect inside Stories Viewer
    useEffect(() => {
      let timeout: any;
      if (selectedStoryTherapist) {
        timeout = setTimeout(() => {
          if (currentStorySlide < selectedStoryTherapist.stories.length - 1) {
            setCurrentStorySlide(prev => prev + 1);
          } else {
            setSelectedStoryTherapist(null);
            setCurrentStorySlide(0);
          }
        }, 4000); // Auto advance slide every 4 seconds
      }
      return () => clearTimeout(timeout);
    }, [selectedStoryTherapist, currentStorySlide]);

    const fetchDbStories = async () => {
      const defaultStories = [
        {
          name: "Dr. Sofia Ben",
          avatar: undefined,
          stories: [
            { text: "« N'oubliez pas : Prendre soin de soi n'est pas égoïste, c'est indispensable. »", bg: "from-teal-mid to-teal-dark" },
            { text: "« Respirez profondément. Le stress de cette journée ne définit pas votre avenir. »", bg: "from-rose-400 to-indigo-600" }
          ]
        },
        {
          name: "Dr. Yacine K.",
          avatar: undefined,
          stories: [
            { text: "« Vos sentiments actuels sont valides. Ne les refoulez pas, écoutez-les. »", bg: "from-amber-400 to-orange-600" }
          ]
        },
        {
          name: "Dr. Amina R.",
          avatar: undefined,
          stories: [
            { text: "« La guérison est un chemin non linéaire. Soyez patient avec vous-même. »", bg: "from-emerald-400 to-teal-700" }
          ]
        }
      ];

      try {
        const { data: dbStoriesData } = await (supabase as any)
          .from('stories')
          .select('id, content, bg_gradient, author_id')
          .order('created_at', { ascending: true });

        if (dbStoriesData && dbStoriesData.length > 0) {
          const authorIds = [...new Set(dbStoriesData.map((s: any) => s.author_id as string))] as string[];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', authorIds);

          const grouped = authorIds.map(uid => {
            const p = profiles?.find(x => x.user_id === uid);
            const userStories = dbStoriesData.filter(s => s.author_id === uid);
            return {
              name: p?.full_name || "Thérapeute",
              avatar: p?.avatar_url || undefined,
              stories: userStories.map(s => ({ text: s.content, bg: s.bg_gradient }))
            };
          });

          setMockStories([...grouped, ...defaultStories]);
        } else {
          setMockStories(defaultStories);
        }
      } catch (err) {
        console.error("Error fetching db stories:", err);
        setMockStories(defaultStories);
      }
    };

    useEffect(() => {
      fetchDbStories();

      // Live Audio Rooms
      const activeAudio = localStorage.getItem("majal_active_audio");
      if (activeAudio) {
        try { setAudioRooms(JSON.parse(activeAudio)); } catch(e) {}
      } else {
        const defRooms = [
          {
            id: "room-1",
            title: "Gérer le surmenage professionnel et l'anxiété",
            host: "Dr. Sofia Ben",
            hostAvatar: undefined,
            listeners: [
              { id: "l1", name: "Karim" },
              { id: "l2", name: "Amel" },
              { id: "l3", name: "Sara" }
            ],
            speakers: []
          }
        ];
        setAudioRooms(defRooms);
        localStorage.setItem("majal_active_audio", JSON.stringify(defRooms));
      }

      // Realtime subscription for stories
      const storiesChannel = supabase
        .channel("public:stories")
        .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => {
          fetchDbStories();
        })
        .subscribe();

      return () => {
        storiesChannel.unsubscribe();
      };
    }, []);

    const postGratitude = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newGratText.trim()) return;
      setPostingGrat(true);

      const colors = ["bg-teal-pale/50", "bg-amber-100/50", "bg-blue-100/50", "bg-rose-100/50", "bg-purple-100/50"];
      const randColor = colors[Math.floor(Math.random() * colors.length)];
      const randRot = (Math.random() * 6 - 3); // rotate between -3deg and 3deg

      const { data, error } = await (supabase as any)
        .from('gratitudes')
        .insert({
          author_id: user?.id,
          content: newGratText.trim(),
          color: randColor,
          rotation: randRot
        })
        .select()
        .single();

      setPostingGrat(false);
      if (error) {
        toast.error("Erreur lors de l'enregistrement de la gratitude");
      } else if (data) {
        setNewGratText("");
        toast.success("✅ Épinglé sur le mur des gratitudes !");
        fetchGratitudes();
      }
    };

    // Advanced slide progress calculation
    const progressBarStyle = (index: number) => {
      if (index < currentStorySlide) return { width: "100%" };
      if (index === currentStorySlide) return { width: "100%", transition: "width 4000ms linear" };
      return { width: "0%" };
    };

    return (
      <div className="p-4 sm:p-6 space-y-8 max-w-5xl animate-in fade-in duration-500 font-sans">
        
        {/* Section 1: Stories row */}
        <div className="space-y-3">
          <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.explore.stories")}</h3>
          <div className="flex gap-4 overflow-x-auto py-2 pr-1 select-none no-scrollbar snap-x snap-mandatory">
            {mockStories.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedStoryTherapist(s);
                  setCurrentStorySlide(0);
                }}
                className="flex flex-col items-center gap-1.5 snap-start shrink-0 cursor-pointer border-none bg-transparent"
              >
                <div className="p-0.5 rounded-full bg-gradient-to-tr from-primary to-teal-mid border border-solid border-transparent shadow hover:scale-105 transition-all duration-300">
                  <div className="p-0.5 bg-white rounded-full">
                    {s.avatar ? (
                      <img src={s.avatar} alt={s.name} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-teal-pale text-primary font-bold text-sm flex items-center justify-center">
                        {getInitials(s.name)}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-foreground max-w-[70px] truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Main Explore Split grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-8">
          
          <div className="space-y-8">
            {/* Live Audio Room Card Widget */}
            <div className="dashboard-card p-6 space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                </span>
                {t("space.explore.liveRooms")}
              </h3>
              
              <div className="space-y-3.5">
                {audioRooms.map((room) => (
                  <div key={room.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border border-solid border-border/50 rounded-2xl bg-teal-hero/10 hover:bg-teal-hero/25 hover:border-primary/20 transition-all duration-300">
                    <div>
                      <div className="font-semibold text-sm text-foreground leading-snug">{room.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-1 font-sans">
                        Hôte : {room.host} · {room.listeners.length} auditeurs
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!user) return;
                        const updatedRoom = {
                          ...room,
                          listeners: [...room.listeners.filter(x => x.id !== user.id), { id: user.id, name: profile.full_name || "Moi" }]
                        };
                        setActiveRoom(updatedRoom);
                        setIsMuted(true);
                      }}
                      className="px-4 py-2.5 bg-primary text-primary-foreground hover:bg-teal-mid rounded-xl text-xs font-semibold border-none cursor-pointer transition-all shadow-sm shrink-0 self-end sm:self-auto"
                    >
                      {t("space.explore.joinRoom")}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Gratitude Wall */}
            <div className="dashboard-card p-6 md:p-8 space-y-6">
              <div>
                <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.explore.gratitude")}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t("space.explore.gratitudeDesc")}</p>
              </div>

              {/* Gratitudes Sticky Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                {gratitudes.map((g) => (
                  <div
                    key={g.id}
                    className={`p-4 rounded-xl border border-solid border-border/30 ${g.color} font-serif text-xs text-foreground leading-relaxed shadow-sm hover:shadow transition-all`}
                    style={{ transform: `rotate(${g.rotation}deg)` }}
                  >
                    <p className="italic">"{g.text}"</p>
                    <span className="text-[9px] uppercase font-sans font-bold tracking-wider text-primary/70 mt-3 block">Anonyme</span>
                  </div>
                ))}
              </div>

              {/* Form card */}
              <form onSubmit={postGratitude} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newGratText}
                  onChange={(e) => setNewGratText(e.target.value)}
                  placeholder={t("space.explore.gratitudePlaceholder")}
                  className="flex-1 px-4 py-3 border border-border/70 rounded-xl text-xs bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans"
                />
                <button
                  type="submit"
                  disabled={postingGrat}
                  className="px-4 py-3 bg-primary text-primary-foreground hover:bg-teal-mid rounded-xl text-xs font-semibold border-none cursor-pointer transition-all shadow-sm shrink-0 font-sans"
                >
                  {t("space.explore.postGratitude")}
                </button>
              </form>
            </div>
          </div>

          {/* Right sidebar: Wellness Feed Cards */}
          <div className="space-y-6">
            <div className="dashboard-card p-6 space-y-4">
              <h3 className="font-serif text-base font-semibold text-primary">Le Conseil du Jour</h3>
              <div className="p-4 rounded-2xl border border-solid border-primary/10 bg-teal-hero/10 space-y-3 font-sans">
                <p className="text-xs text-foreground leading-relaxed font-sans">
                  « Prenez 3 minutes à midi pour fermer les yeux, écouter les bruits ambiants et relâcher vos épaules. Une pause de pleine conscience réinitialise l'organisme. »
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-solid border-border/30">
                  <span className="text-[9px] font-semibold text-primary uppercase">Dr. Sofia Ben</span>
                  <div className="flex gap-2 text-[10px] text-muted-foreground">
                    <button className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-muted-foreground hover:text-primary transition-all">❤️ 12</button>
                    <button className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-muted-foreground hover:text-primary transition-all">🧘 9</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-card p-6 space-y-4">
              <h3 className="font-serif text-base font-semibold text-primary">Affirmation positive</h3>
              <div className="p-4 rounded-2xl border border-solid border-rose-100 bg-rose-50/10 space-y-3 font-sans">
                <p className="text-xs text-foreground italic leading-relaxed font-sans">
                  « J'ai le droit de me tromper. Mes erreurs font partie de mon apprentissage et ne définissent pas ma valeur humaine. »
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-solid border-border/30">
                  <span className="text-[9px] font-semibold text-rose-800 uppercase">Majal Support</span>
                  <button className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-muted-foreground hover:text-rose-600 transition-all text-[10px]">🤝 34</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stories full screen viewer modal */}
        {selectedStoryTherapist && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm h-[70vh] bg-white rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl">
              
              {/* Slides progress bars */}
              <div className="absolute top-3 inset-x-4 flex gap-1.5 z-30">
                {selectedStoryTherapist.stories.map((_, idx) => (
                  <div key={idx} className="flex-1 h-[3px] bg-white/30 rounded overflow-hidden">
                    <div 
                      className="h-full bg-white rounded transition-all duration-300"
                      style={idx === currentStorySlide ? { width: "100%", transition: "width 4000ms linear" } : idx < currentStorySlide ? { width: "100%" } : { width: "0%" }}
                    />
                  </div>
                ))}
              </div>

              {/* Story Header */}
              <div className="absolute top-6 inset-x-4 flex items-center justify-between z-30 text-white font-sans">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 border border-solid border-white/20 flex items-center justify-center font-bold text-xs">
                    {getInitials(selectedStoryTherapist.name)}
                  </div>
                  <span className="text-xs font-semibold shadow-sm">{selectedStoryTherapist.name}</span>
                </div>
                <button 
                  onClick={() => {
                    setSelectedStoryTherapist(null);
                    setCurrentStorySlide(0);
                  }}
                  className="p-1 rounded-full bg-black/25 text-white hover:bg-black/40 transition-all border-none cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Content card */}
              <div className={`flex-1 bg-gradient-to-br ${selectedStoryTherapist.stories[currentStorySlide]?.bg || "from-teal-mid to-teal-dark"} flex items-center justify-center p-8 text-center text-white relative`}>
                <p className="font-serif text-xl md:text-2xl leading-relaxed italic px-4 select-none">
                  {selectedStoryTherapist.stories[currentStorySlide]?.text}
                </p>
                
                {/* Touch areas to navigate */}
                <div 
                  className="absolute inset-y-0 left-0 w-1/3 cursor-pointer"
                  onClick={() => {
                    if (currentStorySlide > 0) {
                      setCurrentStorySlide(prev => prev - 1);
                    }
                  }}
                />
                <div 
                  className="absolute inset-y-0 right-0 w-1/3 cursor-pointer"
                  onClick={() => {
                    if (currentStorySlide < selectedStoryTherapist.stories.length - 1) {
                      setCurrentStorySlide(prev => prev + 1);
                    } else {
                      setSelectedStoryTherapist(null);
                      setCurrentStorySlide(0);
                    }
                  }}
                />
              </div>

            </div>
          </div>
        )}

      </div>
    );
  };

  // ── Forum Page ─────────────────────────────────────────────────────────────
  const ForumPage = () => {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [commentText, setCommentText] = useState("");
    const [showNewTopic, setShowNewTopic] = useState(false);

    const handleCreateTopic = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim() || !content.trim()) return;

      const cat = forumCategory === "all" ? "stress" : forumCategory;

      const { data, error } = await (supabase as any)
        .from('forum_threads')
        .insert({
          author_id: user?.id,
          category: cat,
          title: title.trim(),
          content: content.trim()
        })
        .select()
        .single();

      if (error) {
        toast.error("Erreur lors de la création du sujet.");
      } else if (data) {
        toast.success("✅ Sujet de discussion publié anonymement !");
        setTitle("");
        setContent("");
        setShowNewTopic(false);
        fetchForumThreads();
      }
    };

    const handlePostComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!commentText.trim() || !selectedThread) return;

      const { data, error } = await (supabase as any)
        .from('forum_replies')
        .insert({
          thread_id: selectedThread.id,
          author_id: user?.id,
          content: commentText.trim()
        })
        .select('id, content, created_at, author_id, profiles(full_name, user_type)')
        .single();

      if (error) {
        toast.error("Erreur lors de la publication de la réponse.");
      } else if (data) {
        toast.success("✅ Votre réponse a été publiée !");
        setCommentText("");
        const newReply = {
          author: data.profiles?.user_type === 'psychologue' ? data.profiles?.full_name || "Thérapeute" : "Anonyme",
          content: data.content,
          isPsy: data.profiles?.user_type === 'psychologue',
          date: data.created_at
        };
        const updatedReplies = [...selectedThread.replies, newReply];
        setSelectedThread({ ...selectedThread, replies: updatedReplies });
        fetchForumThreads();
      }
    };

    const categories = [
      { id: "all", label: "Tout afficher" },
      { id: "stress", label: "Stress" },
      { id: "anxiety", label: "Anxiété" },
      { id: "relationships", label: "Relations" },
      { id: "depression", label: "Humeur" },
      { id: "selfesteem", label: "Estime de soi" }
    ];

    const filteredThreads = forumCategory === "all" 
      ? forumThreads 
      : forumThreads.filter(t => t.category === forumCategory);

    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl animate-in fade-in duration-500 font-sans">
        
        {/* Header summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-solid border-border/40">
          <div>
            <h3 className="font-serif text-2xl text-foreground font-semibold">{t("space.forum.title")}</h3>
            <p className="text-xs text-muted-foreground mt-1 font-sans">{t("space.forum.desc")}</p>
          </div>
          <button
            onClick={() => setShowNewTopic(!showNewTopic)}
            className="px-5 py-3 bg-primary text-primary-foreground hover:bg-teal-mid rounded-xl text-xs font-semibold border-none cursor-pointer transition-all shadow-sm shrink-0"
          >
            {t("space.forum.newTopic")}
          </button>
        </div>

        {/* Sliding category pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 select-none no-scrollbar">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setForumCategory(c.id)}
              className={`px-4 py-2 text-xs font-semibold rounded-full border border-solid transition-all cursor-pointer shrink-0 ${
                forumCategory === c.id 
                  ? "bg-primary border-primary text-white shadow-sm" 
                  : "bg-white border-border/70 hover:bg-accent/40 text-muted-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Layout split */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-8">
          
          {/* Threads Listing or Form */}
          <div className="space-y-4">
            {showNewTopic && (
              <div className="dashboard-card p-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
                <div className="flex justify-between items-center pb-2">
                  <h4 className="font-serif text-base font-semibold text-foreground">{t("space.forum.newTopic")}</h4>
                  <button onClick={() => setShowNewTopic(false)} className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={handleCreateTopic} className="space-y-4 font-sans text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-muted-foreground uppercase tracking-wider">{t("space.forum.postTitle")}</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Comment calmer mon esprit en période d'examens..."
                      className="px-4 py-2.5 border border-border/70 rounded-xl text-xs bg-teal-hero/30 outline-none focus:border-primary focus:bg-card transition-all font-sans"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-muted-foreground uppercase tracking-wider">{t("space.forum.postContent")}</label>
                    <textarea
                      required
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={5}
                      className="px-4 py-2.5 border border-border/70 rounded-xl text-xs bg-teal-hero/30 outline-none focus:border-primary focus:bg-card transition-all font-sans resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-primary text-primary-foreground hover:bg-teal-mid rounded-xl text-xs font-semibold border-none cursor-pointer transition-all shadow-sm font-sans"
                  >
                    {t("space.forum.createPost")}
                  </button>
                </form>
              </div>
            )}

            {filteredThreads.length === 0 ? (
              <div className="dashboard-card p-10 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Aucune discussion pour le moment. Lancez le premier sujet !</p>
              </div>
            ) : (
              filteredThreads.map((threadItem) => (
                <div 
                  key={threadItem.id} 
                  onClick={() => setSelectedThread(threadItem)}
                  className="dashboard-card p-6 flex flex-col justify-between hover:border-primary/20 hover:shadow transition-all duration-300 cursor-pointer border border-solid border-border/40"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-pale text-primary">
                        {threadItem.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(threadItem.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <h4 className="font-serif text-base font-semibold text-foreground leading-snug">{threadItem.title}</h4>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed font-sans">{threadItem.content}</p>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-solid border-border/30 pt-3.5 mt-4 font-sans text-xs">
                    <span className="text-muted-foreground">Par : {threadItem.author}</span>
                    <span className="text-primary font-semibold flex items-center gap-1.5 hover:text-teal-mid transition-all">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {threadItem.replies.length} {t("space.forum.comments")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sidebar Wellness Guide cards */}
          <div className="space-y-6">
            <div className="dashboard-card p-6 space-y-4">
              <h3 className="font-serif text-base font-semibold text-primary">Règles du Forum</h3>
              <ul className="space-y-2.5 text-xs text-muted-foreground leading-relaxed font-sans">
                <li>• **Confidentialité absolue** : ne partagez jamais de données médicales identifiables ou de noms réels.</li>
                <li>• **Respect mutuel** : les insultes, jugements ou commentaires toxiques entraînent un bannissement.</li>
                <li>• **Pas d'urgence** : ce forum n'est pas surveillé en direct. En cas d'urgence grave, utilisez le bouton d'appel d'urgence (SOS).</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Detailed Thread View Side-Drawer */}
        {selectedThread && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div 
              className="absolute inset-0 bg-black/25 backdrop-blur-xs transition-opacity"
              onClick={() => setSelectedThread(null)}
            />
            <div className={`relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between p-6 md:p-8 animate-in ${dir === "rtl" ? "slide-in-from-left duration-300" : "slide-in-from-right duration-300"}`}>
              
              <div className="space-y-6 flex-1 overflow-y-auto pr-1">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-solid border-border/40">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-pale text-primary">
                      {selectedThread.category}
                    </span>
                    <h3 className="font-serif text-lg font-semibold text-foreground mt-2 leading-snug">{selectedThread.title}</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">Publié par {selectedThread.author} · {new Date(selectedThread.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedThread(null)}
                    className="p-1.5 rounded-lg hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-all border-none bg-transparent cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Original Post content */}
                <div className="p-5 border border-solid border-border/30 rounded-2xl bg-teal-hero/5 font-sans text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedThread.content}
                </div>

                {/* Comment Section timeline */}
                <div className="space-y-4 pt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.forum.comments")} ({selectedThread.replies.length})</h4>
                  
                  <div className="space-y-3.5">
                    {selectedThread.replies.map((r: any, idx: number) => (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-xl border border-solid font-sans text-xs leading-relaxed ${
                          r.isPsy 
                            ? "bg-teal-pale/35 border-primary/20" 
                            : "bg-accent/15 border-border/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-semibold ${r.isPsy ? "text-primary flex items-center gap-1" : "text-foreground"}`}>
                            {r.author}
                            {r.isPsy && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary text-white scale-95 leading-none">
                                {t("space.forum.verifiedPsy")}
                              </span>
                            )}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(r.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-foreground/90 whitespace-pre-wrap">{r.content}</p>
                      </div>
                    ))}
                    {selectedThread.replies.length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-4">Pas encore de réponses. Soyez le premier à encourager !</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Reply form */}
              <form onSubmit={handlePostComment} className="pt-4 border-t border-solid border-border/40 flex gap-2 mt-4 font-sans text-xs">
                <input
                  type="text"
                  required
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t("space.forum.replyPlaceholder")}
                  className="flex-1 px-4 py-3 border border-border/70 rounded-xl text-xs bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans"
                />
                <button
                  type="submit"
                  className="px-5 py-3 bg-primary text-primary-foreground hover:bg-teal-mid rounded-xl text-xs font-semibold border-none cursor-pointer transition-all shadow-sm font-sans"
                >
                  {t("space.forum.reply")}
                </button>
              </form>

            </div>
          </div>
        )}

      </div>
    );
  };

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const Dashboard = () => (
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

      {/* Stat cards */}
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

      {/* Upcoming */}
      <div className="dashboard-card p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
          <h3 className="font-serif text-lg font-semibold text-foreground">Prochaines séances</h3>
          <button onClick={() => setActivePage("sessions")} className="text-primary text-sm font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer hover:text-teal-mid transition-colors">
            Voir tout <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {bookingsLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
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

        {/* Unlocked Badges Container */}
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

      {/* Advanced Features Row: Goals checklist & Crisis Helpline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GoalsWidget />
        <CrisisHelpline />
      </div>

      {/* CTA to find a psy */}
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

  // ── Sessions ──────────────────────────────────────────────────────────────
  const Sessions = () => {
    const rtl = dir === "rtl";

    // Generate available time slots for the selected date
    const getAvailableSlots = () => {
      if (!rescheduleDate) return [];
      const slots = [];
      for (let h = 8; h < 20; h++) {
        slots.push(`${String(h).padStart(2, "0")}:00`);
        slots.push(`${String(h).padStart(2, "0")}:30`);
      }
      return slots;
    };

    const RescheduleModal = () => {
      if (!rescheduleBooking) return null;

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setRescheduleBooking(null); setRescheduleStep(1); setRescheduleDate(""); setRescheduleTime(""); }} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200">

            {/* Step indicator */}
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

            {/* Step 1: Confirm selection */}
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

            {/* Step 2: Pick date */}
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

            {/* Step 3: Pick time */}
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

            {/* Step 4: Confirm */}
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
                    onClick={handleReschedule}
                    disabled={rescheduling}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {rescheduling && <Loader2 className="w-4 h-4 animate-spin" />}
                    {rescheduling ? "Report en cours..." : "Confirmer le report"}
                  </button>
                </div>
              </div>
            )}

            {/* Close button */}
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
      <div className="p-4 sm:p-6 space-y-8 animate-in fade-in duration-500">
        {/* Upcoming */}
        <div className="dashboard-card p-6">
          <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">
            {t("space.upcomingSessionsCount")} ({upcoming.length})
          </h3>
          {bookingsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
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
                    <span className={`badge-pill ${b.status === "confirmed" ? "badge-pill-confirmed" : "badge-pill-pending"}`}>
                      {b.status === "confirmed" ? t("space.status.confirmed") : t("space.status.pending")}
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

        {/* History */}
        <div className="dashboard-card p-6">
          <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">
            {t("space.historyCount")} ({past.length})
          </h3>
          {bookingsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : past.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground font-medium">{t("space.noHistory")}</p>
          ) : (
            <div className={`relative ${rtl ? "pr-8" : "pl-8"}`}>
              <div className={`absolute ${rtl ? "right-[15px]" : "left-[15px]"} top-2 bottom-2 w-[2px] bg-border/60`} />
              {past.map((b) => {
                const done = b.status === "done";
                return (
                  <div key={b.id} className="relative mb-6 last:mb-0">
                    <div className={`absolute ${rtl ? "-right-8" : "-left-8"} top-3 w-7 h-7 rounded-full flex items-center justify-center z-10 border-2 ${done ? "bg-primary border-primary text-primary-foreground" : "bg-destructive/10 border-destructive text-destructive"}`}>
                      {done ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`bg-card rounded-2xl p-5 flex items-center justify-between gap-4 ${rtl ? "me-3 border-e-4" : "ms-3 border-s-4"} shadow-sm border border-border/40 ${done ? "border-primary" : "border-destructive"}`}>
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
                      <span className={`badge-pill ${done ? "badge-pill-done" : "badge-pill-cancelled"}`}>
                        {done ? t("space.status.done") : t("space.status.cancelled")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <RescheduleModal />
      </div>
    );
  };

  // ── Messages ───────────────────────────────────────────────────────────────
  const Messages = () => {
    const allBookings = [...upcoming, ...past];
    
    // Extract unique therapist details
    const therapistDetails = new Map<string, { name: string; avatar?: string }>();
    allBookings.forEach(b => {
      if (b.psychologist_id && !therapistDetails.has(b.psychologist_id)) {
        therapistDetails.set(b.psychologist_id, {
          name: b.psychologist_name || "Un Psychologue",
          avatar: b.psychologist_avatar
        });
      }
    });

    const uniqueTherapists = Array.from(therapistDetails.entries());

    return (
      <div className="flex h-[calc(100vh-80px)] animate-in fade-in duration-500">
        <div className="w-[320px] border-r border-border/60 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-border/60">
            <h3 className="font-serif text-base font-semibold text-foreground">{t("space.discussionsTitle")}</h3>
          </div>
          <div className="flex-1 overflow-auto py-2">
            {uniqueTherapists.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground mt-8 px-4 font-medium">{t("space.noTherapistsMessage")}</p>
            ) : (
              uniqueTherapists.map(([id, data]) => (
                <button
                  key={id}
                  onClick={() => { setActiveChatUserId(id); setActiveChatUserName(data.name || t("space.defaultTherapistName")); }}
                  className={`w-full text-left px-4 py-3.5 border-b border-border/20 flex items-center gap-3 transition-all border-none cursor-pointer ${activeChatUserId === id ? "bg-teal-pale/70 border-l-4 border-primary" : "hover:bg-accent/40 bg-transparent"}`}
                >
                  {data.avatar ? (
                    <img src={data.avatar} alt={data.name} className="w-10 h-10 rounded-full object-cover border border-primary/10 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                      {getInitials(data.name)}
                    </div>
                  )}
                  <div className="font-semibold text-sm text-foreground truncate">{data.name}</div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 bg-accent/10">
          {activeChatUserId ? (
            <ChatWindow otherUserId={activeChatUserId} otherUserName={activeChatUserName} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
              <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm text-center">{t("space.selectPsyMessage")}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Profile ───────────────────────────────────────────────────────────────
  const ProfilePage = () => (
    <div className="p-4 sm:p-6 max-w-2xl space-y-8 animate-in fade-in duration-500">
      <div className="dashboard-card p-6 md:p-8">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("space.personalInfo")}</h3>
        
        {/* Avatar Upload */}
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 pb-6 border-b border-border/30">
          <div className="relative group shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 shadow-md group-hover:opacity-90 transition-opacity" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-teal-pale flex items-center justify-center text-primary text-3xl font-bold border border-primary/10 shadow-inner group-hover:bg-teal-hero transition-colors">{initials}</div>
            )}
            <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/45 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer text-white text-[11px] font-semibold text-center p-1">
              {uploadingAvatar ? "Upload..." : "Changer"}
            </label>
            <input type="file" id="avatar-upload" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} className="hidden" />
          </div>
          
          <div className="text-center sm:text-left">
            <h4 className="font-semibold text-base text-foreground leading-snug">{profile.full_name || t("space.yourName")}</h4>
            <p className="text-sm text-muted-foreground mt-0.5 font-sans">{user?.email}</p>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-teal-pale text-primary text-[10px] uppercase font-bold tracking-wider">{t("space.lang.french")}</span>
          </div>
        </div>

        {profileLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.fullName")}</label>
              <input 
                type="text" 
                value={profile.full_name} 
                onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("auth.email")}</label>
              <input 
                type="email" 
                value={user?.email ?? ""} 
                readOnly
                className="px-4 py-3 border border-border/50 rounded-xl text-sm bg-teal-hero/10 opacity-65 cursor-not-allowed font-sans text-muted-foreground" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.phone")}</label>
              <input 
                type="tel" 
                value={profile.phone} 
                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.language")}</label>
              <select 
                value={profile.language} 
                onChange={e => setProfile(p => ({ ...p, language: e.target.value }))}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans cursor-pointer"
              >
                <option>{t("space.lang.french")}</option>
                <option>{t("space.lang.arabic")}</option>
                <option>{t("space.lang.english")}</option>
              </select>
            </div>
          </div>
        )}

        <button 
          onClick={saveProfile} 
          disabled={saving}
          className="w-full mt-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all disabled:opacity-70 flex items-center justify-center gap-2 font-sans"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? t("space.saving") : t("space.save")}
        </button>
      </div>

      <div className="dashboard-card p-6 md:p-8">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("psy.settings.security") || "Sécurité"}</h3>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4 max-w-md">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("reset.newPassword") || "Nouveau mot de passe"}</label>
            <div className="flex items-center gap-3 border border-border/70 rounded-xl px-4 py-3 bg-teal-hero/30 focus-within:border-primary focus-within:bg-card transition-all focus-within:ring-1 focus-within:ring-primary">
              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="border-none bg-transparent outline-none text-sm text-foreground w-full placeholder:text-muted-foreground/60 font-sans"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={changingPassword}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-50 mt-2 font-sans shadow-sm"
          >
            {changingPassword ? "Mise à jour..." : t("psy.settings.changePassword") || "Changer le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');

  const Notifications = () => {
    const filtered = notifications.filter(n => notifFilter === 'all' || !n.is_read);

    return (
      <div className="p-4 sm:p-6 max-w-2xl animate-in fade-in duration-500 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-xl font-semibold text-foreground">{t("space.notifications")}</h3>
            <p className="text-muted-foreground text-xs mt-1 font-sans">{t("space.notif.clickToView") || "Gérez et consultez vos alertes en temps réel."}</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="w-full sm:w-auto px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-semibold border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 font-sans"
            >
              <Check className="w-3.5 h-3.5" />
              {t("space.notif.markAllRead")}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 border-b border-border/40 pb-px font-sans">
          {[
            { id: 'all' as const, label: t("space.notif.all") || "Toutes", count: notifications.length },
            { id: 'unread' as const, label: t("space.notif.unread") || "Non lues", count: unreadCount }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setNotifFilter(tab.id)}
              className={`pb-3 px-3 text-xs font-semibold relative bg-transparent border-none cursor-pointer transition-all ${
                notifFilter === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    notifFilter === tab.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </span>
              {notifFilter === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3 font-sans">
          {filtered.length === 0 ? (
            <div className="dashboard-card p-12 text-center text-sm text-muted-foreground">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              {t("space.notif.empty")}
            </div>
          ) : (
            filtered.map((notif) => {
              const iconMap = {
                booking: <Calendar className="w-4 h-4" />,
                message: <MessageSquare className="w-4 h-4" />,
                system: <Bell className="w-4 h-4" />
              };
              const colorMap = {
                booking: "bg-blue-50 text-blue-600 border-blue-100",
                message: "bg-teal-50 text-teal-600 border-teal-100",
                system: "bg-amber-50 text-amber-600 border-amber-100"
              };
              return (
                <div
                  key={notif.id}
                  className={`dashboard-card p-4 flex gap-4 items-start relative hover:shadow-md transition-all group ${
                    !notif.is_read ? 'border-l-4 border-l-primary bg-primary/[0.02]' : ''
                  }`}
                >
                  <div className={`p-2.5 rounded-xl border shrink-0 ${colorMap[notif.type] || "bg-gray-50 text-gray-600 border-gray-100"}`}>
                    {iconMap[notif.type] || <Bell className="w-4 h-4" />}
                  </div>

                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={async () => {
                      if (!notif.is_read) {
                        await markAsRead(notif.id);
                      }
                      if (notif.link) {
                        const match = notif.link.match(/page=([^&]+)/);
                        if (match && match[1]) {
                          setActivePage(match[1] as Page);
                        } else {
                          window.location.href = notif.link;
                        }
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(notif.created_at).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                      {!notif.is_read && (
                        <span className="w-2 h-2 bg-primary rounded-full" />
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-foreground mt-1 leading-snug">{notif.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{notif.content}</p>
                  </div>

                  <button
                    onClick={() => deleteNotification(notif.id)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all border-none bg-transparent cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };


  const pageTitle: Record<Page, string> = {
    dashboard: t("space.dashboard"),
    sessions: t("space.nav.sessions"),
    messages: t("space.nav.messages"),
    explore: t("space.nav.explore"),
    forum: t("space.nav.forum"),
    journal: t("space.nav.journal"),
    coping: t("space.nav.coping"),
    profil: t("space.profile"),
    notifications: t("space.notifications"),
  };

  const pageContent: Record<Page, React.ReactNode> = {
    dashboard: <DashboardWrapper render={Dashboard} />,
    sessions: <SessionsWrapper render={Sessions} />,
    messages: <MessagesWrapper render={Messages} />,
    explore: <ExploreWrapper render={ExplorePage} />,
    forum: <ForumWrapper render={ForumPage} />,
    journal: <JournalWrapper render={JournalPage} />,
    coping: <CopingWrapper render={CopingPage} />,
    profil: <ProfilWrapper render={ProfilePage} />,
    notifications: <NotificationsWrapper render={Notifications} />,
  };

  return (
    <div className="flex min-h-screen bg-accent/30">
      {sidebarOpen && <div className="fixed inset-0 bg-foreground/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <Sidebar />
      <main className={`flex-1 ${dir === "rtl" ? "lg:mr-64" : "lg:ml-64"} min-h-screen flex flex-col`}>
        <TopBar title={pageTitle[activePage]} />
        <div className="flex-1 overflow-auto">{pageContent[activePage]}</div>
      </main>
      <LiveAudioModal />
    </div>
  );
}
