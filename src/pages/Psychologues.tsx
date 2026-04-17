import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, Clock, DollarSign, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePsychologists, type PsyProfile } from "@/hooks/use-psychologists";

const Psychologues = () => {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [spec, setSpec] = useState("");
  const [lang, setLang] = useState("");
  const [price, setPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: psychologists = [], isLoading, isError } = usePsychologists();

  const filtered = psychologists.filter((d) => {
    const matchQ =
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.specialty.toLowerCase().includes(query.toLowerCase());
    const matchSpec = !spec || d.specialty.includes(spec);
    const matchLang = !lang || d.langs.includes(lang);
    const matchPrice = !price || d.price <= parseInt(price);
    return matchQ && matchSpec && matchLang && matchPrice;
  });

  const profileLink = (d: PsyProfile) =>
    d.staticId ? `/profil/${d.staticId}` : `/profil/${d.id}`;

  const bookingLink = (d: PsyProfile) =>
    d.staticId ? `/reservation/${d.staticId}` : `/reservation/${d.id}`;

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

      <div className="bg-teal-hero px-[5%] pt-14 pb-10">
        <h1 className="font-serif text-primary text-[clamp(28px,4vw,44px)] mb-2">{t("psy.title")}</h1>
        <p className="text-base text-muted-foreground">{t("psy.subtitle")}</p>
      </div>

      <div className="bg-teal-hero px-[5%] pb-8">
        <div className="bg-card rounded-lg p-5 shadow-card">
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
              className="flex items-center gap-2 px-6 py-3 border border-border rounded-full bg-teal-pale text-sm font-medium text-primary cursor-pointer whitespace-nowrap hover:border-primary transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {t("psy.filters")}
            </button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-border">
              <div>
                <label className="block text-[13px] font-medium text-muted-foreground mb-2">{t("psy.specialty")}</label>
                <select value={spec} onChange={(e) => setSpec(e.target.value)} className="w-full p-2.5 border border-border rounded-[10px] text-sm text-foreground bg-card cursor-pointer outline-none font-sans">
                  <option value="">{t("psy.all")}</option>
                  <option value="Anxiété">Anxiété & Stress</option>
                  <option value="Dépression">Dépression</option>
                  <option value="Relations">Relations</option>
                  <option value="Traumatisme">Traumatisme</option>
                  <option value="Thérapie familiale">Thérapie familiale</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-muted-foreground mb-2">{t("psy.language")}</label>
                <select value={lang} onChange={(e) => setLang(e.target.value)} className="w-full p-2.5 border border-border rounded-[10px] text-sm text-foreground bg-card cursor-pointer outline-none font-sans">
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
        </div>
      </div>

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
                <p>Aucun psychologue ne correspond à vos critères.</p>
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
