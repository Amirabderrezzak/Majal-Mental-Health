import { useState } from "react";
import { Lock, Video, Plus, Loader2, AlertTriangle, Clock, X, Smartphone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PsySettingsPageProps {
  clinicSettings: {
    vacationMode: boolean;
    autoConfirm: boolean;
    acceptingNew: boolean;
    startHour: string;
    endHour: string;
    bufferMinutes: number;
    workingDays: string[];
  };
  updateClinicSetting: (key: string, value: any) => void;
  notificationPreferences: {
    newBookings: boolean;
    reminders: boolean;
    messages: boolean;
    payments: boolean;
  };
  updateNotificationPreference: (key: string, value: boolean) => void;
  isAvailableNow: boolean;
  setIsAvailableNow: (v: boolean) => void;
  videoPreviewUrl: string | null;
  handleRemoveVideo: () => Promise<void>;
  uploadingVideo: boolean;
  handleSaveVideo: (file: File) => Promise<void>;
  pushSupported: boolean;
  pushSubscribed: boolean;
  pushLoading: boolean;
  pushToggle: () => Promise<boolean>;
}

export default function PsySettingsPage({
  clinicSettings, updateClinicSetting, notificationPreferences, updateNotificationPreference,
  isAvailableNow, setIsAvailableNow,
  videoPreviewUrl, handleRemoveVideo, uploadingVideo, handleSaveVideo,
  pushSupported, pushSubscribed, pushLoading, pushToggle
}: PsySettingsPageProps) {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("✅ Mot de passe mis à jour avec succès !");
      setNewPassword("");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-6 animate-in fade-in duration-500">
      <div className="dashboard-card p-6 md:p-8 space-y-6">
        <h3 className="font-serif text-lg font-semibold text-foreground pb-4 border-b border-border/40">
          {t("psy.settings.clinic.title")}
        </h3>

        <div className="space-y-4">
          {[
            { title: t("psy.settings.vacation.title"), desc: t("psy.settings.vacation.desc"), key: "vacationMode", checked: clinicSettings.vacationMode },
            { title: t("psy.settings.autoconfirm.title"), desc: t("psy.settings.autoconfirm.desc"), key: "autoConfirm", checked: clinicSettings.autoConfirm },
            { title: t("psy.settings.accepting.title"), desc: t("psy.settings.accepting.desc"), key: "acceptingNew", checked: clinicSettings.acceptingNew }
          ].map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2.5">
              <div className="pe-4">
                <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-normal font-sans">{s.desc}</p>
              </div>
              <label className="relative w-12 h-[26px] shrink-0">
                <input
                  type="checkbox"
                  checked={s.checked}
                  onChange={(e) => updateClinicSetting(s.key, e.target.checked)}
                  className="opacity-0 w-0 h-0"
                />
                <span className="toggle-slider" />
              </label>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-border/40 space-y-5">
          <h4 className="font-serif text-base font-semibold text-foreground">{t("psy.settings.hours.title")}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 font-sans">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("psy.settings.hours.start")}</label>
              <input type="time" value={clinicSettings.startHour} onChange={(e) => updateClinicSetting("startHour", e.target.value)}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans cursor-pointer" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("psy.settings.hours.end")}</label>
              <input type="time" value={clinicSettings.endHour} onChange={(e) => updateClinicSetting("endHour", e.target.value)}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans cursor-pointer" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("psy.settings.hours.buffer")}</label>
              <select value={clinicSettings.bufferMinutes} onChange={(e) => updateClinicSetting("bufferMinutes", parseInt(e.target.value))}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans cursor-pointer font-sans">
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={20}>20 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("psy.settings.hours.days")}</label>
            <div className="flex flex-wrap gap-2.5 mt-1 font-sans">
              {[
                { val: "Sun", label: "Dim" }, { val: "Mon", label: "Lun" }, { val: "Tue", label: "Mar" },
                { val: "Wed", label: "Mer" }, { val: "Thu", label: "Jeu" }, { val: "Fri", label: "Ven" }, { val: "Sat", label: "Sam" }
              ].map((d) => {
                const active = clinicSettings.workingDays.includes(d.val);
                return (
                  <button key={d.val} type="button"
                    onClick={() => {
                      const updatedDays = active
                        ? clinicSettings.workingDays.filter(day => day !== d.val)
                        : [...clinicSettings.workingDays, d.val];
                      updateClinicSetting("workingDays", updatedDays);
                    }}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl border border-solid transition-all cursor-pointer ${
                      active ? "bg-teal-pale border-primary/20 text-primary scale-105" : "bg-transparent hover:bg-accent/40 border-border/60 text-muted-foreground scale-100"
                    }`}>
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-card p-6 md:p-8 space-y-4">
        <h3 className="font-serif text-lg font-semibold text-foreground pb-4 border-b border-border/40">{t("psy.settings.availability.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("psy.settings.availability.desc")}</p>
        <div className="flex items-center justify-between py-2.5">
          <div className="pe-4">
            <h4 className="text-sm font-semibold text-foreground">{t("psy.availableNow")}</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-normal font-sans">{t("psy.settings.availability.desc")}</p>
          </div>
          <label className="relative w-12 h-[26px] shrink-0">
            <input type="checkbox" checked={isAvailableNow} onChange={(e) => setIsAvailableNow(e.target.checked)} className="opacity-0 w-0 h-0" />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="dashboard-card p-6 md:p-8 space-y-4">
        <h3 className="font-serif text-lg font-semibold text-foreground pb-4 border-b border-border/40">{t("psy.settings.video.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("psy.settings.video.desc")}</p>
        {videoPreviewUrl ? (
          <div className="space-y-3">
            <div className="aspect-video rounded-xl overflow-hidden border border-border">
              <video src={videoPreviewUrl} controls className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleRemoveVideo} className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors cursor-pointer">
                {t("psy.settings.video.remove")}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 transition-colors">
            <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              {lang === "ar" ? "ارفع فيديو تعريفي (حد أقصى 59 ثانية)" : "Téléchargez une vidéo de présentation (max 59 secondes)"}
            </p>
            <p className="text-xs text-muted-foreground/70 mb-4">MP4, WebM ou OGG</p>
            <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-teal-mid transition-colors cursor-pointer">
              {uploadingVideo ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{lang === "ar" ? "جارٍ الرفع..." : "Upload..."}</>
              ) : (
                <><Plus className="w-4 h-4" />{t("psy.settings.video.upload")}</>
              )}
              <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleSaveVideo(file); e.target.value = ""; }}
                disabled={uploadingVideo} className="hidden" />
            </label>
          </div>
        )}
      </div>

      <div className="dashboard-card p-6 md:p-8">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("space.notifPreferences")}</h3>
        <div className="space-y-1">
          <div className="flex items-center justify-between py-4 border-b border-border/30">
            <div className="pe-4">
              <h4 className="text-sm font-semibold text-foreground">{t("space.pushNotifications")}</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-normal font-sans">{t("space.pushNotificationsDesc")}</p>
            </div>
            {pushSupported ? (
              <button type="button" role="switch" aria-checked={pushSubscribed} disabled={pushLoading}
                onClick={async () => {
                  const was = pushSubscribed;
                  const ok = await pushToggle();
                  if (ok) toast.success(was ? "Notifications push désactivées." : "Notifications push activées !");
                  else toast.error("Impossible d'activer les notifications...");
                }}
                className={`relative w-12 h-[26px] rounded-full transition-colors duration-300 border-none cursor-pointer disabled:opacity-50 shrink-0 ${pushSubscribed ? "bg-primary" : "bg-gray-300"}`}>
                <span className={`absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${pushSubscribed ? "translate-x-[22px]" : ""}`} />
              </button>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                <Smartphone className="w-4 h-4" />
                <span className="text-[10px] font-sans">N/A</span>
              </div>
            )}
          </div>
          {[
            { key: "newBookings", title: t("psy.settings.notif.newBookingsTitle"), desc: t("psy.settings.notif.newBookingsDesc"), checked: notificationPreferences.newBookings },
            { key: "reminders",   title: t("psy.settings.notif.remindersTitle"),   desc: t("psy.settings.notif.remindersDesc"),   checked: notificationPreferences.reminders },
            { key: "messages",    title: t("psy.settings.notif.messagesTitle"),    desc: t("psy.settings.notif.messagesDesc"),    checked: notificationPreferences.messages },
            { key: "payments",    title: t("psy.settings.notif.paymentsTitle"),    desc: t("psy.settings.notif.paymentsDesc"),    checked: notificationPreferences.payments },
          ].map((n, i, arr) => (
            <div key={n.key} className={`flex items-center justify-between py-4 ${i < arr.length - 1 ? "border-b border-border/30" : ""}`}>
              <div className="pe-4">
                <h4 className="text-sm font-semibold text-foreground">{n.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-normal font-sans">{n.desc}</p>
              </div>
              <label className="relative w-12 h-[26px] shrink-0">
                <input
                  type="checkbox"
                  checked={n.checked}
                  onChange={(e) => updateNotificationPreference(n.key, e.target.checked)}
                  className="opacity-0 w-0 h-0"
                />
                <span className="toggle-slider" />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-card p-6 md:p-8">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("psy.settings.security") || "Sécurité"}</h3>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4 max-w-md">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("reset.newPassword") || "Nouveau mot de passe"}</label>
            <div className="flex items-center gap-3 border border-border/70 rounded-xl px-4 py-3 bg-teal-hero/30 focus-within:border-primary focus-within:bg-card transition-all focus-within:ring-1 focus-within:ring-primary">
              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••"
                className="border-none bg-transparent outline-none text-sm text-foreground w-full placeholder:text-muted-foreground/60 font-sans" />
            </div>
          </div>
          <button type="submit" disabled={changingPassword}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-50 mt-2 font-sans shadow-sm">
            {changingPassword ? "Mise à jour..." : t("psy.settings.changePassword") || "Changer le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
}
