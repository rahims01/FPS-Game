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
| Party | Juggernaut | One armoured Juggernaut with an LMG against everyone; whoever kills it becomes the Juggernaut. One point per second as the Juggernaut, first to 100. |
| Party | One in the Chamber | A pistol with one bullet and a knife. Every hit kills, every kill earns a bullet, no reloads. Three lives, last one standing wins. |
| Party | Sharpshooter | Everyone gets the same random gun, which changes every 30 s. First to 20. |
| Party | Knife Fight / Low Gravity / Big Heads | Knives only / moon jumps / giant heads with giant headshot hitboxes. |
| Online only | Friends Free-for-all / Friends Team Deathmatch | Humans only, no computer players. |
| Online only | Hide & Seek | Seekers are blindfolded for 20 s while the hiders (knife only) hide. Found hiders become seekers. Hiders win if anyone lasts 3 minutes. Needs 3 players. |
| Online only | Hot Potato | One player holds a ticking bomb and passes it with a knife hit. Whoever holds it when it blows is out. Needs 3 players. |
| Objective | Search & Destroy | 4v4, one life per round. Attackers carry a bomb to site A or B and plant it (3.5 s); defenders stop them or defuse it (6 s) before the 35 s fuse runs out. Sides swap each round. First to 4. |
| Objective | Freeze Tag | 5v5. A killing blow freezes instead; stand next to a frozen teammate to thaw them. Freeze the whole enemy team to win the round. First to 3. |
| Team | Kill Order | Each team has a VIP (shown on everyone's minimap). Killing the enemy VIP scores. First to 8. |
| Team | Hardcore TDM | Triple damage, no health regen, no crosshair, no minimap. First to 40. |
| Free-for-all | Last Man Standing | Normal loadouts, 3 lives each; last one standing wins. |
| Special | Zombies | Endless co-op waves of melee zombies that get faster and tougher. Fallen players return next wave. |
| Special | Battle Royale | 24 players on a random 250 × 250 m map. One life, medkits, and a zone that shrinks in 6 phases. |
| Special | Survival | Endless waves. Later waves bring better guns. One life. |
| Team | Cranked | 5v5. A kill makes you faster for 30 s; fail to get another kill in time and you explode. First team to 40. |
| Team | Gunfight Roulette | 2v2, no respawns. Every round everyone gets the same random loadout. First to 5 rounds. |
| Objective | Team Defender | 5v5. Grab the flag and keep it: kills by the team holding it count double. First to 60 points. |
| Party | Weapon Roulette | Free-for-all where every life hands you a random gun. First to 20. |
| Free-for-all | Marksmen | DMRs and magnums only. First to 20. |
| Ranked | Ranked playlist | A random team mode (TDM, S&D, Domination, Hardpoint, 3v3, CTF, Kill Confirmed). See **Ranked** below. |

## Combat features

- **Weapons:** M16, AK-47 (harder hitting, harder kick), M4 Burst (3-round bursts, red dot), Vector SMG, pump shotgun (pellets), Marksman DMR (semi-auto, ring sight), bolt-action sniper (scope overlay), M60 LMG; pistol or Magnum revolver as a secondary; and a knife. Each has its own damage, fire rate, magazine, reload, spread, damage falloff, recoil and movement speed. Pick them in **Edit loadout**; you always carry a knife (V) and 2 frag grenades (G).
- **Camos:** 10 per weapon (Woodland, Desert, Arctic, Digital, Tiger, Carbon, Crimson, Neon, Gold, Diamond), unlocked by kills with that weapon (5 up to 250). Shown on your gun and to everyone else; other players sometimes carry camos too.
- **Movement:** sprint, jump, crouch (C or Ctrl) for a smaller hitbox and tighter spread, and a slide (crouch while sprinting).
- **Killstreaks:** pick any 3 in **Edit loadout**, earned by kills without dying: Adrenaline (2: full health and faster movement), UAV (3: enemies on your minimap for 30 s), Supply Drop (4: health, ammo and grenades), Counter-UAV (4: jams enemy minimaps), Airstrike (5), Cluster Strike (7: three airstrikes), Juggernaut (8: takes 45% damage) and Tactical Nuke (20: every enemy dies and your side wins).
- **Medals and XP:** headshot, double / triple / multi kill, killing spree, first blood, revenge, longshot, point blank, frag, knife, afterlife, comeback, buzzkill, captures, confirms and denies. XP is saved in your browser, with 55 levels and ranks from Recruit to Legend.
- **Feedback:** hit marker ticks and floating damage numbers (both can be turned off; headshots in yellow, kills in red), a "killed by" card (weapon, distance, the killer's remaining HP), spawn protection, positional footsteps (crouching is silent), synthesised per-weapon gunshots, explosions with smoke, scorch marks and screen shake, and ragdolls thrown by blasts.
- **Lobby feel:** about 350 hand-picked gamer tags, generated and real-name style tags, the odd `Player####` who never changed their name and rare players from abroad (other languages and scripts), a matchmaking screen, coloured nametags, and colours you pick for free-for-all modes.
- **Spectating:** when you are out (no-respawn modes, out of lives), you watch your teammates through their eyes; click or Space for the next player.
- **Post-match screen:** result, XP, your kills, deaths, damage, accuracy, headshots and best streak, the MVP, and a full scoreboard with all of those for everyone.

## Ranked

**Play ranked** on the menu queues a random team mode. After 5 placement matches you get a division: Bronze, Silver, Gold, Platinum and Diamond (each with tiers III, II, I), then Champion. Wins and losses move your skill rating (placements move it twice as far), with a small bonus or penalty for your K/D. Opponents get sharper as your rating climbs. Leaving a ranked match early counts as a loss. Everything is saved in your browser.

Controls: WASD move, mouse aim, LMB fire, RMB aim down sights, Shift sprint, Space jump, C / Ctrl crouch or slide, 1 / 2 / Q / mouse wheel switch weapon, V knife, G grenade, R reload, Tab scoreboard, Esc pause.

## Online multiplayer

Under **Play online**, click **Host game** to open a room. Send the 5-letter code to friends, who type it in and press **Join**. The host picks the mode and presses **Start**, and any empty slots are filled by computer players. In 1v1 the first friend is your opponent; in team modes friends alternate between teams.

- **Who plays:** up to 8 people per room. If there are more people than the mode has slots (say 4 friends in a 1v1), the host picks who plays (themselves included) and everyone else spectates, watching through the players' eyes.
- **Match rules:** the host can set health (half / normal / double), gravity, score to win, a weapon everyone must use, health regen, and whether empty slots get bots.
- **Bots are labelled:** in rooms with friends, the computer players are called Bot 1, Bot 2 and so on, and move like machines (no strafing, crouching or hopping; they stop to turn), so they are never mistaken for people.
- **Chat:** in the lobby, and in the match with T. Only rooms with friends have chat. Messages are filtered for swearing and slurs (including l33t spellings and s p a c e d words).

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
- **Killcam (every mode):** after you die to another player, a replay of the last few seconds from your killer's eyes, with their gun, their shots, everyone near them and your body falling. Press Space or click to skip.

## Settings

- **Graphics:** quality presets (Low, Medium, High, Ultra), with the first visit picking one to suit the device. Individual options: render resolution, shadows (off / low / high), effects density, view distance, how many ragdolls stay simulated, and anti-aliasing. Low and Medium make a big difference on older laptops and integrated graphics.
- **Controls:** every key can be rebound (a clash swaps the two keys). Also invert Y, aim-down-sights sensitivity, and toggle aim / toggle crouch.
- **Crosshair:** colour, length, gap, thickness, centre dot, and dynamic (follows spread), with a live preview.
- **HUD:** optional FPS counter and online ping, damage numbers and hit marker sound.
- **Touch controls:** on phones and tablets (automatic, or forced on or off): a floating stick, drag to look, and buttons for fire (also turns the view), aim, jump, crouch, reload, grenade, knife, swap, pause and scores.

## How the bots work

Opponents have personalities that change how they play around the trained tactics:

- **Rusher:** shotgun or SMG, sprints at you and hops while strafing.
- **Sniper:** holds angles after losing you, crouches and aims well.
- **Flanker:** swings wide around you and creeps in silently.
- **Tactician:** uses cover, grenades and retreats to heal.
- **Soldier:** all-rounder.

Rushers and tacticians also have their own fine-tuned policy (see Training); the others use the shared one.

Everyone hears footsteps (sprinting is loud, crouching is silent) and pre-aims where you were last seen. Bots jump too: over low crates, to get unstuck, and (by personality) to dodge mid-fight.

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
npm run train -- --style rusher --from latest --steps 1.2e6 --lr 3e-4
                                  # fine-tune a personality's own policy
npm run eval -- --styles          # each personality's policy vs the base one
```

Personality policies start from the base policy and add small reward nudges: rushers for closing in and hitting up close, snipers for keeping distance, flankers for hitting enemies who face away, tacticians for fighting from cover. After 1.2M steps each, rushers (53% vs 47% wins, K/D 1.63 vs 1.20) and tacticians (65% vs 62%, K/D 2.71 vs 2.32) beat the base policy, so the game loads `soldier_rusher.json` and `soldier_tactician.json`. The sniper and flanker runs did not beat it, so they use the base policy.

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
