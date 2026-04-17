import { createContext, useContext, useState, ReactNode, useEffect } from "react";

type Lang = "fr" | "ar";

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const translations: Record<string, Record<Lang, string>> = {
  // Navbar
  "nav.home": { fr: "Accueil", ar: "الرئيسية" },
  "nav.find": { fr: "Trouver un psychologue", ar: "ابحث عن أخصائي نفسي" },
  "nav.space": { fr: "Mon espace", ar: "مساحتي" },
  "nav.login": { fr: "Se connecter", ar: "تسجيل الدخول" },
  "nav.signup": { fr: "S'inscrire", ar: "إنشاء حساب" },
  "nav.logout": { fr: "Déconnexion", ar: "تسجيل الخروج" },
  "nav.langSwitch": { fr: "العربية", ar: "Français" },

  // Hero
  "hero.title": { fr: "Votre espace de santé mentale", ar: "مساحتك للصحة النفسية" },
  "hero.subtitle": { fr: "Connectez-vous avec des psychologues professionnels, à votre rythme, en toute confidentialité.", ar: "تواصل مع أخصائيين نفسيين محترفين، بالوتيرة التي تناسبك، بسرية تامة." },
  "hero.cta": { fr: "Trouver un psychologue", ar: "ابحث عن أخصائي نفسي" },
  "hero.how": { fr: "Comment ça marche", ar: "كيف يعمل" },
  "hero.overlay.subtitle": { fr: "Espace d'écoute", ar: "فضاء الإصغاء" },

  // Stats
  "stats.psychologists": { fr: "Psychologues certifiés", ar: "أخصائيون نفسيون معتمدون" },
  "stats.sessions": { fr: "Séances réalisées", ar: "جلسات منجزة" },
  "stats.satisfaction": { fr: "Satisfaction clients", ar: "رضا العملاء" },
  "stats.support": { fr: "Support disponible", ar: "دعم متاح" },

  // How it works
  "how.title": { fr: "Comment ça marche ?", ar: "كيف يعمل؟" },
  "how.subtitle": { fr: "Trois étapes simples pour commencer votre parcours", ar: "ثلاث خطوات بسيطة لبدء مسارك" },
  "how.step1.title": { fr: "Trouvez votre psychologue", ar: "ابحث عن أخصائيك النفسي" },
  "how.step1.desc": { fr: "Parcourez les profils et choisissez selon vos besoins", ar: "تصفح الملفات واختر حسب احتياجاتك" },
  "how.step2.title": { fr: "Réservez une séance", ar: "احجز جلسة" },
  "how.step2.desc": { fr: "Sélectionnez un créneau qui vous convient", ar: "اختر موعداً يناسبك" },
  "how.step3.title": { fr: "Commencez votre thérapie", ar: "ابدأ علاجك" },
  "how.step3.desc": { fr: "Consultez en ligne en toute sécurité", ar: "استشر عبر الإنترنت بأمان تام" },

  // Why Majal
  "why.title": { fr: "Pourquoi choisir Majal ?", ar: "لماذا تختار مجال؟" },
  "why.1.title": { fr: "Confidentiel et sécurisé", ar: "سري وآمن" },
  "why.1.desc": { fr: "Vos données sont protégées", ar: "بياناتك محمية" },
  "why.2.title": { fr: "Psychologues certifiés", ar: "أخصائيون معتمدون" },
  "why.2.desc": { fr: "Tous nos professionnels sont qualifiés", ar: "جميع المهنيين لدينا مؤهلون" },
  "why.3.title": { fr: "Flexible et accessible", ar: "مرن وسهل الوصول" },
  "why.3.desc": { fr: "Consultez de chez vous, quand vous voulez", ar: "استشر من منزلك، متى شئت" },
  "why.4.title": { fr: "Soutien personnalisé", ar: "دعم مخصص" },
  "why.4.desc": { fr: "Trouvez le thérapeute qui vous correspond", ar: "ابحث عن المعالج الذي يناسبك" },

  // Testimonials
  "test.title": { fr: "Témoignages", ar: "شهادات" },
  "test.subtitle": { fr: "Ce que disent nos utilisateurs", ar: "ماذا يقول مستخدمونا" },
  "test.1.text": { fr: "Majal m'a aidé à trouver un psychologue formidable. Je me sens enfin écoutée.", ar: "ساعدني مجال في إيجاد أخصائي نفسي رائع. أشعر أخيراً بأنني مسموعة." },
  "test.2.text": { fr: "Simple, discret et efficace. Exactement ce dont j'avais besoin.", ar: "بسيط، سري وفعال. بالضبط ما كنت أحتاجه." },
  "test.3.text": { fr: "Je recommande Majal à tous ceux qui cherchent un soutien psychologique de qualité.", ar: "أنصح بمجال لكل من يبحث عن دعم نفسي ذي جودة." },

  // CTA
  "cta.title": { fr: "Prenez soin de vous aujourd'hui", ar: "اعتنِ بنفسك اليوم" },
  "cta.subtitle": { fr: "Rejoignez des milliers de personnes qui ont fait le premier pas", ar: "انضم إلى آلاف الأشخاص الذين اتخذوا الخطوة الأولى" },
  "cta.button": { fr: "Commencer maintenant", ar: "ابدأ الآن" },

  // Footer
  "footer.tagline": { fr: "Votre espace de santé mentale en ligne", ar: "مساحتك للصحة النفسية عبر الإنترنت" },
  "footer.nav": { fr: "Navigation", ar: "التنقل" },
  "footer.support": { fr: "Support", ar: "الدعم" },
  "footer.help": { fr: "Centre d'aide", ar: "مركز المساعدة" },
  "footer.contact": { fr: "Contactez-nous", ar: "اتصل بنا" },
  "footer.faq": { fr: "FAQ", ar: "الأسئلة الشائعة" },
  "footer.legal": { fr: "Légal", ar: "قانوني" },
  "footer.privacy": { fr: "Confidentialité", ar: "الخصوصية" },
  "footer.terms": { fr: "Conditions", ar: "الشروط" },
  "footer.rights": { fr: "© 2026 Majal. Tous droits réservés.", ar: "© 2026 مجال. جميع الحقوق محفوظة." },

  // Psychologues page
  "psy.title": { fr: "Trouver votre psychologue", ar: "ابحث عن أخصائيك النفسي" },
  "psy.subtitle": { fr: "Parcourez notre réseau de professionnels certifiés", ar: "تصفح شبكتنا من المهنيين المعتمدين" },
  "psy.search": { fr: "Rechercher par nom ou spécialité...", ar: "البحث بالاسم أو التخصص..." },
  "psy.filters": { fr: "Filtres", ar: "فلاتر" },
  "psy.specialty": { fr: "Spécialité", ar: "التخصص" },
  "psy.all": { fr: "Toutes", ar: "الكل" },
  "psy.language": { fr: "Langue", ar: "اللغة" },
  "psy.price": { fr: "Prix", ar: "السعر" },
  "psy.allPrices": { fr: "Tous", ar: "الكل" },
  "psy.available": { fr: "disponible", ar: "متاح" },
  "psy.availables": { fr: "disponibles", ar: "متاحون" },
  "psy.psychologue": { fr: "psychologue", ar: "أخصائي نفسي" },
  "psy.psychologues": { fr: "psychologues", ar: "أخصائيون نفسيون" },
  "psy.book": { fr: "Réserver", ar: "احجز" },
  "psy.experience": { fr: "ans d'expérience", ar: "سنوات خبرة" },
  "psy.session": { fr: "/ séance", ar: "/ جلسة" },
  "psy.lessThan": { fr: "Moins de", ar: "أقل من" },

  // Reservation
  "res.back": { fr: "Retour au profil", ar: "العودة للملف" },
  "res.title": { fr: "Réserver une séance", ar: "احجز جلسة" },
  "res.with": { fr: "avec", ar: "مع" },
  "res.selectDate": { fr: "Sélectionnez une date", ar: "اختر تاريخاً" },
  "res.selectTime": { fr: "Sélectionnez un horaire", ar: "اختر وقتاً" },
  "res.morning": { fr: "Matin", ar: "صباحاً" },
  "res.afternoon": { fr: "Après-midi", ar: "بعد الظهر" },
  "res.evening": { fr: "Soir", ar: "مساءً" },
  "res.recap": { fr: "Récapitulatif", ar: "ملخص" },
  "res.date": { fr: "Date", ar: "التاريخ" },
  "res.time": { fr: "Horaire", ar: "الوقت" },
  "res.duration": { fr: "Durée", ar: "المدة" },
  "res.minutes": { fr: "60 minutes", ar: "60 دقيقة" },
  "res.price": { fr: "Prix", ar: "السعر" },
  "res.confirm": { fr: "Confirmer la réservation", ar: "تأكيد الحجز" },
  "res.confirmed": { fr: "Réservation confirmée !", ar: "تم تأكيد الحجز!" },
  "res.confirmMsg": { fr: "Votre séance avec", ar: "جلستك مع" },
  "res.confirmMsg2": { fr: "est confirmée le", ar: "تم تأكيدها في" },
  "res.confirmMsg3": { fr: "à", ar: "الساعة" },
  "res.confirmMsg4": { fr: "Vous recevrez un email de confirmation.", ar: "ستتلقى بريداً إلكترونياً للتأكيد." },
  "res.backToPsy": { fr: "Retour aux psychologues", ar: "العودة للأخصائيين" },

  // Calendar
  "cal.months": { fr: "Janvier,Février,Mars,Avril,Mai,Juin,Juillet,Août,Septembre,Octobre,Novembre,Décembre", ar: "يناير,فبراير,مارس,أبريل,مايو,يونيو,يوليو,أغسطس,سبتمبر,أكتوبر,نوفمبر,ديسمبر" },
  "cal.days": { fr: "Dim,Lun,Mar,Mer,Jeu,Ven,Sam", ar: "أحد,إثن,ثلا,أرب,خمي,جمع,سبت" },

  // Profile page
  "prof.back": { fr: "Retour", ar: "العودة" },
  "prof.about": { fr: "À propos", ar: "حول" },
  "prof.reviews": { fr: "Avis", ar: "التقييمات" },
  "prof.book": { fr: "Réserver une séance", ar: "احجز جلسة" },
  "prof.message": { fr: "Envoyer un message", ar: "إرسال رسالة" },
  "prof.experience": { fr: "ans d'expérience", ar: "سنوات خبرة" },
  "prof.languages": { fr: "Langues", ar: "اللغات" },
  "prof.availability": { fr: "Disponibilités", ar: "التوفر" },
  "prof.bio": { fr: "Biographie", ar: "السيرة الذاتية" },
  "prof.approach": { fr: "Approche thérapeutique", ar: "المنهج العلاجي" },
  "prof.training": { fr: "Formation", ar: "التكوين" },
  "prof.slots": { fr: "Créneaux disponibles cette semaine", ar: "المواعيد المتاحة هذا الأسبوع" },
  "prof.session": { fr: "/ séance", ar: "/ جلسة" },
  "prof.reviewWord": { fr: "avis", ar: "تقييم" },

  // Mon Espace
  "space.title": { fr: "Mon espace", ar: "مساحتي" },
  "space.welcome": { fr: "Bienvenue 👋", ar: "مرحباً 👋" },
  "space.totalSessions": { fr: "Séances totales", ar: "إجمالي الجلسات" },
  "space.totalHours": { fr: "Heures de thérapie", ar: "ساعات العلاج" },
  "space.streak": { fr: "Série actuelle", ar: "السلسلة الحالية" },
  "space.upcoming": { fr: "Séances à venir", ar: "الجلسات القادمة" },
  "space.history": { fr: "Historique", ar: "السجل" },
  "space.profile": { fr: "Mon profil", ar: "ملفي الشخصي" },
  "space.join": { fr: "Rejoindre", ar: "انضمام" },
  "space.messageBtn": { fr: "Message", ar: "رسالة" },
  "space.done": { fr: "Terminée", ar: "منتهية" },
  "space.cancelled": { fr: "Annulée", ar: "ملغاة" },
  "space.personalInfo": { fr: "Informations personnelles", ar: "المعلومات الشخصية" },
  "space.name": { fr: "Nom", ar: "الاسم" },
  "space.email": { fr: "Email", ar: "البريد الإلكتروني" },
  "space.phone": { fr: "Téléphone", ar: "الهاتف" },
  "space.language": { fr: "Langue", ar: "اللغة" },
  "space.notifications": { fr: "Notifications", ar: "الإشعارات" },
  "space.emailNotif": { fr: "Notifications par email", ar: "إشعارات البريد الإلكتروني" },
  "space.emailNotifDesc": { fr: "Recevoir des rappels par email", ar: "استلام تذكيرات عبر البريد" },
  "space.smsNotif": { fr: "Notifications SMS", ar: "إشعارات الرسائل القصيرة" },
  "space.smsNotifDesc": { fr: "Recevoir des rappels par SMS", ar: "استلام تذكيرات عبر الرسائل" },
  "space.save": { fr: "Enregistrer les modifications", ar: "حفظ التعديلات" },
  "space.saved": { fr: "✅ Modifications enregistrées !", ar: "✅ تم حفظ التعديلات!" },
  "space.weeks": { fr: "sem.", ar: "أسابيع" },

  // Auth - Connexion
  "auth.welcome": { fr: "Bon retour", ar: "مرحباً بعودتك" },
  "auth.loginSubtitle": { fr: "Connectez-vous à votre espace Majal", ar: "سجل الدخول إلى مساحتك في مجال" },
  "auth.google": { fr: "Continuer avec Google", ar: "المتابعة مع جوجل" },
  "auth.or": { fr: "ou", ar: "أو" },
  "auth.email": { fr: "Email", ar: "البريد الإلكتروني" },
  "auth.password": { fr: "Mot de passe", ar: "كلمة المرور" },
  "auth.forgot": { fr: "Mot de passe oublié ?", ar: "نسيت كلمة المرور؟" },
  "auth.loginBtn": { fr: "Se connecter", ar: "تسجيل الدخول" },
  "auth.loggingIn": { fr: "Connexion...", ar: "جاري الدخول..." },
  "auth.noAccount": { fr: "Pas encore de compte ?", ar: "ليس لديك حساب؟" },
  "auth.signupLink": { fr: "S'inscrire", ar: "إنشاء حساب" },

  // Auth - Inscription
  "auth.createAccount": { fr: "Créer un compte", ar: "إنشاء حساب" },
  "auth.signupSubtitle": { fr: "Rejoignez Majal et prenez soin de vous", ar: "انضم إلى مجال واعتنِ بنفسك" },
  "auth.patient": { fr: "🧑 Particulier", ar: "🧑 فرد" },
  "auth.psychologist": { fr: "🩺 Psychologue", ar: "🩺 أخصائي نفسي" },
  "auth.fullName": { fr: "Nom complet", ar: "الاسم الكامل" },
  "auth.namePlaceholder": { fr: "Votre nom", ar: "اسمك" },
  "auth.phonePlaceholder": { fr: "+213 05X XXX XXXX", ar: "+213 05X XXX XXXX" },
  "auth.orderNumber": { fr: "Numéro d'ordre professionnel", ar: "رقم الترخيص المهني" },
  "auth.orderPlaceholder": { fr: "Ex: PSY-12345", ar: "مثال: PSY-12345" },
  "auth.specialtyLabel": { fr: "Spécialité", ar: "التخصص" },
  "auth.chooseSpecialty": { fr: "Choisir une spécialité", ar: "اختر تخصصاً" },
  "auth.clinicalPsy": { fr: "Psychologie clinique", ar: "علم النفس السريري" },
  "auth.psychotherapy": { fr: "Psychothérapie", ar: "العلاج النفسي" },
  "auth.neuropsychology": { fr: "Neuropsychologie", ar: "علم النفس العصبي" },
  "auth.childPsy": { fr: "Psychologie de l'enfant", ar: "علم نفس الطفل" },
  "auth.couplePsy": { fr: "Psychologie de couple", ar: "علم نفس الأزواج" },
  "auth.psychiatry": { fr: "Psychiatrie", ar: "الطب النفسي" },
  "auth.other": { fr: "Autre", ar: "أخرى" },
  "auth.cityLabel": { fr: "Ville d'exercice", ar: "مدينة العمل" },
  "auth.cityPlaceholder": { fr: "Ex: Casablanca", ar: "مثال: الدار البيضاء" },
  "auth.minChars": { fr: "Minimum 6 caractères", ar: "6 أحرف على الأقل" },
  "auth.signupBtn": { fr: "S'inscrire", ar: "إنشاء حساب" },
  "auth.signingUp": { fr: "Inscription...", ar: "جاري الإنشاء..." },
  "auth.hasAccount": { fr: "Déjà un compte ?", ar: "لديك حساب بالفعل؟" },
  "auth.loginLink": { fr: "Se connecter", ar: "تسجيل الدخول" },
  "auth.phone": { fr: "Téléphone", ar: "الهاتف" },

  // Forgot password
  "forgot.title": { fr: "Mot de passe oublié", ar: "نسيت كلمة المرور" },
  "forgot.subtitle": { fr: "Entrez votre email pour réinitialiser votre mot de passe", ar: "أدخل بريدك الإلكتروني لإعادة تعيين كلمة المرور" },
  "forgot.send": { fr: "Envoyer le lien", ar: "إرسال الرابط" },
  "forgot.sending": { fr: "Envoi...", ar: "جاري الإرسال..." },
  "forgot.backToLogin": { fr: "Retour à la connexion", ar: "العودة لتسجيل الدخول" },
  "forgot.sentTitle": { fr: "Email envoyé", ar: "تم إرسال البريد" },
  "forgot.sentMsg": { fr: "Si un compte existe avec cet email, vous recevrez un lien pour réinitialiser votre mot de passe.", ar: "إذا كان هناك حساب بهذا البريد، ستتلقى رابطاً لإعادة تعيين كلمة المرور." },

  // Reset password
  "reset.title": { fr: "Nouveau mot de passe", ar: "كلمة مرور جديدة" },
  "reset.subtitle": { fr: "Choisissez un nouveau mot de passe pour votre compte", ar: "اختر كلمة مرور جديدة لحسابك" },
  "reset.newPassword": { fr: "Nouveau mot de passe", ar: "كلمة المرور الجديدة" },
  "reset.update": { fr: "Mettre à jour", ar: "تحديث" },
  "reset.updating": { fr: "Mise à jour...", ar: "جاري التحديث..." },
  "reset.loading": { fr: "Chargement...", ar: "جاري التحميل..." },
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "fr",
  setLang: () => {},
  t: (key) => key,
  dir: "ltr",
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem("majal-lang") as Lang) || "fr";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("majal-lang", l);
  };

  const t = (key: string): string => {
    return translations[key]?.[lang] || key;
  };

  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang, dir]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};
