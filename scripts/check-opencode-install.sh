#!/usr/bin/env bash
# Installs every OpenCode plugin from this repo's HEAD commit the way users do (git ::path: spec)
# into a throwaway OpenCode home, then checks the installed copy matches the committed plugin folder
# and that its dependencies were installed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

export HOME="$SANDBOX/home"
export XDG_CONFIG_HOME="$HOME/.config" XDG_CACHE_HOME="$HOME/.cache"
export XDG_DATA_HOME="$HOME/.local/share" XDG_STATE_HOME="$HOME/.local/state"
export OPENCODE_CONFIG_DIR="$XDG_CONFIG_HOME/opencode"
mkdir -p "$HOME"

FAILS=0
for dir in "$ROOT"/plugins/*/; do
  [ -f "$dir/package.json" ] || continue
  name="$(basename "$dir")"
  pkg="$(jq -r .name "$dir/package.json")"
  spec="git+file://$ROOT#$SHA::path:plugins/$name"

  if ! opencode plugin add "$spec" >"$SANDBOX/$name.log" 2>&1; then
    echo "FAIL plugins/$name: opencode plugin add failed"; sed 's/^/  /' "$SANDBOX/$name.log"
    FAILS=$((FAILS + 1)); continue
  fi

  installed="$(find "$XDG_CACHE_HOME/opencode" -type d -path "*/node_modules/$pkg" -prune | head -1)"
  if [ -z "$installed" ]; then
    echo "FAIL plugins/$name: installed package $pkg not found"; FAILS=$((FAILS + 1)); continue
  fi

  mkdir -p "$SANDBOX/expected"
  git -C "$ROOT" archive "$SHA" "plugins/$name" | tar -x -C "$SANDBOX/expected"
  if ! diff -r -x node_modules -x .gitignore -x .npmignore -x .npmrc "$SANDBOX/expected/plugins/$name" "$installed" >"$SANDBOX/$name.diff"; then
    echo "FAIL plugins/$name: installed files differ from the committed plugin folder"; sed 's/^/  /' "$SANDBOX/$name.diff"
    FAILS=$((FAILS + 1)); continue
  fi

  missing=""
  for dep in $(jq -r '.dependencies // {} | keys[]' "$installed/package.json"); do
    [ -f "$installed/node_modules/$dep/package.json" ] || [ -f "$(dirname "$installed")/$dep/package.json" ] || missing="$missing $dep"
  done
  if [ -n "$missing" ]; then
    echo "FAIL plugins/$name: dependencies not installed:$missing"; FAILS=$((FAILS + 1)); continue
  fi

  echo "ok   plugins/$name ($spec)"
done

[ "$FAILS" -eq 0 ]
