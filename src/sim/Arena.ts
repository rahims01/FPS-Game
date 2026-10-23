import { SOLDIER } from './config';

/** Axis-aligned obstacle standing on the ground (y from 0 to h). */
export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  h: number;
  kind: 'wall' | 'crate' | 'pillar';
}

export interface Point {
  x: number;
  z: number;
}

export interface ArenaLayout {
  name: string;
  /** Playable area is [-half, half] on X and Z. */
  half: number;
  boxes: Box[];
  spawns: Point[];
  /** Two opposite spawn groups for team modes (team 0, team 1). */
  teamSpawns: [Point[], Point[]];
}

const NAV_CELL = 1;
const GRID_CELL = 6;

export class Arena {
  readonly name: string;
  readonly half: number;
  readonly boxes: Box[];
  readonly spawns: Point[];
  readonly teamSpawns: [Point[], Point[]];
  /** Points beside tall obstacles, used by the take_cover action. */
  readonly coverPoints: Point[];
  private readonly navN: number;
  private readonly navBlocked: Uint8Array;
  private readonly gridOrigin: number;
  private readonly gridN: number;
  private readonly grid: number[][];
  private readonly stamp: Int32Array;
  private stampId = 0;
  private readonly near: number[] = [];

  private gridCell(v: number): number {
    return Math.max(0, Math.min(this.gridN - 1, Math.floor((v - this.gridOrigin) / GRID_CELL)));
  }

