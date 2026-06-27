import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, Clock, DollarSign, Loader2, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePsychologists, type PsyProfile } from "@/hooks/use-psychologists";

const CATEGORIES = [
  {
    id: "anxiety",
    label: { fr: "Anxiété & Stress", ar: "القلق والتوتر" },
    icon: "😰",
    subcategories: [
      { id: "generalized", label: { fr: "Anxiété généralisée", ar: "القلق المزمن" }, keywords: ["anxiété", "anxiety", "généralisée", "generalized"] },
      { id: "social", label: { fr: "Anxiété sociale", ar: "القلق الاجتماعي" }, keywords: ["social"] },
      { id: "panic", label: { fr: "Trouble panique", ar: "النوبات الهلع" }, keywords: ["panique", "panic"] },
      { id: "phobias", label: { fr: "Phobies", ar: "الرهاب" }, keywords: ["phobie", "phobia"] },
      { id: "stress", label: { fr: "Stress & burnout", ar: "الإجهاد المهني" }, keywords: ["stress", "burnout"] },
    ],
  },
  {
    id: "depression",
    label: { fr: "Dépression & Humeur", ar: "الاكتئاب والمزاج" },
    icon: "😔",
    subcategories: [
      { id: "mde", label: { fr: "Dépression majeure", ar: "الاكتئاب الجسيم" }, keywords: ["dépression", "depression", "majeure"] },
      { id: "dysthymia", label: { fr: "Dysthymie", ar: "الاكتئاب المزمن" }, keywords: ["dysthymie", "dysthymia"] },
      { id: "bipolar", label: { fr: "Bipolarité", ar: "الاضطراب ثنائي القطب" }, keywords: ["bipolar"] },
      { id: "burnout", label: { fr: "Épuisement professionnel", ar: "الانهيار المهني" }, keywords: ["épuisement", "épuisement professionnel"] },
    ],
  },
  {
    id: "relations",
    label: { fr: "Relations & Couple", ar: "العلاقات والזוגية" },
    icon: "💑",
    subcategories: [
      { id: "couple", label: { fr: "Thérapie de couple", ar: "العلاج الزوجي" }, keywords: ["couple", "couple", "marital"] },
      { id: "family", label: { fr: "Conflits familiaux", ar: "الصراعات العائلية" }, keywords: ["famille", "family", "familial"] },
      { id: "communication", label: { fr: "Communication", ar: "التواصل" }, keywords: ["communication"] },
      { id: "attachment", label: { fr: "Attachement", ar: "التعلق" }, keywords: ["attachement", "attachment"] },
    ],
  },
  {
    id: "trauma",
    label: { fr: "Traumatisme & PTSD", ar: "الصدمات و PTSD" },
    icon: "🩹",
    subcategories: [
      { id: "ptsd", label: { fr: "PTSD", ar: "اضطراب ما بعد الصدمة" }, keywords: ["ptsd", "traumatisme", "trauma"] },
      { id: "grief", label: { fr: "Deuil & perte", ar: "الحداد والفقدان" }, keywords: ["deuil", "grief", "perte", "loss"] },
      { id: "abuse", label: { fr: "Violence & abus", ar: "العنف والإساءة" }, keywords: ["violence", "abus", "abuse"] },
      { id: "childhood", label: { fr: "Traumatisme infantile", ar: "الصدمات الطفولة" }, keywords: ["enfance", "childhood", "infantile"] },
    ],
  },
  {
    id: "wellbeing",
    label: { fr: "Bien-être & Croissance", ar: "الرفاهية والنمو" },
    icon: "🌱",
    subcategories: [
      { id: "selfesteem", label: { fr: "Estime de soi", ar: "تقدير الذات" }, keywords: ["estime", "esteem", "soi", "self"] },
      { id: "mindfulness", label: { fr: "Pleine conscience", ar: "الوعي الكامل" }, keywords: ["pleine conscience", "mindfulness", "méditation"] },
      { id: "motivation", label: { fr: "Motivation & objectifs", ar: "التحفيز والأهداف" }, keywords: ["motivation", "objectif", "goal"] },
      { id: "lgbtq", label: { fr: "LGBTQ+", ar: "مجتمع الميم" }, keywords: ["lgbtq", "genre", "gender", "identité"] },
    ],
  },
];

type CategoryId = typeof CATEGORIES[number]["id"];
type SubcategoryId = string;

