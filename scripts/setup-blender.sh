#!/usr/bin/env bash
# Prepare the Blender toolchain and the Z-Anatomy source for the model pipeline.
# Idempotent. Everything goes in .cache/ (git-ignored).
#   bash scripts/setup-blender.sh
# Afterwards:  .cache/venv/bin/python -I scripts/blender/<script>.py ...
set -euo pipefail
cd "$(dirname "$0")/.."
CACHE=.cache
ZA_COMMIT=71919eed92edde85012482efa62daaec6e0239a6   # Z-Anatomy master as audited
mkdir -p "$CACHE"

# Blender as a Python module (bpy 5.x needs Python 3.13).
if [ ! -x "$CACHE/venv/bin/python" ]; then
  python3 -m venv "$CACHE/venv"
fi
"$CACHE/venv/bin/python" -c "import bpy" 2>/dev/null || "$CACHE/venv/bin/pip" install -q "bpy==5.3.0"

# Z-Anatomy source (~87 MB zip -> ~300 MB .blend), pinned to the audited commit.
BLEND="$CACHE/z-anatomy/Z-Anatomy/Startup.blend"
if [ ! -f "$BLEND" ]; then
  rm -rf "$CACHE/z-anatomy-repo"
  git clone -q --filter=blob:none --no-checkout https://github.com/Z-Anatomy/Models-of-human-anatomy "$CACHE/z-anatomy-repo"
  git -C "$CACHE/z-anatomy-repo" checkout -q "$ZA_COMMIT" -- Z-Anatomy.zip
  unzip -q -o "$CACHE/z-anatomy-repo/Z-Anatomy.zip" -d "$CACHE/z-anatomy"
  rm -rf "$CACHE/z-anatomy-repo"
fi
"$CACHE/venv/bin/python" -c "import bpy; print('bpy', bpy.app.version_string)"
echo "source: $BLEND"
