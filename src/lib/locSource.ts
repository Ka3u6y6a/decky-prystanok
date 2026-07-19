import type { GameDetails } from "../api";
import { t } from "./i18n";

/** Loc provenance label (Steam vs Prystanok) for the modal. null when there's nothing to attribute. */
export function locSourceLabel(d: GameDetails): string | null {
  if (d.loc === "none" && !d.ukrainian) return null;
  const unofficial = d.official === false;
  switch (d.locSource) {
    case "steam":
      return t("locsrc.steam");
    case "both":
      return t("locsrc.both");
    case "prystanok":
      if (d.semiOfficial) return t("locsrc.semi");
      return unofficial ? t("locsrc.fan") : t("locsrc.official");
    default:
      return null;
  }
}
