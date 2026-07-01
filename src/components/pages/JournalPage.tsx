import { useState, useEffect } from "react";
import { BookOpen, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CrisisHelpline from "./CrisisHelpline";

export default function JournalPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const locale = lang === "ar" ? "ar-SA" : "fr-FR";
  const [journalEntries, setJournalEntries] = useState<{ id: string; date: string; mood: string; text: string }[]>([]);
  const [selectedMood, setSelectedMood] = useState<string>("calm");
  const [journalText, setJournalText] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(`majal_journal_entries_${user.id}`);
    if (stored) {
      try {
        setJournalEntries(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveJournalEntry = () => {
    if (!journalText.trim()) {
      toast.error("Veuillez écrire quelque chose avant d'enregistrer.");
      return;
    }
    const newEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      mood: selectedMood,
      text: journalText,
    };
    const updated = [newEntry, ...journalEntries];
    setJournalEntries(updated);
    localStorage.setItem(`majal_journal_entries_${user.id}`, JSON.stringify(updated));
    setJournalText("");
    toast.success("✅ Entrée de journal enregistrée avec succès !");
  };

  const deleteEntry = (id: string) => {
    const updated = journalEntries.filter(e => e.id !== id);
    setJournalEntries(updated);
    localStorage.setItem(`majal_journal_entries_${user.id}`, JSON.stringify(updated));
    toast.success("✅ Entrée supprimée.");
  };

  const moods = [
    { id: "happy", emoji: "🌟", color: "from-amber-400/25 to-yellow-500/25 text-amber-700 border-amber-300/40" },
    { id: "calm", emoji: "🧘", color: "from-teal-400/25 to-emerald-500/25 text-teal-800 border-teal-300/40" },
    { id: "neutral", emoji: "☁️", color: "from-gray-300/25 to-slate-400/25 text-slate-700 border-slate-300/40" },
    { id: "sad", emoji: "🌧️", color: "from-blue-400/25 to-indigo-500/25 text-blue-800 border-blue-300/40" },
    { id: "anxious", emoji: "⚡", color: "from-purple-400/25 to-fuchsia-500/25 text-purple-800 border-purple-300/40" },
    { id: "angry", emoji: "🌋", color: "from-red-400/25 to-rose-500/25 text-red-800 border-rose-300/40" },
  ];

  const moodCounts = journalEntries.reduce((acc, entry) => {
    acc[entry.mood] = (acc[entry.mood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let primaryMood = "calm";
  let maxCount = 0;
  Object.entries(moodCounts).forEach(([m, count]) => {
    if (count > maxCount) {
      maxCount = count;
      primaryMood = m;
    }
  });

  const activePrimaryMood = moods.find(m => m.id === primaryMood);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-6">
          <div className="dashboard-card p-6 md:p-8 space-y-6">
            <h3 className="font-serif text-xl font-semibold text-foreground">{t("space.journal.title")}</h3>
            
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Comment vous sentez-vous ?
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {moods.map((m) => {
                  const active = selectedMood === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMood(m.id)}
                      className={`p-3 rounded-2xl border bg-gradient-to-br flex flex-col items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer border-solid ${
                        active 
                          ? `${m.color} ring-2 ring-primary scale-105 shadow-md` 
                          : "from-card to-card hover:bg-accent/40 border-border/50 scale-100"
                      }`}
                    >
                      <span className="text-2xl">{m.emoji}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {t(`space.journal.mood.${m.id}`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <textarea
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                rows={5}
                placeholder={t("space.journal.placeholder")}
                className="w-full px-4 py-3 border border-border/70 rounded-2xl text-sm text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card font-sans transition-all resize-none leading-relaxed"
              />
            </div>

            <button
              onClick={saveJournalEntry}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all flex items-center justify-center gap-2 font-sans"
            >
              <BookOpen className="w-4 h-4" />
              {t("space.journal.save")}
            </button>
          </div>

          <div className="dashboard-card p-6 md:p-8 space-y-6">
            <h3 className="font-serif text-lg font-semibold text-foreground">{t("space.journal.history")}</h3>
            {journalEntries.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-25" />
                <p className="text-sm font-medium">{t("space.journal.noEntries")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {journalEntries.map((e) => {
                  const moodDetail = moods.find(m => m.id === e.mood) || moods[2];
                  return (
                    <div key={e.id} className="p-5 border border-border/40 rounded-2xl hover:border-primary/25 transition-all duration-300 bg-teal-hero/10 relative group">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{moodDetail.emoji}</span>
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-pale text-primary border border-primary/5">
                            {t(`space.journal.mood.${e.mood}`)}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-sans">
                            {new Date(e.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteEntry(e.id)}
                          className="p-1 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-all border-none bg-transparent cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans font-normal">{e.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="dashboard-card p-6 space-y-4 bg-gradient-to-br from-teal-pale/45 to-teal-hero/30 border border-primary/10">
            <h4 className="font-serif text-base font-semibold text-primary">{t("space.journal.insights")}</h4>
            {journalEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Écrivez des notes dans votre journal pour voir apparaître vos statistiques et tendances émotionnelles.
              </p>
            ) : (
              <div className="space-y-4 font-sans">
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("space.journal.insightsDesc")}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-3xl">{activePrimaryMood?.emoji}</span>
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {t(`space.journal.mood.${primaryMood}`)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Apparu {maxCount} fois sur {journalEntries.length} notes
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Répartition</div>
                  {moods.map(m => {
                    const count = moodCounts[m.id] || 0;
                    if (count === 0) return null;
                    const pct = Math.round((count / journalEntries.length) * 100);
                    return (
                      <div key={m.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-foreground">
                          <span>{m.emoji} {t(`space.journal.mood.${m.id}`)}</span>
                          <span>{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <CrisisHelpline />
        </div>
      </div>
    </div>
  );
}
