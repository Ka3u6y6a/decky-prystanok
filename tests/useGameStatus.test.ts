import { describe, expect, it, vi } from "vitest";

// The hook module keeps a memo + pending batch at module level, so every test
// re-imports it fresh against a recording get_statuses handler.
async function fresh(handler: (ids: number[]) => any) {
  vi.resetModules();
  const api: any = await import("@decky/api");
  api.__resetHandlers();
  const calls: number[][] = [];
  api.__setHandler("get_statuses", (ids: number[]) => {
    calls.push(ids);
    return handler(ids);
  });
  const mod = await import("../src/hooks/useGameStatus");
  return { mod, calls };
}

const allFound = (ids: number[]) => Object.fromEntries(ids.map((id) => [String(id), { appid: id, found: true }]));

describe("requestStatus batching", () => {
  it("coalesces concurrent lookups into one backend call", async () => {
    const { mod, calls } = await fresh(allFound);
    const [a, b, again] = await Promise.all([mod.requestStatus(1), mod.requestStatus(2), mod.requestStatus(1)]);
    expect(calls).toEqual([[1, 2]]);
    expect(a?.appid).toBe(1);
    expect(b?.appid).toBe(2);
    expect(again?.appid).toBe(1);
  });

  it("serves a repeat lookup from the memo", async () => {
    const { mod, calls } = await fresh(allFound);
    await mod.requestStatus(5);
    const second = await mod.requestStatus(5);
    expect(calls).toHaveLength(1);
    expect(second?.appid).toBe(5);
    expect(mod.getMemoizedStatus(5)?.appid).toBe(5);
  });

  it("a game missing from the response resolves undefined and isn't memoized", async () => {
    const { mod } = await fresh(() => ({}));
    expect(await mod.requestStatus(7)).toBeUndefined();
    expect(mod.getMemoizedStatus(7)).toBeUndefined();
  });

  it("backend failure resolves every waiter with undefined", async () => {
    const { mod } = await fresh(() => {
      throw new Error("backend down");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const results = await Promise.all([mod.requestStatus(1), mod.requestStatus(2)]);
    expect(results).toEqual([undefined, undefined]);
    spy.mockRestore();
  });
});
