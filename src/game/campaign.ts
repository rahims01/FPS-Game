import type { Difficulty, ModeId } from '../sim/Match';
import type { OpSpec } from '../sim/ops';
import { loadProfile, saveProfile } from './progression';

/**
 * The solo campaign: training, then twenty-seven operations against the Syndicate in
 * six acts (stealth intel grabs, assassinations, rescues, sabotage, defence and
 * escapes), each with a briefing and three star goals. Missions unlock in order;
 * every new star is worth XP, and finishing them all earns a title.
 */

/** What a finished mission run looked like (read from the match). */
export interface MissionRun {
  won: boolean;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  headshots: number;
  longestKill: number;
  seconds: number;
  wave: number;
  /** Movement course finish time (0 if not finished). */
  courseTime: number;
  medals: Record<string, number>;
  /** Operations: never seen or heard, guards taken down, the hostage's health at the end. */
  undetected: boolean;
  guardsDown: number;
  hostageHp: number;
}

export interface Goal {
  text: string;
  met: (r: MissionRun) => boolean;
}

export interface Mission {
  id: string;
  /** Which part of the story it belongs to. */
  act: string;
  title: string;
  /** What kind of mission, for the list. */
  place: string;
  briefing: string;
  mode: ModeId;
  difficulty: Difficulty;
  /** Star 1 is finishing the mission; stars 2 and 3 are harder. */
  goals: [Goal, Goal, Goal];
  /** Ends the match after this many seconds (missions in endless modes). */
  timeLimit?: number;
  /** The operation (mode 'op'). */
  op?: OpSpec;
  /** Played at night. */
  night?: boolean;
}

const acc = (r: MissionRun) => (r.shots ? r.hits / r.shots : 0);

const ACT1 = 'Act 1 · Recruit';
const ACT2 = 'Act 2 · Operative';
const ACT3 = 'Act 3 · Specialist';
const ACT4 = 'Act 4 · Ghost';
const ACT5 = 'Act 5 · Aftershock';
const ACT6 = 'Act 6 · Endgame';

