import { Bell, Menu } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Page } from "./PsySidebar";

interface PsyTopBarProps {
  title: string;
  setSidebarOpen: (v: boolean) => void;
  notifDropdownOpen: boolean;
  setNotifDropdownOpen: (v: boolean) => void;
  unreadCount: number;
  notifications: {
    id: string;
    title: string;
    content: string;
    type: string;
    is_read: boolean;
    created_at: string;
    link?: string;
  }[];
  markAsRead: (id: string) => Promise<any>;
  markAllAsRead: () => Promise<any>;
  setActivePage: (p: Page) => void;
}

export default function PsyTopBar({
  title, setSidebarOpen, notifDropdownOpen, setNotifDropdownOpen,
  unreadCount, notifications, markAsRead, markAllAsRead, setActivePage
}: PsyTopBarProps) {
  const { t, dir } = useLanguage();

  return (
    <div className="sticky top-0 z-40 bg-card border-b border-border/60 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden bg-transparent border-none cursor-pointer text-foreground hover:text-primary transition-colors duration-150"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-serif text-xl font-semibold text-foreground leading-none">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="relative bg-transparent border-none cursor-pointer text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-full hover:bg-accent/40 flex items-center justify-center"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className={`absolute top-0.5 ${dir === "rtl" ? "left-0.5" : "right-0.5"} w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm`}>
                {unreadCount}
              </span>
            )}
          </button>

          {notifDropdownOpen && (
            <div className={`absolute ${dir === "rtl" ? "left-0" : "right-0"} mt-2 w-[calc(100vw-2rem)] max-w-sm bg-white border border-border/50 rounded-2xl shadow-xl z-50 overflow-hidden font-sans`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-accent/20">
                <span className="text-xs font-semibold text-foreground">{t("space.notifications")}</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      markAllAsRead();
                      setNotifDropdownOpen(false);
                    }}
                    className="text-[10px] text-primary hover:text-teal-mid font-semibold bg-transparent border-none cursor-pointer"
                  >
                    {t("space.notif.markAllRead")}
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    {t("space.notif.empty")}
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={async () => {
                        await markAsRead(notif.id);
                        setNotifDropdownOpen(false);
                        if (notif.link) {
                          const match = notif.link.match(/page=([^&]+)/);
                          if (match && match[1]) {
                            setActivePage(match[1] as Page);
                          } else {
                            window.location.href = notif.link;
                          }
                        }
                      }}
                      className={`flex flex-col p-4 text-start hover:bg-accent/30 cursor-pointer transition-colors ${!notif.is_read ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          notif.type === 'booking' ? 'bg-teal-pale text-primary' :
                          notif.type === 'message' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {t(`space.notif.${notif.type}`) || notif.type}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(notif.created_at).toLocaleDateString('fr-FR', {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-foreground mt-1.5 leading-snug">{notif.title}</h4>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-normal">{notif.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
