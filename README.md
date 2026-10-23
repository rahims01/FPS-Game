# FPS Shooter

First-person shooter built with Vite, React, TypeScript, three.js and cannon-es. The bots are trained with reinforcement learning (PPO). Bodies ragdoll when they die, the player's included.

Several parts are reused from the sibling **Battle Simulator** (TribeSim) project:

- the Mixamo stickman rig and its animation clips
- the M16 model
- the cannon-es ragdoll system
- the skin-weight fix and the prop-normalising code

## Run

```
npm install
npm run dev        # http://localhost:5190
npm run build      # type-check + production build
```

## Modes

| Group | Mode | Rules |
| --- | --- | --- |
| Team | Team Deathmatch | 5v5 with respawns on a random map. First team to 40 kills. |
| Team | Kill Confirmed | 5v5. A kill only counts when someone grabs the dropped dog tag. Grabbing your own team's tag denies it. First to 30. |
| Team | 1v1 Duel / 2v2 / 3v3 Gunfight | No respawns within a round. First to 5 rounds. Sides swap every round. |
| Objective | Capture the Flag | 5v5. Grab the enemy flag and bring it to your base while your own flag is home. Dropped flags can be returned by touching them, or auto-return after 20 s. First to 3 captures. |
| Objective | Domination | 6v6. Capture flags A, B and C. Each held flag scores 1 point per second. First to 150. |
| Objective | Hardpoint | 4v4. Only a team holding the hill alone scores. The hill moves every 45 s. First to 60. |
| Objective | Infected | One random player starts infected, with a knife and extra speed. Anyone they kill joins them. Survivors win if anyone lasts 3 minutes. |
| FFA | Free-for-all | 8 players on a random map, with a live kill leaderboard. First to 20. |
| FFA | Gun Game | Two kills per gun up the ladder: pistol, SMG, shotgun, rifle, LMG, sniper, knife. A knife kill wins. Getting knifed drops you a tier. |
| FFA | Snipers Only / Headhunters / One Shot | Bolt-action only (first to 15) / only headshots count (first to 15) / any hit kills (first to 25). |
| Special | Battle Royale | 24 players on a random 250 × 250 m map. One life, medkits, and a zone that shrinks in 6 phases. |
| Special | Survival | Endless waves. Later waves bring better guns. One life. |

## Combat features

