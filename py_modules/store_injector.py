"""Inject Prystanok badges into the Steam web store (store.steampowered.com).

The store is a real web page in its OWN CEF tab, unreachable from the gamepad-UI
React context decky plugins normally patch. So (CSS-Loader style) we drive the
CEF debugger from the backend: find store tabs, collect capsule + app-page
appids, fetch statuses, inject via Runtime.evaluate (which bypasses page CSP) —
a corner badge per capsule card, a big fixed badge for the current app page.
"""

import asyncio
import json
import logging
import re

try:
    import aiohttp
except ImportError:  # local dev
    aiohttp = None

CDP_HTTP = "http://localhost:8080"
POLL_SECONDS = 3
BADGE_ID = "prystanok-store-badge"
CARD_ATTR = "data-prystanok-card"
STORE_HOST = "store.steampowered.com"
STORE_APP_RE = re.compile(r"store\.steampowered\.com/app/(\d+)")

# keep in sync with src/lib/badgeTokens.ts
CRIT = "#e5484d"
CRIT_INK = "#3a0a0b"
WARN = "#f5a623"
WARN_INK = "#3a2600"
UA_BLUE = "#1d61c4"
UA_YELLOW = "#ffd23f"
FLAG_GRADIENT = "linear-gradient(#1d61c4 50%, #ffd23f 50%)"
SCRIM = "rgba(12,15,20,.62)"
LOC_INK = "#eaf2ff"
LOCU_INK = "#bcd6ff"
LOC_BORDER = "1px solid #1d61c4"
LOCU_BORDER = "1px dashed #4f86d6"
LANG_LOC_BG = "#2d6cdf"   # non-Ukrainian target (Steam official only)
LANG_LOC_INK = "#eaf2ff"
OK_GREEN = "#4ade80"      # "your (non-UA) language is present" check
ALERT = "⚠️"    # leading alert on the russian chip
CHECK = "✓"          # leading check on a non-UA loc chip
BADGE_BORDER = "1px solid rgba(0,0,0,.35)"
BADGE_SHADOW = "0 1px 5px rgba(0,0,0,.45)"

# threat icons (FA5 solid), mirror of src/lib/iconPaths.ts. capsule chips draw
# them icon-only; the app-page badge draws icon + text.
ICON = {
    "hand": {"vb": "0 0 448 512", "path": "M408.781 128.007C386.356 127.578 368 146.36 368 168.79V256h-8V79.79c0-22.43-18.356-41.212-40.781-40.783C297.488 39.423 280 57.169 280 79v177h-8V40.79C272 18.36 253.644-.422 231.219.007 209.488.423 192 18.169 192 40v216h-8V80.79c0-22.43-18.356-41.212-40.781-40.783C121.488 40.423 104 58.169 104 80v235.992l-31.648-43.519c-12.993-17.866-38.009-21.817-55.877-8.823-17.865 12.994-21.815 38.01-8.822 55.877l125.601 172.705A48 48 0 0 0 172.073 512h197.59c22.274 0 41.622-15.324 46.724-37.006l26.508-112.66a192.011 192.011 0 0 0 5.104-43.975V168c.001-21.831-17.487-39.577-39.218-39.993z"},
    "triangle": {"vb": "0 0 576 512", "path": "M569.517 440.013C587.975 472.007 564.806 512 527.94 512H48.054c-36.937 0-59.999-40.055-41.577-71.987L246.423 23.985c18.467-32.009 64.72-31.951 83.154 0l239.94 416.028zM288 354c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z"},
    "shield": {"vb": "0 0 512 512", "path": "M466.5 83.7l-192-80a48.15 48.15 0 0 0-36.9 0l-192 80C27.7 91.1 16 108.6 16 128c0 198.5 114.5 335.7 221.5 380.3 11.8 4.9 25.1 4.9 36.9 0C360.1 472.6 496 349.3 496 128c0-19.4-11.7-36.9-29.5-44.3zM256.1 446.3l-.1-381 175.9 73.3c-3.3 151.4-82.1 261.1-175.8 307.7z"},
    "cc": {"vb": "0 0 512 512", "path": "M464 64H48C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM218.1 287.7c2.8-2.5 7.1-2.1 9.2.9l19.5 27.7c1.7 2.4 1.5 5.6-.5 7.7-53.6 56.8-172.8 32.1-172.8-67.9 0-97.3 121.7-119.5 172.5-70.1 2.1 2 2.5 3.2 1 5.7l-17.5 30.5c-1.9 3.1-6.2 4-9.1 1.7-40.8-32-94.6-14.9-94.6 31.2.1 48 51.1 70.5 92.3 32.6zm190.4 0c2.8-2.5 7.1-2.1 9.2.9l19.5 27.7c1.7 2.4 1.5 5.6-.5 7.7-53.5 56.9-172.7 32.1-172.7-67.9 0-97.3 121.7-119.5 172.5-70.1 2.1 2 2.5 3.2 1 5.7L420 222.2c-1.9 3.1-6.2 4-9.1 1.7-40.8-32-94.6-14.9-94.6 31.2 0 48 51 70.5 92.2 32.6z"},
    "speaker": {"vb": "0 0 576 512", "path": "M215.03 71.05L126.06 160H24c-13.26 0-24 10.74-24 24v144c0 13.25 10.74 24 24 24h102.06l88.97 88.95c15.03 15.03 40.97 4.47 40.97-16.97V88.02c0-21.46-25.96-31.98-40.97-16.97zm233.32-51.08c-11.17-7.33-26.18-4.24-33.51 6.95-7.34 11.17-4.22 26.18 6.95 33.51 66.27 43.49 105.82 116.6 105.82 195.58 0 78.98-39.55 152.09-105.82 195.58-11.17 7.32-14.29 22.34-6.95 33.5 7.04 10.71 21.93 14.56 33.51 6.95C528.27 439.58 576 351.33 576 256S528.27 72.43 448.35 19.97zM480 256c0-63.53-32.06-121.94-85.77-156.24-11.19-7.14-26.03-3.82-33.12 7.46s-3.78 26.21 7.41 33.36C408.27 165.97 432 209.11 432 256s-23.73 90.03-63.48 115.42c-11.19 7.14-14.5 22.07-7.41 33.36 6.51 10.36 21.12 15.14 33.12 7.46C447.94 377.94 480 319.54 480 256zm-141.77-76.87c-11.58-6.33-26.19-2.16-32.61 9.45-6.39 11.61-2.16 26.2 9.45 32.61C327.98 228.28 336 241.63 336 256c0 14.38-8.02 27.72-20.92 34.81-11.61 6.41-15.84 21-9.45 32.61 6.43 11.66 21.05 15.8 32.61 9.45 28.23-15.55 45.77-45 45.77-76.88s-17.54-61.32-45.78-76.86z"},
}


