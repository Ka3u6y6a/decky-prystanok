import { useEffect, useState } from "react";

import { PrystanokSettings } from "../api";
import {
  getCachedSettings,
  isLoaded,
  loadSettings,
  subscribe,
  updateSettings,
} from "../lib/settingsStore";

export function useSettings() {
  const [settings, setSettings] = useState<PrystanokSettings>(getCachedSettings());
  const [loading, setLoading] = useState(!isLoaded());

  useEffect(() => {
    const unsubscribe = subscribe(setSettings);
    if (!isLoaded()) {
      loadSettings()
        .catch((e) => console.error("[decky-prystanok] getSettings failed", e))
        .finally(() => setLoading(false));
    }
    return unsubscribe;
  }, []);

  return { settings, loading, update: updateSettings };
}
