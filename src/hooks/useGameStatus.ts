import { useEffect, useState } from "react";

import { GameStatus, getStatuses } from "../api";

// frontend memo over the backend cache — badge remounts shouldn't re-enter python
const memo = new Map<number, GameStatus>();

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
    getStatuses([appid])
      .then((res) => {
        const s = res[String(appid)];
        if (s) memo.set(appid, s);
        if (!ignore) setStatus(s);
      })
      .catch((e) => console.error("[decky-prystanok] getStatuses failed", e));
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