def _loc_type_icons(loc):
    """CC for text, + speaker for audio."""
    return [ICON["cc"], ICON["speaker"]] if loc == "audio" else [ICON["cc"]]

# back-compat aliases (tests / older refs)
RED = CRIT
ORANGE = WARN
GOLD = "#ffd700"

# chip label translations, mirror of the chip/badge/loc keys in src/lib/i18n.ts.
# uk is the source; en for a non-Ukrainian Steam UI
_STR = {
    "russian": {"uk": "російська гра", "en": "Russian game"},
    "suspect": {"uk": "ймовірно сумнівна гра", "en": "likely questionable game"},
    "suspect_short": {"uk": "сумнівна", "en": "questionable"},
    "vendor": {"uk": "видавець видавав рос. ігри", "en": "publisher released Russian games"},
    "vendor_short": {"uk": "видавець", "en": "publisher"},
    "ukGame": {"uk": "українська гра", "en": "Ukrainian game"},
    "ukGame_short": {"uk": "УКР гра", "en": "UA game"},
    "rf": {"uk": "рф", "en": "RU"},
    "text": {"uk": "текст", "en": "text"},
    "audio": {"uk": "текст + озвучення", "en": "text + voice"},
    "uaPrefix": {"uk": "УКР", "en": "UA"},
    "fanPrefix": {"uk": "Українізатор", "en": "Fan UA"},
    "semiPrefix": {"uk": "Напівофіційна", "en": "Semi-official"},
}

# app types we don't badge (soundtracks, trailers, hardware, …), mirror of
# src/lib/appType.ts. games/DLC/demo/mod/beta (+ unknown) are badged
NON_BADGEABLE_TYPES = {
    "Music", "Video", "Movie", "Series", "Episode",
    "Hardware", "Tool", "Software", "Guide", "Advertising",
}


def _badgeable(status):
    t = (status or {}).get("appType")
    return not t or t not in NON_BADGEABLE_TYPES


def _t(key, lang):
    e = _STR.get(key, {})
    return e.get(lang) or e.get("uk") or key

logger = logging.getLogger("decky-prystanok.store")


