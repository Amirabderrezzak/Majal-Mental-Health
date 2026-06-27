export const CATEGORIES = [
  {
    id: "individual",
    label: { fr: "Pour moi", ar: "لي" },
    icon: "🧑",
    subcategories: [
      { id: "stress-anxiety", label: { fr: "Stress & anxiété", ar: "التوتر والقلق" } },
      { id: "depression-malbeing", label: { fr: "Dépression & mal-être", ar: "الاكتئاب وسوء الحالة النفسية" } },
      { id: "selfesteem-development", label: { fr: "Confiance en soi & développement personnel", ar: "الثقة بالنفس والتطور الشخصي" } },
      { id: "relationships", label: { fr: "Relations & problèmes affectifs", ar: "العلاقات ومشاكل المشاعر" } },
      { id: "trauma-emotional", label: { fr: "Traumatisme & difficultés émotionnelles", ar: "الصدمات والصعوبات العاطفية" } },
      { id: "addiction-behavior", label: { fr: "Addiction & comportements difficiles", ar: "الإدمان والسلوك الصعب" } },
    ],
  },
  {
    id: "child",
    label: { fr: "Pour mon enfant", ar: "طفلي" },
    icon: "👶",
    subcategories: [
      { id: "school-difficulties", label: { fr: "Difficultés scolaires & concentration", ar: "الصعوبات الدراسية والتركيز" } },
      { id: "behavior-emotions", label: { fr: "Comportement & émotions", ar: "السلوك والمشاعر" } },
      { id: "adolescence-selfesteem", label: { fr: "Adolescence & confiance en soi", ar: "المراهقة والثقة بالنفس" } },
      { id: "bullying-social", label: { fr: "Harcèlement & difficultés sociales", ar: "التنمر والصعوبات الاجتماعية" } },
      { id: "parental-guidance", label: { fr: "Accompagnement parental", ar: "الإرشاد الأسري" } },
    ],
  },
  {
    id: "couple",
    label: { fr: "Séance couple", ar: "جلسة זוגית" },
    icon: "💑",
    subcategories: [
      { id: "communication-conflicts", label: { fr: "Communication & conflits", ar: "التواصل والنزاعات" } },
      { id: "infidelity-jealousy", label: { fr: "Infidélité & jalousie", ar: "الخيانة والغيرة" } },
      { id: "relationship-crises", label: { fr: "Crises relationnelles", ar: "الأزمات العاطفية" } },
      { id: "marriage-prep", label: { fr: "Préparation au mariage & vie conjugale", ar: "الاستعداد للزواج والحياة الزوجية" } },
      { id: "separation-reconstruction", label: { fr: "Séparation & reconstruction du couple", ar: "الفصل وإعادة بناء العلاقة" } },
      { id: "sexual-issues", label: { fr: "Problèmes sexuels", ar: "المشاكل الجنسية" } },
    ],
  },
] as const;

export type CategoryId = typeof CATEGORIES[number]["id"];
export type SubcategoryId = string;
