import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Calendar, Star, Shield,
  LogOut, Menu, X, Check, XCircle, Crown, Trash2,
  TrendingUp, UserCheck, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Tab = "dashboard" | "users" | "bookings" | "reviews" | "admins";

interface Stats {
  totalPatients: number;
  totalTherapists: number;
  pendingTherapists: number;
  totalBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
}

interface UserProfile {
  user_id: string;
  full_name: string;
  user_type: string;
  approval_status: string;
  is_admin: boolean;
  created_at: string;
  city: string;
  specialty: string;
}

interface Booking {
  id: string;
  booked_at: string;
  status: string;
  patient_id: string;
  psychologist_id: string;
  price: number;
  duration_minutes: number;
  patient_name?: string;
  psychologist_name?: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  patient_id: string;
  psychologist_id: string;
  patient_name?: string;
  psychologist_name?: string;
}

const statusBadge: Record<string, string> = {
  approved:  "bg-teal-50 text-teal-700 border border-teal-200",
  pending:   "bg-amber-50 text-amber-700 border border-amber-200",
  rejected:  "bg-red-50 text-red-600 border border-red-200",
  confirmed: "bg-teal-50 text-teal-700 border border-teal-200",
  cancelled: "bg-red-50 text-red-600 border border-red-200",
  done:      "bg-gray-100 text-gray-600 border border-gray-200",
};

const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Tableau de bord",   icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "users",     label: "Utilisateurs",       icon: <Users className="w-4 h-4" /> },
  { id: "bookings",  label: "Réservations",       icon: <Calendar className="w-4 h-4" /> },
  { id: "reviews",   label: "Avis",               icon: <Star className="w-4 h-4" /> },
  { id: "admins",    label: "Gestion des admins", icon: <Shield className="w-4 h-4" /> },
];

