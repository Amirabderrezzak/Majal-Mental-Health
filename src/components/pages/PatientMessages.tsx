import { MessageSquare, ChevronLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import ChatWindow from "@/components/ChatWindow";

interface Booking {
  psychologist_id: string;
  psychologist_name?: string;
  psychologist_avatar?: string;
}

interface PatientMessagesProps {
  upcoming: Booking[];
  past: Booking[];
  activeChatUserId: string | null;
  setActiveChatUserId: (id: string | null) => void;
  activeChatUserName: string;
  setActiveChatUserName: (name: string) => void;
  getInitials: (name?: string) => string;
}

export default function PatientMessages({
  upcoming,
  past,
  activeChatUserId,
  setActiveChatUserId,
  activeChatUserName,
  setActiveChatUserName,
  getInitials,
}: PatientMessagesProps) {
  const { t } = useLanguage();
  const allBookings = [...upcoming, ...past];

  const therapistDetails = new Map<string, { name: string; avatar?: string }>();
  allBookings.forEach((b: Booking) => {
    if (b.psychologist_id && !therapistDetails.has(b.psychologist_id)) {
      therapistDetails.set(b.psychologist_id, {
        name: b.psychologist_name || "Un Psychologue",
        avatar: b.psychologist_avatar
      });
    }
  });

  const uniqueTherapists = Array.from(therapistDetails.entries());

  return (
    <div className="flex h-[calc(100vh-80px)] animate-in fade-in duration-500">
      <div className={`w-full md:w-[320px] md:shrink-0 md:border-r md:border-border/60 bg-white flex flex-col ${activeChatUserId ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-border/60">
          <h3 className="font-serif text-base font-semibold text-foreground">{t("space.discussionsTitle")}</h3>
        </div>
        <div className="flex-1 overflow-auto py-2">
          {uniqueTherapists.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground mt-8 px-4 font-medium">{t("space.noTherapistsMessage")}</p>
          ) : (
            uniqueTherapists.map(([id, data]) => (
              <button
                key={id}
                onClick={() => { setActiveChatUserId(id); setActiveChatUserName(data.name || t("space.defaultTherapistName")); }}
                className={`w-full text-left px-4 py-3.5 border-b border-border/20 flex items-center gap-3 transition-all border-none cursor-pointer ${activeChatUserId === id ? "bg-teal-pale/70 border-l-4 border-primary" : "hover:bg-accent/40 bg-transparent"}`}
              >
                {data.avatar ? (
                  <img src={data.avatar} alt={data.name} className="w-10 h-10 rounded-full object-cover border border-primary/10 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                    {getInitials(data.name)}
                  </div>
                )}
                <div className="font-semibold text-sm text-foreground truncate">{data.name}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className={`relative flex-1 bg-accent/10 ${activeChatUserId ? "flex" : "hidden md:flex"}`}>
        {activeChatUserId ? (
          <>
            <button
              onClick={() => setActiveChatUserId(null)}
              className="md:hidden absolute z-10 top-2 start-2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/90 border border-border shadow-sm text-xs font-semibold text-foreground"
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              {t("space.back")}
            </button>
            <ChatWindow otherUserId={activeChatUserId} otherUserName={activeChatUserName} />
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
            <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm text-center">{t("space.selectPsyMessage")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
