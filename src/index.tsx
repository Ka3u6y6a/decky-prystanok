import { definePlugin, routerHook } from "@decky/api";
import { staticClasses } from "@decky/ui";
import { FaShieldAlt } from "./components/icons";

import { PrystanokSettings } from "./api";
import QuickAccessContent from "./components/QuickAccessContent";
import { resetGridBadges, startGridObserver, stopGridObserver } from "./lib/gridObserver";
import { uiLang } from "./lib/i18n";
import patchLibraryApp from "./lib/patchLibraryApp";
import { loadSettings, subscribe, updateSettings } from "./lib/settingsStore";
import { detectSteamLang } from "./lib/steamLang";

export default definePlugin(() => {
  const libraryAppPatch = patchLibraryApp();

  // re-render grid badges on position/size/visibility changes
  const unsubscribe = subscribe(() => resetGridBadges());
  loadSettings()
    .then((s) => {
      // persist UI lang; default targetLang to Steam UI lang until user pins one
      const patch: Partial<PrystanokSettings> = {};
      const ui = uiLang();
      if (ui !== s.uiLang) patch.uiLang = ui;
      if (s.targetLangAuto) {
        const detected = detectSteamLang();
        if (detected !== s.targetLang) patch.targetLang = detected;
      }
      return Object.keys(patch).length ? updateSettings(patch) : undefined;
    })
    .catch((e) => console.error("[decky-prystanok] settings load failed", e))
    .finally(() => startGridObserver());

  return {
    name: "Prystanok",
    titleView: <div className={staticClasses.Title}>Prystanok</div>,
    content: <QuickAccessContent />,
    icon: <FaShieldAlt />,
    onDismount() {
      unsubscribe();
      stopGridObserver();
      routerHook.removePatch("/library/app/:appid", libraryAppPatch);
    },
  };
});
