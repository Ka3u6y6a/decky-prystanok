// Library-grid badges rendered inside Steam's own tile component, so they live in
// the React tree (no DOM scanning, follow the cover's focus lift). Approach taken
// from varta-decky's libraryTilePatch. gridObserver still handles home rows, the
// featured card, and everything if the tile component can't be found.
import { beforePatch, findModule, findModuleByExport } from "@decky/ui";
import { Component, ReactElement, ReactNode, useEffect, useRef } from "react";

import { PathIcon } from "../components/icons";
import { useGameStatus } from "../hooks/useGameStatus";
import { useSettings } from "../hooks/useSettings";
import {
  Chip,
  GLYPH_STYLE,
  TILE_ATTR,
  capsuleScale,
  chipColumnStyle,
  chipStyle,
  flagStyle,
  leadStyle,
  threatIconPx,
  typeIconPx,
} from "./chipStyle";
import { badgesFor } from "./gridObserver";

const REACT_MEMO = Symbol.for("react.memo");
const BADGE_CLASS = "prystanok-tile-badge";
const STYLE_ID = "prystanok-tile-style";
// a focused/hovered cover jumps to z-index 12; Steam's own subscript sits at 13
const TILE_Z = 13;

// The capsule (navKey "appportrait_<appid>") is a mobx observer — a React.memo
// that hides its source. Find the module by a sibling export, take its only memo.
function findLibraryTile(): any {
  const mod = findModuleByExport(
    (e: any) => typeof e === "function" && String(e).includes("GetELibraryDisplaySizeForWidth")
  );
  const memos = mod ? Object.values(mod).filter((e: any) => e?.$$typeof === REACT_MEMO) : [];
  return memos.length === 1 ? memos[0] : null;
}

// The badge is a DOM sibling of the cover (.LibraryItemBox), so it can lift with
// it on focus/hover the way Steam's subscript does (translateZ in the tile's
// perspective). `translate` rather than `transform` so it composes with the
// centering transform from anchorStyle.
function buildFollowFocusCss(): string {
  const c = findModule((m: any) => typeof m === "object" && m?.LibraryItemBox && m?.Draggable && m?.Landscape);
  if (!c) return "";
  const lifted = (extra = "") =>
    `.${c.LibraryItemBox}${extra}.gpfocus ~ .${BADGE_CLASS}, .${c.LibraryItemBox}${extra}:hover ~ .${BADGE_CLASS}`;
  return [
    `.${BADGE_CLASS}{transition:translate .3s cubic-bezier(0.16,0.86,0.43,0.99)}`,
    `${lifted()}{translate:0 0 15px}`,
    `${lifted(`.${c.Landscape}`)}{translate:0 0 7px}`,
    `@media (prefers-reduced-motion: reduce){.${BADGE_CLASS}{transition:none}}`,
  ].join("\n");
}

let liftCss: string | null = null;

function ensureTileStyle(doc: Document | undefined): void {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  if (liftCss === null) liftCss = buildFollowFocusCss();
  if (!liftCss) return;
  const el = doc.createElement("style");
  el.id = STYLE_ID;
  el.textContent = liftCss;
  doc.head.appendChild(el);
}

function ChipView({ chip, scale }: { chip: Chip; scale: number }): ReactElement {
  if (chip.icon) {
    return (
      <div style={chipStyle(chip, scale)}>
        <PathIcon icon={chip.icon} width={threatIconPx(scale)} height={threatIconPx(scale)} style={GLYPH_STYLE} />
      </div>
    );
  }
  const typePx = typeIconPx(scale);
  return (
    <div style={chipStyle(chip, scale)}>
      {chip.lead && <span style={leadStyle(chip)}>{chip.lead}</span>}
      {chip.flag && <span style={flagStyle(scale)} />}
      {chip.text}
      {chip.icons?.map((ic, i) => (
        <PathIcon key={i} icon={ic} width={typePx} height={typePx} style={GLYPH_STYLE} />
      ))}
    </div>
  );
}

function TileBadge({ appid }: { appid: number }): ReactElement {
  const status = useGameStatus(appid);
  const { settings } = useSettings();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => ensureTileStyle(ref.current?.ownerDocument), []);

  const cfg = settings.capsules;
  const chips = status ? badgesFor(status, cfg.enabled, settings.showLoc) : [];
  // Rendered even while loading or empty: the attribute tells gridObserver this
  // capsule is ours, so it never double-badges it.
  return (
    <div
      ref={ref}
      className={BADGE_CLASS}
      {...{ [TILE_ATTR]: appid }}
      style={chips.length ? chipColumnStyle(cfg, TILE_Z) : { display: "none" }}
    >
      {chips.map((chip, i) => (
        <ChipView key={i} chip={chip} scale={capsuleScale(cfg)} />
      ))}
    </div>
  );
}

// a badge error must never take down Steam's library grid
class SilentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("[decky-prystanok] tile badge crashed", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

let active = false;

export function patchLibraryTiles(): () => void {
  const Tile = findLibraryTile();
  if (!Tile) {
    console.warn("[decky-prystanok] library tile component not found, grid falls back to the DOM observer");
    return () => {};
  }

  active = true;
  // The tile renders props.children in its own positioned wrapper — just add one.
  const patch = beforePatch(Tile, "type", (args: any[]) => {
    const props = args[0];
    const app = props?.app;
    // tiles mounted before unpatch keep calling this wrapper until they remount
    if (!active || !app?.appid || app.BIsModOrShortcut?.()) return;
    args[0] = {
      ...props,
      children: [
        props.children,
        <SilentBoundary key="prystanok-tile-badge">
          <TileBadge appid={Number(app.appid)} />
        </SilentBoundary>,
      ],
    };
  });

  return () => {
    active = false;
    patch.unpatch();
  };
}
