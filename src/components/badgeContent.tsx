import { ReactElement } from "react";
import {
  FaCheck,
  FaClosedCaptioning,
  FaDownload,
  FaExclamationTriangle,
  FaHandPaper,
  FaShieldAlt,
  FaVolumeUp,
} from "./icons";

import { GameStatus } from "../api";
import { isBadgeableType } from "../lib/appType";
import { t } from "../lib/i18n";
import {
  CRIT,
  CRIT_INK,
  FLAG_GRADIENT,
  LANG_LOC_BG,
  LANG_LOC_INK,
  LOC_BORDER,
  LOC_INK,
  LOCU_BORDER,
  LOCU_INK,
  OK_GREEN,
  SCRIM,
  WARN,
  WARN_INK,
} from "../lib/badgeTokens";

export interface BadgeContent {
  label: string;
  icon: ReactElement;
  /** Trailing loc-type markers: CC (text) and/or speaker (audio). */
  typeIcons?: ReactElement[];
  background: string;
  color?: string;
  border?: string;
}

// back-compat re-exports (tests/modules pull the palette from here)
export { CRIT as RED, WARN as ORANGE, UA_BLUE, SCRIM as UA } from "../lib/badgeTokens";

// UA-flag accent chip for official-loc badges; em-sized to scale with the badge
function FlagSwatch(): ReactElement {
  return (
    <span
      aria-hidden="true"
      style={{
        width: "0.85em",
        height: "0.85em",
        borderRadius: "2px",
        flexShrink: 0,
        background: FLAG_GRADIENT,
        boxShadow: "0 0 0 1px rgba(0,0,0,.3)",
      }}
    />
  );
}

// Loc badge (brand, not threat): official → solid UA-blue border + flag;
// unofficial (needs a "українізатор") → dashed border + download icon.
// official === null (Steam-listed, no KULI record) counts as official.
export function localizationBadge(status: GameStatus, detailed: boolean): BadgeContent {
  const audio = status.loc === "audio";
  const lang = status.locLang ?? "uk";
  // type as icons: CC = text, speaker = voice; audio implies text so gets both
  const typeIcons = detailed
    ? audio
      ? [<FaClosedCaptioning key="t" />, <FaVolumeUp key="a" />]
      : [<FaClosedCaptioning key="t" />]
    : undefined;

  // non-uk target: green check + lang code, no flag
  if (lang !== "uk") {
    return {
      label: lang.toUpperCase(),
      icon: <FaCheck style={{ color: OK_GREEN }} />,
      typeIcons,
      background: LANG_LOC_BG,
      color: LANG_LOC_INK,
    };
  }

  // напівофіційна: official look, distinct label
  if (status.semiOfficial) {
    return { label: t("loc.semiPrefix"), icon: <FlagSwatch />, typeIcons, background: SCRIM, border: LOC_BORDER, color: LOC_INK };
  }
  // fan "українізатор": download icon + dashed border
  if (status.official === false) {
    return { label: t("loc.fanPrefix"), icon: <FaDownload />, typeIcons, background: SCRIM, border: LOCU_BORDER, color: LOCU_INK };
  }
  // official
  return { label: t("loc.uaPrefix"), icon: <FlagSwatch />, typeIcons, background: SCRIM, border: LOC_BORDER, color: LOC_INK };
}

// A russian game collapses to one critical badge, nothing else. Otherwise threat
// overlay first, loc below. Icon silhouette carries severity too: FaHandPaper =
// russian, FaExclamationTriangle = suspect/links, FaShieldAlt = vendor.
export function badgeContents(
  status: GameStatus,
  detailed: boolean,
  surfaceOn = true,
  showLoc = true
): BadgeContent[] {
  if (!status.found) return [];
  // skip non-game clutter (soundtracks, trailers, hardware, …)
  if (!isBadgeableType(status.appType)) return [];
  // the one mandatory badge — shows even when the surface is off
  if (status.threatLevel === "russian") {
    return [{ label: t("badge.russian"), icon: <FaHandPaper />, background: CRIT, color: CRIT_INK }];
  }
  // surface off → nothing else survives past the russian badge above
  if (!surfaceOn) return [];

  const badges: BadgeContent[] = [];

  // warning first (on top), loc below
  if (status.threatLevel === "suspect") {
    badges.push({
      label: detailed ? t("badge.suspect") : t("badge.suspect.short"),
      icon: <FaExclamationTriangle />,
      background: CRIT,
      color: CRIT_INK,
    });
  } else if (status.threatLevel === "vendor") {
    badges.push({
      label: detailed ? t("badge.vendor") : t("badge.vendor.short"),
      icon: <FaShieldAlt />,
      background: WARN,
      color: WARN_INK,
    });
  } else if (status.russianLinks?.length) {
    // russian social links → "questionable", warning tier (weaker than vendor majority)
    badges.push({
      label: detailed ? t("badge.suspect") : t("badge.suspect.short"),
      icon: <FaExclamationTriangle />,
      background: WARN,
      color: WARN_INK,
    });
  }

  if (showLoc) {
    if (status.loc === "audio" || status.loc === "text") {
      badges.push(localizationBadge(status, detailed));
    } else if (status.ukrainian) {
      badges.push({
        label: t("badge.ukGame"),
        icon: <FlagSwatch />,
        background: SCRIM,
        border: LOC_BORDER,
        color: LOC_INK,
      });
    }
  }

  return badges;
}