def store_chips(status, surface_on=True, show_loc=True, ui_lang="uk"):
    """Detailed chips for the big top-of-page app badge.

    russian game is the one mandatory chip (shown even with the surface off).
    ``surface_on`` gates the softer warnings; ``show_loc`` also gates the loc
    chip. ``ui_lang`` picks the label language (uk / en)."""
    if not status or not status.get("found") or not _badgeable(status):
        return []
    level = status.get("threatLevel")
    if level == "russian":
        return [{"label": _t("russian", ui_lang), "bg": CRIT, "color": CRIT_INK, "border": BADGE_BORDER, "icon": ICON["hand"]}]

    if not surface_on:
        return []  # only the russian badge survives

    chips = []
    # warning on top, loc below
    if level == "suspect":
        chips.append({"label": _t("suspect", ui_lang), "bg": CRIT, "color": CRIT_INK, "border": BADGE_BORDER, "icon": ICON["triangle"]})
    elif level == "vendor":
        chips.append({"label": _t("vendor", ui_lang), "bg": WARN, "color": WARN_INK, "border": BADGE_BORDER, "icon": ICON["shield"]})
    elif status.get("russianLinks"):
        chips.append({"label": _t("suspect", ui_lang), "bg": WARN, "color": WARN_INK, "border": BADGE_BORDER, "icon": ICON["triangle"]})

    if not show_loc:
        return chips  # loc toggle off → threat only

    lang = status.get("locLang") or "uk"
    loc = status.get("loc")
    if loc in ("audio", "text"):
        # prefix word + type icons (CC / speaker) instead of type words
        icons = _loc_type_icons(loc)
        if lang != "uk":
            chips.append({"label": lang.upper(), "bg": LANG_LOC_BG,
                          "color": LANG_LOC_INK, "border": BADGE_BORDER, "lead": CHECK, "leadColor": OK_GREEN, "icons": icons})
        elif status.get("semiOfficial"):
            chips.append({"label": _t('semiPrefix', ui_lang), "bg": SCRIM,
                          "color": LOC_INK, "border": LOC_BORDER, "flag": True, "icons": icons})
        elif status.get("official") is False:
            chips.append({"label": _t('fanPrefix', ui_lang), "bg": SCRIM,
                          "color": LOCU_INK, "border": LOCU_BORDER, "icons": icons})
        else:
            chips.append({"label": _t('uaPrefix', ui_lang), "bg": SCRIM,
                          "color": LOC_INK, "border": LOC_BORDER, "flag": True, "icons": icons})
    elif status.get("ukrainian"):
        chips.append({"label": _t("ukGame", ui_lang), "bg": SCRIM, "color": LOC_INK,
                      "border": LOC_BORDER, "flag": True})
    return chips


def store_card_chips(status, surface_on=True, show_loc=True, ui_lang="uk"):
    """Compact chips for capsule cards in lists (like the gamepad grid chips).

    Same gating as store_chips: russian is mandatory, surface_on gates warnings,
    show_loc also gates the loc chip; ui_lang picks the label language."""
    if not status or not status.get("found") or not _badgeable(status):
        return []
    level = status.get("threatLevel")
    # icon-only threats — text is too noisy over cover art
    if level == "russian":
        return [{"icon": ICON["hand"], "bg": CRIT, "color": CRIT_INK, "border": BADGE_BORDER}]

    if not surface_on:
        return []  # only the russian badge survives

    chips = []
    if level == "suspect":
        chips.append({"icon": ICON["triangle"], "bg": CRIT, "color": CRIT_INK, "border": BADGE_BORDER})
    elif level == "vendor":
        chips.append({"icon": ICON["shield"], "bg": WARN, "color": WARN_INK, "border": BADGE_BORDER})
    elif status.get("russianLinks"):
        chips.append({"icon": ICON["triangle"], "bg": WARN, "color": WARN_INK, "border": BADGE_BORDER})

    if not show_loc:
        return chips  # loc toggle off → threat only

    lang = status.get("locLang") or "uk"
    loc = status.get("loc")
    if loc in ("audio", "text"):
        # fan → dashed border; semi shows as official on the tiny capsule (detail in modal)
        icons = _loc_type_icons(loc)
        if lang != "uk":
            chips.append({"text": lang.upper(), "bg": LANG_LOC_BG, "color": LANG_LOC_INK,
                          "border": BADGE_BORDER, "lead": CHECK, "leadColor": OK_GREEN, "icons": icons})
        elif status.get("official") is False:
            chips.append({"bg": SCRIM, "color": LOCU_INK, "border": LOCU_BORDER, "flag": True, "icons": icons})
        else:
            chips.append({"bg": SCRIM, "color": LOC_INK, "border": LOC_BORDER, "flag": True, "icons": icons})
    elif status.get("ukrainian"):
        chips.append({"bg": SCRIM, "color": LOC_INK, "border": LOC_BORDER, "flag": True})
    return chips


