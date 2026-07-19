"""Tests for the store-page badge spec (py_modules/store_injector.py)."""

import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "py_modules"))

from store_injector import (  # noqa: E402
    CRIT,
    ICON,
    LANG_LOC_BG,
    ORANGE,
    SCRIM,
    _apply_js,
    _top_badge_style,
    store_card_chips,
    store_chips,
    store_modal_data,
)


class TestStoreChips(unittest.TestCase):
    def test_not_found_or_none(self):
        self.assertEqual(store_chips(None), [])
        self.assertEqual(store_chips({"found": False}), [])

    def test_russian_single_red(self):
        c = store_chips({"found": True, "threatLevel": "russian"})
        self.assertEqual(len(c), 1)
        self.assertEqual(c[0]["label"], "російська гра")
        self.assertEqual(c[0]["bg"], CRIT)

    def test_official_text(self):
        c = store_chips({"found": True, "loc": "text", "official": True})
        self.assertEqual(c[0]["label"], "УКР")  # prefix only; type is icons
        self.assertEqual(c[0]["bg"], SCRIM)
        self.assertIn("#1d61c4", c[0]["border"])
        self.assertTrue(c[0]["flag"])
        self.assertEqual(c[0]["icons"], [ICON["cc"]])  # text → CC

    def test_unofficial_outlined(self):
        c = store_chips({"found": True, "loc": "audio", "official": False})
        self.assertEqual(c[0]["label"], "Українізатор")
        self.assertIn("dashed", c[0]["border"])
        self.assertEqual(c[0]["bg"], SCRIM)
        self.assertEqual(c[0]["icons"], [ICON["cc"], ICON["speaker"]])  # audio → CC + speaker

    def test_non_uk_language(self):
        c = store_chips({"found": True, "loc": "text", "official": True, "locLang": "pl"})
        self.assertEqual(c[0]["label"], "PL")
        self.assertEqual(c[0]["bg"], LANG_LOC_BG)
        self.assertNotIn("flag", c[0])  # no Ukrainian flag for other languages
        self.assertEqual(c[0]["lead"], "✓")  # green "present" check instead
        self.assertEqual(c[0]["icons"], [ICON["cc"]])

    def test_russian_has_hand_icon(self):
        # page badge: icon + text; capsule card: icon only
        self.assertEqual(store_chips({"found": True, "threatLevel": "russian"})[0]["icon"], ICON["hand"])
        card = store_card_chips({"found": True, "threatLevel": "russian"})[0]
        self.assertEqual(card["icon"], ICON["hand"])
        self.assertNotIn("text", card)

    def test_semi_official_chip(self):
        c = store_chips({"found": True, "loc": "text", "semiOfficial": True})
        self.assertEqual(c[0]["label"], "Напівофіційна")
        self.assertTrue(c[0]["flag"])
        self.assertEqual(c[0]["icons"], [ICON["cc"]])
        cc = store_card_chips({"found": True, "loc": "text", "semiOfficial": True})
        self.assertTrue(cc[0]["flag"])          # flag + type icons, no text
        self.assertNotIn("text", cc[0])
        self.assertEqual(cc[0]["icons"], [ICON["cc"]])

    def test_non_game_type_not_badged(self):
        self.assertEqual(store_chips({"found": True, "threatLevel": "russian", "appType": "Music"}), [])
        self.assertEqual(store_card_chips({"found": True, "loc": "text", "appType": "Hardware"}), [])
        # a real game type still badges
        self.assertTrue(store_chips({"found": True, "threatLevel": "russian", "appType": "Game"}))

    def test_suspect_with_localization(self):
        c = store_chips({"found": True, "loc": "text", "official": True, "threatLevel": "suspect"})
        self.assertEqual(len(c), 2)
        self.assertEqual(c[0]["label"], "ймовірно сумнівна гра")
        self.assertEqual(c[1]["label"], "УКР")

    def test_show_loc_false_threat_only(self):
        c = store_chips({"found": True, "loc": "text", "official": True, "threatLevel": "vendor"}, show_loc=False)
        self.assertEqual([x["label"] for x in c], ["видавець видавав рос. ігри"])

    def test_show_loc_false_no_threat_empty(self):
        self.assertEqual(store_chips({"found": True, "loc": "text", "official": True}, show_loc=False), [])

    def test_surface_off_only_russian(self):
        # surface off → softer warnings + localization dropped; only russian survives
        self.assertEqual(store_chips({"found": True, "loc": "text", "threatLevel": "vendor"}, surface_on=False), [])
        self.assertEqual(store_chips({"found": True, "russianLinks": ["VK"]}, surface_on=False), [])
        self.assertEqual(store_chips({"found": True, "loc": "text", "official": True}, surface_on=False), [])
        r = store_chips({"found": True, "threatLevel": "russian"}, surface_on=False, show_loc=False)
        self.assertEqual(r[0]["label"], "російська гра")

    def test_ui_lang_en(self):
        c = store_chips({"found": True, "threatLevel": "vendor", "loc": "text", "official": True}, True, True, "en")
        self.assertEqual(c[0]["label"], "publisher released Russian games")
        self.assertEqual(c[1]["label"], "UA")
        # card russian is icon-only regardless of language
        self.assertEqual(store_card_chips({"found": True, "threatLevel": "russian"}, True, True, "en")[0]["icon"], ICON["hand"])

    def test_vendor_minority(self):
        c = store_chips({"found": True, "loc": "none", "threatLevel": "vendor"})
        self.assertEqual(len(c), 1)
        self.assertEqual(c[0]["label"], "видавець видавав рос. ігри")

    def test_ukrainian_no_loc(self):
        c = store_chips({"found": True, "loc": "none", "ukrainian": True})
        self.assertEqual(c[0]["label"], "українська гра")

    def test_plain_game_no_chips(self):
        self.assertEqual(store_chips({"found": True, "loc": "none"}), [])

    def test_russian_links_detailed(self):
        c = store_chips({"found": True, "loc": "none", "russianLinks": ["VK"]})
        self.assertEqual(c[0]["label"], "ймовірно сумнівна гра")
        self.assertEqual(c[0]["bg"], ORANGE)


