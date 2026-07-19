"""Prystanok API client — disk/memory cache + response normalization.

Pure Python, no decky imports, so it runs on a dev machine:
    python3 -c "import asyncio, sys; sys.path.insert(0, 'py_modules'); \\
        import prystanok; print(asyncio.run(prystanok.PrystanokClient('/tmp/ps.json').get_statuses([1643320, 289620])))"
"""

import asyncio
import json
import logging
import os
import ssl
import tempfile
import time
import urllib.parse
import urllib.request

try:
    import aiohttp  # ships with decky-loader's python
except ImportError:  # local dev fallback
    aiohttp = None

API_BASE = "https://prystanok.com.ua/api"
BATCH_LIMIT = 100
CACHE_TTL = 7 * 24 * 3600  # found games
MISSING_TTL = 24 * 3600  # appids not in the Prystanok DB
RETRY_DELAYS = (2, 5, 10)  # seconds, on HTTP 429
USER_AGENT = "decky-prystanok/0.0.1 (+https://github.com/dzhyvotchenko/decky-prystanok)"

logger = logging.getLogger("decky-prystanok.prystanok")


def _build_ssl_context():
    """decky-loader's embedded Python has no default CA path; resolve one
    explicitly (certifi, else SteamOS system bundle)."""
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        pass
    for path in ("/etc/ssl/certs/ca-certificates.crt", "/etc/ssl/cert.pem"):
        if os.path.exists(path):
            return ssl.create_default_context(cafile=path)
    return ssl.create_default_context()


SSL_CTX = _build_ssl_context()


# russian StoreLinks → "ймовірно сумнівна" even when vendors look clean
# (e.g. Disciples: Liberation has a VK page but western publisher/dev)
RUSSIAN_STORE_LINKS = {"vk", "vkplay", "odnoklassniki", "rutube", "dzen", "yandex"}


def _split_flags(value):
    """'Official, Text, Audio' -> set of exact tokens, so 'SemiOfficial'
    never matches 'Official'."""
    if not value or not isinstance(value, str):
        return set()
    return {part.strip() for part in value.split(",") if part.strip()}


def normalize(appid, raw):
    """Collapse AggregatedGameModel into the compact shape the frontend uses."""
    kuli = (raw or {}).get("KuliGame")
    steam = (raw or {}).get("SteamGame")
    bloody = (raw or {}).get("SteamBloodyGame") or (raw or {}).get("BloodyGame")

    if not kuli and not steam:
        return {"appid": appid, "found": False}

    steam_flags = _split_flags(steam.get("Localization")) if steam else set()
    kuli_flags = _split_flags(kuli.get("Localization")) if kuli else set()

    if "Audio" in steam_flags or "Audio" in kuli_flags:
        loc = "audio"
    elif {"Text", "Subtitles"} & (steam_flags | kuli_flags):
        loc = "text"
    else:
        loc = "none"

    # KULI officiality tiers: Official / SemiOfficial (напівофіційна) / fan.
    # `official` stays a bool for callers; `semiOfficial` marks the middle.
    official = None
    semi_official = False
    if kuli_flags:
        official = "Official" in kuli_flags
        semi_official = "SemiOfficial" in kuli_flags and not official

    # three threat tiers:
    #  - "russian" (red):   Origin == Russian, OR this game's *developer* is a
    #    russian studio (its DEVELOPED portfolio is majority russian)
    #  - "suspect" (red):   not a russian studio, but a vendor is >50% russian
    #    overall — usually a russian *publisher* over a non-russian dev (Versus Evil 17/27)
    #  - "vendor"  (orange): vendor with russian games as a minority (Hooded Horse 4/50)
    # dev check is keyed to this game's declared developers, so a russian publisher
    # with a tiny dev history (ESDigital 1/1) isn't mistaken for the studio.
    threat_reasons = []
    vendor_reasons = []
    origin = (kuli or {}).get("Origin")
    if origin == "Russian":
        threat_reasons.append("origin:Russian")
    developers = set((steam or {}).get("Metadata", {}).get("Developers") or [])
    has_russian_developer = False
    has_majority_vendor = False
    vendors = (steam or {}).get("Vendors") or []
    for vendor in vendors:
        rus_dev = vendor.get("RussianGamesDeveloped", 0) or 0
        rus = (vendor.get("RussianGamesPublished", 0) or 0) + rus_dev
        if rus == 0:
            continue
        total_dev = vendor.get("TotalGamesDeveloped", 0) or 0
        total = (vendor.get("TotalGamesPublished", 0) or 0) + total_dev
        share = rus / total if total else 1.0
        desc = f"{vendor.get('Name')} (рос. ігор: {rus}/{total})"
        dev_share = rus_dev / total_dev if total_dev else 0.0
        if vendor.get("Name") in developers and rus_dev > 0 and dev_share > 0.5:
            # this game's studio makes mostly russian games
            has_russian_developer = True
            threat_reasons.append(f"developer:{desc}")
        elif share > 0.5:
            threat_reasons.append(f"vendor:{desc}")
            has_majority_vendor = True
        else:
            vendor_reasons.append(f"vendor:{desc}")

    if origin == "Russian" or has_russian_developer:
        threat_level = "russian"
    elif has_majority_vendor:
        threat_level = "suspect"
    elif vendor_reasons:
        threat_level = "vendor"
    else:
        threat_level = None

    # independent orange signal: russian social/store links (VK etc.)
    store_links = ((steam or {}).get("Metadata") or {}).get("StoreLinks") or []
    russian_links = [l for l in store_links if isinstance(l, str) and l.strip().lower() in RUSSIAN_STORE_LINKS]

    return {
        "appid": appid,
        "found": True,
        "name": (steam or {}).get("Name") or (kuli or {}).get("Name"),
        "threatLevel": threat_level,
        "threatReasons": threat_reasons,
        "vendorReasons": vendor_reasons,
        "russianLinks": russian_links,
        "loc": loc,
        "official": official,
        "semiOfficial": semi_official,
        "ukrainian": origin == "Ukrainian",
        "appType": (steam or {}).get("Type"),
        "kuliUrl": (kuli or {}).get("Url"),
        "bloodyPrice": (bloody or {}).get("PriceFormatted"),
    }


