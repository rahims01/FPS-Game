---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/ui/Hud.tsx","src/ui/EndScreen.tsx","src/index.css"]
---

# Menus, match flow and HUD

Scope: every UI surface of the game (main menu tabs Play / Loadout / Armory / Profile / Settings, matchmaking, pre-match lineup, in-match HUD and scoreboard, pause, end screen). Mode: Operate. Build path: code-led.

Audience and job: solo public players and friend groups (US, school laptops, Chromebooks, phones) picking a mode and getting into a match in seconds, then reading the match at a glance. Keep: the name STICKMAN FPS GAME (renamed from FPS SHOOTER by the user), yellow as the main colour, the five tabs and where things live. Avoid: busy neon, cartoony. Every screen matters.

Unresolved: none; the user was away for the build (stated 8 h absence), so all calls below were made unattended.

## Direction contract

THESIS: Every match is a televised event. Menus and HUD are one sports-broadcast graphics package (scorebug, lower thirds, starting lineup, final score), refusing the dark rounded-card web dashboard the game had.

OWN-WORLD: Broadcast navy ground #0b1220, panel navy #16213a, network yellow #ffc400 slabs, paper-white #f4f6f8 lower-third bars with navy type, team red #d32f3a and blue #2a6fdb tags. Saira Condensed 700/800 uppercase for labels, numerals and names; Saira for prose. Slanted cuts only on slabs, tags and bars; square corners everywhere else; no gradients, glows or pills. Yellow only on the one primary action per screen, the active tab mark and your own identity. State is carried by form as well as colour (solid live, dashed pending, struck locked).

STORY: The player reads their level and the live player count off a scorebug, picks a mode from lower-third bars, hits the yellow FIND MATCH slab, watches the roster fill like a pregame, gets a starting-lineup slam, plays under a scorebug HUD, and ends on a final-score card.

FIRST VIEWPORT: Top scorebug strip: yellow STICKMAN FPS GAME slab at left, navy tab bar with the five tabs (active tab underlined in yellow), red LIVE tag and players online at right. Left column: mode groups as stacked lower-third bars (team-size tag plus white bar with mode name and rule; the selected bar turns yellow). Right 400 px column: level card with a big yellow numeral and XP bar, ranked card (Team, 1v1, tournament), lobby segmented control, the yellow FIND MATCH slab naming the mode, then Create party / Host game / Join.

FORM: Broadcast Package, the top of my ordered list (Impeccable's pick, chosen by the user over the rolled Heavy Equipment). seed:fe348c7e4ee554f0. Signature interaction: the wipe, lower-third bars and lineup rows slide in along their slant on tab change, match start and end, staggered; score numerals in the scorebug tick when they change. Reduced motion turns the wipe into a fade.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
