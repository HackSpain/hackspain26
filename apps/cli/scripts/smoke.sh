#!/usr/bin/env bash
# End-to-end smoke against a dev deployment with the OTP stub enabled.
#   HACKSPAIN_APP_URL=http://localhost:3000 \   (default; needs `bun dev:app` running)
#   HACKSPAIN_SMOKE_EMAIL=<accepted or admin email> scripts/smoke.sh [path/to/hackspain]
# Uses an isolated config dir so it never touches your real session.
set -euo pipefail

cd "$(dirname "$0")/.."
bin="${1:-dist/hackspain}"
export HACKSPAIN_APP_URL="${HACKSPAIN_APP_URL:-http://localhost:3000}"
: "${HACKSPAIN_SMOKE_EMAIL:?set HACKSPAIN_SMOKE_EMAIL to an accepted (or admin) signup email}"
code="${HACKSPAIN_SMOKE_CODE:-00000000}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
export XDG_CONFIG_HOME="$tmp/config" XDG_STATE_HOME="$tmp/state"

step() { printf '\n== %s\n' "$*"; }
run() { "$bin" --json "$@" 2>/dev/null; }
ok() { jq -e '.ok == true' >/dev/null; }

step "version"; "$bin" --version
step "status (logged out)"; run auth status | jq -c '.data.loggedIn' | grep -q false
step "login"; run auth login --email "$HACKSPAIN_SMOKE_EMAIL" --code "$code" | tee /dev/stderr | ok
step "status"; run auth status | jq -c '.data.gate.state'

step "team show or create"
if ! run team show >/dev/null; then
  run team create "Smoke $(date +%H%M%S)" | jq -c '.data.name'
fi
run team show | jq -c '{name: .data.name, members: (.data.members | length), code: (.data.joinCode | length)}'
step "team list"; run team list | jq -c '.data | length'
step "team code"; code_out="$(run team code | jq -r '.data.code')"; echo "$code_out"
step "team join own code (idempotent)"; run team join "$code_out" | ok
step "team repo"; run team repo https://github.com/HackSpain/hackspain26.git | jq -c '.data.repoUrl'
step "stack"; run stack set bun convex "claude-code,cursor" | jq -c '.data.techStack'

step "track list"; run track list | jq -c '{open: .data.submissionsOpen, n: (.data.tracks | length)}'
first="$(run track list | jq -r '.data.tracks[0].slug')"
second="$(run track list | jq -r '.data.tracks[1].slug')"
step "track register $first"; run track register "$first" | jq -c '.data'
step "track move $first -> $second"; run track move "$first" "$second" | jq -c '.data.tracks'
step "track unregister $second"; run track unregister "$second" | jq -c '.data.tracks'
step "unknown track exits 2"; set +e; run track register nope >/dev/null; [[ $? -eq 2 ]] && echo "exit 2 ok"; set -e

step "submit --draft"
run submit --draft --name "Smoke project" --description "Written by scripts/smoke.sh for the CLI" \
  --repo https://github.com/HackSpain/hackspain26 --track "$first" | jq -c '{status: .data.status, tracks: [.data.challenges[].slug]}'
step "project show"; run project show | jq -c '.data.name'
step "project list"; run project list | jq -c '.data | length'
step "perk list"; run perk list | jq -c '.data | length'

step "milestone"; run milestone add custom --label "smoke $(date +%s)" | ok
run milestone list | jq -c '.data | length'
run milestone list --all | jq -c '.data | length'

step "transfer with nobody else exits 1"; set +e; run team transfer >/dev/null; [[ $? -eq 1 ]] && echo "exit 1 ok"; set -e
step "dissolve (owner, alone)"; run team dissolve --yes | jq -c '.data.dissolved'
set +e; run team show >/dev/null 2>&1; rc=$?; set -e; [[ $rc -ne 0 ]] && echo "team gone"

step "logout"; run auth logout | ok
echo
echo "smoke: all good"
