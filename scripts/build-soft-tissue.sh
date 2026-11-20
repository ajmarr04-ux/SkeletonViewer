#!/usr/bin/env bash
# Rebuild the soft-tissue layer files end to end (Milestone 6, steps 5 and 6):
#   1. Blender pipeline -> .cache/build-soft/<layer>-{high,low}.glb
#                          + assets/build/manifest-<layer>.json
#   2. gltfpack         -> public/models/<layer>-{high,low}.glb
#   3. check-models     (all files, bones included)
# Never touches public/models/skeleton-*.glb or assets/build/manifest.json.
# Usage: npm run build-soft [-- --layer muscles ...]
# Needs `bash scripts/setup-blender.sh` first (bpy venv + pinned source).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=".cache/z-anatomy/Z-Anatomy/Startup.blend"
BUILD=".cache/build-soft"
mkdir -p "$BUILD"
LAYERS=()
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  [ "${args[$i]}" = "--layer" ] && LAYERS+=("${args[$((i + 1))]}")
done
[ ${#LAYERS[@]} -eq 0 ] && LAYERS=(muscles ligaments cartilage attachments)
.cache/venv/bin/python -I scripts/blender/build_soft_tissue.py "$SRC" "$BUILD" "$@" 2>&1 \
  | tee "$BUILD/log.txt" | grep -E '^\[build\]|FAILED|Error'
test "${PIPESTATUS[0]}" -eq 0
bash scripts/compress-models.sh "$BUILD" "${LAYERS[@]}"
npx tsx scripts/check-models.ts
