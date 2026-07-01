import { X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AudioRoom {
  id: string;
  title: string;
  host: string;
  hostAvatar?: string;
  listeners: { id: string; name: string }[];
  speakers: { id: string; name: string }[];
}

interface LiveAudioModalProps {
  activeRoom: AudioRoom | null;
  setActiveRoom: (room: AudioRoom | null) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
  getInitials: (name?: string) => string;
}

export default function LiveAudioModal({
  activeRoom,
  setActiveRoom,
  isMuted,
  setIsMuted,
  isSpeaking,
  setIsSpeaking,
  getInitials,
}: LiveAudioModalProps) {
  const { t, dir } = useLanguage();
  const { user } = useAuth();
  if (!activeRoom) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-foreground/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={() => {
          setActiveRoom(null);
          setIsSpeaking(false);
        }}
      />
      <div className="relative w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl p-6 md:p-8 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto flex flex-col justify-between border-t border-solid border-primary/10">
        
        <div className="flex items-center justify-between pb-4 border-b border-solid border-border/40">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <div>
              <h3 className="font-serif text-base font-semibold text-foreground truncate max-w-md">{activeRoom.title}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
                {t("space.explore.speakers")} : {activeRoom.speakers.length + 1} · {t("space.explore.listeners")} : {activeRoom.listeners.length}
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              setActiveRoom(null);
              setIsSpeaking(false);
            }}
            className="p-1.5 rounded-lg hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-all border-none bg-transparent cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-6 space-y-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.explore.speakers")}</h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-6 text-center">
            
            <div className="flex flex-col items-center gap-2">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-20 h-20 rounded-full bg-primary/15 animate-pulse duration-1000" />
                <div className="absolute w-24 h-24 rounded-full bg-primary/5 animate-pulse duration-2000" />
                {activeRoom.hostAvatar ? (
                  <img src={activeRoom.hostAvatar} alt={activeRoom.host} className="w-16 h-16 rounded-full object-cover border-2 border-solid border-primary relative z-10 shadow-md" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-teal-pale border-2 border-solid border-primary flex items-center justify-center text-primary font-bold text-lg relative z-10 shadow-md">
                    {getInitials(activeRoom.host)}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 z-20 bg-primary text-primary-foreground text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-solid border-white">
                  HOST
                </span>
              </div>
              <div className="text-xs font-semibold text-foreground truncate w-20">{activeRoom.host}</div>
              <div className="text-[9px] text-primary uppercase font-bold tracking-wider leading-none">Psychologue</div>
            </div>

            {activeRoom.speakers.map((s) => {
              const speaking = isSpeaking && s.id === user?.id;
              return (
                <div key={s.id} className="flex flex-col items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    {speaking && (
                      <>
                        <div className="absolute w-18 h-18 rounded-full bg-primary/20 animate-pulse" />
                        <div className="absolute w-22 h-22 rounded-full bg-primary/5 animate-pulse" />
                      </>
                    )}
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-foreground font-semibold text-base border-2 border-solid relative z-10 shadow ${
                      speaking ? "bg-teal-pale border-primary" : "bg-accent/40 border-border/80"
                    }`}>
                      {getInitials(s.name)}
                    </div>
                    {!speaking && (
                      <span className="absolute bottom-0 right-0 z-20 bg-gray-500 text-white text-[8px] font-bold p-0.5 rounded-full border border-solid border-white">
                        🔇
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-foreground truncate w-20">{s.name}</div>
                  <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider leading-none">
                    {s.id === user?.id ? "Moi" : "Membre"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-solid border-border/40 pt-4 pb-6 space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.explore.listeners")}</h4>
          <div className="flex flex-wrap gap-3.5">
            {activeRoom.listeners.map((l) => (
              <div key={l.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/40 text-xs font-semibold text-foreground border border-solid border-border/20">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px]">{getInitials(l.name)}</div>
                <span>{l.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-solid border-border/40 flex items-center justify-between gap-4 font-sans">
          <button
            onClick={() => {
              setActiveRoom(null);
              setIsSpeaking(false);
            }}
            className="px-5 py-3 border border-solid border-destructive/20 text-destructive bg-transparent hover:bg-destructive/5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
          >
            {t("space.explore.leaveRoom")}
          </button>

          <div className="flex gap-2">
            {activeRoom.speakers.some(s => s.id === user?.id) ? (
              <button
                onClick={() => setIsSpeaking(!isSpeaking)}
                className={`px-5 py-3 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all flex items-center gap-1.5 shadow-sm ${
                  isSpeaking ? "bg-teal-pale text-primary" : "bg-primary text-primary-foreground hover:bg-teal-mid"
                }`}
              >
                {isSpeaking ? "Mute" : "Parler"}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!user) return;
                  setActiveRoom({
                    ...activeRoom,
                    listeners: activeRoom.listeners.filter(l => l.id !== user.id),
                    speakers: [...activeRoom.speakers, { id: user.id, name: "Moi" }]
                  });
                  setIsSpeaking(true);
                  toast.success("🎙️ Vous êtes maintenant intervenant !");
                }}
                className="px-5 py-3 bg-primary text-primary-foreground hover:bg-teal-mid rounded-xl text-xs font-semibold border-none cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
              >
                {t("space.explore.requestSpeak")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
