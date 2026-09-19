// Major languages used in India — shared by the Autobiography translator,
// the AI Companion language setting, and browser voice input/output.
// `code` is a BCP-47 tag: it drives Web Speech recognition/synthesis and the
// AI "reply in this language" instruction.
export interface IndianLanguage {
  code: string; // BCP-47 tag, e.g. "hi-IN"
  label: string; // English name
  native: string; // endonym shown in the UI
}

export const INDIAN_LANGUAGES: IndianLanguage[] = [
  { code: "en-IN", label: "English", native: "English" },
  { code: "hi-IN", label: "Hindi", native: "हिन्दी" },
  { code: "bn-IN", label: "Bengali", native: "বাংলা" },
  { code: "mr-IN", label: "Marathi", native: "मराठी" },
  { code: "te-IN", label: "Telugu", native: "తెలుగు" },
  { code: "ta-IN", label: "Tamil", native: "தமிழ்" },
  { code: "gu-IN", label: "Gujarati", native: "ગુજરાતી" },
  { code: "kn-IN", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml-IN", label: "Malayalam", native: "മലയാളം" },
  { code: "pa-IN", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "or-IN", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "ur-IN", label: "Urdu", native: "اردو" },
];

export function findLanguage(code: string): IndianLanguage | undefined {
  return INDIAN_LANGUAGES.find((l) => l.code === code);
}
