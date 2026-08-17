import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, Phone, MapPin, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

const Contact = () => {
  const { t } = useLanguage();
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success(t("contact.sent"));
      setName(""); setEmail(""); setSubject(""); setMessage("");
    } catch {
      toast.error(t("contact.failed"));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "px-4 py-3 border border-border rounded-xl text-[15px] text-foreground bg-teal-hero outline-none focus:border-teal-light focus:bg-card transition-colors font-sans w-full";

  return (
    <div>
      <Navbar />
      <div className="bg-teal-hero px-[5%] pt-16 pb-12 text-center">
        <h1 className="font-serif text-primary text-[clamp(30px,4vw,48px)] mb-3">{t("contact.title")}</h1>
        <p className="text-base text-muted-foreground max-w-xl mx-auto">
          {t("contact.subtitle")}
        </p>
      </div>

      <section className="max-w-5xl mx-auto px-[5%] py-16 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
        {/* Form */}
        <div className="bg-card rounded-2xl shadow-card p-8">
          <h2 className="font-serif text-2xl text-primary mb-7">{t("contact.formTitle")}</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-muted-foreground">{t("contact.nameLabel")}</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder={t("contact.namePlaceholder")} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-muted-foreground">{t("auth.email")}</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" className={inputCls} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{t("contact.subjectLabel")}</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} required className={inputCls + " cursor-pointer"}>
                <option value="">{t("contact.subjectChoose")}</option>
                <option value="technique">{t("contact.subject.technique")}</option>
                <option value="reservation">{t("contact.subject.reservation")}</option>
                <option value="paiement">{t("contact.subject.payment")}</option>
                <option value="psy">{t("contact.subject.psy")}</option>
                <option value="autre">{t("contact.subject.other")}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">{t("contact.messageLabel")}</label>
              <textarea required value={message} onChange={e => setMessage(e.target.value)} rows={5}
                placeholder={t("contact.messagePlaceholder")}
                className={inputCls + " resize-none"} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[15px] font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors disabled:opacity-70 flex items-center justify-center gap-2 font-sans mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? t("contact.sending") : t("contact.sendBtn")}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          {[
            { icon: <Mail className="w-5 h-5 text-primary" />, title: t("auth.email"), lines: ["support@majal.dz", "contact@majal.dz"] },
            { icon: <Phone className="w-5 h-5 text-primary" />, title: t("auth.phone"), lines: ["+213 (0) 23 XX XX XX", "Lun – Ven, 9h – 18h"] },
            { icon: <MapPin className="w-5 h-5 text-primary" />, title: t("contact.info.address"), lines: ["Alger, Algérie"] },
          ].map(c => (
            <div key={c.title} className="bg-card rounded-xl shadow-card p-6 flex gap-4">
              <div className="w-10 h-10 bg-[#2A9D8F] rounded-xl flex items-center justify-center shrink-0">{c.icon}</div>
              <div>
                <h4 className="font-semibold text-[15px] text-foreground mb-1">{c.title}</h4>
                {c.lines.map(l => <p key={l} className="text-sm text-muted-foreground">{l}</p>)}
              </div>
            </div>
          ))}

          <div className="bg-teal-pale rounded-xl p-6">
            <h4 className="font-semibold text-[15px] text-primary mb-2">{t("contact.responseTitle")}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("contact.responseText")}
            </p>
          </div>

          <div className="bg-card rounded-xl shadow-card p-6">
            <h4 className="font-semibold text-[15px] text-foreground mb-3">{t("contact.faqTitle")}</h4>
            <a href="/faq" className="text-primary text-sm font-medium hover:underline">{t("contact.faqLink")}</a>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Contact;
