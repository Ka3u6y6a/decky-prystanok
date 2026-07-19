import { callable } from "@decky/api";

export type LocLevel = "audio" | "text" | "none";
export type BadgePosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type ThreatLevel = "russian" | "suspect" | "vendor" | null;

export interface GameStatus {
  appid: number;
  found: boolean;
  name?: string | null;
  // russian = рос. гра; suspect = видавець-мажоритарій рос. ігор; vendor = причетний у меншості
  threatLevel?: ThreatLevel;
  threatReasons?: string[];
  vendorReasons?: string[];
  russianLinks?: string[]; // VK тощо
  loc?: LocLevel;
  official?: boolean | null;
  semiOfficial?: boolean; // KULI SemiOfficial — між official і fan
  ukrainian?: boolean;
  appType?: string | null; // Game/Demo/DLC/Music/… — не-ігрові типи не бейджимо
  // steam appinfo (офіційна, офлайн) / Prystanok (укр-затори) / both / none
  locSource?: "steam" | "prystanok" | "both" | null;
  locLang?: string | null;
  kuliUrl?: string | null;
  bloodyPrice?: string | null;
}

export interface VendorInfo {
  Name: string;
  TotalGamesPublished: number;
  TotalGamesDeveloped: number;
  UkrainianGamesPublished: number;
  UkrainianGamesDeveloped: number;
  RussianGamesPublished: number;
  RussianGamesDeveloped: number;
}

export interface CuratorReview {
  AppId: number;
  CuratorId: number;
  CuratorName: string;
  ReviewType: "Recommended" | "NotRecommended" | "Informational";
  Review: string;
}

export interface GameDetails extends GameStatus {
  vendors?: VendorInfo[];
  publishers?: string[];
  developers?: string[];
  curatorReviews?: CuratorReview[];
  iconUrl?: string | null;
}

/** Per-surface badge appearance. */
export interface BadgeConfig {
  enabled: boolean;
  size: number; // baseline px, scale = size / 32
  position: BadgePosition;
  offsetX: number; // px from the chosen left/right edge
  offsetY: number; // px from the chosen top/bottom edge
}

export interface PrystanokSettings {
  detailedBadges: boolean;
  showLoc: boolean; // loc badge master switch (threat still shows)
  showQuickAccess: boolean;
  useSteamLoc: boolean; // pull official loc from Steam appinfo cache (always on)
  targetLang: string; // locale to search/highlight
  targetLangAuto: boolean; // keep targetLang == Steam UI lang
  uiLang: string; // plugin UI language (uk/en)
  capsules: BadgeConfig; // library grid + home cards/featured
  appPage: BadgeConfig; // game library page
  store: BadgeConfig; // store.steampowered.com page
}

export const getStatuses = callable<[appids: number[]], Record<string, GameStatus>>("get_statuses");
export const getStoreApp = callable<[], number | null>("get_store_app");
export const getDetails = callable<[appid: number], GameDetails>("get_details");
export const getSettings = callable<[], PrystanokSettings>("get_settings");
export const saveSettings = callable<[settings: Partial<PrystanokSettings>], PrystanokSettings>("save_settings");
export const resetSettings = callable<[], PrystanokSettings>("reset_settings");
export const clearCache = callable<[], void>("clear_cache");
