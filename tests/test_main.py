"""Tests for main.py Plugin settings logic.

main.py does `import decky` and computes settings/cache paths at import time,
so we inject a fake `decky` module (pointed at a temp dir) before importing it.
Runnable with: python3 -m unittest discover -s tests
"""

import asyncio
import json
import logging
import os
import sys
import tempfile
import types
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "py_modules"))

# ---- fake decky module, installed before importing main ----
_DECKY_DIR = tempfile.mkdtemp()
_fake_decky = types.ModuleType("decky")
_fake_decky.DECKY_PLUGIN_SETTINGS_DIR = _DECKY_DIR
_fake_decky.DECKY_PLUGIN_RUNTIME_DIR = _DECKY_DIR
_fake_decky.logger = logging.getLogger("test-decky")
sys.modules["decky"] = _fake_decky

import main  # noqa: E402
from main import DEFAULT_SETTINGS, Plugin  # noqa: E402


class TestSettings(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # isolate each test on its own settings file
        self.tmp = tempfile.mkdtemp()
        self.settings_file = os.path.join(self.tmp, "settings.json")
        main.SETTINGS_FILE = self.settings_file
        main.CACHE_FILE = os.path.join(self.tmp, "cache.json")
        _fake_decky.DECKY_PLUGIN_SETTINGS_DIR = self.tmp

    def _plugin(self):
        p = Plugin()
        p.settings = p._load_settings()
        return p

    def test_defaults_when_no_file(self):
        p = self._plugin()
        self.assertEqual(p.settings, DEFAULT_SETTINGS)

    def test_partial_group_merges_with_defaults(self):
        with open(self.settings_file, "w") as f:
            json.dump({"capsules": {"size": 48}}, f)
        p = self._plugin()
        self.assertEqual(p.settings["capsules"]["size"], 48)
        self.assertTrue(p.settings["capsules"]["enabled"])  # group default preserved
        self.assertEqual(p.settings["appPage"], DEFAULT_SETTINGS["appPage"])  # other groups intact

    def test_migrates_old_flat_settings(self):
        with open(self.settings_file, "w") as f:
            json.dump({"iconSize": 48, "iconPosition": "bottom-left", "showStore": False}, f)
        p = self._plugin()
        self.assertEqual(p.settings["capsules"]["size"], 48)
        self.assertEqual(p.settings["capsules"]["position"], "bottom-left")
        self.assertEqual(p.settings["appPage"]["size"], 48)
        self.assertFalse(p.settings["store"]["enabled"])
        self.assertNotIn("iconSize", p.settings)  # old flat keys dropped

    def test_corrupt_file_falls_back_to_defaults(self):
        with open(self.settings_file, "w") as f:
            f.write("{broken")
        p = self._plugin()
        self.assertEqual(p.settings, DEFAULT_SETTINGS)

    async def test_save_settings_persists_and_merges(self):
        p = self._plugin()
        returned = await p.save_settings(
            {"appPage": {"enabled": True, "size": 24, "position": "bottom-left", "offsetX": 8, "offsetY": 8}}
        )
        self.assertEqual(returned["appPage"]["position"], "bottom-left")
        self.assertEqual(returned["appPage"]["size"], 24)
        self.assertTrue(returned["detailedBadges"])  # default kept
        with open(self.settings_file) as f:
            on_disk = json.load(f)
        self.assertEqual(on_disk["appPage"]["position"], "bottom-left")

    async def test_save_settings_accumulates(self):
        p = self._plugin()
        await p.save_settings({"capsules": {**DEFAULT_SETTINGS["capsules"], "size": 16}})
        await p.save_settings({"detailedBadges": False})
        s = await p.get_settings()
        self.assertEqual(s["capsules"]["size"], 16)  # earlier change retained
        self.assertFalse(s["detailedBadges"])

    async def test_reset_settings(self):
        p = self._plugin()
        await p.save_settings({"detailedBadges": False, "capsules": {**DEFAULT_SETTINGS["capsules"], "size": 16}})
        returned = await p.reset_settings()
        self.assertEqual(returned, DEFAULT_SETTINGS)
        self.assertEqual(await p.get_settings(), DEFAULT_SETTINGS)
        with open(self.settings_file) as f:
            self.assertEqual(json.load(f), DEFAULT_SETTINGS)

    async def test_get_settings_returns_current(self):
        p = self._plugin()
        s = await p.get_settings()
        self.assertEqual(s, DEFAULT_SETTINGS)


class TestLifecycle(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        main.SETTINGS_FILE = os.path.join(self.tmp, "settings.json")
        main.CACHE_FILE = os.path.join(self.tmp, "cache.json")
        _fake_decky.DECKY_PLUGIN_SETTINGS_DIR = self.tmp

    async def test_main_initializes_client_and_settings(self):
        p = Plugin()
        await p._main()
        self.assertIsNotNone(p.client)
        self.assertEqual(p.settings, DEFAULT_SETTINGS)

    async def test_uninstall_clears_cache(self):
        p = Plugin()
        await p._main()
        # seed a cache file, then ensure uninstall removes it
        with open(main.CACHE_FILE, "w") as f:
            f.write("{}")
        p.client.cache_path = main.CACHE_FILE
        await p._uninstall()
        self.assertFalse(os.path.exists(main.CACHE_FILE))

    async def test_clear_cache_method(self):
        p = Plugin()
        await p._main()
        await p.clear_cache()
        self.assertEqual(p.client._cache, {})

    async def test_store_injector_uses_enriching_providers(self):
        # store overlays must go through Plugin.get_statuses (Steam-loc merge),
        # not the raw client, so the store gets official UA too
        p = Plugin()
        await p._main()
        self.assertEqual(p.store_injector.status_provider, p.get_statuses)
        self.assertEqual(p.store_injector.details_provider, p.get_details)


class TestSteamLocMerge(unittest.IsolatedAsyncioTestCase):
    def test_steam_only_game_gets_official_badge(self):
        # not in Prystanok, but Steam declares official UA text
        s = {"appid": 570, "found": False}
        main._enrich_loc(s, {570: {"official": True, "text": True, "audio": False, "subtitles": False}})
        self.assertTrue(s["found"])
        self.assertTrue(s["official"])
        self.assertTrue(s["ukrainian"])
        self.assertEqual(s["loc"], "text")
        self.assertEqual(s["locSource"], "steam")

    def test_steam_audio_upgrades_loc(self):
        s = {"appid": 1, "found": True, "loc": "text", "official": True}
        main._enrich_loc(s, {1: {"official": True, "text": True, "audio": True, "subtitles": True}})
        self.assertEqual(s["loc"], "audio")
        self.assertEqual(s["locSource"], "both")

    def test_prystanok_audio_kept_when_steam_text_only(self):
        s = {"appid": 1, "found": True, "loc": "audio", "official": True}
        main._enrich_loc(s, {1: {"official": True, "text": True, "audio": False, "subtitles": False}})
        self.assertEqual(s["loc"], "audio")  # don't downgrade
        self.assertEqual(s["locSource"], "both")

    def test_no_steam_keeps_prystanok_unofficial(self):
        s = {"appid": 1, "found": True, "loc": "text", "official": False}
        main._enrich_loc(s, {})
        self.assertEqual(s["loc"], "text")
        self.assertFalse(s["official"])
        self.assertEqual(s["locSource"], "prystanok")

    def test_no_signal_source_none(self):
        s = {"appid": 9, "found": False}
        main._enrich_loc(s, {})
        self.assertIsNone(s["locSource"])

    def test_non_uk_uses_steam_only(self):
        s = {"appid": 1, "found": True, "loc": "text", "official": True, "ukrainian": True}
        main._enrich_loc(s, {1: {"official": True, "text": True, "audio": False, "subtitles": False}}, "pl")
        self.assertEqual(s["loc"], "text")
        self.assertEqual(s["locSource"], "steam")
        self.assertEqual(s["locLang"], "pl")
        self.assertFalse(s["ukrainian"])  # UA flag off for a non-UA target

    def test_non_uk_suppresses_prystanok_loc_keeps_threat(self):
        # Prystanok reports UA loc + a vendor threat; target is Polish, no PL in Steam
        s = {"appid": 1, "found": True, "loc": "text", "official": True,
             "ukrainian": True, "threatLevel": "vendor"}
        main._enrich_loc(s, {}, "pl")
        self.assertEqual(s["loc"], "none")  # UA loc hidden for PL target
        self.assertIsNone(s["locSource"])
        self.assertFalse(s["ukrainian"])
        self.assertEqual(s["threatLevel"], "vendor")  # threat is language-independent

    def _stub_appdetails(self, mapping):
        """Replace steam_store.fetch_locs with an async stub; returns a restore fn."""
        orig = main.steam_store.fetch_locs

        async def stub(appids, lang="uk", cap=10):
            return {int(a): mapping[int(a)] for a in appids if int(a) in mapping}

        main.steam_store.fetch_locs = stub
        return lambda: setattr(main.steam_store, "fetch_locs", orig)

    async def test_get_statuses_enriches_when_enabled(self):
        p = Plugin()
        p.settings = dict(DEFAULT_SETTINGS)

        async def fake_statuses(appids):
            return {str(a): {"appid": a, "found": False} for a in appids}

        p.client = types.SimpleNamespace(get_statuses=fake_statuses)
        orig = main.steam_langs.get_steam_loc
        main.steam_langs.get_steam_loc = lambda ids, lang="uk": {570: {"official": True, "text": True, "audio": False, "subtitles": False}}
        restore = self._stub_appdetails({})  # no appdetails hits
        try:
            out = await p.get_statuses([570, 730])
        finally:
            main.steam_langs.get_steam_loc = orig
            restore()
        self.assertEqual(out["570"]["locSource"], "steam")
        self.assertTrue(out["570"]["found"])
        self.assertIsNone(out["730"]["locSource"])  # no steam, not found, appdetails empty

    async def test_appdetails_fallback_fills_cold_game(self):
        p = Plugin()
        p.settings = dict(DEFAULT_SETTINGS)

        async def fake_statuses(appids):
            return {str(a): {"appid": a, "found": False} for a in appids}

        p.client = types.SimpleNamespace(get_statuses=fake_statuses)
        orig = main.steam_langs.get_steam_loc
        main.steam_langs.get_steam_loc = lambda ids, lang="uk": {}  # not in appinfo
        restore = self._stub_appdetails({999: {"official": True, "text": True, "audio": True, "subtitles": False}})
        try:
            out = await p.get_statuses([999])
        finally:
            main.steam_langs.get_steam_loc = orig
            restore()
        self.assertTrue(out["999"]["found"])
        self.assertEqual(out["999"]["loc"], "audio")
        self.assertEqual(out["999"]["locSource"], "steam")

    async def test_get_statuses_skips_when_disabled(self):
        p = Plugin()
        p.settings = {**DEFAULT_SETTINGS, "useSteamLoc": False}

        async def fake_statuses(appids):
            return {str(a): {"appid": a, "found": False} for a in appids}

        p.client = types.SimpleNamespace(get_statuses=fake_statuses)
        called = {"n": 0}
        orig = main.steam_langs.get_steam_loc

        def spy(ids, lang="uk"):
            called["n"] += 1
            return {}

        main.steam_langs.get_steam_loc = spy
        try:
            out = await p.get_statuses([570])
        finally:
            main.steam_langs.get_steam_loc = orig
        self.assertEqual(called["n"], 0)  # not consulted when disabled
        self.assertNotIn("locSource", out["570"])


if __name__ == "__main__":
    unittest.main()
