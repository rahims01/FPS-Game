import type { MlpParams } from '../src/rl/mlp';
import { Rng } from '../src/sim/math';

/**
 * Trainable MLP (tanh hidden, linear output) with manual backprop and Adam.
 *
 * All parameters live in ONE flat Float64Array (and the gradients in another)
 * with per-layer views, so worker threads can ship weights and gradients
 * as a single transferable buffer.
 */
export class Net {
  readonly sizes: number[];
  readonly params: Float64Array;
  readonly grad: Float64Array;
  readonly W: Float64Array[] = [];
  readonly b: Float64Array[] = [];
  private readonly gW: Float64Array[] = [];
  private readonly gb: Float64Array[] = [];
  private readonly m: Float64Array;
  private readonly v: Float64Array;
  private t = 0;
  private readonly acts: Float64Array[];
  private readonly deltas: Float64Array[];

  constructor(sizes: number[], rng: Rng, outScale = 1) {
    this.sizes = sizes;
    const L = sizes.length - 1;
    let total = 0;
    for (let l = 0; l < L; l++) total += sizes[l] * sizes[l + 1] + sizes[l + 1];
    this.params = new Float64Array(total);
    this.grad = new Float64Array(total);
    this.m = new Float64Array(total);
    this.v = new Float64Array(total);
    let off = 0;
    for (let l = 0; l < L; l++) {
      const nw = sizes[l] * sizes[l + 1];
      this.W.push(this.params.subarray(off, off + nw));
      this.gW.push(this.grad.subarray(off, off + nw));
      off += nw;
      this.b.push(this.params.subarray(off, off + sizes[l + 1]));
      this.gb.push(this.grad.subarray(off, off + sizes[l + 1]));
      off += sizes[l + 1];
      // Scaled-normal init; the policy head starts tiny so the first policy is near uniform.
      const std = (l === L - 1 ? outScale : Math.SQRT2) / Math.sqrt(sizes[l]);
      const w = this.W[l];
      for (let i = 0; i < w.length; i++) w[i] = rng.gauss() * std;
    }
    this.acts = sizes.map((n) => new Float64Array(n));
    this.deltas = sizes.map((n) => new Float64Array(n));
  }

  /** Forward pass. Returns the output layer (a view overwritten by the next call); activations are kept for backward(). */
  forward(x: ArrayLike<number>): Float64Array {
    const L = this.sizes.length - 1;
    const a0 = this.acts[0];
    for (let i = 0; i < a0.length; i++) a0[i] = x[i];
    for (let l = 0; l < L; l++) {
      const nin = this.sizes[l];
      const nout = this.sizes[l + 1];
      const inp = this.acts[l];
      const out = this.acts[l + 1];
      const W = this.W[l];
      const B = this.b[l];
      const hidden = l < L - 1;
      for (let o = 0; o < nout; o++) {
        let s = B[o];
        const row = o * nin;
        for (let i = 0; i < nin; i++) s += W[row + i] * inp[i];
        out[o] = hidden ? Math.tanh(s) : s;
      }
    }
    return this.acts[L];
  }

  /** Accumulates gradients for the most recent forward() given dLoss/dOutput. */
  backward(dOut: ArrayLike<number>): void {
    const L = this.sizes.length - 1;
    let delta = this.deltas[L];
    for (let i = 0; i < delta.length; i++) delta[i] = dOut[i];
    for (let l = L - 1; l >= 0; l--) {
      const nin = this.sizes[l];
      const nout = this.sizes[l + 1];
      const inp = this.acts[l];
      const W = this.W[l];
      const gW = this.gW[l];
      const gb = this.gb[l];
      for (let o = 0; o < nout; o++) {
        const d = delta[o];
        if (d === 0) continue;
        gb[o] += d;
        const row = o * nin;
        for (let i = 0; i < nin; i++) gW[row + i] += d * inp[i];
      }
      if (l === 0) break;
      const prev = this.deltas[l];
      prev.fill(0);
      for (let o = 0; o < nout; o++) {
        const d = delta[o];
        if (d === 0) continue;
        const row = o * nin;
        for (let i = 0; i < nin; i++) prev[i] += d * W[row + i];
      }
      // Through tanh: d/dx tanh = 1 - y^2.
      for (let i = 0; i < nin; i++) prev[i] *= 1 - inp[i] * inp[i];
      delta = prev;
    }
  }

  zeroGrad(): void {
    this.grad.fill(0);
  }

  /** Adam step on this.grad, divided by `scale` (sample count), with global-norm clipping. */
  step(lr: number, scale: number, maxNorm = 0.5): void {
    const g = this.grad;
    let sq = 0;
    for (let i = 0; i < g.length; i++) sq += (g[i] / scale) ** 2;
    const norm = Math.sqrt(sq);
    const k = (norm > maxNorm ? maxNorm / norm : 1) / scale;
    this.t++;
    const b1 = 0.9;
    const b2 = 0.999;
    const c1 = 1 - b1 ** this.t;
    const c2 = 1 - b2 ** this.t;
    const p = this.params;
    const m = this.m;
    const v = this.v;
    for (let i = 0; i < p.length; i++) {
      const gi = g[i] * k;
      m[i] = b1 * m[i] + (1 - b1) * gi;
      v[i] = b2 * v[i] + (1 - b2) * gi * gi;
      p[i] -= (lr * (m[i] / c1)) / (Math.sqrt(v[i] / c2) + 1e-8);
    }
  }

  toParams(): MlpParams {
    return { sizes: this.sizes, weights: this.W.map((w) => Array.from(w, (v) => +v.toFixed(6))), biases: this.b.map((b) => Array.from(b, (v) => +v.toFixed(6))) };
  }

  load(p: MlpParams): void {
    p.weights.forEach((w, l) => this.W[l].set(w));
    p.biases.forEach((b, l) => this.b[l].set(b));
  }
}