export const MISSIONS: Mission[] = [
  // ---- Act 1: Recruit
  {
    id: 'm1', act: ACT1, title: 'Basic Training', place: 'Training Range · 90 s', mode: 'training', difficulty: 'easy', timeLimit: 90,
    briefing: 'Welcome to the unit, recruit. Before we send you anywhere real, show us you can hit what you aim at. Drop the targets downrange.',
    goals: [
      { text: 'Drop 15 targets', met: (r) => r.kills >= 15 },
      { text: 'Drop 30 targets', met: (r) => r.kills >= 30 },
      { text: 'Finish with 60% accuracy', met: (r) => r.kills >= 15 && acc(r) >= 0.6 }
    ]
  },
  {
    id: 'op1', act: ACT1, title: 'Quiet Entry', place: 'Stealth · Intel', mode: 'op', difficulty: 'easy',
    op: { kind: 'intel', items: 2, guards: 2, patrols: 1, stealth: true, reinforce: 3, size: 40 },
    briefing: 'The Syndicate keeps its shipping logs in a warehouse on the edge of town. Slip in, take both intel cases and walk out. Guards stand watch: stay out of their sight, crouch to stay hidden, and remember a loud shot brings everyone running.',
    goals: [
      { text: 'Take the intel and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Don’t go down', met: (r) => r.won && r.deaths === 0 }
    ]
  },
  {
    id: 'op2', act: ACT1, title: 'The Courier', place: 'Assassination', mode: 'op', difficulty: 'easy',
    op: { kind: 'assassinate', targetName: 'The Courier', guards: 2, patrols: 1, stealth: true, escapeAfter: 75, reinforce: 3, size: 40 },
    briefing: 'A Syndicate courier is waiting on a pickup with two bodyguards. Take the courier out before the deal goes through. If the guards raise the alarm, the courier runs and you have 75 seconds.',
    goals: [
      { text: 'Eliminate the Courier and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Leave every guard standing', met: (r) => r.won && r.guardsDown === 0 }
    ]
  },
  {
    id: 'op3', act: ACT1, title: 'Hold the Bridge', place: 'Defend · 60 s', mode: 'op', difficulty: 'easy',
    op: { kind: 'defend', hold: 60, guards: 2, patrols: 0, stealth: false, reinforce: 6, size: 36 },
    briefing: 'Our convoy needs this crossing. Hold the marked position for 60 seconds while they come at you a couple at a time. Time only counts while you’re inside the ring.',
    goals: [
      { text: 'Hold for 60 seconds', met: (r) => r.won },
      { text: 'Get 6 takedowns', met: (r) => r.won && r.kills >= 6 },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 }
    ]
  },
  // ---- Act 2: Operative
  {
    id: 'op4', act: ACT2, title: 'Doctor Reyes', place: 'Rescue', mode: 'op', difficulty: 'easy',
    op: { kind: 'rescue', targetName: 'Dr. Reyes', guards: 2, patrols: 2, stealth: true, reinforce: 4, size: 46 },
    briefing: 'Dr. Reyes built the Syndicate’s encryption and wants out. They’re holding her at the far end of the compound, with a few guards spread around it. Reach her, free her and bring her back to extraction. The guards won’t shoot at her: they want her alive too.',
    goals: [
      { text: 'Get Dr. Reyes out alive', met: (r) => r.won },
      { text: 'She ends with over half her health', met: (r) => r.won && r.hostageHp > 50 },
      { text: 'Reach her without being spotted', met: (r) => r.won && r.undetected }
    ]
  },
  {
    id: 'op5', act: ACT2, title: 'Lights Out', place: 'Sabotage', mode: 'op', difficulty: 'easy',
    op: { kind: 'sabotage', items: 3, fuse: 80, guards: 3, patrols: 2, stealth: true, reinforce: 4, size: 44 },
    briefing: 'Three generators keep the Syndicate’s base running. Plant a charge on each one by standing at the site for three seconds, then get to extraction before they blow. The fuse is 80 seconds.',
    goals: [
      { text: 'Plant all three and get out', met: (r) => r.won },
      { text: 'Plant them all without being spotted', met: (r) => r.won && r.undetected },
      { text: 'Finish in under 4 minutes', met: (r) => r.won && r.seconds < 240 }
    ]
  },
  {
    id: 'op6', act: ACT2, title: 'Long Shot', place: 'Assassination · Sniper', mode: 'op', difficulty: 'easy',
    op: { kind: 'assassinate', targetName: 'The Broker', loadout: ['sniper', 'pistol'], guards: 3, patrols: 1, stealth: true, escapeAfter: 50, reinforce: 4, size: 52 },
    briefing: 'The Broker sells our secrets to anyone who pays. He never leaves his guards, so you won’t get close. You get a rifle and one clean shot. Miss, and he runs: you’ll have 50 seconds.',
    goals: [
      { text: 'Eliminate the Broker and get out', met: (r) => r.won },
      { text: 'Land a headshot', met: (r) => r.won && r.headshots >= 1 },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected }
    ]
  },
  {
    id: 'op7', act: ACT2, title: 'Behind Enemy Lines', place: 'Escape', mode: 'op', difficulty: 'easy',
    op: { kind: 'escape', guards: 4, patrols: 0, stealth: false, reinforce: 5, size: 50 },
    briefing: 'Your ride went down on the wrong side of the river, and every patrol knows you’re here. Fight your way across the map to the extraction point.',
    goals: [
      { text: 'Reach extraction', met: (r) => r.won },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 },
      { text: 'Make it in under 3 minutes', met: (r) => r.won && r.seconds < 180 }
    ]
  },
  // ---- Act 3: Specialist
  {
    id: 'op8', act: ACT3, title: 'Data Heist', place: 'Stealth · Intel', mode: 'op', difficulty: 'normal',
    op: { kind: 'intel', items: 4, guards: 3, patrols: 2, stealth: true, reinforce: 5, size: 48 },
    briefing: 'The Syndicate split its accounts across four drives in four rooms. Get all four. The guards are spread through the building: take them one at a time, or slip past.',
    goals: [
      { text: 'Take all four and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Don’t go down', met: (r) => r.won && r.deaths === 0 }
    ]
  },
  {
    id: 'op9', act: ACT3, title: 'Night Market', place: 'Assassination · Night', mode: 'op', difficulty: 'normal', night: true,
    op: { kind: 'assassinate', targetName: 'The Fence', guards: 3, patrols: 2, stealth: true, escapeAfter: 70, reinforce: 5, size: 46 },
    briefing: 'The Fence moves Syndicate weapons through a market that only opens after dark. The dark helps you, and it helps them. Find him by his marker and end it.',
    goals: [
      { text: 'Eliminate the Fence and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Take down 2 guards or fewer', met: (r) => r.won && r.guardsDown <= 2 }
    ]
  },
  {
    id: 'op10', act: ACT3, title: 'Embassy Siege', place: 'Rescue', mode: 'op', difficulty: 'normal',
    op: { kind: 'rescue', targetName: 'The Ambassador', guards: 3, patrols: 2, stealth: true, reinforce: 6, size: 48 },
    briefing: 'The Syndicate stormed the embassy and took the Ambassador. Get inside, get the Ambassador and get both of you out. Expect a fight on the way back.',
    goals: [
      { text: 'Get the Ambassador out alive', met: (r) => r.won },
      { text: 'The Ambassador ends with over half health', met: (r) => r.won && r.hostageHp > 50 },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 }
    ]
  },
  {
    id: 'op11', act: ACT3, title: 'Firestorm', place: 'Defend · 100 s', mode: 'op', difficulty: 'normal',
    op: { kind: 'defend', hold: 100, guards: 3, patrols: 0, stealth: false, reinforce: 12, size: 40 },
    briefing: 'We’re pulling the last team out of the city and they need this landing zone. Hold it for a hundred seconds. Nobody is coming to help you until then.',
    goals: [
      { text: 'Hold for 100 seconds', met: (r) => r.won },
      { text: 'Get 10 takedowns', met: (r) => r.won && r.kills >= 10 },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 }
    ]
  },
  // ---- Act 4: Ghost
  {
    id: 'op12', act: ACT4, title: 'Blackout', place: 'Sabotage · Night', mode: 'op', difficulty: 'normal', night: true,
    op: { kind: 'sabotage', items: 4, fuse: 80, guards: 4, patrols: 2, stealth: true, reinforce: 6, size: 50 },
    briefing: 'Their whole network runs through one power station. Four charges and an 80-second fuse, and it all goes dark. So does the map: it’s night.',
    goals: [
      { text: 'Plant all four and get out', met: (r) => r.won },
      { text: 'Plant them all without being spotted', met: (r) => r.won && r.undetected },
      { text: 'Finish in under 5 minutes', met: (r) => r.won && r.seconds < 300 }
    ]
  },
  {
    id: 'op13', act: ACT4, title: 'Ghost Protocol', place: 'Stealth · Three lives', mode: 'op', difficulty: 'normal',
    op: { kind: 'intel', items: 3, guards: 4, patrols: 2, stealth: true, reinforce: 6, lives: 3, size: 48 },
    briefing: 'The unit has been disowned. Three lives, no backup. Take the evidence that clears our name and disappear.',
    goals: [
      { text: 'Take the evidence and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Leave every guard standing', met: (r) => r.won && r.guardsDown === 0 }
    ]
  },
  {
    id: 'op14', act: ACT4, title: 'Last Ride', place: 'Escape', mode: 'op', difficulty: 'normal',
    op: { kind: 'escape', guards: 6, patrols: 0, stealth: false, reinforce: 7, size: 56 },
    briefing: 'They know who you are now, and every Syndicate fighter in the city is between you and the border. Get to extraction.',
    goals: [
      { text: 'Reach extraction', met: (r) => r.won },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 },
      { text: 'Get 12 takedowns', met: (r) => r.won && r.kills >= 12 }
    ]
  },
  {
    id: 'op15', act: ACT4, title: 'The Warlord', place: 'Assassination · Finale', mode: 'op', difficulty: 'normal',
    op: { kind: 'assassinate', targetName: 'The Warlord', targetArmor: 0.5, guards: 4, patrols: 1, stealth: true, escapeAfter: 100, reinforce: 8, size: 52 },
    briefing: 'This is the man behind all of it. He’s armoured, his best guards are around him, and if the alarm goes up he has 100 seconds to reach his escape route. End the Syndicate.',
    goals: [
      { text: 'Eliminate the Warlord and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 }
    ]
  },
  // ---- Act 5: Aftershock
  {
    id: 'op16', act: ACT5, title: 'Loose Ends', place: 'Rescue', mode: 'op', difficulty: 'easy',
    op: { kind: 'rescue', targetName: 'The Informant', guards: 3, patrols: 1, stealth: true, reinforce: 4, size: 44 },
    briefing: 'The Warlord is gone, but his lieutenants are cleaning house. Our informant is being held in a scrapyard and they mean to make an example of him. Get him out before they do.',
    goals: [
      { text: 'Get the Informant out alive', met: (r) => r.won },
      { text: 'Reach him without being spotted', met: (r) => r.won && r.undetected },
      { text: 'He ends with over half his health', met: (r) => r.won && r.hostageHp > 50 }
    ]
  },
  {
    id: 'op17', act: ACT5, title: 'Dead Drop', place: 'Stealth · Intel · Night', mode: 'op', difficulty: 'easy', night: true,
    op: { kind: 'intel', items: 3, guards: 3, patrols: 2, stealth: true, reinforce: 4, size: 46 },
    briefing: 'Someone is still paying the Syndicate’s soldiers. Three dead drops hold the payment records. Collect them under cover of dark.',
    goals: [
      { text: 'Collect all three and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Take down 1 guard or fewer', met: (r) => r.won && r.guardsDown <= 1 }
    ]
  },
  {
    id: 'op18', act: ACT5, title: 'Convoy Ambush', place: 'Sabotage · Loud', mode: 'op', difficulty: 'easy',
    op: { kind: 'sabotage', items: 2, fuse: 60, guards: 3, patrols: 1, stealth: false, reinforce: 5, size: 44 },
    briefing: 'Two armoured trucks are carrying the Syndicate’s weapons out of the city, and there’s no time to be quiet. Charge both trucks and get clear.',
    goals: [
      { text: 'Destroy both trucks and get out', met: (r) => r.won },
      { text: 'Get 7 takedowns', met: (r) => r.won && r.kills >= 7 },
      { text: 'Finish in under 4 minutes', met: (r) => r.won && r.seconds < 240 }
    ]
  },
  {
    id: 'op19', act: ACT5, title: 'Close Quarters', place: 'Assassination · Shotgun', mode: 'op', difficulty: 'easy',
    op: { kind: 'assassinate', targetName: 'The Butcher', loadout: ['shotgun', 'revolver'], guards: 3, patrols: 1, stealth: true, escapeAfter: 70, reinforce: 4, size: 40 },
    briefing: 'The Butcher runs the Syndicate’s enforcers from a cramped warehouse. Long guns are no use in there: you get a shotgun and a revolver. Get close and finish it.',
    goals: [
      { text: 'Eliminate the Butcher and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 }
    ]
  },
  {
    id: 'op20', act: ACT5, title: 'The Long Night', place: 'Defend · Night · 80 s', mode: 'op', difficulty: 'easy', night: true,
    op: { kind: 'defend', hold: 80, guards: 2, patrols: 0, stealth: false, reinforce: 8, size: 38 },
    briefing: 'The safehouse has been found and the power is cut. Hold the courtyard until the trucks arrive. Watch for muzzle flashes in the dark.',
    goals: [
      { text: 'Hold for 80 seconds', met: (r) => r.won },
      { text: 'Get 7 takedowns', met: (r) => r.won && r.kills >= 7 },
      { text: 'Don’t go down', met: (r) => r.won && r.deaths === 0 }
    ]
  },
  {
    id: 'op21', act: ACT5, title: 'Turncoat', place: 'Assassination · Marksman', mode: 'op', difficulty: 'easy',
    op: { kind: 'assassinate', targetName: 'The Turncoat', loadout: ['dmr', 'pistol'], guards: 3, patrols: 1, stealth: true, escapeAfter: 55, reinforce: 4, size: 50 },
    briefing: 'One of our own sold the unit to the Syndicate. He’s meeting his new friends in the open. You have a marksman rifle and a clear view: make it count.',
    goals: [
      { text: 'Eliminate the Turncoat and get out', met: (r) => r.won },
      { text: 'Land a headshot', met: (r) => r.won && r.headshots >= 1 },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected }
    ]
  },
  // ---- Act 6: Endgame
  {
    id: 'op22', act: ACT6, title: 'Silent Running', place: 'Stealth · Three lives', mode: 'op', difficulty: 'normal',
    op: { kind: 'intel', items: 4, guards: 4, patrols: 2, stealth: true, reinforce: 6, lives: 3, size: 50 },
    briefing: 'The payments lead to a man the files only call the Architect. His servers sit in four rooms of a guarded data centre. Three lives, four drives, no noise.',
    goals: [
      { text: 'Take all four and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Don’t go down', met: (r) => r.won && r.deaths === 0 }
    ]
  },
  {
    id: 'op23', act: ACT6, title: 'Hostage Exchange', place: 'Rescue · Night', mode: 'op', difficulty: 'normal', night: true,
    op: { kind: 'rescue', targetName: 'Agent Vance', guards: 4, patrols: 2, stealth: true, reinforce: 6, size: 48 },
    briefing: 'The Architect has taken Agent Vance and offered a trade we will never make. Go in at night, bring Vance home, and leave the Architect with nothing to bargain with.',
    goals: [
      { text: 'Get Vance out alive', met: (r) => r.won },
      { text: 'Vance ends with over half health', met: (r) => r.won && r.hostageHp > 50 },
      { text: 'Reach Vance without being spotted', met: (r) => r.won && r.undetected }
    ]
  },
  {
    id: 'op24', act: ACT6, title: 'Scorched Earth', place: 'Sabotage', mode: 'op', difficulty: 'normal',
    op: { kind: 'sabotage', items: 4, fuse: 90, guards: 4, patrols: 2, stealth: true, reinforce: 6, size: 52 },
    briefing: 'Four fuel depots keep the Architect’s fleet moving. Charge all four, then outrun the fire. The fuse is 90 seconds, and the guards will come running.',
    goals: [
      { text: 'Charge all four and get out', met: (r) => r.won },
      { text: 'Charge them all without being spotted', met: (r) => r.won && r.undetected },
      { text: 'Finish in under 5 minutes', met: (r) => r.won && r.seconds < 300 }
    ]
  },
  {
    id: 'op25', act: ACT6, title: 'The Gauntlet', place: 'Escape · Night', mode: 'op', difficulty: 'normal', night: true,
    op: { kind: 'escape', guards: 6, patrols: 0, stealth: false, reinforce: 7, size: 56 },
    briefing: 'It was a trap. The data centre is locked down and the only way out is through the whole Syndicate garrison, in the dark. Run.',
    goals: [
      { text: 'Reach extraction', met: (r) => r.won },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 },
      { text: 'Make it in under 4 minutes', met: (r) => r.won && r.seconds < 240 }
    ]
  },
  {
    id: 'op26', act: ACT6, title: 'Last Stand', place: 'Defend · 120 s', mode: 'op', difficulty: 'normal',
    op: { kind: 'defend', hold: 120, guards: 3, patrols: 0, stealth: false, reinforce: 14, size: 40 },
    briefing: 'Our evidence goes to the world in two minutes, if the transmitter stays up. Everything the Architect has left is coming. Hold.',
    goals: [
      { text: 'Hold for 120 seconds', met: (r) => r.won },
      { text: 'Get 12 takedowns', met: (r) => r.won && r.kills >= 12 },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 }
    ]
  },
  {
    id: 'op27', act: ACT6, title: 'The Architect', place: 'Assassination · Finale', mode: 'op', difficulty: 'normal', night: true,
    op: { kind: 'assassinate', targetName: 'The Architect', targetArmor: 0.45, guards: 4, patrols: 2, stealth: true, escapeAfter: 100, reinforce: 8, size: 54 },
    briefing: 'His network is exposed and his money is gone. All he has left is a compound, his last guards and a helicopter waiting on the roof. If the alarm sounds he has 100 seconds. Finish this.',
    goals: [
      { text: 'Eliminate the Architect and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Don’t go down', met: (r) => r.won && r.deaths === 0 }
    ]
  }
];

