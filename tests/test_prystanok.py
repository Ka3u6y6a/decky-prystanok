"""Tests for py_modules/prystanok.py — runnable with stdlib unittest:

    python3 -m unittest discover -s tests

(also works under pytest if installed). No network: HTTP is stubbed.
"""

import asyncio
import json
import os
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "py_modules"))

import prystanok  # noqa: E402
from prystanok import PrystanokClient, _split_flags, details, normalize  # noqa: E402


# ---------- fixtures ----------

UA_OFFICIAL_AUDIO = {  # S.T.A.L.K.E.R.-like: Ukrainian, official, audio
    "KuliGame": {
        "Name": "Game UA",
        "Url": "https://kuli.com.ua/game-ua",
        "Origin": "Ukrainian",
        "Localization": "Official, Text, Audio",
    },
    "SteamGame": {
        "Name": "Game UA",
        "Localization": "Text, Audio, Subtitles",
        "IconUrl": "https://icon/ua.jpg",
        "Metadata": {"Publishers": ["Pub UA"], "Developers": ["Dev UA"]},
        "Vendors": [
            {
                "Name": "Dev UA",
                "TotalGamesPublished": 7,
                "TotalGamesDeveloped": 16,
                "UkrainianGamesPublished": 7,
                "UkrainianGamesDeveloped": 16,
                "RussianGamesPublished": 0,
                "RussianGamesDeveloped": 0,
            }
        ],
    },
    "CuratorReviews": [
        {
            "AppId": 1,
            "CuratorId": 43011665,
            "CuratorName": "Українські ігри",
            "ReviewType": "Informational",
            "Review": "Це УКРАЇНСЬКА гра.",
        }
    ],
}

RUS_PUBLISHER_GAME = {  # Collapse-like: ukrainian dev, russian publisher (86/90)
    "SteamGame": {
        "Name": "Collapse",
        "Localization": "None",
        "Metadata": {"Publishers": ["ESDigital Games"], "Developers": ["Creoteam"]},
        "Vendors": [
            {
                "Name": "ESDigital Games",
                "TotalGamesPublished": 89,
                "TotalGamesDeveloped": 1,
                "RussianGamesPublished": 85,
                "RussianGamesDeveloped": 1,
            },
            {
                "Name": "Creoteam",
                "TotalGamesPublished": 2,
                "TotalGamesDeveloped": 3,
                "RussianGamesPublished": 0,
                "RussianGamesDeveloped": 1,
            },
        ],
    },
    "SteamBloodyGame": {"AppId": 289620, "PriceFormatted": "299 руб."},
}

RUS_DEVELOPER_GAME = {  # Prince Jerian-like: russian studio (dev 3/3), russian publisher
    "SteamGame": {
        "Name": "Prince Jerian",
        "Localization": "None",
        "Metadata": {"Publishers": ["101XP"], "Developers": ["Schisma Games"]},
        "Vendors": [
            {
                "Name": "Schisma Games",
                "TotalGamesPublished": 0,
                "TotalGamesDeveloped": 3,
                "RussianGamesPublished": 0,
                "RussianGamesDeveloped": 3,
            },
            {
                "Name": "101XP",
                "TotalGamesPublished": 30,
                "TotalGamesDeveloped": 0,
                "RussianGamesPublished": 20,
                "RussianGamesDeveloped": 0,
            },
        ],
    },
}

MINORITY_VENDOR_GAME = {  # Against the Storm-like: UA text, publisher 4/50
    "KuliGame": {"Name": "Against the Storm", "Origin": "Unknown", "Localization": "Text"},
    "SteamGame": {
        "Name": "Against the Storm",
        "Localization": "Text, Subtitles",
        "Vendors": [
            {
                "Name": "Hooded Horse",
                "TotalGamesPublished": 50,
                "TotalGamesDeveloped": 0,
                "RussianGamesPublished": 4,
                "RussianGamesDeveloped": 0,
            }
        ],
    },
}


