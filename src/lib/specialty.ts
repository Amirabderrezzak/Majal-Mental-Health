// The signup form stores a specialty *code* (e.g. "psychotherapie"); therapists can
// later replace it with free text. Show the translated label for a known code and
// the text as-is otherwise, so patients never see "psychotherapie" / "psychologie-enfant".
const KEYS: Record<string, string> = {
  "psychologie-clinique": "auth.clinicalPsy",
  psychotherapie: "auth.psychotherapy",
  neuropsychologie: "auth.neuropsychology",
  "psychologie-enfant": "auth.childPsy",
  "psychologie-couple": "auth.couplePsy",
  psychiatrie: "auth.psychiatry",
  autre: "auth.other",
};

export function specialtyLabel(value: string | null | undefined, t: (key: string) => string, fallback = ""): string {
  if (!value) return fallback;
  const key = KEYS[value.trim().toLowerCase()];
  return key ? t(key) : value;
}
