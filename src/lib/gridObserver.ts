/**
 * Library-grid overlays without React-tree patching: watch the gamepad-UI DOM
 * for capsule images, pull the appid from the artwork URL, batch-fetch statuses
 * and pin a badge on each capsule.
 *
 * Our JS runs in SharedJSContext (blank document); the real UI DOM lives in the
 * "SP Desktop_uid0" popup via g_PopupManager. The popup gets recreated on
 * resolution change / UI restart, so we re-check attachment periodically.
 */

import { GameStatus } from "../api";
import { isBadgeableType } from "./appType";
import { CC, HAND, IconPath, SHIELD, SPEAKER, TRIANGLE } from "./iconPaths";
import { getMemoizedStatus, prefetchStatuses } from "../hooks/useGameStatus";
import { alignItems, anchorStyle } from "./badgeStyle";
import {
  BADGE_BORDER,
  BADGE_SHADOW,
  CRIT,
  CRIT_INK,
  FLAG_GRADIENT,
  LANG_LOC_BG,
  LANG_LOC_INK,
  LOC_BORDER,
  LOC_INK,
  LOCU_BORDER,
  LOCU_INK,
  OK_GREEN,
  SCRIM,
  WARN,
  WARN_INK,
} from "./badgeTokens";
import { getCachedSettings } from "./settingsStore";