def make_http(mapping=None, script=None):
    """Build an async _http_get replacement.

    mapping: appid(int) -> raw model (None/absent => omitted from payload).
    script:  list of (status, body) | Exception, returned in order per call.
    The returned callable records every URL it was asked for.
    """
    calls = []

    async def http_get(url):
        calls.append(url)
        if script is not None:
            item = script[min(len(calls) - 1, len(script) - 1)]
            if isinstance(item, Exception):
                raise item
            return item
        # parse appids out of the query string
        qs = url.split("appids=", 1)[1]
        appids = [int(a) for a in qs.split("%2C" if "%2C" in qs else ",")]
        payload = {}
        for a in appids:
            if mapping and a in mapping and mapping[a] is not None:
                payload[str(a)] = mapping[a]
        return 200, json.dumps(payload)

    http_get.calls = calls
    return http_get


async def _no_sleep(*_a, **_k):
    return None


# ---------- pure functions ----------


class TestSplitFlags(unittest.TestCase):
    def test_empty_and_invalid(self):
        self.assertEqual(_split_flags(None), set())
        self.assertEqual(_split_flags(""), set())
        self.assertEqual(_split_flags(123), set())

    def test_tokens_trimmed(self):
        self.assertEqual(_split_flags("Official, Text, Audio"), {"Official", "Text", "Audio"})

    def test_exact_token_no_substring_match(self):
        flags = _split_flags("SemiOfficial, Text")
        self.assertIn("SemiOfficial", flags)
        self.assertNotIn("Official", flags)


