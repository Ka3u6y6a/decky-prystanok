/** Signed-in user's SteamID64 (for their Prystanok library page). Steam hangs it off global App. */
export function getSteamId64(): string | undefined {
  const app = (window as any).App;
  const id = app?.m_CurrentUser?.strSteamID ?? app?.GetCurrentUser?.()?.strSteamID;
  return id ? String(id) : undefined;
}