- **Weapons:** M16 rifle, SMG, pump shotgun (pellets), bolt-action sniper (scope overlay), M60 LMG, pistol and knife. Each has its own damage, fire rate, magazine, reload, spread, damage falloff, recoil and movement speed. Pick your primary on the menu; you always carry a pistol, a knife (V) and 2 frag grenades (G).
- **Movement:** sprint, jump, crouch (C or Ctrl) for a smaller hitbox and tighter spread, and a slide (crouch while sprinting).
- **Killstreaks**, awarded for kills without dying: 3 = UAV (every enemy shows on the minimap for 30 s), 5 = Airstrike (strikes on every enemy, locking on 0.6 s before impact), 8 = Juggernaut armour (takes 45% damage).
- **Medals and XP:** headshot, double / triple / multi kill, killing spree, first blood, revenge, longshot, point blank, frag, knife, afterlife, comeback, buzzkill, captures, confirms and denies. XP is saved in your browser, with 55 levels and ranks from Recruit to Legend.
- **Feedback:** a "killed by" card (weapon, distance, the killer's remaining HP), spawn protection, positional footsteps (crouching is silent), synthesised per-weapon gunshots, explosions with smoke, scorch marks and screen shake, and ragdolls thrown by blasts.
- **Lobby feel:** about 350 hand-picked gamer tags plus a tag generator, a matchmaking screen, coloured nametags, and colours you pick for free-for-all modes.

Controls: WASD move, mouse aim, LMB fire, RMB aim down sights, Shift sprint, Space jump, C / Ctrl crouch or slide, 1 / 2 / Q / mouse wheel switch weapon, V knife, G grenade, R reload, Tab scoreboard, Esc pause.

## Online multiplayer

Under **Play online**, click **Host game** to open a room. Send the 5-letter code to friends, who type it in and press **Join**. The host picks the mode and presses **Start**, and any empty slots are filled by computer players. In 1v1 the first friend is your opponent; in team modes friends alternate between teams.

- **Host-authoritative peer-to-peer:** WebRTC through [PeerJS](https://peerjs.com). The host's browser runs the real match and sends snapshots 20 times a second.
- **Clients:** each moves their own soldier locally, so movement feels instant, and sends position and buttons to the host 30 times a second. Hits, deaths, scores and objectives are decided by the host.
- **No server of our own**, so it works on static hosting such as Cloudflare Pages. Only the public PeerJS signalling service is used, to introduce the browsers to each other.
- **Background tabs:** if the host switches tabs, a background worker keeps the match running. If the host leaves, clients see "Lost connection to the host" within about 6 seconds.
- **Limitations:**
  - Up to 8 humans.
  - No lag compensation: you shoot at where players are on the host.
  - Some strict networks (certain school or office firewalls, symmetric NAT) block direct peer-to-peer connections. That would need a TURN relay server.

Test: `node scripts/mp-test.mjs "1v1 Duel"` drives a host tab and a guest tab in headless Edge.

## Feel

- **Per-gun recoil patterns:** sustained fire climbs and drifts in a fixed, learnable pattern for each weapon (the rifle drifts right then left, the SMG zig-zags, the LMG starts slow then climbs hard). Pull against it. The pattern resets when you stop firing.
- **Ragdoll push:** bodies are carried along the shot and twisted at the hit point. Shotguns and snipers push harder, and explosions launch bodies, all within a speed cap.
- **Killcam (1v1 only):** after you die, a replay of the last few seconds from your killer's eyes, with their gun, their shots and your body falling. Press Space or click to skip.

## How the bots work

Opponents have personalities that change how they play around the trained tactics:

- **Rusher:** shotgun or SMG, sprints at you and hops while strafing.
- **Sniper:** holds angles after losing you, crouches and aims well.
- **Flanker:** swings wide around you and creeps in silently.
- **Tactician:** uses cover, grenades and retreats to heal.
- **Soldier:** all-rounder.

Everyone hears footsteps (sprinting is loud, crouching is silent) and pre-aims where you were last seen.

```
src/sim/            pure TypeScript, no three.js: runs in the browser AND headless in Node
  FpsSim.ts         60 Hz movement, hitscan with head/torso/leg hitboxes, perception, bot motor
  Arena.ts          box obstacles, grid-accelerated raycasts, A* nav grid, cover points
  layouts.ts        the hand-built arena + seeded random map generator
  Match.ts          mode rules: rounds, waves, respawns, battle-royale zone and medkits
  observation.ts    39-number egocentric observation (OBS_VERSION 1)
  heuristicBrain.ts hand-written baseline (fallback, and the trainer's opponent)
src/rl/             MLP inference + PolicyBrain (loads public/policies/soldier.json)
training/           PPO trainer (worker threads), environment, evaluation
src/render/         soldier views (locomotion clips + arm IK + ragdoll), viewmodel, effects
```

Every 0.1 s each bot picks one of 8 high-level actions: `hold, advance, strafe_left, strafe_right, retreat, sprint, take_cover, reload`. The motor layer turns that action into movement, pathfinding, aiming (with human-like aim error and reaction time) and fire. The policy learns the tactics: when to push, when to strafe, when to break line of sight and when to reload.

Two survival behaviours sit outside the action space: returning to the zone, and picking up a nearby medkit when hurt. They override the policy only when no enemy is in view.

Animation: the Mixamo idle, walk and run clips drive the body, and the whole body turns to face the aim. There are no rifle clips (`rifle anims/` in Battle Simulator was empty), so a two-bone IK puts the hands on the rifle's grip and handguard, with a reload motion. On death the same skeleton goes to the ragdoll.

## Training

```
npm run train                     # 3M steps from scratch, ~15 min on 8 threads
npm run train -- --steps 6e6      # longer
npm run train -- --resume         # continue from training/checkpoints/latest.json
npm run eval                      # policy vs heuristic, per scenario
```

The trainer uses a random mix of training scenarios: duels on the arena and on random maps, 2v2, 3v3 and 4-player free-for-all. Opponents get sharper over the run (a curriculum). Reward is damage dealt minus damage taken (per 100 HP), plus 1 per kill, minus 1 per death, plus a win bonus and a small time penalty.

Each run writes `public/policies/soldier.json`. The game loads it on start and shows the step count on the menu. If you change the observation layout or the action list, bump `OBS_VERSION`. The game will then refuse the stale policy until you retrain.

Current policy (4M steps), 150 episodes per row, against opponents at aim skill 1.0:

| Scenario | Heuristic win % | Policy win % | Policy K/D |
| --- | --- | --- | --- |
| Duel (arena) | 45 | 80 | 4.0 |
| Duel (random map) | 41 | 83 | 5.0 |
| 2v2 | 42 | 72 | 4.1 |
| 3v3 | 32 | 58 | 3.5 |
| FFA (4) | 28 | 49 | 2.8 |

## Visual smoke test

Start headless Edge with `--remote-debugging-port=9334`, run `npm run dev`, then:

```
node scripts/shot.mjs <1v1|2v2|3v3|ffa|survival|br> [outDir]
```

The script loads `puppeteer-core` from the Battle Simulator project if it isn't installed here.
