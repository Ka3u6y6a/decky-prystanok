import {
  appDetailsClasses,
  appDetailsHeaderClasses,
  DialogButton,
  showModal,
  useParams,
} from "@decky/ui";
import { ReactElement, useEffect, useRef, useState } from "react";

import { useGameStatus } from "../hooks/useGameStatus";
import { useSettings } from "../hooks/useSettings";
import { alignItems, appPageAnchor, STATUS_HEADER_PX } from "../lib/badgeStyle";
import { BADGE_BORDER, BADGE_SHADOW } from "../lib/badgeTokens";
import { setLastViewedAppId } from "../lib/currentApp";
import { badgeContents } from "./badgeContent";
import PrystanokModal from "./PrystanokModal";

function findTopCapsuleParent(ref: HTMLDivElement | null): Element | null {
  const children = ref?.parentElement?.children;
  if (!children) return null;

  let headerContainer: Element | undefined;
  for (const child of children) {
    if (child.className.includes(appDetailsClasses.Header)) {
      headerContainer = child;
      break;
    }
  }
  if (!headerContainer) return null;

  for (const child of headerContainer.children) {
    if (child.className.includes(appDetailsHeaderClasses.TopCapsule)) {
      return child;
    }
  }
  return null;
}

// Bottom edge of the top-right status cluster (clock/battery/profile/friends pill).
// Top-anchored badges sit below it; measured live since the friends pill changes
// the height. Returns 0 if nothing matches.
function measureStatusHeader(el: HTMLElement | null): number {
  const doc = el?.ownerDocument;
  const win = doc?.defaultView;
  if (!doc || !win) return 0;
  let bottom = 0;
  for (const node of Array.from(doc.querySelectorAll("img, div, span"))) {
    const el = node as HTMLElement;
    // skip our own badge — a stale position would inflate the result
    if (el.closest("[data-decky-prystanok-apppage]")) continue;
    const r = el.getBoundingClientRect();
    if (
      // top row only; a wider window caught the "N Online" pill and pushed badges to ~y90
      r.top >= 0 &&
      r.top < 20 &&
      r.right > win.innerWidth * 0.78 &&
      r.width > 8 &&
      r.height > 8 &&
      r.height < 44 // skip the avatar's padded wrapper (~46px)
    ) {
      if (r.bottom > bottom) bottom = r.bottom;
    }
  }
  return Math.min(Math.round(bottom), 52); // strip is ~40px, clamp
}

const STYLE_ID = "prystanok-badge-style";