def details(appid, raw):
    """Full payload for the Quick Access panel."""
    base = normalize(appid, raw)
    if not base["found"]:
        return base
    steam = raw.get("SteamGame") or {}
    base["vendors"] = steam.get("Vendors") or []
    base["publishers"] = (steam.get("Metadata") or {}).get("Publishers") or []
    base["developers"] = (steam.get("Metadata") or {}).get("Developers") or []
    base["curatorReviews"] = raw.get("CuratorReviews") or raw.get("SteamCuratorReviews") or []
    base["iconUrl"] = steam.get("IconUrl")
    return base


class PrystanokClient:
    def __init__(self, cache_path, log=None):
        self.cache_path = cache_path
        self.log = log or logger
        # appid(int) -> {"t": fetched_at, "d": raw model | None (None == not in DB)}
        self._cache = {}
        self._fetch_lock = asyncio.Lock()
        self._load_disk_cache()

    # ---------- cache ----------

    def _load_disk_cache(self):
        try:
            with open(self.cache_path, "r", encoding="utf-8") as f:
                stored = json.load(f)
            self._cache = {int(k): v for k, v in stored.items()}
            self.log.info("prystanok cache loaded: %d entries", len(self._cache))
        except FileNotFoundError:
            self._cache = {}
        except Exception as exc:
            self.log.warning("prystanok cache unreadable, starting fresh: %s", exc)
            self._cache = {}

    def _save_disk_cache(self):
        try:
            os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=os.path.dirname(self.cache_path))
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump({str(k): v for k, v in self._cache.items()}, f)
            os.replace(tmp, self.cache_path)
        except Exception as exc:
            self.log.warning("prystanok cache write failed: %s", exc)

    def clear_cache(self):
        self._cache = {}
        try:
            os.remove(self.cache_path)
        except FileNotFoundError:
            pass

    def _fresh(self, appid):
        entry = self._cache.get(appid)
        if entry is None:
            return None
        ttl = CACHE_TTL if entry.get("d") is not None else MISSING_TTL
        if time.time() - entry.get("t", 0) > ttl:
            return None
        return entry

    # ---------- http ----------

    async def _http_get(self, url):
        """Returns (status, body). aiohttp on the Deck, urllib fallback locally."""
        if aiohttp is not None:
            async with aiohttp.ClientSession(
                headers={"User-Agent": USER_AGENT}
            ) as session:
                async with session.get(
                    url, timeout=aiohttp.ClientTimeout(total=30), ssl=SSL_CTX
                ) as resp:
                    return resp.status, await resp.text()

        def blocking():
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            try:
                with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
                    return resp.status, resp.read().decode("utf-8")
            except urllib.error.HTTPError as err:
                return err.code, err.read().decode("utf-8", "replace")

        return await asyncio.to_thread(blocking)

    async def _fetch_batch(self, appids):
        """One API call (<=100 ids) with 429 backoff. Returns {appid: raw|None}."""
        query = urllib.parse.urlencode({"appids": ",".join(map(str, appids))})
        url = f"{API_BASE}/games/steam?{query}"
        for attempt, delay in enumerate((0,) + RETRY_DELAYS):
            if delay:
                await asyncio.sleep(delay)
            try:
                status, body = await self._http_get(url)
            except Exception as exc:
                self.log.warning("prystanok request failed (attempt %d): %s", attempt, exc)
                continue
            if status == 200:
                payload = json.loads(body)
                result = {appid: None for appid in appids}
                for key, model in payload.items():
                    result[int(key)] = model
                return result
            if status == 429:
                self.log.info("prystanok rate limited, retrying")
                continue
            self.log.warning("prystanok HTTP %d: %.200s", status, body)
            break
        return None  # network/API failure: do not cache, let stale data survive

    # ---------- public ----------

    async def get_games(self, appids):
        """Raw AggregatedGameModel per appid, cache-first. The lock serializes
        fetches so a library-grid burst coalesces into sequential batches
        instead of hammering the API."""
        appids = list(dict.fromkeys(int(a) for a in appids))
        result = {}
        missing = []
        for appid in appids:
            entry = self._fresh(appid)
            if entry is not None:
                result[appid] = entry["d"]
            else:
                missing.append(appid)

        if missing:
            async with self._fetch_lock:
                # another waiter may have fetched our ids while we were queued
                still_missing = [a for a in missing if self._fresh(a) is None]
                now = time.time()
                fetched_any = False
                for i in range(0, len(still_missing), BATCH_LIMIT):
                    batch = still_missing[i : i + BATCH_LIMIT]
                    batch_result = await self._fetch_batch(batch)
                    if batch_result is None:
                        continue
                    for appid, model in batch_result.items():
                        self._cache[appid] = {"t": now, "d": model}
                    fetched_any = True
                if fetched_any:
                    self._save_disk_cache()
            for appid in missing:
                entry = self._cache.get(appid)
                result[appid] = entry["d"] if entry else None

        return result

    async def get_statuses(self, appids):
        raw = await self.get_games(appids)
        return {str(appid): normalize(appid, model) for appid, model in raw.items()}

    async def get_details(self, appid):
        raw = await self.get_games([appid])
        return details(int(appid), raw.get(int(appid)))
