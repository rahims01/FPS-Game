import type { Difficulty, ModeId } from '../sim/Match';
import type { OpSpec } from '../sim/ops';
import { loadProfile, saveProfile } from './progression';

/**
 * The solo campaign: training, then fifteen operations against the Syndicate in
 * four acts (stealth intel grabs, assassinations, rescues, sabotage, defence and
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
    op: { kind: 'intel', items: 2, guards: 3, patrols: 2, stealth: true, reinforce: 4, size: 38 },
    briefing: 'The Syndicate keeps its shipping logs in a warehouse on the edge of town. Slip in, take both intel cases and walk out. Guards stand watch: stay out of their sight, crouch to stay hidden, and remember a loud shot brings everyone running.',
    goals: [
      { text: 'Take the intel and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Don’t go down', met: (r) => r.won && r.deaths === 0 }
    ]
  },
  {
    id: 'op2', act: ACT1, title: 'The Courier', place: 'Assassination', mode: 'op', difficulty: 'easy',
    op: { kind: 'assassinate', targetName: 'The Courier', guards: 3, patrols: 2, stealth: true, escapeAfter: 45, reinforce: 4, size: 38 },
    briefing: 'A Syndicate courier is waiting on a pickup with three bodyguards. Take the courier out before the deal goes through. If the guards raise the alarm, the courier runs and you have 45 seconds.',
    goals: [
      { text: 'Eliminate the Courier and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Leave every guard standing', met: (r) => r.won && r.guardsDown === 0 }
    ]
  },
  {
    id: 'op3', act: ACT1, title: 'Hold the Bridge', place: 'Defend · 90 s', mode: 'op', difficulty: 'easy',
    op: { kind: 'defend', hold: 90, guards: 3, patrols: 0, stealth: false, reinforce: 12, size: 36 },
    briefing: 'Our convoy needs this crossing. Hold the marked position for 90 seconds while they throw everything at you. Time only counts while you’re inside the ring.',
    goals: [
      { text: 'Hold for 90 seconds', met: (r) => r.won },
      { text: 'Get 12 takedowns', met: (r) => r.won && r.kills >= 12 },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 }
    ]
  },
  // ---- Act 2: Operative
  {
    id: 'op4', act: ACT2, title: 'Doctor Reyes', place: 'Rescue', mode: 'op', difficulty: 'normal',
    op: { kind: 'rescue', targetName: 'Dr. Reyes', guards: 4, patrols: 3, stealth: true, reinforce: 6, size: 42 },
    briefing: 'Dr. Reyes built the Syndicate’s encryption and wants out. They’re holding her at the far end of the compound. Reach her, free her and bring her back to extraction alive. Once she’s free she follows you, so keep her out of the line of fire.',
    goals: [
      { text: 'Get Dr. Reyes out alive', met: (r) => r.won },
      { text: 'She ends with over half her health', met: (r) => r.won && r.hostageHp > 50 },
      { text: 'Reach her without being spotted', met: (r) => r.won && r.undetected }
    ]
  },
  {
    id: 'op5', act: ACT2, title: 'Lights Out', place: 'Sabotage', mode: 'op', difficulty: 'normal',
    op: { kind: 'sabotage', items: 3, fuse: 60, guards: 4, patrols: 3, stealth: true, reinforce: 8, size: 42 },
    briefing: 'Three generators keep the Syndicate’s base running. Plant a charge on each one by standing at the site for three seconds, then get to extraction before they blow. The fuse is 60 seconds.',
    goals: [
      { text: 'Plant all three and get out', met: (r) => r.won },
      { text: 'Plant them all without being spotted', met: (r) => r.won && r.undetected },
      { text: 'Finish in under 4 minutes', met: (r) => r.won && r.seconds < 240 }
    ]
  },
  {
    id: 'op6', act: ACT2, title: 'Long Shot', place: 'Assassination · Sniper', mode: 'op', difficulty: 'normal',
    op: { kind: 'assassinate', targetName: 'The Broker', loadout: ['sniper', 'pistol'], guards: 5, patrols: 2, stealth: true, escapeAfter: 30, reinforce: 6, size: 52 },
    briefing: 'The Broker sells our secrets to anyone who pays. He never leaves his guards, so you won’t get close. You get a rifle and one clean shot. Miss, and he runs: you’ll have 30 seconds.',
    goals: [
      { text: 'Eliminate the Broker and get out', met: (r) => r.won },
      { text: 'Land a headshot', met: (r) => r.won && r.headshots >= 1 },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected }
    ]
  },
  {
    id: 'op7', act: ACT2, title: 'Behind Enemy Lines', place: 'Escape', mode: 'op', difficulty: 'normal',
    op: { kind: 'escape', guards: 7, patrols: 0, stealth: false, reinforce: 8, size: 50 },
    briefing: 'Your ride went down on the wrong side of the river, and every patrol knows you’re here. Fight your way across the map to the extraction point.',
    goals: [
      { text: 'Reach extraction', met: (r) => r.won },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 },
      { text: 'Make it in under 3 minutes', met: (r) => r.won && r.seconds < 180 }
    ]
  },
  // ---- Act 3: Specialist
  {
    id: 'op8', act: ACT3, title: 'Data Heist', place: 'Stealth · Intel', mode: 'op', difficulty: 'hard',
    op: { kind: 'intel', items: 4, guards: 6, patrols: 4, stealth: true, reinforce: 10, size: 46 },
    briefing: 'The Syndicate split its accounts across four drives in four rooms. Get all four. There are more guards this time, and they’re sharper.',
    goals: [
      { text: 'Take all four and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Don’t go down', met: (r) => r.won && r.deaths === 0 }
    ]
  },
  {
    id: 'op9', act: ACT3, title: 'Night Market', place: 'Assassination · Night', mode: 'op', difficulty: 'hard', night: true,
    op: { kind: 'assassinate', targetName: 'The Fence', guards: 5, patrols: 4, stealth: true, escapeAfter: 40, reinforce: 8, size: 44 },
    briefing: 'The Fence moves Syndicate weapons through a market that only opens after dark. The dark helps you, and it helps them. Find him by his marker and end it.',
    goals: [
      { text: 'Eliminate the Fence and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Take down 2 guards or fewer', met: (r) => r.won && r.guardsDown <= 2 }
    ]
  },
  {
    id: 'op10', act: ACT3, title: 'Embassy Siege', place: 'Rescue', mode: 'op', difficulty: 'hard',
    op: { kind: 'rescue', targetName: 'The Ambassador', guards: 6, patrols: 4, stealth: true, reinforce: 12, size: 46 },
    briefing: 'The Syndicate stormed the embassy and took the Ambassador. Get inside, get the Ambassador and get both of you out. Expect a fight on the way back.',
    goals: [
      { text: 'Get the Ambassador out alive', met: (r) => r.won },
      { text: 'The Ambassador ends with over half health', met: (r) => r.won && r.hostageHp > 50 },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 }
    ]
  },
  {
    id: 'op11', act: ACT3, title: 'Firestorm', place: 'Defend · 150 s', mode: 'op', difficulty: 'hard',
    op: { kind: 'defend', hold: 150, guards: 5, patrols: 0, stealth: false, reinforce: 26, size: 40 },
    briefing: 'We’re pulling the last team out of the city and they need this landing zone. Hold it for two and a half minutes. Nobody is coming to help you until then.',
    goals: [
      { text: 'Hold for 150 seconds', met: (r) => r.won },
      { text: 'Get 25 takedowns', met: (r) => r.won && r.kills >= 25 },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 }
    ]
  },
  // ---- Act 4: Ghost
  {
    id: 'op12', act: ACT4, title: 'Blackout', place: 'Sabotage · Night', mode: 'op', difficulty: 'hard', night: true,
    op: { kind: 'sabotage', items: 4, fuse: 50, guards: 6, patrols: 5, stealth: true, reinforce: 12, size: 48 },
    briefing: 'Their whole network runs through one power station. Four charges and a 50-second fuse, and it all goes dark. So does the map: it’s night.',
    goals: [
      { text: 'Plant all four and get out', met: (r) => r.won },
      { text: 'Plant them all without being spotted', met: (r) => r.won && r.undetected },
      { text: 'Finish in under 5 minutes', met: (r) => r.won && r.seconds < 300 }
    ]
  },
  {
    id: 'op13', act: ACT4, title: 'Ghost Protocol', place: 'Stealth · One life', mode: 'op', difficulty: 'hard',
    op: { kind: 'intel', items: 3, guards: 6, patrols: 6, stealth: true, reinforce: 12, lives: 1, size: 46 },
    briefing: 'The unit has been disowned. One life, no backup, no second chances. Take the evidence that clears our name and disappear.',
    goals: [
      { text: 'Take the evidence and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Leave every guard standing', met: (r) => r.won && r.guardsDown === 0 }
    ]
  },
  {
    id: 'op14', act: ACT4, title: 'Last Ride', place: 'Escape', mode: 'op', difficulty: 'hard',
    op: { kind: 'escape', guards: 12, patrols: 0, stealth: false, reinforce: 14, size: 56 },
    briefing: 'They know who you are now, and every Syndicate fighter in the city is between you and the border. Get to extraction.',
    goals: [
      { text: 'Reach extraction', met: (r) => r.won },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 },
      { text: 'Get 20 takedowns', met: (r) => r.won && r.kills >= 20 }
    ]
  },
  {
    id: 'op15', act: ACT4, title: 'The Warlord', place: 'Assassination · Finale', mode: 'op', difficulty: 'hard',
    op: { kind: 'assassinate', targetName: 'The Warlord', targetArmor: 0.35, guards: 8, patrols: 4, stealth: true, escapeAfter: 75, reinforce: 14, size: 50 },
    briefing: 'This is the man behind all of it. He’s armoured, his best guards are around him, and if the alarm goes up he has 75 seconds to reach his escape route. End the Syndicate.',
    goals: [
      { text: 'Eliminate the Warlord and get out', met: (r) => r.won },
      { text: 'Never get spotted', met: (r) => r.won && r.undetected },
      { text: 'Go down once at most', met: (r) => r.won && r.deaths <= 1 }
    ]
  }
];

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