def store_modal_data(details, appid, ui_lang="uk"):
    """Payload for the in-page modal opened by tapping the store badge."""
    if not details or not details.get("found"):
        return None
    vendors = []
    for v in details.get("vendors") or []:
        rus = (v.get("RussianGamesPublished") or 0) + (v.get("RussianGamesDeveloped") or 0)
        if rus <= 0:
            continue
        total = (v.get("TotalGamesPublished") or 0) + (v.get("TotalGamesDeveloped") or 0)
        share = rus / total if total else 1.0
        vendors.append({"name": v.get("Name"), "rus": rus, "total": total,
                        "pct": round(share * 100), "majority": share > 0.5})
    vendors.sort(key=lambda x: -x["pct"])
    reviews = []
    for r in (details.get("curatorReviews") or [])[:2]:
        reviews.append({"name": r.get("CuratorName"), "type": r.get("ReviewType"),
                        "text": (r.get("Review") or "")[:240]})
    return {
        "appid": appid,
        "name": details.get("name"),
        "chips": store_chips(details, True, True, ui_lang),
        "developers": details.get("developers") or [],
        "publishers": details.get("publishers") or [],
        "russianLinks": details.get("russianLinks") or [],
        "vendors": vendors,
        "reviews": reviews,
        "kuliUrl": details.get("kuliUrl"),
        "bloodyPrice": details.get("bloodyPrice"),
    }


# in-page modal builder — store is a web tab, no Steam gamepad modal here.
# header (title + chips) · body (info + russian-trace block + reviews) · footer (links).
# sticky header/footer, scrollable body, content-sized.
_MODAL_FN_JS = (
    "  window.__prystanokModal = function(d){"
    "    const E=function(tag,style,text){ const e=document.createElement(tag); if(style) Object.assign(e.style,style); if(text!=null) e.textContent=text; return e; };"
    "    const old=document.getElementById('prystanok-modal'); if(old) old.remove();"
    "    const ov=E('div',{position:'fixed',left:'0',top:'0',right:'0',bottom:'0',zIndex:'100000',background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}); ov.id='prystanok-modal';"
    "    ov.onclick=function(e){ if(e.target===ov) ov.remove(); };"
    "    const card=E('div',{display:'flex',flexDirection:'column',width:'fit-content',minWidth:'320px',maxWidth:'min(480px, 92vw)',maxHeight:'88%',background:'#1b2838',color:'#c7d5e0',borderRadius:'12px',overflow:'hidden',boxShadow:'0 10px 40px rgba(0,0,0,.6)',fontFamily:'\"Motiva Sans\",Arial,sans-serif'});"
    # header
    "    const head=E('div',{padding:'20px 20px 16px',borderBottom:'1px solid rgba(255,255,255,.08)'});"
    "    head.appendChild(E('div',{fontSize:'18px',fontWeight:'700',color:'#fff',lineHeight:'1.25'}, d.name||''));"
    "    if(d.chips&&d.chips.length){ const row=E('div',{display:'flex',flexWrap:'wrap',gap:'6px',marginTop:'12px'});"
    "      for(const c of d.chips){ const s=E('span',{padding:'3px 9px',borderRadius:'6px',fontSize:'13px',fontWeight:'700',background:c.bg,color:c.color}, c.label); if(c.border) s.style.border=c.border; row.appendChild(s); } head.appendChild(row); }"
    "    card.appendChild(head);"
    # body
    "    const body=E('div',{padding:'14px 20px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'12px'});"
    "    function divider(sec){ if(body.children.length){ sec.style.borderTop='1px solid rgba(255,255,255,.07)'; sec.style.paddingTop='12px'; } return sec; }"
    "    function kv(label,val){ const r=E('div',{display:'flex',gap:'10px',fontSize:'14px',lineHeight:'1.35'}); r.appendChild(E('div',{color:'#8f98a0',flex:'0 0 92px'}, label)); r.appendChild(E('div',{flex:'1',color:'#dfe7ee'}, val)); return r; }"
    "    function heading(t){ return E('div',{fontSize:'11px',fontWeight:'700',letterSpacing:'.5px',textTransform:'uppercase',color:'#6f7c87'}, t); }"
    "    const info=E('div',{display:'flex',flexDirection:'column',gap:'6px'});"
    "    if(d.developers&&d.developers.length) info.appendChild(kv('Розробники', d.developers.join(', ')));"
    "    if(d.publishers&&d.publishers.length) info.appendChild(kv('Видавці', d.publishers.join(', ')));"
    "    if(d.bloodyPrice) info.appendChild(kv('\\u26a0\\ufe0f В рф', d.bloodyPrice));"
    "    if(info.children.length) body.appendChild(info);"
    "    function trace(emoji,text){ const r=E('div',{display:'flex',gap:'8px',fontSize:'14px',lineHeight:'1.4'});"
    "      r.appendChild(E('span',{flex:'0 0 auto'}, emoji)); r.appendChild(E('span',{flex:'1',color:'#dfe7ee'}, text)); return r; }"
    "    const hasTrace=(d.russianLinks&&d.russianLinks.length)||(d.vendors&&d.vendors.length);"
    "    if(hasTrace){ const sec=divider(E('div',{display:'flex',flexDirection:'column',gap:'6px'})); sec.appendChild(heading('Російський слід'));"
    "      for(const v of (d.vendors||[])) sec.appendChild(trace(v.majority?'\\ud83d\\udd34':'\\ud83d\\udfe0', v.name+' — рос. ігор '+v.rus+'/'+v.total+' ('+v.pct+'%)'));"
    "      if(d.russianLinks&&d.russianLinks.length) sec.appendChild(trace('\\ud83d\\udfe0', 'Посилання: '+d.russianLinks.join(', ')));"
    "      body.appendChild(sec); }"
    "    if(d.reviews&&d.reviews.length){ const sec=divider(E('div',{display:'flex',flexDirection:'column',gap:'8px'})); sec.appendChild(heading('Рецензії кураторів'));"
    "      for(const r of d.reviews){ const em=r.type==='Recommended'?'\\ud83d\\udc4d':(r.type==='NotRecommended'?'\\ud83d\\udc4e':'\\u2139\\ufe0f');"
    "        const it=E('div',{fontSize:'13px',lineHeight:'1.4'}); it.appendChild(E('div',{color:'#8f98a0',marginBottom:'2px'}, em+' '+r.name)); it.appendChild(document.createTextNode(r.text)); sec.appendChild(it); }"
    "      body.appendChild(sec); }"
    "    card.appendChild(body);"
    # footer
    "    const foot=E('div',{padding:'12px 18px',borderTop:'1px solid rgba(255,255,255,.08)',display:'flex',gap:'8px',flexWrap:'wrap',justifyContent:'flex-end'});"
    "    function btn(text,primary,fn){ const x=E('button',{padding:'8px 14px',borderRadius:'6px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:'700',background:primary?'#3a6e8f':'#2a3f50',color:'#fff'}, text); x.onclick=fn; return x; }"
    "    if(d.kuliUrl) foot.appendChild(btn('\\ud83c\\udf10 КУЛІ', false, function(){ window.open(d.kuliUrl,'_blank'); }));"
    "    if(d.appid) foot.appendChild(btn('\\ud83c\\udf10 Пристанок', true, function(){ window.open('https://prystanok.com.ua/game-check?steamappid='+d.appid,'_blank'); }));"
    "    foot.appendChild(btn('Закрити', false, function(){ ov.remove(); }));"
    "    card.appendChild(foot); ov.appendChild(card); document.body.appendChild(ov);"
    "  };"
)


