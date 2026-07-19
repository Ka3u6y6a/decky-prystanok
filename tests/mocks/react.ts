// Steam provides React at runtime; tests only need import resolution plus
// trivial hook stubs for modules that pull them in at load time.
export function useState<T>(initial: T): [T, (v: T) => void] {
  return [initial, () => {}];
}
export function useEffect(): void {}
export function useRef<T>(initial: T): { current: T } {
  return { current: initial };
}
export function useCallback<T>(fn: T): T {
  return fn;
}
export function useMemo<T>(fn: () => T): T {
  return fn();
}
export default { useState, useEffect, useRef, useCallback, useMemo };
