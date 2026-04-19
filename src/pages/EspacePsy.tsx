import { useState, useEffect } from "react";
import {
  LayoutDashboard, Calendar, Users, MessageSquare, DollarSign,
  User, Settings, Menu, X, LogOut, Bell, Check, Clock, TrendingUp,
  ChevronRight, MoreHorizontal, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  psyProfile, statsData, todaySessions, notifications, recentPatients, weeklyEarnings
} from "../data/psyData";
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

const navItems: { id: Page; label: string; icon: React.ReactNode; badge?: number }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "sessions", label: "Sessions", icon: <Calendar className="w-4 h-4" /> },
  { id: "patients", label: "Patients", icon: <Users className="w-4 h-4" /> },
  { id: "messages", label: "Messages", icon: <MessageSquare className="w-4 h-4" />, badge: 2 },
  { id: "earnings", label: "Revenus", icon: <DollarSign className="w-4 h-4" /> },
  { id: "profile", label: "Mon profil", icon: <User className="w-4 h-4" /> },
  { id: "settings", label: "Paramètres", icon: <Settings className="w-4 h-4" /> },
];

const statusColors = {
  confirmed: "bg-teal-pale text-primary",
  pending: "bg-amber-50 text-amber-700",
  done: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-50 text-red-600",
};

const statusLabels = {
  confirmed: "Confirmée",
  pending: "En attente",
  done: "Terminée",
  cancelled: "Annulée",
};

const patientStatusColors = {
  improving: "bg-teal-pale text-primary",
  stable: "bg-blue-50 text-blue-700",
  "needs-attention": "bg-amber-50 text-amber-700",
};

const patientStatusLabels = {
  improving: "En progrès",
  stable: "Stable",
  "needs-attention": "Attention requise",
};

const maxEarning = Math.max(...weeklyEarnings.map((e) => e.amount));

