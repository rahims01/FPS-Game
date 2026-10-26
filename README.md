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
| Practice | Training Range | A 70 m range with target dummies at 10, 25 and 45 m (the middle lanes strafe), a bench to shoot from and crates to practise peeks. Nobody shoots back; B swaps to the next gun. |
| Practice | Aim Trainer | 60 seconds: three targets around the range, and each one you drop reappears somewhere else. Your best score is saved. |
| Practice | Free Roam | A big random map with nobody hunting you. Explore, practise movement, try guns (B). Friends can join online. |
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
| Special | Battle Royale Duos / Trios | 24 players in 12 pairs or 8 squads of three, landing apart on the 250 m map. Squadmates regroup. If you die you redeploy next to a squadmate after 30 s, as long as one of them is alive; the last squad standing wins. |
| Friends only | Paintball | Two teams of friends, one paint hit and you're out until you respawn. Shots splat the shooter's colour. First to 30. |
| Friends only | Boss Fight | Co-op against a 2.3× size armoured boss with an LMG. At two thirds health it calls airstrikes, at one third it calls minions. Three lives each. |
| Team | Cranked | 5v5. A kill makes you faster for 30 s; fail to get another kill in time and you explode. First team to 40. |
| Team | Gunfight Roulette | 2v2, no respawns. Every round everyone gets the same random loadout. First to 5 rounds. |
| Objective | Team Defender | 5v5. Grab the flag and keep it: kills by the team holding it count double. First to 60 points. |
| Party | Weapon Roulette | Free-for-all where every life hands you a random gun. First to 20. |
| Free-for-all | Marksmen | DMRs and magnums only. First to 20. |
| Ranked | Ranked playlist | A random team mode (TDM, S&D, Domination, Hardpoint, 3v3, CTF, Kill Confirmed). See **Ranked** below. |

## Combat features

- **Weapons:** 12 primaries (M16, AK-47, SCAR-H, M4 Burst, Vector, Uzi, pump shotgun, Saiga auto shotgun, Marksman DMR, bolt-action sniper, .50 cal, M60 LMG) and 4 secondaries (pistol, Magnum, Desert Eagle, machine pistol), plus a knife. The loadout screen shows a turning 3D preview with your camo and a stats screen (damage, fire rate, range, accuracy, control, mobility, time to kill) compared with your equipped gun. Each has its own damage, fire rate, magazine, reload, spread, damage falloff, recoil and movement speed. Pick them in **Edit loadout**; you always carry a knife (V) and 2 frag grenades (G).
- **Camos:** 40 per weapon, unlocked by kills with that weapon (5 up to 500), with rarity colours:
  - classic and exotic patterns (Woodland, Urban, Jungle, Leopard, Marble, Walnut, Cherry Blossom, Zebra, Hex, Ocean, Glacier, Rainbow, Toxic, Lava, Dragon Scale, Galaxy, Bloodstone, Spectral, Gold, Diamond, Emerald, Obsidian...);
  - **animated** camos that move on their own (Plasma, Digital Rain, Aurora Shift, Magma, Neon Pulse);
  - **reactive** camos that change with your kills this match (Bloodline turns red, Ember heats up, Frostbite ices over);
  - **mastery rewards:** Damascus at Gold mastery (200 kills) and an animated Dark Matter at Diamond (500).
