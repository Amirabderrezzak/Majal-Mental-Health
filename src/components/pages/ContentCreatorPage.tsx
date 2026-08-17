import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PenTool, Volume2, Users, Trash2, MessageSquare } from "lucide-react";
import LiveAudioModal from "./LiveAudioModal";

interface ContentCreatorProps {
  t: (key: string) => string;
  user: any;
  profileData: {
    full_name: string;
    avatar_url?: string | null;
  };
  getInitials: (name: string) => string;
}

export default function ContentCreatorPage({ t, user, profileData, getInitials }: ContentCreatorProps) {
  const [contentTab, setContentTab] = useState<"stories" | "audio" | "forum">("stories");

  const [storyText, setStoryText] = useState("");
  const [selectedBg, setSelectedBg] = useState("from-teal-mid to-teal-dark");
  const [publishedStories, setPublishedStories] = useState<{ id?: string; text: string; bg: string }[]>([]);

  const [audioTitle, setAudioTitle] = useState("");
  const [liveRoom, setLiveRoom] = useState<{ id: string; url: string; title: string } | null>(null);
  const [startingRoom, setStartingRoom] = useState(false);

  const [forumThreads, setForumThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any | null>(null);
  const [replyText, setReplyText] = useState("");

  const bgPresets = [
    { name: "Teal Calme", bg: "from-teal-mid to-teal-dark" },
    { name: "Aurore Éveillée", bg: "from-rose-400 to-indigo-600" },
    { name: "Chaleur Réconfortante", bg: "from-amber-400 to-orange-600" },
    { name: "Forêt de Soin", bg: "from-emerald-400 to-teal-700" },
    { name: "Crépuscule Apaisant", bg: "from-purple-600 to-pink-500" },
  ];

  const fetchForumThreads = async () => {
    const { data: threadsData } = await (supabase as any)
      .from('forum_threads')
      .select('id, category, title, content, created_at, author_id')
      .order('created_at', { ascending: false });

    if (threadsData) {
      const threadIds = threadsData.map((t: any) => t.id);
      const { data: repliesData } = await (supabase as any)
        .from('forum_replies')
        .select('id, thread_id, content, created_at, author_id, profiles(full_name, user_type)')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: true });

      const mapped = threadsData.map((t: any) => {
        const repliesForThread = repliesData?.filter((r: any) => r.thread_id === t.id) || [];
        return {
          id: t.id,
          category: t.category,
          title: t.title,
          author: "Anonyme",
          content: t.content,
          date: t.created_at,
          replies: repliesForThread.map((r: any) => ({
            author: r.profiles?.user_type === "psychologue" ? r.profiles?.full_name || "Thérapeute" : "Anonyme",
            content: r.content,
            isPsy: r.profiles?.user_type === "psychologue",
            date: r.created_at,
          })),
        };
      });
      setForumThreads(mapped);
    }
  };

  const fetchDbStories = async () => {
    const { data } = await (supabase as any)
      .from('stories')
      .select('id, content, bg_gradient')
      .eq('author_id', user?.id)
      .order('created_at', { ascending: false });
    if (data) {
      setPublishedStories(data.map((s: any) => ({
        id: s.id,
        text: s.content,
        bg: s.bg_gradient
      })));
    }
  };

  useEffect(() => {
    fetchDbStories();
    fetchForumThreads();

    const storiesChannel = supabase
      .channel("psy:stories")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => {
        fetchDbStories();
      })
      .subscribe();

    const forumChannel = supabase
      .channel("psy:forum")
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_threads" }, () => {
        fetchForumThreads();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_replies" }, () => {
        fetchForumThreads();
      })
      .subscribe();

    return () => {
      storiesChannel.unsubscribe();
      forumChannel.unsubscribe();
    };
  }, []);

  const handlePublishStory = async () => {
    if (!storyText.trim() || !user) return;

    const { data, error } = await (supabase as any)
      .from('stories')
      .insert({
        author_id: user.id,
        content: storyText.trim(),
        bg_gradient: selectedBg
      })
      .select()
      .single();

    if (error) {
      toast.error("Erreur lors de la publication de la réflexion.");
    } else if (data) {
      setPublishedStories(prev => [{
        id: data.id,
        text: data.content,
        bg: data.bg_gradient
      }, ...prev]);
      setStoryText("");
      toast.success("✅ Réflexion publiée avec succès ! Elle est désormais visible pour vos patients.");
    }
  };

  const handleDeleteStory = async (idx: number) => {
    const story = publishedStories[idx];
    if (!story || !story.id) return;

    const { error } = await (supabase as any)
      .from('stories')
      .delete()
      .eq('id', story.id);

    if (error) {
      toast.error("Erreur lors de la suppression de la réflexion.");
    } else {
      setPublishedStories(prev => prev.filter((_, i) => i !== idx));
      toast.success("✅ Réflexion supprimée.");
    }
  };

  const handleStartAudioRoom = async () => {
    if (!audioTitle.trim()) {
      toast.error("Veuillez donner un sujet au salon.");
      return;
    }
    if (!user) {
      toast.error("Vous devez être connecté pour lancer un salon.");
      return;
    }

    setStartingRoom(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("Session expirée. Veuillez vous reconnecter.");
        return;
      }

      const response = await fetch('/api/calls/create-audio-room', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: audioTitle.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Échec de la création du salon.");
      }

      setLiveRoom({ id: data.id, url: data.url, title: audioTitle.trim() });
      setAudioTitle("");
      toast.success("🎙️ Le salon audio en direct est lancé ! Vos patients peuvent maintenant le rejoindre.");
    } catch (err) {
      console.error("Audio room start error:", err);
      toast.error(err instanceof Error ? err.message : "Impossible de lancer le salon audio. Vérifiez la configuration du service.");
    } finally {
      setStartingRoom(false);
    }
  };

  const handleStopAudioRoom = async () => {
    if (!liveRoom) return;

    try {
      const { error } = await (supabase as any)
        .from('audio_rooms')
        .delete()
        .eq('id', liveRoom.id);

      if (error) {
        toast.error("Erreur lors de la fermeture du salon.");
      } else {
        toast.success("🛑 Le salon audio a été fermé.");
      }
    } catch (err) {
      console.error("Audio room stop error:", err);
    } finally {
      setLiveRoom(null);
    }
  };

  const handlePostForumReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedThread || !user) return;

    const { data, error } = await (supabase as any)
      .from('forum_replies')
      .insert({
        thread_id: selectedThread.id,
        author_id: user.id,
        content: replyText.trim()
      })
      .select('id, content, created_at, author_id, profiles(full_name, user_type)')
      .single();

    if (error) {
      toast.error("Erreur lors de la publication de la réponse.");
    } else if (data) {
      toast.success("✅ Votre réponse de clinicien a été publiée !");
      setReplyText("");
      const newReply = {
        author: data.profiles?.full_name || profileData.full_name || "Thérapeute",
        content: data.content,
        isPsy: true,
        date: data.created_at
      };
      const updatedReplies = [...selectedThread.replies, newReply];
      setSelectedThread({ ...selectedThread, replies: updatedReplies });
      fetchForumThreads();
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl animate-in fade-in duration-500 font-sans">

      <div className="flex border-b border-border/40 pb-px gap-4 select-none">
        {[
          { id: "stories", label: t("psy.content.publishStory") || "Réflexions", icon: <PenTool className="w-4 h-4" /> },
          { id: "audio", label: t("psy.content.liveAudio") || "Salons Audio", icon: <Volume2 className="w-4 h-4" /> },
          { id: "forum", label: t("space.nav.forum") || "Forum d'entraide", icon: <Users className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setContentTab(tab.id as any);
              setSelectedThread(null);
            }}
            className={`flex items-center gap-2 pb-3.5 text-sm font-semibold border-b-2 border-solid bg-transparent cursor-pointer transition-all ${
              contentTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {contentTab === "stories" && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
          <div className="dashboard-card p-6 md:p-8 space-y-6">
            <h3 className="font-serif text-lg font-semibold text-foreground border-b border-border/30 pb-3">
              {t("psy.content.publishStory")}
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                {t("psy.content.storyText")}
              </label>
              <textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                rows={4}
                placeholder="Ex: Prenez conscience de votre respiration pendant 3 minutes... Vous êtes plus fort que votre anxiété."
                className="w-full px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all resize-none leading-relaxed"
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                {t("psy.content.storyBg")}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                {bgPresets.map((preset) => (
                  <button
                    key={preset.bg}
                    onClick={() => setSelectedBg(preset.bg)}
                    className={`h-12 rounded-xl bg-gradient-to-br ${preset.bg} border-2 border-solid transition-all cursor-pointer ${
                      selectedBg === preset.bg ? "border-primary scale-105 shadow-md" : "border-transparent hover:scale-102"
                    }`}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handlePublishStory}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all"
            >
              Publier la Réflexion
            </button>
          </div>

          <div className="space-y-6">
            <div className="dashboard-card p-6 space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aperçu en Direct</h4>
              <div className="w-full aspect-[9/14] rounded-2xl overflow-hidden bg-gradient-to-br from-teal-mid to-teal-dark relative flex flex-col justify-between p-6 text-white shadow-md">
                <div className="w-full h-[3px] bg-white/30 rounded overflow-hidden">
                  <div className="h-full bg-white w-1/3" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 border border-white/20 flex items-center justify-center font-bold text-[10px]">
                    {getInitials(profileData.full_name)}
                  </div>
                  <span className="text-[10px] font-semibold">{profileData.full_name || "Mon Thérapeute"}</span>
                </div>
                <div className={`flex-1 bg-gradient-to-br ${selectedBg} flex items-center justify-center text-center p-4 rounded-xl my-4`}>
                  <p className="font-serif text-sm leading-relaxed italic select-none break-words max-h-48 overflow-y-auto px-1">
                    {storyText || "Saisissez votre texte à gauche pour prévisualiser la carte..."}
                  </p>
                </div>
                <div className="text-[8px] text-white/50 text-center">Taper pour passer</div>
              </div>
            </div>

            <div className="dashboard-card p-6 space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mes Réflexions Actives ({publishedStories.length})</h4>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {publishedStories.map((story, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border border-solid border-border/40 rounded-xl bg-teal-hero/5 text-xs hover:bg-teal-hero/10 transition-colors font-sans">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`w-3.5 h-3.5 rounded bg-gradient-to-br ${story.bg} shrink-0`} />
                      <span className="truncate text-foreground/90 font-medium">{story.text}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteStory(idx)}
                      className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all border-none bg-transparent cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {publishedStories.length === 0 && (
                  <p className="text-xs text-muted-foreground italic text-center py-2">Aucune réflexion publiée.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {contentTab === "audio" && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
          <div className="dashboard-card p-6 md:p-8 space-y-6">
            {!liveRoom ? (
              <>
                <h3 className="font-serif text-lg font-semibold text-foreground border-b border-border/30 pb-3">
                  Lancer un Salon Audio en Direct
                </h3>
                <div className="p-4 rounded-xl bg-teal-pale/20 border border-solid border-primary/10 text-xs text-primary leading-relaxed">
                  🎙️ Les salons audio permettent à vos patients de vous rejoindre de façon anonyme pour vous écouter parler d'un thème bien-être spécifique. Vous pouvez leur accorder le droit de parole s'ils le demandent.
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    {t("psy.content.topicTitle")}
                  </label>
                  <input
                    type="text"
                    value={audioTitle}
                    onChange={(e) => setAudioTitle(e.target.value)}
                    placeholder={t("psy.content.topicPlaceholder")}
                    className="w-full px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans"
                  />
                </div>

                <button
                  onClick={handleStartAudioRoom}
                  disabled={startingRoom}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all disabled:opacity-60"
                >
                  {startingRoom ? "Création en cours..." : t("psy.content.startAudio")}
                </button>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-solid border-border/30 pb-3">
                  <div>
                    <span className="flex h-2.5 w-2.5 relative inline-block me-2 align-middle">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                    </span>
                    <span className="text-[10px] uppercase font-bold text-red-600 tracking-wider">Cercle en Direct</span>
                    <h3 className="font-serif text-lg font-semibold text-foreground mt-1">{liveRoom.title}</h3>
                  </div>
                  <button
                    onClick={handleStopAudioRoom}
                    className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all"
                  >
                    Terminer le salon
                  </button>
                </div>

                <div className="flex flex-col items-center justify-center py-6 bg-teal-hero/5 rounded-2xl border border-solid border-primary/5">
                  {profileData.avatar_url ? (
                    <img src={profileData.avatar_url} alt="Host" className="w-20 h-20 rounded-full object-cover border-2 border-solid border-primary relative z-10 shadow-md" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-teal-pale border-2 border-solid border-primary flex items-center justify-center text-primary font-bold text-xl relative z-10 shadow-md">
                      {getInitials(profileData.full_name)}
                    </div>
                  )}
                  <div className="text-sm font-semibold text-foreground mt-2">{profileData.full_name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5 font-sans">Organisateur</div>
                  <p className="text-xs text-muted-foreground text-center mt-4 max-w-xs">
                    Votre salon est en direct. Ouvrez la salle pour parler et gérer votre micro.
                  </p>
                  <button
                    onClick={() => setLiveRoom(liveRoom)}
                    className="px-5 py-2 mt-4 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all shadow-sm bg-primary text-primary-foreground hover:bg-teal-mid"
                  >
                    Ouvrir la salle audio
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="dashboard-card p-6 space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vos salons</h4>
              {liveRoom ? (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between p-2 rounded-xl border border-solid border-primary/20 bg-teal-hero/5 font-sans">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                      </span>
                      <span className="text-xs font-semibold text-foreground">{liveRoom.title}</span>
                    </div>
                    <span className="text-[9px] uppercase font-bold text-red-600">En direct</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4 font-sans">Aucun salon en cours. Lancez-en un pour être découvert par vos patients.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {liveRoom && (
        <LiveAudioModal
          roomUrl={liveRoom.url}
          title={liveRoom.title}
          onClose={() => {}}
        />
      )}

      {contentTab === "forum" && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
          <div className="space-y-4">
            {selectedThread ? (
              <div className="dashboard-card p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-solid border-border/30 pb-3">
                  <button
                    onClick={() => setSelectedThread(null)}
                    className="text-xs text-primary font-semibold hover:underline bg-transparent border-none cursor-pointer"
                  >
                    ← Retour aux questions
                  </button>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-teal-pale text-primary">
                    {selectedThread.category}
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-muted-foreground">Posée par {selectedThread.author} · {new Date(selectedThread.date).toLocaleDateString()}</span>
                  <h3 className="font-serif text-lg font-semibold text-foreground leading-snug">{selectedThread.title}</h3>
                  <p className="p-4 rounded-xl border border-solid border-border/20 bg-teal-hero/5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selectedThread.content}</p>
                </div>

                <div className="space-y-3 pt-4 border-t border-solid border-border/30">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.forum.comments")} ({selectedThread.replies.length})</h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {selectedThread.replies.map((reply: any, idx: number) => (
                      <div key={idx} className={`p-4 rounded-xl border border-solid font-sans text-xs leading-relaxed ${reply.isPsy ? "bg-teal-pale/35 border-primary/20" : "bg-accent/15 border-border/30"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-semibold ${reply.isPsy ? "text-primary flex items-center gap-1" : "text-foreground"}`}>
                            {reply.author}
                            {reply.isPsy && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary text-white scale-95 leading-none">
                                {t("space.forum.verifiedPsy") || "Psychologue Vérifié"}
                              </span>
                            )}
                          </span>
                          <span className="text-[9px] text-muted-foreground">{new Date(reply.date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-foreground/90 whitespace-pre-wrap">{reply.content}</p>
                      </div>
                    ))}
                    {selectedThread.replies.length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-2">Aucune réponse pour le moment.</p>
                    )}
                  </div>
                </div>

                <form onSubmit={handlePostForumReply} className="pt-4 border-t border-solid border-border/40 flex flex-col gap-2 mt-4 font-sans text-xs">
                  <label className="font-semibold text-muted-foreground uppercase tracking-wider">Votre conseil clinique professionnel (Label Verified ✓)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={t("space.forum.replyPlaceholder") || "Répondre avec professionnalisme..."}
                      className="flex-1 px-4 py-3 border border-border/70 rounded-xl text-xs bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans"
                    />
                    <button
                      type="submit"
                      className="px-5 py-3 bg-primary text-primary-foreground hover:bg-teal-mid rounded-xl text-xs font-semibold border-none cursor-pointer transition-all shadow-sm font-sans"
                    >
                      {t("space.forum.reply") || "Répondre"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="p-4 rounded-xl bg-teal-pale/25 border border-solid border-primary/10 text-xs text-primary leading-relaxed">
                  💡 En tant que psychologue certifié Majal, vos réponses aux questions anonymes portent automatiquement le badge **Psychologue Vérifié**. Cela renforce la confiance des patients et la visibilité de votre expertise clinique.
                </div>
                {forumThreads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThread(thread)}
                    className="dashboard-card p-6 flex flex-col justify-between hover:border-primary/20 hover:shadow transition-all duration-300 cursor-pointer border border-solid border-border/40 bg-white"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-pale text-primary">
                          {thread.category}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{new Date(thread.date).toLocaleDateString()}</span>
                      </div>
                      <h4 className="font-serif text-base font-semibold text-foreground leading-snug">{thread.title}</h4>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed font-sans">{thread.content}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-solid border-border/30 pt-3.5 mt-4 font-sans text-xs">
                      <span className="text-muted-foreground">Par : {thread.author}</span>
                      <span className="text-primary font-semibold flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {thread.replies.length} réponses
                      </span>
                    </div>
                  </div>
                ))}
                {forumThreads.length === 0 && (
                  <div className="dashboard-card p-10 text-center text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">Aucun sujet publié par les patients pour le moment.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="dashboard-card p-6 space-y-4 font-sans">
              <h4 className="font-serif text-sm font-semibold text-primary">Charte du Praticien</h4>
              <ul className="space-y-3.5 text-xs text-muted-foreground leading-relaxed font-sans">
                <li>• **Conseils Généraux** : Fournissez des explications théoriques et des pistes thérapeutiques. Évitez les prescriptions formelles en ligne.</li>
                <li>• **Anonymat du patient** : Respectez le cadre sécurisé et confidentiel des échanges.</li>
                <li>• **Renvoi** : Encouragez la prise de rendez-vous en cabinet ou sur Majal pour un suivi approfondi.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
