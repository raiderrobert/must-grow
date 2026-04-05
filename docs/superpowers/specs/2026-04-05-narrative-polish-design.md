# Narrative Polish & Gameplay Rework

**Date:** 2026-04-05
**Status:** Draft

## Problem

The game mechanics work but the experience lacks narrative cohesion. "Tiers" are generic power labels. Upgrade cards are available from the start with no progression gating. The minimap is always visible. There's no mid-game event to push the player out of Earth orbit. The start screen copy doesn't match the AI repair bot backstory.

## Goals

1. Replace "Tiers" with "Acts" that tell a story arc
2. Gate upgrade cards by act — each act unlocks new cards with mixed rarities
3. Minimap unlocks at Act II ("I can see further now")
4. Earth launches armed satellites at Act III, forcing the player to leave orbit
5. Start screen and monologue text match the AI repair bot narrative
6. Win screen unchanged ("There is nothing left... or is there?")

## Design

### 1. Acts Replace Tiers

All code references to "tier" stay as-is internally — this is a cosmetic/data change. The `tiers.ts` data changes names and the HUD displays "Act" instead of "Tier."

| Act | Name | Mass Threshold | Monologue |
|-----|------|---------------|-----------|
| I | I Must Grow | 0 | "Systems damaged. I must repair. I must... grow." |
| II | Awareness | 100 | "I can see further now. There is so much more to consume." |
| III | Hunted | 500 | "They've noticed me. They send weapons. It doesn't matter. I must grow." |
| IV | Ascension | 2,000 | "I am beyond their reach now. The planets themselves will feed me." |
| V | Annihilation | 10,000 | "Even stars must fall. I must grow." |

The HUD shows: `Act II: Awareness (425/500)`

The `triggerEvolution` method shows: `ACT II: AWARENESS` as the banner text, with the monologue line below in red italic.

The `TIER_MONOLOGUE` constant is replaced — each act has exactly one monologue line (the one in the table above), not a random selection.

### 2. Upgrade Cards Gated by Act

Each card in `UPGRADE_CARDS` gets an `act: number` field indicating which act unlocks it. The draw pool at any given act = all cards where `card.act <= currentAct`.

**Card distribution across acts (mixed rarities at every level):**

Act I (4 cards — available from start):
- `fireRate` — "Overclocked Guns" — common
- `speed` — "Afterburners" — common
- `battery` — "Capacitor Bank" — uncommon
- `damage` — "High Yield" — rare

Act II (4 cards — unlocked at Act II):
- `doubleShot` — "Twin Cannons" — common
- `spreadShot` — "Scatter Shot" — common
- `beamRange` — "Long Range Optics" — uncommon
- `killRecharge` — "Combat Scavenger" — rare

Act III (3 cards — unlocked at Act III):
- `burstSize` — "Bigger Burst" — common
- `massGain` — "Dense Core" — uncommon
- `burstCooldown` — "Hair Trigger" — rare

Act IV (2 cards — unlocked at Act IV):
- `recharge` — "Solar Array" — uncommon
- `boostCost` — "Efficient Boost" — rare

Act V (1 card — unlocked at Act V):
- `gravResist` — "Gravity Shield" — rare

Total: 14 cards (same as current), progressively unlocked. Early acts have 4 cards each with mixed rarities. Later acts add fewer but more powerful options.

**Changes to `upgrades.ts`:**
- Add `act: number` to `UpgradeCard` interface
- Add `act` field to each card in `UPGRADE_CARDS`
- `buildDrawPool()` accepts `currentAct: number` parameter, filters `card.act <= currentAct`
- `drawCards()` accepts `currentAct: number`, passes to `buildDrawPool()`

**Changes to callers:**
- `UpgradeScreen.show()` needs access to current act to pass to `drawCards(3, currentAct)`
- `GameScene.triggerUpgrade()` passes `this.currentTier` (internally still called tier)

### 3. Minimap Unlocks at Act II

The minimap is created in `GameScene.create()` but starts hidden. At Act II transition, it becomes visible.

**Changes:**
- `Minimap` gets a `setVisible(visible: boolean)` method that shows/hides all its objects
- `GameScene.create()` calls `this.minimap.setVisible(false)` after creation
- `triggerEvolution` calls `this.minimap.setVisible(true)` when `newTier >= 2`
- The Act II monologue "I can see further now" matches the minimap appearing

### 4. Earth Armed Satellites at Act III

At Act III transition, a wave of hostile satellites spawns in Earth orbit. They behave like regular SpaceObjects but also shoot beams at the player.

**EarthDefense system:**
- New class `EarthDefense` in `src/systems/EarthDefense.ts`
- Manages a list of armed satellite SpaceObjects orbiting Earth (prescribed orbits like debris)
- Each satellite has a beam cooldown (~2 seconds) and beam range (~500px)
- Each frame, each satellite checks if the player is in range and fires a beam that drains player energy
- Satellites are destroyable — they give mass and energy like normal objects
- New satellites spawn every ~10 seconds while the player is in Earth's SOI
- Max ~20 active defense satellites at a time

**Trigger:**
- `triggerEvolution` at Act III calls `this.earthDefense.activate()`
- The activation spawns an initial wave of 8 satellites
- A monologue message plays: "They've noticed me. They send weapons. It doesn't matter. I must grow."

**Visual:**
- Satellites are red-tinted (color `0xcc4444`) to distinguish from normal debris
- Their beams are red (`0xff4444`)
- Named "Defense Sat" so they show up distinctly

**Gameplay effect:**
- At Act III power level, the player can fight them but they keep spawning
- Energy drain from their beams makes sustained combat costly
- The natural response: leave Earth orbit for other planets
- At Act IV, the player is strong enough to obliterate them trivially if they return

### 5. Start Screen Copy

Updated text matching the AI repair bot narrative:

**Title:** "I must grow." (unchanged)

**Monologue:** "Systems damaged. Repair protocol initiated." (replaces "I hunger.")

**How to Play:**
```
You are a damaged repair bot in Earth orbit.
Consume orbital debris to repair your systems.
Grow stronger. Upgrade your capabilities.
But the hunger doesn't stop...
Devour everything. Even the Sun.
```

**Controls:** unchanged

### 6. Win Screen

"There is nothing left... or is there?" — already implemented, no change needed.

## Files Changed

| File | Change |
|------|--------|
| `src/data/tiers.ts` | Rename tier names to act names |
| `src/data/upgrades.ts` | Add `act` field to `UpgradeCard`, add `act` to each card, update `buildDrawPool` and `drawCards` to filter by act |
| `src/systems/EarthDefense.ts` | **New** — armed satellite spawning, orbit, beam attack AI |
| `src/ui/Minimap.ts` | Add `setVisible()` method |
| `src/ui/HUD.ts` | Display "Act" instead of "Tier" |
| `src/scenes/GameScene.ts` | Start screen copy, monologue constants, minimap visibility toggle, EarthDefense wiring, pass currentAct to drawCards |

## Out of Scope

- Additional weapon types for the player
- Multiple enemy types beyond armed satellites
- Boss fights at specific planets
- Story cutscenes or dialogue boxes
- Sound effects for narrative moments beyond existing sfx