  /** Indices of boxes whose cells overlap the square around (x, z). Valid until the next call. */
  private boxesNear(x: number, z: number, r: number): number[] {
    const out = this.near;
    out.length = 0;
    const id = ++this.stampId;
    const i0 = this.gridCell(x - r);
    const i1 = this.gridCell(x + r);
    const j0 = this.gridCell(z - r);
    const j1 = this.gridCell(z + r);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        for (const k of this.grid[i * this.gridN + j]) {
          if (this.stamp[k] === id) continue;
          this.stamp[k] = id;
          out.push(k);
        }
      }
    }
    return out;
  }

  constructor(layout: ArenaLayout) {
    this.name = layout.name;
    this.half = layout.half;
    this.boxes = layout.boxes;
    this.spawns = layout.spawns;
    this.teamSpawns = layout.teamSpawns;
    const H = this.half;

    // Broadphase grid: every query (collision, raycast, line of sight) only
    // looks at boxes in the cells it touches. Big random maps have ~500 boxes.
    this.gridOrigin = -H - 2;
    this.gridN = Math.ceil((2 * H + 4) / GRID_CELL);
    this.grid = Array.from({ length: this.gridN * this.gridN }, () => []);
    this.stamp = new Int32Array(this.boxes.length);
    this.boxes.forEach((b, k) => {
      const i0 = this.gridCell(b.minX);
      const i1 = this.gridCell(b.maxX);
      const j0 = this.gridCell(b.minZ);
      const j1 = this.gridCell(b.maxZ);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) this.grid[i * this.gridN + j].push(k);
    });

    // Navigation grid: a cell is blocked if a soldier standing at its centre
    // would overlap any obstacle.
    this.navN = Math.round((2 * H) / NAV_CELL);
    this.navBlocked = new Uint8Array(this.navN * this.navN);
    const r = SOLDIER.radius + 0.12;
    for (let i = 0; i < this.navN; i++) {
      for (let j = 0; j < this.navN; j++) {
        const x = -H + (i + 0.5) * NAV_CELL;
        const z = -H + (j + 0.5) * NAV_CELL;
        if (this.overlapsAny(x, z, r, 0)) this.navBlocked[i * this.navN + j] = 1;
      }
    }

    this.coverPoints = [];
    for (const b of this.boxes) {
      if (b.h < 1.4 && b.kind !== 'crate') continue;
      const off = SOLDIER.radius + 0.35;
      const w = b.maxX - b.minX;
      const d = b.maxZ - b.minZ;
      const along = (len: number) => Math.max(1, Math.round(len / 1.6));
      for (let k = 0; k <= along(w); k++) {
        const x = b.minX + (w * k) / along(w);
        this.coverPoints.push({ x, z: b.minZ - off }, { x, z: b.maxZ + off });
      }
      for (let k = 0; k <= along(d); k++) {
        const z = b.minZ + (d * k) / along(d);
        this.coverPoints.push({ x: b.minX - off, z }, { x: b.maxX + off, z });
      }
    }
    for (let i = this.coverPoints.length - 1; i >= 0; i--) {
      const p = this.coverPoints[i];
      if (Math.abs(p.x) > H - 1 || Math.abs(p.z) > H - 1 || !this.walkable(p.x, p.z)) this.coverPoints.splice(i, 1);
    }
  }

  /** True if a circle at (x,z) overlaps a box taller than `belowY` + step height. */
  overlapsAny(x: number, z: number, r: number, feetY: number): boolean {
    for (const k of this.boxesNear(x, z, r)) {
      const b = this.boxes[k];
      if (b.h <= feetY + SOLDIER.stepHeight) continue;
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
    }
    return false;
  }

  /** Height of the highest surface under a circle whose feet are at feetY (stepping onto low boxes). */
  groundHeight(x: number, z: number, r: number, feetY: number): number {
    let g = 0;
    for (const k of this.boxesNear(x, z, r)) {
      const b = this.boxes[k];
      if (b.h > feetY + SOLDIER.stepHeight) continue;
      if (x + r * 0.5 < b.minX || x - r * 0.5 > b.maxX || z + r * 0.5 < b.minZ || z - r * 0.5 > b.maxZ) continue;
      if (b.h > g) g = b.h;
    }
    return g;
  }

  /** Pushes a circle out of every obstacle it penetrates. Mutates p. */
  resolveCircle(p: Point, r: number, feetY: number): void {
    for (let iter = 0; iter < 2; iter++) {
      for (const k of this.boxesNear(p.x, p.z, r + 0.5)) {
        const b = this.boxes[k];
        if (b.h <= feetY + SOLDIER.stepHeight) continue;
        const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
        let dx = p.x - cx;
        let dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.z = cz + (dz / d) * r;
        } else {
          // Centre inside the box: leave by the nearest face.
          const exits = [p.x - b.minX, b.maxX - p.x, p.z - b.minZ, b.maxZ - p.z];
          const m = exits.indexOf(Math.min(...exits));
          dx = m === 0 ? -1 : m === 1 ? 1 : 0;
          dz = m === 2 ? -1 : m === 3 ? 1 : 0;
          if (m === 0) p.x = b.minX - r;
          else if (m === 1) p.x = b.maxX + r;
          else if (m === 2) p.z = b.minZ - r;
          else p.z = b.maxZ + r;
        }
      }
    }
  }

  /**
   * Distance along a normalised 3D ray to the first obstacle or the ground,
   * or maxDist. `normal` (optional) receives the surface normal that was hit.
   */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number, normal?: { x: number; y: number; z: number }): number {
    let best = maxDist;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    if (dy < -1e-9) {
      const t = -oy / dy;
      if (t >= 0 && t < best) {
        best = t;
        nx = 0;
        ny = 1;
        nz = 0;
      }
    }
    const ix = 1 / dx;
    const iy = 1 / dy;
    const iz = 1 / dz;
    const test = (b: Box) => {
      let t0x = (b.minX - ox) * ix;
      let t1x = (b.maxX - ox) * ix;
      if (t0x > t1x) [t0x, t1x] = [t1x, t0x];
      let t0y = (0 - oy) * iy;
      let t1y = (b.h - oy) * iy;
      if (t0y > t1y) [t0y, t1y] = [t1y, t0y];
      let t0z = (b.minZ - oz) * iz;
      let t1z = (b.maxZ - oz) * iz;
      if (t0z > t1z) [t0z, t1z] = [t1z, t0z];
      const tNear = Math.max(t0x, t0y, t0z);
      const tFar = Math.min(t1x, t1y, t1z);
      // !(<=) also rejects NaN from axis-parallel rays grazing a face.
      // tNear < 0 means the origin is inside the box: ignore it rather than block everything.
      if (!(tNear <= tFar) || tFar < 0 || tNear >= best || tNear < 0) return;
      best = tNear;
      nx = ny = nz = 0;
      if (tNear === t0x) nx = dx > 0 ? -1 : 1;
      else if (tNear === t0y) ny = dy > 0 ? -1 : 1;
      else nz = dz > 0 ? -1 : 1;
    };

    // 2D DDA through the broadphase grid; stop once the best hit lies before the current cell's exit.
    const G = GRID_CELL;
    const o = this.gridOrigin;
    let ci = Math.floor((ox - o) / G);
    let cj = Math.floor((oz - o) / G);
    if (ci < 0 || cj < 0 || ci >= this.gridN || cj >= this.gridN) {
      for (const b of this.boxes) test(b);
    } else {
      const id = ++this.stampId;
      const stepI = dx > 0 ? 1 : -1;
      const stepJ = dz > 0 ? 1 : -1;
      const adx = Math.abs(dx);
      const adz = Math.abs(dz);
      let tMaxI = adx > 1e-12 ? ((ci + (dx > 0 ? 1 : 0)) * G + o - ox) / dx : Infinity;
      let tMaxJ = adz > 1e-12 ? ((cj + (dz > 0 ? 1 : 0)) * G + o - oz) / dz : Infinity;
      const tDI = adx > 1e-12 ? G / adx : Infinity;
      const tDJ = adz > 1e-12 ? G / adz : Infinity;
      for (;;) {
        for (const k of this.grid[ci * this.gridN + cj]) {
          if (this.stamp[k] === id) continue;
          this.stamp[k] = id;
          test(this.boxes[k]);
        }
        const tExit = Math.min(tMaxI, tMaxJ);
        if (best <= tExit || tExit >= maxDist) break;
        if (tMaxI < tMaxJ) {
          ci += stepI;
          tMaxI += tDI;
        } else {
          cj += stepJ;
          tMaxJ += tDJ;
        }
        if (ci < 0 || cj < 0 || ci >= this.gridN || cj >= this.gridN) break;
      }
    }
    if (normal) {
      normal.x = nx;
      normal.y = ny;
      normal.z = nz;
    }
    return best;
  }

  /** Unobstructed straight line between two 3D points. */
  lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return true;
    return this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len) >= len - 1e-3;
  }

  /** Free distance from (x,z) along a horizontal direction at chest height. */
  probe(x: number, z: number, dx: number, dz: number, maxDist: number): number {
    return this.raycast(x, 1.0, z, dx, 0, dz, maxDist);
  }

  // ---------------------------------------------------------------- navigation

  private cellOf(x: number, z: number): [number, number] {
    const i = Math.max(0, Math.min(this.navN - 1, Math.floor((x + this.half) / NAV_CELL)));
    const j = Math.max(0, Math.min(this.navN - 1, Math.floor((z + this.half) / NAV_CELL)));
    return [i, j];
  }

  walkable(x: number, z: number): boolean {
    const [i, j] = this.cellOf(x, z);
    return this.navBlocked[i * this.navN + j] === 0;
  }

  /** The obstacle containing a 3D point, if any (grenade bounces). */
  boxAt(x: number, y: number, z: number): Box | null {
    for (const k of this.boxesNear(x, z, 0.05)) {
      const b = this.boxes[k];
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && y < b.h) return b;
    }
    return null;
  }

  /** A random walkable point within `radius` of (cx, cz), or null after enough misses. */
  randomFreePoint(rand: () => number, cx: number, cz: number, radius: number): Point | null {
    for (let k = 0; k < 60; k++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (Math.abs(x) > this.half - 1.5 || Math.abs(z) > this.half - 1.5) continue;
      if (this.walkable(x, z) && !this.overlapsAny(x, z, 0.9, 0)) return { x, z };
    }
    return null;
  }

  /** True if a soldier can walk straight from a to b (sampled against the nav grid). */
  walkableLine(a: Point, b: Point): boolean {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(len / (NAV_CELL * 0.4));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (!this.walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  /** Nearest walkable cell centre to a point (for goals inside obstacles). */
  private nearestWalkable(i: number, j: number): [number, number] {
    if (!this.navBlocked[i * this.navN + j]) return [i, j];
    for (let r = 1; r < 6; r++) {
      for (let di = -r; di <= r; di++) {
        for (let dj = -r; dj <= r; dj++) {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= this.navN || b >= this.navN) continue;
          if (!this.navBlocked[a * this.navN + b]) return [a, b];
        }
      }
    }
    return [i, j];
  }

  private gScore = new Float32Array(0);
  private came = new Int32Array(0);
  private closed = new Uint8Array(0);

  /** A* over the nav grid (8-connected, no corner cutting), then string-pulled. */
  findPath(from: Point, to: Point): Point[] {
    if (this.walkableLine(from, to)) return [{ x: to.x, z: to.z }];
    const N = this.navN;
    const total = N * N;
    if (this.gScore.length !== total) {
      this.gScore = new Float32Array(total);
      this.came = new Int32Array(total);
      this.closed = new Uint8Array(total);
    }
    this.gScore.fill(Infinity);
    this.closed.fill(0);
    const [si, sj] = this.nearestWalkable(...this.cellOf(from.x, from.z));
    const [gi, gj] = this.nearestWalkable(...this.cellOf(to.x, to.z));
    const start = si * N + sj;
    const goal = gi * N + gj;
    const heap = new MinHeap();
    this.gScore[start] = 0;
    this.came[start] = -1;
    heap.push(start, 0);
    const h = (c: number) => {
      const di = Math.abs(((c / N) | 0) - gi);
      const dj = Math.abs((c % N) - gj);
      return Math.max(di, dj) + 0.414 * Math.min(di, dj);
    };
    let found = false;
    while (heap.size > 0) {
      const c = heap.pop();
      if (c === goal) {
        found = true;
        break;
      }
      if (this.closed[c]) continue;
      this.closed[c] = 1;
      const ci = (c / N) | 0;
      const cj = c % N;
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
          const n = ni * N + nj;
          if (this.navBlocked[n] || this.closed[n]) continue;
          if (di && dj && (this.navBlocked[ci * N + nj] || this.navBlocked[ni * N + cj])) continue;
          const g = this.gScore[c] + (di && dj ? 1.414 : 1);
          if (g < this.gScore[n]) {
            this.gScore[n] = g;
            this.came[n] = c;
            heap.push(n, g + h(n));
          }
        }
      }
    }
    if (!found) return [{ x: to.x, z: to.z }];
    const cells: Point[] = [];
    for (let c = goal; c !== -1; c = this.came[c]) {
      cells.push({ x: -this.half + (((c / N) | 0) + 0.5) * NAV_CELL, z: -this.half + ((c % N) + 0.5) * NAV_CELL });
    }
    cells.reverse();
    cells[cells.length - 1] = this.walkable(to.x, to.z) ? { x: to.x, z: to.z } : cells[cells.length - 1];
    // String pulling: skip every waypoint that is visible from the last kept one.
    const out: Point[] = [];
    let anchor = from;
    let k = 0;
    while (k < cells.length) {
      let far = k;
      for (let m = cells.length - 1; m > k; m--) {
        if (this.walkableLine(anchor, cells[m])) {
          far = m;
          break;
        }
      }
      out.push(cells[far]);
      anchor = cells[far];
      k = far + 1;
    }
    return out;
  }
}

class MinHeap {
  private items: number[] = [];
  private keys: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.items.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}
