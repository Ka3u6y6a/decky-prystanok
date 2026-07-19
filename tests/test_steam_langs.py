"""Tests for the Steam appinfo.vdf official-localization parser (py_modules/steam_langs.py)."""

import os
import struct
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "py_modules"))

import steam_langs as S  # noqa: E402


def _u32(n):
    return struct.pack("<I", n)


def build_v29(apps):
    """Craft a minimal v29 appinfo.vdf.

    `apps` = list of (appid, {lang: {flag: "true"/"false"}}). Keys are interned
    into the trailing string table, exactly like real v29 files.
    """
    strings = []
    index = {}

    def idx(s):
        if s not in index:
            index[s] = len(strings)
            strings.append(s)
        return index[s]

    def kv_str(name, value):
        return bytes([S.T_STRING]) + _u32(idx(name)) + value.encode() + b"\x00"

    def kv_obj(name, body):
        return bytes([S.T_NESTED]) + _u32(idx(name)) + body + bytes([S.T_END])

    app_section = b""
    for appid, langs in apps:
        lang_body = b""
        for lang, flags in langs.items():
            lang_body += kv_obj(lang, b"".join(kv_str(k, v) for k, v in flags.items()))
        sl = kv_obj("supported_languages", lang_body)
        common = kv_obj("common", sl)
        blob = common + bytes([S.T_END])  # root object terminator
        fixed = b"\x00" * 60  # infoState..binarySha1 (v28+)
        body = fixed + blob
        app_section += _u32(appid) + _u32(len(body)) + body
    app_section += _u32(0)  # appid==0 terminator

    st_off = 16 + len(app_section)
    header = struct.pack("<II", S.MAGIC_V29, 1) + struct.pack("<q", st_off)
    table = _u32(len(strings)) + b"".join(s.encode() + b"\x00" for s in strings)
    return header + app_section + table


class TestParseAppinfo(unittest.TestCase):
    def _parse(self, apps):
        return self._parse_lang(apps, "ukrainian")

    def _parse_lang(self, apps, lang_key):
        with tempfile.NamedTemporaryFile(suffix=".vdf", delete=False) as f:
            f.write(build_v29(apps))
            path = f.name
        try:
            return S.parse_appinfo(path, lang_key)
        finally:
            os.unlink(path)

    def test_text_only(self):
        m = self._parse([(570, {"english": {"supported": "true", "full_audio": "true"},
                                "ukrainian": {"supported": "true"}})])
        self.assertEqual(m[570], {"supported": True, "full_audio": False, "subtitles": False})

    def test_full_audio_and_subtitles(self):
        m = self._parse([(100, {"ukrainian": {"supported": "true", "full_audio": "true",
                                              "subtitles": "true"}})])
        self.assertEqual(m[100], {"supported": True, "full_audio": True, "subtitles": True})

    def test_false_flags_kept_but_falsey(self):
        m = self._parse([(200, {"ukrainian": {"supported": "false"}})])
        self.assertEqual(m[200], {"supported": False, "full_audio": False, "subtitles": False})

    def test_no_ukrainian_excluded(self):
        m = self._parse([(300, {"english": {"supported": "true"}})])
        self.assertNotIn(300, m)

    def test_multiple_apps(self):
        m = self._parse([
            (1, {"ukrainian": {"supported": "true"}}),
            (2, {"english": {"supported": "true"}}),
            (3, {"ukrainian": {"full_audio": "true"}}),
        ])
        self.assertIn(1, m)
        self.assertNotIn(2, m)
        self.assertTrue(m[3]["full_audio"])

    def test_other_language(self):
        m = self._parse_lang(
            [(400, {"polish": {"supported": "true"}, "ukrainian": {"supported": "true"}})],
            "polish",
        )
        self.assertEqual(m[400], {"supported": True, "full_audio": False, "subtitles": False})

    def test_bad_magic_raises(self):
        with tempfile.NamedTemporaryFile(suffix=".vdf", delete=False) as f:
            f.write(struct.pack("<II", 0xDEADBEEF, 1) + b"\x00" * 32)
            path = f.name
        try:
            self.assertRaises(ValueError, S.parse_appinfo, path)
        finally:
            os.unlink(path)


class TestGetSteamLoc(unittest.TestCase):
    def setUp(self):
        self._orig = S.resolve_appinfo_path
        fd, self._path = tempfile.mkstemp(suffix=".vdf")
        os.close(fd)
        with open(self._path, "wb") as f:
            f.write(build_v29([
                (570, {"ukrainian": {"supported": "true"}}),  # text only
                (100, {"ukrainian": {"full_audio": "true"}}),  # audio
                (200, {"ukrainian": {"subtitles": "true"}}),  # subtitles → text
                (300, {"ukrainian": {"supported": "false"}}),  # nothing real
                (400, {"polish": {"supported": "true"}}),  # non-UA language
            ]))
        S.resolve_appinfo_path = lambda: self._path
        S._cache.update(path=None, mtime=None, map={})

    def tearDown(self):
        S.resolve_appinfo_path = self._orig
        S._cache.update(path=None, mtime=None, map={})
        os.unlink(self._path)

    def test_maps_flags_to_loc(self):
        loc = S.get_steam_loc([570, 100, 200, 300, 999])
        self.assertEqual(loc[570], {"official": True, "text": True, "audio": False, "subtitles": False})
        self.assertEqual(loc[100]["audio"], True)
        self.assertEqual(loc[200]["text"], True)  # subtitles count as text
        self.assertNotIn(300, loc)  # all-false → omitted
        self.assertNotIn(999, loc)  # unknown appid

    def test_other_language_code(self):
        loc = S.get_steam_loc([400, 570], "pl")
        self.assertEqual(loc[400], {"official": True, "text": True, "audio": False, "subtitles": False})
        self.assertNotIn(570, loc)  # 570 has no Polish

    def test_unknown_language_empty(self):
        self.assertEqual(S.get_steam_loc([570, 400], "zz"), {})

    def test_no_file_empty(self):
        S.resolve_appinfo_path = lambda: None
        S._cache.update(path=None, mtime=None, lang=None, map={})
        self.assertEqual(S.get_steam_loc([570]), {})


class TestPathResolution(unittest.TestCase):
    def test_candidates_nonempty(self):
        self.assertTrue(any("appinfo.vdf" in p for p in S.candidate_paths()))


if __name__ == "__main__":
    unittest.main()
