import asyncio
import copy
import json
import os

import decky
import steam_langs
import steam_store
from prystanok import PrystanokClient
from store_injector import StoreInjector

SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")
CACHE_FILE = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "games_cache.json")

# per-surface badge config: enabled, size, position, offsetX, offsetY
DEFAULT_SETTINGS = {
    "detailedBadges": True,  # text vs audio, official vs unofficial
    "showLoc": True,  # master switch for the loc badge; threat still shows
    "showQuickAccess": True,
    "useSteamLoc": True,  # official loc from Steam's local appinfo cache
    "targetLang": "uk",  # which localization to highlight (locale code)
    "targetLangAuto": True,  # keep targetLang synced to Steam UI language
    "uiLang": "uk",  # plugin UI language (uk source / en), set by frontend
    "capsules": {"enabled": True, "size": 32, "position": "bottom-left", "offsetX": 4, "offsetY": 4},
    "appPage": {"enabled": True, "size": 28, "position": "top-center", "offsetX": 0, "offsetY": 8},
    "store": {"enabled": True, "size": 32, "position": "top-center", "offsetX": 0, "offsetY": 54},
}


def _enrich_loc(status, steam_loc, lang="uk"):
    """Fold Steam's official loc for ``lang`` into a Prystanok status, in place.

    uk == full mode: Steam owns official loc + audio, Prystanok owns unofficial
    українізатори. Any other language has no Prystanok data → loc from Steam only,
    Prystanok's UA loc suppressed. Threat verdict is language-independent, always kept.
    """
    appid = status.get("appid")
    sl = steam_loc.get(int(appid)) if appid is not None else None

    if lang != "uk":
        # non-uk: Steam-only loc, hide Prystanok's UA loc
        status["ukrainian"] = False
        status["semiOfficial"] = False
        if sl:
            status["loc"] = "audio" if sl["audio"] else "text"
            status["official"] = True
            status["locSource"] = "steam"
            status["locLang"] = lang
            status["found"] = True
        else:
            status["loc"] = "none"
            status["official"] = None
            status["locSource"] = None
            status["locLang"] = None
        return status

    had_loc = bool(status.get("found")) and status.get("loc") in ("audio", "text")
    if sl:
        audio = sl["audio"] or status.get("loc") == "audio"
        status["loc"] = "audio" if audio else "text"
        status["official"] = True
        status["semiOfficial"] = False  # Steam official beats a KULI semi-official tag
        status["ukrainian"] = True
        status["found"] = True
        status["locSource"] = "both" if had_loc else "steam"
    else:
        status["locSource"] = "prystanok" if (had_loc or status.get("ukrainian")) else None
    status["locLang"] = "uk"
    return status


def _migrate_settings(stored):
    """Seed the per-surface shape from the old flat keys (size/position/toggles)."""
    if not stored or any(k in stored for k in ("capsules", "appPage", "store")):
        return stored
    size = stored.get("iconSize", 32)
    pos = stored.get("iconPosition", "top-right")
    return {
        "detailedBadges": stored.get("detailedBadges", True),
        "showQuickAccess": stored.get("showQuickAccess", True),
        "capsules": {"enabled": stored.get("showLibraryGrid", True), "size": size, "position": pos, "offsetX": 4, "offsetY": 4},
        "appPage": {"enabled": stored.get("showAppPage", True), "size": size, "position": pos, "offsetX": 20, "offsetY": 20},
        "store": {"enabled": stored.get("showStore", True), "size": size, "position": "top-center", "offsetX": 0, "offsetY": 54},
    }


def _merge_settings(stored):
    """Deep-merge stored over defaults (one level into each badge group)."""
    merged = {}
    for key, default in DEFAULT_SETTINGS.items():
        val = stored.get(key, default)
        if isinstance(default, dict) and isinstance(val, dict):
            merged[key] = {**default, **val}
        else:
            merged[key] = val
    return merged


