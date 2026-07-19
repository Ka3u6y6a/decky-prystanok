"""Steam Store appdetails fallback for official localization.

Last resort for games in neither the local appinfo cache nor the Prystanok DB
(mostly cold store-browse capsules). Parses the public appdetails endpoint's
``supported_languages`` HTML.

Rate-limited, so callers MUST bound appids per pass; results (incl. "missing")
are disk-cached with a TTL. steam_langs stays primary; this only fills gaps and
no-ops without network.
"""

import asyncio
import json
import logging
import os
import re
import time
import urllib.error
import urllib.request

from prystanok import SSL_CTX, USER_AGENT

try:
    import aiohttp
except ImportError:
    aiohttp = None

logger = logging.getLogger("decky-prystanok.steam_store")

FOUND_TTL = 30 * 24 * 3600
MISSING_TTL = 3 * 24 * 3600

# locale code → English display name Steam uses in supported_languages
# (we query l=english for stable, parseable names)
LANG_NAMES = {
    "uk": "Ukrainian",
    "en": "English",
    "de": "German",
    "fr": "French",
    "it": "Italian",
    "es": "Spanish - Spain",
    "es-419": "Spanish - Latin America",
    "pt": "Portuguese - Portugal",
    "pt-br": "Portuguese - Brazil",
    "pl": "Polish",
    "cs": "Czech",
    "nl": "Dutch",
    "da": "Danish",
    "fi": "Finnish",
    "no": "Norwegian",
    "sv": "Swedish",
    "tr": "Turkish",
    "hu": "Hungarian",
    "ro": "Romanian",
    "bg": "Bulgarian",
    "el": "Greek",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Simplified Chinese",
    "zh-tw": "Traditional Chinese",
    "th": "Thai",
    "vi": "Vietnamese",
    "id": "Indonesian",
}

_cache = {}  # key "appid:lang" -> {"loc": dict|None, "ts": float}
_cache_path = None


def init(cache_path):
    """Point the disk cache at a file and load it, best-effort."""
    global _cache_path
    _cache_path = cache_path
    try:
        with open(cache_path, encoding="utf-8") as f:
            _cache.update(json.load(f))
    except (OSError, ValueError):
        pass


def _persist():
    if not _cache_path:
        return
    try:
        tmp = _cache_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(_cache, f)
        os.replace(tmp, _cache_path)
    except OSError:
        pass


def parse_supported_languages(html, lang_name):
    """Parse Steam's supported_languages HTML for one language → dict or None.

    ``*`` after a language marks full audio. No interface/subtitle split in the
    string, so subtitles stays False and text True.
    """
    if not html or not lang_name:
        return None
    head = re.split(r"<br\s*/?>", html, maxsplit=1)[0]
    for token in head.split(","):
        audio = "*" in token
        name = re.sub(r"<[^>]+>", "", token).replace("*", "").strip()
        if name.lower() == lang_name.lower():
            return {"official": True, "text": True, "audio": audio, "subtitles": False}
    return None


async def _http_get(url):
    """(status, body). aiohttp on the Deck, urllib fallback locally."""
    if aiohttp is not None:
        async with aiohttp.ClientSession(headers={"User-Agent": USER_AGENT}) as s:
            async with s.get(url, timeout=aiohttp.ClientTimeout(total=20), ssl=SSL_CTX) as r:
                return r.status, await r.text()

    def blocking():
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=20, context=SSL_CTX) as resp:
                return resp.status, resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as err:
            return err.code, ""

    return await asyncio.to_thread(blocking)


def _fresh(entry):
    if not entry:
        return False
    ttl = FOUND_TTL if entry.get("loc") is not None else MISSING_TTL
    return (time.time() - entry.get("ts", 0)) < ttl


async def fetch_loc(appid, lang="uk", now=None):
    """Official loc for one appid via appdetails, cached. None if absent.

    429 is not cached, so it retries next time.
    """
    lang_name = LANG_NAMES.get(lang)
    if not lang_name:
        return None
    key = f"{appid}:{lang}"
    entry = _cache.get(key)
    if _fresh(entry):
        return entry["loc"]

    url = f"https://store.steampowered.com/api/appdetails?appids={appid}&l=english"
    try:
        status, body = await _http_get(url)
    except Exception as e:  # noqa: BLE001
        logger.debug("appdetails %s failed: %s", appid, e)
        return entry["loc"] if entry else None
    if status == 429:
        logger.info("appdetails rate-limited on %s; will retry", appid)
        return entry["loc"] if entry else None
    loc = None
    try:
        data = json.loads(body).get(str(appid), {})
        if data.get("success") and data.get("data"):
            loc = parse_supported_languages(data["data"].get("supported_languages"), lang_name)
    except (ValueError, AttributeError):
        loc = None
    _cache[key] = {"loc": loc, "ts": (now if now is not None else time.time())}
    _persist()
    return loc


async def fetch_locs(appids, lang="uk", cap=10):
    """Resolve up to ``cap`` uncached appids concurrently → {appid: loc}.

    Cached appids don't count against the cap. Bounds calls so a fast scroll
    can't storm the rate-limited endpoint.
    """
    result = {}
    to_fetch = []
    for a in appids:
        entry = _cache.get(f"{a}:{lang}")
        if _fresh(entry):
            if entry["loc"] is not None:
                result[int(a)] = entry["loc"]
        elif len(to_fetch) < cap:
            to_fetch.append(a)
    if len(appids) > len(to_fetch) + len(result):
        logger.info("appdetails cap %d hit; %d appids deferred", cap, len(appids) - cap)
    fetched = await asyncio.gather(*(fetch_loc(a, lang) for a in to_fetch))
    for a, loc in zip(to_fetch, fetched):
        if loc is not None:
            result[int(a)] = loc
    return result
