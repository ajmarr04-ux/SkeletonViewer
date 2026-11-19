#!/usr/bin/env bash
# Compress the Blender LOD exports with gltfpack (Milestone 1, step 4).
# Usage: bash scripts/compress-models.sh [build_dir]   (default .cache/build)
#   -cc  meshopt compression (EXT_meshopt_compression), higher ratio
#   -kn  keep named nodes, so every stable ID survives as its own node
#   -kv  keep vertex attributes gltfpack thinks are unused: without it a bone
#        whose AO is pure white (pisiform) loses COLOR_0 and renders black
#   -vp  position quantisation bits; 14 is the default, raise it if
#        check-models reports bounds drifting beyond tolerance
set -euo pipefail
cd "$(dirname "$0")/.."
BUILD="${1:-.cache/build}"
VP="${VP:-14}"
mkdir -p public/models
for lod in high low; do
  npx gltfpack -i "$BUILD/skeleton-$lod.glb" -o "public/models/skeleton-$lod.glb" -cc -kn -kv -vp "$VP"
  ls -l "public/models/skeleton-$lod.glb"
done
