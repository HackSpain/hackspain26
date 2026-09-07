#!/usr/bin/env bash
# Compile the CLI into standalone binaries.
#   scripts/build-all.sh --host        one binary for this machine -> dist/hackspain
#   scripts/build-all.sh               full matrix                  -> dist/hackspain-<target>
# Env: HACKSPAIN_VERSION (default: package.json version),
#      HACKSPAIN_APP_URL_DEFAULT (dashboard URL to bake; default https://app.hackspain.com).
set -euo pipefail

cd "$(dirname "$0")/.."

version="${HACKSPAIN_VERSION:-$(bun -e 'console.log(JSON.parse(await Bun.file("package.json").text()).version)')}"
default_url="${HACKSPAIN_APP_URL_DEFAULT:-}"

common=(
  bun build --compile --minify
  --no-compile-autoload-dotenv
  --define "process.env.HACKSPAIN_VERSION=\"$version\""
  --define "process.env.HACKSPAIN_APP_URL_DEFAULT=$(
    if [[ -n "$default_url" ]]; then printf '"%s"' "$default_url"; else printf 'undefined'; fi
  )"
  src/index.ts
)

mkdir -p dist

if [[ "${1:-}" == "--host" ]]; then
  "${common[@]}" --outfile dist/hackspain
  echo "built dist/hackspain ($version)"
  exit 0
fi

targets=(
  bun-linux-x64
  bun-linux-arm64
  bun-darwin-x64
  bun-darwin-arm64
  bun-windows-x64
)

for target in "${targets[@]}"; do
  out="dist/hackspain-${target#bun-}"
  "${common[@]}" --target="$target" --outfile "$out"
  echo "built $out"
done

(cd dist && sha256sum hackspain-* > SHA256SUMS)
echo "wrote dist/SHA256SUMS"
