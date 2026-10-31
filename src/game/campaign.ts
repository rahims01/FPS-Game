import type { Difficulty, ModeId } from '../sim/Match';
import { loadProfile, saveProfile } from './progression';

/**
 * The solo campaign: ten missions, each a match in one of the game's modes
 * with a short briefing and three star goals. Missions unlock in order;
 * every new star is worth XP, and finishing all ten earns a title.
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
}

export interface Goal {
  text: string;
  met: (r: MissionRun) => boolean;
}

export interface Mission {
  id: string;
  title: string;
  /** Where it happens, for the list. */
  place: string;
  briefing: string;
  mode: ModeId;
  difficulty: Difficulty;
  /** Star 1 is finishing the mission; stars 2 and 3 are harder. */
  goals: [Goal, Goal, Goal];
  /** Ends the match after this many seconds (missions in endless modes). */
  timeLimit?: number;
}

const acc = (r: MissionRun) => (r.shots ? r.hits / r.shots : 0);

export const MISSIONS: Mission[] = [
  {
    id: 'm1', title: 'Basic Training', place: 'Training Range · 90 s', mode: 'training', difficulty: 'easy', timeLimit: 90,
    briefing: 'Welcome, recruit. Before anyone hands you a real fight, show us you can hit what you aim at. Drop the targets downrange.',
    goals: [
      { text: 'Drop 15 targets', met: (r) => r.kills >= 15 },
      { text: 'Drop 30 targets', met: (r) => r.kills >= 30 },
      { text: 'Finish with 60% accuracy', met: (r) => r.kills >= 15 && acc(r) >= 0.6 }
    ]
  },
  {
    id: 'm2', title: 'First Contact', place: 'Team Deathmatch', mode: 'tdm', difficulty: 'easy',
    briefing: 'Your squad is going in. Stay with your team, use cover, and bring them home with a win.',
    goals: [
      { text: 'Win the match', met: (r) => r.won },
      { text: 'Get 12 takedowns', met: (r) => r.won && r.kills >= 12 },
      { text: 'Go down 4 times or fewer', met: (r) => r.won && r.deaths <= 4 }
    ]
  },
  {
    id: 'm3', title: 'Run and Gun', place: 'Movement Course', mode: 'course', difficulty: 'easy',
    briefing: 'A soldier who can’t move is a target. Clear the obstacle course without touching the ground.',
    goals: [
      { text: 'Reach the finish', met: (r) => r.courseTime > 0 },
      { text: 'Finish in under 60 seconds', met: (r) => r.courseTime > 0 && r.courseTime < 60 },
      { text: 'Finish in under 35 seconds', met: (r) => r.courseTime > 0 && r.courseTime < 35 }
    ]
  },
  {
    id: 'm4', title: 'Hold the Line', place: 'Zombies', mode: 'zombies', difficulty: 'normal',
    briefing: 'The outpost is overrun. Hold out as long as you can. Every wave is faster and tougher than the last.',
    goals: [
      { text: 'Survive to wave 5', met: (r) => r.wave >= 5 },
      { text: 'Survive to wave 8', met: (r) => r.wave >= 8 },
      { text: 'Survive to wave 11', met: (r) => r.wave >= 11 }
    ]
  },
  {
    id: 'm5', title: 'Overwatch', place: 'Snipers Only', mode: 'snipers', difficulty: 'normal',
    briefing: 'Long sightlines, one-shot rifles. Patience wins this one.',
    goals: [
      { text: 'Win the match', met: (r) => r.won },
      { text: 'Land 8 headshots', met: (r) => r.won && r.headshots >= 8 },
      { text: 'A takedown from 70 m', met: (r) => r.won && r.longestKill >= 70 }
    ]
  },
  {
    id: 'm6', title: 'Point Taken', place: 'Domination', mode: 'dom', difficulty: 'normal',
    briefing: 'Three flags, two teams. Take the points and keep them.',
    goals: [
      { text: 'Win the match', met: (r) => r.won },
      { text: 'Capture 3 points', met: (r) => r.won && (r.medals.captured ?? 0) >= 3 },
      { text: 'Get 20 takedowns', met: (r) => r.won && r.kills >= 20 }
    ]
  },
  {
    id: 'm7', title: 'Cold Steel', place: 'Knife Fight', mode: 'knife', difficulty: 'normal',
    briefing: 'No guns, no ammo, no excuses. Get close and stay quick.',
    goals: [
      { text: 'Win the match', met: (r) => r.won },
      { text: 'Get 10 takedowns', met: (r) => r.won && r.kills >= 10 },
      { text: 'Go down 3 times or fewer', met: (r) => r.won && r.deaths <= 3 }
    ]
  },
  {
    id: 'm8', title: 'Bomb Squad', place: 'Search & Destroy', mode: 'snd', difficulty: 'normal',
    briefing: 'One life a round. Plant the bomb or stop theirs. Every move counts.',
    goals: [
      { text: 'Win the match', met: (r) => r.won },
      { text: 'Plant or defuse a bomb', met: (r) => r.won && (r.medals.planted ?? 0) + (r.medals.defused ?? 0) >= 1 },
      { text: 'Get 8 takedowns', met: (r) => r.won && r.kills >= 8 }
    ]
  },
  {
    id: 'm9', title: 'Last One Standing', place: 'Last Man Standing', mode: 'lms', difficulty: 'hard',
    briefing: 'Everyone for themselves, three lives each. Outlast them all.',
    goals: [
      { text: 'Be the last one standing', met: (r) => r.won },
      { text: 'Get 8 takedowns', met: (r) => r.won && r.kills >= 8 },
      { text: 'Don’t lose a life', met: (r) => r.won && r.deaths === 0 }
    ]
  },
  {
    id: 'm10', title: 'The Titan', place: 'Boss Fight', mode: 'boss', difficulty: 'hard',
    briefing: 'Command’s last order: bring down the giant. Watch its phases and keep moving.',
    goals: [
      { text: 'Defeat the boss', met: (r) => r.won },
      { text: 'Lose 1 life or fewer', met: (r) => r.won && r.deaths <= 1 },
      { text: 'Win in under 3 minutes', met: (r) => r.won && r.seconds < 180 }
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