# collect capsule appids. detect by bounding-box size, NOT an <img> child:
# featured/hero capsules render art via background-image. must match the size
# gate in _apply_js, or a capsule we'd badge never gets its status fetched.
COLLECT_JS = (
    "(() => {"
    "  const s = new Set();"
    "  for (const a of document.querySelectorAll('a[href*=\"/app/\"]')) {"
    "    const rc = a.getBoundingClientRect();"
    "    if (rc.width < 120 || rc.height < 45) continue;"
    "    const m = (a.getAttribute('href') || '').match(/\\/app\\/(\\d+)/);"
    "    if (m) s.add(parseInt(m[1]));"
    "    if (s.size >= 100) break;"
    "  }"
    "  return Array.from(s);"
    "})()"
)


def _top_badge_style(cfg):
    """Anchor the fixed app-page badge from {position, offsetX, offsetY}."""
    cfg = cfg or {}
    pos = cfg.get("position", "top-center")
    ox = cfg.get("offsetX", 0)
    oy = cfg.get("offsetY", 54)
    v, h = pos.split("-")
    st = {"position": "fixed", "zIndex": "99999"}
    st["top" if v == "top" else "bottom"] = f"{oy}px"
    if h == "left":
        st["left"] = f"{ox}px"
    elif h == "right":
        st["right"] = f"{ox}px"
    else:
        st["left"] = "50%"
        st["transform"] = f"translateX(calc(-50% + {ox}px))"
    return st


