import { useCallback, useRef, useState, useSyncExternalStore } from "react";

/**
 * In-memory per-page UI state. Values survive switching between pages
 * (sections unmount/remount) but are NOT persisted anywhere, so a full
 * app/browser reload starts every page from its defaults again.
 *
 * Keys are namespaced as "<page>:<anything>", which lets resetPageState(page)
 * wipe one page's state when its refresh button is pressed.
 */
const values = new Map<string, unknown>();

let pageVersions: Record<string, number> = {};
const listeners = new Set<() => void>();

function resolve<T>(initial: T | (() => T)): T {
  return typeof initial === "function" ? (initial as () => T)() : initial;
}

/**
 * Drop-in useState replacement whose value is remembered across unmounts.
 * Pass null as the key to behave exactly like plain useState (nothing stored).
 */
export function usePageState<T>(
  key: string | null,
  initial: T | (() => T),
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (key !== null && values.has(key)) return values.get(key) as T;
    return resolve(initial);
  });
  const keyRef = useRef(key);
  keyRef.current = key;

  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      if (keyRef.current !== null) values.set(keyRef.current, next);
      return next;
    });
  }, []);

  return [value, set];
}

/** Clear every stored value for a page and force its section to remount. */
export function resetPageState(page: string) {
  const prefix = `${page}:`;
  for (const k of [...values.keys()]) {
    if (k.startsWith(prefix)) values.delete(k);
  }
  pageVersions = { ...pageVersions, [page]: (pageVersions[page] ?? 0) + 1 };
  listeners.forEach((l) => l());
}

/**
 * Version counter bumped by resetPageState. The dashboard keys the active
 * section with it so a reset remounts the section with fresh defaults.
 */
export function usePageVersion(page: string): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pageVersions[page] ?? 0,
    () => 0,
  );
}
