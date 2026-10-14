import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False in server markup and while React hydrates, true once the client has taken over.
 * Controlled fields drop anything typed before hydration, so forms expose it as `data-hydrated` for the e2e tests to wait on.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