// Enrich a list with patient_name / psychologist_name from profiles
async function enrichWithNames(items: any[], patientField: string, psyField: string) {
  const ids = [...new Set(items.flatMap(i => [i[patientField], i[psyField]]).filter(Boolean))];
  if (ids.length === 0) return items;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", ids);
  const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]));
  return items.map(i => ({
    ...i,
    patient_name:      nameMap.get(i[patientField]) || "Patient",
    psychologist_name: nameMap.get(i[psyField])     || "Thérapeute",
  }));
}

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [tab, setTab]           = useState<Tab>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [users, setUsers]       = useState<UserProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [loading, setLoading]   = useState(false);
  const [userFilter, setUserFilter] = useState<"all" | "patient" | "psychologue" | "pending">("all");

  useEffect(() => {
    setLoading(true);

    if (tab === "dashboard") {
      Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "patient"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "psychologue"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "psychologue").eq("approval_status", "pending"),
        supabase.from("bookings").select("*", { count: "exact", head: true }),
        supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
        supabase.from("bookings").select("price").eq("status", "confirmed"),
      ]).then(([patients, therapists, pending, allB, confirmedB, revenue]) => {
        const totalRevenue = (revenue.data ?? []).reduce((s: number, b: any) => s + (b.price || 0), 0);
        setStats({
          totalPatients:     patients.count   ?? 0,
          totalTherapists:   therapists.count ?? 0,
          pendingTherapists: pending.count    ?? 0,
          totalBookings:     allB.count       ?? 0,
          confirmedBookings: confirmedB.count ?? 0,
          totalRevenue,
        });
      }).catch(() => toast.error("Erreur statistiques"))
        .finally(() => setLoading(false));

    } else if (tab === "users" || tab === "admins") {
      supabase.from("profiles")
        .select("user_id, full_name, user_type, approval_status, is_admin, created_at, city, specialty")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) { toast.error("Erreur utilisateurs"); return; }
          setUsers((data ?? []) as UserProfile[]);
        }).finally(() => setLoading(false));

    } else if (tab === "bookings") {
      supabase.from("bookings")
        .select("id, booked_at, status, duration_minutes, price, patient_id, psychologist_id")
        .order("booked_at", { ascending: false })
        .then(async ({ data, error }) => {
          if (error) { toast.error("Erreur réservations"); return; }
          const enriched = await enrichWithNames(data ?? [], "patient_id", "psychologist_id");
          setBookings(enriched as Booking[]);
        }).finally(() => setLoading(false));

    } else if (tab === "reviews") {
      supabase.from("reviews")
        .select("id, rating, comment, created_at, patient_id, psychologist_id")
        .order("created_at", { ascending: false })
        .then(async ({ data, error }) => {
          if (error) { toast.error("Erreur avis"); return; }
          const enriched = await enrichWithNames(data ?? [], "patient_id", "psychologist_id");
          setReviews(enriched as Review[]);
        }).finally(() => setLoading(false));
    }
  }, [tab]);

  const updateStatus = async (userId: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ approval_status: status }).eq("user_id", userId);
    if (error) { toast.error("Échec de la mise à jour"); return; }
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, approval_status: status } : u));
    toast.success(`Statut mis à jour : ${status}`);

    // Send email notification to therapist
    if (status === 'approved' || status === 'rejected') {
      fetch('/api/admin/notify-therapist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ therapist_id: userId, action: status }),
      }).catch(console.error);
    }
  };

  const toggleAdmin = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_admin: !current }).eq("user_id", userId);
    if (error) { toast.error("Échec admin"); return; }
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_admin: !current } : u));
    toast.success(!current ? "Accès admin accordé" : "Accès admin révoqué");
  };

  const deleteReviewItem = async (id: string) => {
    if (!confirm("Supprimer cet avis définitivement ?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { toast.error("Suppression échouée"); return; }
    setReviews(prev => prev.filter(r => r.id !== id));
    toast.success("Avis supprimé");
  };

  const filteredUsers = users.filter(u => {
    if (userFilter === "pending") return u.user_type === "psychologue" && u.approval_status === "pending";
    if (userFilter === "all") return true;
    return u.user_type === userFilter;
  });

  // ── Sidebar ─────────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col shadow-2xl transition-transform duration-300 md:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="px-6 pt-8 pb-6 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-6 h-6 text-teal-400" />
          <span className="font-bold text-lg tracking-wide">Majal Admin</span>
        </div>
        <p className="text-xs text-gray-400 truncate">{user?.email}</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(item => (
          <button key={item.id} onClick={() => { setTab(item.id); setMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer border-none ${tab === item.id ? "bg-teal-600 text-white" : "text-gray-300 hover:bg-gray-800 bg-transparent"}`}>
            {item.icon} {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <button onClick={() => signOut?.()} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors cursor-pointer border-none bg-transparent">
          <LogOut className="w-4 h-4" /> Déconnexion
        </button>
      </div>
    </aside>
  );

  const StatCard = ({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-5">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );

  const Loader = () => (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Tab Content ──────────────────────────────────────────────────────────────
  const DashboardTab = () => (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Vue d'ensemble</h1>
      {loading ? <Loader /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <StatCard label="Total Patients"     value={stats?.totalPatients ?? 0}     icon={<Users className="w-6 h-6 text-blue-600" />}     color="bg-blue-50" />
          <StatCard label="Psychologues"       value={stats?.totalTherapists ?? 0}   icon={<UserCheck className="w-6 h-6 text-teal-600" />}  color="bg-teal-50" />
          <StatCard label="En attente"         value={stats?.pendingTherapists ?? 0} icon={<AlertCircle className="w-6 h-6 text-amber-600" />} color="bg-amber-50" />
          <StatCard label="Total Réservations" value={stats?.totalBookings ?? 0}     icon={<Calendar className="w-6 h-6 text-purple-600" />} color="bg-purple-50" />
          <StatCard label="Confirmées"         value={stats?.confirmedBookings ?? 0} icon={<TrendingUp className="w-6 h-6 text-green-600" />} color="bg-green-50" />
          <StatCard label="Revenus (DA)"       value={`${(stats?.totalRevenue ?? 0).toLocaleString()} DA`} icon={<Crown className="w-6 h-6 text-yellow-600" />} color="bg-yellow-50" />
        </div>
      )}
    </div>
  );

  const UsersTab = () => (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
        <div className="flex gap-2 flex-wrap">
          {(["all", "patient", "psychologue", "pending"] as const).map(f => (
            <button key={f} onClick={() => setUserFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors ${userFilter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
              {f === "all" ? "Tous" : f === "pending" ? "⏳ En attente" : f === "patient" ? "Patients" : "Psychologues"}
            </button>
          ))}
        </div>
      </div>
      {loading ? <Loader /> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Nom", "Type", "Statut", "Ville", "Actions"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.user_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{u.full_name || "—"} {u.is_admin && <span className="ml-1 text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold">Admin</span>}</td>
                  <td className="px-5 py-3.5 capitalize text-gray-600">{u.user_type === "psychologue" ? "Psy" : "Patient"}</td>
                  <td className="px-5 py-3.5"><span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadge[u.approval_status] || ""}`}>{u.approval_status}</span></td>
                  <td className="px-5 py-3.5 text-gray-500">{u.city || "—"}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {u.user_type === "psychologue" && u.approval_status === "pending" && (
                        <>
                          <button onClick={() => updateStatus(u.user_id, "approved")} className="flex items-center gap-1 text-xs bg-teal-50 text-teal-700 hover:bg-teal-100 px-2 py-1 rounded-lg cursor-pointer border-none transition-colors"><Check className="w-3 h-3" /> Approuver</button>
                          <button onClick={() => updateStatus(u.user_id, "rejected")} className="flex items-center gap-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded-lg cursor-pointer border-none transition-colors"><XCircle className="w-3 h-3" /> Rejeter</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">Aucun utilisateur.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const BookingsTab = () => (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Toutes les Réservations</h1>
      {loading ? <Loader /> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Patient", "Psychologue", "Date", "Durée", "Prix", "Statut"].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{b.patient_name}</td>
                  <td className="px-5 py-3.5 text-gray-600">{b.psychologist_name}</td>
                  <td className="px-5 py-3.5 text-gray-500">{new Date(b.booked_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-5 py-3.5 text-gray-500">{b.duration_minutes} min</td>
                  <td className="px-5 py-3.5 text-gray-500">{b.price ? `${b.price} DA` : "—"}</td>
                  <td className="px-5 py-3.5"><span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadge[b.status] || "bg-gray-100 text-gray-600"}`}>{b.status}</span></td>
                </tr>
              ))}
              {bookings.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Aucune réservation.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const ReviewsTab = () => (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Modération des Avis</h1>
      {loading ? <Loader /> : (
        <div className="grid gap-4">
          {reviews.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 text-sm">{r.patient_name}</span>
                  <span className="text-gray-400 text-xs">→</span>
                  <span className="text-gray-600 text-sm">{r.psychologist_name}</span>
                  <div className="flex ml-2">{Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-3 h-3 ${i < r.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`} />
                  ))}</div>
                </div>
                <p className="text-gray-600 text-sm">{r.comment || <span className="italic text-gray-400">Aucun commentaire</span>}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
              <button onClick={() => deleteReviewItem(r.id)} className="p-2 rounded-xl text-red-400 hover:bg-red-50 cursor-pointer border-none bg-transparent transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {reviews.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">Aucun avis pour l'instant.</div>}
        </div>
      )}
    </div>
  );

  const AdminsTab = () => {
    const allAdmins = users.filter(u => u.is_admin);
    const nonAdmins = users.filter(u => !u.is_admin);
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Gestion des Administrateurs</h1>
        <p className="text-gray-500 text-sm mb-6">Accordez ou révoquez les droits d'administration.</p>
        {loading ? <Loader /> : (
          <>
            <h2 className="font-semibold text-gray-700 mb-3">Administrateurs actuels</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
              {allAdmins.map(u => (
                <div key={u.user_id} className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 last:border-none">
                  <p className="font-medium text-gray-900">{u.full_name || "—"}</p>
                  {u.user_id !== user?.id && (
                    <button onClick={() => toggleAdmin(u.user_id, true)} className="flex items-center gap-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg cursor-pointer border-none transition-colors">
                      <XCircle className="w-3 h-3" /> Révoquer
                    </button>
                  )}
                </div>
              ))}
              {allAdmins.length === 0 && <p className="text-center py-6 text-gray-400 text-sm">Aucun admin.</p>}
            </div>
            <h2 className="font-semibold text-gray-700 mb-3">Accorder les droits d'administration</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {nonAdmins.map(u => (
                <div key={u.user_id} className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 last:border-none">
                  <div>
                    <p className="font-medium text-gray-900">{u.full_name || "—"}</p>
                    <p className="text-xs text-gray-500 capitalize">{u.user_type}</p>
                  </div>
                  <button onClick={() => toggleAdmin(u.user_id, false)} className="flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 py-1.5 rounded-lg cursor-pointer border-none transition-colors">
                    <Crown className="w-3 h-3" /> Nommer Admin
                  </button>
                </div>
              ))}
              {nonAdmins.length === 0 && <p className="text-center py-6 text-gray-400 text-sm">Aucun utilisateur non-admin.</p>}
            </div>
          </>
        )}
      </div>
    );
  };

  const tabMap: Record<Tab, React.ReactNode> = {
    dashboard: <DashboardTab />,
    users:     <UsersTab />,
    bookings:  <BookingsTab />,
    reviews:   <ReviewsTab />,
    admins:    <AdminsTab />,
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Sidebar />
      {menuOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMenuOpen(false)} />}
      <div className="md:ml-64">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <button className="md:hidden p-2 rounded-xl hover:bg-gray-100 cursor-pointer border-none bg-transparent" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-600" />
            <span className="font-semibold text-gray-800">{navItems.find(n => n.id === tab)?.label}</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
            {user?.email?.[0]?.toUpperCase()}
          </div>
        </header>
        <main className="p-6 max-w-6xl mx-auto">{tabMap[tab]}</main>
      </div>
    </div>
  );
}
