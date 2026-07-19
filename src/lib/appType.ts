// App types we skip — badging a soundtrack/trailer/hardware is just noise.
// Unknown type still gets badged (field is often missing).
const NON_BADGEABLE = new Set([
  "Music",
  "Video",
  "Movie",
  "Series",
  "Episode",
  "Hardware",
  "Tool",
  "Software",
  "Guide",
  "Advertising",
]);

export function isBadgeableType(appType?: string | null): boolean {
  return !appType || !NON_BADGEABLE.has(appType);
}
