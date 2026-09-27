// Capsule chip look, shared by the DOM observer (Object.assign onto style) and
// the React tile patch (style prop) so both surfaces draw identical badges.
import type { CSSProperties } from "react";

import { BadgeConfig } from "../api";
import { alignItems, anchorStyle } from "./badgeStyle";
import { BADGE_BORDER, BADGE_SHADOW, FLAG_GRADIENT } from "./badgeTokens";
import { IconPath } from "./iconPaths";

export interface Chip {
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

// Set on the React tile badge, so the DOM observer skips capsules it already covers.
export const TILE_ATTR = "data-decky-prystanok-tile";

// geometry is drawn at size 32 and scaled
export const capsuleScale = (cfg: BadgeConfig): number => cfg.size / 32;
export const threatIconPx = (scale: number): number => 11 * scale;
export const typeIconPx = (scale: number): number => 9 * scale;

export const GLYPH_STYLE: CSSProperties = { display: "block", flexShrink: "0" };

export function chipColumnStyle(cfg: BadgeConfig, zIndex: number): CSSProperties {
  return {
    position: "absolute",
    zIndex,
    display: "flex",
    flexDirection: "column",
    gap: `${2 * capsuleScale(cfg)}px`,
    alignItems: alignItems(cfg),
    pointerEvents: "none",
    ...anchorStyle(cfg),
  };
}

// Fixed height, width flows to content — keeps a stacked column aligned.
export function chipStyle(chip: Chip, scale: number): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: `${3 * scale}px`,
    height: `${16 * scale}px`,
    boxSizing: "border-box",
    padding: `0 ${6 * scale}px`,
    borderRadius: "999px",
    background: chip.background,
    color: chip.color,
    border: chip.border ?? BADGE_BORDER,
    boxShadow: BADGE_SHADOW,
    fontSize: `${10 * scale}px`,
    fontWeight: "600",
    letterSpacing: "0.02em",
    lineHeight: "1",
    whiteSpace: "nowrap",
  };
}

export function flagStyle(scale: number): CSSProperties {
  return {
    width: `${7 * scale}px`,
    height: `${7 * scale}px`,
    borderRadius: "1px",
    flexShrink: "0",
    background: FLAG_GRADIENT,
    boxShadow: "0 0 0 1px rgba(0,0,0,.3)",
  };
}

export function leadStyle(chip: Chip): CSSProperties {
  return {
    flexShrink: "0",
    lineHeight: "1",
    ...(chip.leadColor ? { color: chip.leadColor } : {}),
  };
}
