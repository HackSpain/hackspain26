// A fresh tab adopts the baseline; a consumed command cannot cause a reload loop.
export function shouldReloadTv(previous: number | null, incoming: number) {
  return previous !== null && incoming > previous;
}

// A slow HTTP response must not overwrite a subscription received meanwhile.
export function shouldApplyPoll(startVersion: number, currentVersion: number) {
  return startVersion === currentVersion;
}
