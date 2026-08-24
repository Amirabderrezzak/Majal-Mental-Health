import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getInitials } from "@/lib/utils";

import PatientSidebar, { type Page } from "@/components/pages/PatientSidebar";
import PatientTopBar from "@/components/pages/PatientTopBar";
import PatientDashboard from "@/components/pages/PatientDashboard";
import PatientSessions from "@/components/pages/PatientSessions";
import PatientMessages from "@/components/pages/PatientMessages";
import ExplorePage from "@/components/pages/ExplorePage";
import ForumPage from "@/components/pages/ForumPage";
import JournalPage from "@/components/pages/JournalPage";
import CopingPage from "@/components/pages/CopingPage";
import PatientProfilePage from "@/components/pages/PatientProfilePage";
import PatientNotifications from "@/components/pages/PatientNotifications";

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

export default function MonEspace() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { t, lang, dir } = useLanguage();
  const { isSupported: pushSupported, preferenceEnabled: pushSubscribed, loading: pushLoading, togglePreference: pushToggle } = usePushNotifications(user?.id ?? null);
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [profile, setProfile] = useState<Profile>({ full_name: "", phone: "", language: "Français", avatar_url: "" });
  const [profileLoading, setProfileLoading] = useState(true);

  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [past, setPast] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [activeChatUserName, setActiveChatUserName] = useState<string>("");

  const [wellnessStreak, setWellnessStreak] = useState(5);
  const [unlockedBadges, setUnlockedBadges] = useState<{ id: string; name: string; emoji: string; desc: string }[]>([]);

  const locale = lang === "ar" ? "ar-SA" : "fr-FR";
  const fmt  = (iso: string) => new Date(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  const fmtT = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

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
    const storedStreak = localStorage.getItem(`majal_streak_${user.id}`);
    if (storedStreak) {
      setWellnessStreak(parseInt(storedStreak));
    } else {
      localStorage.setItem(`majal_streak_${user.id}`, "5");
    }
    setUnlockedBadges([
      { id: "1", name: t("space.badge.pioneer"), emoji: "🌱", desc: t("space.badge.pioneerDesc") },
      { id: "2", name: t("space.badge.zen"), emoji: "🧘", desc: t("space.badge.zenDesc") },
      { id: "3", name: t("space.badge.explorer"), emoji: "🗺️", desc: t("space.badge.explorerDesc") }
    ]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchB = async () => {
      const { data } = await (supabase as any).from("bookings").select("id, booked_at, status, duration_minutes, price, psychologist_id, video_room_url")
        .eq("patient_id", user.id).order("booked_at", { ascending: true });

      const all: Booking[] = data ? (data as Booking[]) : [];

      if (all.length > 0) {
        const psyIds = [...new Set(all.map(b => b.psychologist_id))];
        const { data: psyProfiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url, specialty").in("user_id", psyIds);

        all.forEach(b => {
          const p = psyProfiles?.find(x => x.user_id === b.psychologist_id);
          b.psychologist_name = p?.full_name || t("space.defaultPsy");
          b.psychologist_avatar = p?.avatar_url || undefined;
          b.psychologist_specialty = p?.specialty || undefined;
        });
      }

      const now = new Date();
      setUpcoming(all.filter(b => {
        // Only show confirmed bookings to the patient. A "pending" row is a
        // reservation awaiting payment confirmation and must not appear as a
        // real booking until the gateway verifies payment.
        const isActiveStatus = b.status === "confirmed";
        const sessionEndTime = new Date(new Date(b.booked_at).getTime() + b.duration_minutes * 60 * 1000);
        return isActiveStatus && sessionEndTime >= now;
      }));
      setPast(all.filter(b => {
        const isPastOrCancelledStatus = b.status === "done" || b.status === "cancelled" || b.status === "no-show";
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

  const handleCancelBooking = async (id: string) => {
    setCancelling(id);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const response = await fetch("/api/bookings?action=update-status", {
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
        toast.error(data.error || t("space.toast.cancelError"));
      } else {
        toast.success(t("space.toast.cancelled"));
        const cancelledBooking = upcoming.find(b => b.id === id);
        if (cancelledBooking) {
          setUpcoming(prev => prev.filter(b => b.id !== id));
          setPast(prev => [{ ...cancelledBooking, status: "cancelled" as const }, ...prev].sort((a, b) => new Date(b.booked_at).getTime() - new Date(a.booked_at).getTime()));
        }
      }
    } catch (err) {
      setCancelling(null);
      toast.error(t("space.toast.cancelError"));
    }
  };

  const handleReschedule = async (booking: Booking, date: string, time: string) => {
    if (!booking || !date || !time) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const newDateTime = new Date(`${date}T${time}:00`).toISOString();

    try {
      const response = await fetch("/api/bookings?action=reschedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          booking_id: booking.id,
          new_booked_at: newDateTime
        })
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        toast.error(data.error || t("space.toast.rescheduleError"));
      } else {
        toast.success(t("space.toast.rescheduled"));
        setUpcoming(prev => prev.map(b =>
          b.id === booking.id
            ? { ...b, booked_at: newDateTime }
            : b
        ));
      }
    } catch (err) {
      toast.error(t("space.toast.rescheduleError"));
    }
  };

  // ── Deep-link: ?page=messages&psy=<id>&name=<name> from a profile ───────────
  useEffect(() => {
    if (!user) return;
    const page = searchParams.get("page");
    if (page !== "messages") return;
    setActivePage("messages");
    const psy = searchParams.get("psy");
    if (psy) {
      setActiveChatUserId(psy);
      const decodedName = searchParams.get("name");
      setActiveChatUserName(decodedName ? decodeURIComponent(decodedName) : t("prof.defaultName"));
    }
  }, [user, searchParams]);

  const initials = getInitials(profile.full_name || user?.email || "?");

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

  const renderPage = () => {
    switch (activePage) {
      case "dashboard": return (
        <PatientDashboard
          profile={profile}
          upcoming={upcoming}
          past={past}
                cancelling={cancelling}
          bookingsLoading={bookingsLoading}
          wellnessStreak={wellnessStreak}
          unlockedBadges={unlockedBadges}
          handleCancelBooking={handleCancelBooking}
          setActivePage={setActivePage}
          fmt={fmt}
          fmtT={fmtT}
          getSessionTimeState={getSessionTimeState}
          formatTimeUntil={formatTimeUntil}
          getInitials={getInitials}
        />
      );
      case "sessions": return (
        <PatientSessions
          upcoming={upcoming}
          past={past}
                cancelling={cancelling}
          bookingsLoading={bookingsLoading}
          handleCancelBooking={handleCancelBooking}
          handleReschedule={handleReschedule}
          locale={locale}
          fmt={fmt}
          fmtT={fmtT}
          getInitials={getInitials}
        />
      );
      case "messages": return (
        <PatientMessages
          upcoming={upcoming}
          past={past}
          activeChatUserId={activeChatUserId}
          setActiveChatUserId={setActiveChatUserId}
          activeChatUserName={activeChatUserName}
          setActiveChatUserName={setActiveChatUserName}
          getInitials={getInitials}
        />
      );
      case "explore": return <ExplorePage />;
      case "forum": return <ForumPage />;
      case "journal": return <JournalPage />;
      case "coping": return <CopingPage />;
      case "profil": return (
        <PatientProfilePage
          profile={profile}
          setProfile={setProfile}
          profileLoading={profileLoading}
          initials={initials}
          pushSupported={pushSupported}
          pushSubscribed={pushSubscribed}
          pushLoading={pushLoading}
          pushToggle={pushToggle}
        />
      );
      case "notifications": return <PatientNotifications setActivePage={setActivePage} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && <div className="fixed inset-0 bg-foreground/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <PatientSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activePage={activePage}
        setActivePage={setActivePage}
        profile={profile}
        initials={initials}
      />
      <main className={`flex-1 ${dir === "rtl" ? "lg:mr-64" : "lg:ml-64"} min-h-screen flex flex-col`}>
        <PatientTopBar title={pageTitle[activePage]} setSidebarOpen={setSidebarOpen} />
        <div className="flex-1 overflow-auto">{renderPage()}</div>
      </main>
    </div>
  );
}
