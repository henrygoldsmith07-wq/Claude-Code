#!/usr/bin/env bash
# Propagate the canonical Le Studio theme into every app that uses it.
#
# Each Vercel project builds with its root directory set to its own app, and
# Vercel builds each app with its Root Directory set to that app, so a CSS
# @import that reaches outside the app is not reliable. Vendoring a generated
# copy into each app keeps one source of truth without depending on workspace
# resolution.
#
# Usage:  scripts/sync-theme.sh          # write the copies
#         scripts/sync-theme.sh --check  # verify they are in sync (CI-friendly)
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/packages/theme/le-studio.css"

# Every app that consumes the shared theme (Tailwind v4 + @import "./le-studio.css").
apps=(
  arise
  daily-debate
  emotion-tracker
  food-shopping-os
  french-practice
  habit-tracker
  mental-load-tracker
  revise
)

check=0
[[ "${1:-}" == "--check" ]] && check=1

status=0
for app in "${apps[@]}"; do
  dir="$root/apps/$app"
  [[ -d "$dir" ]] || { echo "skip   $app (no such app)"; continue; }

  # The copy lives next to the stylesheet that imports it: src/index.css for
  # Vite-style apps (and food-shopping-os, which chains globals.css → index.css),
  # src/app/globals.css for plain Next apps.
  if [[ -f "$dir/src/index.css" ]]; then
    dest="$dir/src/le-studio.css"
  elif [[ -d "$dir/src/app" ]]; then
    dest="$dir/src/app/le-studio.css"
  else
    dest="$dir/src/le-studio.css"
  fi

  if [[ $check -eq 1 ]]; then
    if ! cmp -s "$src" "$dest" 2>/dev/null; then
      echo "DRIFT  ${dest#$root/}"
      status=1
    else
      echo "ok     ${dest#$root/}"
    fi
  else
    cp "$src" "$dest"
    echo "wrote  ${dest#$root/}"
  fi
done

if [[ $check -eq 1 && $status -ne 0 ]]; then
  echo
  echo "Theme copies are out of date. Run scripts/sync-theme.sh and commit the result."
fi
exit $status
