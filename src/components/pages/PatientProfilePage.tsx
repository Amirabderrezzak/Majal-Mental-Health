import { useState } from "react";
import { Lock, Loader2, Smartphone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProfileFormSkeleton } from "@/components/LoadingSkeletons";

interface PatientProfilePageProps {
  profile: { full_name: string; phone: string; language: string; avatar_url?: string };
  setProfile: (p: any) => void;
  profileLoading: boolean;
  initials: string;
  pushSupported: boolean;
  pushSubscribed: boolean;
  pushLoading: boolean;
  pushToggle: () => Promise<boolean>;
}

export default function PatientProfilePage({
  profile,
  setProfile,
  profileLoading,
  initials,
  pushSupported,
  pushSubscribed,
  pushLoading,
  pushToggle,
}: PatientProfilePageProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setProfile((p: any) => ({ ...p, avatar_url: publicUrl }));
      toast.success("✅ Photo de profil mise à jour !");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error(err.message || "Erreur lors de l'upload de l'avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({ user_id: user.id, ...profile });
    setSaving(false);
    if (error) toast.error("Erreur lors de la sauvegarde.");
    else toast.success("✅ Profil mis à jour !");
  };

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
    <div className="p-4 sm:p-6 max-w-2xl space-y-8 animate-in fade-in duration-500">
      <div className="dashboard-card p-6 md:p-8">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("space.personalInfo")}</h3>
        
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 pb-6 border-b border-border/30">
          <div className="relative group shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 shadow-md group-hover:opacity-90 transition-opacity" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-teal-pale flex items-center justify-center text-primary text-3xl font-bold border border-primary/10 shadow-inner group-hover:bg-teal-hero transition-colors">{initials}</div>
            )}
            <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/45 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer text-white text-[11px] font-semibold text-center p-1">
              {uploadingAvatar ? "Upload..." : "Changer"}
            </label>
            <input type="file" id="avatar-upload" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} className="hidden" />
          </div>
          
          <div className="text-center sm:text-left">
            <h4 className="font-semibold text-base text-foreground leading-snug">{profile.full_name || t("space.yourName")}</h4>
            <p className="text-sm text-muted-foreground mt-0.5 font-sans">{user?.email}</p>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-teal-pale text-primary text-[10px] uppercase font-bold tracking-wider">{t("space.lang.french")}</span>
          </div>
        </div>

        {profileLoading ? (
          <ProfileFormSkeleton />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.fullName")}</label>
              <input 
                type="text" 
                value={profile.full_name} 
                onChange={e => setProfile((p: any) => ({ ...p, full_name: e.target.value }))}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("auth.email")}</label>
              <input 
                type="email" 
                value={user?.email ?? ""} 
                readOnly
                className="px-4 py-3 border border-border/50 rounded-xl text-sm bg-teal-hero/10 opacity-65 cursor-not-allowed font-sans text-muted-foreground" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.phone")}</label>
              <input 
                type="tel" 
                value={profile.phone} 
                onChange={e => setProfile((p: any) => ({ ...p, phone: e.target.value }))}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.language")}</label>
              <select 
                value={profile.language} 
                onChange={e => setProfile((p: any) => ({ ...p, language: e.target.value }))}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card transition-all font-sans cursor-pointer"
              >
                <option>{t("space.lang.french")}</option>
                <option>{t("space.lang.arabic")}</option>
                <option>{t("space.lang.english")}</option>
              </select>
            </div>
          </div>
        )}

        <button 
          onClick={saveProfile} 
          disabled={saving}
          className="w-full mt-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid hover:shadow-sm transition-all disabled:opacity-70 flex items-center justify-center gap-2 font-sans"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? t("space.saving") : t("space.save")}
        </button>
      </div>

      <div className="dashboard-card p-6 md:p-8">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("psy.settings.security") || "Sécurité"}</h3>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4 max-w-md">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("reset.newPassword") || "Nouveau mot de passe"}</label>
            <div className="flex items-center gap-3 border border-border/70 rounded-xl px-4 py-3 bg-teal-hero/30 focus-within:border-primary focus-within:bg-card transition-all focus-within:ring-1 focus-within:ring-primary">
              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="border-none bg-transparent outline-none text-sm text-foreground w-full placeholder:text-muted-foreground/60 font-sans"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={changingPassword}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-50 mt-2 font-sans shadow-sm"
          >
            {changingPassword ? "Mise à jour..." : t("psy.settings.changePassword") || "Changer le mot de passe"}
          </button>
        </form>
      </div>

      <div className="dashboard-card p-6 md:p-8">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("space.notifPreferences") || "Notifications"}</h3>
        {pushSupported ? (
          <div className="flex items-center justify-between py-2">
            <div className="pe-4">
              <h4 className="text-sm font-semibold text-foreground">{t("space.pushNotifications")}</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-normal font-sans">{t("space.pushNotificationsDesc")}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pushSubscribed}
              disabled={pushLoading}
              onClick={async () => {
                const was = pushSubscribed;
                const ok = await pushToggle();
                if (ok) toast.success(was ? "Notifications push désactivées." : "Notifications push activées !");
                else toast.error("Impossible d'activer les notifications...");
              }}
              className={`relative w-12 h-[26px] rounded-full transition-colors duration-300 border-none cursor-pointer disabled:opacity-50 ${pushSubscribed ? "bg-primary" : "bg-gray-300"}`}
            >
              <span className={`absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${pushSubscribed ? "translate-x-[22px]" : ""}`} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-3 text-muted-foreground">
            <Smartphone className="w-4 h-4 shrink-0" />
            <p className="text-xs font-sans">{t("space.pushNotSupported")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
