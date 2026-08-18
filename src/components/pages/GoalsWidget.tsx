import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MIGRATION_ERROR = "Erreur de sauvegarde. Veuillez exécuter la migration SQL.";

type GoalRow = { id: string; text: string; completed: boolean };

export default function GoalsWidget() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [goals, setGoals] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [newGoalText, setNewGoalText] = useState("");
  const [prepNotes, setPrepNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const defaultGoals = [
      { id: "1", text: "Prendre conscience des mes émotions quotidiennes", completed: false },
      { id: "2", text: "Pratiquer 5 minutes de respiration carrée", completed: false },
      { id: "3", text: "Discuter ouvertement de mes craintes lors de la prochaine séance", completed: false }
    ];

    const load = async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (!cancelled && error) {
        console.error(error);
      }

      if (!cancelled && data && data.length > 0) {
        const rows = data as unknown as GoalRow[];
        const mapped = rows.map((row) => ({
          id: row.id,
          text: row.text,
          completed: row.completed,
        }));
        setGoals(mapped);
        localStorage.setItem(`majal_goals_${user.id}`, JSON.stringify(mapped));
      } else {
        const storedGoals = localStorage.getItem(`majal_goals_${user.id}`);
        if (storedGoals) {
          try {
            if (!cancelled) setGoals(JSON.parse(storedGoals));
          } catch (e) { console.error(e); }
        } else if (!cancelled) {
          setGoals(defaultGoals);
          localStorage.setItem(`majal_goals_${user.id}`, JSON.stringify(defaultGoals));
        }
      }

      const { data: profile, error: pError } = await supabase
        .from("profiles")
        .select("prep_notes")
        .eq("user_id", user.id)
        .single();

      if (!cancelled && pError) {
        console.error(pError);
      }

      if (!cancelled && profile && profile.prep_notes != null) {
        setPrepNotes(profile.prep_notes);
        localStorage.setItem(`majal_prep_notes_${user.id}`, profile.prep_notes);
      } else {
        const storedNotes = localStorage.getItem(`majal_prep_notes_${user.id}`);
        if (storedNotes && !cancelled) setPrepNotes(storedNotes);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user]);

  const toggleGoal = (id: string) => {
    const target = goals.find(g => g.id === id);
    const updated = goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g);
    setGoals(updated);
    localStorage.setItem(`majal_goals_${user.id}`, JSON.stringify(updated));

    if (target) {
      supabase
        .from("goals")
        .update({ completed: !target.completed })
        .eq("id", id)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error(error);
            toast.error(MIGRATION_ERROR);
          }
        });
    }
  };

  const addGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalText.trim()) return;
    const newGoal = {
      id: Date.now().toString(),
      text: newGoalText.trim(),
      completed: false
    };
    const updated = [...goals, newGoal];
    setGoals(updated);
    localStorage.setItem(`majal_goals_${user.id}`, JSON.stringify(updated));
    setNewGoalText("");
    toast.success("Nouvel objectif ajouté !");

    supabase
      .from("goals")
      .insert({ user_id: user.id, text: newGoal.text, completed: false })
      .then(({ error }) => {
        if (error) {
          console.error(error);
          toast.error(MIGRATION_ERROR);
        }
      });
  };

  const deleteGoal = (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    localStorage.setItem(`majal_goals_${user.id}`, JSON.stringify(updated));

    supabase
      .from("goals")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .then(({ error }) => {
        if (error) {
          console.error(error);
          toast.error(MIGRATION_ERROR);
        }
      });
  };

  const savePrepNotes = (val: string) => {
    setPrepNotes(val);
    localStorage.setItem(`majal_prep_notes_${user.id}`, val);
    supabase
      .from("profiles")
      .update({ prep_notes: val })
      .eq("user_id", user.id)
      .then(({ error }) => {
        if (error) {
          console.error(error);
          toast.error(MIGRATION_ERROR);
        }
      });
  };

  const completedCount = goals.filter(g => g.completed).length;
  const progressPct = goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="dashboard-card p-6 space-y-5">
        <h3 className="font-serif text-lg font-semibold text-foreground flex items-center justify-between pb-4 border-b border-border/40">
          <span>{t("space.goals.title")}</span>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-pale text-primary border border-primary/5">{progressPct}%</span>
        </h3>

        <div className="w-full bg-accent/30 rounded-full h-2 overflow-hidden shadow-inner">
          <div className="bg-primary h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
          {goals.map(g => (
            <div key={g.id} className="flex items-center justify-between gap-3 p-3 border border-border/40 rounded-xl bg-teal-hero/5 hover:bg-teal-hero/15 transition-all">
              <label className="flex items-center gap-3 cursor-pointer select-none min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={g.completed}
                  onChange={() => toggleGoal(g.id)}
                  className="w-4 h-4 accent-primary cursor-pointer border-border rounded"
                />
                <span className={`text-sm text-foreground truncate ${g.completed ? "line-through text-muted-foreground" : ""}`}>{g.text}</span>
              </label>
              <button
                onClick={() => deleteGoal(g.id)}
                className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all border-none bg-transparent cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={addGoal} className="flex gap-2">
          <input
            type="text"
            value={newGoalText}
            onChange={e => setNewGoalText(e.target.value)}
            placeholder={t("space.goals.placeholder")}
            className="flex-1 px-4 py-2.5 border border-border/70 rounded-xl text-xs bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans"
          />
          <button
            type="submit"
            className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-teal-mid transition-all border-none cursor-pointer shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>

      <div className="dashboard-card p-6 space-y-4">
        <h3 className="font-serif text-lg font-semibold text-foreground pb-4 border-b border-border/40">
          {t("space.goals.notepad")}
        </h3>
        <textarea
          value={prepNotes}
          onChange={e => savePrepNotes(e.target.value)}
          rows={4}
          placeholder={t("space.goals.notepadPlaceholder")}
          className="w-full px-4 py-3 border border-border/70 rounded-xl text-xs text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card font-sans transition-all resize-none leading-relaxed"
        />
        <div className="text-[10px] text-muted-foreground text-right font-sans italic">Sauvegarde automatique (cloud)</div>
      </div>
    </div>
  );
}
