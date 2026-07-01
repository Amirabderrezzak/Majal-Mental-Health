import { MessageSquare } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getInitials } from "@/lib/utils";
import ChatWindow from "@/components/ChatWindow";

interface Booking {
  id: string;
  booked_at: string;
  status: "pending" | "confirmed" | "cancelled" | "done" | "no-show";
  duration_minutes: number;
  patient_id: string;
  patient_name?: string;
  patient_avatar?: string;
  price?: number;
  video_room_url?: string | null;
}

interface PsyMessagesProps {
  bookings: Booking[];
  activeChatUserId: string | null;
  setActiveChatUserId: (id: string | null) => void;
  activeChatUserName: string;
  setActiveChatUserName: (name: string) => void;
}

export default function PsyMessages({
  bookings, activeChatUserId, setActiveChatUserId, activeChatUserName, setActiveChatUserName
}: PsyMessagesProps) {
  const { t } = useLanguage();

  const patientDetails = new Map<string, { name: string; avatar?: string }>();
  bookings.forEach(b => {
    if (b.patient_id && !patientDetails.has(b.patient_id)) {
      patientDetails.set(b.patient_id, {
        name: b.patient_name || "Patient",
        avatar: b.patient_avatar
      });
    }
  });

  const uniquePatients = Array.from(patientDetails.entries());

  return (
    <div className="flex h-full min-h-[500px] animate-in fade-in duration-500">
      <div className="w-[320px] border-r border-border/60 bg-white flex flex-col shrink-0">
        <div className="p-4 border-b border-border/60">
          <h3 className="font-serif text-base font-semibold text-foreground">{t("space.discussionsTitle")}</h3>
        </div>
        <div className="flex-1 overflow-auto py-2">
          {uniquePatients.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground mt-8 font-medium">{t("psy.dashboard.noPatients")}</p>
          ) : (
            uniquePatients.map(([id, data]) => (
              <button
                key={id}
                onClick={() => { setActiveChatUserId(id); setActiveChatUserName(data.name || t("psy.dashboard.defaultPatientName")); }}
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

      <div className="flex-1 bg-accent/10">
        {activeChatUserId ? (
          <ChatWindow otherUserId={activeChatUserId} otherUserName={activeChatUserName} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">{t("psy.dashboard.selectPatientMsg")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
