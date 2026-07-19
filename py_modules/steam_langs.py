"""Official localization from Steam's local appinfo cache.

Parses Steam's binary ``appcache/appinfo.vdf`` for each app's
``common/supported_languages`` — offline, no rate limit, complements the
Prystanok API. Re-parsed on mtime change; fail-soft (errors → empty map).

Formats v27/v28/v29. v29 (2024+) interns binary-KV keys into a string table at
the end of the file (offset in header); earlier versions store keys inline.
Per-app layout after the appid::

    size(u32) infoState(u32) lastUpdated(u32) picsToken(u64)
    textSha1(20) changeNumber(u32) [binarySha1(20) — v28+] <binary-KV blob>
"""

import logging
import os
import struct
import time

logger = logging.getLogger("decky-prystanok.steam_langs")

MAGIC_V27 = 0x07564427
MAGIC_V28 = 0x07564428
MAGIC_V29 = 0x07564429

# binary KeyValues node types
T_NESTED = 0x00
T_STRING = 0x01
T_INT32 = 0x02
T_FLOAT32 = 0x03
T_POINTER = 0x04
T_WIDESTRING = 0x05
T_COLOR = 0x06
T_UINT64 = 0x07
T_END = 0x08
T_INT64 = 0x0A

# locale code → key Steam uses inside common/supported_languages, incl. the
# regional variants keyed separately (brazilian, latam, tchinese).
# keep in sync with src/lib/steamLang.ts
LANG_KEYS = {
    "uk": "ukrainian",
    "en": "english",
    "de": "german",
    "fr": "french",
    "it": "italian",
    "es": "spanish",
    "es-419": "latam",
    "pt": "portuguese",
    "pt-br": "brazilian",
    "pl": "polish",
    "cs": "czech",
    "ru": "russian",
    "nl": "dutch",
    "da": "danish",
    "fi": "finnish",
    "no": "norwegian",
    "sv": "swedish",
    "tr": "turkish",
    "hu": "hungarian",
    "ro": "romanian",
    "bg": "bulgarian",
    "el": "greek",
    "ja": "japanese",
    "ko": "koreana",
    "zh": "schinese",
    "zh-tw": "tchinese",
    "th": "thai",
    "vi": "vietnamese",
    "id": "indonesian",
}


def candidate_paths():
    """appinfo.vdf locations, most-likely first (Deck, native, flatpak)."""
    home = os.path.expanduser("~")
    return [
        os.path.join(home, ".local/share/Steam/appcache/appinfo.vdf"),
        os.path.join(home, ".steam/steam/appcache/appinfo.vdf"),
        os.path.join(home, ".steam/root/appcache/appinfo.vdf"),
        os.path.join(
            home, ".var/app/com.valvesoftware.Steam/.local/share/Steam/appcache/appinfo.vdf"
        ),
    ]


def resolve_appinfo_path():
    for p in candidate_paths():
        if os.path.isfile(p):
            return p
    return None


def _read_cstr(data, pos):
    end = data.index(b"\x00", pos)
    return data[pos:end].decode("utf-8", "replace"), end + 1


def _read_widestr(data, pos):
    end = pos
    while data[end] != 0 or data[end + 1] != 0:
        end += 2
    return data[pos:end].decode("utf-16-le", "replace"), end + 2


def _parse_kv(data, pos, end, strings, v29):
    """Parse one binary-KV object → (dict, new_pos). Bounded by ``end``."""
    out = {}
    while pos < end:
        node = data[pos]
        pos += 1
        if node == T_END:
            return out, pos
        if v29:
            (idx,) = struct.unpack_from("<I", data, pos)
            pos += 4
            key = strings[idx]
        else:
            key, pos = _read_cstr(data, pos)
        if node == T_NESTED:
            val, pos = _parse_kv(data, pos, end, strings, v29)
        elif node == T_STRING:
            val, pos = _read_cstr(data, pos)
        elif node == T_WIDESTRING:
            val, pos = _read_widestr(data, pos)
        elif node in (T_INT32, T_FLOAT32, T_POINTER, T_COLOR):
            (val,) = struct.unpack_from("<i", data, pos)
            pos += 4
        elif node in (T_UINT64, T_INT64):
            (val,) = struct.unpack_from("<q", data, pos)
            pos += 8
        else:
            raise ValueError(f"unknown KV node type {node:#x}")
        out[key] = val
    return out, pos


