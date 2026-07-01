import { useState, useEffect } from "react";
import { Users, MessageSquare, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ForumPage() {
  const { t, lang, dir } = useLanguage();
  const { user } = useAuth();
  const locale = lang === "ar" ? "ar-SA" : "fr-FR";
  const [forumThreads, setForumThreads] = useState<{ id: string; category: string; title: string; author: string; content: string; date: string; replies: { author: string; content: string; isPsy?: boolean; date: string }[] }[]>([]);
  const [selectedThread, setSelectedThread] = useState<any | null>(null);
  const [forumCategory, setForumCategory] = useState("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [commentText, setCommentText] = useState("");
  const [showNewTopic, setShowNewTopic] = useState(false);

  const fetchForumThreads = async () => {
    const { data: threadsData } = await (supabase as any)
      .from("forum_threads")
      .select("id, category, title, content, created_at, author_id")
      .order("created_at", { ascending: false });

    if (threadsData) {
      const threadIds = threadsData.map((t: any) => t.id);
      const { data: repliesData } = await (supabase as any)
        .from("forum_replies")
        .select("id, thread_id, content, created_at, author_id, profiles(full_name, user_type)")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: true });

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

  useEffect(() => {
    if (!user) return;
    fetchForumThreads();

    const forumChannel = supabase
      .channel("public:forum")
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_threads" }, () => {
        fetchForumThreads();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_replies" }, () => {
        fetchForumThreads();
      })
      .subscribe();

    return () => {
      forumChannel.unsubscribe();
    };
  }, [user]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const cat = forumCategory === "all" ? "stress" : forumCategory;

    const { data, error } = await (supabase as any)
      .from('forum_threads')
      .insert({
        author_id: user?.id,
        category: cat,
        title: title.trim(),
        content: content.trim()
      })
      .select()
      .single();

    if (error) {
      toast.error("Erreur lors de la création du sujet.");
    } else if (data) {
      toast.success("✅ Sujet de discussion publié anonymement !");
      setTitle("");
      setContent("");
      setShowNewTopic(false);
      fetchForumThreads();
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedThread) return;

    const { data, error } = await (supabase as any)
      .from('forum_replies')
      .insert({
        thread_id: selectedThread.id,
        author_id: user?.id,
        content: commentText.trim()
      })
      .select('id, content, created_at, author_id, profiles(full_name, user_type)')
      .single();

    if (error) {
      toast.error("Erreur lors de la publication de la réponse.");
    } else if (data) {
      toast.success("✅ Votre réponse a été publiée !");
      setCommentText("");
      const newReply = {
        author: data.profiles?.user_type === 'psychologue' ? data.profiles?.full_name || "Thérapeute" : "Anonyme",
        content: data.content,
        isPsy: data.profiles?.user_type === 'psychologue',
        date: data.created_at
      };
      const updatedReplies = [...selectedThread.replies, newReply];
      setSelectedThread({ ...selectedThread, replies: updatedReplies });
      fetchForumThreads();
    }
  };

  const categories = [
    { id: "all", label: "Tout afficher" },
    { id: "stress", label: "Stress" },
    { id: "anxiety", label: "Anxiété" },
    { id: "relationships", label: "Relations" },
    { id: "depression", label: "Humeur" },
    { id: "selfesteem", label: "Estime de soi" }
  ];

  const filteredThreads = forumCategory === "all" 
    ? forumThreads 
    : forumThreads.filter(t => t.category === forumCategory);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl animate-in fade-in duration-500 font-sans">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-solid border-border/40">
        <div>
          <h3 className="font-serif text-2xl text-foreground font-semibold">{t("space.forum.title")}</h3>
          <p className="text-xs text-muted-foreground mt-1 font-sans">{t("space.forum.desc")}</p>
        </div>
        <button
          onClick={() => setShowNewTopic(!showNewTopic)}
          className="px-5 py-3 bg-primary text-primary-foreground hover:bg-teal-mid rounded-xl text-xs font-semibold border-none cursor-pointer transition-all shadow-sm shrink-0"
        >
          {t("space.forum.newTopic")}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 select-none no-scrollbar">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setForumCategory(c.id)}
            className={`px-4 py-2 text-xs font-semibold rounded-full border border-solid transition-all cursor-pointer shrink-0 ${
              forumCategory === c.id 
                ? "bg-primary border-primary text-white shadow-sm" 
                : "bg-white border-border/70 hover:bg-accent/40 text-muted-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-8">
        
        <div className="space-y-4">
          {showNewTopic && (
            <div className="dashboard-card p-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
              <div className="flex justify-between items-center pb-2">
                <h4 className="font-serif text-base font-semibold text-foreground">{t("space.forum.newTopic")}</h4>
                <button onClick={() => setShowNewTopic(false)} className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleCreateTopic} className="space-y-4 font-sans text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-muted-foreground uppercase tracking-wider">{t("space.forum.postTitle")}</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Comment calmer mon esprit en période d'examens..."
                    className="px-4 py-2.5 border border-border/70 rounded-xl text-xs bg-teal-hero/30 outline-none focus:border-primary focus:bg-card transition-all font-sans"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-muted-foreground uppercase tracking-wider">{t("space.forum.postContent")}</label>
                  <textarea
                    required
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                    className="px-4 py-2.5 border border-border/70 rounded-xl text-xs bg-teal-hero/30 outline-none focus:border-primary focus:bg-card transition-all font-sans resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-primary text-primary-foreground hover:bg-teal-mid rounded-xl text-xs font-semibold border-none cursor-pointer transition-all shadow-sm font-sans"
                >
                  {t("space.forum.createPost")}
                </button>
              </form>
            </div>
          )}

          {filteredThreads.length === 0 ? (
            <div className="dashboard-card p-10 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Aucune discussion pour le moment. Lancez le premier sujet !</p>
            </div>
          ) : (
            filteredThreads.map((threadItem) => (
              <div 
                key={threadItem.id} 
                onClick={() => setSelectedThread(threadItem)}
                className="dashboard-card p-6 flex flex-col justify-between hover:border-primary/20 hover:shadow transition-all duration-300 cursor-pointer border border-solid border-border/40"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-pale text-primary">
                      {threadItem.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(threadItem.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <h4 className="font-serif text-base font-semibold text-foreground leading-snug">{threadItem.title}</h4>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed font-sans">{threadItem.content}</p>
                </div>
                
                <div className="flex items-center justify-between border-t border-solid border-border/30 pt-3.5 mt-4 font-sans text-xs">
                  <span className="text-muted-foreground">Par : {threadItem.author}</span>
                  <span className="text-primary font-semibold flex items-center gap-1.5 hover:text-teal-mid transition-all">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {threadItem.replies.length} {t("space.forum.comments")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-6">
          <div className="dashboard-card p-6 space-y-4">
            <h3 className="font-serif text-base font-semibold text-primary">Règles du Forum</h3>
            <ul className="space-y-2.5 text-xs text-muted-foreground leading-relaxed font-sans">
              <li>• **Confidentialité absolue** : ne partagez jamais de données médicales identifiables ou de noms réels.</li>
              <li>• **Respect mutuel** : les insultes, jugements ou commentaires toxiques entraînent un bannissement.</li>
              <li>• **Pas d'urgence** : ce forum n'est pas surveillé en direct. En cas d'urgence grave, utilisez le bouton d'appel d'urgence (SOS).</li>
            </ul>
          </div>
        </div>
      </div>

      {selectedThread && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-black/25 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedThread(null)}
          />
          <div className={`relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between p-6 md:p-8 animate-in ${dir === "rtl" ? "slide-in-from-left duration-300" : "slide-in-from-right duration-300"}`}>
            
            <div className="space-y-6 flex-1 overflow-y-auto pr-1">
              <div className="flex items-start justify-between pb-4 border-b border-solid border-border/40">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-pale text-primary">
                    {selectedThread.category}
                  </span>
                  <h3 className="font-serif text-lg font-semibold text-foreground mt-2 leading-snug">{selectedThread.title}</h3>
                  <p className="text-[10px] text-muted-foreground mt-1">Publié par {selectedThread.author} · {new Date(selectedThread.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <button 
                  onClick={() => setSelectedThread(null)}
                  className="p-1.5 rounded-lg hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-all border-none bg-transparent cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 border border-solid border-border/30 rounded-2xl bg-teal-hero/5 font-sans text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {selectedThread.content}
              </div>

              <div className="space-y-4 pt-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.forum.comments")} ({selectedThread.replies.length})</h4>
                
                <div className="space-y-3.5">
                  {selectedThread.replies.map((r: any, idx: number) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-xl border border-solid font-sans text-xs leading-relaxed ${
                        r.isPsy 
                          ? "bg-teal-pale/35 border-primary/20" 
                          : "bg-accent/15 border-border/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-semibold ${r.isPsy ? "text-primary flex items-center gap-1" : "text-foreground"}`}>
                          {r.author}
                          {r.isPsy && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary text-white scale-95 leading-none">
                              {t("space.forum.verifiedPsy")}
                            </span>
                          )}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(r.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-foreground/90 whitespace-pre-wrap">{r.content}</p>
                    </div>
                  ))}
                  {selectedThread.replies.length === 0 && (
                    <p className="text-xs text-muted-foreground italic text-center py-4">Pas encore de réponses. Soyez le premier à encourager !</p>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handlePostComment} className="pt-4 border-t border-solid border-border/40 flex gap-2 mt-4 font-sans text-xs">
              <input
                type="text"
                required
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t("space.forum.replyPlaceholder")}
                className="flex-1 px-4 py-3 border border-border/70 rounded-xl text-xs bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans"
              />
              <button
                type="submit"
                className="px-5 py-3 bg-primary text-primary-foreground hover:bg-teal-mid rounded-xl text-xs font-semibold border-none cursor-pointer transition-all shadow-sm font-sans"
              >
                {t("space.forum.reply")}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