class TestStoreCardChips(unittest.TestCase):
    # Capsule cards are icon-only for threats, flag-only for localization.
    def test_russian(self):
        c = store_card_chips({"found": True, "threatLevel": "russian"})
        self.assertEqual(c[0]["icon"], ICON["hand"])

    def test_official_vs_unofficial_flag(self):
        off = store_card_chips({"found": True, "loc": "text", "official": True})
        un = store_card_chips({"found": True, "loc": "text", "official": False})
        self.assertTrue(off[0]["flag"])
        self.assertNotIn("text", off[0])               # flag + icons only, no "УКР"
        self.assertEqual(off[0]["icons"], [ICON["cc"]])
        self.assertTrue(un[0]["flag"])
        self.assertIn("dashed", un[0]["border"])       # fan → dashed

    def test_audio_unofficial(self):
        c = store_card_chips({"found": True, "loc": "audio", "official": False})
        self.assertEqual(c[0]["icons"], [ICON["cc"], ICON["speaker"]])

    def test_vendor_and_suspect_icons(self):
        self.assertEqual(
            store_card_chips({"found": True, "loc": "none", "threatLevel": "vendor"})[0]["icon"], ICON["shield"]
        )
        c = store_card_chips({"found": True, "loc": "text", "threatLevel": "suspect"})
        self.assertEqual(c[0]["icon"], ICON["triangle"])  # threat icon
        self.assertTrue(c[1]["flag"])                     # UA flag chip below

    def test_plain_empty(self):
        self.assertEqual(store_card_chips({"found": True, "loc": "none"}), [])

    def test_card_show_loc_false_threat_only(self):
        c = store_card_chips({"found": True, "loc": "text", "threatLevel": "suspect"}, show_loc=False)
        self.assertEqual([x["icon"] for x in c], [ICON["triangle"]])

    def test_card_surface_off_only_russian(self):
        self.assertEqual(store_card_chips({"found": True, "threatLevel": "suspect"}, surface_on=False), [])
        self.assertEqual(
            store_card_chips({"found": True, "threatLevel": "russian"}, surface_on=False)[0]["icon"], ICON["hand"]
        )

    def test_russian_links_card(self):
        c = store_card_chips({"found": True, "loc": "none", "russianLinks": ["VK"]})
        self.assertEqual(c[0]["icon"], ICON["triangle"])
        self.assertEqual(c[0]["bg"], ORANGE)

    def test_russian_links_suppressed_by_stronger_threat(self):
        c = store_card_chips({"found": True, "loc": "none", "threatLevel": "vendor", "russianLinks": ["VK"]})
        self.assertEqual([x["icon"] for x in c], [ICON["shield"]])  # vendor wins, single icon


