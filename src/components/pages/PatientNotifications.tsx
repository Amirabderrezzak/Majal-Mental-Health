import { useState } from "react";
import { Bell, Calendar, MessageSquare, Check, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/hooks/useNotifications";

interface PatientNotificationsProps {
  setActivePage: (page: string) => void;
}

export default function PatientNotifications({ setActivePage }: PatientNotificationsProps) {
  const { t, lang } = useLanguage();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');

  const filtered = notifications.filter(n => notifFilter === 'all' || !n.is_read);

  return (
    <div className="p-4 sm:p-6 max-w-2xl animate-in fade-in duration-500 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-semibold text-foreground">{t("space.notifications")}</h3>
          <p className="text-muted-foreground text-xs mt-1 font-sans">{t("space.notif.clickToView") || "Gérez et consultez vos alertes en temps réel."}</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="w-full sm:w-auto px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-semibold border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 font-sans"
          >
            <Check className="w-3.5 h-3.5" />
            {t("space.notif.markAllRead")}
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-border/40 pb-px font-sans">
        {[
          { id: 'all' as const, label: t("space.notif.all") || "Toutes", count: notifications.length },
          { id: 'unread' as const, label: t("space.notif.unread") || "Non lues", count: unreadCount }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setNotifFilter(tab.id)}
            className={`pb-3 px-3 text-xs font-semibold relative bg-transparent border-none cursor-pointer transition-all ${
              notifFilter === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  notifFilter === tab.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </span>
            {notifFilter === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3 font-sans">
        {filtered.length === 0 ? (
          <div className="dashboard-card p-12 text-center text-sm text-muted-foreground">
            <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            {t("space.notif.empty")}
          </div>
        ) : (
          filtered.map((notif) => {
            const iconMap = {
              booking: <Calendar className="w-4 h-4" />,
              message: <MessageSquare className="w-4 h-4" />,
              system: <Bell className="w-4 h-4" />
            };
            const colorMap = {
              booking: "bg-teal-pale text-primary border-border",
              message: "bg-teal-50 text-teal-600 border-teal-100",
              system: "bg-amber-50 text-amber-600 border-amber-100"
            };
            return (
              <div
                key={notif.id}
                className={`dashboard-card p-4 flex gap-4 items-start relative hover:shadow-md transition-all group ${
                  !notif.is_read ? 'border-l-4 border-l-primary bg-primary/[0.02]' : ''
                }`}
              >
                <div className={`p-2.5 rounded-xl border shrink-0 ${colorMap[notif.type] || "bg-gray-50 text-gray-600 border-gray-100"}`}>
                  {iconMap[notif.type] || <Bell className="w-4 h-4" />}
                </div>

                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={async () => {
                    if (!notif.is_read) {
                      await markAsRead(notif.id);
                    }
                    if (notif.link) {
                      const match = notif.link.match(/page=([^&]+)/);
                      if (match && match[1]) {
                        setActivePage(match[1]);
                      } else {
                        window.location.href = notif.link;
                      }
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(notif.created_at).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                    {!notif.is_read && (
                      <span className="w-2 h-2 bg-primary rounded-full" />
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-foreground mt-1 leading-snug">{notif.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{notif.content}</p>
                </div>

                <button
                  onClick={() => deleteNotification(notif.id)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all border-none bg-transparent cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
