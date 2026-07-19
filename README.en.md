<div align="center">
  <img src="assets/logo.png" width="120" alt="Prystanok" />
  <h1>Prystanok 🇺🇦</h1>
</div>

<div align="center"><a href="README.md">Українська</a> · <b>English</b></div>

A [decky-loader](https://github.com/SteamDeckHomebrew/decky-loader) plugin that surfaces, right in the Steam Deck UI:

- 🟦 **a localization badge** — whether a game has localization **in the language you pick in settings** (defaults to the Steam UI language). Official data comes from the local Steam cache (`appinfo.vdf`) — offline, for any language, split into text / subtitles / voice.
- 🟥 **a threat icon** (three levels): **"russian game"** — a game of russian origin (KULI) or whose **developer is a russian studio**; **"likely questionable game"** — a majority-russian publisher/vendor (>50% of the portfolio); **"⚠ publisher released russian games"** — russian games in the minority. Plus a separate signal for **russian links** (VK etc.). The threat badge is always shown;
- ⚠️ a warning when a Ukrainian game is sold in the russian region.


## Screenshots

<table>
  <tr>
    <td width="50%"><img src="screenshots/store.jpg" alt="Overlays on Steam store capsules"><br><sub>Steam store — overlays on capsules</sub></td>
    <td width="50%"><img src="screenshots/recent_games.jpg" alt="Overlays in the library"><br><sub>Home — Recent Games grid</sub></td>
  </tr>
  <tr>
    <td><img src="screenshots/game-page.jpg" alt="Badge on the game page"><br><sub>Game page — threat badge + fan translation</sub></td>
    <td><img src="screenshots/library-grid.jpg" alt="Compact overlays in the library grid"><br><sub>Library grid — compact overlays on covers</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="screenshots/quick-access.jpg" alt="Quick Access panel with details"><br><sub>Quick Access — full details: verdict, localization, developer, curator reviews</sub></td>
  </tr>
</table>

All badge placements and variants:

![Badge placements and variants](screenshots/badges-reference-en.png)

## Where the icons appear

| Place | What it shows |
|---|---|
| Library game page | localization / threat badge; tap → details modal in the Steam UI (Prystanok / KULI buttons) |
| Library grid & home capsules | compact overlays ("UA", "UA ♪", "RU", "questionable", "publisher") on covers |
| Store (`store.steampowered.com`) | badge on the game page + overlays on list capsules; tap → in-page modal |
| Quick Access panel | full details (same as the modal): verdict, developer, vendor stats of russian games, russian links, Ukrainian curator reviews, "why it's wrong" |

The Quick Access panel shows details for the running game, a game open in the store, or the last one opened in the library.

## Settings

- **Surfaces** (capsules / game page / store) — toggled independently; per surface: position, size, offsets.
- **Localization** — global toggle for the loc badge, detail level (text/voice, official/unofficial) and **which language to look for** (defaults to the Steam UI language).
- The plugin's own label language also follows the Steam UI language (Ukrainian / English).

## Credits

- [Ihrovyi Prystanok](https://prystanok.com.ua/) — API with data on games, publishers and localizations
- [KULI — catalog of Ukrainian game localizations](https://kuli.com.ua/)
- [ProtonDB Badges](https://github.com/OMGDuke/protondb-decky) — game-page patching pattern
- Built on the [decky-plugin-template](https://github.com/SteamDeckHomebrew/decky-plugin-template) (Steam Deck Homebrew)

## License

Code — [BSD-3-Clause](LICENSE). Icons — [Font Awesome Free 5](https://fontawesome.com/) (CC BY 4.0).