def _find_key(tree, target):
    """First value under ``target`` anywhere in the tree (DFS)."""
    if not isinstance(tree, dict):
        return None
    if target in tree:
        return tree[target]
    for v in tree.values():
        if isinstance(v, dict):
            found = _find_key(v, target)
            if found is not None:
                return found
    return None


def _lang_flags(tree, lang_key):
    sl = _find_key(tree, "supported_languages")
    if not isinstance(sl, dict):
        return None
    entry = sl.get(lang_key)
    if not isinstance(entry, dict):
        return None

    def flag(name):
        # stored as strings: "true"/"false" (v29) or "1"/"0"
        return str(entry.get(name, "")).strip().lower() in ("1", "true", "yes")

    return {
        "supported": flag("supported"),
        "full_audio": flag("full_audio"),
        "subtitles": flag("subtitles"),
    }


def parse_appinfo(path, lang_key="ukrainian"):
    """Parse appinfo.vdf → {appid: {supported, full_audio, subtitles}} for one language.

    Only apps declaring ``lang_key`` are included. Per-app parse errors are
    skipped (advance by declared size), never raised.
    """
    with open(path, "rb") as f:
        data = f.read()

    magic, _universe = struct.unpack_from("<II", data, 0)
    if magic not in (MAGIC_V27, MAGIC_V28, MAGIC_V29):
        raise ValueError(f"unsupported appinfo magic {magic:#x}")
    v29 = magic == MAGIC_V29
    v28plus = magic in (MAGIC_V28, MAGIC_V29)

    strings = []
    if v29:
        (st_off,) = struct.unpack_from("<q", data, 8)
        pos = 16
        (count,) = struct.unpack_from("<I", data, st_off)
        sp = st_off + 4
        for _ in range(count):
            s, sp = _read_cstr(data, sp)
            strings.append(s)
    else:
        pos = 8

    fixed = 60 if v28plus else 40  # bytes between size and KV blob
    out = {}
    limit = len(data)
    while pos + 8 <= limit:
        (appid,) = struct.unpack_from("<I", data, pos)
        pos += 4
        if appid == 0:
            break
        (size,) = struct.unpack_from("<I", data, pos)
        pos += 4
        blob_end = pos + size
        try:
            tree, _ = _parse_kv(data, pos + fixed, blob_end, strings, v29)
            flags = _lang_flags(tree, lang_key)
            if flags is not None:
                out[appid] = flags
        except Exception:  # noqa: BLE001 — fail-soft per app
            pass
        pos = blob_end
    return out


# --- cached accessor -------------------------------------------------------

_cache = {"path": None, "mtime": None, "lang": None, "map": {}}


def _refresh(lang_key):
    path = resolve_appinfo_path()
    if not path:
        _cache.update(path=None, mtime=None, lang=lang_key, map={})
        return
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return
    if path == _cache["path"] and mtime == _cache["mtime"] and lang_key == _cache["lang"]:
        return
    try:
        t0 = time.perf_counter()
        m = parse_appinfo(path, lang_key)
        dt = time.perf_counter() - t0
        _cache.update(path=path, mtime=mtime, lang=lang_key, map=m)
        size_mb = os.path.getsize(path) / 1e6
        logger.info("parsed %d '%s' apps from %.1fMB appinfo in %.0fms", len(m), lang_key, size_mb, dt * 1000)
    except Exception as e:  # noqa: BLE001
        logger.warning("appinfo parse failed (%s); Steam loc unavailable", e)
        _cache.update(path=path, mtime=mtime, lang=lang_key, map={})


def get_steam_loc(appids, lang="uk"):
    """Official localization per appid for ``lang``, from Steam's local cache.

    Returns ``{appid: {official: True, text, audio, subtitles}}`` only for apps
    that declare support for that language; unknown language codes yield {}.
    """
    lang_key = LANG_KEYS.get(lang)
    if not lang_key:
        return {}
    _refresh(lang_key)
    m = _cache["map"]
    result = {}
    for a in appids:
        flags = m.get(int(a))
        if not flags:
            continue
        audio = flags["full_audio"]
        text = flags["supported"] or flags["subtitles"]
        if not (audio or text):
            continue
        result[int(a)] = {
            "official": True,
            "text": text,
            "audio": audio,
            "subtitles": flags["subtitles"],
        }
    return result


if __name__ == "__main__":  # quick on-device check
    p = resolve_appinfo_path()
    print("path:", p)
    if p:
        m = parse_appinfo(p)
        print("UA-localized apps:", len(m))
        for appid in list(m)[:8]:
            print(" ", appid, m[appid])
