# Must Grow — Game Design Spec

*"The station must grow."*

A browser-based incremental/arcade hybrid where you play as a space station consuming
objects in our solar system, growing from satellite-sized to star-sized.

## Concept

Katamari Damacy meets Cookie Clicker in space. Start as a tiny station manually zapping
space junk, progressively automate your destruction, and scale up until you consume the Sun.

The player controls a "non-descript space station that's definitely not a Death Star." The
game was inspired by a kid's idea of playing as the Death Star in our own solar system,
going among the different planets and destroying them.

The game is grounded in a real physics insight: destroying a planet isn't enough. The
gravitational binding energy of all that mass means it just comes back together. You need
to overcome the gravity well itself — which means you need to grow massive enough that
*your* gravity dominates. This physics concept drives the entire progression: you start
as a sentient satellite trapped in Earth's gravity well, and the name "Must Grow" is
literally your survival imperative.

The key experience pillars:

- **Katamari scale fantasy** — start tiny, end enormous. What was once a terrifying boss
  becomes auto-zap fodder as you outgrow it. The camera zooms out and the universe shrinks
  around you.
- **Cookie Clicker automation satisfaction** — early game is frantic manual clicking. Each
  automation upgrade removes a manual task, and watching your station run itself is the
  reward. But more automation means more energy drain, so there's always a new plate to spin.
- **Arcade action foundation** — this isn't a pure idle game. Movement, aiming, and timing
  matter, especially early on and during boss encounters at every tier.

## Visual Style

Simple vector / flat aesthetic with glowing effects. Clean geometric shapes, neon-colored
beams, particle explosions, minimal but polished. Think Geometry Wars meets a space sim.

- Station rendered as geometric shapes with bolt-on modules visible as they're purchased
- Space objects are simple circles/polygons with distinct colors per type
- Beams and projectiles use glow effects and particle trails
- Explosions use Phaser's particle system — satisfying bursts of particles and light
- Starfield background with parallax scrolling for depth
- UI elements use the same clean vector style — thin borders, glow accents

## Core Game Loop

The moment-to-moment gameplay cycle:

1. **Navigate** — WASD/arrow keys to steer the station through space (and fight gravity)
2. **Attack** — click on targets to clamp onto them (Tier 1) or fire your beam (Tier 2+)
3. **Gather** — click on floating debris (dropped by destroyed objects) to collect mass and energy
4. **Power** — click the generator button on the HUD to manually produce energy
5. **Upgrade** — spend mass to build new weapons, automation, and energy systems
6. **Evolve** — hit mass thresholds to tier up, unlocking new target types and zones

At Tier 1, the attack mechanic is clamping — you physically grab and absorb nearby
satellites. This evolves into a beam weapon at Tier 2 when you escape Earth's gravity
well. The clamp-to-beam transition is the first major power shift.

### The Plate-Spinning Design

Early game requires all four manual actions (move, attack, gather, power) simultaneously.
This is intentionally overwhelming — the player is steering with one hand and frantically
clicking with the other. They need to:

- Navigate toward targets while fighting Earth's gravity pull
- Click to clamp onto satellites, then keep clicking to chew and absorb (Tier 1) or fire beams (Tier 2+)
- Click on the resulting debris to collect mass and energy
- Click the power generator on the HUD to keep their energy from running out

This creates the frantic arcade feel. Each automation upgrade removes one of these manual
tasks:

| Manual Action | Automated By | Tier Available |
|---------------|-------------|----------------|
| Fire at targets | Auto-turrets | 2 |
| Gather debris | Tractor Beam → Gravity Well | 3 → 4 |
| Generate power | Solar Panels → Fusion Reactor | 1-2 → 3 |
| Navigate | Autopilot (late-game luxury) | 4+ |

The satisfaction of watching a plate get removed is the cookie-clicker hook. But each
automation system drains energy, so you immediately feel the pressure to upgrade your
power grid — and the cycle continues.

## Resources

Two resources with fundamentally different roles.

### Mass

- Gained by destroying and absorbing space objects
- Accumulates permanently — you never lose mass (it only goes up or gets spent)
- Determines tier progression: hit mass thresholds to evolve to the next tier
- **Also the currency for all upgrades** — spending mass on weapons, automation, or energy
  systems slows your tier progression
- This creates the core strategic tension: do you hoard mass to tier up faster (unlocking
  new zones and targets), or do you spend mass on upgrades that make you more efficient at
  collecting mass?
