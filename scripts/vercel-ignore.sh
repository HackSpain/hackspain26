#!/usr/bin/env bash
# Vercel ignoreCommand: exit 0 skips the build, exit 1 builds. Any other exit
# code fails the deployment, so every path below ends in 0 or 1.
set -uo pipefail
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [[ -z "$prev" ]]; then
  exit 1
fi

# Vercel clones shallowly. After a quiet stretch (skipped builds do not move
# the previous SHA) the last successful deployment can fall outside the clone,
# and `git diff` dies with "bad object", which failed every later build until
# 2026-09-23. Fetch that commit; if that is not possible, build.
if ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
  git fetch --quiet --depth=1 origin "$prev" 2>/dev/null || true
fi
if ! git cat-file -e "${prev}^{commit}" 2>/dev/null; then
  echo "vercel-ignore: previous deployment ${prev} is not in the clone; building." >&2
  exit 1
fi

git diff --quiet "$prev" HEAD -- "$@"
status=$?
case "$status" in
  0) exit 0 ;;
  1) exit 1 ;;
  *)
    echo "vercel-ignore: git diff exited ${status}; building." >&2
    exit 1
    ;;
esac
