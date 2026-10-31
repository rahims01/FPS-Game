---
name: Stickman FPS Game
description: A browser FPS whose menus and HUD are one sports-broadcast graphics package.
colors:
  navy: "#0b1220"
  panel: "#16213a"
  panel-2: "#1e2c4b"
  line: "#26365a"
  line-2: "#3a4d75"
  paper: "#f4f6f8"
  paper-ink: "#3b4a60"
  ink: "#0b1220"
  fg: "#f4f6f8"
  dim: "#a9b8cf"
  mute: "#8798b4"
  yellow: "#ffc400"
  yellow-hi: "#ffd23d"
  yellow-ink: "#4d3b00"
  red-slab: "#d32f3a"
  blue-slab: "#2a6fdb"
  red: "#ff5d62"
  blue: "#5aa0ff"
  green: "#45d483"
  hud: "rgba(11, 18, 32, 0.86)"
  tag-practice: "#4a5872"
  tag-freeforall: "#0e8460"
  tag-party: "#7440c0"
  tag-special: "#c1501a"
typography:
  display:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  headline:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  title:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1.05
  numeral:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "'tnum' 1"
  body:
    fontFamily: "Saira, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.3
  caption:
    fontFamily: "Saira, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.3
  label:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
  label-tracked:
    fontFamily: "'Saira Condensed', 'Arial Narrow', sans-serif"
    fontSize: "14px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.14em"
rounded:
  none: "0px"
  round: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  card: "28px"
  gutter: "32px"
components:
  button-primary:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "14px 22px"
  button-primary-hover:
    backgroundColor: "{colors.yellow-hi}"
    textColor: "{colors.ink}"
  button-primary-disabled:
    backgroundColor: "{colors.line}"
    textColor: "{colors.dim}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "7px 14px 6px"
  chip-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.dim}"
    typography: "{typography.label}"
    padding: "4px 16px 0"
  tab-active:
    textColor: "{colors.fg}"
  segmented-option-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "10px 0 9px"
  lower-third:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "7px 16px 7px 26px"
    height: "60px"
  lower-third-selected:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
  rail-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.none}"
    padding: "16px 18px"
  menu-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.none}"
    padding: "{spacing.card}"
  input-name:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.fg}"
    rounded: "{rounded.none}"
    padding: "6px 8px 4px"
  level-tag:
    backgroundColor: "{colors.line-2}"
    textColor: "{colors.fg}"
    rounded: "{rounded.none}"
    padding: "1px 5px 0"
  team-tag:
    backgroundColor: "{colors.line-2}"
    textColor: "{colors.fg}"
    typography: "{typography.label-tracked}"
    padding: "5px 30px 3px 14px"
---

# Design System: Stickman FPS Game

## Overview

**Creative North Star: "The Broadcast Package"**

Every match is a televised event. The menus and the in-match HUD are one sports-TV graphics set: a scorebug strip across the top of the menu, lower-third bars for the modes, a pregame roster that fills like a studio pre-show, a starting-lineup slam before the match, a scorebug over the game, and a final-score card at the end. The system rejects the dark, rounded-card web dashboard the game used before. Nothing is soft, floating or glowing. Graphics are flat plates of colour with hard edges that slide in.

Density is broadcast density. Big condensed numerals and names, short uppercase labels, and one sentence of plain prose where a rule needs explaining. The ground is deep navy. Information sits on paper-white plates with navy type, the way a lower third reads over any footage. Network yellow is scarce and always means "this is the action" or "this is you". Team red and blue appear only as tags and slabs.

Motion is the signature. Bars, tags and lineup rows wipe in along their own slant, staggered. Numbers that change roll up into place. With reduced motion, every wipe becomes a short fade.

**Key Characteristics:**
- Navy ground, paper-white plates, one network-yellow action per screen.
- Saira Condensed 700/800 uppercase for every label, name and numeral; Saira for prose.
- Square corners everywhere; the slanted cut appears only on slabs, tags and bars.
- State shown by form as well as colour: solid live, dashed pending, struck through locked.
- The wipe and the number tick are the only motion vocabulary.

