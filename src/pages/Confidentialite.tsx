import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const sections = [
  {
    title: "1. Collecte des données",
    content: `Majal collecte les informations que vous fournissez directement lors de votre inscription, notamment votre nom complet, adresse email, numéro de téléphone et, pour les psychologues, votre numéro d'ordre professionnel, spécialité et ville d'exercice.

Nous collectons également des données techniques lors de votre utilisation du service : adresse IP, type de navigateur, pages visitées, et horodatages des connexions. Ces données sont collectées automatiquement afin d'assurer le bon fonctionnement de la plateforme.`,
  },
  {
    title: "2. Utilisation des données",
    content: `Les données collectées sont utilisées exclusivement pour :
• Vous permettre de créer et gérer votre compte
• Faciliter la mise en relation entre patients et psychologues
• Envoyer des confirmations et rappels de séances
• Améliorer la qualité et la sécurité de nos services
• Répondre à vos demandes de support

Majal ne vend ni ne loue vos données personnelles à des tiers.`,
  },
  {
    title: "3. Partage des données",
    content: `Vos données sont partagées uniquement dans les cas suivants :
• Avec le psychologue que vous avez choisi de consulter (nom, téléphone de contact)
• Avec nos prestataires techniques (hébergement, authentification) soumis à des engagements de confidentialité stricts
• En réponse à une obligation légale ou une décision judiciaire

Toute organisation tierce avec qui nous partageons des données est contractuellement tenue de protéger vos informations.`,
  },
  {
    title: "4. Sécurité des données",
    content: `Majal utilise des mesures de sécurité techniques et organisationnelles avancées pour protéger vos données :
• Chiffrement SSL/TLS pour toutes les communications
• Base de données chiffrée au repos
• Authentification sécurisée via Supabase Auth
• Politiques de sécurité au niveau des lignes (Row Level Security)
• Accès aux données limité au strict nécessaire

Malgré ces précautions, aucun système n'est infaillible. Nous vous encourageons à protéger votre mot de passe et à nous signaler toute activité suspecte.`,
  },
  {
    title: "5. Conservation des données",
    content: `Vos données personnelles sont conservées pendant toute la durée de votre compte actif, et pendant une période de 3 ans après la désactivation de votre compte à des fins légales et de résolution de litiges.

Les données de santé liées à vos séances de thérapie sont soumises aux réglementations algériennes en matière de données médicales.`,
  },
  {
    title: "6. Vos droits",
    content: `Conformément à la législation applicable, vous disposez des droits suivants :
• Droit d'accès : obtenir une copie de vos données
• Droit de rectification : corriger des données inexactes
• Droit à l'effacement : demander la suppression de votre compte et données
• Droit à la portabilité : recevoir vos données dans un format lisible
• Droit d'opposition : refuser certains traitements de vos données

Pour exercer ces droits, contactez-nous à : privacy@majal.dz`,
  },
  {
    title: "7. Cookies",
    content: `Majal utilise des cookies techniques essentiels au bon fonctionnement du service (authentification, préférences de langue). Nous n'utilisons pas de cookies publicitaires ou de tracking tiers.

Vous pouvez configurer votre navigateur pour refuser les cookies, mais cela peut altérer certaines fonctionnalités de la plateforme.`,
  },
  {
    title: "8. Modifications de cette politique",
    content: `Nous pouvons mettre à jour cette politique de confidentialité ponctuellement. En cas de modifications substantielles, vous serez notifié par email et/ou via une bannière sur le site. La date de dernière mise à jour est indiquée en haut de cette page.`,
  },
];

const Confidentialite = () => (
  <div>
    <Navbar />
    <div className="bg-teal-hero px-[5%] pt-16 pb-12 text-center">
      <h1 className="font-serif text-primary text-[clamp(30px,4vw,48px)] mb-3">Politique de confidentialité</h1>
      <p className="text-sm text-muted-foreground">Dernière mise à jour : 17 avril 2026</p>
    </div>

    <article className="max-w-3xl mx-auto px-[5%] py-16">
      <div className="bg-card rounded-2xl shadow-card p-8 mb-8">
        <p className="text-[15px] text-foreground leading-relaxed">
          Chez <strong>Majal</strong>, la confidentialité de vos données personnelles est une priorité absolue. Cette politique explique comment nous collectons, utilisons, stockons et protégeons vos informations lorsque vous utilisez notre plateforme de mise en relation avec des psychologues.
        </p>
        <p className="text-[15px] text-foreground leading-relaxed mt-4">
          En utilisant Majal, vous acceptez les pratiques décrites dans cette politique. Si vous n'y adhérez pas, veuillez ne pas utiliser nos services.
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
          Pour toute question concernant cette politique, contactez notre délégué à la protection des données :{" "}
          <a href="mailto:privacy@majal.dz" className="text-primary font-medium hover:underline">privacy@majal.dz</a>
        </p>
      </div>
    </article>
    <Footer />
  </div>
);

export default Confidentialite;
