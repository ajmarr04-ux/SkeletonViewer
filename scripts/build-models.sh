#!/usr/bin/env bash
# Rebuild the models end to end (Milestone 1, steps 3 and 4):
#   1. Blender pipeline -> .cache/build/skeleton-{high,low}.glb + assets/build/manifest.json
#   2. gltfpack         -> public/models/skeleton-{high,low}.glb
#   3. check-models
# Needs `bash scripts/setup-blender.sh` first (bpy venv + pinned source).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=".cache/z-anatomy/Z-Anatomy/Startup.blend"
BUILD=".cache/build"
mkdir -p "$BUILD"
.cache/venv/bin/python -I scripts/blender/build_skeleton.py "$SRC" "$BUILD" "$@" 2>&1 \
  | tee "$BUILD/log.txt" | grep -E '^\[build\]|FAILED|Error'
test "${PIPESTATUS[0]}" -eq 0
bash scripts/compress-models.sh "$BUILD"
npx tsx scripts/check-models.ts