## Colors

A broadcast palette: dark navy studio ground, paper-white graphics plates, a single network yellow, and team red and blue confined to tags.

### Primary
- **Network Yellow** (yellow): the primary action slab (FIND MATCH, PLAY AGAIN), the active tab underline, the selected lower-third bar, the network slab at the left of the scorebug, the XP bar, the slider thumb, the focus ring and text caret, and anything that is the player's own (own row tint in tables, own room code). Hover lifts to **Broadcast Yellow Hi** (yellow-hi). Small text set on yellow uses **Yellow Ink** (yellow-ink), never grey.

### Secondary
- **Team Red Slab** (red-slab): the red team tag, the LIVE tag, the DEFEAT plate, low-health vitals. Solid plates carrying white type.
- **Team Blue Slab** (blue-slab): the blue team tag and team-mode group tags.
- **Signal Red / Signal Blue** (red, blue): the text-weight versions of the team colours for names, deltas and kill-feed entries on navy. Colourblind modes remap all four team tokens; never hard-code team hues.

### Tertiary
- **Mode Group Tags** (tag-practice, tag-freeforall, tag-party, tag-special): the fixed colours of the team-size tag on each lower-third bar, one per mode group. They live only on those tags.
- **Live Green** (green): the found state (match found square, filled lobby bar), good ping, rank up.

### Neutral
- **Studio Navy** (navy): page ground, input wells, stat-card wells, and the ink colour (ink) on paper and yellow.
- **Panel Navy** (panel) and **Panel Navy Raised** (panel-2): cards, the rail, the tab bar plate; panel-2 is the hover step for tiles.
- **Rule Lines** (line, line-2): dividers and empty bar tracks (line); chip outlines, level tags, neutral team tags, scrollbar thumb (line-2).
- **Paper** (paper / fg): lower-third plates, selected chips and segments, primary text on navy.
- **Paper Ink** (paper-ink): secondary text on paper plates.
- **Dim / Mute** (dim, mute): secondary text and inactive tabs on navy (dim); disabled chip text and scrollbar hover (mute).
- **HUD Glass** (hud): the translucent navy behind in-match readouts so the game stays visible.

### Named Rules
**The One Slab Rule.** Each screen carries exactly one yellow primary-action slab. Secondary actions are outlined chips, never a second yellow button.

**The Yellow Means You Rule.** Outside the primary action and the active marks, yellow only ever marks the player: your row, your XP, your code. It never decorates.

**The Team Token Rule.** Team colour comes from red, blue, red-slab and blue-slab only, so the colourblind overrides reach every surface.

## Typography

**Display Font:** Saira Condensed (with 'Arial Narrow', sans-serif), self-hosted at 600/700/800
**Body Font:** Saira (with system-ui, -apple-system, 'Segoe UI', sans-serif), self-hosted at 400/500/600

**Character:** A condensed sports-graphics face doing all the shouting, a plain humanist sibling doing all the explaining. Numerals are tabular everywhere.

### Hierarchy
- **Display** (800, 64px, line-height 1, uppercase): the final-result plate (VICTORY / DEFEAT) and the pregame count; 44px on phones.
- **Headline** (800, 34px, line-height 1, uppercase): overlay and pregame headings; the lineup plate runs 46px and the scorebug network slab 34px.
- **Title** (800, 21px, line-height 1.05, uppercase): mode names on lower-third bars, calling-card names, rank names (19-23px).
- **Numeral** (800, 28-42px, tabular): scorebug scores, end-screen score plates, stat values, the big level number (40px). These tick when they change.
- **Body** (400, 15px): mode rules, explanatory lines. Long explanations cap at 70ch.
- **Caption** (400, 12-13px, dim): sub-lines, settings hints, stat captions.
- **Label** (700, 15-19px, 0.04-0.08em, uppercase): chips, tabs, segments, table heads, stat rows.
- **Label Tracked** (800, 13-17px, 0.12-0.16em, uppercase): names that title a real block of content (rail card heads, mode group names, team tags, the HUD mode name, stat-card heads). Never a decorative line above a heading.

