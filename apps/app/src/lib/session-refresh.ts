type TokenFetcher = (args: { forceRefreshToken: boolean }) => Promise<string | null>;

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && [
    "Failed to fetch",
    "Load failed",
    "NetworkError when attempting to fetch resource.",
  ].includes(error.message);
}

/** Retry on a browser online event, or after a delay for outages that do not emit one. */
export function waitForSessionRetry(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      window.removeEventListener("online", finish);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, 15_000);
    window.addEventListener("online", finish, { once: true });
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) { finish(); }
  });
}

/** Keep the SDK's refresh lock and token storage; recover after its short network retries expire. */
export function recoveringTokenFetcher(
  fetchToken: TokenFetcher,
  report: (error: unknown) => void,
  wait = waitForSessionRetry
) {
  let pending: { controller: AbortController; promise: Promise<string | null> } | undefined;
  return {
    fetch(args: { forceRefreshToken: boolean }): Promise<string | null> {
      if (!args.forceRefreshToken) { return fetchToken(args); }
      if (pending) { return pending.promise; }
      const controller = new AbortController();
      const promise = (async () => {
        let reported = false;
        while (!controller.signal.aborted) {
          try {
            const token = await fetchToken(args);
            return controller.signal.aborted ? null : token;
          } catch (error) {
            if (controller.signal.aborted) { return null; }
            if (!isNetworkError(error)) { throw error; }
            if (!reported) {
              report(error);
              reported = true;
            }
            await wait(controller.signal);
          }
        }
        return null;
      })().finally(() => {
        if (pending?.controller === controller) { pending = undefined; }
      });
      pending = { controller, promise };
      return promise;
    },
    cancel() {
      pending?.controller.abort();
      pending = undefined;
    },
  };
}
