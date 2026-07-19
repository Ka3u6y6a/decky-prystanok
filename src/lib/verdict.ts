import type { GameDetails } from "../api";
import { t } from "./i18n";
import { riskyVendors } from "./vendorRisk";

export type VerdictTone = "clean" | "vendor" | "suspect" | "russian";

export interface Verdict {
  tone: VerdictTone;
  title: string;
  sub?: string;
}

export function hasThreat(d: GameDetails): boolean {
  return (
    d.threatLevel === "russian" ||
    d.threatLevel === "suspect" ||
    d.threatLevel === "vendor" ||
    (d.russianLinks?.length ?? 0) > 0
  );
}

/** One-line verdict for the modal banner: tone + title + short reason. */
export function verdict(d: GameDetails): Verdict {
  const localized = d.loc === "text" || d.loc === "audio" || !!d.ukrainian;

  if (d.threatLevel === "russian") {
    const sub = t("verdict.russian.sub") + (localized ? t("verdict.russian.uaSuffix") : "");
    return { tone: "russian", title: t("verdict.russian.title"), sub };
  }
  if (d.threatLevel === "suspect") {
    const top = riskyVendors(d.vendors)[0];
    return {
      tone: "suspect",
      title: t("verdict.suspect.title"),
      sub: top ? t("verdict.suspect.sub", { name: top.name }) : t("verdict.suspect.subFallback"),
    };
  }
  if (d.threatLevel === "vendor") {
    return { tone: "vendor", title: t("verdict.vendor.title"), sub: t("verdict.vendor.sub") };
  }
  if ((d.russianLinks?.length ?? 0) > 0) {
    return { tone: "vendor", title: t("verdict.suspect.title"), sub: t("verdict.links.sub") };
  }
  return {
    tone: "clean",
    title: t("verdict.clean.title"),
    sub: d.developers?.length ? d.developers.join(", ") : undefined,
  };
}
