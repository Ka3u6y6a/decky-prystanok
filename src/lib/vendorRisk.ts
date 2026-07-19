import { VendorInfo } from "../api";
import { t } from "./i18n";

export interface VendorRisk {
  name: string;
  rus: number;
  total: number;
  share: number; // 0..1
  majority: boolean; // >50% — drives the "suspect" level
}

/** Vendors touching any russian games, highest share first. Share, not raw
 * counts, so a 5% minority reads differently from a 63% one (as Prystanok shows it). */
export function riskyVendors(vendors: VendorInfo[] = []): VendorRisk[] {
  return vendors
    .map((v) => {
      const rus = (v.RussianGamesPublished || 0) + (v.RussianGamesDeveloped || 0);
      const total = (v.TotalGamesPublished || 0) + (v.TotalGamesDeveloped || 0);
      const share = total ? rus / total : rus > 0 ? 1 : 0;
      return { name: v.Name, rus, total, share, majority: share > 0.5 };
    })
    .filter((v) => v.rus > 0)
    .sort((a, b) => b.share - a.share);
}

export function formatVendorRisk(v: VendorRisk): string {
  return t("vendor.risk", { rus: v.rus, total: v.total, pct: Math.round(v.share * 100) });
}
