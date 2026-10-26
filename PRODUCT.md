# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences matter equally:

- **Solo public players:** strangers who open the game in a browser tab and expect a full, lively lobby right away, with no install and no wait.
- **Friend groups:** friends and classmates playing together through parties and private rooms, often on school or home laptops.

Both are a US audience.

## Product Purpose

A browser first-person shooter where every match feels like a busy public game.

Most of the "players" are reinforcement-learning bots. They have personalities, gamer tags, levels, pings, cosmetics, clans, smurfs, rage quits and AFKs, so lobbies feel full of real people. Behind that is a console-style progression loop: loadouts, camos, mastery, ranked, prestige and tournaments.

Success means that a solo player believes they're in a populated online game and keeps coming back, and that friends can jump in together instantly.

## Positioning

The game feels lively and populated without needing a player base or game servers.

- Trained bots stand in for a crowd that doesn't exist yet.
- Real players get matched together only when they actually overlap in matchmaking, which happens through public PeerJS signalling.
- It's all static hosting, with no server of its own.

## Operating Context

- **Hosting:** a Vite + React + TypeScript + three.js single-page app on Cloudflare Pages, with peer-to-peer WebRTC through PeerJS.
- **Saving:** progress lives in the browser's localStorage.
- **Session flow:** menu tabs (Play, Loadout, Armory, Profile, Settings), then matchmaking (watching the lobby fill), then the match HUD, then the end screen.
- **Playing together:** friends join by a 5-letter room code or through parties.
- **Input:** keyboard and mouse, gamepads, and touch controls.

## Capabilities and Constraints

- **Bots never look like bots in public matches.** No labels, tells or UI hints should reveal computer players. The exception is rooms with friends, where bots are deliberately labelled "Bot N" and move robotically. Leavers are always replaced by bots; nobody ever joins mid-match.
- **Weak hardware is a real target.** School Chromebooks and integrated graphics need to work. The graphics presets, the low setting and frame budgets must keep working.
- **Phones and tablets are a real use case.** Touch controls and small screens are first-class, not an afterthought.
- **The game stays clean and school-safe.**
  - Chat is strictly filtered and only appears in rooms with friends.
  - There's no gore beyond ragdolls, thrown knives and spears.
- **No server of its own.** Online play is limited to 8 humans per room, there's no lag compensation, and strict NAT or firewalls can block connections.

## Evidence on Hand

- The README documents every mode, feature and the bot-training results.
- The trained policies are in `public/policies/`.
- There are no real player counts, testimonials or press. Never invent any, including in the in-game "players online" UI copy beyond its existing simulated behaviour.

## Product Principles

1. **Believability over spectacle.** Anything that would break the illusion of a populated public game is a bug.
2. **Instant play.** Getting from the menu into a match should take seconds, with no accounts, installs or waiting on real people.
3. **Depth like a console shooter, weight like a browser game.** Go deep on progression, but every feature has to run on a school laptop and a phone.
4. **Friends first-class.** Parties and private rooms get the same quality as solo play, with clear rules (labelled bots, chat).
5. **Safe for a school-age audience.**

## Accessibility & Inclusion

Existing commitments to keep:

- colourblind modes (protanopia, deuteranopia, tritanopia);
- text and HUD scaling;
- reduce motion and reduce flashing;
- a high-contrast HUD;
- visualised sound;
- fully rebindable controls, gamepad support and touch controls.
