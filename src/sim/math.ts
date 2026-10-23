export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Wraps an angle into (-PI, PI]. */
export const wrapAngle = (a: number): number => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

/**
 * Heading convention shared by the simulation and the renderer:
 * forward = (sin yaw, cos yaw) on the XZ plane, right = (-cos yaw, sin yaw).
 * A Mixamo rig faces +Z, so a model's rotation.y is exactly its yaw.
 */
export const forwardX = (yaw: number): number => Math.sin(yaw);
export const forwardZ = (yaw: number): number => Math.cos(yaw);
export const rightX = (yaw: number): number => -Math.cos(yaw);
export const rightZ = (yaw: number): number => Math.sin(yaw);

/** Yaw that faces from (x0,z0) toward (x1,z1). */
export const yawTo = (x0: number, z0: number, x1: number, z1: number): number => Math.atan2(x1 - x0, z1 - z0);

export const dist2 = (ax: number, az: number, bx: number, bz: number): number => Math.hypot(bx - ax, bz - az);

/** Small, fast, seedable PRNG (mulberry32). Headless training must be reproducible. */
export class Rng {
  private s: number;
  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
  /** Standard normal (Box-Muller). */
  gauss(): number {
    const u = Math.max(1e-9, this.next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }
}
