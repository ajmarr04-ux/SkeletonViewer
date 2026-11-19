# Backlog: requested fixes and known issues

Feedback that isn't part of the current milestone. Each entry says where it came from and what has to be decided before it's built. When planning a milestone, pull the relevant entries into its plan and mark them here.

## 1. Orbit pivot should stay at the skeleton's centre (user, 2026-11-19, after `/m2/`)

**Reported:** "Orbit feels wrong when zoomed. Orbit should scale with the zoom, similarly to how CAD software would. I think the issue is that the orbit centre moves with panning and zooming; the orbit should always revolve around the centre of the skeleton, regardless of panning and zooming."

**Why it happens now (Milestone 2 behaviour):** the orbit pivot is camera-controls' *target*, and three things move it:
- **Pan** (right-drag, Shift + left-drag, two-finger drag, Shift + arrows) trucks the camera *and* the target together.
- **Zoom toward the cursor** (`dollyToPoint` in `src/camera/math.ts`) scales the camera and the target about the point under the cursor, so the target slides toward that point.
- **Double-click / double-tap re-centre** moves the target to the hit bone's box centre on purpose (spec §6).

After a zoom toward the feet, for example, the pivot sits near the feet, and orbiting swings the view around that point rather than the skeleton.

**Requested behaviour (CAD style):** the pivot stays at the skeleton's centre (or another explicit pivot) whatever the pan and zoom. Panning slides the picture across the screen without moving the pivot, and zooming toward the cursor works the same way. Orbiting then always turns the skeleton about its own centre.

**Possible approach (not decided):** keep the camera-controls target fixed at the pivot, and do pan and zoom-to-cursor as a screen-space shift of the projection (`camera.setViewOffset`, already used for the toolbar inset) plus a plain dolly along the view axis. Orbit then turns about the pivot while the view keeps its on-screen shift. Things to check: what `cam=` stores (it would need the screen shift as well, so the URL format changes); raycasting and the dolly-to-cursor maths with an offset projection; the pan boundary and clip planes; and how a pan should behave after a large orbit (CAD tools differ here).

**Needs a decision before building:**
- How this fits with **double-click re-centre** (spec §6) and Milestone 3's **`F` = frame the selection**. One option: the pivot is the skeleton's centre by default, an explicit re-centre or selection-frame sets it to that bone, and Home resets it. Alternatively, re-centre goes away. The spec says "orbit around a focus point", so this is a spec-level change: confirm with the user before changing it.
- "Orbit should scale with the zoom": check whether that means anything beyond the fixed pivot. At present orbit speed is a fixed angle per pixel, independent of distance, which is also what CAD tools do. With the pivot fixed, the feel should match; confirm by hand.
