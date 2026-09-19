import { useEscapeKey } from "@/lib/a11y";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Calendar, Star, Shield,
  LogOut, Menu, X, Check, XCircle, Crown, Trash2,
  TrendingUp, UserCheck, AlertCircle, Ban,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

type Tab = "dashboard" | "users" | "bookings" | "reviews" | "admins" | "cancellations";

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
  approved:  "bg-teal-pale text-primary border border-primary/20",
  pending:   "bg-warning/10 text-warning border border-warning/30",
  rejected:  "bg-destructive/10 text-destructive border border-destructive/30",
  confirmed: "bg-teal-pale text-primary border border-primary/20",
  cancelled: "bg-destructive/10 text-destructive border border-destructive/30",
  done:      "bg-muted text-muted-foreground border border-border",
  "no-show": "bg-warning/10 text-warning border border-warning/30",
};

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

// Static tab wrappers defined outside to prevent React from unmounting/remounting child components on parent re-renders
const DashboardTabWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const UsersTabWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const BookingsTabWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const ReviewsTabWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const AdminsTabWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;
const CancellationsTabWrapper = ({ render }: { render: () => React.ReactNode }) => <>{render()}</>;

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const { t, dir } = useLanguage();
  const rtl = dir === "rtl";
  const [tab, setTab]           = useState<Tab>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [users, setUsers]       = useState<UserProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [loading, setLoading]   = useState(false);
  const [userFilter, setUserFilter] = useState<"all" | "patient" | "psychologue" | "pending">("all");

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard",     label: t("admin.nav.dashboard"),     icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "users",         label: t("admin.nav.users"),         icon: <Users className="w-4 h-4" /> },
    { id: "bookings",      label: t("admin.nav.bookings"),      icon: <Calendar className="w-4 h-4" /> },
    { id: "cancellations", label: t("admin.nav.cancellations"), icon: <Ban className="w-4 h-4" /> },
    { id: "reviews",       label: t("admin.nav.reviews"),       icon: <Star className="w-4 h-4" /> },
    { id: "admins",        label: t("admin.nav.admins"),        icon: <Shield className="w-4 h-4" /> },
  ];

  useEffect(() => {
    setLoading(true);

    const fetchData = async () => {
      try {
        if (tab === "dashboard") {
          const [patients, therapists, pending, allB, confirmedB, revenue] = await Promise.all([
            supabase.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "patient"),
            supabase.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "psychologue"),
            supabase.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "psychologue").eq("approval_status", "pending"),
            supabase.from("bookings").select("*", { count: "exact", head: true }),
            supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
            supabase.from("bookings").select("price").eq("status", "confirmed"),
          ]);
          
          const totalRevenue = (revenue.data ?? []).reduce((s: number, b: any) => s + (b.price || 0), 0);
          setStats({
            totalPatients:     patients.count   ?? 0,
            totalTherapists:   therapists.count ?? 0,
            pendingTherapists: pending.count    ?? 0,
            totalBookings:     allB.count       ?? 0,
            confirmedBookings: confirmedB.count ?? 0,
            totalRevenue,
          });
        } else if (tab === "users" || tab === "admins") {
          const { data, error } = await supabase.from("profiles")
            .select("user_id, full_name, user_type, approval_status, is_admin, created_at, city, specialty")
            .order("created_at", { ascending: false });
          if (error) { toast.error(t("admin.toast.errorUsers")); return; }
          setUsers((data ?? []) as UserProfile[]);
        } else if (tab === "bookings") {
          const { data, error } = await supabase.from("bookings")
            .select("id, booked_at, status, duration_minutes, price, patient_id, psychologist_id")
            .order("booked_at", { ascending: false });
          if (error) { toast.error(t("admin.toast.errorBookings")); return; }
          const enriched = await enrichWithNames(data ?? [], "patient_id", "psychologist_id");
          setBookings(enriched as Booking[]);
        } else if (tab === "reviews") {
          const { data, error } = await supabase.from("reviews")
            .select("id, rating, comment, created_at, patient_id, psychologist_id")
            .order("created_at", { ascending: false });
          if (error) { toast.error(t("admin.toast.errorReviews")); return; }
          const enriched = await enrichWithNames(data ?? [], "patient_id", "psychologist_id");
          setReviews(enriched as Review[]);
        } else if (tab === "cancellations") {
          const { data, error } = await supabase.from("bookings")
            .select("id, booked_at, status, duration_minutes, price, patient_id, psychologist_id")
            .in("status", ["cancelled", "no-show"])
            .order("booked_at", { ascending: false });
          if (error) { toast.error(t("admin.toast.errorCancellations")); return; }
          const enriched = await enrichWithNames(data ?? [], "patient_id", "psychologist_id");
          setBookings(enriched as Booking[]);
        }
      } catch (err) {
        console.error(err);
        if (tab === "dashboard") {
          toast.error(t("admin.toast.errorStats"));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tab]);

  const updateStatus = async (userId: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ approval_status: status }).eq("user_id", userId);
    if (error) { toast.error(t("admin.toast.updateFailed")); return; }
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, approval_status: status } : u));
    toast.success(`${t("admin.toast.statusUpdated")} : ${status}`);

    // Send email notification to therapist
    if (status === 'approved' || status === 'rejected') {
      fetch('/api/admin?action=notify-therapist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ therapist_id: userId, action: status }),
      }).catch(console.error);
    }
  };

  const toggleAdmin = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_admin: !current }).eq("user_id", userId);
    if (error) { toast.error(t("admin.toast.adminFailed")); return; }
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_admin: !current } : u));
    toast.success(t(!current ? "admin.toggleAdmin.granted" : "admin.toggleAdmin.revoked"));
  };

  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  useEscapeKey(reviewToDelete !== null, () => setReviewToDelete(null));

  const deleteReviewItem = async (id: string) => {
    setReviewToDelete(null);
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { toast.error(t("admin.toast.deleteFailed")); return; }
    setReviews(prev => prev.filter(r => r.id !== id));
    toast.success(t("admin.toast.reviewDeleted"));
  };

  const filteredUsers = users.filter(u => {
    if (userFilter === "pending") return u.user_type === "psychologue" && u.approval_status === "pending";
    if (userFilter === "all") return true;
    return u.user_type === userFilter;
  });

  // ── Sidebar ─────────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside className={`fixed inset-y-0 ${rtl ? "right-0" : "left-0"} z-50 w-64 bg-card text-foreground flex flex-col shadow-overlay border-e border-border transition-transform duration-300 md:translate-x-0 ${menuOpen ? "translate-x-0" : (rtl ? "translate-x-full" : "-translate-x-full")}`}>
      <div className="px-6 pt-8 pb-6 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-6 h-6 text-teal-light" />
          <span className="font-bold text-lg tracking-wide">Majal Admin</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(item => (
          <button key={item.id} onClick={() => { setTab(item.id); setMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer border-none ${tab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent bg-transparent"}`}>
            {item.icon} {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <button onClick={() => signOut?.()} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-accent hover:text-destructive transition-colors cursor-pointer border-none bg-transparent">
          <LogOut className="w-4 h-4" /> {t("admin.logout")}
        </button>
      </div>
    </aside>
  );

  const StatCard = ({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-border flex items-center gap-5">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );

  const Loader = () => (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Tab Content ──────────────────────────────────────────────────────────────
  const DashboardTab = () => (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">{t("admin.dashboard.title")}</h1>
      {loading ? <Loader /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <StatCard label={t("admin.stat.totalPatients")}     value={stats?.totalPatients ?? 0}     icon={<Users className="w-6 h-6 text-primary" />}     color="bg-teal-pale" />
          <StatCard label={t("admin.stat.therapists")}       value={stats?.totalTherapists ?? 0}   icon={<UserCheck className="w-6 h-6 text-primary" />}  color="bg-teal-pale" />
          <StatCard label={t("admin.stat.pending")}         value={stats?.pendingTherapists ?? 0} icon={<AlertCircle className="w-6 h-6 text-warning" />} color="bg-warning/10" />
          <StatCard label={t("admin.stat.totalBookings")} value={stats?.totalBookings ?? 0}     icon={<Calendar className="w-6 h-6 text-primary" />} color="bg-teal-pale" />
          <StatCard label={t("admin.stat.confirmed")}         value={stats?.confirmedBookings ?? 0} icon={<TrendingUp className="w-6 h-6 text-success" />} color="bg-success/10" />
          <StatCard label={t("admin.stat.revenue")}       value={`⁦${(stats?.totalRevenue ?? 0).toLocaleString()} DA⁩`} icon={<Crown className="w-6 h-6 text-warning" />} color="bg-warning/10" />
        </div>
      )}
    </div>
  );

  const UsersTab = () => (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("admin.users.title")}</h1>
        <div className="flex gap-2 flex-wrap">
          {(["all", "patient", "psychologue", "pending"] as const).map(f => (
            <button key={f} onClick={() => setUserFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors ${userFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border hover:border-border"}`}>
              {f === "all" ? t("admin.users.filter.all") : f === "pending" ? t("admin.users.filter.pending") : f === "patient" ? t("admin.users.filter.patient") : t("admin.users.filter.psychologue")}
            </button>
          ))}
        </div>
      </div>
      {loading ? <Loader /> : (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background border-b border-border">
              <tr>{[t("admin.users.col.name"), t("admin.users.col.type"), t("admin.users.col.status"), t("admin.users.col.city"), t("admin.users.col.actions")].map(h => (
                <th key={h} className="text-start px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.user_id} className="border-b border-border hover:bg-background transition-colors">
                  <td className="px-5 py-3.5 font-medium text-foreground">{u.full_name || "—"} {u.is_admin && <span className="ms-1 text-[10px] bg-teal-pale text-primary px-1.5 py-0.5 rounded-full font-semibold">Admin</span>}</td>
                  <td className="px-5 py-3.5 capitalize text-muted-foreground">{u.user_type === "psychologue" ? t("admin.users.typePsy") : t("admin.users.typePatient")}</td>
                  <td className="px-5 py-3.5"><span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadge[u.approval_status] || ""}`}>{u.approval_status}</span></td>
                  <td className="px-5 py-3.5 text-muted-foreground">{u.city || "—"}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {u.user_type === "psychologue" && u.approval_status === "pending" && (
                        <>
                          <button onClick={() => updateStatus(u.user_id, "approved")} className="flex items-center gap-1 text-xs bg-teal-pale text-primary hover:bg-teal-pale px-2 py-1 rounded-lg cursor-pointer border-none transition-colors"><Check className="w-3 h-3" /> {t("admin.users.approve")}</button>
                          <button onClick={() => updateStatus(u.user_id, "rejected")} className="flex items-center gap-1 text-xs bg-destructive/10 text-destructive hover:bg-destructive/10 px-2 py-1 rounded-lg cursor-pointer border-none transition-colors"><XCircle className="w-3 h-3" /> {t("admin.users.reject")}</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">{t("admin.users.empty")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const BookingsTab = () => (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">{t("admin.bookings.title")}</h1>
      {loading ? <Loader /> : (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background border-b border-border">
              <tr>{[t("admin.bookings.col.patient"), t("admin.bookings.col.psy"), t("admin.bookings.col.date"), t("admin.bookings.col.duration"), t("admin.bookings.col.price"), t("admin.bookings.col.status")].map(h => (
                <th key={h} className="text-start px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="border-b border-border hover:bg-background transition-colors">
                  <td className="px-5 py-3.5 font-medium text-foreground">{b.patient_name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{b.psychologist_name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{new Date(b.booked_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{b.duration_minutes} min</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{b.price ? `${b.price} DA` : "—"}</td>
                  <td className="px-5 py-3.5"><span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadge[b.status] || "bg-muted text-muted-foreground"}`}>{b.status}</span></td>
                </tr>
              ))}
              {bookings.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">{t("admin.bookings.empty")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const CancellationsTab = () => {
    const cancelled = bookings.filter(b => b.status === "cancelled");
    const noShows = bookings.filter(b => b.status === "no-show");
    const totalLost = bookings.reduce((s, b) => s + (b.price || 0), 0);

    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">{t("admin.cancellations.title")}</h1>
        {loading ? <Loader /> : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-border">
                <p className="text-sm text-muted-foreground font-medium">{t("admin.cancellations.totalCancelled")}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{cancelled.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-border">
                <p className="text-sm text-muted-foreground font-medium">{t("admin.cancellations.noShows")}</p>
                <p className="text-2xl font-bold text-warning mt-1">{noShows.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-border">
                <p className="text-sm text-muted-foreground font-medium">{t("admin.cancellations.totalLost")}</p>
                <p className="text-2xl font-bold text-destructive mt-1"><bdi>{totalLost.toLocaleString()} DA</bdi></p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-border">
                  <tr>{[t("admin.bookings.col.patient"), t("admin.bookings.col.psy"), t("admin.bookings.col.date"), t("admin.bookings.col.price"), t("admin.bookings.col.status")].map(h => (
                    <th key={h} className="text-start px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id} className="border-b border-border hover:bg-background transition-colors">
                      <td className="px-5 py-3.5 font-medium text-foreground">{b.patient_name}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{b.psychologist_name}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{new Date(b.booked_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{b.price ? `${b.price} DA` : "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          b.status === "no-show" ? "bg-warning/10 text-warning border border-warning/30" :
                          "bg-destructive/10 text-destructive border border-destructive/30"
                        }`}>
                          {b.status === "no-show" ? t("admin.cancellations.noShow") : t("admin.cancellations.cancelled")}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">{t("admin.cancellations.empty")}</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
  );
  };

  const ReviewsTab = () => (
    <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">{t("admin.reviews.title")}</h1>
        {loading ? <Loader /> : (
          <div className="grid gap-4">
            {reviews.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-border shadow-sm p-5 flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground text-sm">{r.patient_name}</span>
                    <span className="text-muted-foreground text-xs">→</span>
                    <span className="text-muted-foreground text-sm">{r.psychologist_name}</span>
                    <div className="flex ms-2">{Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < r.rating ? "text-warning fill-warning" : "text-border fill-transparent"}`} />
                    ))}</div>
                  </div>
                  <p className="text-muted-foreground text-sm">{r.comment || <span className="italic text-muted-foreground">{t("admin.reviews.noComment")}</span>}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
                <button type="button" onClick={() => setReviewToDelete(r.id)} aria-label={t("common.delete")} className="p-2.5 rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer border-none bg-transparent transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {reviews.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">{t("admin.reviews.empty")}</div>}
          </div>
        )}
    </div>
  );

  const AdminsTab = () => {
    const allAdmins = users.filter(u => u.is_admin);
    const nonAdmins = users.filter(u => !u.is_admin);
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">{t("admin.admins.title")}</h1>
        <p className="text-muted-foreground text-sm mb-6">{t("admin.admins.desc")}</p>
        {loading ? <Loader /> : (
          <>
            <h2 className="font-semibold text-foreground mb-3">{t("admin.admins.current")}</h2>
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              {allAdmins.map(u => (
                <div key={u.user_id} className="flex items-center justify-between px-5 py-3.5 border-b border-border last:border-none">
                  <p className="font-medium text-foreground">{u.full_name || "—"}</p>
                  {u.user_id !== user?.id && (
                    <button onClick={() => toggleAdmin(u.user_id, true)} className="flex items-center gap-1.5 text-xs bg-destructive/10 text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg cursor-pointer border-none transition-colors">
                      <XCircle className="w-3 h-3" /> {t("admin.admins.revoke")}
                    </button>
                  )}
                </div>
              ))}
              {allAdmins.length === 0 && <p className="text-center py-6 text-muted-foreground text-sm">{t("admin.admins.empty")}</p>}
            </div>
            <h2 className="font-semibold text-foreground mb-3">{t("admin.admins.grant")}</h2>
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              {nonAdmins.map(u => (
                <div key={u.user_id} className="flex items-center justify-between px-5 py-3.5 border-b border-border last:border-none">
                  <div>
                    <p className="font-medium text-foreground">{u.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{u.user_type}</p>
                  </div>
                  <button onClick={() => toggleAdmin(u.user_id, false)} className="flex items-center gap-1.5 text-xs bg-teal-pale text-primary hover:bg-teal-pale px-3 py-1.5 rounded-lg cursor-pointer border-none transition-colors">
                    <Crown className="w-3 h-3" /> {t("admin.admins.appoint")}
                  </button>
                </div>
              ))}
              {nonAdmins.length === 0 && <p className="text-center py-6 text-muted-foreground text-sm">{t("admin.admins.emptyNon")}</p>}
            </div>
          </>
        )}
      </div>
  );
  };

  const tabMap: Record<Tab, React.ReactNode> = {
    dashboard:     <DashboardTabWrapper render={DashboardTab} />,
    users:         <UsersTabWrapper render={UsersTab} />,
    bookings:      <BookingsTabWrapper render={BookingsTab} />,
    cancellations: <CancellationsTabWrapper render={CancellationsTab} />,
    reviews:       <ReviewsTabWrapper render={ReviewsTab} />,
    admins:        <AdminsTabWrapper render={AdminsTab} />,
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <Sidebar />
      {reviewToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-review-title">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setReviewToDelete(null)} />
          <div className="relative w-full max-w-sm bg-card rounded-xl shadow-overlay border border-border p-6">
            <h2 id="delete-review-title" className="font-serif text-lg text-foreground mb-4">{t("admin.deleteReview.confirm")}</h2>
            <div className="flex gap-3 justify-end">
              <button type="button" autoFocus onClick={() => setReviewToDelete(null)} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground bg-transparent cursor-pointer hover:bg-accent/40">{t("common.cancel")}</button>
              <button type="button" onClick={() => deleteReviewItem(reviewToDelete)} className="px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold border-none cursor-pointer hover:opacity-90">{t("common.delete")}</button>
            </div>
          </div>
        </div>
      )}
      {menuOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMenuOpen(false)} />}
      <div className={rtl ? "md:mr-64" : "md:ml-64"}>
        <header className="bg-white border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <button type="button" className="md:hidden p-2 rounded-xl hover:bg-accent/40 cursor-pointer border-none bg-transparent focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? t("admin.closeMenu") : t("admin.openMenu")}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground">{navItems.find(n => n.id === tab)?.label}</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
            {user?.email?.[0]?.toUpperCase()}
          </div>
        </header>
        <main className="p-4 sm:p-6 max-w-6xl mx-auto">{tabMap[tab]}</main>
      </div>
    </div>
  );
}
