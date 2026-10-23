/**
 * Serialised multilayer perceptron: tanh hidden layers, linear output.
 * weights[l] is row-major [out][in]. This is the on-disk format the trainer
 * writes and the browser reads; no ONNX runtime needed for a net this small.
 */
export interface MlpParams {
  sizes: number[];
  weights: number[][];
  biases: number[][];
}

export class Mlp {
  readonly sizes: number[];
  private readonly W: Float32Array[];
  private readonly b: Float32Array[];
  private readonly acts: Float32Array[];

  constructor(p: MlpParams) {
    this.sizes = p.sizes;
    this.W = p.weights.map((w) => Float32Array.from(w));
    this.b = p.biases.map((b) => Float32Array.from(b));
    this.acts = p.sizes.map((n) => new Float32Array(n));
  }

  /** Returns a view that is overwritten on the next call. */
  forward(x: ArrayLike<number>): Float32Array {
    this.acts[0].set(x as Float32Array);
    const L = this.sizes.length - 1;
    for (let l = 0; l < L; l++) {
      const nin = this.sizes[l];
      const nout = this.sizes[l + 1];
      const inp = this.acts[l];
      const out = this.acts[l + 1];
      const W = this.W[l];
      const B = this.b[l];
      for (let o = 0; o < nout; o++) {
        let s = B[o];
        const row = o * nin;
        for (let i = 0; i < nin; i++) s += W[row + i] * inp[i];
        out[o] = l < L - 1 ? Math.tanh(s) : s;
      }
    }
    return this.acts[L];
  }
}

export const softmax = (logits: ArrayLike<number>, temperature = 1): Float64Array => {
  const n = logits.length;
  const p = new Float64Array(n);
  let max = -Infinity;
  for (let i = 0; i < n; i++) max = Math.max(max, logits[i] / temperature);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    p[i] = Math.exp(logits[i] / temperature - max);
    sum += p[i];
  }
  for (let i = 0; i < n; i++) p[i] /= sum;
  return p;
};

export const sampleIndex = (p: ArrayLike<number>, u: number): number => {
  let c = 0;
  for (let i = 0; i < p.length; i++) {
    c += p[i];
    if (u < c) return i;
  }
  return p.length - 1;
};
