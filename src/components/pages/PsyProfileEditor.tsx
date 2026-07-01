import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CATEGORIES } from "@/lib/categories";

interface PsyProfileEditorProps {
  profileData: {
    full_name: string;
    specialty: string;
    bio: string;
    city: string;
    price_per_session: number;
    years_experience: number;
    phone: string;
    avatar_url: string;
  };
  setProfileData: (cb: (prev: any) => any) => void;
  uploadingAvatar: boolean;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  saveProfile: () => Promise<void>;
  saving: boolean;
  psySpecs: { category_id: string; subcategory_id: string }[];
  savingSpecs: boolean;
  toggleSpec: (categoryId: string, subcategoryId: string) => Promise<void>;
}

export default function PsyProfileEditor({
  profileData, setProfileData, uploadingAvatar, handleAvatarUpload,
  saveProfile, saving, psySpecs, savingSpecs, toggleSpec
}: PsyProfileEditorProps) {
  const { t, lang } = useLanguage();

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6 animate-in fade-in duration-500">
      <div className="dashboard-card p-6 md:p-8">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-6 pb-4 border-b border-border/40">{t("psy.dashboard.profile.professionalInfo")}</h3>

        <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 pb-6 border-b border-border/30">
          <div className="relative group shrink-0">
            {profileData.avatar_url ? (
              <img src={profileData.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 shadow-md group-hover:opacity-90 transition-opacity" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-teal-pale flex items-center justify-center text-primary text-3xl font-bold border border-primary/10 shadow-inner group-hover:bg-teal-hero transition-colors">
                {profileData.full_name ? profileData.full_name.charAt(0).toUpperCase() : "P"}
              </div>
            )}
            <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/45 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer text-white text-[11px] font-semibold text-center p-1">
              {uploadingAvatar ? "Upload..." : "Changer"}
            </label>
            <input type="file" id="avatar-upload" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} className="hidden" />
          </div>
          <div className="text-center sm:text-left">
            <h4 className="font-semibold text-base text-foreground leading-snug">{profileData.full_name || "Praticien"}</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-normal">Formats acceptés : JPG, PNG, WEBP (max 5 Mo)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {([
            { label: t("space.fullName"),                      key: "full_name",        type: "text" },
            { label: t("space.phone"),                         key: "phone",            type: "tel" },
            { label: t("auth.specialtyLabel"),                 key: "specialty",        type: "text" },
            { label: t("auth.cityLabel"),                      key: "city",             type: "text" },
            { label: t("complete.step1.price"),                key: "price_per_session",type: "number" },
            { label: t("psy.dashboard.profile.yearsExperience"), key: "years_experience", type: "number" },
          ] as const).map((f) => (
            <div key={f.key} className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{f.label}</label>
              <input
                type={f.type}
                value={profileData[f.key]}
                onChange={(e) => setProfileData((p) => ({ ...p, [f.key]: f.type === "number" ? parseInt(e.target.value) || 0 : e.target.value }))}
                className="px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card font-sans transition-all"
              />
            </div>
          ))}
        </div>

        <div className="mt-5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">{t("psy.dashboard.profile.bio")}</label>
          <textarea
            value={profileData.bio}
            onChange={(e) => setProfileData((p) => ({ ...p, bio: e.target.value }))}
            rows={4}
            placeholder={t("psy.dashboard.profile.bioPlaceholder")}
            className="w-full px-4 py-3 border border-border/70 rounded-xl text-sm text-foreground bg-teal-hero/30 outline-none hover:border-primary/30 focus:border-primary focus:bg-card font-sans transition-all resize-none leading-relaxed"
          />
        </div>
      </div>

      <div className="dashboard-card p-6 md:p-8 space-y-5">
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground pb-4 border-b border-border/40">
            {t("psy.settings.specializations.title") || "Spécialisations"}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            {t("psy.settings.specializations.desc") || "Sélectionnez les domaines dans lesquels vous intervenez. Les patients pourront vous trouver en filtrant par catégorie."}
          </p>
        </div>
        <div className="space-y-5">
          {CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <span className="text-base">{cat.icon}</span> {cat.label[lang]}
              </h4>
              <div className="flex flex-wrap gap-2">
                {cat.subcategories.map((sub) => {
                  const isActive = psySpecs.some(
                    (s) => s.category_id === cat.id && s.subcategory_id === sub.id
                  );
                  return (
                    <button
                      key={sub.id}
                      onClick={() => toggleSpec(cat.id, sub.id)}
                      disabled={savingSpecs}
                      className={`px-3.5 py-2 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-foreground border-border hover:border-primary/30 hover:bg-teal-pale/30"
                      }`}
                    >
                      {sub.label[lang]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={saveProfile}
        disabled={saving}
        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold border-none cursor-pointer hover:bg-teal-mid transition-all disabled:opacity-70 flex items-center justify-center gap-2 font-sans hover:shadow-sm"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? t("space.saving") : t("space.save")}
      </button>
    </div>
  );
}