### Named Rules
**The Condensed Voice Rule.** Anything a broadcaster would put on screen (labels, names, numbers, buttons) is Saira Condensed uppercase. Sentences are Saira in sentence case.

**The Tabular Rule.** Every number is tabular (`font-variant-numeric: tabular-nums` is set on the root) so ticking scores never jitter.

## Layout

The menu is a centred shell up to 1320px wide with 32px gutters. A sticky scorebug strip (64px tall) runs across the top: the yellow network slab, the slanted navy tab plate, and the LIVE count pushed to the right. The Play tab is a two-column desk: lower-third mode bars in an auto-fill grid (minimum 400px columns, 8px row gap, 14px column gap) on the left and a 380px right rail of stacked cards (12px gap) on the right. Other tabs use a single column capped at roughly 820px.

Overlays (pregame, pause, settings, end screen) centre a square card on a 74% navy scrim: 860px wide by default, 460-520px for small dialogs, 980px for the final score. Card padding is 28px.

The spacing rhythm is 4 / 8 / 12 / 16 / 24 / 28 / 32px, with 8px the default gap inside grids and between tiles.

Responsive steps are 1120px (rail narrows to 330px), 880px (single column; rail moves above the modes; LIVE count shortens), 760px (lineup stacks vertically, VS drops), and 640px (12px gutters; the tab plate drops to its own full-width row without its cut; mode grid goes to one column; end-screen tables keep name plus three stats and drop the MVP chip because the MVP card already names them). In the HUD at 640px the scorebug moves right of the minimap.

## Elevation & Depth

The world is flat. Depth comes from tonal layering, navy to panel to panel-2, and from paper plates sitting over navy. There is one ambient shadow, under overlay cards, so they lift off the dimmed game. In the HUD a soft text shadow keeps readouts legible over 3D scenes; any readout on a solid plate turns it off.

### Shadow Vocabulary
- **Overlay lift** (`box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45)`): menu and overlay cards only.
- **Active underline** (`box-shadow: inset 0 -4px 0 var(--yellow)`): the active main-menu tab. It is a mark, not depth.
- **HUD legibility** (`text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7)`): free-floating HUD text over the game.

### Named Rules
**The Plates Not Shadows Rule.** UI chrome separates by plate colour, not by shadow. The only lift is the overlay card.

## Shapes

Every UI corner is square (0px). The one silhouette is the broadcast cut, a slant on the trailing edge (or the leading edge for right-side or joining pieces): 14px on large slabs (primary action, network slab, tab plate, lineup and final-result plates; 18px on the final-result plate), 12px on tags and bars, 10px on small HUD tags. Pieces that join, such as a team-size tag and its paper bar, overlap so their cuts interlock. The slider thumb is a square pointer with a cut point.

Round shapes exist only where the thing is physically round: touch thumb sticks and buttons, the scope ring, markers. Locked items are greyed and struck through; pending items take a dashed outline.

### Named Rules
**The Cut Belongs to Slabs Rule.** The slant is only for slabs, tags and bars. Cards, tiles, inputs and chips stay plain rectangles.

## Components

### Buttons
Hard, loud and singular.
- **Shape:** square with the 14px trailing cut.
- **Primary:** network yellow slab, navy Saira Condensed 800 at 24px (36px on the FIND MATCH slab, with a 15px yellow-ink sub-line naming the mode), 0.06em tracking, full width in the rail.
- **Hover / Focus:** hover lifts to yellow-hi, active presses to a deeper yellow; focus is the 2px yellow outline at 2px offset used by every control.
- **Disabled:** line-coloured plate with dim text.
- **Secondary:** outlined chip (below). There is no ghost or second filled style.

