// Mock of @decky/api. `callable(name)` returns a dispatcher that delegates to
// a per-name handler the test installs via __setHandler. Without a handler it
// resolves undefined, so importing modules that build callables never fails.
type Handler = (...args: any[]) => any;
const handlers: Record<string, Handler> = {};

export function __setHandler(name: string, fn: Handler): void {
  handlers[name] = fn;
}

export function __resetHandlers(): void {
  for (const k of Object.keys(handlers)) delete handlers[k];
}

export function callable<Args extends any[], Ret>(name: string) {
  return async (...args: Args): Promise<Ret> => {
    const h = handlers[name];
    return (h ? h(...args) : undefined) as Ret;
  };
}

export const toaster = { toast() {} };
export function addEventListener() {}
export function removeEventListener() {}
export const routerHook = { addPatch() {}, removePatch() {} };
export function definePlugin(fn: any) {
  return fn;
}
