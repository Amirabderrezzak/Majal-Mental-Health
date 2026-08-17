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
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground/60 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white/95 border-b border-solid border-border/40 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-2.5 w-2.5 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
          </span>
          <h3 className="font-serif text-sm sm:text-base font-semibold text-foreground truncate">
            {title || t("space.explore.liveRooms")}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-all border-none bg-transparent cursor-pointer shrink-0"
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
