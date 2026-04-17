import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mail } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

const MotDePasseOublie = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center bg-teal-hero px-4 py-12">
        <div className="bg-card rounded-2xl shadow-card p-8 sm:p-10 w-full max-w-[440px]">
          {sent ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📧</div>
              <h1 className="font-serif text-2xl text-primary mb-3">{t("forgot.sentTitle")}</h1>
              <p className="text-sm text-muted-foreground mb-6">{t("forgot.sentMsg")}</p>
              <Link to="/connexion" className="text-primary text-sm font-medium no-underline hover:underline">
                {t("forgot.backToLogin")}
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="font-serif text-3xl text-primary mb-2">{t("forgot.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("forgot.subtitle")}</p>
              </div>
              <form onSubmit={handleReset} className="flex flex-col gap-4">
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
                <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[15px] font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors disabled:opacity-50 font-sans">
                  {loading ? t("forgot.sending") : t("forgot.send")}
                </button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-6">
                <Link to="/connexion" className="text-primary font-medium no-underline hover:underline">{t("forgot.backToLogin")}</Link>
              </p>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MotDePasseOublie;
