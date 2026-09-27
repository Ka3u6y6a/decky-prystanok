import { useEffect, useState } from "react";

import { GameStatus, getStatuses } from "../api";

// frontend memo over the backend cache — badge remounts shouldn't re-enter python
const memo = new Map<number, GameStatus>();

type Resolve = (s: GameStatus | undefined) => void;

// A library grid mounts ~100 tiles at once; collect their lookups for a tick and
// send one get_statuses call (the backend splits it into API batches of 100).
const BATCH_WINDOW_MS = 20;
let pending = new Map<number, Resolve[]>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function flush(): void {
  flushTimer = undefined;
  const batch = pending;
  pending = new Map();
  getStatuses([...batch.keys()])
    .then((res) => {
      for (const [appid, waiters] of batch) {
        const s = res?.[String(appid)];
        if (s) memo.set(appid, s);
        waiters.forEach((w) => w(s));
      }
    })
    .catch((e) => {
      console.error("[decky-prystanok] getStatuses failed", e);
      for (const waiters of batch.values()) waiters.forEach((w) => w(undefined));
    });
}

export function requestStatus(appid: number): Promise<GameStatus | undefined> {
  const hit = memo.get(appid);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const waiters = pending.get(appid);
    if (waiters) waiters.push(resolve);
    else pending.set(appid, [resolve]);
    if (flushTimer === undefined) flushTimer = setTimeout(flush, BATCH_WINDOW_MS);
  });
}

export function useGameStatus(appid: number | undefined) {
  const [status, setStatus] = useState<GameStatus | undefined>(
    appid !== undefined ? memo.get(appid) : undefined
  );

  useEffect(() => {
    if (appid === undefined) return;
    const hit = memo.get(appid);
    if (hit) {
      setStatus(hit);
      return;
    }
    let ignore = false;
    requestStatus(appid).then((s) => {
      if (!ignore) setStatus(s);
    });
    return () => {
      ignore = true;
    };
  }, [appid]);

  return status;
}

export async function prefetchStatuses(appids: number[]): Promise<void> {
  const missing = appids.filter((a) => !memo.has(a));
  if (!missing.length) return;
  const res = await getStatuses(missing);
  for (const [key, value] of Object.entries(res)) {
    memo.set(Number(key), value);
  }
}

export function getMemoizedStatus(appid: number): GameStatus | undefined {
  return memo.get(appid);
}
