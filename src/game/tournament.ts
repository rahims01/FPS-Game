import { freshNames } from './identity';

/**
 * Gunfight tournament: an 8-team bracket of 2v2 gunfights (quarterfinals,
 * semifinals, final). You and a teammate play your matches; the other
 * matches in each round are decided by the teams' ratings. Lose once and
 * you're out. Opponents get sharper every round.
 */
export interface TourneyTeam {
  name: string;
  players: [string, string];
  /** Strength for simulated matches. */
  rating: number;
  you?: boolean;
}

export interface Tourney {
  teams: TourneyTeam[];
  /** Team indices still in, in bracket order, for each round played so far (round 0 = all 8). */
  rounds: number[][];
  /** 0 quarterfinal, 1 semifinal, 2 final, 3 finished. */
  round: number;
  /** Knocked out (your last round), or null. */
  outIn: number | null;
  champion: number | null;
}

export const ROUND_NAMES = ['Quarterfinal', 'Semifinal', 'Final'];

const TEAM_WORDS = ['Wolves', 'Vipers', 'Titans', 'Ghosts', 'Raptors', 'Phantoms', 'Outlaws', 'Hornets', 'Reapers', 'Spartans', 'Mavericks', 'Nomads', 'Cobras', 'Sharks', 'Ravens', 'Bandits'];

export const newTourney = (you: string): Tourney => {
  const names = freshNames(15);
  const words = TEAM_WORDS.slice().sort(() => Math.random() - 0.5);
  const teams: TourneyTeam[] = [];
  teams.push({ name: `Team ${you}`, players: [you, names[0]], rating: 1, you: true });
  for (let i = 0; i < 7; i++) teams.push({ name: `The ${words[i]}`, players: [names[1 + i * 2], names[2 + i * 2]], rating: 0.7 + Math.random() * 0.8 });
  // Random seeding.
  const order = teams.map((_, i) => i).sort(() => Math.random() - 0.5);
  return { teams, rounds: [order], round: 0, outIn: null, champion: null };
};

const youIndex = (t: Tourney) => t.teams.findIndex((x) => x.you);

/** Your opponent this round (team index), or null if you're out or it's over. */
export const opponent = (t: Tourney): number | null => {
  if (t.outIn !== null || t.round > 2) return null;
  const alive = t.rounds[t.round];
  const i = alive.indexOf(youIndex(t));
  return i < 0 ? null : alive[i ^ 1];
};

/** Opponent sharpness for a round: aim error multiplier (lower = better) and damage taken. */
export const roundDifficulty = (round: number): { skill: number; damageToPlayer: number } => [
  { skill: 1.35, damageToPlayer: 0.65 },
  { skill: 1.0, damageToPlayer: 0.8 },
  { skill: 0.75, damageToPlayer: 0.95 }
][Math.min(2, round)];

/** Records your match and plays out the rest of the round. */
export const recordMatch = (t: Tourney, won: boolean): Tourney => {
  const me = youIndex(t);
  const alive = t.rounds[t.round];
  const next: number[] = [];
  for (let k = 0; k < alive.length; k += 2) {
    const a = alive[k];
    const b = alive[k + 1];
    if (a === me || b === me) next.push(won ? me : a === me ? b : a);
    else {
      const ra = t.teams[a].rating;
      const rb = t.teams[b].rating;
      next.push(Math.random() < ra / (ra + rb) ? a : b);
    }
  }
  const out: Tourney = { ...t, rounds: [...t.rounds, next], round: t.round + 1 };
  if (!won) out.outIn = t.round;
  // Play out the rest of the bracket once you're out (so you see who won).
  while (out.rounds[out.rounds.length - 1].length > 1 && out.outIn !== null) {
    const cur = out.rounds[out.rounds.length - 1];
    const n: number[] = [];
    for (let k = 0; k < cur.length; k += 2) {
      const ra = out.teams[cur[k]].rating;
      const rb = out.teams[cur[k + 1]].rating;
      n.push(Math.random() < ra / (ra + rb) ? cur[k] : cur[k + 1]);
    }
    out.rounds.push(n);
  }
  const last = out.rounds[out.rounds.length - 1];
  if (last.length === 1) {
    out.champion = last[0];
    out.round = 3;
  }
  return out;
};

/** XP for how far you got. */
export const tourneyXp = (t: Tourney): number => (t.champion === youIndex(t) ? 3000 : [300, 700, 1400][t.outIn ?? 0]);
