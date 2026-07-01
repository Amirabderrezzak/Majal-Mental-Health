import { LayoutDashboard, Calendar, Search, User, Bell, LogOut, Menu, X, MessageSquare, Compass, Users, BookOpen, Wind } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { Link } from "react-router-dom";

export type Page = "dashboard" | "sessions" | "messages" | "explore" | "forum" | "journal" | "coping" | "profil" | "notifications";

interface NavItem {
  id: Page;
  labelKey: string;
  icon: React.ReactNode;
}

export const navItems: NavItem[] = [
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

interface PatientSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activePage: Page;
  setActivePage: (page: Page) => void;
  profile: { full_name: string; avatar_url?: string };
  initials: string;
}

export default function PatientSidebar({
  sidebarOpen,
  setSidebarOpen,
  activePage,
  setActivePage,
  profile,
  initials,
}: PatientSidebarProps) {
  const { t, dir } = useLanguage();
  const { user, signOut } = useAuth();
  const { unreadCount } = useNotifications();

  return (
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
}
