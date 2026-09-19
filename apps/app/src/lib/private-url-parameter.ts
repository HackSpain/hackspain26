import { useEffect, useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

/** Read a secret from the fragment, accept old query links, then scrub both. */
export function usePrivateUrlParameter(name: string, queryValue: string) {
  const value = useSyncExternalStore(
    subscribe,
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get(name)?.trim() ||
      queryValue,
    () => queryValue
  );
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!ready || !value) {
      return;
    }
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete(name);
    cleanUrl.hash = "";
    window.history.replaceState(
      null,
      "",
      `${cleanUrl.pathname}${cleanUrl.search}`
    );
  }, [name, ready, value]);

  return { ready, value };
}