// Press-feedback stylesheet, injected once. Entrance is done via WAAPI so it
// doesn't linger and fight the press transform — here just :active + reduced-motion.
function ensureBadgeStyle(doc: Document | undefined): void {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
    .prystanok-badge{transition:transform 90ms ease}
    .prystanok-badge:active{transform:scale(.96)}
    @media (prefers-reduced-motion: reduce){.prystanok-badge{transition:none}}
  `;
  doc.head.appendChild(el);
}

function prefersReducedMotion(win: Window | null | undefined): boolean {
  try {
    return !!win?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  } catch {
    return false;
  }
}

export default function PrystanokBadge(): ReactElement | null {
  const { appid: pathId } = useParams<{ appid: string }>();
  const appid = Number(pathId);
  const status = useGameStatus(Number.isFinite(appid) ? appid : undefined);

  useEffect(() => {
    if (Number.isFinite(appid)) setLastViewedAppId(appid);
    // tell the grid observer we're on an app page so its featured-card overlay
    // (keys off library_hero, present here too) stays hidden
    (window as any).__PRYSTANOK_APP_PAGE = Number.isFinite(appid) ? appid : undefined;
    return () => {
      (window as any).__PRYSTANOK_APP_PAGE = undefined;
    };
  }, [appid]);
  const { settings, loading } = useSettings();

  // hide the badge while the header is fullscreen (game running)
  const [show, setShow] = useState(true);
  // Bottom positions anchor to the header (hero/cover box); a small offsetY keeps
  // the badge above the Play button. Plugins like HLTB move header + Play together,
  // so the badge tracks them and stays above Play.
  const [headerH, setHeaderH] = useState(0);
  const [statusH, setStatusH] = useState(STATUS_HEADER_PX);
  const ref = useRef<HTMLDivElement | null>(null);
  const animatedFor = useRef<number | null>(null);

  useEffect(() => {
    const topCapsule = findTopCapsuleParent(ref.current);
    if (!topCapsule) return;
    setHeaderH((topCapsule as HTMLElement).offsetHeight);
    const measured = measureStatusHeader(ref.current);
    if (measured > 0) setStatusH(measured);

    const observer = new MutationObserver((entries) => {
      for (const entry of entries) {
        if (entry.type !== "attributes" || entry.attributeName !== "class") continue;
        const className = (entry.target as Element).className;
        const fullscreen =
          className.includes(appDetailsHeaderClasses.FullscreenEnterStart) ||
          className.includes(appDetailsHeaderClasses.FullscreenEnterActive) ||
          className.includes(appDetailsHeaderClasses.FullscreenEnterDone) ||
          className.includes(appDetailsHeaderClasses.FullscreenExitStart) ||
          className.includes(appDetailsHeaderClasses.FullscreenExitActive);
        const aborted = className.includes(appDetailsHeaderClasses.FullscreenExitDone);
        setShow(!fullscreen || aborted);
      }
    });
    observer.observe(topCapsule, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // entrance animation, once per appid (WAAPI so it doesn't linger); skip if reduced-motion
  useEffect(() => {
    const el = ref.current;
    const doc = el?.ownerDocument;
    ensureBadgeStyle(doc ?? undefined);
    if (!el || !status?.found || animatedFor.current === appid) return;
    const kids = Array.from(el.children) as HTMLElement[];
    if (!kids.length) return;
    animatedFor.current = appid;
    if (prefersReducedMotion(doc?.defaultView)) return;
    kids.forEach((kid, i) => {
      kid.animate(
        [
          { opacity: 0, transform: "translateY(6px) scale(.97)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 200, delay: i * 60, easing: "cubic-bezier(.2,.7,.2,1)", fill: "none" }
      );
    });
  }, [appid, status?.found, show, settings.detailedBadges]);

  const cfg = settings.appPage;
  // russian always badges; softer warnings need the surface on, loc also needs showLoc
  if (loading || !status?.found) {
    return <div ref={ref} style={{ display: "none" }} />;
  }

  const contents = badgeContents(status, settings.detailedBadges, cfg.enabled, settings.showLoc);
  if (!contents.length) {
    return <div ref={ref} style={{ display: "none" }} />;
  }

  const scale = cfg.size / 32;

  return (
    <div
      ref={ref}
      data-decky-prystanok-apppage={appid}
      style={{
        position: "absolute",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: `${4 * scale}px`,
        alignItems: alignItems(cfg),
        ...appPageAnchor(cfg, headerH, statusH),
      }}
    >
      {show &&
        contents.map((content) => (
          <DialogButton
            key={content.label}
            className="prystanok-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: `${7 * scale}px`,
              minWidth: 0,
              width: "auto",
              height: `${26 * scale}px`,
              boxSizing: "border-box",
              padding: `0 ${13 * scale}px`,
              fontSize: `${14 * scale}px`,
              lineHeight: 1,
              borderRadius: `${13 * scale}px`,
              background: content.background,
              border: content.border ?? BADGE_BORDER,
              boxShadow: BADGE_SHADOW,
              color: content.color ?? "#fff",
            }}
            onClick={() => {
              showModal(<PrystanokModal appid={appid} />);
            }}
          >
            <span style={{ display: "inline-flex", fontSize: `${16 * scale}px`, lineHeight: 0 }}>
              {content.icon}
            </span>
            <span>{content.label}</span>
            {content.typeIcons && content.typeIcons.length > 0 && (
              <span style={{ display: "inline-flex", gap: `${4 * scale}px`, fontSize: `${14 * scale}px`, lineHeight: 0 }}>
                {content.typeIcons}
              </span>
            )}
          </DialogButton>
        ))}
    </div>
  );
}
