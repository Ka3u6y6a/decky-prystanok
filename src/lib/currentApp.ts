// Last opened game page, so Quick Access has something to show when nothing's running.
let lastViewedAppId: number | undefined;

export function setLastViewedAppId(appid: number) {
  lastViewedAppId = appid;
}

export function getLastViewedAppId(): number | undefined {
  return lastViewedAppId;
}