const Psychologues = () => {
  const { t, lang } = useLanguage();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<SubcategoryId | null>(null);
  const [langFilter, setLangFilter] = useState("");
  const [price, setPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: psychologists = [], isLoading, isError } = usePsychologists();

  const selectedCat = CATEGORIES.find((c) => c.id === selectedCategory);
  const selectedSub = selectedCat?.subcategories.find((s) => s.id === selectedSubcategory);

  const filtered = psychologists.filter((d) => {
    // Text search
    const matchQ =
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.specialty.toLowerCase().includes(query.toLowerCase());

    // Category matching: check if psychologist specialty contains any keyword from selected subcategory
    let matchCategory = true;
    if (selectedSub) {
      matchCategory = selectedSub.keywords.some((kw) =>
        d.specialty.toLowerCase().includes(kw.toLowerCase())
      );
    } else if (selectedCat) {
      // If category selected but no subcategory: match any subcategory keyword
      matchCategory = selectedCat.subcategories.some((sub) =>
        sub.keywords.some((kw) => d.specialty.toLowerCase().includes(kw.toLowerCase()))
      );
    }

    // Language
    const matchLang = !langFilter || d.langs.includes(langFilter);
    // Price
    const matchPrice = !price || d.price <= parseInt(price);

    return matchQ && matchCategory && matchLang && matchPrice;
  });

  const profileLink = (d: PsyProfile) =>
    d.staticId ? `/profil/${d.staticId}` : `/profil/${d.id}`;

  const bookingLink = (d: PsyProfile) =>
    d.staticId ? `/reservation/${d.staticId}` : `/reservation/${d.id}`;

  const clearAll = () => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setLangFilter("");
    setPrice("");
    setQuery("");
  };

  const hasActiveFilters = selectedCategory || selectedSubcategory || langFilter || price || query;

  const DoctorCard = ({ d }: { d: PsyProfile }) => (
    <Link to={profileLink(d)} className="no-underline block">
      <div className="rounded-lg overflow-hidden border border-border bg-card shadow-card hover:-translate-y-1 hover:shadow-card-hover transition-all cursor-pointer">
        <div className="bg-teal-hero px-5 pt-8 pb-5 flex flex-col items-center gap-3">
          {d.avatar_url ? (
            <img
              src={d.avatar_url}
              alt={d.name}
              className="w-[88px] h-[88px] rounded-full object-cover border-[3px] border-card shadow-card"
            />
          ) : (
            <div className="w-[88px] h-[88px] rounded-full border-[3px] border-card shadow-card text-[64px] flex items-center justify-center bg-card">
              {d.emoji}
            </div>
          )}
          <h3 className="font-serif text-lg text-primary text-center">{d.name}</h3>
          <span className="text-[13px] text-muted-foreground">{d.specialty}</span>
          {d.city && (
            <span className="text-[12px] text-muted-foreground/70">{d.city}</span>
          )}
        </div>
        <div className="p-5">
          <div className="flex flex-col gap-2 mb-4">
            {d.rating > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-teal-light text-[15px]">★</span>
                <span className="font-semibold">{d.rating}</span>
                <span className="text-[13px] text-muted-foreground">({d.reviews})</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="w-[15px] h-[15px] text-primary" />
              {d.exp} {t("psy.experience")}
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <DollarSign className="w-[15px] h-[15px] text-primary" />
              {d.price.toLocaleString()} DZD {t("psy.session")}
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {d.langs.map((l) => (
              <span key={l} className="px-3 py-1 rounded-full bg-teal-pale text-xs text-primary font-medium">{l}</span>
            ))}
          </div>
          <div className="py-2 px-3.5 rounded-[10px] border border-border bg-teal-hero text-[13px] text-muted-foreground text-center mb-3.5">
            {d.dispo}
          </div>
          {d.is_available_now && (
            <div className="flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-[10px] bg-emerald-50 border border-emerald-200 text-[13px] font-semibold text-emerald-700 mb-3.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {t("psy.availableNow")}
            </div>
          )}
          <Link
            to={bookingLink(d)}
            onClick={(e) => e.stopPropagation()}
            className="block w-full py-3 rounded-xl bg-primary text-primary-foreground text-center text-[15px] font-medium no-underline hover:bg-teal-mid transition-colors"
          >
            {t("psy.book")}
          </Link>
        </div>
      </div>
    </Link>
  );

  return (
    <div>
      <Navbar />

      {/* Hero */}
      <div className="bg-teal-hero px-[5%] pt-14 pb-10">
        <h1 className="font-serif text-primary text-[clamp(28px,4vw,44px)] mb-2">{t("psy.title")}</h1>
        <p className="text-base text-muted-foreground">{t("psy.subtitle")}</p>
      </div>

      {/* Search + Categories */}
      <div className="bg-teal-hero px-[5%] pb-6">
        <div className="bg-card rounded-lg p-5 shadow-card space-y-5">
          {/* Search bar */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 flex items-center gap-2.5 border border-border rounded-full px-5 py-3 bg-teal-hero">
              <Search className="w-[18px] h-[18px] text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("psy.search")}
                className="border-none bg-transparent outline-none text-[15px] text-foreground w-full placeholder:text-muted-foreground font-sans"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-6 py-3 border rounded-full text-sm font-medium cursor-pointer whitespace-nowrap transition-colors ${
                showFilters
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-teal-pale text-primary border-border hover:border-primary"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {t("psy.filters")}
            </button>
          </div>

          {/* Level 1: Category chips */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("psy.category")}</p>
            <div className="flex flex-wrap gap-2.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    if (selectedCategory === cat.id) {
                      setSelectedCategory(null);
                      setSelectedSubcategory(null);
                    } else {
                      setSelectedCategory(cat.id);
                      setSelectedSubcategory(null);
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-teal-pale/50"
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  {cat.label[lang]}
                </button>
              ))}
            </div>
          </div>

          {/* Level 2: Subcategory chips (visible when category selected) */}
          {selectedCat && (
            <div className="animate-in fade-in duration-200">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("psy.subcategory")}</p>
              <div className="flex flex-wrap gap-2">
                {selectedCat.subcategories.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubcategory(selectedSubcategory === sub.id ? null : sub.id)}
                    className={`px-3.5 py-2 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                      selectedSubcategory === sub.id
                        ? "bg-teal-pale text-primary border-primary/30"
                        : "bg-transparent text-foreground border-border hover:border-primary/30 hover:bg-teal-pale/30"
                    }`}
                  >
                    {sub.label[lang]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Level 3: Detail filters (always visible) */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border animate-in fade-in duration-200">
              <div>
                <label className="block text-[13px] font-medium text-muted-foreground mb-2">{t("psy.language")}</label>
                <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)} className="w-full p-2.5 border border-border rounded-[10px] text-sm text-foreground bg-card cursor-pointer outline-none font-sans">
                  <option value="">{t("psy.all")}</option>
                  <option value="Français">Français</option>
                  <option value="Arabe">Arabe</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-muted-foreground mb-2">{t("psy.price")}</label>
                <select value={price} onChange={(e) => setPrice(e.target.value)} className="w-full p-2.5 border border-border rounded-[10px] text-sm text-foreground bg-card cursor-pointer outline-none font-sans">
                  <option value="">{t("psy.allPrices")}</option>
                  <option value="3000">{t("psy.lessThan")} 3000 DZD</option>
                  <option value="4000">{t("psy.lessThan")} 4000 DZD</option>
                </select>
              </div>
            </div>
          )}

          {/* Active filters summary + clear */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 pt-3 border-t border-border flex-wrap">
              <span className="text-xs text-muted-foreground">{t("psy.activeFilters")}</span>
              {selectedCat && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {selectedCat.icon} {selectedCat.label[lang]}
                  <button onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }} className="ml-0.5 hover:text-primary/70 cursor-pointer"><X className="w-3 h-3" /></button>
                </span>
              )}
              {selectedSub && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-pale text-primary text-xs font-medium">
                  {selectedSub.label[lang]}
                  <button onClick={() => setSelectedSubcategory(null)} className="ml-0.5 hover:text-primary/70 cursor-pointer"><X className="w-3 h-3" /></button>
                </span>
              )}
              {langFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-pale text-primary text-xs font-medium">
                  {langFilter}
                  <button onClick={() => setLangFilter("")} className="ml-0.5 hover:text-primary/70 cursor-pointer"><X className="w-3 h-3" /></button>
                </span>
              )}
              {price && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-pale text-primary text-xs font-medium">
                  &lt; {parseInt(price).toLocaleString()} DZD
                  <button onClick={() => setPrice("")} className="ml-0.5 hover:text-primary/70 cursor-pointer"><X className="w-3 h-3" /></button>
                </span>
              )}
              <button onClick={clearAll} className="ml-auto text-xs text-muted-foreground hover:text-primary underline cursor-pointer">{t("psy.clearAll")}</button>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <section className="px-[5%] py-10 bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-muted-foreground">
            <p>Une erreur est survenue. Veuillez rafraîchir la page.</p>
          </div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground mb-6">
              {filtered.length} {filtered.length > 1 ? t("psy.psychologues") : t("psy.psychologue")}{" "}
              {filtered.length > 1 ? t("psy.availables") : t("psy.available")}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((d) => <DoctorCard key={d.id} d={d} />)}
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>{t("psy.noResults")}</p>
                {hasActiveFilters && (
                  <button onClick={clearAll} className="mt-3 text-sm text-primary underline cursor-pointer">{t("psy.clearFilters")}</button>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <Footer />
    </div>
  );
};

export default Psychologues;
