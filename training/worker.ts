/**
 * PPO worker thread: owns a slice of the environments, collects rollouts with
 * the weights the main thread sends, computes GAE, and later computes policy
 * and value gradients over its own samples. The main thread sums gradients
 * from every worker and applies one Adam step, so the result is identical to
 * single-threaded PPO with the same minibatch.
 */
import { parentPort, workerData } from 'node:worker_threads';
import type { BotStyle } from '../src/sim/Agent';
import { Rng } from '../src/sim/math';
import { CombatEnv } from './env';
import { Net } from './nn';

export interface WorkerInit {
  seed: number;
  envs: number;
  horizon: number;
  sizesActor: number[];
  sizesCritic: number[];
  style: BotStyle;
}

export type ToWorker =
  | { type: 'rollout'; actor: Float64Array; critic: Float64Array; oppSkill: [number, number]; gamma: number; lambda: number }
  | { type: 'grad'; actor: Float64Array; critic: Float64Array; shuffle: boolean; chunk: number; chunks: number; advMean: number; advStd: number; clip: number; entCoef: number };

export interface EpisodeStat {
  ret: number;
  won: boolean;
  len: number;
  scenario: string;
}

export type FromWorker =
  | { type: 'rolled'; episodes: EpisodeStat[]; advSum: number; advSq: number; n: number }
  | { type: 'grads'; actor: Float64Array; critic: Float64Array; count: number; kl: number; ent: number; clipped: number };

const init = workerData as WorkerInit;
const rng = new Rng(init.seed);
const actor = new Net(init.sizesActor, rng);
const critic = new Net(init.sizesCritic, rng);
const OBS = init.sizesActor[0];
const A = init.sizesActor[init.sizesActor.length - 1];
const H = init.horizon;
const E = init.envs;
const N = E * H;

const envs = Array.from({ length: E }, (_, i) => new CombatEnv(init.seed * 7 + i, init.style));
const obsNow = envs.map((e) => Float64Array.from(e.reset()));
const bufObs = new Float64Array(N * OBS);
const bufAct = new Int32Array(N);
const bufLogp = new Float64Array(N);
const bufVal = new Float64Array(N);
const bufRew = new Float64Array(N);
const bufDone = new Uint8Array(N);
const bufAdv = new Float64Array(N);
const bufRet = new Float64Array(N);
const order = Int32Array.from({ length: N }, (_, i) => i);
const lp = new Float64Array(A);

const logSoftmax = (logits: Float64Array): void => {
  let max = -Infinity;
  for (let k = 0; k < A; k++) max = Math.max(max, logits[k]);
  let sum = 0;
  for (let k = 0; k < A; k++) sum += Math.exp(logits[k] - max);
  const lse = max + Math.log(sum);
  for (let k = 0; k < A; k++) lp[k] = logits[k] - lse;
};

const rollout = (msg: Extract<ToWorker, { type: 'rollout' }>): FromWorker => {
  actor.params.set(msg.actor);
  critic.params.set(msg.critic);
  const episodes: EpisodeStat[] = [];
  for (const e of envs) e.opponentSkill = msg.oppSkill;
  for (let t = 0; t < H; t++) {
    for (let e = 0; e < E; e++) {
      const idx = e * H + t;
      const o = obsNow[e];
      bufObs.set(o, idx * OBS);
      logSoftmax(actor.forward(o));
      let u = rng.next();
      let a = A - 1;
      for (let k = 0; k < A; k++) {
        u -= Math.exp(lp[k]);
        if (u <= 0) {
          a = k;
          break;
        }
      }
      bufAct[idx] = a;
      bufLogp[idx] = lp[a];
      bufVal[idx] = critic.forward(o)[0];
      const r = envs[e].step(a);
      bufRew[idx] = r.reward;
      bufDone[idx] = r.done ? 1 : 0;
      if (r.done) {
        episodes.push({ ret: envs[e].episodeReturn, won: r.won, len: envs[e].steps, scenario: envs[e].scenario });
        obsNow[e].set(envs[e].reset());
      } else {
        obsNow[e].set(envs[e].obs);
      }
    }
  }
  let advSum = 0;
  let advSq = 0;
  for (let e = 0; e < E; e++) {
    let next = critic.forward(obsNow[e])[0];
    let gae = 0;
    for (let t = H - 1; t >= 0; t--) {
      const i = e * H + t;
      const nonTerminal = bufDone[i] ? 0 : 1;
      const delta = bufRew[i] + msg.gamma * next * nonTerminal - bufVal[i];
      gae = delta + msg.gamma * msg.lambda * nonTerminal * gae;
      bufAdv[i] = gae;
      bufRet[i] = gae + bufVal[i];
      next = bufVal[i];
      advSum += gae;
      advSq += gae * gae;
    }
  }
  return { type: 'rolled', episodes, advSum, advSq, n: N };
};

const dLogits = new Float64Array(A);
const dV = new Float64Array(1);

const grads = (msg: Extract<ToWorker, { type: 'grad' }>): FromWorker => {
  actor.params.set(msg.actor);
  critic.params.set(msg.critic);
  actor.zeroGrad();
  critic.zeroGrad();
  if (msg.shuffle) {
    for (let i = N - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
  }
  const start = Math.floor((msg.chunk * N) / msg.chunks);
  const end = Math.floor(((msg.chunk + 1) * N) / msg.chunks);
  let kl = 0;
  let entSum = 0;
  let clipped = 0;
  for (let s = start; s < end; s++) {
    const i = order[s];
    const o = bufObs.subarray(i * OBS, (i + 1) * OBS);
    logSoftmax(actor.forward(o));
    const a = bufAct[i];
    const ratio = Math.exp(lp[a] - bufLogp[i]);
    const adv = (bufAdv[i] - msg.advMean) / msg.advStd;
    // Clipped surrogate: when the clipped branch is active its gradient is zero.
    const isClipped = (adv >= 0 && ratio > 1 + msg.clip) || (adv < 0 && ratio < 1 - msg.clip);
    if (isClipped) clipped++;
    const gLogp = isClipped ? 0 : -adv * ratio;
    let ent = 0;
    for (let k = 0; k < A; k++) ent -= Math.exp(lp[k]) * lp[k];
    for (let k = 0; k < A; k++) {
      const p = Math.exp(lp[k]);
      // d logp_a/d logit_k = [k==a] - p_k ;  d(-H)/d logit_k = p_k (logp_k + H)
      dLogits[k] = gLogp * ((k === a ? 1 : 0) - p) + msg.entCoef * p * (lp[k] + ent);
    }
    actor.backward(dLogits);
    dV[0] = critic.forward(o)[0] - bufRet[i];
    critic.backward(dV);
    kl += bufLogp[i] - lp[a];
    entSum += ent;
  }
  return { type: 'grads', actor: actor.grad.slice(), critic: critic.grad.slice(), count: end - start, kl, ent: entSum, clipped };
};

parentPort!.on('message', (msg: ToWorker) => {
  const out = msg.type === 'rollout' ? rollout(msg) : grads(msg);
  if (out.type === 'grads') parentPort!.postMessage(out, [out.actor.buffer as ArrayBuffer, out.critic.buffer as ArrayBuffer]);
  else parentPort!.postMessage(out);
});