interface Chip {
  /** Threat chips are icon-only — text is too noisy over art. */
  icon?: IconPath;
  /** Trailing loc-type markers (CC = text, speaker = audio). */
  icons?: IconPath[];
  text?: string;
  background: string;
  color: string;
  border?: string;
  flag?: boolean;
  /** Leading glyph (✓ on a non-UA loc chip), tinted by leadColor. */
  lead?: string;
  leadColor?: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";

declare const g_PopupManager: any;

const BADGE_ATTR = "data-decky-prystanok";

// Capsule art we overlay: grid portrait library_600x900 + home rows
// library_capsule / library_header. Skip bare header.jpg / library_hero.jpg —
// that's the game-page hero, already handled by the React badge (matching it
// would double-badge). URL shapes:
//   steamloopback.host/assets/{appid}/library_600x900.jpg
//   steamloopback.host/assets/{appid}/{hash}/library_capsule.jpg
//   .../steam/apps/{appid}/.../library_600x900.jpg
//   legacy: .../{appid}_library_600x900.jpg
const CAPSULE_RE = /library_(?:600x900|capsule|header)/;

function getUIDocument(): Document | null {
  try {
    // Popup is "SP Desktop_uid<N>", N changes on every UI restart — match by
    // prefix, skip the keyboard popup.
    const popups = Array.from(g_PopupManager?.GetPopups?.() ?? []) as any[];
    const sp = popups.find(
      (p) => p?.m_strName?.startsWith("SP") && !p.m_strName.includes("Keyboard")
    );
    return sp?.m_popup?.document ?? null;
  } catch {
    return null;
  }
}

function appidFromUrl(src: string): number | undefined {
  const byPath = src.match(/\/(?:assets|apps)\/(\d+)\//);
  if (byPath) return Number(byPath[1]);
  const legacy = src.match(/\/(\d+)_library_/);
  return legacy ? Number(legacy[1]) : undefined;
}

/** URL → appid for capsule art (grid + home rows). Exported for tests. */
export function parseAppId(src: string): number | undefined {
  if (!CAPSULE_RE.test(src)) return undefined;
  return appidFromUrl(src);
}

/** The home featured card's face is a bare `header.jpg`. Badge it in place, but
 * only off the app page (the detail hero belongs to the React badge). Leading
 * slash avoids matching `library_header.jpg`. */
export function parseFeaturedAppId(src: string): number | undefined {
  if (!/\/header\.jpg/.test(src)) return undefined;
  return appidFromUrl(src);
}

function onAppPage(): boolean {
  return (window as any).__PRYSTANOK_APP_PAGE != null;
}

function appidFromImage(img: HTMLImageElement): number | undefined {
  const src = img.src || "";
  const capsule = parseAppId(src);
  if (capsule !== undefined) return capsule;
  return onAppPage() ? undefined : parseFeaturedAppId(src);
}

export function badgesFor(status: GameStatus, surfaceOn = true, showLoc = true): Chip[] {
  if (!status.found) return [];
  if (!isBadgeableType(status.appType)) return [];
  // Russian game is the one mandatory chip — shows even with the surface off.
  if (status.threatLevel === "russian")
    return [{ icon: HAND, background: CRIT, color: CRIT_INK }];
  if (!surfaceOn) return [];

  const chips: Chip[] = [];
  // Threat on top, loc below. CRIT (red) = suspect, WARN (amber) = vendor / rus links.
  if (status.threatLevel === "suspect")
    chips.push({ icon: TRIANGLE, background: CRIT, color: CRIT_INK });
  else if (status.threatLevel === "vendor")
    chips.push({ icon: SHIELD, background: WARN, color: WARN_INK });
  else if (status.russianLinks?.length)
    chips.push({ icon: TRIANGLE, background: WARN, color: WARN_INK });

  if (!showLoc) return chips;

  const lang = status.locLang ?? "uk";
  if (status.loc === "audio" || status.loc === "text") {
    const typeIcons = status.loc === "audio" ? [CC, SPEAKER] : [CC];
    if (lang !== "uk") {
      // Non-UA target: lang code text, plain blue, green ✓.
      chips.push({ text: lang.toUpperCase(), background: LANG_LOC_BG, color: LANG_LOC_INK, lead: "✓", leadColor: OK_GREEN, icons: typeIcons });
    } else if (status.official === false) {
      // Fan українізатор: dashed border (semi reads as official on a tiny capsule).
      chips.push({ flag: true, background: SCRIM, color: LOCU_INK, border: LOCU_BORDER, icons: typeIcons });
    } else {
      chips.push({ flag: true, background: SCRIM, color: LOC_INK, border: LOC_BORDER, icons: typeIcons });
    }
  } else if (status.ukrainian) {
    chips.push({ flag: true, background: SCRIM, color: LOC_INK, border: LOC_BORDER });
  }
  return chips;
}

function decorate(img: HTMLImageElement, status: GameStatus): void {
  const parent = img.parentElement;
  const doc = img.ownerDocument;
  if (!parent || !doc || parent.querySelector(`[${BADGE_ATTR}]`)) return;

  const cfg = getCachedSettings().capsules;
  const badges = badgesFor(status, cfg.enabled, getCachedSettings().showLoc);
  if (!badges.length) return;

  const scale = cfg.size / 32;

  const view = doc.defaultView ?? window;
  if (view.getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }

  const container = doc.createElement("div");
  container.setAttribute(BADGE_ATTR, String(status.appid));
  Object.assign(container.style, {
    position: "absolute",
    zIndex: "50",
    display: "flex",
    flexDirection: "column",
    gap: `${2 * scale}px`,
    alignItems: alignItems(cfg),
    pointerEvents: "none",
    ...anchorStyle(cfg),
  } as Partial<CSSStyleDeclaration>);

  for (const badge of badges) {
    const el = doc.createElement("div");
    // Fixed height, width flows to content — keeps a stacked column aligned.
    Object.assign(el.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: `${3 * scale}px`,
      height: `${16 * scale}px`,
      boxSizing: "border-box",
      padding: `0 ${6 * scale}px`,
      borderRadius: `${999}px`,
      background: badge.background,
      color: badge.color,
      border: badge.border ?? BADGE_BORDER,
      boxShadow: BADGE_SHADOW,
      fontSize: `${10 * scale}px`,
      fontWeight: "600",
      letterSpacing: "0.02em",
      lineHeight: "1",
      whiteSpace: "nowrap",
    } as Partial<CSSStyleDeclaration>);
    const mkSvg = (ic: IconPath, px: number) => {
      const svg = doc.createElementNS(SVG_NS, "svg");
      svg.setAttribute("viewBox", ic.viewBox);
      svg.setAttribute("width", `${px}`);
      svg.setAttribute("height", `${px}`);
      svg.setAttribute("fill", "currentColor");
      svg.style.display = "block";
      svg.style.flexShrink = "0";
      const p = doc.createElementNS(SVG_NS, "path");
      p.setAttribute("d", ic.path);
      svg.appendChild(p);
      return svg;
    };
    if (badge.icon) {
      el.appendChild(mkSvg(badge.icon, 11 * scale));
    } else {
      if (badge.lead) {
        const lead = doc.createElement("span");
        lead.textContent = badge.lead;
        lead.style.flexShrink = "0";
        lead.style.lineHeight = "1";
        if (badge.leadColor) lead.style.color = badge.leadColor;
        el.appendChild(lead);
      }
      if (badge.flag) {
        const flag = doc.createElement("span");
        Object.assign(flag.style, {
          width: `${7 * scale}px`,
          height: `${7 * scale}px`,
          borderRadius: "1px",
          flexShrink: "0",
          background: FLAG_GRADIENT,
          boxShadow: "0 0 0 1px rgba(0,0,0,.3)",
        } as Partial<CSSStyleDeclaration>);
        el.appendChild(flag);
      }
      if (badge.text) el.appendChild(doc.createTextNode(badge.text));
      if (badge.icons) for (const ic of badge.icons) el.appendChild(mkSvg(ic, 9 * scale));
    }
    container.appendChild(el);
  }
  parent.appendChild(container);
}

let observer: MutationObserver | null = null;
let attachedDoc: Document | null = null;
let attachTimer: number | undefined;
let scanTimer: number | undefined;

function scan(): void {
  if (!attachedDoc) return;

  // The home carousel is virtualized (ReactVirtualized recycles <img> nodes and
  // swaps src), so we can't mark a node "done" for good — re-check every scan
  // and key each badge to its appid. Mismatch = node reused for another game →
  // redraw; match → skip.
  const pending = new Map<number, HTMLImageElement[]>();
  const imgs = Array.from(attachedDoc.querySelectorAll("img"));
  for (const img of imgs) {
    const appid = appidFromImage(img);
    if (appid === undefined) continue;
    const existing = img.parentElement?.querySelector(`[${BADGE_ATTR}]`);
    if (existing && Number(existing.getAttribute(BADGE_ATTR)) === appid) continue;
    if (existing) existing.remove();
    const list = pending.get(appid) ?? [];
    list.push(img);
    pending.set(appid, list);
  }
  if (!pending.size) return;

  const appids = Array.from(pending.keys());
  prefetchStatuses(appids)
    .then(() => {
      for (const [appid, pendingImgs] of pending) {
        const status = getMemoizedStatus(appid);
        if (!status) continue;
        for (const img of pendingImgs) {
          if (img.isConnected) decorate(img, status);
        }
      }
    })
    .catch((e) => {
      console.error("[decky-prystanok] grid prefetch failed", e);
    });
}

function scheduleScan(): void {
  if (scanTimer !== undefined) return;
  scanTimer = window.setTimeout(() => {
    scanTimer = undefined;
    scan();
  }, 500);
}

function ensureAttached(): void {
  const doc = getUIDocument();
  if (doc === attachedDoc) return;

  observer?.disconnect();
  observer = null;
  attachedDoc = doc;

  if (!doc?.body) return;
  observer = new MutationObserver(scheduleScan);
  // Watch src too — the carousel swaps src instead of touching DOM, so
  // childList alone misses a card switching games.
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
  scheduleScan();
}

export function startGridObserver(): void {
  if (attachTimer !== undefined) return;
  ensureAttached();
  // SP popup gets recreated on UI restart / resolution change — re-resolve it.
  attachTimer = window.setInterval(ensureAttached, 5000);
}

/** Drop all badges and redraw next scan — after settings change. */
export function resetGridBadges(): void {
  attachedDoc?.querySelectorAll(`[${BADGE_ATTR}]`).forEach((el) => el.remove());
  scheduleScan();
}

export function stopGridObserver(): void {
  if (attachTimer !== undefined) {
    window.clearInterval(attachTimer);
    attachTimer = undefined;
  }
  if (scanTimer !== undefined) {
    window.clearTimeout(scanTimer);
    scanTimer = undefined;
  }
  observer?.disconnect();
  observer = null;
  attachedDoc?.querySelectorAll(`[${BADGE_ATTR}]`).forEach((el) => el.remove());
  attachedDoc = null;
}
