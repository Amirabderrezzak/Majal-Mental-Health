import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Sign in with email/password
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.user) {
        console.error("[AdminLogin] sign-in failed:", error?.code, error?.message);
        const msg =
          error?.code === "email_not_confirmed"
            ? "Email non confirmé — confirmez le compte dans Supabase → Authentication → Users."
            : error?.code === "over_request_rate_limit"
              ? "Trop de tentatives — réessayez dans une minute."
              : t("admin.toast.badCreds");
        toast.error(msg);
        setLoading(false);
        return;
      }

      // Step 2: Verify the account has admin rights
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("user_id", data.user.id)
        .single();

      if (profileError || !profile?.is_admin) {
        await supabase.auth.signOut();
        toast.error(t("admin.toast.accessDenied"));
        setLoading(false);
        return;
      }

      // Step 3: Admin verified — redirect to dashboard
      navigate("/admin");
    } catch (err: any) {
      toast.error(t("admin.toast.error"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/30 via-gray-950 to-gray-950 pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo / Badge */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center shadow-xl mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Majal Admin</h1>
          <p className="text-gray-500 text-sm mt-1">{t("admin.login.subtitle")}</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="flex flex-col gap-5">

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {t("admin.login.emailLabel")}
              </label>
              <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus-within:border-teal-500 transition-colors">
                <Mail className="w-4 h-4 text-gray-500 shrink-0" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@majal.dz"
                  className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-gray-600 font-sans"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {t("admin.login.passwordLabel")}
              </label>
              <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus-within:border-teal-500 transition-colors">
                <Lock className="w-4 h-4 text-gray-500 shrink-0" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-gray-600 font-sans flex-1"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="bg-transparent border-none cursor-pointer p-0 text-gray-500 hover:text-gray-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer border-none flex items-center justify-center gap-2"
            >
              {loading ? (
                 <><Loader2 className="w-4 h-4 animate-spin" /> {t("admin.login.verifying")}</>
               ) : (
                 <><Shield className="w-4 h-4" /> {t("admin.login.accessBtn")}</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          {t("admin.login.footer")}
        </p>
      </div>
    </div>
  );
}