class Plugin:
    async def _main(self):
        self.client = PrystanokClient(CACHE_FILE, log=decky.logger)
        steam_store.init(os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "steam_store_loc.json"))
        self.settings = self._load_settings()
        # store injector reuses get_statuses/get_details so store overlays get the
        # same Steam-loc enrichment (official UA offline) as the gamepad UI
        self.store_injector = StoreInjector(
            self.get_statuses,
            details_provider=self.get_details,
            enabled=lambda: self.settings["store"].get("enabled", True),
            show_loc=lambda: self.settings.get("showLoc", True),  # gates loc chip; threat stays
            config_provider=lambda: self.settings["store"],
            lang_provider=lambda: self.settings.get("uiLang", "uk"),
            log=decky.logger,
        )
        self._store_task = asyncio.get_event_loop().create_task(self.store_injector.run())
        decky.logger.info("decky-prystanok loaded, cache: %s", CACHE_FILE)

    async def _unload(self):
        task = getattr(self, "_store_task", None)
        if task:
            task.cancel()
        decky.logger.info("decky-prystanok unloaded")

    async def _uninstall(self):
        self.client.clear_cache()

    # ---------- game data ----------

    async def get_statuses(self, appids: list[int]) -> dict:
        """Compact per-appid status for badges: threat/loc/official/kuliUrl."""
        statuses = await self.client.get_statuses(appids)
        if self.settings.get("useSteamLoc", True):
            lang = self.settings.get("targetLang", "uk")
            steam_loc = steam_langs.get_steam_loc([int(a) for a in appids], lang)
            for status in statuses.values():
                _enrich_loc(status, steam_loc, lang)
            # appdetails fallback for games in neither appinfo nor Prystanok (cold
            # store capsules); bounded per call so scrolling can't storm the API
            need = [
                int(a)
                for a in appids
                if int(a) not in steam_loc
                and statuses[str(a)].get("locSource") is None
                and not statuses[str(a)].get("found")
            ]
            if need:
                extra = await steam_store.fetch_locs(need, lang)
                for a in need:
                    _enrich_loc(statuses[str(a)], extra, lang)
        return statuses

    async def get_details(self, appid: int) -> dict:
        """Full payload for the Quick Access panel (vendors, curator reviews)."""
        details = await self.client.get_details(appid)
        if self.settings.get("useSteamLoc", True):
            lang = self.settings.get("targetLang", "uk")
            steam_loc = steam_langs.get_steam_loc([int(appid)], lang)
            _enrich_loc(details, steam_loc, lang)
            if (
                int(appid) not in steam_loc
                and details.get("locSource") is None
                and not details.get("found")
            ):
                _enrich_loc(details, await steam_store.fetch_locs([int(appid)], lang), lang)
        return details

    async def get_store_app(self) -> int | None:
        """AppID of a game open on a store app-page, or None. The store is a
        separate CEF tab the gamepad-UI React context can't see, so the QAM panel
        reads it from here."""
        injector = getattr(self, "store_injector", None)
        return getattr(injector, "current_store_app", None) if injector else None

    async def clear_cache(self) -> None:
        self.client.clear_cache()
        decky.logger.info("cache cleared")

    # ---------- settings ----------

    def _load_settings(self):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                stored = json.load(f)
        except FileNotFoundError:
            stored = {}
        except Exception as exc:
            decky.logger.warning("settings unreadable, using defaults: %s", exc)
            stored = {}
        merged = _merge_settings(_migrate_settings(stored))
        if "capsules" not in stored:  # came from old shape → persist migrated
            try:
                os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
                with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                    json.dump(merged, f, indent=2)
            except Exception as exc:
                decky.logger.warning("settings migration write failed: %s", exc)
        return merged

    async def get_settings(self) -> dict:
        return self.settings

    async def save_settings(self, settings: dict) -> dict:
        self.settings = _merge_settings({**self.settings, **settings})
        self._persist()
        return self.settings

    async def reset_settings(self) -> dict:
        self.settings = copy.deepcopy(DEFAULT_SETTINGS)
        self._persist()
        return self.settings

    def _persist(self):
        os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(self.settings, f, indent=2)
