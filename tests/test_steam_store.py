"""Tests for the appdetails localization fallback (py_modules/steam_store.py)."""

import asyncio
import json
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "py_modules"))

import steam_store as SS  # noqa: E402


class TestParse(unittest.TestCase):
    def test_text_only(self):
        html = "English<strong>*</strong>, French<strong>*</strong>, Ukrainian, Polish"
        self.assertEqual(
            SS.parse_supported_languages(html, "Ukrainian"),
            {"official": True, "text": True, "audio": False, "subtitles": False},
        )

    def test_full_audio_star(self):
        html = "English<strong>*</strong>, Ukrainian<strong>*</strong>"
        self.assertTrue(SS.parse_supported_languages(html, "Ukrainian")["audio"])

    def test_absent_language(self):
        html = "English<strong>*</strong>, German, French"
        self.assertIsNone(SS.parse_supported_languages(html, "Ukrainian"))

    def test_ignores_trailing_note(self):
        html = "English, Ukrainian<br><strong>*</strong>languages with full audio support"
        self.assertEqual(SS.parse_supported_languages(html, "Ukrainian")["text"], True)

    def test_empty(self):
        self.assertIsNone(SS.parse_supported_languages("", "Ukrainian"))
        self.assertIsNone(SS.parse_supported_languages(None, "Ukrainian"))


def _body(appid, langs_html, success=True):
    return json.dumps({str(appid): {"success": success, "data": {"supported_languages": langs_html}}})


class TestFetch(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        SS._cache.clear()
        SS._cache_path = None  # skip disk persistence
        self._orig = SS._http_get
        self.calls = []

    def tearDown(self):
        SS._http_get = self._orig
        SS._cache.clear()

    def _mock(self, status, body):
        async def http(url):
            self.calls.append(url)
            return status, body
        SS._http_get = http

    async def test_fetch_and_cache(self):
        self._mock(200, _body(570, "English<strong>*</strong>, Ukrainian"))
        loc = await SS.fetch_loc(570, "uk")
        self.assertEqual(loc, {"official": True, "text": True, "audio": False, "subtitles": False})
        await SS.fetch_loc(570, "uk")  # cached → no second HTTP
        self.assertEqual(len(self.calls), 1)

    async def test_missing_language_cached(self):
        self._mock(200, _body(1, "English, German"))
        self.assertIsNone(await SS.fetch_loc(1, "uk"))
        await SS.fetch_loc(1, "uk")
        self.assertEqual(len(self.calls), 1)  # negative result also cached

    async def test_rate_limit_not_cached(self):
        self._mock(429, "")
        self.assertIsNone(await SS.fetch_loc(2, "uk"))
        self.assertNotIn("2:uk", SS._cache)  # 429 must retry next time

    async def test_unknown_lang_no_http(self):
        self._mock(200, _body(3, "Ukrainian"))
        self.assertIsNone(await SS.fetch_loc(3, "zz"))  # unmapped code
        self.assertEqual(len(self.calls), 0)

    async def test_fetch_locs_respects_cap(self):
        self._mock(200, _body(0, "Ukrainian"))  # body appid mismatch → parse None, still counts call
        # 5 appids, cap 2 → only 2 HTTP calls
        await SS.fetch_locs([10, 11, 12, 13, 14], "uk", cap=2)
        self.assertEqual(len(self.calls), 2)


if __name__ == "__main__":
    unittest.main()