/** Most enemies fighting you at once, by act: one soldier shouldn't face a crowd. */
const MAX_ALIVE: Record<string, number> = { [ACT1]: 2, [ACT2]: 2, [ACT3]: 3, [ACT4]: 3, [ACT5]: 2, [ACT6]: 3 };
for (const m of MISSIONS) if (m.op) m.op.maxAlive ??= MAX_ALIVE[m.act];


export const XP_PER_STAR = 500;
/** The title for finishing every mission (see TITLES). */
export const CAMPAIGN_TITLE = 'campaignhero';

/** Stars earned per mission (best run). */
export const campaignStars = (): Record<string, number> => loadProfile().campaign ?? {};

/** Missions are played in order: the next one opens when the one before has a star. */
export const missionOpen = (i: number, stars = campaignStars()): boolean => i === 0 || (stars[MISSIONS[i - 1].id] ?? 0) > 0;

/** A mission's map: the same layout every attempt. */
export const missionSeed = (m: Mission): number => [...m.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0;

/** Scores a run, saves the best stars, pays XP for new ones. Returns which goals were met and the new stars. */
export const scoreMission = (m: Mission, run: MissionRun): { met: boolean[]; stars: number; newStars: number; xp: number; allDone: boolean } => {
  const met = m.goals.map((g) => g.met(run));
  // Star 1 is required for 2 and 3.
  const stars = met[0] ? 1 + (met[1] ? 1 : 0) + (met[2] ? 1 : 0) : 0;
  const p = loadProfile();
  const before = p.campaign?.[m.id] ?? 0;
  const newStars = Math.max(0, stars - before);
  p.campaign = { ...(p.campaign ?? {}), [m.id]: Math.max(before, stars) };
  const xp = newStars * XP_PER_STAR;
  p.xp += xp;
  const allDone = MISSIONS.every((x) => (p.campaign?.[x.id] ?? 0) > 0);
  if (allDone && !(p.granted ?? []).includes(CAMPAIGN_TITLE)) p.granted = [...(p.granted ?? []), CAMPAIGN_TITLE];
  saveProfile(p);
  return { met, stars, newStars, xp, allDone };
};
