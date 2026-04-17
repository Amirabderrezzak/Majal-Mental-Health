import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    q: "Comment fonctionne Majal ?",
    a: "Majal est une plateforme qui vous connecte avec des psychologues certifiés en Algérie. Vous pouvez parcourir les profils, choisir un professionnel selon vos besoins et réserver une séance en ligne en quelques clics.",
  },
  {
    q: "Les psychologues sont-ils certifiés ?",
    a: "Oui, tous les psychologues présents sur Majal sont vérifiés et doivent fournir leur numéro d'ordre professionnel lors de leur inscription. Nous validons chaque profil avant de le rendre public.",
  },
  {
    q: "Mes données sont-elles protégées ?",
    a: "Absolument. Toutes les données échangées sur Majal sont chiffrées et protégées. Nous ne vendons jamais vos informations personnelles à des tiers. Consultez notre politique de confidentialité pour plus de détails.",
  },
  {
    q: "Comment annuler une réservation ?",
    a: "Vous pouvez annuler une réservation depuis votre espace personnel (Mon Espace → Mes Séances) jusqu'à 24h avant le rendez-vous. Au-delà de ce délai, des frais d'annulation peuvent s'appliquer selon le praticien.",
  },
  {
    q: "Puis-je changer de psychologue ?",
    a: "Bien sûr. Vous êtes libre de consulter différents professionnels et de choisir celui qui vous convient le mieux. Chaque psychologue propose une première consultation pour vous aider à faire votre choix.",
  },
  {
    q: "Les séances se font-elles uniquement en ligne ?",
    a: "Majal est avant tout une plateforme de téléconsultation. Certains psychologues proposent également des consultations en cabinet — consultez leur profil pour voir les modalités disponibles.",
  },
  {
    q: "Quel est le tarif des séances ?",
    a: "Les tarifs varient selon les praticiens, généralement entre 2 500 et 5 000 DZD par séance. Vous trouverez le prix affiché sur chaque fiche profil avant de réserver.",
  },
  {
    q: "Comment payer une séance ?",
    a: "Les modalités de paiement sont définies par chaque psychologue. Nous travaillons à intégrer un système de paiement sécurisé en ligne prochainement.",
  },
];

const FAQ = () => {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div>
      <Navbar />
      <div className="bg-teal-hero px-[5%] pt-16 pb-12 text-center">
        <h1 className="font-serif text-primary text-[clamp(30px,4vw,48px)] mb-3">Questions fréquentes</h1>
        <p className="text-base text-muted-foreground max-w-xl mx-auto">
          Tout ce que vous devez savoir sur Majal et nos services.
        </p>
      </div>

      <section className="max-w-2xl mx-auto px-[5%] py-16">
        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-card rounded-xl shadow-card overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left bg-transparent border-none cursor-pointer"
              >
                <span className="font-medium text-[15px] text-foreground pr-4">{faq.q}</span>
                <ChevronDown className={`w-5 h-5 text-primary shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-[15px] text-muted-foreground leading-relaxed border-t border-border pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-14 bg-teal-pale rounded-2xl p-8 text-center">
          <h3 className="font-serif text-xl text-primary mb-2">Vous n'avez pas trouvé votre réponse ?</h3>
          <p className="text-sm text-muted-foreground mb-5">Notre équipe est disponible pour vous aider.</p>
          <a href="/contact" className="inline-block px-7 py-3 rounded-full bg-primary text-primary-foreground text-sm font-medium no-underline hover:bg-teal-mid transition-colors">
            Contactez-nous
          </a>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default FAQ;
