import { LayoutDashboard, Calendar, Users, MessageSquare, Menu } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Page } from "./PsySidebar";

interface PsyMobileNavProps {
  activePage: Page;
  setActivePage: (p: Page) => void;
  setSidebarOpen: (v: boolean) => void;
}

const items: { id: Page; labelKey: string; icon: React.ReactNode }[] = [
  { id: "dashboard", labelKey: "psy.dashboard.nav.dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: "sessions",  labelKey: "psy.dashboard.nav.sessions",  icon: <Calendar className="w-5 h-5" /> },
  { id: "patients",  labelKey: "psy.dashboard.nav.patients",  icon: <Users className="w-5 h-5" /> },
  { id: "messages",  labelKey: "psy.dashboard.nav.messages",  icon: <MessageSquare className="w-5 h-5" /> },
];

export default function PsyMobileNav({ activePage, setActivePage, setSidebarOpen }: PsyMobileNavProps) {
  const { t } = useLanguage();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/50 bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {items.map((item) => {
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl border-none cursor-pointer transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-semibold leading-none">{t(item.labelKey)}</span>
            </button>
          );
        })}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl border-none cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-semibold leading-none">{t("psy.dashboard.nav.more")}</span>
        </button>
      </div>
    </nav>
  );
}