def _apply_js(card_map, app_chips, app_appid, modal_data=None, store_cfg=None):
    # per-property CSSOM styles pass a strict style-src CSP; a style="" string
    # wouldn't. idempotent: cards keyed by the appid drawn, so recycled list
    # nodes refresh correctly.
    cm = json.dumps(card_map, ensure_ascii=False)
    ac = json.dumps(app_chips, ensure_ascii=False)
    aid = json.dumps(str(app_appid) if app_appid else None)
    md = json.dumps(modal_data, ensure_ascii=False)
    pos = json.dumps(_top_badge_style(store_cfg))
    scale = (store_cfg or {}).get("size", 32) / 32
    return (
        "(() => {"
        f"  const CARDS = {cm}; const APPCHIPS = {ac}; const APPID = {aid}; const MODAL = {md};"
        f"  const POS = {pos}; const SCALE = {scale};"
        f"  const PAGE_ID = {json.dumps(BADGE_ID)}; const CARD_ATTR = {json.dumps(CARD_ATTR)};"
        f"  const SHADOW = {json.dumps(BADGE_SHADOW)}; const FLAG_BG = {json.dumps(FLAG_GRADIENT)};"
        "  const FLAG = function(){ const f=document.createElement('span');"
        "    f.style.width='.78em'; f.style.height='.78em'; f.style.borderRadius='2px'; f.style.flexShrink='0';"
        "    f.style.background=FLAG_BG; f.style.boxShadow='0 0 0 1px rgba(0,0,0,.3)'; return f; };"
        "  const NS='http://www.w3.org/2000/svg';"
        "  const ICONSVG = function(ic, px){ const sv=document.createElementNS(NS,'svg');"
        "    sv.setAttribute('viewBox', ic.vb); sv.setAttribute('width', px); sv.setAttribute('height', px);"
        "    sv.setAttribute('fill','currentColor'); sv.style.display='block'; sv.style.flexShrink='0';"
        "    const pa=document.createElementNS(NS,'path'); pa.setAttribute('d', ic.path); sv.appendChild(pa); return sv; };"
        + _MODAL_FN_JS +
        # --- per-card corner badges in lists ---
        "  for (const a of document.querySelectorAll('a[href*=\"/app/\"]')) {"
        # size gate (not <img>): drops text links / breadcrumbs, keeps capsules
        # whose art is a background-image or a lazy <img>
        "    const rc = a.getBoundingClientRect();"
        "    if (rc.width < 120 || rc.height < 45) continue;"
        "    const m = (a.getAttribute('href') || '').match(/\\/app\\/(\\d+)/); if (!m) continue;"
        "    const id = m[1]; const chips = CARDS[id];"
        # featured/hero capsules: the anchor is a full-cover overlay (z:1) inside
        # an overflow:hidden box; on focus a hover overlay (z:3) paints as a
        # SIBLING over our badge, and the box clips anything spilling past its top.
        # so when the anchor spills or fully covers the box, hang the badge on the
        # box instead. a normal capsule in a wider row differs in width → host
        # stays the anchor.
        "    let host = a;"
        "    for (let anc = a.parentElement, i = 0; anc && i < 6 && anc !== document.body; anc = anc.parentElement, i++) {"
        "      const oc = getComputedStyle(anc);"
        "      if (oc.overflow.indexOf('hidden') >= 0 || oc.overflowY.indexOf('hidden') >= 0) {"
        "        const ar = a.getBoundingClientRect(), pr = anc.getBoundingClientRect();"
        "        const spill = ar.top < pr.top - 1 || ar.bottom > pr.bottom + 1;"
        "        const cover = ar.top <= pr.top + 1 && ar.bottom >= pr.bottom - 1 && ar.left <= pr.left + 1 && ar.right >= pr.right - 1;"
        "        if (spill || cover) host = anc;"
        "        break;"
        "      }"
        "    }"
        "    const cur = host.querySelector('[' + CARD_ATTR + ']');"
        "    if (!chips || !chips.length) { if (cur) cur.remove(); continue; }"
        "    if (cur && cur.getAttribute(CARD_ATTR) === id) continue;"
        "    if (cur) cur.remove();"
        "    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';"
        # anchor to the image's bottom-left, not the whole capsule: the info bar
        # sits in a strip below the image and the compat badge sits top-right, so
        # the image's bottom-left is clean on every capsule type. fall back to the
        # host's bottom-left if no media found.
        "    const hr = host.getBoundingClientRect();"
        # art = largest media (img/video/background-image) hugging the capsule TOP
        # and shorter than the full capsule (avoid a full-height background). its
        # bottom edge is the art/info boundary.
        "    let media = null, ma = 0;"
        "    host.querySelectorAll('*').forEach(function(e){"
        "      if (e.hasAttribute(CARD_ATTR) || e.closest('[' + CARD_ATTR + ']')) return;"
        "      const r = e.getBoundingClientRect();"
        "      if (r.width < 80 || r.height < 50) return;"
        "      if ((r.top - hr.top) > 12 || r.height > hr.height * 0.92) return;"
        "      const cs = getComputedStyle(e);"
        "      const isMedia = e.tagName === 'IMG' || e.tagName === 'VIDEO' || cs.backgroundImage.indexOf('url(') >= 0;"
        "      const A = r.width * r.height;"
        "      if (isMedia && A > ma) { ma = A; media = r; }"
        "    });"
        "    let bottomPx = 4, leftPx = 4;"
        "    if (media) { bottomPx = Math.max(4, Math.round(hr.bottom - media.bottom) + 4); leftPx = Math.max(4, Math.round(media.left - hr.left) + 4); }"
        "    const box = document.createElement('div'); box.setAttribute(CARD_ATTR, id);"
        "    box.style.position = 'absolute'; box.style.bottom = bottomPx + 'px'; box.style.left = leftPx + 'px';"
        "    box.style.zIndex = '100'; box.style.display = 'flex'; box.style.flexDirection = 'column';"
        "    box.style.gap = '3px'; box.style.alignItems = 'flex-start'; box.style.pointerEvents = 'none';"
        "    for (const c of chips) {"
        "      const el = document.createElement('span');"
        # uniform height (width flows to content) so a stacked column lines up
        "      el.style.display = 'inline-flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center'; el.style.gap = '3px'; el.style.whiteSpace = 'nowrap';"
        "      el.style.height = '17px'; el.style.boxSizing = 'border-box'; el.style.padding = '0 6px';"
        "      el.style.borderRadius = '999px'; el.style.fontSize = '11px';"
        "      el.style.fontWeight = '600'; el.style.letterSpacing = '.02em'; el.style.lineHeight = '1';"
        "      el.style.boxShadow = SHADOW;"
        "      el.style.background = c.bg; el.style.color = c.color; if (c.border) el.style.border = c.border;"
        "      if (c.icon) { el.appendChild(ICONSVG(c.icon, 12)); }"
        "      else {"
        "        if (c.lead) { const ld=document.createElement('span'); ld.textContent=c.lead; ld.style.flexShrink='0'; ld.style.lineHeight='1'; if (c.leadColor) ld.style.color=c.leadColor; el.appendChild(ld); }"
        "        if (c.flag) el.appendChild(FLAG());"
        "        if (c.text) el.appendChild(document.createTextNode(c.text));"
        "        if (c.icons) c.icons.forEach(function(ic){ el.appendChild(ICONSVG(ic, 9)); });"
        "      }"
        "      box.appendChild(el);"
        "    }"
        "    host.appendChild(box);"
        "  }"
        # --- big fixed badge for the current app page ---
        "  let box = document.getElementById(PAGE_ID);"
        "  if (!APPCHIPS.length) { if (box) box.remove(); }"
        "  else {"
        "    if (!box) { box = document.createElement('div'); box.id = PAGE_ID; document.body.appendChild(box); }"
        "    while (box.firstChild) box.removeChild(box.firstChild);"
        "    box.style.cssText=''; Object.assign(box.style, POS);"
        "    box.style.display = 'inline-flex'; box.style.gap = (8*SCALE)+'px';"
        "    box.style.pointerEvents = MODAL ? 'auto' : 'none'; box.style.cursor = MODAL ? 'pointer' : 'default';"
        "    box.onclick = MODAL ? function(){ window.__prystanokModal(MODAL); } : null;"
        "    for (const c of APPCHIPS) {"
        "      const el = document.createElement('span');"
        "      el.style.display = 'inline-flex'; el.style.alignItems = 'center'; el.style.gap = (7*SCALE)+'px'; el.style.whiteSpace = 'nowrap';"
        "      el.style.padding = '0 '+(13*SCALE)+'px'; el.style.height = (26*SCALE)+'px'; el.style.boxSizing = 'border-box';"
        "      el.style.borderRadius = (13*SCALE)+'px'; el.style.fontSize = (14*SCALE)+'px';"
        "      el.style.fontWeight = '600'; el.style.letterSpacing = '.02em'; el.style.lineHeight = '1.2'; el.style.boxShadow = SHADOW;"
        "      el.style.background = c.bg; el.style.color = c.color; if (c.border) el.style.border = c.border;"
        "      if (c.icon) el.appendChild(ICONSVG(c.icon, (16*SCALE)));"
        "      if (c.lead) { const ld=document.createElement('span'); ld.textContent=c.lead; ld.style.flexShrink='0'; ld.style.lineHeight='1'; if (c.leadColor) ld.style.color=c.leadColor; el.appendChild(ld); }"
        "      if (c.flag) el.appendChild(FLAG());"
        "      el.appendChild(document.createTextNode(c.label));"
        "      if (c.icons) c.icons.forEach(function(ic){ el.appendChild(ICONSVG(ic, (12*SCALE))); });"
        "      box.appendChild(el);"
        "    }"
        "  }"
        "  return 'cards:' + document.querySelectorAll('[' + CARD_ATTR + ']').length;"
        "})()"
    )


