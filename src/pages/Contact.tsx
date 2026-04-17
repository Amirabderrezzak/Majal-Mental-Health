import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, Phone, MapPin, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Contact = () => {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate sending (replace with a real email API like Resend/EmailJS)
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    toast.success("✅ Message envoyé ! Nous vous répondrons dans les 24h.");
    setName(""); setEmail(""); setSubject(""); setMessage("");
  };

  const inputCls = "px-4 py-3 border border-border rounded-xl text-[15px] text-foreground bg-teal-hero outline-none focus:border-teal-light focus:bg-card transition-colors font-sans w-full";

  return (
    <div>
      <Navbar />
      <div className="bg-teal-hero px-[5%] pt-16 pb-12 text-center">
        <h1 className="font-serif text-primary text-[clamp(30px,4vw,48px)] mb-3">Contactez-nous</h1>
        <p className="text-base text-muted-foreground max-w-xl mx-auto">
          Une question, une suggestion ou un problème ? Notre équipe vous répondra sous 24h.
        </p>
      </div>

      <section className="max-w-5xl mx-auto px-[5%] py-16 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
        {/* Form */}
        <div className="bg-card rounded-2xl shadow-card p-8">
          <h2 className="font-serif text-2xl text-primary mb-7">Envoyez-nous un message</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-muted-foreground">Nom complet</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Votre nom" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-muted-foreground">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" className={inputCls} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">Sujet</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} required className={inputCls + " cursor-pointer"}>
                <option value="">Choisissez un sujet</option>
                <option value="technique">Problème technique</option>
                <option value="reservation">Question sur une réservation</option>
                <option value="paiement">Paiement</option>
                <option value="psy">Devenir psychologue sur Majal</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">Message</label>
              <textarea required value={message} onChange={e => setMessage(e.target.value)} rows={5}
                placeholder="Décrivez votre question ou problème en détail..."
                className={inputCls + " resize-none"} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[15px] font-medium border-none cursor-pointer hover:bg-teal-mid transition-colors disabled:opacity-70 flex items-center justify-center gap-2 font-sans mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? "Envoi en cours..." : "Envoyer le message"}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          {[
            { icon: <Mail className="w-5 h-5 text-primary" />, title: "Email", lines: ["support@majal.dz", "contact@majal.dz"] },
            { icon: <Phone className="w-5 h-5 text-primary" />, title: "Téléphone", lines: ["+213 (0) 23 XX XX XX", "Lun – Ven, 9h – 18h"] },
            { icon: <MapPin className="w-5 h-5 text-primary" />, title: "Adresse", lines: ["Alger, Algérie"] },
          ].map(c => (
            <div key={c.title} className="bg-card rounded-xl shadow-card p-6 flex gap-4">
              <div className="w-10 h-10 bg-teal-pale rounded-xl flex items-center justify-center shrink-0">{c.icon}</div>
              <div>
                <h4 className="font-semibold text-[15px] text-foreground mb-1">{c.title}</h4>
                {c.lines.map(l => <p key={l} className="text-sm text-muted-foreground">{l}</p>)}
              </div>
            </div>
          ))}

          <div className="bg-teal-pale rounded-xl p-6">
            <h4 className="font-semibold text-[15px] text-primary mb-2">Temps de réponse</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nous nous engageons à répondre à toutes les demandes dans un délai de <strong>24 heures ouvrées</strong>.
              Pour les urgences, appelez-nous directement.
            </p>
          </div>

          <div className="bg-card rounded-xl shadow-card p-6">
            <h4 className="font-semibold text-[15px] text-foreground mb-3">Consultez aussi notre</h4>
            <a href="/faq" className="text-primary text-sm font-medium hover:underline">→ Centre de questions fréquentes (FAQ)</a>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Contact;
