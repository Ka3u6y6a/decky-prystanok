import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrystanokSettings } from "../src/api";

// settingsStore holds module-level cache/subscriber state, so each test
// re-imports it fresh after resetting modules and the api mock handlers.
async function freshStore(getSettingsImpl: () => any, saveSettingsImpl?: (p: any) => any) {
  vi.resetModules();
  const api: any = await import("@decky/api");
  api.__resetHandlers();
  api.__setHandler("get_settings", getSettingsImpl);
  api.__setHandler("save_settings", saveSettingsImpl ?? ((p: any) => p));
  const store = await import("../src/lib/settingsStore");
  return { store, api };
}

const FULL: PrystanokSettings = {
  detailedBadges: false,
  showQuickAccess: false,
  capsules: { enabled: false, size: 48, position: "bottom-left", offsetX: 4, offsetY: 4 },
  appPage: { enabled: true, size: 40, position: "top-center", offsetX: 0, offsetY: 80 },
  store: { enabled: false, size: 32, position: "top-right", offsetX: 12, offsetY: 40 },
};

const DEFAULTS_LIKE: PrystanokSettings = {
  detailedBadges: true,
  showQuickAccess: true,
  capsules: { enabled: true, size: 32, position: "top-right", offsetX: 4, offsetY: 4 },
  appPage: { enabled: true, size: 32, position: "top-right", offsetX: 20, offsetY: 96 },
  store: { enabled: true, size: 32, position: "top-center", offsetX: 0, offsetY: 54 },
};

describe("settingsStore", () => {
  let calls: number;
  beforeEach(() => {
    calls = 0;
  });

  it("getCachedSettings returns DEFAULT_SETTINGS before load", async () => {
    const { store } = await freshStore(() => FULL);
    expect(store.isLoaded()).toBe(false);
    expect(store.getCachedSettings()).toEqual(store.DEFAULT_SETTINGS);
  });

  it("loadSettings fetches once and caches", async () => {
    const { store } = await freshStore(() => {
      calls += 1;
      return FULL;
    });
    const a = await store.loadSettings();
    const b = await store.loadSettings();
    expect(a).toEqual(FULL);
    expect(b).toEqual(FULL);
    expect(calls).toBe(1);
    expect(store.isLoaded()).toBe(true);
    expect(store.getCachedSettings()).toEqual(FULL);
  });

  it("concurrent loadSettings coalesce into a single fetch", async () => {
    const { store } = await freshStore(async () => {
      calls += 1;
      await Promise.resolve();
      return FULL;
    });
    const [a, b] = await Promise.all([store.loadSettings(), store.loadSettings()]);
    expect(a).toEqual(FULL);
    expect(b).toEqual(FULL);
    expect(calls).toBe(1);
  });

  it("updateSettings persists, updates cache and notifies subscribers", async () => {
    const saved: any[] = [];
    const { store } = await freshStore(
      () => ({ ...DEFAULTS_LIKE }),
      (patch: any) => {
        saved.push(patch);
        return { ...DEFAULTS_LIKE, ...patch };
      }
    );

    const seen: PrystanokSettings[] = [];
    const unsub = store.subscribe((s) => seen.push(s));

    const patch = { store: { ...DEFAULTS_LIKE.store, enabled: false } };
    const next = await store.updateSettings(patch);
    expect(next.store.enabled).toBe(false);
    expect(store.getCachedSettings().store.enabled).toBe(false);
    expect(saved).toEqual([patch]);
    expect(seen.at(-1)?.store.enabled).toBe(false);

    unsub();
    await store.updateSettings({ store: { ...DEFAULTS_LIKE.store, enabled: true } });
    // unsubscribed listener should not receive the second update
    expect(seen.at(-1)?.store.enabled).toBe(false);
  });

  it("resetSettings applies defaults, updates cache and notifies", async () => {
    vi.resetModules();
    const api: any = await import("@decky/api");
    api.__resetHandlers();
    api.__setHandler("get_settings", () => FULL);
    api.__setHandler("reset_settings", () => DEFAULTS_LIKE);
    const store = await import("../src/lib/settingsStore");
    await store.loadSettings();
    const seen: PrystanokSettings[] = [];
    store.subscribe((s) => seen.push(s));
    const next = await store.resetSettings();
    expect(next).toEqual(DEFAULTS_LIKE);
    expect(store.getCachedSettings()).toEqual(DEFAULTS_LIKE);
    expect(seen.at(-1)).toEqual(DEFAULTS_LIKE);
  });

  it("loadSettings notifies existing subscribers", async () => {
    const { store } = await freshStore(() => FULL);
    const seen: PrystanokSettings[] = [];
    store.subscribe((s) => seen.push(s));
    await store.loadSettings();
    expect(seen.at(-1)).toEqual(FULL);
  });
});
