import { X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface LiveAudioModalProps {
  roomUrl: string | null;
  title: string;
  onClose: () => void;
}

export default function LiveAudioModal({ roomUrl, title, onClose }: LiveAudioModalProps) {
  const { t } = useLanguage();
  if (!roomUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 animate-in fade-in duration-200">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-card border-b border-border shadow-rest">
        <div className="flex items-center gap-3 min-w-0">
          <span className="chip chip-danger shrink-0"><span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
          </span> LIVE</span>
          <h3 className="font-serif text-sm sm:text-base font-semibold text-foreground truncate">
            {title || t("space.explore.liveRooms")}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="btn-ghost p-2 shrink-0"
          aria-label={t("space.explore.leaveRoom")}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative bg-black">
        <iframe
          src={`${roomUrl}?embedMode=iframe`}
          className="w-full h-full flex-1 border-0 absolute inset-0"
          allow="camera; microphone; fullscreen; speaker; autoplay"
          title={title || "Live audio room"}
        />
      </div>
    </div>
  );
}
