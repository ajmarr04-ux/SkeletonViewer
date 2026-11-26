#!/usr/bin/env bash
# Compress the Blender LOD exports with gltfpack (Milestone 1 step 4, M6 step 6).
# Usage: bash scripts/compress-models.sh [build_dir] [file_stem ...]
#   build_dir   default .cache/build
#   file_stem   default "skeleton"; the soft-tissue build passes
#               "muscles ligaments cartilage attachments"
#   OUT=<dir>   where the packed files go (default public/models; the fixture's
#               generator passes its own folder)
#   SKV_REGISTRY=fixture   read the test registry (scripts/lib/registry-option.ts)
#   -cc  meshopt compression (EXT_meshopt_compression), higher ratio
#   -kn  keep named nodes, so every stable ID survives as its own node
#   -kv  keep vertex attributes gltfpack thinks are unused: without it a bone
#        whose AO is pure white (pisiform) loses COLOR_0 and renders black
#   -vp  position quantisation bits; 14 is the default, raise it if
#        check-models reports bounds drifting beyond tolerance
# M13 (plan decision 9): a layer whose descriptor says `chunking: "region"` is
# first split into one file per coarse body region (scripts/models/split-regions.ts),
# and each chunk is packed the same way; a "single" layer is packed exactly as before.
set -euo pipefail
cd "$(dirname "$0")/.."
BUILD="${1:-.cache/build}"
shift || true
STEMS=("$@")
[ ${#STEMS[@]} -eq 0 ] && STEMS=(skeleton)
VP="${VP:-14}"
OUT="${OUT:-public/models}"
mkdir -p "$OUT"
for stem in "${STEMS[@]}"; do
  for lod in high low; do
    chunks=$(npx tsx scripts/models/split-regions.ts "$BUILD" "$stem" "$lod" "$BUILD/chunks")
    if [ -z "$chunks" ]; then
      npx gltfpack -i "$BUILD/$stem-$lod.glb" -o "$OUT/$stem-$lod.glb" -cc -kn -kv -vp "$VP"
      ls -l "$OUT/$stem-$lod.glb"
    else
      for chunk in $chunks; do
        npx gltfpack -i "$chunk" -o "$OUT/$(basename "$chunk")" -cc -kn -kv -vp "$VP"
        ls -l "$OUT/$(basename "$chunk")"
      done
    fi
  done
done