export default function EspacePsy() {
  const { user, signOut } = useAuth();
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Live Bookings State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [activeChatUserName, setActiveChatUserName] = useState<string>("");

  // Profile form state
  const [profileData, setProfileData] = useState({
    full_name: psyProfile.name,
    specialty: psyProfile.specialty,
    bio: "",
    city: "",
    price_per_session: 3500,
    years_experience: 8,
    phone: "",
  });

  // Fetch real profile data
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, specialty, bio, city, price_per_session, years_experience, phone")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfileData({
            full_name: data.full_name ?? psyProfile.name,
            specialty: data.specialty ?? psyProfile.specialty,
            bio: data.bio ?? "",
            city: data.city ?? "",
            price_per_session: data.price_per_session ?? 3500,
            years_experience: data.years_experience ?? 8,
            phone: data.phone ?? "",
          });
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
      toast.error("Erreur lors de la sauvegarde.");
    } else {
      toast.success("✅ Profil mis à jour !");
    }
  };

  const updateBookingStatus = async (id: string, newStatus: Booking["status"]) => {
    setUpdating(id);
    const { error } = await supabase.from("bookings").update({ status: newStatus }).eq("id", id);
    setUpdating(null);
    if (error) {
      toast.error("Erreur de mise à jour.");
    } else {
      toast.success("Statut mis à jour !");
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

  const Sidebar = () => (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-border flex flex-col transform transition-transform duration-300 ${
      sidebarOpen ? "translate-x-0" : "-translate-x-full"
    } lg:translate-x-0`}>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary rounded-lg flex items-center justify-center font-serif text-[13px] text-primary">MJ</div>
            <span className="text-sm font-semibold text-foreground">Majal</span>
          </div>
          <span className="text-[10px] text-primary font-semibold tracking-wider mt-0.5 block">ESPACE PSY</span>
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
          Déconnexion
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
        <h2 className="font-serif text-2xl text-foreground">Bonjour, {profileData.full_name.split(" ")[0]} 👋</h2>
        <p className="text-muted-foreground text-sm mt-1">Voici un aperçu de votre activité aujourd'hui</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Patients total", value: statsData.totalPatients, icon: <Users className="w-5 h-5" />, color: "text-primary bg-teal-pale" },
          { label: "Sessions ce mois", value: statsData.sessionsThisMonth, icon: <Calendar className="w-5 h-5" />, color: "text-blue-700 bg-blue-50" },
          { label: "Revenus (DA)", value: `${(statsData.earningsThisMonth / 1000).toFixed(0)}k`, icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-700 bg-emerald-50" },
          { label: "À venir", value: statsData.upcomingSessions, icon: <Clock className="w-5 h-5" />, color: "text-amber-700 bg-amber-50" },
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
            <h3 className="font-semibold text-foreground">Sessions à venir</h3>
            <button onClick={() => setActivePage("sessions")} className="text-primary text-sm flex items-center gap-1 bg-transparent border-none cursor-pointer hover:underline">
              Voir tout <ChevronRight className="w-3.5 h-3.5" />
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
              <div className="text-sm text-muted-foreground text-center py-4">Aucune session à venir</div>
            )}
          </div>
        </div>

        {/* Weekly earnings chart */}
        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="font-semibold text-foreground mb-5">Revenus cette semaine</h3>
          <div className="flex items-end gap-2 h-36">
            {weeklyEarnings.map((e) => (
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
            <div className="text-xs text-muted-foreground">Total cette semaine</div>
            <div className="font-serif text-xl text-primary">
              {weeklyEarnings.reduce((s, e) => s + e.amount, 0).toLocaleString()} DA
            </div>
          </div>
        </div>
      </div>

      {/* Recent patients */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-foreground">Patients récents</h3>
          <button onClick={() => setActivePage("patients")} className="text-primary text-sm flex items-center gap-1 bg-transparent border-none cursor-pointer hover:underline">
            Voir tout <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-3">
          {recentPatients.map((p) => (
            <div key={p.id} className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-teal-pale flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                {p.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-foreground">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.sessions} séances · Vu {p.lastSeen.toLowerCase()}</div>
              </div>
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium shrink-0 ${patientStatusColors[p.status]}`}>
                {patientStatusLabels[p.status]}
              </span>
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
          <h3 className="font-semibold text-foreground">Toutes les sessions</h3>
          <span className="text-sm text-muted-foreground">{bookings.length} sessions</span>
        </div>
        <div className="divide-y divide-border">
          {bookingsLoading ? <div className="py-8 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-primary"/></div> :
           bookings.length === 0 ? <p className="text-muted-foreground text-center py-6 text-sm">Aucune session trouvée.</p> :
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
                    <button onClick={() => updateBookingStatus(s.id, "confirmed")} disabled={updating === s.id} className="bg-teal-pale text-primary border-none rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:bg-teal-mid disabled:opacity-50">Confirmer</button>
                    <button onClick={() => updateBookingStatus(s.id, "cancelled")} disabled={updating === s.id} className="bg-red-50 text-red-600 border-none rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:bg-red-100 disabled:opacity-50">Refuser</button>
                  </>
                )}
                {s.status === "confirmed" && (
                  <>
                    <button onClick={() => window.open(`https://app.daily.co/majal-demo-room`, "_blank")} className="bg-primary text-primary-foreground border-none rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:bg-teal-mid">Démarrer vidéo</button>
                    <button onClick={() => updateBookingStatus(s.id, "done")} disabled={updating === s.id} className="bg-gray-100 text-gray-700 border-none rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:bg-gray-200 disabled:opacity-50">Marquer terminé</button>
                    <button onClick={() => updateBookingStatus(s.id, "cancelled")} disabled={updating === s.id} className="bg-red-50 text-red-600 border-none rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:bg-red-100 disabled:opacity-50">Annuler</button>
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
          <h3 className="font-semibold text-foreground">Mes patients ({statsData.totalPatients})</h3>
        </div>
        <div className="divide-y divide-border">
          {[...recentPatients, ...recentPatients, ...recentPatients].slice(0, 12).map((p, i) => (
            <div key={`${p.id}-${i}`} className="flex items-center gap-4 px-5 py-4 hover:bg-teal-hero transition-colors">
              <div className="w-10 h-10 rounded-full bg-teal-pale flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                {p.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-foreground">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.sessions} séances · Dernière visite {p.lastSeen.toLowerCase()}</div>
              </div>
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium shrink-0 ${patientStatusColors[p.status]}`}>
                {patientStatusLabels[p.status]}
              </span>
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
            <h3 className="font-semibold text-foreground">Conversations</h3>
          </div>
          <div className="flex-1 overflow-auto">
            {uniquePatients.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground mt-8">Aucun patient</p>
            ) : (
              uniquePatients.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => { setActiveChatUserId(id); setActiveChatUserName(name || "Patient"); }}
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
              <p className="text-sm">Sélectionnez un patient pour démarrer la conversation</p>
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
          { label: "Revenus ce mois", value: `${(statsData.earningsThisMonth / 1000).toFixed(0)} 000 DA`, sub: "+12% vs mois dernier" },
          { label: "Paiements en attente", value: `${(statsData.pendingPayments / 1000).toFixed(0)} 000 DA`, sub: `${Math.round(statsData.pendingPayments / 3200)} sessions` },
          { label: "Revenu moyen / session", value: `${Math.round(statsData.earningsThisMonth / statsData.sessionsThisMonth).toLocaleString()} DA`, sub: `${statsData.sessionsThisMonth} sessions ce mois` },
        ].map((c) => (
          <div key={c.label} className="bg-card rounded-xl shadow-card p-6">
            <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
            <div className="font-serif text-2xl text-foreground">{c.value}</div>
            <div className="text-xs text-primary mt-1">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="font-semibold text-foreground mb-5">Revenus par jour (cette semaine)</h3>
        <div className="flex items-end gap-3 h-48">
          {weeklyEarnings.map((e) => (
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
          <h3 className="font-semibold text-foreground">Transactions récentes</h3>
        </div>
        <div className="divide-y divide-border">
          {todaySessions.filter((s) => s.status === "confirmed").map((s, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm text-foreground">{s.patientName}</div>
                <div className="text-xs text-muted-foreground">{s.type}</div>
              </div>
              <div className="text-sm font-semibold text-emerald-600">+3 200 DA</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Profile Editor ─────────────────────────────────────────────────────────
  const ProfileEditor = () => (
    <div className="p-6 max-w-2xl">
      <div className="bg-card rounded-xl shadow-card p-7 mb-5">
        <h3 className="font-semibold text-foreground mb-5">Informations profesionnelles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            { label: "Nom complet", key: "full_name", type: "text" },
            { label: "Téléphone", key: "phone", type: "tel" },
            { label: "Spécialité", key: "specialty", type: "text" },
            { label: "Ville", key: "city", type: "text" },
            { label: "Tarif / séance (DA)", key: "price_per_session", type: "number" },
            { label: "Années d'expérience", key: "years_experience", type: "number" },
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
          <label className="text-[13px] font-medium text-muted-foreground block mb-1.5">Biographie</label>
          <textarea
            value={profileData.bio}
            onChange={(e) => setProfileData((p) => ({ ...p, bio: e.target.value }))}
            rows={4}
            placeholder="Décrivez votre approche thérapeutique, votre formation et vos domaines d'expertise..."
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
        Enregistrer les modifications
      </button>
    </div>
  );

  // ── Settings ───────────────────────────────────────────────────────────────
  const SettingsPage = () => (
    <div className="p-6 max-w-2xl">
      <div className="bg-card rounded-xl shadow-card p-7">
        <h3 className="font-semibold text-foreground mb-5">Notifications</h3>
        {[
          { title: "Nouvelles réservations", desc: "Soyez notifié des nouvelles réservations par email", checked: true },
          { title: "Rappels de sessions", desc: "Recevez un rappel 1h avant chaque session", checked: true },
          { title: "Messages patients", desc: "Notification pour les nouveaux messages", checked: false },
          { title: "Paiements reçus", desc: "Notification de paiement et confirmation", checked: true },
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
        <h3 className="font-semibold text-foreground mb-5">Sécurité</h3>
        <button className="text-sm text-primary hover:underline bg-transparent border-none cursor-pointer p-0">
          Changer mon mot de passe
        </button>
      </div>
    </div>
  );

  const pageTitle: Record<Page, string> = {
    dashboard: "Tableau de bord",
    sessions: "Sessions",
    patients: "Patients",
    messages: "Messages",
    earnings: "Revenus",
    profile: "Mon profil",
    settings: "Paramètres",
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

      <main className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        <TopBar title={pageTitle[activePage]} />
        <div className="flex-1 overflow-auto">
          {pageContent[activePage]}
        </div>
      </main>
    </div>
  );
}
