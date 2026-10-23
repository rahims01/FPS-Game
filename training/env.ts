import type { Agent } from '../src/sim/Agent';
import { SIM } from '../src/sim/config';
import { FpsSim } from '../src/sim/FpsSim';
import { heuristicBrain } from '../src/sim/heuristicBrain';
import { classicLayout, randomLayout } from '../src/sim/layouts';
import { yawTo, Rng } from '../src/sim/math';
import { buildObservation, OBS_SIZE } from '../src/sim/observation';

export type Scenario = 'duel' | 'team2' | 'team3' | 'duel_random' | 'ffa4';

const SCENARIO_WEIGHTS: [Scenario, number][] = [
  ['duel', 0.35],
  ['team2', 0.2],
  ['team3', 0.1],
  ['duel_random', 0.2],
  ['ffa4', 0.15]
];

/** Each decision step lasts this many sim ticks (0.1 s). */
const TICKS_PER_STEP = SIM.decisionTicks;
const MAX_STEPS = 450; // 45 s
const WIN_BONUS = 0.5;
const STEP_PENALTY = 0.002;

/** Cached because random layouts build a nav grid; a handful is plenty of variety. */
const randomLayouts = Array.from({ length: 12 }, (_, i) => randomLayout(1000 + i, 26 + (i % 4) * 4));
const classic = classicLayout();

/**
 * One learner soldier in a match against hand-written bots, as an RL
 * environment. Teammates (if any) also use the heuristic brain, so the policy
 * learns to fight alongside and against the baseline it has to beat.
 */
export class CombatEnv {
  sim!: FpsSim;
  learner!: Agent;
  scenario: Scenario = 'duel';
  steps = 0;
  episodeReturn = 0;
  private rng: Rng;
  /** Opponent aim-error multiplier range; lower = harder. Set by the curriculum. */
  opponentSkill: [number, number] = [1.6, 2.2];
  readonly obs = new Float32Array(OBS_SIZE);
  forceScenario: Scenario | null = null;

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  private pickScenario(): Scenario {
    if (this.forceScenario) return this.forceScenario;
    let u = this.rng.next();
    for (const [s, w] of SCENARIO_WEIGHTS) {
      u -= w;
      if (u <= 0) return s;
    }
    return 'duel';
  }

  reset(): Float32Array {
    this.scenario = this.pickScenario();
    const layout = this.scenario === 'duel_random' || this.scenario === 'ffa4' ? this.rng.pick(randomLayouts) : classic;
    const sim = new FpsSim({ seed: this.rng.int(1e9), layout, recordEvents: false });
    sim.brains.heuristic = heuristicBrain;
    this.sim = sim;
    const skill = () => this.rng.range(this.opponentSkill[0], this.opponentSkill[1]);
    const face = (x: number, z: number) => yawTo(x, z, 0, 0) + this.rng.range(-0.8, 0.8);

    if (this.scenario === 'ffa4') {
      const spawns = sim.arena.spawns.slice().sort(() => this.rng.next() - 0.5);
      this.learner = sim.spawn(0, 'external', spawns[0].x, spawns[0].z, face(spawns[0].x, spawns[0].z));
      for (let i = 1; i < 4; i++) sim.spawn(i, 'heuristic', spawns[i].x, spawns[i].z, face(spawns[i].x, spawns[i].z)).skill = skill();
    } else {
      const n = this.scenario === 'team2' ? 2 : this.scenario === 'team3' ? 3 : 1;
      const flip = this.rng.next() < 0.5 ? 1 : 0;
      const s0 = sim.arena.teamSpawns[flip];
      const s1 = sim.arena.teamSpawns[1 - flip];
      // Random spawn inside the team group so the learner is not always in front.
      const order = [...Array(n).keys()].sort(() => this.rng.next() - 0.5);
      for (let i = 0; i < n; i++) {
        const p = s0[order[i]];
        const a = sim.spawn(0, i === 0 ? 'external' : 'heuristic', p.x, p.z, face(p.x, p.z));
        if (i === 0) this.learner = a;
        else a.skill = skill();
      }
      for (let i = 0; i < n; i++) sim.spawn(1, 'heuristic', s1[i].x, s1[i].z, face(s1[i].x, s1[i].z)).skill = skill();
    }
    this.learner.skill = 1;
    this.steps = 0;
    this.episodeReturn = 0;
    sim.perceive(this.learner);
    return buildObservation(sim, this.learner, this.obs);
  }

  /** Applies one action for 0.1 s. Returns the reward and whether the episode ended. */
  step(action: number): { reward: number; done: boolean; won: boolean } {
    const sim = this.sim;
    const me = this.learner;
    sim.setAction(me, action);
    for (let k = 0; k < TICKS_PER_STEP; k++) {
      sim.step();
      if (!me.alive) break;
    }
    this.steps++;
    let reward = me.reward - STEP_PENALTY;
    me.reward = 0;
    let enemiesAlive = 0;
    for (const a of sim.agents) if (a.alive && a.team !== me.team) enemiesAlive++;
    const won = me.alive && enemiesAlive === 0;
    if (won) reward += WIN_BONUS;
    const done = !me.alive || won || this.steps >= MAX_STEPS;
    this.episodeReturn += reward;
    if (!done) {
      sim.perceive(me);
      buildObservation(sim, me, this.obs);
    }
    return { reward, done, won };
  }
}