class TestStoreModalData(unittest.TestCase):
    def test_none_when_not_found(self):
        self.assertIsNone(store_modal_data({"found": False}, 1))
        self.assertIsNone(store_modal_data(None, 1))

    def test_collects_risky_vendors_sorted_with_share(self):
        details = {
            "found": True, "name": "Collapse", "loc": "none", "threatLevel": "suspect",
            "developers": ["Creoteam"], "publishers": ["ESDigital Games"],
            "russianLinks": [],
            "vendors": [
                {"Name": "Creoteam", "TotalGamesPublished": 2, "TotalGamesDeveloped": 3,
                 "RussianGamesPublished": 0, "RussianGamesDeveloped": 1},
                {"Name": "ESDigital Games", "TotalGamesPublished": 89, "TotalGamesDeveloped": 1,
                 "RussianGamesPublished": 85, "RussianGamesDeveloped": 1},
            ],
            "curatorReviews": [{"CuratorName": "Sich", "ReviewType": "NotRecommended", "Review": "..."}],
            "kuliUrl": None,
        }
        md = store_modal_data(details, 289620)
        self.assertEqual(md["appid"], 289620)
        self.assertEqual(md["chips"][0]["label"], "ймовірно сумнівна гра")
        # worst offender first, with share %
        self.assertEqual(md["vendors"][0]["name"], "ESDigital Games")
        self.assertEqual(md["vendors"][0]["pct"], 96)
        self.assertTrue(md["vendors"][0]["majority"])
        self.assertEqual(len(md["reviews"]), 1)

    def test_russian_links_only(self):
        md = store_modal_data({"found": True, "name": "Disciples", "loc": "none",
                               "russianLinks": ["VK"], "vendors": []}, 1287840)
        self.assertEqual(md["russianLinks"], ["VK"])
        self.assertEqual(md["chips"][0]["label"], "ймовірно сумнівна гра")


class TestTopBadgeStyle(unittest.TestCase):
    def test_top_right(self):
        s = _top_badge_style({"position": "top-right", "offsetX": 12, "offsetY": 40})
        self.assertEqual(s["position"], "fixed")
        self.assertEqual(s["top"], "40px")
        self.assertEqual(s["right"], "12px")
        self.assertNotIn("left", s)

    def test_bottom_center_nudge(self):
        s = _top_badge_style({"position": "bottom-center", "offsetX": 8, "offsetY": 16})
        self.assertEqual(s["bottom"], "16px")
        self.assertEqual(s["left"], "50%")
        self.assertEqual(s["transform"], "translateX(calc(-50% + 8px))")

    def test_defaults(self):
        s = _top_badge_style(None)
        self.assertEqual(s["top"], "54px")
        self.assertEqual(s["left"], "50%")


class TestApplyJs(unittest.TestCase):
    def test_card_and_page_payload(self):
        js = _apply_js({"289620": [{"text": "сумнівна", "bg": "#a01818", "color": "#ffd700", "border": ""}]},
                       [{"label": "УКР: текст", "bg": "#0057b7", "color": "#fff", "border": ""}], 289620)
        self.assertIn("data-prystanok-card", js)       # per-card overlays
        self.assertIn("prystanok-store-badge", js)     # top page badge
        self.assertIn("УКР: текст", js)
        self.assertIn("сумнівна", js)
        self.assertIn("querySelectorAll", js)          # scans store capsule links
        self.assertIn("/app/", js)
        # CSSOM, not a CSP-blocked style attribute string
        self.assertIn("el.style.background", js)
        self.assertNotIn("setAttribute('style'", js)

    def test_empty_app_chips_removes_page_badge(self):
        js = _apply_js({}, [], None)
        self.assertIn("if (box) box.remove()", js)


if __name__ == "__main__":
    unittest.main()
