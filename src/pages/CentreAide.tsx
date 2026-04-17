import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Search, BookOpen, Calendar, Shield, CreditCard, User, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const categories = [
  {
    icon: <User className="w-6 h-6" />,
    title: "Créer un compte",
    color: "text-primary bg-teal-pale",
    articles: [
      "Comment créer un compte patient ?",
      "Comment s'inscrire en tant que psychologue ?",
      "Modifier mon profil et mes informations",
      "Supprimer mon compte",
    ],
  },
  {
    icon: <Calendar className="w-6 h-6" />,
    title: "Réservations",
    color: "text-blue-700 bg-blue-50",
    articles: [
      "Comment réserver une séance ?",
      "Modifier ou annuler une réservation",
      "La séance n'a pas eu lieu, que faire ?",
      "Recevoir une confirmation par email",
    ],
  },
  {
    icon: <CreditCard className="w-6 h-6" />,
    title: "Paiements",
    color: "text-emerald-700 bg-emerald-50",
    articles: [
      "Quels modes de paiement sont acceptés ?",
      "Obtenir un remboursement",
      "Factures et reçus de paiement",
      "Problème avec un paiement",
    ],
  },
  {
    icon: <BookOpen className="w-6 h-6" />,
    title: "Séances en ligne",
    color: "text-violet-700 bg-violet-50",
    articles: [
      "Comment se connecter à une séance vidéo ?",
      "Problèmes de connexion et de son",
      "Tester mon équipement avant la séance",
      "Sécurité des séances vidéo",
    ],
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "Confidentialité & Sécurité",
    color: "text-amber-700 bg-amber-50",
    articles: [
      "Comment Majal protège mes données ?",
      "Qui peut voir mes informations ?",
      "Changer mon mot de passe",
      "Signaler un problème de sécurité",
    ],
  },
  {
    icon: <User className="w-6 h-6" />,
    title: "Espace Psychologue",
    color: "text-rose-700 bg-rose-50",
    articles: [
      "Configurer mes disponibilités",
      "Gérer mes patients",
      "Comment recevoir mes paiements ?",
      "Mettre à jour mon profil professionnel",
    ],
  },
];

const CentreAide = () => (
  <div>
    <Navbar />

    <div className="bg-teal-hero px-[5%] pt-16 pb-14 text-center">
      <h1 className="font-serif text-primary text-[clamp(30px,4vw,48px)] mb-3">Centre d'aide</h1>
      <p className="text-base text-muted-foreground mb-8">Comment pouvons-nous vous aider ?</p>
      <div className="max-w-xl mx-auto flex items-center gap-2.5 border border-border rounded-full px-5 py-3.5 bg-card shadow-card">
        <Search className="w-5 h-5 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Rechercher dans le centre d'aide..."
          className="border-none bg-transparent outline-none text-[15px] text-foreground w-full placeholder:text-muted-foreground font-sans"
        />
      </div>
    </div>

    <section className="max-w-5xl mx-auto px-[5%] py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map(cat => (
          <div key={cat.title} className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-shadow">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${cat.color}`}>
              {cat.icon}
            </div>
            <h3 className="font-semibold text-[16px] text-foreground mb-4">{cat.title}</h3>
            <ul className="space-y-2.5">
              {cat.articles.map(a => (
                <li key={a}>
                  <a href="/contact" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors no-underline group">
                    <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    {a}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-14 bg-gradient-to-br from-teal-cta to-teal-light rounded-2xl p-10 text-center">
        <h3 className="font-serif text-2xl text-primary-foreground mb-2">Toujours besoin d'aide ?</h3>
        <p className="text-primary-foreground/80 text-sm mb-7">Notre équipe de support est disponible du lundi au vendredi, de 9h à 18h.</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/faq" className="px-7 py-3 bg-card text-primary rounded-full text-sm font-semibold no-underline hover:-translate-y-0.5 hover:shadow-card-hover transition-all">
            Consulter la FAQ
          </Link>
          <Link to="/contact" className="px-7 py-3 bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/30 rounded-full text-sm font-semibold no-underline hover:bg-primary-foreground/30 transition-colors">
            Nous contacter
          </Link>
        </div>
      </div>
    </section>
    <Footer />
  </div>
);

export default CentreAide;
