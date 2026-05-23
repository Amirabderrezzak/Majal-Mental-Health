import { useState, useEffect } from "react";
import {
  LayoutDashboard, Calendar, Users, MessageSquare, DollarSign,
  User, Settings, Menu, X, LogOut, Bell, Check, Clock, TrendingUp,
  ChevronRight, MoreHorizontal, Loader2, Lock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ChatWindow from "@/components/ChatWindow";

type Page = "dashboard" | "sessions" | "patients" | "messages" | "earnings" | "profile" | "settings";

interface Booking {
  id: string;
  booked_at: string;
  status: "pending" | "confirmed" | "cancelled" | "done";
  duration_minutes: number;
  patient_id: string;
  patient_name?: string;
  price?: number;
}

const statusColors = {
  confirmed: "bg-teal-pale text-primary",
  pending: "bg-amber-50 text-amber-700",
  done: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-50 text-red-600",
};



export default function EspacePsy() {
  const { user, signOut } = useAuth();
  const { t, dir } = useLanguage();
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const [approvalStatus, setApprovalStatus] = useState<string>("approved");

  // Live Bookings State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [activeChatUserName, setActiveChatUserName] = useState<string>("");

  // Profile form state
  const [profileData, setProfileData] = useState({
    full_name: "",
    specialty: "",
    bio: "",
    city: "",
    price_per_session: 3000,
    years_experience: 0,
    phone: "",
    avatar_url: "",
  });
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

      setProfileData((p) => ({ ...p, avatar_url: publicUrl }));
      toast.success("✅ Photo de profil mise à jour !");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error(err.message || "Erreur lors de l'upload de l'avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Fetch real profile data
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, specialty, bio, city, price_per_session, years_experience, phone, approval_status, avatar_url")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfileData({
            full_name: data.full_name ?? "",
            specialty: data.specialty ?? "",
            bio: data.bio ?? "",
            city: data.city ?? "",
            price_per_session: data.price_per_session ?? 3000,
            years_experience: data.years_experience ?? 0,
            phone: data.phone ?? "",
            avatar_url: data.avatar_url ?? "",
          });
          if (data.approval_status) {
            setApprovalStatus(data.approval_status);
          }
        }
      });
  }, [user]);

  // Fetch real bookings
  useEffect(() => {
    if (!user) return;
    const fetchBookings = async () => {
      setBookingsLoading(true);
      const { data: bData } = await supabase
        .from("bookings")
        .select("id, booked_at, status, duration_minutes, patient_id, price")
        .eq("psychologist_id", user.id)
        .order("booked_at", { ascending: true });
        
      if (bData && bData.length > 0) {
        const patientIds = [...new Set(bData.map((b) => b.patient_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", patientIds);
          
        const mapped = bData.map((b) => {
          const profile = profiles?.find((p) => p.user_id === b.patient_id);
          return {
            ...b,
            patient_name: profile?.full_name || "Patient",
          } as Booking;
        });
        setBookings(mapped);
      }
      setBookingsLoading(false);
    };
    fetchBookings();
  }, [user]);

  // ── Derived real-time stats from bookings ──────────────────────────────────
  const nowIso = new Date().toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const upcomingBookings = bookings.filter(
    b => (b.status === "pending" || b.status === "confirmed") && b.booked_at >= nowIso
  );
  const totalUniquePatients = new Set(bookings.map(b => b.patient_id)).size;
  const sessionsThisMonth = bookings.filter(b => b.booked_at >= monthStart).length;
  const earningsThisMonth = bookings
    .filter(b => (b.status === "confirmed" || b.status === "done") && b.booked_at >= monthStart)
    .reduce((sum, b) => sum + (b.price || 0), 0);
  const pendingPayments = bookings
    .filter(b => b.status === "pending")
    .reduce((sum, b) => sum + (b.price || 0), 0);

  const dayLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const realWeeklyEarnings = dayLabels.map((day, i) => ({
    day,
    amount: bookings
      .filter(b => {
        const d = new Date(b.booked_at);
        return d.getDay() === i && b.booked_at >= weekAgo &&
          (b.status === "confirmed" || b.status === "done");
      })
      .reduce((sum, b) => sum + (b.price || 0), 0),
  }));
  const maxEarning = Math.max(...realWeeklyEarnings.map(e => e.amount), 0);

  const patientMap = new Map<string, { name: string; sessions: number; lastSeen: string }>();
  bookings.forEach(b => {
    const ex = patientMap.get(b.patient_id);
    if (!ex) {
      patientMap.set(b.patient_id, { name: b.patient_name || "Patient", sessions: 1, lastSeen: b.booked_at });
    } else {
      ex.sessions++;
      if (b.booked_at > ex.lastSeen) ex.lastSeen = b.booked_at;
    }
  });
  const realPatients = Array.from(patientMap.entries()).map(([id, d]) => ({
    id,
    name: d.name,
    initials: d.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
    sessions: d.sessions,
    lastSeen: new Date(d.lastSeen).toLocaleDateString("fr-FR"),
  }));

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        ...profileData,
      });
    setSaving(false);
    if (error) {
      toast.error(t("space.errorSave"));
    } else {
      toast.success(t("space.successSave"));
    }
  };

  const updateBookingStatus = async (id: string, newStatus: Booking["status"]) => {
    setUpdating(id);
    const { error } = await supabase.from("bookings").update({ status: newStatus }).eq("id", id);
    setUpdating(null);
    if (error) {
      toast.error(t("space.errorUpdate"));
    } else {
      toast.success(t("space.successUpdate"));
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
      );
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "P";
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const initials = profileData.full_name
    ? profileData.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "AB";

  const navItems: { id: Page; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "dashboard", label: t("psy.dashboard.nav.dashboard"), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "sessions",  label: t("psy.dashboard.nav.sessions"),  icon: <Calendar className="w-4 h-4" /> },
    { id: "patients",  label: t("psy.dashboard.nav.patients"),  icon: <Users className="w-4 h-4" /> },
    { id: "messages",  label: t("psy.dashboard.nav.messages"),  icon: <MessageSquare className="w-4 h-4" />, badge: 2 },
    { id: "earnings",  label: t("psy.dashboard.nav.earnings"),  icon: <DollarSign className="w-4 h-4" /> },
    { id: "profile",   label: t("psy.dashboard.nav.profile"),   icon: <User className="w-4 h-4" /> },
    { id: "settings",  label: t("psy.dashboard.nav.settings"),  icon: <Settings className="w-4 h-4" /> },
  ];

  const statusLabels: Record<string, string> = {
    confirmed: t("space.status.confirmed"),
    pending:   t("space.status.pending"),
    done:      t("space.status.done"),
    cancelled: t("space.status.cancelled"),
  };

  const Sidebar = () => (
    <aside className={`fixed inset-y-0 z-50 w-64 bg-white flex flex-col transform transition-transform duration-300 ${dir === "rtl" ? "right-0 border-l" : "left-0 border-r"} border-border ${
      sidebarOpen ? "translate-x-0" : (dir === "rtl" ? "translate-x-full" : "-translate-x-full")
    } lg:translate-x-0`}>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary rounded-lg flex items-center justify-center font-serif text-[13px] text-primary">MJ</div>
            <span className="text-sm font-semibold text-foreground">Majal</span>
          </div>
          <span className="text-[10px] text-primary font-semibold tracking-wider mt-0.5 block">{t("psy.dashboard.spaceTitle").toUpperCase()}</span>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => { setActivePage(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-transparent border-none cursor-pointer ${
                  activePage === item.id
                    ? "bg-teal-pale text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {item.icon}
                {item.label}
                {item.badge && (
                  <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Profile footer */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{profileData.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{profileData.specialty}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors bg-transparent border-none cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          {t("nav.logout")}
        </button>
      </div>
    </aside>
  );

  const TopBar = ({ title }: { title: string }) => (
    <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden bg-transparent border-none cursor-pointer text-foreground"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">2</span>
        </button>
      </div>
    </div>
  );

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const Dashboard = () => (
    <div className="p-6 space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="font-serif text-2xl text-foreground">{t("psy.dashboard.welcome")}, {profileData.full_name.split(" ")[0]} 👋</h2>
        <p className="text-muted-foreground text-sm mt-1">{t("psy.dashboard.welcomeSub")}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("psy.dashboard.stat.totalPatients"),   value: totalUniquePatients,                                                              icon: <Users className="w-5 h-5" />,     color: "text-primary bg-teal-pale" },
          { label: t("psy.dashboard.stat.sessionsMonth"),   value: sessionsThisMonth,                                                                icon: <Calendar className="w-5 h-5" />,  color: "text-blue-700 bg-blue-50" },
          { label: t("psy.dashboard.stat.earnings"),        value: earningsThisMonth > 0 ? `${(earningsThisMonth / 1000).toFixed(0)}k` : "0",       icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-700 bg-emerald-50" },
          { label: t("psy.dashboard.stat.upcoming"),        value: upcomingBookings.length,                                                         icon: <Clock className="w-5 h-5" />,     color: "text-amber-700 bg-amber-50" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl shadow-card p-5 flex items-start gap-4">
            <div className={`p-2.5 rounded-xl ${stat.color}`}>{stat.icon}</div>
            <div>
              <div className="font-serif text-2xl text-foreground leading-none">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="bg-card rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-foreground">{t("psy.dashboard.upcomingSessions")}</h3>
            <button onClick={() => setActivePage("sessions")} className="text-primary text-sm flex items-center gap-1 bg-transparent border-none cursor-pointer hover:underline">
              {t("space.viewAll")} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {bookingsLoading ? <div className="py-4 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-primary"/></div> : 
             bookings.filter(b => b.status === "confirmed" || b.status === "pending").slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-4 border border-border rounded-xl hover:border-primary/40 hover:bg-teal-hero transition-all">
                <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                  {getInitials(s.patient_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground">{s.patient_name}</div>
                  <div className="text-xs text-muted-foreground">{s.duration_minutes} min</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-sm text-foreground">{new Date(s.booked_at).toLocaleTimeString("fr-FR", {hour: '2-digit', minute:'2-digit'})}</div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColors[s.status]}`}>
                    {statusLabels[s.status]}
                  </span>
                </div>
              </div>
            ))}
            {bookings.length === 0 && !bookingsLoading && (
              <div className="text-sm text-muted-foreground text-center py-4">{t("psy.dashboard.noUpcoming")}</div>
            )}
          </div>
        </div>

        {/* Weekly earnings chart */}
        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="font-semibold text-foreground mb-5">{t("psy.dashboard.weeklyEarnings")}</h3>
          <div className="flex items-end gap-2 h-36">
            {realWeeklyEarnings.map((e) => (
              <div key={e.day} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-t-md bg-primary/20 relative"
                  style={{ height: `${maxEarning > 0 ? (e.amount / maxEarning) * 100 : 0}%` }}
                >
                  {e.amount > 0 && (
                    <div className="absolute inset-0 bg-primary rounded-t-md opacity-80" />
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">{e.day}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground">{t("psy.dashboard.weekTotal")}</div>
            <div className="font-serif text-xl text-primary">
              {realWeeklyEarnings.reduce((s, e) => s + e.amount, 0).toLocaleString()} DA
            </div>
          </div>
        </div>
      </div>

      {/* Recent patients */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-foreground">{t("psy.dashboard.recentPatients")}</h3>
          <button onClick={() => setActivePage("patients")} className="text-primary text-sm flex items-center gap-1 bg-transparent border-none cursor-pointer hover:underline">
            {t("space.viewAll")} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-3">
          {realPatients.length === 0 && !bookingsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("psy.dashboard.noPatients")}</p>
          ) : realPatients.slice(0, 4).map((p) => (
            <div key={p.id} className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-teal-pale flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                {p.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-foreground">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.sessions} {t("psy.dashboard.sessionCount")} · {t("psy.dashboard.lastVisit")} {p.lastSeen}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const Sessions = () => (
    <div className="p-6">
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{t("psy.dashboard.allSessions")}</h3>
          <span className="text-sm text-muted-foreground">{bookings.length} {t("psy.dashboard.nav.sessions")}</span>
        </div>
        <div className="divide-y divide-border">
          {bookingsLoading ? <div className="py-8 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-primary"/></div> :
           bookings.length === 0 ? <p className="text-muted-foreground text-center py-6 text-sm">{t("psy.dashboard.noSessions")}</p> :
           bookings.map((s) => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-teal-hero transition-colors flex-wrap">
              <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                {getInitials(s.patient_name)}
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium text-sm text-foreground">{s.patient_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(s.booked_at).toLocaleDateString("fr-FR")} · {s.duration_minutes} min</div>
              </div>
              <div className="text-sm text-foreground w-16 text-center font-medium mr-4">
                {new Date(s.booked_at).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
              </div>
              
              <div className="flex gap-2">
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${statusColors[s.status]}`}>
                  {statusLabels[s.status]}
                </span>
                
                {s.status === "pending" && (
                  <>
                    <button onClick={() => updateBookingStatus(s.id, "confirmed")} disabled={updating === s.id} className="bg-teal-pale text-primary border-none rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:bg-teal-mid disabled:opacity-50">{t("psy.dashboard.confirm")}</button>
                    <button onClick={() => updateBookingStatus(s.id, "cancelled")} disabled={updating === s.id} className="bg-red-50 text-red-600 border-none rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:bg-red-100 disabled:opacity-50">{t("psy.dashboard.reject")}</button>
                  </>
                )}
                {s.status === "confirmed" && (
                  <>
                    <button onClick={() => window.open(`https://app.daily.co/majal-demo-room`, "_blank")} className="bg-primary text-primary-foreground border-none rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:bg-teal-mid">{t("psy.dashboard.startVideo")}</button>
                    <button onClick={() => updateBookingStatus(s.id, "done")} disabled={updating === s.id} className="bg-gray-100 text-gray-700 border-none rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:bg-gray-200 disabled:opacity-50">{t("psy.dashboard.markDone")}</button>
                    <button onClick={() => updateBookingStatus(s.id, "cancelled")} disabled={updating === s.id} className="bg-red-50 text-red-600 border-none rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:bg-red-100 disabled:opacity-50">{t("space.cancel")}</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Patients ───────────────────────────────────────────────────────────────
  const Patients = () => (
    <div className="p-6">
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">{t("psy.dashboard.myPatients")} ({realPatients.length})</h3>
        </div>
        <div className="divide-y divide-border">
          {bookingsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : realPatients.length === 0 ? (
            <p className="text-center py-10 text-sm text-muted-foreground">{t("psy.dashboard.noPatients")}</p>
          ) : realPatients.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-teal-hero transition-colors">
              <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                {p.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-foreground">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.sessions} {t("psy.dashboard.sessionCount")} · {t("psy.dashboard.lastVisit")} {p.lastSeen}</div>
              </div>
              <button className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Messages ───────────────────────────────────────────────────────────────
  const Messages = () => {
    // Unique patients from all bookings
    const uniquePatients = Array.from(new Map(bookings.map(b => [b.patient_id, b.patient_name])).entries());

    return (
      <div className="flex h-full min-h-[500px]">
        {/* Contact List */}
        <div className="w-1/3 border-r border-border bg-white flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">{t("space.discussionsTitle")}</h3>
          </div>
          <div className="flex-1 overflow-auto">
            {uniquePatients.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground mt-8">{t("psy.dashboard.noPatients")}</p>
            ) : (
              uniquePatients.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => { setActiveChatUserId(id); setActiveChatUserName(name || t("psy.dashboard.defaultPatientName")); }}
                  className={`w-full text-left px-4 py-3 border-b flex items-center gap-3 transition-colors border-none cursor-pointer ${activeChatUserId === id ? "bg-teal-pale" : "hover:bg-accent bg-transparent"}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                    {getInitials(name)}
                  </div>
                  <div className="font-medium text-sm text-foreground truncate">{name}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-accent/10">
          {activeChatUserId ? (
            <ChatWindow otherUserId={activeChatUserId} otherUserName={activeChatUserName} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">{t("psy.dashboard.selectPatientMsg")}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Earnings ───────────────────────────────────────────────────────────────
  const Earnings = () => (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t("psy.earnings.thisMonth"),    value: `${earningsThisMonth.toLocaleString()} DA`,                                                              sub: `${sessionsThisMonth} ${t("psy.earnings.sessionsMonth")}` },
          { label: t("psy.earnings.pending"),       value: `${pendingPayments.toLocaleString()} DA`,                                                               sub: `${bookings.filter(b => b.status === "pending").length} ${t("psy.earnings.sessionsPending")}` },
          { label: t("psy.earnings.avgPerSession"), value: sessionsThisMonth > 0 ? `${Math.round(earningsThisMonth / sessionsThisMonth).toLocaleString()} DA` : "—", sub: `${sessionsThisMonth} ${t("psy.earnings.sessionsMonth")}` },
        ].map((c) => (
          <div key={c.label} className="bg-card rounded-xl shadow-card p-6">
            <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
            <div className="font-serif text-2xl text-foreground">{c.value}</div>
            <div className="text-xs text-primary mt-1">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="font-semibold text-foreground mb-5">{t("psy.earnings.dailyChart")}</h3>
        <div className="flex items-end gap-3 h-48">
          {realWeeklyEarnings.map((e) => (
            <div key={e.day} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs text-muted-foreground">{e.amount > 0 ? `${(e.amount / 1000).toFixed(1)}k` : ""}</span>
              <div
                className="w-full rounded-t-lg bg-primary/20 relative min-h-[4px]"
                style={{ height: `${maxEarning > 0 ? (e.amount / maxEarning) * 160 : 4}px` }}
              >
                <div className="absolute inset-0 bg-primary rounded-t-lg" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{e.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">{t("psy.earnings.recentTx")}</h3>
        </div>
        <div className="divide-y divide-border">
          {bookings.filter(b => b.status === "confirmed" || b.status === "done").slice(0, 10).map((b) => (
            <div key={b.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm text-foreground">{b.patient_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(b.booked_at).toLocaleDateString("fr-FR")}</div>
              </div>
              <div className="text-sm font-semibold text-emerald-600">+{(b.price || 0).toLocaleString()} DA</div>
            </div>
          ))}
          {bookings.filter(b => b.status === "confirmed" || b.status === "done").length === 0 && (
            <p className="text-center py-8 text-sm text-muted-foreground">{t("psy.earnings.noTx")}</p>
          )}
        </div>
      </div>
    </div>
  );

  // ── Profile Editor ─────────────────────────────────────────────────────────
  const ProfileEditor = () => (
    <div className="p-6 max-w-2xl">
      <div className="bg-card rounded-xl shadow-card p-7 mb-5">
        <h3 className="font-semibold text-foreground mb-5">{t("psy.dashboard.profile.professionalInfo")}</h3>

        {/* Avatar Upload */}
        <div className="flex items-center gap-5 mb-6 pb-6 border-b border-border">
          {profileData.avatar_url ? (
            <img
              src={profileData.avatar_url}
              alt="Avatar"
              className="w-20 h-20 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-teal-pale flex items-center justify-center text-primary text-3xl font-bold">
              {profileData.full_name ? profileData.full_name.charAt(0).toUpperCase() : "P"}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="avatar-upload" className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-teal-mid transition-colors cursor-pointer inline-block text-center border-none">
              {uploadingAvatar ? "Upload..." : "Changer la photo"}
            </label>
            <input
              type="file"
              id="avatar-upload"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
              className="hidden"
            />
            <span className="text-[12px] text-muted-foreground">Formats acceptés : JPG, PNG, WEBP (max 5 Mo)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            { label: t("space.fullName"),                      key: "full_name",        type: "text" },
            { label: t("space.phone"),                         key: "phone",            type: "tel" },
            { label: t("auth.specialtyLabel"),                 key: "specialty",        type: "text" },
            { label: t("auth.cityLabel"),                      key: "city",             type: "text" },
            { label: t("complete.step1.price"),                key: "price_per_session",type: "number" },
            { label: t("psy.dashboard.profile.yearsExperience"), key: "years_experience", type: "number" },
          ] as const).map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{f.label}</label>
              <input
                type={f.type}
                value={profileData[f.key]}
                onChange={(e) => setProfileData((p) => ({ ...p, [f.key]: f.type === "number" ? parseInt(e.target.value) || 0 : e.target.value }))}
                className="px-4 py-3 border border-border rounded-[10px] text-[15px] text-foreground bg-teal-hero outline-none focus:border-teal-light focus:bg-card font-sans transition-colors"
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-[13px] font-medium text-muted-foreground block mb-1.5">{t("psy.dashboard.profile.bio")}</label>
          <textarea
            value={profileData.bio}
            onChange={(e) => setProfileData((p) => ({ ...p, bio: e.target.value }))}
            rows={4}
            placeholder={t("psy.dashboard.profile.bioPlaceholder")}
            className="w-full px-4 py-3 border border-border rounded-[10px] text-[15px] text-foreground bg-teal-hero outline-none focus:border-teal-light focus:bg-card font-sans transition-colors resize-none"
          />
        </div>
      </div>

      <button
        onClick={saveProfile}
        disabled={saving}
        className="w-full py-4 rounded-xl bg-primary text-primary-foreground text-base font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors disabled:opacity-70 flex items-center justify-center gap-2 font-sans"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? t("space.saving") : t("space.save")}
      </button>
    </div>
  );

  // ── Settings ───────────────────────────────────────────────────────────────
  const SettingsPage = () => (
    <div className="p-6 max-w-2xl">
      <div className="bg-card rounded-xl shadow-card p-7">
        <h3 className="font-semibold text-foreground mb-5">{t("space.notifPreferences")}</h3>
        {[
          { title: t("psy.settings.notif.newBookingsTitle"), desc: t("psy.settings.notif.newBookingsDesc"), checked: true },
          { title: t("psy.settings.notif.remindersTitle"),   desc: t("psy.settings.notif.remindersDesc"),   checked: true },
          { title: t("psy.settings.notif.messagesTitle"),    desc: t("psy.settings.notif.messagesDesc"),    checked: false },
          { title: t("psy.settings.notif.paymentsTitle"),    desc: t("psy.settings.notif.paymentsDesc"),    checked: true },
        ].map((n, i, arr) => (
          <div key={i} className={`flex items-center justify-between py-4 ${i < arr.length - 1 ? "border-b border-border" : ""}`}>
            <div>
              <h4 className="text-[15px] font-medium font-sans text-foreground">{n.title}</h4>
              <p className="text-[13px] text-muted-foreground mt-0.5">{n.desc}</p>
            </div>
            <label className="relative w-12 h-[26px] shrink-0">
              <input type="checkbox" defaultChecked={n.checked} className="opacity-0 w-0 h-0" />
              <span className="toggle-slider" />
            </label>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl shadow-card p-7 mt-5">
        <h3 className="font-semibold text-foreground mb-5">{t("psy.settings.security") || "Sécurité"}</h3>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-3 max-w-sm">
          <label className="text-[13px] font-medium text-muted-foreground">{t("reset.newPassword") || "Nouveau mot de passe"}</label>
          <div className="flex items-center gap-2.5 border border-border rounded-xl px-4 py-2.5 bg-teal-hero focus-within:border-teal-light focus-within:bg-card transition-colors">
            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="border-none bg-transparent outline-none text-[15px] text-foreground w-full placeholder:text-muted-foreground font-sans"
            />
          </div>
          <button
            type="submit"
            disabled={changingPassword}
            className="w-full sm:w-auto self-start px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors disabled:opacity-50 mt-1 font-sans"
          >
            {changingPassword ? "Mise à jour..." : t("psy.settings.changePassword") || "Changer le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );

  const pageTitle: Record<Page, string> = {
    dashboard: t("psy.dashboard.nav.dashboard"),
    sessions:  t("psy.dashboard.nav.sessions"),
    patients:  t("psy.dashboard.nav.patients"),
    messages:  t("psy.dashboard.nav.messages"),
    earnings:  t("psy.dashboard.nav.earnings"),
    profile:   t("psy.dashboard.nav.profile"),
    settings:  t("psy.dashboard.nav.settings"),
  };

  const pageContent: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard />,
    sessions: <Sessions />,
    patients: <Patients />,
    messages: <Messages />,
    earnings: <Earnings />,
    profile: <ProfileEditor />,
    settings: <SettingsPage />,
  };

  return (
    <div className="flex min-h-screen bg-accent/30">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar />

      <main className={`flex-1 ${dir === "rtl" ? "lg:mr-64" : "lg:ml-64"} min-h-screen flex flex-col`}>
        <TopBar title={pageTitle[activePage]} />

        {/* Verification Status Banner */}
        {approvalStatus === "pending" && (
          <div className="mx-6 mt-6 p-4 rounded-xl border border-amber-200/50 bg-amber-50/60 backdrop-blur-md shadow-sm flex items-start gap-3.5 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-2 rounded-lg bg-amber-100/80 text-amber-700 shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-amber-900">{t("psy.dashboard.pendingTitle")}</h4>
              <p className="text-xs text-amber-800/85 mt-0.5 leading-relaxed">
                {t("psy.dashboard.pendingDesc")}
              </p>
            </div>
          </div>
        )}
        {approvalStatus === "rejected" && (
          <div className="mx-6 mt-6 p-4 rounded-xl border border-red-200/50 bg-red-50/60 backdrop-blur-md shadow-sm flex items-start gap-3.5 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-2 rounded-lg bg-red-100/80 text-red-700 shrink-0">
              <X className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-red-900">{t("psy.dashboard.rejectedTitle")}</h4>
              <p className="text-xs text-red-800/85 mt-0.5 leading-relaxed">
                {t("psy.dashboard.rejectedDesc")}
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {pageContent[activePage]}
        </div>
      </main>
    </div>
  );
}
