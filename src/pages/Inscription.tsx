import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, Eye, EyeOff, User, Phone, MapPin, Award, Briefcase } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

const Inscription = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [userType, setUserType] = useState<"patient" | "psychologue">("patient");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const [orderNumber, setOrderNumber] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t("auth.minChars"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          user_type: userType,
          ...(userType === "psychologue" && { order_number: orderNumber, specialty, city }),
        },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("✅ Compte créé ! Vérifiez votre email pour confirmer votre inscription.");
      navigate("/connexion");
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/mon-espace",
          queryParams: {
            user_type: userType // Pass the selected radio value so a backend trigger can insert it!
          }
        },
      });

      if (error) {
        toast.error(error.message || "Erreur de connexion Google");
        setLoading(false);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("Une erreur inattendue est survenue");
      setLoading(false);
    }
  };

  const inputClasses = "flex items-center gap-2.5 border border-border rounded-xl px-4 py-3 bg-teal-hero focus-within:border-teal-light focus-within:bg-card transition-colors";
  const inputFieldClasses = "border-none bg-transparent outline-none text-[15px] text-foreground w-full placeholder:text-muted-foreground font-sans";

  return (
    <div>
      <Navbar />
      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center bg-teal-hero px-4 py-12">
        <div className="bg-card rounded-2xl shadow-card p-8 sm:p-10 w-full max-w-[480px]">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl text-primary mb-2">{t("auth.createAccount")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.signupSubtitle")}</p>
          </div>

          <div className="flex gap-3 mb-6">
            <button type="button" onClick={() => setUserType("patient")} className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${userType === "patient" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-teal-hero"}`}>
              {t("auth.patient")}
            </button>
            <button type="button" onClick={() => setUserType("psychologue")} className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${userType === "psychologue" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-teal-hero"}`}>
              {t("auth.psychologist")}
            </button>
          </div>

          <button onClick={handleGoogle} disabled={loading} className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-border bg-card text-foreground text-sm font-medium cursor-pointer hover:bg-teal-hero transition-colors mb-6 disabled:opacity-50">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {t("auth.google")}
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSignUp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{t("auth.fullName")}</label>
              <div className={inputClasses}>
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("auth.namePlaceholder")} className={inputFieldClasses} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{t("auth.email")}</label>
              <div className={inputClasses}>
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" className={inputFieldClasses} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{t("auth.phone")}</label>
              <div className={inputClasses}>
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("auth.phonePlaceholder")} className={inputFieldClasses} />
              </div>
            </div>

            {userType === "psychologue" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-muted-foreground">{t("auth.orderNumber")}</label>
                  <div className={inputClasses}>
                    <Award className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input type="text" required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder={t("auth.orderPlaceholder")} className={inputFieldClasses} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-muted-foreground">{t("auth.specialtyLabel")}</label>
                  <div className={inputClasses}>
                    <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                    <select required value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={inputFieldClasses + " cursor-pointer"}>
                      <option value="">{t("auth.chooseSpecialty")}</option>
                      <option value="psychologie-clinique">{t("auth.clinicalPsy")}</option>
                      <option value="psychotherapie">{t("auth.psychotherapy")}</option>
                      <option value="neuropsychologie">{t("auth.neuropsychology")}</option>
                      <option value="psychologie-enfant">{t("auth.childPsy")}</option>
                      <option value="psychologie-couple">{t("auth.couplePsy")}</option>
                      <option value="psychiatrie">{t("auth.psychiatry")}</option>
                      <option value="autre">{t("auth.other")}</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-muted-foreground">{t("auth.cityLabel")}</label>
                  <div className={inputClasses}>
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("auth.cityPlaceholder")} className={inputFieldClasses} />
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{t("auth.password")}</label>
              <div className={inputClasses}>
                <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.minChars")} className={inputFieldClasses} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="bg-transparent border-none cursor-pointer p-0">
                  {showPw ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[15px] font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors disabled:opacity-50 font-sans mt-2">
              {loading ? t("auth.signingUp") : t("auth.signupBtn")}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("auth.hasAccount")}{" "}
            <Link to="/connexion" className="text-primary font-medium no-underline hover:underline">{t("auth.loginLink")}</Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Inscription;
