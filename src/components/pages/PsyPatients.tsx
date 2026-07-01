import { useState, useEffect } from "react";
import { Users, MessageSquare, User, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PatientCardSkeleton } from "@/components/LoadingSkeletons";
import type { Page } from "./PsySidebar";

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

interface PsyPatientsProps {
  realPatients: { id: string; name: string; initials: string; sessions: number; lastSeen: string }[];
  bookingsLoading: boolean;
  bookings: Booking[];
  setActivePage: (p: Page) => void;
  setActiveChatUserId: (id: string | null) => void;
  setActiveChatUserName: (name: string) => void;
}

function PatientDetailsDrawer({
  selectedPatientId, setSelectedPatientId, selectedPatientInitials,
  selectedPatientName, selectedPatientSessions, selectedPatientLastSeen
}: {
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;
  selectedPatientInitials: string;
  selectedPatientName: string;
  selectedPatientSessions: number;
  selectedPatientLastSeen: string;
}) {
  const { t, dir } = useLanguage();
  const { user } = useAuth();
  const [clinicalNotes, setClinicalNotes] = useState("");

  useEffect(() => {
    if (!user || !selectedPatientId) { setClinicalNotes(""); return; }
    const loadNotes = async () => {
      const { data } = await supabase
        .from("clinical_notes")
        .select("notes")
        .eq("psychologist_id", user.id)
        .eq("patient_id", selectedPatientId)
        .maybeSingle();
      setClinicalNotes(data?.notes || "");
    };
    loadNotes();
  }, [user, selectedPatientId]);

  const saveClinicalNotes = async () => {
    if (!user || !selectedPatientId) return;
    const { error } = await supabase
      .from("clinical_notes")
      .upsert(
        { psychologist_id: user.id, patient_id: selectedPatientId, notes: clinicalNotes, updated_at: new Date().toISOString() },
        { onConflict: "psychologist_id,patient_id" }
      );
    if (error) {
      toast.error("Erreur lors de la sauvegarde des notes.");
    } else {
      toast.success(t("psy.patients.notes.success"));
    }
  };

  if (!selectedPatientId) return null;
  const isRtl = dir === "rtl";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-xs transition-opacity" onClick={() => setSelectedPatientId(null)} />
      <div className={`relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between p-6 md:p-8 animate-in ${isRtl ? "slide-in-from-left duration-300" : "slide-in-from-right duration-300"}`}>
        <div className="space-y-6 flex-1 overflow-y-auto pr-1">
          <div className="flex items-start justify-between pb-4 border-b border-border/40">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-base border border-solid border-primary/5 shadow-sm shrink-0">
                {selectedPatientInitials}
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold text-foreground">{selectedPatientName}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-sans">Patient Majal</p>
              </div>
            </div>
            <button onClick={() => setSelectedPatientId(null)} className="p-1.5 rounded-lg hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-all border-none bg-transparent cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-teal-hero/10 border border-solid border-primary/5 text-center font-sans">
            <div className="border-r border-solid border-border/30">
              <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Séances totales</div>
              <div className="text-lg font-bold text-foreground mt-1">{selectedPatientSessions}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Dernière visite</div>
              <div className="text-sm font-semibold text-primary mt-1.5">{selectedPatientLastSeen}</div>
            </div>
          </div>

          <div className="space-y-3 flex-1 flex flex-col">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              {t("psy.patients.notes.title")}
            </label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows={12}
              placeholder={t("psy.patients.notes.placeholder")}
              className="w-full flex-1 px-4 py-3.5 border border-border/70 rounded-2xl text-sm text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card font-sans transition-all resize-none leading-relaxed"
            />
            <span className="text-[10px] text-muted-foreground italic font-sans block">
              🔒 Ces notes cliniques sont stockées de manière sécurisée et confidentielle.
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-solid border-border/40 flex gap-3 mt-4">
          <button onClick={() => setSelectedPatientId(null)} className="px-4 py-3 border border-solid border-border/50 hover:bg-accent/40 rounded-xl text-xs font-semibold text-muted-foreground bg-transparent cursor-pointer transition-all">
            {t("psy.common.close")}
          </button>
          <button onClick={saveClinicalNotes} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all">
            {t("psy.patients.notes.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PsyPatients({
  realPatients, bookingsLoading, bookings,
  setActivePage, setActiveChatUserId, setActiveChatUserName
}: PsyPatientsProps) {
  const { t } = useLanguage();

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");
  const [selectedPatientInitials, setSelectedPatientInitials] = useState<string>("");
  const [selectedPatientSessions, setSelectedPatientSessions] = useState<number>(0);
  const [selectedPatientLastSeen, setSelectedPatientLastSeen] = useState<string>("");

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-2xl text-foreground font-semibold">{t("psy.dashboard.myPatients")}</h3>
        <span className="text-xs font-semibold px-3 py-1 bg-teal-pale text-primary rounded-full border border-primary/5">{realPatients.length} patients</span>
      </div>

      {bookingsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <PatientCardSkeleton key={i} />)}
        </div>
      ) : realPatients.length === 0 ? (
        <div className="dashboard-card p-10 text-center text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
          <p className="text-sm font-medium">{t("psy.dashboard.noPatients")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {realPatients.map((p) => {
            const matchingBooking = bookings.find(b => b.patient_id === p.id);
            const avatarUrl = matchingBooking?.patient_avatar;

            return (
              <div key={p.id} className="dashboard-card p-6 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-start gap-4">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={p.name} className="w-12 h-12 rounded-full object-cover border border-primary/10 shrink-0 shadow-sm" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-teal-pale flex items-center justify-center text-primary font-bold text-base shrink-0 border border-primary/5 shadow-sm">
                      {p.initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="font-semibold text-base text-foreground truncate">{p.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 font-sans">Patient Majal</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border/40 text-center font-sans">
                  <div className="border-r border-border/30">
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Séances</div>
                    <div className="text-lg font-bold text-foreground mt-1">{p.sessions}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Dernier rendez-vous</div>
                    <div className="text-xs font-semibold text-primary mt-2">{p.lastSeen}</div>
                  </div>
                </div>

                <div className="flex gap-2.5 mt-6">
                  <button
                    onClick={() => { setActivePage("messages"); setActiveChatUserId(p.id); setActiveChatUserName(p.name); }}
                    className="flex-1 py-2.5 rounded-xl bg-teal-pale text-primary hover:bg-primary hover:text-white transition-all text-xs font-semibold border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {t("space.messageBtn")}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setSelectedPatientName(p.name);
                      setSelectedPatientInitials(p.initials);
                      setSelectedPatientSessions(p.sessions);
                      setSelectedPatientLastSeen(p.lastSeen);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-accent/40 text-muted-foreground hover:bg-primary hover:text-white transition-all text-xs font-semibold border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                    title={t("psy.patients.notes.title")}
                  >
                    <User className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <PatientDetailsDrawer
        selectedPatientId={selectedPatientId}
        setSelectedPatientId={setSelectedPatientId}
        selectedPatientInitials={selectedPatientInitials}
        selectedPatientName={selectedPatientName}
        selectedPatientSessions={selectedPatientSessions}
        selectedPatientLastSeen={selectedPatientLastSeen}
      />
    </div>
  );
}
