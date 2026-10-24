import { ACTIONS, type Agent, type BotStyle } from '../sim/Agent';
import type { Brain, FpsSim } from '../sim/FpsSim';
import { heuristicBrain } from '../sim/heuristicBrain';
import { buildObservation, OBS_SIZE, OBS_VERSION } from '../sim/observation';
import { Mlp, sampleIndex, softmax, type MlpParams } from './mlp';

export interface PolicyMeta {
  obs_size: number;
  obs_version: number;
  actions: string[];
  algorithm: string;
  timesteps: number;
  trained_at?: string;
  evaluation?: Record<string, number>;
}

export interface PolicyFile {
  meta: PolicyMeta;
  actor: MlpParams;
}

export type PolicyStatus = { state: 'loading' } | { state: 'ready'; meta: PolicyMeta } | { state: 'missing'; reason: string };

/**
 * Personalities with their own fine-tuned policy (`npm run train -- --style <name> --from latest`).
 * Only the ones that beat the base policy in `npm run eval -- --styles` are listed; the rest use the base.
 */
const STYLE_POLICIES: BotStyle[] = ['rusher', 'tactician'];

const compatible = (m: PolicyMeta): boolean =>
  m.obs_size === OBS_SIZE && m.obs_version === OBS_VERSION && m.actions.length === ACTIONS.length && m.actions.every((a, i) => a === ACTIONS[i]);

/** A personality's own policy (soldier_<style>.json), if one was trained and still fits the game. */
const loadStyleNet = async (style: BotStyle): Promise<Mlp | null> => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}policies/soldier_${style}.json`, { cache: 'no-cache' });
    if (!res.ok) return null;
    const file = (await res.json()) as PolicyFile;
    return compatible(file.meta) ? new Mlp(file.actor) : null;
  } catch {
    return null;
  }
};

/**
 * Loads public/policies/soldier.json (written by `npm run train`) and the
 * per-personality policies beside it, and turns them into a Brain. Inference
 * is synchronous: each net is ~15k weights, which costs a few microseconds
 * per bot at 10 Hz.
 */
export const loadPolicy = async (): Promise<{ status: PolicyStatus; brain: Brain | null }> => {
  try {
    const stylesP = Promise.all(STYLE_POLICIES.map(async (s) => [s, await loadStyleNet(s)] as const));
    const res = await fetch(`${import.meta.env.BASE_URL}policies/soldier.json`, { cache: 'no-cache' });
    if (!res.ok) return { status: { state: 'missing', reason: 'No trained policy yet. Run `npm run train`.' }, brain: null };
    const file = (await res.json()) as PolicyFile;
    const m = file.meta;
    if (m.obs_size !== OBS_SIZE || m.obs_version !== OBS_VERSION) {
      return { status: { state: 'missing', reason: `Policy was trained on obs v${m.obs_version} (${m.obs_size}); game uses v${OBS_VERSION} (${OBS_SIZE}). Retrain.` }, brain: null };
    }
    if (m.actions.length !== ACTIONS.length || m.actions.some((a, i) => a !== ACTIONS[i])) {
      return { status: { state: 'missing', reason: 'Policy action space does not match the game. Retrain.' }, brain: null };
    }
    const base = new Mlp(file.actor);
    const nets: Partial<Record<BotStyle, Mlp>> = {};
    for (const [s, net] of await stylesP) if (net) nets[s] = net;
    return { status: { state: 'ready', meta: m }, brain: makePolicyBrain(base, nets) };
  } catch (e) {
    return { status: { state: 'missing', reason: `Could not load policy: ${(e as Error).message}` }, brain: null };
  }
};

/**
 * Samples from the policy at a slightly sharpened temperature: pure argmax
 * makes bots predictable, full sampling makes them twitchy.
 */
export const makePolicyBrain = (net: Mlp, byStyle: Partial<Record<BotStyle, Mlp>> = {}, temperature = 0.6): Brain => {
  const obs = new Float32Array(OBS_SIZE);
  return (a: Agent, sim: FpsSim): number => {
    if (!sim.target(a)) return heuristicBrain(a, sim);
    buildObservation(sim, a, obs);
    const p = softmax((byStyle[a.style] ?? net).forward(obs), temperature);
    return sampleIndex(p, sim.rng.next());
  };
};
