import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const sections = [
  {
    title: "1. Acceptation des conditions",
    content: `En accédant à la plateforme Majal et en l'utilisant, vous acceptez d'être lié par les présentes Conditions Générales d'Utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.

Ces conditions s'appliquent à tous les utilisateurs de la plateforme, qu'il s'agisse de patients ou de professionnels de santé mentale (psychologues, thérapeutes).`,
  },
  {
    title: "2. Description du service",
    content: `Majal est une plateforme numérique de mise en relation entre des patients cherchant un accompagnement psychologique et des professionnels de santé mentale certifiés.

Majal n'est pas un prestataire de soins de santé. Nous sommes une plateforme technologique facilitant la connexion entre patients et praticiens. Toute relation thérapeutique est établie directement entre le patient et le psychologue.`,
  },
  {
    title: "3. Inscription et compte utilisateur",
    content: `Pour utiliser la majorité des fonctionnalités de Majal, vous devez créer un compte en fournissant des informations exactes et complètes. Vous êtes responsable de :
• La confidentialité de vos identifiants de connexion
• Toutes les activités réalisées depuis votre compte
• La mise à jour de vos informations en cas de changement

Les psychologues doivent fournir un numéro d'ordre professionnel valide. Tout profil frauduleux sera supprimé immédiatement.`,
  },
  {
    title: "4. Règles d'utilisation",
    content: `En utilisant Majal, vous vous engagez à :
• Fournir des informations véridiques et à jour
• Ne pas usurper l'identité d'un tiers
• Ne pas tenter d'accéder à des comptes ou données qui ne vous appartiennent pas
• Ne pas utiliser la plateforme à des fins illégales ou contraires à l'éthique
• Traiter les autres utilisateurs avec respect

Toute violation de ces règles peut entraîner la suspension ou la suppression définitive de votre compte.`,
  },
  {
    title: "5. Réservations et annulations",
    content: `Les réservations sont soumises aux conditions suivantes :
• Toute réservation confirmée est un engagement entre le patient et le psychologue
• Les annulations peuvent être effectuées jusqu'à 24h avant la séance sans frais
• En dessous de 24h, des frais d'annulation peuvent s'appliquer selon les conditions du praticien
• Majal se réserve le droit d'annuler une réservation en cas de comportement inapproprié

En cas de litige, contactez notre support à support@majal.dz.`,
  },
  {
    title: "6. Paiements",
    content: `Les tarifs des séances sont définis par chaque psychologue et affichés clairement sur leur profil. Majal peut percevoir une commission sur les transactions réalisées via la plateforme.

Toute facturation erronée doit être signalée dans les 7 jours suivant la transaction. Majal décline toute responsabilité pour les paiements effectués en dehors de la plateforme.`,
  },
  {
    title: "7. Propriété intellectuelle",
    content: `L'ensemble du contenu de la plateforme Majal — notamment le logo, le design, les textes, et le code source — est protégé par le droit d'auteur et appartient à Majal ou à ses concédants de licence.

Toute reproduction, distribution, ou utilisation non autorisée de ce contenu est strictement interdite.`,
  },
  {
    title: "8. Limitation de responsabilité",
    content: `Majal met tout en œuvre pour assurer la disponibilité et la fiabilité de la plateforme, mais ne peut garantir un service ininterrompu. En aucun cas Majal ne saurait être tenu responsable de :
• La qualité des séances dispensées par les psychologues
• L'inexactitude d'informations fournies par les utilisateurs
• Des dommages indirects résultant de l'utilisation du service
• Une interruption temporaire du service due à une maintenance ou force majeure`,
  },
  {
    title: "9. Droit applicable",
    content: `Les présentes conditions sont régies par le droit algérien. Tout litige relatif à l'interprétation ou à l'exécution de ces conditions sera soumis à la compétence exclusive des tribunaux d'Alger, sauf disposition légale contraire.`,
  },
  {
    title: "10. Modifications des conditions",
    content: `Majal se réserve le droit de modifier les présentes conditions à tout moment. Les utilisateurs seront notifiés de tout changement substantiel par email. La poursuite de l'utilisation de la plateforme après notification vaut acceptation des nouvelles conditions.`,
  },
];

const Conditions = () => (
  <div>
    <Navbar />
    <div className="bg-teal-hero px-[5%] pt-16 pb-12 text-center">
      <h1 className="font-serif text-primary text-[clamp(30px,4vw,48px)] mb-3">Conditions d'utilisation</h1>
      <p className="text-sm text-muted-foreground">Dernière mise à jour : 17 avril 2026</p>
    </div>

    <article className="max-w-3xl mx-auto px-[5%] py-16">
      <div className="bg-card rounded-2xl shadow-card p-8 mb-8">
        <p className="text-[15px] text-foreground leading-relaxed">
          Les présentes Conditions Générales d'Utilisation régissent l'accès et l'utilisation de la plateforme <strong>Majal</strong> (ci-après « la Plateforme »), éditée par l'équipe Majal, dont le siège est situé à Alger, Algérie.
        </p>
        <p className="text-[15px] text-foreground leading-relaxed mt-4">
          Nous vous invitons à lire attentivement ces conditions avant toute utilisation de la plateforme.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {sections.map(s => (
          <div key={s.title} className="bg-card rounded-xl shadow-card p-7">
            <h2 className="font-serif text-xl text-primary mb-4">{s.title}</h2>
            <div className="text-[15px] text-foreground leading-relaxed whitespace-pre-line">{s.content}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 p-7 bg-teal-pale rounded-xl text-center">
        <p className="text-sm text-muted-foreground">
          Pour toute question, contactez-nous à{" "}
          <a href="mailto:legal@majal.dz" className="text-primary font-medium hover:underline">legal@majal.dz</a>
        </p>
      </div>
    </article>
    <Footer />
  </div>
);

export default Conditions;
