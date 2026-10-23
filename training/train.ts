/**
 * PPO trainer for the soldier combat policy, parallelised over worker threads.
 *
 *   npm run train                       # 3M steps from scratch
 *   npm run train -- --steps 6e6        # longer
 *   npm run train -- --resume           # continue from training/checkpoints/latest.json
 *   npm run train -- --workers 4        # thread count (default: cores - 1)
 *
 * Writes public/policies/soldier.json (the browser loads it on start) and
 * training/checkpoints/latest.json (actor + critic, for --resume).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { MlpParams } from '../src/rl/mlp';
import { ACTIONS } from '../src/sim/Agent';
import { Rng } from '../src/sim/math';
import { OBS_SIZE, OBS_VERSION } from '../src/sim/observation';
import { Net } from './nn';
import type { EpisodeStat, FromWorker, ToWorker, WorkerInit } from './worker';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CKPT = join(ROOT, 'training', 'checkpoints', 'latest.json');
const POLICY = join(ROOT, 'public', 'policies', 'soldier.json');

const arg = (name: string, def: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};

const CFG = {
  totalSteps: arg('steps', 3e6),
  workers: arg('workers', Math.max(1, availableParallelism() - 1)),
  envsPerWorker: arg('envs', 8),
  horizon: arg('horizon', 128),
  epochs: 4,
  /** Minibatches per epoch. */
  chunks: 4,
  gamma: 0.99,
  lambda: 0.95,
  clip: 0.2,
  lr: arg('lr', 6e-4),
  entStart: 0.02,
  entEnd: 0.004,
  hidden: [64, 64],
  seed: arg('seed', 7)
};

const A = ACTIONS.length;
const rng = new Rng(CFG.seed);
const sizesActor = [OBS_SIZE, ...CFG.hidden, A];
const sizesCritic = [OBS_SIZE, ...CFG.hidden, 1];
const actor = new Net(sizesActor, rng, 0.01);
const critic = new Net(sizesCritic, rng, 1);
let stepsDone = 0;

interface Checkpoint {
  obs_size: number;
  obs_version: number;
  steps: number;
  actor: MlpParams;
  critic: MlpParams;
}

if (process.argv.includes('--resume') && existsSync(CKPT)) {
  const c = JSON.parse(readFileSync(CKPT, 'utf8')) as Checkpoint;
  if (c.obs_size !== OBS_SIZE || c.obs_version !== OBS_VERSION) {
    console.error(`checkpoint is obs v${c.obs_version}/${c.obs_size}, code is v${OBS_VERSION}/${OBS_SIZE}; start fresh instead`);
    process.exit(1);
  }
  if (c.actor.sizes.join() !== sizesActor.join()) {
    console.error(`checkpoint net ${c.actor.sizes.join('x')} differs from ${sizesActor.join('x')}`);
    process.exit(1);
  }
  actor.load(c.actor);
  critic.load(c.critic);
  stepsDone = c.steps;
  console.log(`resumed at ${stepsDone.toLocaleString()} steps`);
}

const save = (evaluation?: Record<string, number>) => {
  mkdirSync(dirname(CKPT), { recursive: true });
  mkdirSync(dirname(POLICY), { recursive: true });
  const ck: Checkpoint = { obs_size: OBS_SIZE, obs_version: OBS_VERSION, steps: stepsDone, actor: actor.toParams(), critic: critic.toParams() };
  writeFileSync(CKPT, JSON.stringify(ck));
  writeFileSync(
    POLICY,
    JSON.stringify({
      meta: { obs_size: OBS_SIZE, obs_version: OBS_VERSION, actions: [...ACTIONS], algorithm: 'PPO', timesteps: stepsDone, trained_at: new Date().toISOString(), evaluation },
      actor: ck.actor
    })
  );
};

/** Curriculum: opponents start sloppy and sharpen as training progresses. */
const curriculum = (progress: number): [number, number] => {
  const hi = 2.4 - 1.3 * Math.min(1, progress * 1.4);
  return [Math.max(0.7, hi - 0.6), hi];
};

const workers = Array.from({ length: CFG.workers }, (_, i) => {
  const data: WorkerInit = { seed: CFG.seed * 1000 + i + 1, envs: CFG.envsPerWorker, horizon: CFG.horizon, sizesActor, sizesCritic };
  return new Worker(new URL('./worker.ts', import.meta.url), { workerData: data, execArgv: ['--import', 'tsx'] });
});

const pending: ((m: FromWorker) => void)[] = [];
workers.forEach((w, i) => {
  w.on('message', (m: FromWorker) => pending[i]?.(m));
  w.on('error', (e) => {
    console.error(`worker ${i} crashed:`, e);
    process.exit(1);
  });
});

