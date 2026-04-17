import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Eye, EyeOff } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    } else {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setReady(true);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t("auth.minChars"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("✅");
      navigate("/mon-espace");
    }
  };

  return (
    <div>
      <Navbar />
      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center bg-teal-hero px-4 py-12">
        <div className="bg-card rounded-2xl shadow-card p-8 sm:p-10 w-full max-w-[440px]">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl text-primary mb-2">{t("reset.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("reset.subtitle")}</p>
          </div>

          {!ready ? (
            <p className="text-center text-sm text-muted-foreground">{t("reset.loading")}</p>
          ) : (
            <form onSubmit={handleUpdate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-muted-foreground">{t("reset.newPassword")}</label>
                <div className="flex items-center gap-2.5 border border-border rounded-xl px-4 py-3 bg-teal-hero focus-within:border-teal-light focus-within:bg-card transition-colors">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.minChars")}
                    className="border-none bg-transparent outline-none text-[15px] text-foreground w-full placeholder:text-muted-foreground font-sans"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="bg-transparent border-none cursor-pointer p-0">
                    {showPw ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[15px] font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors disabled:opacity-50 font-sans">
                {loading ? t("reset.updating") : t("reset.update")}
              </button>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ResetPassword;
