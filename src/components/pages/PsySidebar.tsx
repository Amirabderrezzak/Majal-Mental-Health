import { LogOut, X, LayoutDashboard, Calendar, Users, MessageSquare, DollarSign, User, Settings, PenTool } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

export type Page = "dashboard" | "sessions" | "patients" | "messages" | "earnings" | "profile" | "settings" | "content";

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface PsySidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  activePage: Page;
  setActivePage: (p: Page) => void;
  profileData: { full_name: string; specialty?: string; avatar_url?: string };
  initials: string;
  signOut: () => Promise<void>;
}

export default function PsySidebar({ sidebarOpen, setSidebarOpen, activePage, setActivePage, profileData, initials, signOut }: PsySidebarProps) {
  const { t, dir } = useLanguage();

  const navItems: NavItem[] = [
    { id: "dashboard", label: t("psy.dashboard.nav.dashboard"), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "sessions",  label: t("psy.dashboard.nav.sessions"),  icon: <Calendar className="w-4 h-4" /> },
    { id: "patients",  label: t("psy.dashboard.nav.patients"),  icon: <Users className="w-4 h-4" /> },
    { id: "messages",  label: t("psy.dashboard.nav.messages"),  icon: <MessageSquare className="w-4 h-4" />, badge: 2 },
    { id: "content",   label: t("psy.dashboard.nav.content"),   icon: <PenTool className="w-4 h-4" /> },
    { id: "earnings",  label: t("psy.dashboard.nav.earnings"),  icon: <DollarSign className="w-4 h-4" /> },
    { id: "profile",   label: t("psy.dashboard.nav.profile"),   icon: <User className="w-4 h-4" /> },
    { id: "settings",  label: t("psy.dashboard.nav.settings"),  icon: <Settings className="w-4 h-4" /> },
  ];

  return (
      <aside className={`fixed inset-y-0 z-50 w-64 bg-card flex flex-col transform transition-transform duration-300 ${dir === "rtl" ? "right-0 border-l" : "left-0 border-r"} border-border/60 ${
      sidebarOpen ? "translate-x-0" : (dir === "rtl" ? "translate-x-full" : "-translate-x-full")
    } lg:translate-x-0`}>
      <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg border border-primary/30 text-primary font-semibold text-sm">MJ</div>
            </div>
            <span className="text-[10px] text-primary font-semibold tracking-wider mt-1 block">{t("psy.dashboard.spaceTitle").toUpperCase()}</span>
          </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <ul className="space-y-1.5">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => { setActivePage(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 bg-transparent border-none cursor-pointer glass-nav-item ${
                  activePage === item.id
                    ? "active bg-teal-pale text-primary font-semibold shadow-rest"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                <span className={`transition-transform duration-200 ${activePage === item.id ? "scale-110" : ""}`}>{item.icon}</span>
                {item.label}
                {item.badge && (
                  <span className={`${dir === "rtl" ? "mr-auto" : "ml-auto"} bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm`}>
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-5 py-4 border-t border-border/60 bg-teal-hero/30">
        <div className="flex items-center gap-3 mb-3">
          {profileData.avatar_url ? (
            <img src={profileData.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-primary/20 shrink-0 shadow-sm" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-primary/10 shadow-sm">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{profileData.full_name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{profileData.specialty || "Psychologue"}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all bg-transparent border-none cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          {t("nav.logout")}
        </button>
      </div>
    </aside>
  );
}