- Different objects yield different amounts of mass: space junk gives very little, asteroids
  give moderate amounts, moons and planets give massive amounts
- Mass gain scales with object size — the game rewards you for targeting the biggest thing
  you can handle

### Energy

Energy is a live operational resource — not a currency you hoard, but a flow you manage.

- **Generation sources:**
  - Manual clicking on the HUD generator button (early game primary source)
  - Destroying objects always yields some energy alongside mass
  - Solar panels provide passive energy/sec (first passive source)
  - Fusion reactor provides high passive output but consumes mass as fuel
  - Stellar harvester siphons energy from nearby stars (late game)

- **Drains:**
  - Each auto-turret consumes energy per second while active
  - Tractor beam consumes energy per second
  - Drone swarm consumes energy per second per drone
  - Shield generator consumes energy per second
  - Gravity well consumes energy per second
  - The super weapon requires massive energy to charge

- **Storage:**
  - Energy is stored in a battery with finite, upgradeable capacity
  - Surplus energy beyond battery capacity is wasted — incentivizes storage upgrades
  - Battery level is always visible on the HUD
  - Battery glows when full, flashes red when low

- **The balancing act:**
  - More automation = more power drain = need more generation and storage
  - The player is always asking: "Can my power grid handle one more turret?"
  - This is the idle-game treadmill that keeps progression feeling meaningful

## Gravity

Gravity is a core game mechanic, not just flavor. Every massive body in the solar system
exerts gravitational pull on the player, and this pull matters throughout the game.

### How Gravity Works

- Every planet, moon, and the Sun has a gravity field proportional to its mass
- The pull strength follows an inverse-square falloff — weak at distance, strong up close
- The player's thrust must overcome gravity to escape. Insufficient thrust near a large
  body means you get dragged in and destroyed
- Gravity affects the player AND loose debris/resources — objects near planets orbit or
  fall toward them, making collection harder near gravity wells

### Gravity as Progression Gate

- **Tier 1:** Earth's gravity is the primary antagonist. You must grow to escape it.
- **Tier 2-3:** Inner planets have moderate gravity. You can orbit them safely but getting
  too close without enough thrust is dangerous. To destroy a planet, you need enough mass
  that your own gravitational influence starts to compete with theirs.
- **Tier 4:** Gas giants have enormous gravity wells. Approaching Jupiter or Saturn
  without sufficient thrust and mass is a death sentence. Their moons orbit them, creating
  a mini solar-system you need to dismantle from the outside in.
- **Tier 5:** The Sun's gravity dominates the entire system. The final boss fight is as
  much about resisting the Sun's pull as it is about dealing damage.

### Gravity and Planet Destruction

A key physics insight drives the game: destroying a planet isn't just about firepower.
Even if you shatter a planet, its gravitational binding energy pulls the fragments back
together — it reforms. To truly destroy a planet, your station's mass (and therefore
gravity) must be large enough to compete with the planet's own binding force. You rip it
apart and absorb the fragments before they can reconverge. This is why mass matters for
destruction, not just for upgrades — you physically need to be big enough to overcome
the target's gravity.

This means:
- Small objects (asteroids, satellites): pure firepower works, fragments don't reconverge
- Medium objects (moons): weaken with firepower, then absorb chunks quickly before they
  re-coalesce
- Large objects (planets): requires sufficient mass threshold before you can even attempt
  destruction. Below the threshold, your weapons chip at it but it heals. Above it, you
  crack it apart and your gravity pulls the pieces toward you.

## Progression Tiers

Five tiers, each a dramatic shift in scale, capability, and game feel. Growth within a
tier is continuous (station visibly gets a little bigger with each object absorbed), with
dramatic evolution moments at tier thresholds.

### Tier 1 — Satellite (Escape the Well)

- **Scale:** ~school bus sized
- **Zone:** Near-Earth orbit
- **Targets:** Space junk, small asteroids, defunct satellites
- **Opening:** You are a sentient satellite in low Earth orbit. You're tiny, alone, and
  Earth's gravity is constantly pulling you down. You need to consume other objects to gain
  mass and thrust to stay in orbit — and eventually escape.
