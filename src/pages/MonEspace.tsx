import { useState, useEffect } from "react";
import {
  LayoutDashboard, Calendar, Search, User, Bell, LogOut,
  Menu, X, Clock, Check, Video, MessageSquare, ChevronRight,
  Loader2, TrendingUp, Heart, Lock,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ChatWindow from "@/components/ChatWindow";
import { getInitials } from "@/lib/utils";

type Page = "dashboard" | "sessions" | "messages" | "profil" | "notifications";

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard",     label: "Tableau de bord",  icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "sessions",      label: "Mes séances",       icon: <Calendar className="w-4 h-4" /> },
  { id: "messages",      label: "Messages",          icon: <MessageSquare className="w-4 h-4" /> },
  { id: "profil",        label: "Mon profil",        icon: <User className="w-4 h-4" /> },
  { id: "notifications", label: "Notifications",     icon: <Bell className="w-4 h-4" /> },
];

interface Booking {
  id: string;
  booked_at: string;
  status: "pending" | "confirmed" | "cancelled" | "done";
  duration_minutes: number;
  price: number | null;
  psychologist_id: string;
  psychologist_name?: string;
}

interface Profile {
  full_name: string;
  phone: string;
  language: string;
  avatar_url?: string;
}

export default function MonEspace() {
  const { user, signOut } = useAuth();
  const { t, lang, dir } = useLanguage();
  const navigate = useNavigate();
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
      const { data } = await supabase.from("bookings").select("id, booked_at, status, duration_minutes, price, psychologist_id")
        .eq("patient_id", user.id).order("booked_at", { ascending: true });
        
      const all: Booking[] = data ? (data as Booking[]) : [];
      
      // Fetch psychologist names
      if (all.length > 0) {
        const psyIds = [...new Set(all.map(b => b.psychologist_id))];
        const { data: psyProfiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", psyIds);
        
        all.forEach(b => {
          const p = psyProfiles?.find(x => x.user_id === b.psychologist_id);
          b.psychologist_name = p?.full_name || "Un Psychologue";
        });
      }

      const now = new Date().toISOString();
      setUpcoming(all.filter(b => (b.status === "pending" || b.status === "confirmed") && b.booked_at >= now));
      setPast(all.filter(b => b.status === "done" || b.status === "cancelled" || b.booked_at < now)
        .sort((a, b) => new Date(b.booked_at).getTime() - new Date(a.booked_at).getTime()));
      setBookingsLoading(false);
    };
    fetchB();
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
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    setCancelling(null);
    if (error) {
      toast.error("Erreur lors de l'annulation.");
    } else {
      toast.success("✅ Séance annulée.");
      const cancelledBooking = upcoming.find(b => b.id === id);
      if (cancelledBooking) {
        setUpcoming(prev => prev.filter(b => b.id !== id));
        setPast(prev => [{ ...cancelledBooking, status: "cancelled" as const }, ...prev].sort((a, b) => new Date(b.booked_at).getTime() - new Date(a.booked_at).getTime()));
      }
    }
  };

  const fmt  = (iso: string) => new Date(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  const fmtT = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const initials = getInitials(profile.full_name || user?.email || "?");

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-border flex flex-col transform transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary rounded-lg flex items-center justify-center font-serif text-[13px] text-primary">MJ</div>
            <span className="text-sm font-semibold text-foreground">Majal</span>
          </div>
          <span className="text-[10px] text-primary font-semibold tracking-wider mt-0.5 block">MON ESPACE</span>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map(item => (
            <li key={item.id}>
              <button
                onClick={() => { setActivePage(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-transparent border-none cursor-pointer ${activePage === item.id ? "bg-teal-pale text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
          <li className="pt-2">
            <Link
              to="/psychologues"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors no-underline"
            >
              <Search className="w-4 h-4" />
              Trouver un psychologue
            </Link>
          </li>
        </ul>
      </nav>

      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{profile.full_name || user?.email}</p>
            <p className="text-xs text-muted-foreground">Patient</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors bg-transparent border-none cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );

  const TopBar = ({ title }: { title: string }) => (
    <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-border px-6 py-4 flex items-center gap-3">
      <button onClick={() => setSidebarOpen(true)} className="lg:hidden bg-transparent border-none cursor-pointer text-foreground">
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="font-semibold text-lg text-foreground">{title}</h1>
    </div>
  );

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const Dashboard = () => (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-foreground">
          Bonjour{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Bienvenue dans votre espace personnel Majal.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: <Calendar className="w-5 h-5" />, color: "text-primary bg-teal-pale",   label: "Séances totales",   value: upcoming.length + past.filter(b => b.status === "done").length },
          { icon: <Clock className="w-5 h-5" />,    color: "text-blue-700 bg-blue-50",    label: "Heures de thérapie", value: `${Math.round(past.filter(b=>b.status==="done").reduce((s,b)=>s+b.duration_minutes,0)/60)}h` },
          { icon: <Heart className="w-5 h-5" />,    color: "text-rose-600 bg-rose-50",    label: "Séances à venir",   value: upcoming.length },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl shadow-card p-5 flex items-start gap-4">
            <div className={`p-2.5 rounded-xl ${s.color}`}>{s.icon}</div>
            <div>
              <div className="font-serif text-2xl text-foreground leading-none">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-foreground">Prochaines séances</h3>
          <button onClick={() => setActivePage("sessions")} className="text-primary text-sm flex items-center gap-1 bg-transparent border-none cursor-pointer hover:underline">
            Voir tout <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {bookingsLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : upcoming.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune séance à venir.</p>
            <Link to="/psychologues" className="inline-block mt-3 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium no-underline hover:bg-teal-mid transition-colors">
              Réserver une séance
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.slice(0, 3).map(b => (
              <div key={b.id} className="flex items-center gap-4 p-4 border border-border rounded-xl hover:border-primary/40 hover:bg-teal-hero transition-all">
                <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-xl shrink-0">👩‍⚕️</div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-foreground">Séance réservée</div>
                  <div className="text-xs text-muted-foreground">{fmt(b.booked_at)} · {fmtT(b.booked_at)}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => window.open(`https://app.daily.co/majal-demo-room`, "_blank")} className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors">
                    <Video className="w-3.5 h-3.5" /> Rejoindre
                  </button>
                  <button
                    onClick={() => handleCancelBooking(b.id)}
                    disabled={cancelling === b.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-destructive/30 text-destructive bg-transparent rounded-lg text-xs font-medium cursor-pointer hover:bg-destructive/5 transition-colors disabled:opacity-50"
                  >
                    {cancelling === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    {t("space.cancel")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA to find a psy */}
      <div className="bg-gradient-to-br from-teal-cta to-teal-light rounded-xl p-7 text-center">
        <TrendingUp className="w-8 h-8 text-primary-foreground mx-auto mb-3 opacity-80" />
        <h3 className="font-serif text-xl text-primary-foreground mb-1">{t("space.continuePath")}</h3>
        <p className="text-sm text-primary-foreground/80 mb-5">{t("space.findPsySubtitle")}</p>
        <Link to="/psychologues" className="inline-block px-7 py-3 bg-card text-primary rounded-full text-sm font-semibold no-underline hover:-translate-y-0.5 hover:shadow-card-hover transition-all">
          {t("space.findPsyBtn")}
        </Link>
      </div>
    </div>
  );

  // ── Sessions ──────────────────────────────────────────────────────────────
  const Sessions = () => (
    <div className="p-6 space-y-6">
      {/* Upcoming */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="font-semibold text-foreground mb-5">{t("space.upcomingSessionsCount")} ({upcoming.length})</h3>
        {bookingsLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        : upcoming.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-4">{t("space.noSessionsPlanned")}</p>
            <Link to="/psychologues" className="inline-block px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium no-underline hover:bg-teal-mid transition-colors">
              {t("space.bookSession")}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {upcoming.map(b => (
              <div key={b.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <div className="w-12 h-12 rounded-full bg-teal-pale flex items-center justify-center text-2xl shrink-0">👩‍⚕️</div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-foreground">{t("space.sessionLabel")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{fmt(b.booked_at)} · {fmtT(b.booked_at)} · {b.duration_minutes} {t("space.minutesLabel")}</div>
                  {b.price && <div className="text-xs text-muted-foreground">{b.price.toLocaleString()} {t("space.priceCurrency")}</div>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${b.status === "confirmed" ? "bg-teal-pale text-primary" : "bg-amber-50 text-amber-700"}`}>
                    {b.status === "confirmed" ? t("space.status.confirmed") : t("space.status.pending")}
                  </span>
                  <button 
                    onClick={() => handleCancelBooking(b.id)}
                    disabled={cancelling === b.id}
                    className="text-xs text-destructive bg-transparent border-none cursor-pointer hover:underline disabled:opacity-50 flex items-center gap-1"
                  >
                    {cancelling === b.id ? <Loader2 className="w-3 h-3 animate-spin"/> : null} 
                    {t("space.cancelSessionBtn")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="font-semibold text-foreground mb-5">{t("space.historyCount")} ({past.length})</h3>
        {bookingsLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        : past.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">{t("space.noHistory")}</p>
        ) : (
          <div className="relative pl-8">
            <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-border" />
            {past.map((b) => {
              const done = b.status === "done";
              return (
                <div key={b.id} className="relative mb-5 last:mb-0">
                  <div className={`absolute -left-8 top-4 w-7 h-7 rounded-full flex items-center justify-center z-10 border-2 ${done ? "bg-primary border-primary text-primary-foreground" : "bg-destructive/10 border-destructive text-destructive"}`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`bg-card rounded-xl p-4 flex items-center gap-4 ms-3 border-s-4 shadow-card ${done ? "border-s-primary" : "border-s-destructive"}`}>
                    <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-xl shrink-0">👩‍⚕️</div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-foreground">{t("space.sessionLabel")}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{fmt(b.booked_at)} · {fmtT(b.booked_at)}</div>
                    </div>
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${done ? "bg-teal-pale text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {done ? t("space.status.done") : t("space.status.cancelled")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ── Messages ───────────────────────────────────────────────────────────────
  const Messages = () => {
    const allBookings = [...upcoming, ...past];
    const uniqueTherapists = Array.from(new Map(allBookings.map(b => [b.psychologist_id, b.psychologist_name])).entries());

    return (
      <div className="flex h-[calc(100vh-80px)]">
        <div className="w-[300px] border-r border-border bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">{t("space.discussionsTitle")}</h3>
          </div>
          <div className="flex-1 overflow-auto">
            {uniqueTherapists.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground mt-8 px-4">{t("space.noTherapistsMessage")}</p>
            ) : (
              uniqueTherapists.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => { setActiveChatUserId(id); setActiveChatUserName(name || t("space.defaultTherapistName")); }}
                  className={`w-full text-left px-4 py-3 border-b flex items-center gap-3 transition-colors border-none cursor-pointer ${activeChatUserId === id ? "bg-teal-pale" : "hover:bg-accent bg-transparent"}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl shrink-0">
                    👨‍⚕️
                  </div>
                  <div className="font-medium text-sm text-foreground truncate">{name}</div>
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
    <div className="p-6 max-w-xl">
      <div className="bg-card rounded-xl shadow-card p-7 mb-5">
        <div className="flex items-center gap-4 mb-7 pb-6 border-b border-border">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full object-cover border border-border shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-teal-pale flex items-center justify-center text-primary text-2xl font-bold shrink-0">{initials}</div>
          )}
          <div>
            <div className="font-semibold text-foreground">{profile.full_name || t("space.yourName")}</div>
            <div className="text-sm text-muted-foreground font-sans">{user?.email}</div>
            <div className="mt-2">
              <label htmlFor="avatar-upload" className="text-xs font-medium text-primary hover:underline cursor-pointer">
                {uploadingAvatar ? "Upload..." : "Changer la photo"}
              </label>
              <input type="file" id="avatar-upload" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} className="hidden" />
            </div>
          </div>
        </div>
        <h3 className="font-semibold text-foreground mb-5">{t("space.personalInfo")}</h3>
        {profileLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{t("space.fullName")}</label>
              <input type="text" value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                className="px-4 py-3 border border-border rounded-[10px] text-[15px] bg-teal-hero outline-none focus:border-teal-light focus:bg-card transition-colors font-sans" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{t("auth.email")}</label>
              <input type="email" value={user?.email ?? ""} readOnly
                className="px-4 py-3 border border-border rounded-[10px] text-[15px] bg-teal-hero opacity-60 cursor-not-allowed font-sans" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{t("space.phone")}</label>
              <input type="tel" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                className="px-4 py-3 border border-border rounded-[10px] text-[15px] bg-teal-hero outline-none focus:border-teal-light focus:bg-card transition-colors font-sans" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{t("space.language")}</label>
              <select value={profile.language} onChange={e => setProfile(p => ({ ...p, language: e.target.value }))}
                className="px-4 py-3 border border-border rounded-[10px] text-[15px] bg-teal-hero outline-none focus:border-teal-light focus:bg-card transition-colors font-sans cursor-pointer">
                <option>{t("space.lang.french")}</option><option>{t("space.lang.arabic")}</option><option>{t("space.lang.english")}</option>
              </select>
            </div>
          </div>
        )}
      </div>
      <button onClick={saveProfile} disabled={saving}
        className="w-full py-4 rounded-xl bg-primary text-primary-foreground text-base font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors disabled:opacity-70 flex items-center justify-center gap-2 font-sans">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? t("space.saving") : t("space.save")}
      </button>

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

  // ── Notifications ─────────────────────────────────────────────────────────
  const Notifications = () => (
    <div className="p-6 max-w-xl">
      <div className="bg-card rounded-xl shadow-card p-7">
        <h3 className="font-semibold text-foreground mb-5">{t("space.notifPreferences")}</h3>
        {[
          { title: t("space.notif.remindersTitle"), desc: t("space.notif.remindersDesc"), checked: true },
          { title: t("space.notif.confirmTitle"), desc: t("space.notif.confirmDesc"), checked: true },
          { title: t("space.notif.smsTitle"), desc: t("space.notif.smsDesc"), checked: false },
          { title: t("space.notif.offersTitle"), desc: t("space.notif.offersDesc"), checked: false },
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
        <button className="mt-5 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors font-sans"
          onClick={() => toast.success(t("space.notif.successSave"))}>
          {t("space.notif.save")}
        </button>
      </div>
    </div>
  );

  const pageTitle: Record<Page, string> = {
    dashboard: t("space.dashboard"), sessions: t("space.nav.sessions"),
    messages: t("space.nav.messages"),
    profil: t("space.profile"), notifications: t("space.notifications"),
  };

  const pageContent: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard />, sessions: <Sessions />, messages: <Messages />,
    profil: <ProfilePage />, notifications: <Notifications />,
  };

  return (
    <div className="flex min-h-screen bg-accent/30">
      {sidebarOpen && <div className="fixed inset-0 bg-foreground/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <Sidebar />
      <main className={`flex-1 ${dir === "rtl" ? "lg:mr-64" : "lg:ml-64"} min-h-screen flex flex-col`}>
        <TopBar title={pageTitle[activePage]} />
        <div className="flex-1 overflow-auto">{pageContent[activePage]}</div>
      </main>
    </div>
  );
}
