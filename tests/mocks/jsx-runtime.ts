// Minimal JSX runtime so badge components can be imported in tests without
// pulling in the real React (it's a Steam-provided external at runtime).
export const Fragment = Symbol("Fragment");

function jsx(type: unknown, props: unknown) {
  return { type, props };
}

export { jsx, jsx as jsxs, jsx as jsxDEV };
