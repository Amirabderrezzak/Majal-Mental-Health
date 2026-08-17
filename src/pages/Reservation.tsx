import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Calendar, Clock, DollarSign, ChevronRight, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Reservation = () => {
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isUUID = /^[0-9a-f-]{36}$/i.test(id ?? "");

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [booking, setBooking] = useState(false);

  // Dynamic doctor details state
  const [docName, setDocName] = useState("");
  const [docSpecialty, setDocSpecialty] = useState("");
  const [docIndividual, setDocIndividual] = useState<number | null>(null);
  const [docCouples, setDocCouples] = useState<number | null>(null);
  const [docAdolescents, setDocAdolescents] = useState<number | null>(null);
  const [sessionType, setSessionType] = useState<"individual" | "couples" | "adolescents">("individual");
  const [docEmoji, setDocEmoji] = useState("🧑‍⚕️");
  const [docAvatarUrl, setDocAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(isUUID);

  useEffect(() => {
    if (isUUID) {
      setLoading(true);
      supabase
        .from("psychologist_directory")
        .select("user_id, full_name, specialty, price_individual, price_couples, price_adolescents, avatar_url, approval_status")
        .eq("user_id", id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("Error fetching psychologist profile:", error);
            toast.error(t("res.error.loadProfile"));
          } else if (data) {
            if (data.approval_status !== "approved") {
              toast.error(t("res.error.notAvailable"));
              navigate("/psychologues");
              return;
            }
            const individual = data.price_individual ?? null;
            const couples = data.price_couples ?? null;
            const adolescents = data.price_adolescents ?? null;
            setDocName(data.full_name ?? "Psychologue");
            setDocSpecialty(data.specialty ?? "Psychologie clinique");
            setDocIndividual(individual);
            setDocCouples(couples);
            setDocAdolescents(adolescents);
            // Default the session type to the first offered type.
            const firstOffered = individual != null ? "individual"
              : couples != null ? "couples"
              : adolescents != null ? "adolescents"
              : "individual";
            setSessionType(firstOffered);
            setDocAvatarUrl(data.avatar_url);
            setDocEmoji("🧑‍⚕️");
          }
          setLoading(false);
        });
    } else {
      toast.error(t("res.error.invalidId"));
      navigate("/psychologues");
    }
  }, [id, isUUID, navigate]);

  const priceForType = (type: "individual" | "couples" | "adolescents") =>
    type === "individual" ? docIndividual
      : type === "couples" ? docCouples
      : docAdolescents;

  const sessionOptions = [
    { type: "individual" as const,   label: t("res.session.individual")   || "Individuel",   price: docIndividual },
    { type: "couples" as const,      label: t("res.session.couples")      || "Couple",       price: docCouples },
    { type: "adolescents" as const,  label: t("res.session.adolescents")  || "Adolescent",   price: docAdolescents },
  ];

  // Keep the displayed price in sync with the selected session type.
  const selectedPrice = priceForType(sessionType);
  const docPriceComputed = selectedPrice ?? 0;

  // Live slot availability query from Supabase bookings table
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);

  useEffect(() => {
    if (!id || !selectedDay || !isUUID) {
      setBookedTimes([]);
      return;
    }

    const startOfDay = new Date(viewYear, viewMonth, selectedDay, 0, 0, 0).toISOString();
    const endOfDay = new Date(viewYear, viewMonth, selectedDay, 23, 59, 59).toISOString();

    supabase
      .from("bookings")
      .select("booked_at")
      .eq("psychologist_id", id)
      .neq("status", "cancelled")
      .gte("booked_at", startOfDay)
      .lte("booked_at", endOfDay)
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching booked slots:", error);
        } else if (data) {
          const times = data.map((b) => {
            const d = new Date(b.booked_at);
            const hrs = String(d.getHours()).padStart(2, "0");
            const mins = String(d.getMinutes()).padStart(2, "0");
            return `${hrs}:${mins}`;
          });
          setBookedTimes(times);
        }
      });
  }, [id, selectedDay, viewMonth, viewYear, isUUID]);

  const months = t("cal.months").split(",");
  const dayLabels = t("cal.days").split(",");

  const changeMonth = (dir: number) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setViewMonth(m);
    setViewYear(y);
    setSelectedDay(null);
    setSelectedTime(null);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();

  const calDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calDays.push(null);
  for (let d = 1; d <= lastDate; d++) calDays.push(d);

  const isPast = (d: number) => new Date(viewYear, viewMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isToday = (d: number) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const slotGroups = [
    { label: t("res.morning"), slots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"], taken: [1, 3] },
    { label: t("res.afternoon"), slots: ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30"], taken: [2] },
    { label: t("res.evening"), slots: ["18:00", "18:30", "19:00", "19:30"], taken: [] as number[] },
  ];

  const locale = lang === "ar" ? "ar-SA" : "fr-FR";
  const selectedDateStr = selectedDay
    ? new Date(viewYear, viewMonth, selectedDay).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "—";

  const confirmBooking = async () => {
    if (!selectedDay || !selectedTime || booking) return;

    if (!user) {
      toast.error(t("res.error.loginRequired"));
      navigate("/connexion");
      return;
    }

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const bookedAt = new Date(viewYear, viewMonth, selectedDay, hours, minutes);

    setBooking(true);
    const psychologistId = id!;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      const response = await fetch(`/api/payments?action=checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          psychologist_id: psychologistId,
          booked_at: bookedAt.toISOString(),
          duration_minutes: 60,
          session_type: sessionType,
          price: docPriceComputed,
          full_name: profile?.full_name || user.email,
          phone: user.phone || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setBooking(false);
        toast.error(data.error || t("res.error.general"));
        return;
      }

      if (data.mock) {
        window.location.href = `/payment/mock?booking_id=${data.payment_id}&amount=${docPriceComputed}`;
      } else if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Pas d'URL de paiement retournée");
      }
    } catch (err) {
      setBooking(false);
      console.error("Payment redirect error:", err);
      toast.error(t("res.error.paymentRedirect"));
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
      <div className="max-w-[1200px] mx-auto px-4 sm:px-[5%] py-10 pb-20">
        <Link to={`/profil/${id}`} className="inline-flex items-center gap-1.5 text-muted-foreground text-sm no-underline mb-6 hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4" /> {t("res.back")}
        </Link>
        <h1 className="font-serif text-primary text-[clamp(26px,3.5vw,36px)] mb-1">{t("res.title")}</h1>
        <p className="text-[15px] text-muted-foreground mb-9">{t("res.with")} {docName}</p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-7 items-start">
          <div>
            {/* Calendar */}
            <div className="bg-card rounded-lg shadow-card p-4 sm:p-8">
              <div className="text-[17px] font-semibold text-foreground mb-6 font-sans">{t("res.selectDate")}</div>
              <div className="flex items-center justify-between mb-5">
                <button onClick={() => changeMonth(-1)} className="w-9 h-9 border border-border rounded-lg flex items-center justify-center text-primary cursor-pointer hover:bg-teal-pale transition-colors bg-transparent">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="font-serif text-xl text-primary">{months[viewMonth]} {viewYear}</div>
                <button onClick={() => changeMonth(1)} className="w-9 h-9 border border-border rounded-lg flex items-center justify-center text-primary cursor-pointer hover:bg-teal-pale transition-colors bg-transparent">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dayLabels.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
                {calDays.map((d, i) => (
                  <div
                    key={i}
                    onClick={() => d && !isPast(d) && (setSelectedDay(d), setSelectedTime(null))}
                    className={`aspect-square flex items-center justify-center rounded-[10px] text-sm cursor-pointer transition-all ${
                      !d ? "cursor-default" :
                      isPast(d) ? "text-muted-foreground/35 cursor-default" :
                      d === selectedDay ? "bg-primary text-primary-foreground font-semibold" :
                      isToday(d) ? "border-2 border-teal-light font-semibold" :
                      "text-foreground hover:bg-teal-pale hover:text-primary"
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>
            </div>

            {/* Time Slots */}
            <div className="bg-card rounded-lg shadow-card p-4 sm:p-8 mt-6">
              <div className="text-[17px] font-semibold text-foreground mb-6 font-sans">{t("res.selectTime")}</div>
              {slotGroups.map((g) => (
                <div key={g.label}>
                  <div className="text-sm font-medium text-muted-foreground mb-3 mt-5 first:mt-0">{g.label}</div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {g.slots.map((s, i) => {
                      const isTaken = isUUID ? bookedTimes.includes(s) : g.taken.includes(i);
                      return (
                        <button
                          key={s}
                          onClick={() => !isTaken && selectedDay && setSelectedTime(s)}
                          disabled={isTaken}
                          className={`py-2.5 text-center rounded-[10px] border text-sm cursor-pointer transition-all font-sans ${
                            isTaken ? "opacity-40 cursor-default line-through border-border bg-teal-hero" :
                            s === selectedTime ? "bg-primary text-primary-foreground border-primary font-medium" :
                            "border-border bg-teal-hero text-foreground hover:border-teal-light hover:bg-teal-pale"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recap */}
          <div className="bg-card rounded-lg shadow-card p-7 lg:sticky lg:top-[90px]">
            <div className="text-lg font-semibold text-foreground mb-5 pb-4 border-b border-border font-sans">{t("res.recap")}</div>
            <div className="flex items-center gap-3.5 mb-6 pb-5 border-b border-border">
              {docAvatarUrl ? (
                <img
                  src={docAvatarUrl}
                  alt={docName}
                  className="w-14 h-14 object-cover rounded-full border border-border shrink-0"
                />
              ) : (
                <div className="text-[44px] w-14 h-14 flex items-center justify-center bg-teal-hero rounded-full shrink-0">{docEmoji}</div>
              )}
              <div>
                <div className="font-semibold text-[15px] text-primary">{docName}</div>
                <div className="text-[13px] text-muted-foreground mt-0.5">{docSpecialty}</div>
              </div>
            </div>
              <div className="flex flex-col gap-4 mb-6">
               <div className="flex items-start gap-3">
                 <Calendar className="w-[18px] h-[18px] text-primary shrink-0 mt-0.5" />
                 <div>
                   <div className="text-xs text-muted-foreground">{t("res.date")}</div>
                   <div className="text-sm font-medium mt-0.5">{selectedDateStr}</div>
                 </div>
               </div>
               <div className="flex items-start gap-3">
                 <Clock className="w-[18px] h-[18px] text-primary shrink-0 mt-0.5" />
                 <div>
                   <div className="text-xs text-muted-foreground">{t("res.time")}</div>
                   <div className="text-sm font-medium mt-0.5">{selectedTime || "—"}</div>
                 </div>
               </div>
               <div className="flex items-start gap-3">
                 <Clock className="w-[18px] h-[18px] text-primary shrink-0 mt-0.5" />
                 <div>
                   <div className="text-xs text-muted-foreground">{t("res.duration")}</div>
                   <div className="text-sm font-medium mt-0.5">{t("res.minutes")}</div>
                 </div>
               </div>

               {/* Session type selector */}
               <div className="flex flex-col gap-2">
                 <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("res.sessionType") || "Type de séance"}</div>
                 <div className="flex flex-wrap gap-2">
                   {sessionOptions.map((opt) => {
                     const offered = opt.price != null;
                     const active = sessionType === opt.type;
                     return (
                       <button
                         key={opt.type}
                         type="button"
                         disabled={!offered}
                         onClick={() => offered && setSessionType(opt.type)}
                         className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                           !offered
                             ? "opacity-40 cursor-not-allowed border-border bg-teal-hero text-muted-foreground"
                             : active
                               ? "bg-primary text-primary-foreground border-primary"
                               : "border-border bg-teal-hero text-foreground hover:border-primary/30 hover:bg-teal-pale"
                         }`}
                       >
                         {opt.label}{!offered && ` (${t("res.session.notOffered") || "Non proposé"})`}
                       </button>
                     );
                   })}
                 </div>
               </div>

               <div className="flex items-start gap-3">
                 <DollarSign className="w-[18px] h-[18px] text-primary shrink-0 mt-0.5" />
                 <div>
                   <div className="text-xs text-muted-foreground">{t("res.price")}</div>
                   <div className="text-[22px] font-semibold text-primary">{docPriceComputed.toLocaleString()} DZD</div>
                 </div>
               </div>
             </div>
            <button
              onClick={confirmBooking}
              disabled={!selectedDay || !selectedTime || booking || selectedPrice == null}
              className={`w-full py-3.5 rounded-xl text-[15px] font-medium transition-all cursor-pointer font-sans border-none ${
                selectedDay && selectedTime && !booking
                  ? "bg-primary text-primary-foreground hover:bg-teal-mid"
                  : "bg-teal-hero text-muted-foreground cursor-default"
              }`}
            >
              {booking ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  {t("res.confirm")}...
                </span>
              ) : t("res.confirm")}
            </button>
          </div>
        </div>
      </div>

      <Footer />

      {/* Success Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-foreground/45 z-[200] flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-card rounded-3xl px-10 py-12 max-w-[440px] w-[90%] text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-[56px] mb-4">✅</div>
            <h2 className="font-serif text-[26px] text-primary mb-2.5">{t("res.confirmed")}</h2>
            <p className="text-[15px] text-muted-foreground leading-relaxed mb-7">
              {t("res.confirmMsg")} {docName} {t("res.confirmMsg2")} {selectedDateStr} {t("res.confirmMsg3")} {selectedTime}. {t("res.confirmMsg4")}
            </p>
            <Link to="/mon-espace" className="inline-block px-9 py-3 rounded-[32px] bg-primary text-primary-foreground text-[15px] font-medium no-underline hover:bg-teal-mid transition-colors">
              Voir mes réservations
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reservation;
