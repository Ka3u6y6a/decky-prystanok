// Target-language options + Steam UI language detection.
// Codes mirror LANG_KEYS in py_modules/steam_langs.py.

export interface LangOption {
  code: string;
  label: string;
}

// Steam's full UI-language set (regional variants kept separate). Russian is
// omitted on purpose — highlighting a russian loc defeats the point.
export const LANGS: LangOption[] = [
  { code: "uk", label: "Українська" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español (Spain)" },
  { code: "es-419", label: "Español (LatAm)" },
  { code: "pt", label: "Português (PT)" },
  { code: "pt-br", label: "Português (BR)" },
  { code: "pl", label: "Polski" },
  { code: "cs", label: "Čeština" },
  { code: "nl", label: "Nederlands" },
  { code: "da", label: "Dansk" },
  { code: "fi", label: "Suomi" },
  { code: "no", label: "Norsk" },
  { code: "sv", label: "Svenska" },
  { code: "tr", label: "Türkçe" },
  { code: "hu", label: "Magyar" },
  { code: "ro", label: "Română" },
  { code: "bg", label: "Български" },
  { code: "el", label: "Ελληνικά" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "简体中文" },
  { code: "zh-tw", label: "繁體中文" },
  { code: "th", label: "ไทย" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "id", label: "Bahasa Indonesia" },
];

const SUPPORTED = new Set(LANGS.map((l) => l.code));

/** Steam UI language as a supported code, uk fallback. Tries full locale
 * (pt-br, zh-tw) before the base (pt, zh). */
export function detectSteamLang(): string {
  try {
    const lm = (window as any).LocalizationManager;
    const raw = String(lm?.m_rgLocalesToUse?.[0] ?? navigator.language ?? "").toLowerCase();
    if (SUPPORTED.has(raw)) return raw;
    const base = raw.split("-")[0];
    return SUPPORTED.has(base) ? base : "uk";
  } catch {
    return "uk";
  }
}
