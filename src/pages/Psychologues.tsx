import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, Clock, DollarSign, Loader2, X, Phone, PhoneOff, CheckCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePsychologists, type PsyProfile } from "@/hooks/use-psychologists";
import { CATEGORIES, type CategoryId, type SubcategoryId } from "@/lib/categories";

const Psychologues = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<SubcategoryId | null>(null);
  const [langFilter, setLangFilter] = useState("");
  const [price, setPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Immediate session request state
  const [requestingPsyId, setRequestingPsyId] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<"sending" | "pending" | "accepted" | "declined" | "expired" | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const expirationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (expirationTimerRef.current) clearTimeout(expirationTimerRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const { data: psychologists = [], isLoading, isError } = usePsychologists();

  const selectedCat = CATEGORIES.find((c) => c.id === selectedCategory);
  const selectedSub = selectedCat?.subcategories.find((s) => s.id === selectedSubcategory);

  const filtered = psychologists.filter((d) => {
    // Text search
    const matchQ =
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.specialty.toLowerCase().includes(query.toLowerCase());

    // Category matching: check if psychologist is tagged with the selected category/subcategory
    let matchCategory = true;
    if (selectedSub) {
      matchCategory = d.specializations.some(
        (s) => s.category_id === selectedCategory && s.subcategory_id === selectedSub.id
      );
    } else if (selectedCat) {
      matchCategory = d.specializations.some(
        (s) => s.category_id === selectedCat.id
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

  const handleImmediateRequest = async (psyId: string) => {
    if (!user) {
      navigate("/connexion");
      return;
    }
    setRequestingPsyId(psyId);
    setRequestStatus("sending");

    const { data, error } = await supabase
      .from("immediate_session_requests")
      .insert({
        patient_id: user.id,
        psychologist_id: psyId,
      })
      .select("id")
      .single();

    if (error) {
      toast.error(t("psy.toast.requestError"));
      setRequestStatus(null);
      setRequestingPsyId(null);
      return;
    }

    setActiveRequestId(data.id);
    setRequestStatus("pending");

    // Subscribe to realtime updates on this request
    const channel = supabase
      .channel(`request-${data.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "immediate_session_requests",
        filter: `id=eq.${data.id}`,
      }, (payload) => {
        const newStatus = payload.new.status;
        setRequestStatus(newStatus);
        if (newStatus === "accepted") {
          const roomUrl = payload.new.room_url;
          toast.success(t("psy.toast.accepted"));
          setTimeout(() => {
            if (roomUrl) {
              window.open(roomUrl, "_blank");
            }
          }, 1000);
        } else if (newStatus === "declined") {
          toast.error(t("psy.toast.unavailable"));
        } else if (newStatus === "expired") {
          toast.error(t("psy.toast.expired"));
        }
        setTimeout(() => {
          setRequestStatus(null);
          setRequestingPsyId(null);
          setActiveRequestId(null);
          supabase.removeChannel(channel);
        }, 3000);
      })
      .subscribe();

    channelRef.current = channel;

    // Expiration timer (90s)
    expirationTimerRef.current = setTimeout(async () => {
      await supabase
        .from("immediate_session_requests")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("status", "pending");
      setRequestStatus(null);
      setRequestingPsyId(null);
      setActiveRequestId(null);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }, 90000);
  };

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
            <div className="w-[88px] h-[88px] rounded-full border-[3px] border-card shadow-card text-2xl font-semibold flex items-center justify-center bg-card text-primary">
              {d.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join("")}
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
          {d.specializations.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-4">
              {d.specializations.slice(0, 3).map((s) => {
                const cat = CATEGORIES.find((c) => c.id === s.category_id);
                const sub = cat?.subcategories.find((sb) => sb.id === s.subcategory_id);
                return sub ? (
                  <span key={`${s.category_id}-${s.subcategory_id}`} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
                    {sub.label[lang]}
                  </span>
                ) : null;
              })}
              {d.specializations.length > 3 && (
                <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-medium">
                  +{d.specializations.length - 3}
                </span>
              )}
            </div>
          )}
          <div className="py-2 px-3.5 rounded-[10px] border border-border bg-teal-hero text-[13px] text-muted-foreground text-center mb-3.5">
            {d.dispo}
          </div>
          {d.is_available_now && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleImmediateRequest(d.id);
              }}
              disabled={requestStatus !== null}
              className="flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-[10px] bg-teal-pale border border-primary/15 text-[13px] font-semibold text-primary mb-3.5 w-full cursor-pointer hover:bg-teal-pale transition-colors disabled:opacity-60"
            >
              <span className="w-2 h-2 rounded-full bg-teal-pale0 animate-pulse" />
              {requestingPsyId === d.id && requestStatus === "sending" ? t("psy.requestSending") : t("psy.talkNow")}
            </button>
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
                   <option value="Français">{t("space.lang.french")}</option>
                   <option value="Arabe">{t("space.lang.arabic")}</option>
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
             <p>{t("psy.errorLoad")}</p>
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

      {/* Immediate Request Status Modal */}
      {requestStatus && requestStatus !== "sending" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl shadow-lg max-w-sm w-full p-8 text-center space-y-4">
            {requestStatus === "pending" && (
              <>
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.requestPending")}</h3>
                <p className="text-sm text-muted-foreground">{t("psy.requestPendingDesc")}</p>
                <div className="w-full bg-border rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full animate-pulse" style={{ width: "60%" }} />
                </div>
              </>
            )}
            {requestStatus === "accepted" && (
              <>
                <div className="w-16 h-16 rounded-full bg-teal-pale flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.requestAccepted")}</h3>
                <p className="text-sm text-muted-foreground">{t("psy.requestAcceptedDesc")}</p>
              </>
            )}
            {requestStatus === "declined" && (
              <>
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                  <PhoneOff className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.requestDeclined")}</h3>
                <p className="text-sm text-muted-foreground">{t("psy.requestDeclinedDesc")}</p>
              </>
            )}
            {requestStatus === "expired" && (
              <>
                <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground">{t("psy.requestExpired")}</h3>
                <p className="text-sm text-muted-foreground">{t("psy.requestExpiredDesc")}</p>
              </>
            )}
            <button
              onClick={() => {
                setRequestStatus(null);
                setRequestingPsyId(null);
                setActiveRequestId(null);
              }}
              className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-teal-pale transition-colors cursor-pointer"
            >
              {t("psy.requestClose")}
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Psychologues;
