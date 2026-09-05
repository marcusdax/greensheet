import * as React from "react"

const MOBILE_BREAKPOINT = 768

const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function matches() {
  return typeof window !== "undefined" && window.matchMedia(query).matches
}

/**
 * Subscribed through useSyncExternalStore rather than useState + useEffect.
 *
 * The previous version seeded state from `window.innerWidth` and then
 * re-synced inside an effect, with `isMobile` in the dependency array — so the
 * first paint after hydration rendered the desktop layout, then re-rendered,
 * and the effect re-ran on every change it caused. useSyncExternalStore reads
 * the media query at render time and subscribes once, which is what this hook
 * always meant to do.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    onChange => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    matches,
    // Server snapshot: nothing is mobile until a real viewport says so.
    () => false,
  )
}