class TestNormalize(unittest.TestCase):
    def test_none_raw_not_found(self):
        self.assertEqual(normalize(5, None), {"appid": 5, "found": False})

    def test_empty_model_not_found(self):
        self.assertEqual(normalize(5, {"SteamAppId": 5}), {"appid": 5, "found": False})

    def test_ukrainian_official_audio(self):
        s = normalize(1, UA_OFFICIAL_AUDIO)
        self.assertTrue(s["found"])
        self.assertEqual(s["loc"], "audio")
        self.assertTrue(s["official"])
        self.assertTrue(s["ukrainian"])
        self.assertIsNone(s["threatLevel"])
        self.assertEqual(s["kuliUrl"], "https://kuli.com.ua/game-ua")
        self.assertIsNone(s["bloodyPrice"])

    def test_loc_text_from_subtitles(self):
        s = normalize(1, {"SteamGame": {"Name": "x", "Localization": "Subtitles"}})
        self.assertEqual(s["loc"], "text")

    def test_loc_none(self):
        s = normalize(1, {"SteamGame": {"Name": "x", "Localization": "None"}})
        self.assertEqual(s["loc"], "none")

    def test_official_false_when_kuli_unofficial(self):
        s = normalize(1, {"KuliGame": {"Origin": "Unknown", "Localization": "Unofficial, Text"}})
        self.assertFalse(s["official"])

    def test_official_none_without_kuli(self):
        s = normalize(1, {"SteamGame": {"Name": "x", "Localization": "Text"}})
        self.assertIsNone(s["official"])

    def test_threat_russian_via_origin(self):
        s = normalize(1, {"KuliGame": {"Origin": "Russian", "Localization": "None"}})
        self.assertEqual(s["threatLevel"], "russian")
        self.assertIn("origin:Russian", s["threatReasons"])

    def test_origin_russian_wins_over_vendor(self):
        raw = {
            "KuliGame": {"Origin": "Russian", "Localization": "None"},
            "SteamGame": {
                "Name": "x",
                "Vendors": [{"Name": "V", "TotalGamesPublished": 50, "RussianGamesPublished": 4}],
            },
        }
        self.assertEqual(normalize(1, raw)["threatLevel"], "russian")

    def test_threat_suspect_via_majority_vendor(self):
        # ukrainian dev, russian publisher (86/90) — not a russian game itself
        s = normalize(289620, RUS_PUBLISHER_GAME)
        self.assertEqual(s["threatLevel"], "suspect")
        self.assertTrue(any("ESDigital" in r for r in s["threatReasons"]))
        self.assertEqual(s["bloodyPrice"], "299 руб.")

    def test_threat_suspect_pillars_like(self):
        # Pillars II: no KULI origin, publisher Versus Evil 17/27 (63%) -> suspect, not russian
        raw = {
            "SteamGame": {
                "Name": "Pillars II",
                "Localization": "None",
                "Vendors": [
                    {"Name": "Versus Evil", "TotalGamesPublished": 27, "RussianGamesPublished": 17},
                    {"Name": "Obsidian", "TotalGamesPublished": 20, "RussianGamesPublished": 1},
                ],
            }
        }
        s = normalize(560130, raw)
        self.assertEqual(s["threatLevel"], "suspect")

    def test_threat_russian_via_developer(self):
        # No KULI record, but the game's studio (Schisma Games) develops only
        # russian games (3/3) → treated as a russian game, not merely suspect.
        s = normalize(2936290, RUS_DEVELOPER_GAME)
        self.assertEqual(s["threatLevel"], "russian")
        self.assertTrue(any("developer:Schisma Games" in r for r in s["threatReasons"]))

    def test_russian_publisher_not_mistaken_for_developer(self):
        # ESDigital (publisher) has a tiny russian dev history (1/1) but is NOT
        # this game's developer (Creoteam is) → stays suspect, not russian.
        s = normalize(289620, RUS_PUBLISHER_GAME)
        self.assertEqual(s["threatLevel"], "suspect")
        self.assertFalse(any(r.startswith("developer:") for r in s["threatReasons"]))

    def test_russian_store_link_detected(self):
        raw = {"SteamGame": {"Name": "Disciples", "Localization": "None",
                             "Metadata": {"StoreLinks": ["YouTube", "VK", "Bilibili"]}}}
        s = normalize(1287840, raw)
        self.assertEqual(s["russianLinks"], ["VK"])
        self.assertIsNone(s["threatLevel"])  # independent orange signal, not a threatLevel

    def test_no_russian_store_link(self):
        raw = {"SteamGame": {"Name": "x", "Localization": "None",
                             "Metadata": {"StoreLinks": ["YouTube", "Reddit"]}}}
        self.assertEqual(normalize(1, raw)["russianLinks"], [])

    def test_semi_official_localization(self):
        # KULI "SemiOfficial" → distinct middle tier: semiOfficial True, official False
        s = normalize(1, {"KuliGame": {"Origin": "Ukrainian", "Localization": "SemiOfficial, Text"}})
        self.assertTrue(s["semiOfficial"])
        self.assertFalse(s["official"])
        self.assertEqual(s["loc"], "text")
        # a fully official game is not semi-official
        s2 = normalize(1, {"KuliGame": {"Origin": "Ukrainian", "Localization": "Official, Text"}})
        self.assertFalse(s2["semiOfficial"])
        self.assertTrue(s2["official"])

    def test_app_type_passthrough(self):
        s = normalize(1, {"SteamGame": {"Name": "OST", "Type": "Music", "Localization": "None"}})
        self.assertEqual(s["appType"], "Music")

    def test_threat_vendor_minority(self):
        s = normalize(1336490, MINORITY_VENDOR_GAME)
        self.assertEqual(s["threatLevel"], "vendor")
        self.assertEqual(s["threatReasons"], [])
        self.assertTrue(any("Hooded Horse" in r for r in s["vendorReasons"]))
        # localization badge survives alongside the orange warning
        self.assertEqual(s["loc"], "text")

    def test_vendor_zero_total_treated_as_russian_company(self):
        raw = {
            "SteamGame": {
                "Name": "x",
                "Localization": "None",
                "Vendors": [{"Name": "Ghost", "RussianGamesPublished": 1}],
            }
        }
        s = normalize(1, raw)
        self.assertEqual(s["threatLevel"], "suspect")

    def test_name_falls_back_to_kuli(self):
        s = normalize(1, {"KuliGame": {"Name": "Only Kuli", "Origin": "Ukrainian"}})
        self.assertEqual(s["name"], "Only Kuli")

    def test_bloody_alt_key(self):
        s = normalize(1, {"SteamGame": {"Name": "x"}, "BloodyGame": {"PriceFormatted": "1 руб."}})
        self.assertEqual(s["bloodyPrice"], "1 руб.")


