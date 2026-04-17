import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

const Connexion = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  /** Resolve the redirect destination based on user_type */
  const getRedirectPath = async (userId: string): Promise<string> => {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
    if (from && from !== "/connexion") return from;
    const { data } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("user_id", userId)
      .single();
    return data?.user_type === "psychologue" ? "/espace-psy" : "/mon-espace";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
    } else if (data.user) {
      const path = await getRedirectPath(data.user.id);
      setLoading(false);
      navigate(path);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/mon-espace",
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

  return (
    <div>
      <Navbar />
      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center bg-teal-hero px-4 py-12">
        <div className="bg-card rounded-2xl shadow-card p-8 sm:p-10 w-full max-w-[440px]">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl text-primary mb-2">{t("auth.welcome")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.loginSubtitle")}</p>
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-border bg-card text-foreground text-sm font-medium cursor-pointer hover:bg-teal-hero transition-colors mb-6 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {t("auth.google")}
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{t("auth.email")}</label>
              <div className="flex items-center gap-2.5 border border-border rounded-xl px-4 py-3 bg-teal-hero focus-within:border-teal-light focus-within:bg-card transition-colors">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="border-none bg-transparent outline-none text-[15px] text-foreground w-full placeholder:text-muted-foreground font-sans"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{t("auth.password")}</label>
              <div className="flex items-center gap-2.5 border border-border rounded-xl px-4 py-3 bg-teal-hero focus-within:border-teal-light focus-within:bg-card transition-colors">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <input
                  type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="border-none bg-transparent outline-none text-[15px] text-foreground w-full placeholder:text-muted-foreground font-sans"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="bg-transparent border-none cursor-pointer p-0">
                  {showPw ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/mot-de-passe-oublie" className="text-[13px] text-primary no-underline hover:underline">{t("auth.forgot")}</Link>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[15px] font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors disabled:opacity-50 font-sans">
              {loading ? t("auth.loggingIn") : t("auth.loginBtn")}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("auth.noAccount")}{" "}
            <Link to="/inscription" className="text-primary font-medium no-underline hover:underline">{t("auth.signupLink")}</Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Connexion;