### Chips
- **Style:** transparent, 2px line-2 outline, condensed 700 uppercase 15px.
- **State:** hover turns the outline paper; selected fills paper with navy text; disabled goes dashed with mute text. Key-binding chips keep their case.

### Segmented control
A panel plate with 4px padding holding three equal options; the selected option fills paper with navy text.

### Cards / Containers
- **Corner Style:** square.
- **Background:** panel on navy; stat wells inside cards drop back to navy.
- **Shadow Strategy:** none, except the overlay lift.
- **Border:** none; the prestige offer and ranked result carry a 2px coloured frame.
- **Internal Padding:** 16-18px for rail cards and tiles, 28px for overlay cards.

### Inputs / Fields
- **Style:** navy well, no box, a 2px line-2 bottom rule, condensed 700 at 22px.
- **Focus:** the bottom rule turns yellow.
- **Sliders:** 6px line-2 track with the yellow cut-point thumb.

### Navigation
- **Main tabs:** condensed 700 uppercase 19px, dim at rest, fg on hover, fg with the 4px yellow underline when active, all inside the slanted panel plate of the scorebug.
- **Sub-tabs:** 18px, the same states, a 4px yellow bottom border on a 2px line rule.
- **Mobile:** at 640px the tab plate becomes a full-width 48px row that scrolls horizontally.

### Lower-third Mode Bar (signature)
A coloured team-size tag (96px, 12px cut, white condensed 800) interlocked with a paper bar holding the mode name (title) and its rule (13px paper-ink). Hover brightens the bar to white; the selected bar turns yellow and its rule turns yellow-ink. Bars wipe in staggered by 35ms.

### Scorebug (signature)
In the menu: the yellow network slab, the slanted tab plate, and a red LIVE tag with the ticking player count. In the HUD: a small paper mode-name tag over a HUD-glass score strip; team scores sit in their team slabs with interlocking cuts. Health is a paper lower third bottom-left that turns red-slab when low; ammo sits bottom-right.

### Pregame Roster and Starting Lineup (signature)
The pregame card opens with a paper head plate, a 64px ticking player count, a lobby bar that fills paper and turns green when found, and joining rows on navy that wipe in. The lineup is a full-screen slam: a paper headline plate, slanted team tags, and calling-card rows that wipe in from their own side (home from the left, away from the right) after 0.25s, 70ms apart.

### Final Score
A 64px paper plate (red-slab on defeat), a condensed score strip of numeral plates, navy stat wells, and a striped table with your row tinted yellow at 16%.

### Level Tag
A small square line-2 plate with a condensed 800 numeral, placed before player names in every list.

## Do's and Don'ts

### Do:
- **Do** set the outline of every slanted piece as `--shape` so the wipe opens along that same cut.
- **Do** wipe new bars, tags and rows in with `cubic-bezier(0.16, 1, 0.3, 1)` over 0.3-0.5s, staggered, and tick changed numbers up over 0.3-0.35s.
- **Do** show state by form as well as colour: solid for live, dashed for pending, struck through and greyed for locked.
- **Do** draw UI icons from the shared set: a 24-unit grid, 2.2px square-capped mitred strokes, coloured by `currentColor`.
- **Do** read team colour from the team tokens so colourblind modes and the high-contrast HUD (solid black behind readouts) keep working.
- **Do** let cosmetic previews and calling cards keep their item's own colours; they are player content, not chrome.

### Don't:
- **Don't** round UI corners, use pills, or put gradients or glows on menu or HUD chrome. Full-screen effects (damage vignette, scope, zone tint, heal flash) and cosmetic previews keep their gradients and glows.
- **Don't** put a second yellow button on a screen, or use yellow as decoration.
- **Don't** apply the slanted cut to cards, tiles, inputs or chips.
- **Don't** set a label, name or number in Saira body, or set prose in condensed uppercase.
- **Don't** add a tracked label above a heading that only repeats it.
- **Don't** use typed glyphs or emoji as UI icons.
