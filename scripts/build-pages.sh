#!/usr/bin/env bash
# Build the GitHub Pages site into dist/: the live site at the root, the
# current milestone at m<N>/, and each frozen milestone from its own commit.
# Config: deploy/pages.json. Needs full git history for frozen snapshots.
# "current": null means no milestone is in progress (the spec's phases are
# done): only the live site and the frozen snapshots are built.
set -euo pipefail
cd "$(dirname "$0")/.."
read -r REPO CURRENT < <(node -e 'const c=require("./deploy/pages.json");console.log(c.repo,c.current)')

BASE="/$REPO/" npx vite build --outDir dist --emptyOutDir
if [ "$CURRENT" != "null" ]; then
  BASE="/$REPO/m$CURRENT/" npx vite build --outDir "dist/m$CURRENT" --emptyOutDir
fi

node -e 'const c=require("./deploy/pages.json");for(const[k,v]of Object.entries(c.frozen))console.log(k,v)' |
while read -r name sha; do
  [ "$name" = "m$CURRENT" ] && continue
  if ! git rev-parse --verify --quiet "$sha^{commit}" >/dev/null; then
    echo "deploy/pages.json: frozen.$name is '$sha', which is not a commit in this repo" >&2
    exit 1
  fi
  echo "Building frozen snapshot $name from $sha"
  tree="$(mktemp -d)"
  git worktree add --detach "$tree" "$sha"
  (cd "$tree" && npm ci --no-audit --no-fund && BASE="/$REPO/$name/" npx vite build --outDir "$OLDPWD/dist/$name" --emptyOutDir)
  git worktree remove --force "$tree"
done
ls dist
