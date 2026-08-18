import { useState, useEffect } from "react";
import { X, Heart, Wind, HandHeart, Radio, Send, Sparkles, Quote, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import LiveAudioModal from "./LiveAudioModal";

interface AudioRoom {
  id: string;
  title: string;
  host_id?: string;
  host_name?: string | null;
  is_live?: boolean;
  participant_count?: number;
  created_at?: string;
}

export default function ExplorePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [mockStories, setMockStories] = useState<{ name: string; avatar?: string; stories: { text: string; bg: string }[] }[]>([]);
  const [gratitudes, setGratitudes] = useState<{ id: string; text: string; color: string; rotation: number }[]>([]);
  const [audioRooms, setAudioRooms] = useState<AudioRoom[]>([]);
  const [newGratText, setNewGratText] = useState("");
  const [postingGrat, setPostingGrat] = useState(false);
  const [selectedStoryTherapist, setSelectedStoryTherapist] = useState<{ name: string; avatar?: string; stories: { text: string; bg: string }[] } | null>(null);
  const [currentStorySlide, setCurrentStorySlide] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState<{ url: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timeout: any;
    if (selectedStoryTherapist) {
      timeout = setTimeout(() => {
        if (currentStorySlide < selectedStoryTherapist.stories.length - 1) {
          setCurrentStorySlide(prev => prev + 1);
        } else {
          setSelectedStoryTherapist(null);
          setCurrentStorySlide(0);
        }
      }, 4000);
    }
    return () => clearTimeout(timeout);
  }, [selectedStoryTherapist, currentStorySlide]);

  const fetchGratitudes = async () => {
    const { data } = await (supabase as any)
      .from("gratitudes")
      .select("*")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setGratitudes(
        data.map((g: any) => ({
          id: g.id,
          text: g.content,
          color: g.color,
          rotation: Number(g.rotation),
        }))
      );
    } else {
      const defGrats = [
        { id: "1", text: "Reconnaissant d'avoir un espace sécurisé pour m'exprimer.", color: "bg-teal-pale/50", rotation: -2 },
        { id: "2", text: "Ma séance d'aujourd'hui m'a fait énormément de bien !", color: "bg-amber-100/50", rotation: 3 },
        { id: "3", text: "Le chant des oiseaux ce matin m'a calmé l'esprit.", color: "bg-teal-pale/50", rotation: -1 },
        { id: "4", text: "J'ai réussi à affronter ma phobie aujourd'hui.", color: "bg-rose-100/50", rotation: 1.5 },
      ];
      setGratitudes(defGrats);
    }
  };

  const fetchDbStories = async () => {
    const defaultStories = [
      {
        name: "Dr. Sofia Ben",
        avatar: undefined,
        stories: [
          { text: "« N'oubliez pas : Prendre soin de soi n'est pas égoïste, c'est indispensable. »", bg: "from-teal-mid to-teal-dark" },
          { text: "« Respirez profondément. Le stress de cette journée ne définit pas votre avenir. »", bg: "bg-teal" }
        ]
      },
      {
        name: "Dr. Yacine K.",
        avatar: undefined,
        stories: [
          { text: "« Vos sentiments actuels sont valides. Ne les refoulez pas, écoutez-les. »", bg: "bg-teal-cta" }
        ]
      },
      {
        name: "Dr. Amina R.",
        avatar: undefined,
        stories: [
          { text: "« La guérison est un chemin non linéaire. Soyez patient avec vous-même. »", bg: "from-primary to-teal-700" }
        ]
      }
    ];

    try {
      const { data: dbStoriesData } = await (supabase as any)
        .from('stories')
        .select('id, content, bg_gradient, author_id')
        .order('created_at', { ascending: true });

      if (dbStoriesData && dbStoriesData.length > 0) {
        const authorIds = [...new Set(dbStoriesData.map((s: any) => s.author_id as string))] as string[];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', authorIds);

        const grouped = authorIds.map(uid => {
          const p = profiles?.find(x => x.user_id === uid);
          const userStories = dbStoriesData.filter((s: any) => s.author_id === uid);
          return {
            name: p?.full_name || "Thérapeute",
            avatar: p?.avatar_url || undefined,
            stories: userStories.map((s: any) => ({ text: s.content, bg: s.bg_gradient }))
          };
        });

        setMockStories([...grouped, ...defaultStories]);
      } else {
        setMockStories(defaultStories);
      }
    } catch (err) {
      console.error("Error fetching db stories:", err);
      setMockStories(defaultStories);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchAudioRooms = async () => {
      const { data } = await (supabase as any)
        .from("audio_rooms_public")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) {
        setAudioRooms(data as AudioRoom[]);
      }
    };
    Promise.allSettled([fetchGratitudes(), fetchDbStories(), fetchAudioRooms()]).then(() =>
      setLoading(false)
    );

    const audioChannel = supabase
      .channel("public:audio_rooms")
      .on("postgres_changes", { event: "*", schema: "public", table: "audio_rooms" }, () => {
        fetchAudioRooms();
      })
      .subscribe();

    const gratitudeChannel = supabase
      .channel("public:gratitudes")
      .on("postgres_changes", { event: "*", schema: "public", table: "gratitudes" }, () => {
        fetchGratitudes();
      })
      .subscribe();

    const storiesChannel = supabase
      .channel("public:stories")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => {
        fetchDbStories();
      })
      .subscribe();

    return () => {
      audioChannel.unsubscribe();
      gratitudeChannel.unsubscribe();
      storiesChannel.unsubscribe();
    };
  }, [user]);

  const postGratitude = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGratText.trim()) return;
    setPostingGrat(true);

    const colors = ["bg-teal-pale/50", "bg-amber-100/50", "bg-teal-pale/50", "bg-rose-100/50", "bg-teal-pale"];
    const randColor = colors[Math.floor(Math.random() * colors.length)];
    const randRot = (Math.random() * 6 - 3);

    const { data, error } = await (supabase as any)
      .from('gratitudes')
      .insert({
        author_id: user?.id,
        content: newGratText.trim(),
        color: randColor,
        rotation: randRot
      })
      .select()
      .single();

    setPostingGrat(false);
    if (error) {
      toast.error("Erreur lors de l'enregistrement de la gratitude");
    } else if (data) {
      setNewGratText("");
      toast.success("Épinglé sur le mur des gratitudes !");
      fetchGratitudes();
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-5xl animate-in fade-in duration-500 font-sans">
      
      {/* Stories */}
      <section className="space-y-3">
        <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.explore.stories")}</h3>
        <div className="flex gap-4 overflow-x-auto py-2 pe-1 select-none no-scrollbar snap-x snap-mandatory">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 snap-start shrink-0">
                <div className="skeleton-shimmer w-16 h-16 rounded-full" />
                <div className="skeleton-shimmer w-12 h-2.5 rounded-full" />
              </div>
            ))
          ) : (
            mockStories.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedStoryTherapist(s);
                  setCurrentStorySlide(0);
                }}
                className="flex flex-col items-center gap-1.5 snap-start shrink-0 cursor-pointer border-none bg-transparent group"
              >
                <div className="p-0.5 rounded-full ring-2 ring-primary/30 transition-transform duration-150 group-hover:scale-105">
                  <div className="p-0.5 bg-white rounded-full">
                    {s.avatar ? (
                      <img src={s.avatar} alt={s.name} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-teal-pale text-primary font-bold text-sm flex items-center justify-center">
                        {getInitials(s.name)}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-foreground max-w-[70px] truncate">{s.name}</span>
              </button>
            ))
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-8">
        
        <div className="space-y-8">
          {/* Live audio rooms */}
          <section className="surface-elevated p-6 space-y-4 card-hover">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger"></span>
                </span>
                {t("space.explore.liveRooms")}
              </h3>
              <span className="chip chip-danger"><Radio className="w-3 h-3" /> LIVE</span>
            </div>
            
            <div className="space-y-3.5">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="skeleton-shimmer h-[78px] rounded-2xl" />
                ))
              ) : audioRooms.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-border bg-teal-hero/20">
                  <Radio className="w-8 h-8 mx-auto mb-2 text-primary/40" />
                  <p className="text-xs text-muted-foreground font-sans">
                    Aucun salon audio en direct pour le moment. Revenez bientôt !
                  </p>
                </div>
              ) : (
                audioRooms.map((room) => (
                  <div key={room.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-teal-hero/10 hover:border-primary/25 hover:bg-teal-hero/25 transition-all duration-150">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                        <Radio className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-semibold text-sm text-foreground leading-snug">{room.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-1 font-sans">
                          {room.host_name ? `Animé par ${room.host_name} · ` : ""}{room.participant_count ? `${room.participant_count} en écoute · ` : ""}Rejoignez la discussion
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!user) return;
                        const { data: url, error } = await (supabase as any)
                          .rpc("get_audio_room_url", { room_id: room.id });
                        if (error || !url) {
                          toast.error("Impossible de rejoindre le salon pour le moment.");
                          return;
                        }
                        setSelectedRoom({ url, title: room.title });
                      }}
                      className="btn btn-primary shrink-0 self-end sm:self-auto"
                    >
                      {t("space.explore.joinRoom")}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Gratitude wall */}
          <section className="surface-elevated p-6 md:p-8 space-y-6">
            <div>
              <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.explore.gratitude")}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t("space.explore.gratitudeDesc")}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              {gratitudes.length === 0 && !loading ? (
                <div className="col-span-full text-center py-8 px-4 rounded-2xl border border-dashed border-border text-muted-foreground">
                  <Quote className="w-8 h-8 mx-auto mb-2 text-primary/40" />
                  <p className="text-xs font-sans">Soyez le premier à épingler une gratitude anonyme.</p>
                </div>
              ) : loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton-shimmer h-24 rounded-xl" />
                ))
              ) : (
                gratitudes.map((g) => (
                  <article
                    key={g.id}
                    className={`p-4 rounded-xl border border-border ${g.color} font-serif text-xs text-foreground leading-relaxed shadow-rest hover:shadow-card transition-all duration-150`}
                  >
                    <p className="italic">"{g.text}"</p>
                    <span className="text-[9px] uppercase font-sans font-bold tracking-wider text-primary/70 mt-3 block">Anonyme</span>
                  </article>
                ))
              )}
            </div>

            <form onSubmit={postGratitude} className="flex gap-2">
              <input
                type="text"
                required
                value={newGratText}
                onChange={(e) => setNewGratText(e.target.value)}
                placeholder={t("space.explore.gratitudePlaceholder")}
                className="input-field"
              />
              <button
                type="submit"
                disabled={postingGrat}
                className="btn btn-primary shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                {t("space.explore.postGratitude")}
              </button>
            </form>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="surface p-6 space-y-4">
            <h3 className="section-head text-base text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Le Conseil du Jour
            </h3>
            <div className="p-4 rounded-2xl border border-primary/10 bg-teal-hero/10 space-y-3 font-sans">
              <p className="text-xs text-foreground leading-relaxed font-sans">
                « Prenez 3 minutes à midi pour fermer les yeux, écouter les bruits ambiants et relâcher vos épaules. Une pause de pleine conscience réinitialise l'organisme. »
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <span className="text-[9px] font-semibold text-primary uppercase">Dr. Sofia Ben</span>
                <div className="flex gap-1">
                  <button aria-label="J'aime" className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] text-muted-foreground hover:text-danger hover:bg-danger/5 transition-colors duration-150 bg-transparent border-none cursor-pointer">
                    <Heart className="w-3.5 h-3.5" /> 12
                  </button>
                  <button aria-label="Respirer" className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors duration-150 bg-transparent border-none cursor-pointer">
                    <Wind className="w-3.5 h-3.5" /> 9
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="surface p-6 space-y-4">
            <h3 className="section-head text-base text-primary flex items-center gap-2">
              <Quote className="w-4 h-4" /> Affirmation positive
            </h3>
            <div className="p-4 rounded-2xl border border-rose-100 bg-rose-50/10 space-y-3 font-sans">
              <p className="text-xs text-foreground italic leading-relaxed font-sans">
                « J'ai le droit de me tromper. Mes erreurs font partie de mon apprentissage et ne définissent pas ma valeur humaine. »
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <span className="text-[9px] font-semibold text-rose-800 uppercase">Majal Support</span>
                <button aria-label="Soutenir" className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] text-muted-foreground hover:text-danger hover:bg-danger/5 transition-colors duration-150 bg-transparent border-none cursor-pointer">
                  <HandHeart className="w-3.5 h-3.5" /> 34
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {selectedStoryTherapist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm h-[70vh] bg-white rounded-3xl overflow-hidden flex flex-col justify-between shadow-overlay">
            
            <div className="absolute top-3 inset-x-4 flex gap-1.5 z-30">
              {selectedStoryTherapist.stories.map((_, idx) => (
                <div key={idx} className="flex-1 h-[3px] bg-white/30 rounded overflow-hidden">
                  <div 
                    className="h-full bg-white rounded transition-all duration-300"
                    style={idx === currentStorySlide ? { width: "100%", transition: "width 4000ms linear" } : idx < currentStorySlide ? { width: "100%" } : { width: "0%" }}
                  />
                </div>
              ))}
            </div>

            <div className="absolute top-6 inset-x-4 flex items-center justify-between z-30 text-white font-sans">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 border border-white/20 flex items-center justify-center font-bold text-xs">
                  {getInitials(selectedStoryTherapist.name)}
                </div>
                <span className="text-xs font-semibold drop-shadow">{selectedStoryTherapist.name}</span>
              </div>
              <button 
                onClick={() => {
                  setSelectedStoryTherapist(null);
                  setCurrentStorySlide(0);
                }}
                className="p-1 rounded-full bg-black/25 text-white hover:bg-black/40 transition-all border-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`flex-1 bg-gradient-to-br ${selectedStoryTherapist.stories[currentStorySlide]?.bg || "from-teal-mid to-teal-dark"} flex items-center justify-center p-8 text-center text-white relative`}>
              <p className="font-serif text-xl md:text-2xl leading-relaxed italic px-4 select-none">
                {selectedStoryTherapist.stories[currentStorySlide]?.text}
              </p>
              
              <div 
                className="absolute inset-y-0 start-0 w-1/3 cursor-pointer"
                onClick={() => {
                  if (currentStorySlide > 0) {
                    setCurrentStorySlide(prev => prev - 1);
                  }
                }}
              />
              <div 
                className="absolute inset-y-0 end-0 w-1/3 cursor-pointer"
                onClick={() => {
                  if (currentStorySlide < selectedStoryTherapist.stories.length - 1) {
                    setCurrentStorySlide(prev => prev + 1);
                  } else {
                    setSelectedStoryTherapist(null);
                    setCurrentStorySlide(0);
                  }
                }}
              />
            </div>

          </div>
        </div>
      )}

      <LiveAudioModal
        roomUrl={selectedRoom?.url || null}
        title={selectedRoom?.title || ""}
        onClose={() => setSelectedRoom(null)}
      />
    </div>
  );
}
