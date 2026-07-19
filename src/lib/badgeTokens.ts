// Badge colours. Mirrored by value in py_modules/store_injector.py; see BADGE_DESIGN.md.

// Threat ramp.
export const CRIT = "#e5484d"; // російська / сумнівна
export const CRIT_INK = "#3a0a0b"; // text on CRIT
export const WARN = "#f5a623"; // видавець / рос. лінки
export const WARN_INK = "#3a2600"; // text on WARN

// Ukrainian loc brand.
export const UA_BLUE = "#1d61c4";
export const UA_YELLOW = "#ffd23f";
export const FLAG_GRADIENT = `linear-gradient(${UA_BLUE} 50%, ${UA_YELLOW} 50%)`;

// Loc pill: dark scrim + flag accent, readable over any art.
export const SCRIM = "rgba(12,15,20,.62)";
export const LOC_INK = "#eaf2ff"; // official
export const LOCU_INK = "#bcd6ff"; // unofficial (українізатор)
export const LOC_BORDER = `1px solid ${UA_BLUE}`; // official
export const LOCU_BORDER = "1px dashed #4f86d6"; // unofficial

// Non-UA target language (Steam official loc only) — plain info blue, kept
// distinct from the flag identity.
export const LANG_LOC_BG = "#2d6cdf";
export const LANG_LOC_INK = "#eaf2ff";
// "your language is present" check for the non-UA case, green over the info-blue pill.
export const OK_GREEN = "#4ade80";

// Over-art contrast on every badge.
export const BADGE_BORDER = "1px solid rgba(0,0,0,.35)"; // default (threats)
export const BADGE_SHADOW = "0 1px 5px rgba(0,0,0,.45)";
