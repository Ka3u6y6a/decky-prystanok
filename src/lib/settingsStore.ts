import { getSettings, PrystanokSettings, resetSettings as apiReset, saveSettings } from "../api";

export const DEFAULT_SETTINGS: PrystanokSettings = {
  detailedBadges: true,
  showLoc: true,
  showQuickAccess: true,
  useSteamLoc: true,
  targetLang: "uk",
  targetLangAuto: true,
  uiLang: "uk",
  capsules: { enabled: true, size: 32, position: "bottom-left", offsetX: 4, offsetY: 4 },
  appPage: { enabled: true, size: 28, position: "top-center", offsetX: 0, offsetY: 8 },
  store: { enabled: true, size: 32, position: "top-center", offsetX: 0, offsetY: 54 },
};

let cached: PrystanokSettings | null = null;
let inflight: Promise<PrystanokSettings> | null = null;
const subscribers = new Set<(s: PrystanokSettings) => void>();

export function getCachedSettings(): PrystanokSettings {
  return cached ?? DEFAULT_SETTINGS;
}

export function isLoaded(): boolean {
  return cached !== null;
}

export async function loadSettings(): Promise<PrystanokSettings> {
  if (cached) return cached;
  if (!inflight) {
    inflight = getSettings()
      .then((s) => {
        cached = s;
        subscribers.forEach((fn) => fn(s));
        return s;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function updateSettings(
  patch: Partial<PrystanokSettings>
): Promise<PrystanokSettings> {
  const next = await saveSettings(patch);
  cached = next;
  subscribers.forEach((fn) => fn(next));
  return next;
}

export async function resetSettings(): Promise<PrystanokSettings> {
  const next = await apiReset();
  cached = next;
  subscribers.forEach((fn) => fn(next));
  return next;
}

export function subscribe(fn: (s: PrystanokSettings) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