- **Weapon charms** hang off your gun. Everyone sees your camos and charms.
- **Throwables:** pick a lethal (frag, molotov, throwing knife, spear) and a tactical (flashbang, smoke). Knives and spears stick in whoever they hit, even through the ragdoll. Molotovs leave fire on the ground; smoke blocks sight; flashbangs white out anyone looking at them.
- **Perks:** pick 3 of 11: Ghost, Quick Hands, Marathon, Ninja, Lightweight, Scavenger, Hardline, Cold-Blooded, Flak Jacket, Steady Aim, Tactical Mask.
- **Hit reactions:** soldiers flinch away from the side they were hit on, head shots snap the head back, leg shots buckle the knees, and bigger guns hit harder.
- **Night maps:** some matches are at night: a dark sky, a flashlight on your gun and visible beams from everyone else's.
- **Movement:** sprint, jump, crouch (C or Ctrl) for a smaller hitbox and tighter spread, and a slide (crouch while sprinting).
- **Killstreaks:** pick any 3 in **Edit loadout**, earned by kills without dying: Adrenaline (2: full health and faster movement), UAV (3: enemies on your minimap for 30 s), Supply Drop (4: health, ammo and grenades), Counter-UAV (4: jams enemy minimaps), Airstrike (5), Cluster Strike (7: three airstrikes), Juggernaut (8: takes 45% damage) and Tactical Nuke (20: every enemy dies and your side wins).
- **Medals and XP:** headshot, double / triple / multi kill, killing spree, first blood, revenge, longshot, point blank, frag, knife, afterlife, comeback, buzzkill, captures, confirms and denies. XP is saved in your browser, with 55 levels and ranks from Recruit to Legend.
- **Feedback:** hit marker ticks and floating damage numbers (both can be turned off; headshots in yellow, kills in red), a "killed by" card (weapon, distance, the killer's remaining HP), spawn protection, positional footsteps (crouching is silent), synthesised per-weapon gunshots, explosions with smoke, scorch marks and screen shake, and ragdolls thrown by blasts.
- **Lobby feel:** about 850 hand-picked gamer tags (recently seen names are avoided, so lobbies don't repeat), generated and real-name style tags, the odd `Player####` who never changed their name and rare players from abroad (other languages and scripts), a matchmaking screen where you watch the lobby fill (with each player's level and ping), a live players-online count, coloured nametags, and colours you pick for free-for-all modes.
- **Public-server life:** in matchmade games, pings drift on the scoreboard, a player or two is still loading in at the start, and, rarely, someone on a side that is getting crushed rage-quits after dying; a robotic "Bot N" plays their slot for the rest of the match (nobody joins mid-match). Players also teabag, check corners, and bunny-hop between fights. Now and then a smurf (a low level who plays like a pro) or a squad of friends with a shared clan tag turns up, and late in a long match someone may go AFK for a bit. (Online rooms with friends turn all of this off: bots there are labelled and robotic.)
- **Spectating:** when you are out (no-respawn modes, out of lives), you watch your teammates through their eyes; click or Space for the next player.
- **Post-match screen:** result, XP, your kills, deaths, damage, accuracy, headshots and best streak, the MVP, and a full scoreboard with all of those for everyone.

## Armory and cosmetics

- **Armory:** a turning 3D view of your soldier with your colour, style, gun, camo and charm, plus name tag, tracer and muzzle flash pickers.
- **Colours:** 12 basics plus 17 unlockable themed colours (Chrome, Gold, Neon Pink, Lava, Ice, Obsidian, Royal Purple, Champion Gold...).
- **Soldier styles** on top of your colour:
  - finishes (matte, metallic, glow);
  - patterns in your colour (stripes, checker, polka dots, camo, zebra, tiger, digital, hex armour, circuit, starfield);
  - animated (rainbow, monochrome, holographic, glitch, lava flow, electric, pulse, aurora, ghost);
  - interactive: Heartbeat pulses faster as your health drops, Killstreak Heat glows hotter, Chameleon fades to the ground colour when you stand still, Thermal shows your speed, Shockwave flashes when you're hit, Trophy turns golden with each kill.
  In team modes, styles that change colour pulse in the team colour instead, so teams stay readable.
- **Name tag styles** (gold plate, neon, frozen, on fire, royal, rainbow...), **tracer colours** (including rainbow) and **muzzle flash** styles (including Dragon's Breath).
- **Rarity** colours on everything (common, rare, epic, legendary, mythic), and **secret** items that stay "???" until you earn them.
- **Prestige:** at level 55, go back to level 1 with a prestige rank (up to 10), keeping every unlock and getting prestige cards, emblems, frames, titles, colours and styles.
- **Titles** and **level frames** show on your calling card and the scoreboard.
- **Pre-match lineup:** both teams' calling cards (title, level, frame, prestige) before the match starts. Skip with Space or a click.
- Matchmade players wear all of this too: unlocks that match their level, sometimes prestige ranks, rarely tournament rewards.

## Profile

- **Calling card and emblem:** shown on the killcam's "killed by" card, the end screen MVP and your profile. 21 cards and 24 emblems, unlocked by levels and badges.
- **Badges:** 28 to earn (First Blood, Headhunter, Knife Master, Bullseye, Firestarter, Tactical Nuke, Flawless, Champion, Giant Slayer, Clutch, Diamond Hands...), with progress bars.
- **Weapon mastery:** Bronze, Silver, Gold and Diamond per gun (25, 75, 200, 500 kills); your best shows by your name on the scoreboard.
- **Stats:** lifetime kills, headshots, best streak, throwing kills and more.

## Ranked and tournaments

There are two ranked queues with separate ratings: **Team** (a random team mode) and **1v1** duels.

**Gunfight tournament:** an 8-team bracket of 2v2 Gunfight Roulette (first to 3 rounds), with quarterfinals, semifinals and a final. You and a teammate play your matches; the rest of the bracket plays out around you. Lose once and you're out. Winning gives XP and exclusive rewards (title, card, frame, colour, name tag, style).

**Play ranked** queues the chosen queue. After 5 placement matches you get a division: Bronze, Silver, Gold, Platinum and Diamond (each with tiers III, II, I), then Champion. Wins and losses move your skill rating (placements move it twice as far), with a small bonus or penalty for your K/D. Opponents get sharper as your rating climbs. Leaving a ranked match early counts as a loss. Everything is saved in your browser.

Controls: WASD move, mouse aim, LMB fire, RMB aim down sights, Shift sprint, Space jump, C / Ctrl crouch or slide, 1 / 2 / Q / mouse wheel switch weapon, V knife, G grenade, R reload, Tab scoreboard, Esc pause.

## Online multiplayer

Under **Play online**, click **Host game** to open a room. Send the 5-letter code to friends, who type it in and press **Join**. The host picks the mode and presses **Start**, and any empty slots are filled by computer players. In 1v1 the first friend is your opponent; in team modes friends alternate between teams.

- **Real players in matchmaking:** when you press Find Match, the game also looks for other real players searching for the same mode and lobby right now, through the same public PeerJS service (so it still works on Cloudflare Pages with no server). If two people search together they're put in the same match, on random teams, with the rest of the lobby filled as usual and nobody labelled. With only a few people playing this almost never happens; the more people play at once, the more often it does.
- **Parties:** "Create party" lets friends queue into normal matchmade games together, on the same team. The leader picks the mode and the rest of the lobby is filled like any other match.
- **Back to the lobby:** after an online match the host can take everyone back to the room for another game.
- **Who plays:** up to 8 people per room. If there are more people than the mode has slots (say 4 friends in a 1v1), the host picks who plays (themselves included) and everyone else spectates, watching through the players' eyes.
- **Match rules:** the host can set health (half / normal / double), gravity, score to win, a weapon everyone must use, health regen, and whether empty slots get bots.
- **Leavers are replaced by bots:** if someone leaves mid-match (or their game stops responding for 15 s), a robotic bot named "Bot N" takes over their soldier, and everyone sees the new name. Matchmade games do the same: a quitter's slot goes to a robotic "Bot N" for the rest of the match.
- **Bots are labelled:** in rooms with friends, the computer players are called Bot 1, Bot 2 and so on, and move like machines (no strafing, crouching or hopping; they stop to turn), so they are never mistaken for people.
- **Chat:** in the lobby, and in the match with T. Only rooms with friends have chat. Messages are filtered for swearing and slurs, including look-alike characters (sh1t, n!gga, Cyrillic letters), masked or split letters (f*ck, f ck, sh it, f u c k), repeated letters, common misspellings and invisible characters, without catching words like "class" or "cocktail".

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

- **Graphics:** quality presets (Low, Medium, High, Ultra). The first visit picks one to suit the device (Chromebooks, low-memory devices and weak or software graphics start on Low). Individual options:
  - render resolution, shadows (off / low / high), effects density, view distance, how many ragdolls stay simulated, and anti-aliasing;
  - **simplified soldiers** (on with Low): low-detail soldier bodies and guns (about 3,700 and 2,900 triangles instead of 50,000 and 22,000), no animation for soldiers out of view, and fewer animation updates for distant ones. This is the big one for 5v5 and bigger lobbies on weak devices.
- **Adjust automatically** (on by default): if a match keeps running under about 40 fps, the game steps down by itself (High, then Medium, then Low, then a lower resolution), says so on screen and saves it. Fast devices never trigger it. Picking a preset yourself turns it off.
- **Controls:** every key can be rebound (a clash swaps the two keys). Also invert Y, aim-down-sights sensitivity, and toggle aim / toggle crouch.
- **Crosshair:** colour, length, gap, thickness, centre dot, and dynamic (follows spread), with a live preview.
- **HUD:** optional FPS counter and online ping, damage numbers and hit marker sound.
- **Controllers:** Xbox, PlayStation and other standard gamepads, with aim assist, adjustable sensitivity and deadzone, and D-pad navigation in the menus.
- **Display:** a frame-rate limit (30 to 144, or the display's rate) and a V-sync toggle.
- **Accessibility:** colourblind modes (protanopia, deuteranopia, tritanopia), text and HUD size, reduce motion, reduce flashing, high-contrast HUD, and visualised sound (arrows for nearby gunfire, explosions and enemy footsteps).
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
