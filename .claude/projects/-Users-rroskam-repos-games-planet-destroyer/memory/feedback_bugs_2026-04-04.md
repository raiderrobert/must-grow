---
name: Playtest bugs 2026-04-04
description: Three bugs found during playtesting - ghost player dot, camera lag at speed, world boundary wall
type: feedback
---

Three bugs observed during playtesting:

1. **Ghost player dot** — user sees 2 dots for the player, but only 1 appears in screenshots. Likely a rendering artifact (double-draw, or the thrust particle emitter rendering at a slightly offset position at certain frame timings). Pre-existing bug.

2. **Camera lag at high speed** — when accelerating, the player moves to the very edge of the screen and you can't see where you're going. The camera follow lerp (`0.08, 0.08` in `startFollow`) is too slow for high velocities. Needs either faster lerp or velocity-based look-ahead.

3. **World boundary wall** — `setCollideWorldBounds(true)` creates an invisible wall at the 400k px world edge. Player hits it and can only slide along it. In a space game this feels wrong — either remove the boundary, make the world larger, or add a visual indicator.

**Why:** These break the space feel the user is going for.
**How to apply:** Add these as bug fixes either in the orbital physics plan or as a separate quick-fix plan.
