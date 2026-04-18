# Mobile Controls Design

## Overview

Add touch-based virtual joystick for mobile play, with auto-zoom and integration into the existing InputManager.

## Layout

### Virtual Joystick (Left Half)
- **Drag-anywhere**: touch anywhere in left 50% of screen to spawn joystick
- Joystick appears at touch origin
- **Drag to move** — direction = joystick direction, magnitude = distance from origin (clamped)
- Joystick snaps back and disappears on release
- Visual: semi-transparent circle with inner thumb indicator

### Attack (Right Half)
- No dedicated button needed
- Tap on right half = burst fire
- Auto-fire continues to work as normal

## Input Integration

### InputManager Changes
- Add `"touch"` to the `InputType` union type
- Track `isMobile` flag based on touch detection
- Add touch input handling:
  - `moveX`/`moveY` from left-half joystick
  - `attackJustPressed` on right-half tap
- Priority: touch > gamepad > keyboard (touch takes over on mobile)

### Mobile Detection
```typescript
isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
```

### Touch Zone Detection
- Left zone: `pointer.x < width / 2` → joystick
- Right zone: `pointer.x >= width / 2` → attack

## Auto-Zoom

- `InputManager` exposes `isMobile` boolean
- `GameScene` checks `this.inputManager.isMobile` on start
- If mobile: `ZOOM_START * 0.6` (zoomed out 40% more)
- All other zoom behavior unchanged

## Visual Design

### Joystick Appearance
- Outer ring: 120px diameter, `0x4ecdc4` at 30% opacity, 2px stroke
- Inner thumb: 40px diameter, `0x4ecdc4` at 60% opacity
- Appears at touch point in left zone only
- Inner thumb clamped to 50px radius from center

### Joystick Visibility
- Hidden on desktop
- Shown only during active touch in left zone

## Files to Modify

1. `src/systems/InputManager.ts` — add touch handling, expose `isMobile`
2. `src/scenes/GameScene.ts` — set mobile zoom on start
3. `src/ui/` — create `MobileControls.ts` for joystick rendering

## Acceptance Criteria

- [ ] Joystick appears on left-side touch, follows drag, disappears on release
- [ ] Movement works correctly (direction + magnitude)
- [ ] Right-side tap triggers burst fire
- [ ] On mobile device, initial zoom is 60% of normal
- [ ] Desktop keyboard/gamepad controls unaffected
- [ ] No joystick visible when using keyboard/gamepad