const ask = (msgs: ToWorker[]): Promise<FromWorker[]> =>
  Promise.all(
    workers.map(
      (w, i) =>
        new Promise<FromWorker>((resolve) => {
          pending[i] = resolve;
          w.postMessage(msgs[i]);
        })
    )
  );

const main = async () => {
  const N = CFG.workers * CFG.envsPerWorker * CFG.horizon;
  console.log(
    `PPO  obs=${OBS_SIZE} actions=${A} net=${CFG.hidden.join('x')} workers=${CFG.workers} envs=${CFG.workers * CFG.envsPerWorker} batch=${N} target=${CFG.totalSteps.toLocaleString()}`
  );
  const recent: EpisodeStat[] = [];
  const t0 = Date.now();
  const startSteps = stepsDone;
  let update = 0;
  let stopping = false;
  process.on('SIGINT', () => {
    if (stopping) process.exit(1);
    stopping = true;
    console.log('\nstopping after this update (Ctrl+C again to abort without saving)');
  });

  while (stepsDone < CFG.totalSteps && !stopping) {
    const progress = stepsDone / CFG.totalSteps;
    const oppSkill = curriculum(progress);
    const rolled = (await ask(
      workers.map(() => ({ type: 'rollout', actor: actor.params, critic: critic.params, oppSkill, gamma: CFG.gamma, lambda: CFG.lambda }))
    )) as Extract<FromWorker, { type: 'rolled' }>[];
    let advSum = 0;
    let advSq = 0;
    let n = 0;
    for (const r of rolled) {
      advSum += r.advSum;
      advSq += r.advSq;
      n += r.n;
      recent.push(...r.episodes);
    }
    while (recent.length > 400) recent.shift();
    stepsDone += n;
    const advMean = advSum / n;
    const advStd = Math.sqrt(Math.max(1e-12, advSq / n - advMean * advMean)) + 1e-8;

    const lr = CFG.lr * Math.max(0.1, 1 - progress);
    const entCoef = CFG.entStart + (CFG.entEnd - CFG.entStart) * progress;
    let kl = 0;
    let ent = 0;
    let clipped = 0;
    let count = 0;
    for (let epoch = 0; epoch < CFG.epochs; epoch++) {
      for (let chunk = 0; chunk < CFG.chunks; chunk++) {
        const res = (await ask(
          workers.map(() => ({
            type: 'grad',
            actor: actor.params,
            critic: critic.params,
            shuffle: chunk === 0,
            chunk,
            chunks: CFG.chunks,
            advMean,
            advStd,
            clip: CFG.clip,
            entCoef
          }))
        )) as Extract<FromWorker, { type: 'grads' }>[];
        actor.zeroGrad();
        critic.zeroGrad();
        let mbCount = 0;
        for (const r of res) {
          for (let i = 0; i < r.actor.length; i++) actor.grad[i] += r.actor[i];
          for (let i = 0; i < r.critic.length; i++) critic.grad[i] += r.critic[i];
          mbCount += r.count;
          kl += r.kl;
          ent += r.ent;
          clipped += r.clipped;
        }
        count += mbCount;
        actor.step(lr, mbCount);
        critic.step(lr, mbCount, 1);
      }
    }
    update++;

    const secs = (Date.now() - t0) / 1000;
    const sps = (stepsDone - startSteps) / secs;
    if (recent.length > 0) {
      const avg = (f: (r: EpisodeStat) => number) => recent.reduce((s, r) => s + f(r), 0) / recent.length;
      const eta = (CFG.totalSteps - stepsDone) / sps;
      console.log(
        `upd ${String(update).padStart(4)}  steps ${stepsDone.toLocaleString().padStart(10)}  ${Math.round(sps)}/s  ` +
          `return ${avg((r) => r.ret).toFixed(2).padStart(6)}  win ${(avg((r) => (r.won ? 1 : 0)) * 100).toFixed(0).padStart(3)}%  ` +
          `len ${avg((r) => r.len).toFixed(0).padStart(3)}  ent ${(ent / count).toFixed(2)}  kl ${(kl / count).toFixed(4)}  ` +
          `clip ${((clipped / count) * 100).toFixed(0)}%  opp ${oppSkill[0].toFixed(2)}-${oppSkill[1].toFixed(2)}  eta ${Math.round(eta / 60)}m`
      );
    }
    if (update % 10 === 0) save();
  }

  const winRate = recent.length ? recent.reduce((s, r) => s + (r.won ? 1 : 0), 0) / recent.length : 0;
  save({ recent_win_rate: +winRate.toFixed(3) });
  console.log(`saved ${POLICY}`);
  await Promise.all(workers.map((w) => w.terminate()));
};

void main();