- **Core mechanic — clamp and chew:** At this scale, you don't have a beam weapon yet. You
  physically clamp onto nearby satellites and debris, then "chew" them to absorb their mass.
  Navigate close to a target, click to grab it, then keep clicking to chew — each click
  grinds off a chunk of mass. Bigger targets take more clicks to fully consume. You're
  locked onto the target while chewing (can't move freely), which means you're vulnerable
  to Earth's gravity pull the whole time. This creates tension: do you finish chewing a
  big satellite for more mass, or release early and thrust upward before you sink too low?
  It's intimate, scrappy, and desperate — you're literally gnawing on space junk to survive.
- **Gravity threat:** Earth's gravity is a constant downward pull. If you stop thrusting
  upward, you slowly sink toward the atmosphere. Fall too low and you burn up (game over).
  This makes Tier 1 uniquely tense — you're fighting gravity the entire time. Upgrading
  thrusters isn't just about speed, it's about survival.
- **Tier-up moment:** Once you've consumed enough mass and upgraded your thrusters
  sufficiently, you break free of Earth's gravity well. This is the first major "wow"
  moment — the camera pulls back as you accelerate away from Earth into open space,
  and your clamp mechanism evolves into a proper beam weapon.
- **Available upgrades:**
  - Clamp Range (grab targets from further away)
  - Chew Speed (fewer clicks to consume a target)
  - Jaw Strength (more mass extracted per chew click)
  - Manual Generator (more energy per click)
  - Basic Battery (starting storage, upgradeable)
  - Thrusters (critical — fight Earth's gravity, move faster)
  - Solar Panels (first passive energy — low output but frees up clicking)
- **Tier-up threshold:** Accumulate enough mass and thrust to escape Earth's gravity well
- **Feel:** Desperate, scrappy, survival-focused. You're a tiny thing clinging to
  existence against gravity. Every satellite you eat matters. The name "Must Grow"
  has never been more literal.

### Tier 2 — Space Station

- **Scale:** ~ISS sized
- **Zone:** Inner solar system (Mercury → Mars, asteroid belt)
- **Targets:** Larger asteroids, comets, small moons
- **Gameplay:** Free of Earth, you now have a proper beam weapon (evolved from the clamp).
  First real automation unlocks. Auto-turrets handle the small debris that used to require
  your full attention. You focus manual fire on bigger targets like comets. The asteroid
  belt is a target-rich environment. First time the player feels the power shift — things
  that used to be threatening are now trivially handled by turrets.
- **Gravity hazard:** Inner planets (Mercury, Venus, Earth, Mars) have gravity fields.
  Getting too close without enough thrust pulls you in. You can orbit safely at a distance,
  but planets are obstacles to navigate around, not targets yet — you're too small to
  overcome their binding energy.
- **Available upgrades (new):**
  - Auto-turrets (fires at nearest small target — first automation!)
  - Capacitor Banks (bigger energy storage, stackable)
  - Multi-beam (hit multiple targets at once)
  - Energy Amplifier (more energy from destroyed objects)
  - Shield Generator (absorb collisions)
  - Efficiency Upgrades (reduce energy drain on all systems)
- **Tier-up threshold:** Consume enough of the asteroid belt and inner system debris
- **Feel:** First taste of automation power. "I remember when that asteroid would have
  killed me."

### Tier 3 — Mega Station

- **Scale:** ~moon sized
- **Zone:** Full inner solar system
- **Targets:** Small planets (Mercury, Mars), dwarf planets (Pluto, Ceres), large moons
  (Europa, Ganymede, Titan)
- **Gameplay:** Tractor beams pull in debris passively — gathering is automated. Multiple
  auto-turrets handle most combat. The player's manual role shifts to targeting planets.
  Destroying a planet is a multi-phase process: weaken it with sustained fire until cracks
  appear, then your mass must be sufficient to overcome its binding energy — it breaks apart
  and your gravity pulls in the chunks before they can reconverge. This is the first "wow"
  moment — you're destroying actual planets by literally out-massing them.
- **Gravity shift:** At this scale, you start to *have* meaningful gravity of your own.
  Small debris begins drifting toward you naturally. The hunter becomes the gravity well.
- **Available upgrades (new):**
  - Tractor Beam (auto-gather nearby debris)
  - Drone Swarm (AI drones that hunt and destroy independently)
  - Fusion Reactor (high passive energy, but consumes mass as fuel)
  - Power Core (massive energy storage buffer)
- **Tier-up threshold:** Destroy several small planets and moons
- **Feel:** Power fantasy kicks in. Planets crumble before you. But energy management
  gets real — running all these systems is expensive.

### Tier 4 — Planet Eater

- **Scale:** ~planet sized
- **Zone:** Outer solar system
- **Targets:** Gas giants (Jupiter, Saturn), ring systems, large moon clusters
- **Gameplay:** Your own gravity well passively draws everything nearby toward you — small
  objects just drift in and get absorbed without any action. Fleet of auto-drones handles
  medium targets. Manual interaction is reserved for the gas giants, which are massive
  multi-phase targets with enormous gravity of their own. Saturn's rings shatter into
  thousands of collectible fragments. Jupiter's moons orbit it in a mini solar system —
  you must dismantle them from the outside in, picking off outer moons first before you're
  massive enough to challenge the planet itself.
- **Gravity danger:** Gas giants have crushing gravity wells. Approaching Jupiter without
  sufficient mass and thrust is suicide — you get pulled in and crushed. You must grow
  large enough that your gravity competes with theirs before engaging directly.
- **Available upgrades (new):**
  - Gravity Well (everything nearby drifts toward you — auto-gather on steroids)
  - Stellar Harvester (siphons energy from nearby stars — massive output)
  - Dark Energy Matrix (near-infinite energy storage)
- **Tier-up threshold:** Consume the gas giants
- **Feel:** Unstoppable force. The outer solar system melts before you. But powering a
  planet-sized station with gravity wells, drones, and turrets all running requires serious
  energy infrastructure.

### Tier 5 — Star Killer

- **Scale:** ~star sized
- **Zone:** Center of the solar system
- **Targets:** The Sun
- **Gameplay:** The final boss. Everything is automated except your ultimate super-weapon.
  The Sun fights back — solar flares, coronal mass ejections, and the most intense gravity
  in the system. Multi-phase fight: weaken the outer layers, penetrate the corona, attack
  the core. The Dark Energy Matrix is required to store enough energy to power the
  super-weapon. This is the culmination of everything you've built.
- **Gravity finale:** The Sun's gravity is the ultimate test. Even at star-sized scale,
  resisting its pull requires everything your station has. The fight is as much about
  maintaining position against the pull as it is about dealing damage. If your energy
  fails and thrusters cut out this close to the Sun, it's over instantly.
- **Available upgrades (new):**
  - Super Weapon (charged blast — the only thing that can damage the Sun)
- **Victory condition:** Destroy the Sun. Game complete.
- **Feel:** Epic. Everything you've built over the whole game is working in concert. Your
  station is a massive automated war machine, and you're aiming the biggest gun in the
  solar system at a star.

## Upgrade System

All upgrades cost mass. This is the central economic tension — mass is both your tier
progression meter and your spending currency. Every upgrade you buy delays your next tier,
but makes you more efficient within your current tier.

### Scaling Costs

Each level of an upgrade costs 1.5x more than the previous level (standard idle-game
exponential scaling). This means:

- Level 1: base cost
- Level 2: base cost × 1.5
- Level 3: base cost × 2.25
- Level 4: base cost × 3.375
- ...and so on

This creates the classic idle-game feeling of always chasing the next upgrade while costs
accelerate. The player must decide between many cheap upgrades or saving for expensive ones.

### Visual Feedback

Every module purchase visibly changes the station's appearance:

- Auto-turrets appear as small gun barrels protruding from the station
- Solar panels extend outward as flat geometric panels
- Tractor beam emitters glow on the station's surface
- Thrusters add visible exhaust effects
- Shield generators create a faint outline around the station
- Drone bays appear as small hangar openings
- The station becomes increasingly complex and intimidating as you upgrade

### Weapons

| Upgrade | Description | Levels | Tier | Effect Per Level |
|---------|-------------|--------|------|-----------------|
| Beam Power | More damage per zap | 10+ | 1+ | +15% damage |
| Fire Rate | Faster manual shooting | 10+ | 1+ | +10% fire speed |
| Multi-beam | Hit multiple targets per shot | 5 | 2+ | +1 additional target |
| Super Weapon | Charged planet-killer blast | 3 | 5 | +damage, -charge time |

### Automation

| Upgrade | Description | Levels | Tier | Energy Drain |
|---------|-------------|--------|------|-------------|
| Auto-turret | Fires at nearest small target | 5 (stackable) | 2+ | Low per turret |
| Tractor Beam | Pulls in nearby debris automatically | 3 | 3+ | Medium |
| Drone Swarm | AI drones hunt and destroy for you | 5 (stackable) | 3+ | Medium per drone |
| Gravity Well | Everything nearby drifts toward you | 3 | 4+ | High |

### Energy — Generation

| Upgrade | Description | Levels | Tier | Notes |
|---------|-------------|--------|------|-------|
| Manual Generator | Click to produce energy | 10+ | 1+ | More energy per click |
| Solar Panels | Passive energy/sec | 5 (stackable) | 1-2+ | Zero drain, low output |
| Energy Amplifier | More energy from destroyed objects | 5 | 2+ | Percentage bonus |
| Fusion Reactor | High passive output | 3 | 3+ | Consumes mass as fuel — tradeoff |
| Stellar Harvester | Siphons energy from nearby stars | 3 | 4-5 | Massive output, proximity to Sun |

The Fusion Reactor deserves special note: it's the first upgrade that consumes mass to
operate. This creates an interesting decision point — you're trading growth speed for energy
independence. At Tier 3, where energy demands spike, this tradeoff feels meaningful.

### Energy — Storage

| Upgrade | Description | Levels | Tier | Notes |
|---------|-------------|--------|------|-------|
| Basic Battery | Starting energy storage | 5 | 1 | Small capacity |
| Capacitor Banks | Larger energy buffer | 5 (stackable) | 2+ | Buy multiple for more buffer |
| Power Core | Massive storage | 3 | 3+ | For sustained combat |
| Dark Energy Matrix | Near-infinite storage | 3 | 4-5 | Required for super weapon |
| Efficiency Upgrades | Reduce drain on all systems | 5 | 2+ | Percentage reduction |

Storage vs generation is its own strategic axis: generation keeps your flow positive,
storage lets you survive demand spikes (like boss fights where everything is firing at
once). Efficiency upgrades are the third option — reduce drain instead of increasing supply.

### Station Modules

| Upgrade | Description | Levels | Tier |
|---------|-------------|--------|------|
| Shield Generator | Absorb collisions without damage | 3 | 2+ |
| Thrusters | Move faster through space | 5 | 1+ |

## The Energy Balancing Act

Three upgrade paths constantly compete for the player's mass budget:

1. **Weapons & Automation** — make you more powerful and more autonomous, but increase
   energy drain
2. **Energy Generation** — increase supply to sustain more systems, but don't directly
   help you destroy things
3. **Energy Storage** — bigger buffer for demand spikes and boss fights, but doesn't
   increase throughput

The player is always balancing offense vs infrastructure. A fully upgraded weapon loadout
is useless if you can't power it. A massive energy grid is pointless if you can't
destroy anything. The sweet spot shifts as you progress:

- **Tier 1-2:** Weapons matter most — you need to be able to kill things efficiently
- **Tier 3:** Energy becomes the bottleneck — automation is expensive to run
- **Tier 4-5:** Storage becomes critical — boss fights require sustained burst power

## Energy Death (Power Failure)

When the battery hits zero, systems shut down in priority order (least critical first):

1. Drones go offline
2. Tractor beams stop
3. Auto-turrets die
4. Shields drop
5. Station disabled — engines cut, drifting, vulnerable to collisions

**Recovery:** The player frantically clicks the manual generator to produce enough energy
to restart. Systems come back online in reverse order as energy is restored — shields first
(most critical for survival), then turrets, then tractor beams, then drones.

This is not permadeath. It adds tension and consequence without frustration. The cascading
shutdown gives the player warning and time to react before full power death. A skilled
player might intentionally run at low energy, keeping fewer systems active to stretch
their power budget — a valid but risky strategy.

## Death States

There are multiple ways to die, each tied to a core mechanic:

### Collision Death

The station can collide with space objects. Collision severity depends on the relative
size of the object to your station:

- **Small objects** (much smaller than you): bounce off harmlessly, absorbed for minor mass
- **Medium objects** (comparable size): deal damage, drain energy on impact, knock you back
- **Large objects** (bigger than you): heavy damage, massive energy drain, can be lethal
  during power death

Shields absorb collision damage when active. During power death (shields offline), the
station takes full collision damage. If hit by something large enough while unshielded,
the station is destroyed.

### Gravity Death

Getting too close to a massive body without sufficient thrust and mass to escape its
gravity well drags you in and destroys you. This plays differently at each tier:

- **Tier 1:** Earth's gravity is constant. Stop thrusting upward and you sink into the
  atmosphere and burn up. This is the most immediate and persistent gravity threat.
- **Tier 2-3:** Inner planets pull you in if you get too close. Visible danger zones
  around each planet show the "point of no return" — cross it without enough thrust and
  you're caught.
- **Tier 4:** Gas giants have massive danger zones. Jupiter can grab you from surprisingly
  far out. The danger zone shrinks as you grow more massive.
- **Tier 5:** The Sun's gravity is inescapable if your thrusters fail. Energy death near
  the Sun means instant gravity death.

Gravity danger zones are visualized as subtle colored rings around massive bodies — green
(safe), yellow (you'll need thrust to escape), red (point of no return at your current
mass/thrust).

### Power Death (Cascading Shutdown)

When the battery hits zero, systems shut down in priority order — see the Energy Death
section above. Power death near a gravity well is especially lethal because thrusters
go offline, leaving you unable to resist the pull.

### Respawn

The player respawns at the start of their current tier with mass intact but energy reset
to full battery. No progress is permanently lost — you keep your upgrades and mass, you
just need to rebuild your energy buffer. This keeps death punishing but not rage-inducing.

## Camera & Scale

One continuous scene — no level transitions, no loading screens. The entire solar system
exists at once, with the camera focused on the player's station.

- **Continuous zoom:** The camera zoom level is tied to the station's current size. As
  mass accumulates, the camera smoothly pulls back. This is subtle within a tier but
  dramatic at tier transitions.
- **Tier evolution zoom:** When the player hits a tier threshold, there's a dramatic zoom-out
  moment — the camera pulls back to reveal the new scale. Objects that filled the screen
  moments ago are now tiny.
- **The Katamari moment:** The most satisfying part of the game is when something that was
  previously a boss-level threat (say, a large asteroid that took 20 hits to destroy)
  becomes so small relative to you that your auto-turrets one-shot it without you even
  noticing. The camera zoom is what sells this — you can *see* how much you've grown.
- **Zone transitions:** As the player moves through the solar system, the background and
  ambient objects shift. Near Earth: blue tint, satellite debris. Asteroid belt: dense
  rocky field. Outer system: darker, more empty, gas giant atmospheres glowing.

## Solar System Layout

The game world is a simplified representation of our solar system:

- **Near-Earth orbit** — starting zone. Space junk, defunct satellites, small asteroids.
  Earth is visible in the background but not a target (too big at Tier 1).
- **Inner planets** — Mercury, Venus, Earth, Mars. Rocky, with moons. Venus and Earth
  have atmospheres that create visual effects when destroyed.
- **Asteroid belt** — dense field between Mars and Jupiter. Target-rich farming zone.
  Great for mass accumulation.
- **Outer planets** — Jupiter, Saturn, Uranus, Neptune. Gas giants with ring systems and
  moon clusters. Saturn's rings are a spectacular destruction sequence.
- **Kuiper belt** — sparse icy objects, Pluto. Transition zone to the final area.
- **The Sun** — center of the solar system. Final boss.

Objects respawn over time in their zones (except unique objects like named planets and
moons — once destroyed, they're gone). This ensures the player always has things to
destroy even if they stay in a zone to farm.

## Technical Architecture

### Stack

- **Engine:** Phaser 3
- **Language:** TypeScript
- **Bundler:** Vite
- **Deploy:** Cloudflare Pages
- **Package Manager:** pnpm

### Why Phaser 3

- Built-in arcade physics: collision detection, overlap checks, velocity, acceleration —
  everything the movement and combat systems need
- Particle system: explosion effects, beam trails, glowing visuals — core to the vector
  aesthetic
- Camera system: smooth zoom, follow, and viewport management — essential for the
  scale-shift experience
- Sprite and graphics rendering: clean geometric shapes with WebGL performance
- Input handling: keyboard + mouse simultaneously, which the game requires
- Large community, good docs, active maintenance

### Module Architecture

| Module | Responsibility |
|--------|---------------|
| GameScene | Main Phaser scene — rendering, physics, camera, input routing |
| PlayerStation | Station entity — position, size, visual modules, tier state, collision body |
| CombatSystem | Manual firing, auto-turrets, projectile lifecycle, damage calculation |
| ResourceManager | Mass & energy tracking, generation rates, drain rates, battery state |
| UpgradeManager | Upgrade definitions, cost scaling, tier gating, purchase transactions |
| SpaceObjects | Asteroids, moons, planets — spawning, health, loot tables, destruction sequences |
| UIOverlay | HUD (energy bar, mass counter, tier indicator), upgrade shop panel, generator button |
| GravitySystem | Gravity fields per body, pull calculations, danger zone visualization |
| ZoneManager | Solar system zones, spawn tables per zone, zone transition triggers |

### How Modules Communicate

- **ResourceManager** is the central hub — CombatSystem reports kills to it, UpgradeManager
  queries it for affordability, UIOverlay reads from it for display
- **UpgradeManager** modifies CombatSystem stats (damage, fire rate), ResourceManager rates
  (generation, drain, capacity), and PlayerStation visuals (bolt-on modules)
- **ZoneManager** tells SpaceObjects what to spawn based on the player's position and tier
- **GameScene** owns the update loop and delegates to each system per frame

### Architecture Constraints

- Single HTML page, pure client-side, no backend
- State lives in memory — no save system for v1 (localStorage save is a future addition)
- No ECS framework — clean TypeScript classes with clear ownership boundaries
- Phaser's built-in arcade physics (not Matter.js) — simpler, faster, sufficient for this game
- Phaser's particle system for all visual effects
- Camera zoom handled natively by Phaser's camera system
- UI overlay rendered as Phaser UI elements (not DOM) to keep everything in the canvas

## Audio

8-bit style audio throughout. All audio assets are pre-generated and live in `assets/audio/`.
A Python generator script at `scripts/music/generate.py` produces all tracks and effects
using `midiutil` (MIDI tracks) and raw waveform synthesis (WAV sound effects).

### Music Tracks (MIDI)

MIDI files will be played back in-browser via a Web Audio MIDI renderer or converted to
OGG/MP3 during build. Three tracks cover the full game:

| Track | File | BPM | Key | Purpose |
|-------|------|-----|-----|---------|
| Main Theme | `main_theme.mid` | 130 | C minor | Exploration and general gameplay. Driving bass pulse, melodic lead with call-and-response phrasing, shimmering arpeggiated chords. Loopable. |
| Boss Theme | `boss_theme.mid` | 160 | A minor | Sun fight and major boss encounters. Aggressive staccato lead, eighth-note bass drive, frantic sixteenth-note arpeggios. Loopable. |
| Ambient Space | `ambient_space.mid` | 80 | C minor | Menu screen, pause, quiet moments. Slow sustained pads with sparse melodic fragments — like distant signals in the void. Loopable. |

Music transitions: crossfade between tracks when context changes (entering boss zone,
pausing, etc). No hard cuts.

### Sound Effects (8-bit WAV)

All effects are synthesized from square waves, triangle waves, noise, and frequency sweeps
to match the retro 8-bit aesthetic. 22050 Hz sample rate, 8-bit unsigned PCM.

| Effect | File | Technique | When Played |
|--------|------|-----------|-------------|
| Zap | `sfx_zap.wav` | Descending square wave sweep (1200→200 Hz) | Player fires manually or auto-turret fires |
| Explosion | `sfx_explosion.wav` | Noise burst mixed with 60 Hz square rumble | Object destroyed |
| Pickup | `sfx_pickup.wav` | Ascending C-E-G square arpeggio | Mass/energy debris collected |
| Power Up | `sfx_power_up.wav` | Ascending sweep (200→800 Hz) | Manual generator clicked, energy produced |
| Power Down | `sfx_power_down.wav` | Descending sweep (600→100 Hz) | System shuts down during power failure |
| Upgrade | `sfx_upgrade.wav` | Ascending sweep into sustained C major chord | Upgrade purchased |
| Game Over | `sfx_game_over.wav` | Descending minor arpeggio (A4→C4), triangle wave | Station destroyed |
| Tier Up | `sfx_tier_up.wav` | Ascending fanfare (C4→G5) into sustained major chord | Player evolves to next tier |

### Audio Implementation Notes

- Sound effects play via Phaser's built-in audio system
- Multiple zap/explosion sounds can overlap (don't cut previous instance)
- Pickup sound should be pitch-shifted slightly randomly to avoid repetition fatigue
- Power down sounds play in sequence as systems shut down during energy death
- Tier-up fanfare temporarily ducks the music track volume
- All audio should be globally mutable via a HUD toggle

## Out of Scope (v1)

- Save/load system (localStorage — planned for v2)
- Beyond our solar system (expansion content)
- Multiplayer
- Mobile touch controls
- Leaderboards
- Achievements/unlocks
- Story or narrative elements
- Settings menu (volume, controls rebinding)
