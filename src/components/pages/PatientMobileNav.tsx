import { LayoutDashboard, Calendar, MessageSquare, Compass, Menu } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Page } from "./PatientSidebar";

interface PatientMobileNavProps {
  activePage: Page;
  setActivePage: (p: Page) => void;
  setSidebarOpen: (v: boolean) => void;
}

const items: { id: Page; labelKey: string; icon: React.ReactNode }[] = [
  { id: "dashboard", labelKey: "space.dashboard", icon: <LayoutDashboard className="w-5 h-5" aria-hidden="true" /> },
  { id: "sessions", labelKey: "space.nav.sessions", icon: <Calendar className="w-5 h-5" aria-hidden="true" /> },
  { id: "messages", labelKey: "space.nav.messages", icon: <MessageSquare className="w-5 h-5" aria-hidden="true" /> },
  { id: "explore", labelKey: "space.nav.explore", icon: <Compass className="w-5 h-5" aria-hidden="true" /> },
];

// Bottom navigation for patients on mobile. The dashboard tab has its own
// contextual action bar (join / messages / emergency), so MonEspace mounts
// this on every OTHER tab to keep a consistent way around the app.
export default function PatientMobileNav({ activePage, setActivePage, setSidebarOpen }: PatientMobileNavProps) {
  const { t } = useLanguage();
  const btn = "flex flex-col items-center justify-center gap-0.5 px-3 py-2 min-h-11 min-w-11 rounded-xl border-none bg-transparent cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none";

  return (
    <nav
      aria-label={t("space.nav.mobile")}
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/50 bg-card shadow-overlay"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {items.map((item) => {
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setActivePage(item.id)}
              className={`${btn} ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {item.icon}
              <span className="text-[10px] font-semibold leading-none">{t(item.labelKey)}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => setSidebarOpen(true)} className={`${btn} text-muted-foreground hover:text-foreground`}>
          <Menu className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-semibold leading-none">{t("psy.dashboard.nav.more")}</span>
        </button>
      </div>
    </nav>
  );
}
