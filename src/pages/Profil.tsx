import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Calendar, MessageSquare, Clock, Check,
  GraduationCap, Award, Star, MapPin, Loader2, Globe, X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getDoctorById } from "@/data/doctors";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PsyProfile {
  user_id: string;
  full_name: string | null;
  specialty: string | null;
  city: string | null;
  bio: string | null;
  price_per_session: number | null;
  years_experience: number | null;
  language: string | null;
  avatar_url: string | null;
  order_number: string | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  patient_id: string;
}

interface RatingStats {
  avg_rating: number | null;
  review_count: number | null;
}

const StarRow = ({ rating, max = 5 }: { rating: number; max?: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: max }).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < Math.round(rating) ? "text-teal-light fill-teal-light" : "text-border"}`}
      />
    ))}
  </div>
);

const Profil = () => {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"apropos" | "avis">("apropos");

  // Detect if id is a UUID (real DB user) or a number (static mock)
  const isUUID = /^[0-9a-f-]{36}$/i.test(id ?? "");

  // ── State ─────────────────────────────────────────────────────────────────
  const [psyProfile, setPsyProfile] = useState<PsyProfile | null>(null);
  const [reviews, setReviews]       = useState<Review[]>([]);
  const [ratingStats, setRatingStats] = useState<RatingStats>({ avg_rating: null, review_count: null });
  const [loading, setLoading]       = useState(isUUID);

  // Review form state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating]       = useState(5);
  const [reviewComment, setReviewComment]     = useState("");
  const [reviewHover, setReviewHover]         = useState<number | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [userAlreadyReviewed, setUserAlreadyReviewed] = useState(false);

  // ── Static fallback data ──────────────────────────────────────────────────
  const staticDoc = !isUUID ? getDoctorById(parseInt(id ?? "1")) : null;

  // ── Fetch real profile ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isUUID) return;
    setLoading(true);

    Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, specialty, city, bio, price_per_session, years_experience, language, avatar_url, order_number")
        .eq("user_id", id)
        .single(),

      supabase
        .from("reviews")
        .select("id, rating, comment, created_at, patient_id")
        .eq("psychologist_id", id)
        .order("created_at", { ascending: false }),

      supabase
        .from("psychologist_ratings")
        .select("avg_rating, review_count")
        .eq("psychologist_id", id)
        .single(),
    ]).then(([profileRes, reviewsRes, ratingRes]) => {
      if (profileRes.data) setPsyProfile(profileRes.data as PsyProfile);
      if (reviewsRes.data) {
        setReviews(reviewsRes.data as Review[]);
        if (user) {
          setUserAlreadyReviewed(reviewsRes.data.some((r: Review) => r.patient_id === user.id));
        }
      }
      if (ratingRes.data) setRatingStats(ratingRes.data as RatingStats);
      setLoading(false);
    });
  }, [id, isUUID, user]);

  // ── Derived display values ────────────────────────────────────────────────
  const name       = psyProfile?.full_name ?? staticDoc?.name ?? "Psychologue";
  const specialty  = psyProfile?.specialty ?? staticDoc?.specialty ?? "";
  const city       = psyProfile?.city ?? null;
  const bio        = psyProfile?.bio ?? null;
  const price      = psyProfile?.price_per_session ?? staticDoc?.price ?? 3500;
  const exp        = psyProfile?.years_experience ?? staticDoc?.exp ?? 0;
  const langs      = psyProfile?.language ? [psyProfile.language] : staticDoc?.langs ?? ["Français"];
  const avatarUrl  = psyProfile?.avatar_url ?? null;
  const emoji      = staticDoc?.emoji ?? "🧑‍⚕️";
  const avgRating  = ratingStats.avg_rating ?? staticDoc?.rating ?? 0;
  const reviewCount = ratingStats.review_count ?? staticDoc?.reviews ?? 0;
  const bookingId  = isUUID ? id : staticDoc?.id?.toString();

  const locale = lang === "ar" ? "ar-SA" : "fr-FR";
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { month: "long", year: "numeric" });

  // ── Rating bar distribution ───────────────────────────────────────────────
  const ratingBars = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter(r => r.rating === star).length;
    const pct   = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
    return { star, count, pct };
  });

  // ── Submit review ─────────────────────────────────────────────────────────
  const submitReview = async () => {
    if (!user) { navigate("/connexion"); return; }
    if (!isUUID) { toast.error("Les avis ne sont disponibles que pour les profils vérifiés."); return; }
    setSubmittingReview(true);
    const { error } = await supabase.from("reviews").insert({
      patient_id: user.id,
      psychologist_id: id!,
      rating: reviewRating,
      comment: reviewComment,
    });
    setSubmittingReview(false);
    if (error) {
      toast.error("Erreur lors de l'envoi de l'avis.");
    } else {
      toast.success("✅ Avis publié avec succès !");
      setShowReviewModal(false);
      setUserAlreadyReviewed(true);
      setReviews(prev => [{
        id: crypto.randomUUID(),
        rating: reviewRating,
        comment: reviewComment,
        created_at: new Date().toISOString(),
        patient_id: user.id,
      }, ...prev]);
      setRatingStats(prev => ({
        avg_rating: prev.avg_rating !== null
          ? ((prev.avg_rating * (prev.review_count ?? 0)) + reviewRating) / ((prev.review_count ?? 0) + 1)
          : reviewRating,
        review_count: (prev.review_count ?? 0) + 1,
      }));
    }
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="min-h-[calc(100vh-72px)] flex items-center justify-center bg-teal-hero">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="max-w-[1200px] mx-auto px-[5%] py-9 pb-20">
        <Link to="/psychologues" className="inline-flex items-center gap-1.5 text-muted-foreground text-sm no-underline mb-7 hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4" /> {t("prof.back")}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-7 items-start">

          {/* ── Left sticky card ─────────────────────────────────────────── */}
          <div className="bg-card rounded-lg shadow-card overflow-hidden lg:sticky lg:top-[90px]">
            <div className="bg-teal-hero px-6 pt-9 pb-6 flex flex-col items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name}
                  className="w-[100px] h-[100px] rounded-full object-cover border-[3px] border-card shadow-card" />
              ) : (
                <div className="w-[100px] h-[100px] rounded-full border-[3px] border-card shadow-card text-[72px] flex items-center justify-center bg-card">
                  {emoji}
                </div>
              )}
              <h1 className="font-serif text-xl text-primary text-center">{name}</h1>
              <span className="text-sm text-muted-foreground text-center">{specialty}</span>
              {city && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />{city}
                </span>
              )}
              {reviewCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-teal-light text-base">★</span>
                  <span className="font-semibold text-[15px]">{Number(avgRating).toFixed(1)}</span>
                  <span className="text-[13px] text-muted-foreground">({reviewCount} {t("prof.reviewWord")})</span>
                </div>
              )}
              <div className="bg-card rounded-xl px-6 py-4 text-center w-full mt-1">
                <div className="font-serif text-[28px] text-primary">{price.toLocaleString()} DZD</div>
                <div className="text-[13px] text-muted-foreground mt-0.5">{t("prof.session")}</div>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="flex items-start gap-3 mb-4">
                <Clock className="w-[18px] h-[18px] text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">{t("prof.experience")}</div>
                  <div className="text-sm font-medium">{exp} ans</div>
                </div>
              </div>
              <div className="flex items-start gap-3 mb-4">
                <Globe className="w-[18px] h-[18px] text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">{t("prof.languages")}</div>
                  <div className="text-sm font-medium">{langs.join(", ")}</div>
                </div>
              </div>
              <div className="flex items-start gap-3 mb-4">
                <Check className="w-[18px] h-[18px] text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">{t("prof.availability")}</div>
                  <div className="text-sm font-medium text-primary">Disponible cette semaine</div>
                </div>
              </div>
              {psyProfile?.order_number && (
                <div className="flex items-start gap-3 mb-4">
                  <Award className="w-[18px] h-[18px] text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">N° d'ordre</div>
                    <div className="text-sm font-medium">{psyProfile.order_number}</div>
                  </div>
                </div>
              )}
              <div className="h-px bg-border my-4" />
              <Link to={`/reservation/${bookingId}`}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[15px] font-medium no-underline flex items-center justify-center gap-2 hover:bg-teal-mid transition-colors mb-2.5">
                <Calendar className="w-4 h-4" /> {t("prof.book")}
              </Link>
              <button className="w-full py-3 rounded-xl border border-border bg-teal-hero text-primary text-[15px] font-medium flex items-center justify-center gap-2 hover:border-primary transition-colors cursor-pointer">
                <MessageSquare className="w-4 h-4" /> {t("prof.message")}
              </button>
            </div>
          </div>

          {/* ── Right content ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">
            <div className="flex border-b-2 border-border">
              {([
                { key: "apropos" as const, label: t("prof.about") },
                { key: "avis" as const,    label: `${t("prof.reviews")} (${reviewCount})` },
              ]).map(item => (
                <button key={item.key} onClick={() => setTab(item.key)}
                  className={`px-6 py-3 text-[15px] font-medium cursor-pointer border-b-2 -mb-[2px] transition-colors bg-transparent ${tab === item.key ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-primary"}`}>
                  {item.label}
                </button>
              ))}
            </div>

            {/* ── À propos tab ─────────────────────────────────────────── */}
            {tab === "apropos" && (
              <>
                <div className="bg-card rounded-lg shadow-card p-7">
                  <h2 className="font-serif text-xl text-primary mb-4">{t("prof.bio")}</h2>
                  <p className="text-[15px] text-foreground leading-[1.75]">
                    {bio ?? "Psychologue clinicien spécialisé dans l'accompagnement des adultes et des adolescents. Mon approche thérapeutique est basée sur l'écoute active, l'empathie et des méthodes éprouvées comme la thérapie cognitivo-comportementale (TCC) et la thérapie d'acceptation et d'engagement (ACT)."}
                  </p>
                </div>

                <div className="bg-card rounded-lg shadow-card p-7">
                  <h2 className="font-serif text-xl text-primary mb-4">{t("prof.approach")}</h2>
                  <div className="flex flex-col gap-3">
                    {["Thérapie cognitivo-comportementale (TCC)", "Thérapie d'acceptation et d'engagement (ACT)", "Pleine conscience (Mindfulness)", "Approche centrée sur la personne"].map(a => (
                      <div key={a} className="flex items-center gap-3 text-[15px] text-foreground">
                        <Check className="w-5 h-5 text-teal-light shrink-0" /> {a}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card rounded-lg shadow-card p-7">
                  <h2 className="font-serif text-xl text-primary mb-4 flex items-center gap-2.5">
                    <GraduationCap className="w-[22px] h-[22px]" /> {t("prof.training")}
                  </h2>
                  <div className="flex flex-col gap-3.5">
                    {["Doctorat en Psychologie Clinique — Université d'Alger", "Master en Psychologie — Université Paris Descartes", "Certification TCC — Institut Français de TCC"].map(f => (
                      <div key={f} className="flex items-start gap-3 text-[15px] text-foreground">
                        <Award className="w-5 h-5 text-primary shrink-0 mt-0.5" /> {f}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Disponibilités */}
                <div className="bg-card rounded-lg shadow-card p-7">
                  <h2 className="font-serif text-xl text-primary mb-5">{t("prof.slots")}</h2>
                  <div className="grid grid-cols-3 gap-5 mb-6">
                    {[
                      { label: t("res.morning"),   slots: ["09:00", "10:00", "11:00"] },
                      { label: t("res.afternoon"), slots: ["14:00", "15:00", "16:00"] },
                      { label: t("res.evening"),   slots: ["18:00", "19:00"] },
                    ].map(col => (
                      <div key={col.label}>
                        <h4 className="text-[13px] font-medium text-muted-foreground mb-3 font-sans">{col.label}</h4>
                        <div className="flex flex-col gap-2">
                          {col.slots.map(s => (
                            <div key={s} className="py-2.5 text-center rounded-[10px] border border-border bg-teal-hero text-sm font-sans text-foreground">
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link to={`/reservation/${bookingId}`}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[15px] font-medium no-underline flex items-center justify-center gap-2 hover:bg-teal-mid transition-colors">
                    <Calendar className="w-4 h-4" /> {t("prof.book")}
                  </Link>
                </div>
              </>
            )}

            {/* ── Avis tab ─────────────────────────────────────────────── */}
            {tab === "avis" && (
              <div className="bg-card rounded-lg shadow-card p-7">
                {/* Rating summary */}
                <div className="flex items-center gap-6 p-5 bg-teal-hero rounded-xl mb-6">
                  <div className="text-center shrink-0">
                    <div className="font-serif text-5xl text-primary leading-none">
                      {reviewCount > 0 ? Number(avgRating).toFixed(1) : "—"}
                    </div>
                    <div className="flex justify-center mt-1">
                      <StarRow rating={avgRating} />
                    </div>
                    <div className="text-[13px] text-muted-foreground mt-1">{reviewCount} {t("prof.reviewWord")}</div>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    {ratingBars.map(b => (
                      <div key={b.star} className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
                        {b.star}★
                        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full bg-teal-light rounded-full transition-all" style={{ width: `${b.pct}%` }} />
                        </div>
                        <span className="w-5 text-right">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Leave a review button */}
                {user && !userAlreadyReviewed && isUUID && (
                  <button onClick={() => setShowReviewModal(true)}
                    className="w-full mb-6 py-3 rounded-xl border-2 border-dashed border-teal-light text-primary text-[15px] font-medium bg-transparent cursor-pointer hover:bg-teal-pale transition-colors flex items-center justify-center gap-2">
                    <Star className="w-4 h-4" /> Laisser un avis
                  </button>
                )}

                {/* Reviews list */}
                {reviews.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucun avis pour le moment.</p>
                    <p className="text-xs mt-1">Soyez le premier à partager votre expérience.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {reviews.map((r, i) => (
                      <div key={r.id ?? i} className="p-5 border border-border rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-teal-pale flex items-center justify-center text-primary font-semibold text-sm">
                              {r.patient_id === user?.id ? (user?.email?.[0].toUpperCase() ?? "M") : "P"}
                            </div>
                            <span className="font-semibold text-sm">
                              {r.patient_id === user?.id ? "Vous" : "Patient"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                        </div>
                        <StarRow rating={r.rating} />
                        {r.comment && <p className="text-sm text-foreground leading-relaxed mt-2">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />

      {/* ── Review modal ─────────────────────────────────────────────────── */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-foreground/40 z-[200] flex items-center justify-center px-4"
          onClick={() => setShowReviewModal(false)}>
          <div className="bg-card rounded-2xl p-8 max-w-md w-full shadow-card-hover"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-primary">Votre avis</h3>
              <button onClick={() => setShowReviewModal(false)} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-5">Évaluez votre expérience avec {name}</p>

            {/* Star picker */}
            <div className="flex gap-2 justify-center mb-6">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s}
                  onMouseEnter={() => setReviewHover(s)}
                  onMouseLeave={() => setReviewHover(null)}
                  onClick={() => setReviewRating(s)}
                  className="bg-transparent border-none cursor-pointer p-1 transition-transform hover:scale-110">
                  <Star className={`w-8 h-8 transition-colors ${
                    s <= (reviewHover ?? reviewRating) ? "text-teal-light fill-teal-light" : "text-border"
                  }`} />
                </button>
              ))}
            </div>

            <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)}
              rows={4} placeholder="Partagez votre expérience (optionnel)..."
              className="w-full px-4 py-3 border border-border rounded-xl text-[15px] text-foreground bg-teal-hero outline-none focus:border-teal-light resize-none font-sans mb-5" />

            <button onClick={submitReview} disabled={submittingReview}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors disabled:opacity-70 flex items-center justify-center gap-2 font-sans">
              {submittingReview && <Loader2 className="w-4 h-4 animate-spin" />}
              Publier l'avis
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profil;