class TestDetails(unittest.TestCase):
    def test_not_found_passthrough(self):
        d = details(5, None)
        self.assertFalse(d["found"])
        self.assertNotIn("vendors", d)

    def test_found_enriched(self):
        d = details(1, UA_OFFICIAL_AUDIO)
        self.assertEqual(d["developers"], ["Dev UA"])
        self.assertEqual(d["publishers"], ["Pub UA"])
        self.assertEqual(len(d["vendors"]), 1)
        self.assertEqual(len(d["curatorReviews"]), 1)
        self.assertEqual(d["iconUrl"], "https://icon/ua.jpg")

    def test_curator_reviews_alt_key(self):
        raw = {"SteamGame": {"Name": "x"}, "SteamCuratorReviews": [{"CuratorId": 1}]}
        d = details(1, raw)
        self.assertEqual(len(d["curatorReviews"]), 1)


# ---------- client ----------


class TestClient(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cache_path = os.path.join(self.tmp, "cache.json")

    def _client(self):
        return PrystanokClient(self.cache_path)

    async def test_fetch_then_cache_hit(self):
        c = self._client()
        http = make_http({1: UA_OFFICIAL_AUDIO})
        with patch.object(c, "_http_get", http):
            r1 = await c.get_games([1])
            r2 = await c.get_games([1])
        self.assertEqual(r1[1]["KuliGame"]["Name"], "Game UA")
        self.assertEqual(r2, r1)
        self.assertEqual(len(http.calls), 1)  # second call served from cache

    async def test_get_statuses_keys_are_strings(self):
        c = self._client()
        with patch.object(c, "_http_get", make_http({1: UA_OFFICIAL_AUDIO})):
            s = await c.get_statuses([1])
        self.assertIn("1", s)
        self.assertTrue(s["1"]["found"])

    async def test_get_details(self):
        c = self._client()
        with patch.object(c, "_http_get", make_http({289620: RUS_PUBLISHER_GAME})):
            d = await c.get_details(289620)
        self.assertEqual(d["threatLevel"], "suspect")
        self.assertEqual(d["developers"], ["Creoteam"])

    async def test_unknown_appid_cached_as_missing(self):
        c = self._client()
        http = make_http({})  # payload empty => appid absent from DB
        with patch.object(c, "_http_get", http):
            r = await c.get_games([999])
            await c.get_games([999])  # should not refetch a known-missing id
        self.assertIsNone(r[999])
        self.assertEqual(len(http.calls), 1)

    async def test_disk_persistence_across_instances(self):
        c1 = self._client()
        with patch.object(c1, "_http_get", make_http({1: UA_OFFICIAL_AUDIO})):
            await c1.get_games([1])
        self.assertTrue(os.path.exists(self.cache_path))
        c2 = self._client()  # fresh instance reads disk
        http2 = make_http({1: UA_OFFICIAL_AUDIO})
        with patch.object(c2, "_http_get", http2):
            r = await c2.get_games([1])
        self.assertEqual(r[1]["KuliGame"]["Name"], "Game UA")
        self.assertEqual(len(http2.calls), 0)  # no fetch needed

    async def test_expired_entry_refetched(self):
        c = self._client()
        http = make_http({1: UA_OFFICIAL_AUDIO})
        with patch.object(c, "_http_get", http):
            await c.get_games([1])
            # age the cached entry past CACHE_TTL
            c._cache[1]["t"] = time.time() - prystanok.CACHE_TTL - 10
            await c.get_games([1])
        self.assertEqual(len(http.calls), 2)

    async def test_missing_ttl_shorter_than_found(self):
        c = self._client()
        http = make_http({})
        with patch.object(c, "_http_get", http):
            await c.get_games([7])
            c._cache[7]["t"] = time.time() - prystanok.MISSING_TTL - 10
            await c.get_games([7])
        self.assertEqual(len(http.calls), 2)

    async def test_batching_over_100(self):
        c = self._client()
        ids = list(range(1, 251))  # 250 ids -> 3 batches
        http = make_http({i: UA_OFFICIAL_AUDIO for i in ids})
        with patch.object(c, "_http_get", http):
            r = await c.get_games(ids)
        self.assertEqual(len(http.calls), 3)
        self.assertEqual(len(r), 250)

    async def test_dedup_input(self):
        c = self._client()
        http = make_http({1: UA_OFFICIAL_AUDIO})
        with patch.object(c, "_http_get", http):
            r = await c.get_games([1, 1, 1])
        self.assertEqual(list(r.keys()), [1])

    async def test_429_then_success(self):
        c = self._client()
        http = make_http(script=[(429, ""), (200, json.dumps({"1": UA_OFFICIAL_AUDIO}))])
        with patch("asyncio.sleep", _no_sleep), patch.object(c, "_http_get", http):
            r = await c.get_games([1])
        self.assertEqual(r[1]["KuliGame"]["Name"], "Game UA")
        self.assertEqual(len(http.calls), 2)

    async def test_429_exhausted_not_cached(self):
        c = self._client()
        http = make_http(script=[(429, "")] * 10)
        with patch("asyncio.sleep", _no_sleep), patch.object(c, "_http_get", http):
            r = await c.get_games([1])
        self.assertIsNone(r[1])
        self.assertEqual(c._cache, {})  # failure must not poison the cache

    async def test_network_exception_not_cached(self):
        c = self._client()
        http = make_http(script=[ConnectionError("boom")] * 10)
        with patch("asyncio.sleep", _no_sleep), patch.object(c, "_http_get", http):
            r = await c.get_games([1])
        self.assertIsNone(r[1])
        self.assertEqual(c._cache, {})

    async def test_http_500_breaks_not_cached(self):
        c = self._client()
        http = make_http(script=[(500, "err")])
        with patch.object(c, "_http_get", http):
            r = await c.get_games([1])
        self.assertIsNone(r[1])
        self.assertEqual(c._cache, {})
        self.assertEqual(len(http.calls), 1)  # 5xx => no retry

    async def test_clear_cache(self):
        c = self._client()
        with patch.object(c, "_http_get", make_http({1: UA_OFFICIAL_AUDIO})):
            await c.get_games([1])
        c.clear_cache()
        self.assertEqual(c._cache, {})
        self.assertFalse(os.path.exists(self.cache_path))

    async def test_concurrent_requests_coalesce(self):
        c = self._client()
        calls = []

        async def slow_http(url):
            calls.append(url)
            await asyncio.sleep(0)  # yield so both coroutines reach the lock
            return 200, json.dumps({"1": UA_OFFICIAL_AUDIO})

        with patch.object(c, "_http_get", slow_http):
            r1, r2 = await asyncio.gather(c.get_games([1]), c.get_games([1]))
        self.assertEqual(r1[1]["KuliGame"]["Name"], "Game UA")
        self.assertEqual(r2[1]["KuliGame"]["Name"], "Game UA")
        self.assertEqual(len(calls), 1)  # lock + recheck => single fetch

    async def test_corrupt_disk_cache_starts_fresh(self):
        with open(self.cache_path, "w") as f:
            f.write("{not json")
        c = self._client()  # must not raise
        self.assertEqual(c._cache, {})


if __name__ == "__main__":
    unittest.main()
