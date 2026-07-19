import { CSSProperties } from "react";

import { BadgeConfig } from "../api";

/** Anchoring from position + offsets. center = horizontally centered, offsetX nudges it. */
export function anchorStyle(c: BadgeConfig): CSSProperties {
  const [v, h] = c.position.split("-");
  const s: CSSProperties = {};
  if (v === "top") s.top = `${c.offsetY}px`;
  else s.bottom = `${c.offsetY}px`;
  if (h === "left") s.left = `${c.offsetX}px`;
  else if (h === "right") s.right = `${c.offsetX}px`;
  else {
    s.left = "50%";
    s.transform = `translateX(calc(-50% + ${c.offsetX}px))`;
  }
  return s;
}

export function alignItems(c: BadgeConfig): "flex-start" | "center" | "flex-end" {
  if (c.position.endsWith("left")) return "flex-start";
  if (c.position.endsWith("right")) return "flex-end";
  return "center";
}

/** Fallback status-header height when we can't measure it live (friends pill
 * changes it, so PrystanokBadge normally measures and passes it in). Popup CSS px. */
export const STATUS_HEADER_PX = 40;

/** App-page anchoring inside the hero header box (height headerH). The badge
 * sits in a full-height scroll container, so plain `bottom:` lands below the
 * fold — top positions offset from the status header, bottom ones from the
 * header bottom via translateY(-100%) (just above Play). */
export function appPageAnchor(
  c: BadgeConfig,
  headerH: number,
  statusHeaderPx: number = STATUS_HEADER_PX
): CSSProperties {
  const [v, h] = c.position.split("-");
  const s: CSSProperties = {};
  if (h === "left") s.left = `${c.offsetX}px`;
  else if (h === "right") s.right = `${c.offsetX}px`;
  else s.left = "50%";
  const box = headerH > 0 ? headerH : 320;
  s.top =
    v === "top"
      ? `${statusHeaderPx + c.offsetY}px`
      : `${Math.max(0, box - c.offsetY)}px`;
  const tx = h === "center" ? `calc(-50% + ${c.offsetX}px)` : "0px";
  const ty = v === "top" ? "0px" : "-100%";
  s.transform = `translate(${tx}, ${ty})`;
  return s;
}