class StoreInjector:
    def __init__(self, status_provider, details_provider=None, enabled=None, show_loc=None,
                 config_provider=None, lang_provider=None, log=None):
        # status_provider: async fn(list[int]) -> {str(appid): status}
        # details_provider: async fn(appid) -> details (tap-to-open modal)
        # config_provider: fn() -> store BadgeConfig (size/position/offset)
        # enabled / show_loc: fns; both gate the loc chip, threat always shows
        self.status_provider = status_provider
        self.details_provider = details_provider
        self.config_provider = config_provider or (lambda: {})
        self.lang_provider = lang_provider or (lambda: "uk")
        self.enabled = enabled or (lambda: True)
        self.show_loc = show_loc or (lambda: True)
        self.log = log or logger
        self._last_log = {}  # target_id -> last result, to de-spam logs
        # appid of the store app-page open in a store tab, or None. the QAM panel
        # reads it (that tab is invisible to the gamepad-UI React context).
        self.current_store_app = None

    async def _eval(self, session, ws_url, expression):
        async with session.ws_connect(ws_url, timeout=10) as ws:
            await ws.send_json({"id": 1, "method": "Runtime.evaluate",
                                "params": {"expression": expression, "returnByValue": True}})
            async for msg in ws:
                if msg.type != aiohttp.WSMsgType.TEXT:
                    continue
                data = json.loads(msg.data)
                if data.get("id") == 1:
                    return data.get("result", {}).get("result", {}).get("value")
        return None

    async def _tick(self, session):
        async with session.get(f"{CDP_HTTP}/json", timeout=aiohttp.ClientTimeout(total=10)) as r:
            targets = await r.json()

        # russian always badges; warnings need the surface on, loc chip also needs show_loc
        surface_on = self.enabled()
        show_loc = self.show_loc()
        seen = set()
        current_app = None  # store app-page appid seen this tick
        for t in targets:
            if t.get("type") != "page" or STORE_HOST not in (t.get("url") or ""):
                continue
            tid, ws_url = t["id"], t["webSocketDebuggerUrl"]
            seen.add(tid)

            m = STORE_APP_RE.search(t["url"])
            app_appid = int(m.group(1)) if m else None
            if app_appid:
                current_app = app_appid

            appids = await self._eval(session, ws_url, COLLECT_JS) or []
            ids = {int(a) for a in appids}
            if app_appid:
                ids.add(app_appid)
            if not ids:
                continue

            statuses = await self.status_provider(list(ids))
            ui_lang = self.lang_provider()
            card_map = {}
            for i in ids:
                chips = store_card_chips(statuses.get(str(i)), surface_on, show_loc, ui_lang)
                if chips:
                    card_map[str(i)] = chips
            app_chips = store_chips(statuses.get(str(app_appid)), surface_on, show_loc, ui_lang) if app_appid else []

            modal_data = None
            if app_appid and app_chips and self.details_provider:
                try:
                    modal_data = store_modal_data(await self.details_provider(app_appid), app_appid, ui_lang)
                except Exception as exc:
                    self.log.warning("store details fetch failed: %s", exc)

            # re-inject every tick (JS is idempotent): self-heals after nav/reload
            # or lazy-loaded rows
            result = await self._eval(
                session, ws_url, _apply_js(card_map, app_chips, app_appid, modal_data, self.config_provider())
            )
            if self._last_log.get(tid) != result:
                self._last_log[tid] = result
                self.log.info("store badges (%s): %s", t["url"][:60], result)

        self.current_store_app = current_app

        for tid in list(self._last_log):
            if tid not in seen:
                self._last_log.pop(tid, None)

    async def run(self):
        if aiohttp is None:
            self.log.warning("aiohttp unavailable; store injector disabled")
            return
        while True:
            try:
                # always tick: threat chips show regardless of the surface toggle
                async with aiohttp.ClientSession() as session:
                    await self._tick(session)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.log.warning("store injector tick failed: %s", exc)
            await asyncio.sleep(POLL_SECONDS)
