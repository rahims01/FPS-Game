/**
 * Measures the trained policy against the heuristic baseline.
 *
 *   npm run eval                  # 200 episodes per scenario
 *   npm run eval -- --episodes 50
 *
 * Runs the same scenarios twice: once with the learner slot driven by the
 * policy, once by the heuristic brain. The difference is what training bought.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { heuristicBrain } from '../src/sim/heuristicBrain';
import { Mlp, softmax, sampleIndex } from '../src/rl/mlp';
import type { PolicyFile } from '../src/rl/PolicyBrain';
import { CombatEnv, type Scenario } from './env';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--episodes');
const EPISODES = i >= 0 ? Number(process.argv[i + 1]) : 200;
const OPP_SKILL: [number, number] = [1.0, 1.0];

const file = JSON.parse(readFileSync(join(ROOT, 'public', 'policies', 'soldier.json'), 'utf8')) as PolicyFile;
const net = new Mlp(file.actor);

const run = (scenario: Scenario, who: 'policy' | 'heuristic') => {
  const env = new CombatEnv(scenario.length * 7919 + 13);
  env.forceScenario = scenario;
  env.opponentSkill = OPP_SKILL;
  let wins = 0;
  let kills = 0;
  let deaths = 0;
  let dmg = 0;
  for (let ep = 0; ep < EPISODES; ep++) {
    let obs = env.reset();
    for (;;) {
      const a = who === 'policy' ? sampleIndex(softmax(net.forward(obs), 0.6), env.sim.rng.next()) : heuristicBrain(env.learner, env.sim);
      const r = env.step(a);
      if (r.done) {
        if (r.won) wins++;
        break;
      }
      obs = env.obs;
    }
    kills += env.learner.kills;
    deaths += env.learner.deaths;
    dmg += env.learner.damageDealt;
  }
  return { win: wins / EPISODES, kd: kills / Math.max(1, deaths), dmg: dmg / EPISODES };
};

console.log(`policy: ${file.meta.algorithm}, ${file.meta.timesteps.toLocaleString()} steps, trained ${file.meta.trained_at ?? '?'}`);
console.log(`${EPISODES} episodes per row, opponents at skill ${OPP_SKILL[0]}\n`);
console.log('scenario      learner     win%    K/D   dmg/ep');
for (const s of ['duel', 'duel_random', 'team2', 'team3', 'ffa4'] as Scenario[]) {
  for (const who of ['heuristic', 'policy'] as const) {
    const r = run(s, who);
    console.log(`${s.padEnd(13)} ${who.padEnd(10)} ${(r.win * 100).toFixed(1).padStart(5)}  ${r.kd.toFixed(2).padStart(5)}  ${r.dmg.toFixed(0).padStart(6)}`);
  }
}
