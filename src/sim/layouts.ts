import type { ArenaLayout, Box, Point } from './Arena';
import { SOLDIER } from './config';
import { Rng } from './math';

const box = (cx: number, cz: number, w: number, d: number, h: number, kind: Box['kind']): Box => ({
  minX: cx - w / 2,
  maxX: cx + w / 2,
  minZ: cz - d / 2,
  maxZ: cz + d / 2,
  h,
  kind
});

/** The same obstacle in all four quadrants (deduplicated on the axes). */
const mirror4 = (cx: number, cz: number, w: number, d: number, h: number, kind: Box['kind']): Box[] => {
  const out: Box[] = [];
  const seen = new Set<string>();
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const key = `${cx * sx},${cz * sz}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(box(cx * sx, cz * sz, w, d, h, kind));
    }
  }
  return out;
};

/** The same obstacle rotated 90 degrees four times about the centre. */
const rotate4 = (cx: number, cz: number, w: number, d: number, h: number, kind: Box['kind']): Box[] => [
  box(cx, cz, w, d, h, kind),
  box(-cz, cx, d, w, h, kind),
  box(-cx, -cz, w, d, h, kind),
  box(cz, -cx, d, w, h, kind)
];

const perimeter = (H: number): Box[] => {
  const T = 1;
  return [
    box(0, H + T / 2, 2 * H + 2 * T, T, 4, 'wall'),
    box(0, -H - T / 2, 2 * H + 2 * T, T, 4, 'wall'),
    box(H + T / 2, 0, T, 2 * H, 4, 'wall'),
    box(-H - T / 2, 0, T, 2 * H, 4, 'wall')
  ];
};

/** Hand-built symmetric 60 x 60 m arena used by the practice modes. */
export const classicLayout = (): ArenaLayout => ({
  name: 'Arena',
  half: 30,
  boxes: [
    ...perimeter(30),
    // Central block with low crates around it.
    box(0, 0, 4, 4, 2.6, 'wall'),
    ...rotate4(0, 4.6, 1.4, 1.2, 1.1, 'crate'),
    // L-shaped bunkers in each quadrant.
    ...mirror4(13, 11.5, 6, 1, 3, 'wall'),
    ...mirror4(10.5, 14, 1, 6, 3, 'wall'),
    // Long walls across the mid-lanes.
    ...rotate4(0, 20, 8, 1, 3, 'wall'),
    // Pillars.
    ...rotate4(15, 0, 1.2, 1.2, 3.2, 'pillar'),
    // Low cover scattered through the lanes.
    ...mirror4(6.5, 7.5, 1.3, 1.3, 1.1, 'crate'),
    ...mirror4(22, 7, 1.6, 1.6, 1.2, 'crate'),
    ...mirror4(7, 23, 1.6, 1.6, 1.2, 'crate'),
    ...mirror4(23, 21.5, 2.2, 1.2, 1.8, 'crate'),
    ...mirror4(19, 26, 1.2, 2.4, 1.8, 'crate')
  ],
  spawns: [
    { x: 26, z: 26 },
    { x: -26, z: 26 },
    { x: 26, z: -26 },
    { x: -26, z: -26 },
    { x: 0, z: 26.5 },
    { x: 0, z: -26.5 },
    { x: 26.5, z: 0 },
    { x: -26.5, z: 0 },
    { x: 15, z: 18 },
    { x: -15, z: -18 },
    { x: 18, z: -15 },
    { x: -18, z: 15 }
  ],
  teamSpawns: [
    [
      { x: -26.5, z: 0 },
      { x: -26, z: 4 },
      { x: -26, z: -4 },
      { x: -24, z: 8 },
      { x: -24, z: -8 }
    ],
    [
      { x: 26.5, z: 0 },
      { x: 26, z: -4 },
      { x: 26, z: 4 },
      { x: 24, z: -8 },
      { x: 24, z: 8 }
    ]
  ]
});

const overlaps = (a: Box, b: Box, margin: number): boolean =>
  a.minX - margin < b.maxX && a.maxX + margin > b.minX && a.minZ - margin < b.maxZ && a.maxZ + margin > b.minZ;

const freeAt = (boxes: Box[], x: number, z: number, r: number): boolean => {
  for (const b of boxes) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
  }
  return true;
};

/**
 * Hollow building: four walls with a doorway in at least two of them.
 * Returns the wall boxes plus a footprint used for spacing other objects.
 */
const building = (rng: Rng, cx: number, cz: number, w: number, d: number): { walls: Box[]; footprint: Box } => {
  const t = 0.5;
  const h = 3 + rng.next() * 1.5;
  const door = 2.2;
  const walls: Box[] = [];
  const doors = [true, true, rng.next() < 0.5, rng.next() < 0.5];
  // Shuffle which sides get the guaranteed doors.
  for (let i = doors.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [doors[i], doors[j]] = [doors[j], doors[i]];
  }
  const side = (x0: number, z0: number, x1: number, z1: number, hasDoor: boolean) => {
    const horizontal = z0 === z1;
    const len = horizontal ? x1 - x0 : z1 - z0;
    if (!hasDoor || len < door + 2) {
      walls.push(horizontal ? box((x0 + x1) / 2, z0, len + t, t, h, 'wall') : box(x0, (z0 + z1) / 2, t, len + t, h, 'wall'));
      return;
    }
    const at = 1 + rng.next() * (len - door - 2);
    const a = at;
    const b = len - at - door;
    if (horizontal) {
      walls.push(box(x0 + a / 2, z0, a + t, t, h, 'wall'));
      walls.push(box(x1 - b / 2, z0, b + t, t, h, 'wall'));
    } else {
      walls.push(box(x0, z0 + a / 2, t, a + t, h, 'wall'));
      walls.push(box(x0, z1 - b / 2, t, b + t, h, 'wall'));
    }
  };
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const z0 = cz - d / 2;
  const z1 = cz + d / 2;
  side(x0, z0, x1, z0, doors[0]);
  side(x0, z1, x1, z1, doors[1]);
  side(x0, z0, x0, z1, doors[2]);
  side(x1, z0, x1, z1, doors[3]);
  if (rng.next() < 0.7) walls.push(box(cx + (rng.next() - 0.5) * (w - 3), cz + (rng.next() - 0.5) * (d - 3), 1.2, 1.2, 1.1, 'crate'));
  return { walls, footprint: box(cx, cz, w, d, h, 'wall') };
};

/** Seeded procedural map: buildings, wall segments, crates and pillars. */
export const randomLayout = (seed: number, half = 55): ArenaLayout => {
  const rng = new Rng(seed);
  const H = half;
  const boxes: Box[] = [...perimeter(H)];
  const placed: Box[] = [];
  const tryPlace = (w: number, d: number, margin: number, make: (cx: number, cz: number) => Box[], footprint?: (cx: number, cz: number) => Box) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const cx = rng.range(-H + w / 2 + 3, H - w / 2 - 3);
      const cz = rng.range(-H + d / 2 + 3, H - d / 2 - 3);
      const fp = footprint ? footprint(cx, cz) : box(cx, cz, w, d, 1, 'crate');
      if (placed.some((p) => overlaps(fp, p, margin))) continue;
      placed.push(fp);
      boxes.push(...make(cx, cz));
      return;
    }
  };
  const area = (2 * H) * (2 * H);
  const nBuildings = Math.round(area / 900);
  for (let i = 0; i < nBuildings; i++) {
    const w = rng.range(7, 13);
    const d = rng.range(7, 13);
    let fpBox: Box | null = null;
    let walls: Box[] = [];
    tryPlace(
      w,
      d,
      4,
      () => walls,
      (cx, cz) => {
        const b = building(rng, cx, cz, w, d);
        walls = b.walls;
        fpBox = b.footprint;
        return fpBox;
      }
    );
  }
  const nWalls = Math.round(area / 1100);
  for (let i = 0; i < nWalls; i++) {
    const len = rng.range(4, 10);
    const horizontal = rng.next() < 0.5;
    const w = horizontal ? len : 0.8;
    const d = horizontal ? 0.8 : len;
    tryPlace(w, d, 2.5, (cx, cz) => [box(cx, cz, w, d, rng.range(2.2, 3.2), 'wall')]);
  }
  const nCrates = Math.round(area / 220);
  for (let i = 0; i < nCrates; i++) {
    const s = rng.range(1.1, 2.2);
    const h = rng.next() < 0.6 ? rng.range(1, 1.25) : rng.range(1.6, 2.2);
    tryPlace(s, s, 2.2, (cx, cz) => [box(cx, cz, s, s, h, 'crate')]);
  }
  const nPillars = Math.round(area / 700);
  for (let i = 0; i < nPillars; i++) {
    tryPlace(1.2, 1.2, 2.5, (cx, cz) => [box(cx, cz, 1.2, 1.2, rng.range(2.6, 3.6), 'pillar')]);
  }

  // Spawns: free points spread across the map.
  const r = SOLDIER.radius + 0.6;
  const spawns: Point[] = [];
  for (let attempt = 0; attempt < 20000 && spawns.length < 40; attempt++) {
    const x = rng.range(-H + 3, H - 3);
    const z = rng.range(-H + 3, H - 3);
    if (!freeAt(boxes, x, z, r)) continue;
    if (placed.some((p) => x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ)) continue;
    if (spawns.some((s) => Math.hypot(s.x - x, s.z - z) < (H > 60 ? 45 : Math.min(H / 4, 22)))) continue;
    spawns.push({ x, z });
  }
  const team = (sx: number): Point[] => {
    const out: Point[] = [];
    for (let attempt = 0; attempt < 2000 && out.length < 6; attempt++) {
      const x = sx * (H - rng.range(3, 9));
      const z = rng.range(-12, 12);
      if (freeAt(boxes, x, z, r) && out.every((p) => Math.hypot(p.x - x, p.z - z) > 2)) out.push({ x, z });
    }
    return out;
  };
  return { name: `Random #${seed}`, half: H, boxes, spawns, teamSpawns: [team(-1), team(1)] };
};

/**
 * Practice range, 70 m deep: a shooting line with a bench at the south end,
 * four lanes split by low dividers, and a few crates at the far end for
 * practising peeks. Targets stand at 10, 25 and 45 m from the line.
 */
export const RANGE_LINE_Z = -30;
export const rangeLayout = (): ArenaLayout => ({
  name: 'Training Range',
  half: 35,
  boxes: [
    ...perimeter(35),
    // The bench along the shooting line (gaps at each end to walk downrange).
    box(0, -27.6, 40, 0.6, 0.78, 'crate'),
    // Low lane dividers.
    ...[-12, 0, 12].map((x) => box(x, 2, 0.4, 50, 0.7, 'wall')),
    // Crates and a pillar downrange for peeking practice.
    box(-24, 24, 2.4, 2.4, 1.4, 'crate'),
    box(24, 24, 2.4, 2.4, 1.4, 'crate'),
    box(0, 30, 6, 1, 3, 'wall'),
    box(-6, 18, 1.4, 1.4, 3, 'pillar'),
    box(6, 18, 1.4, 1.4, 3, 'pillar')
  ],
  spawns: [-16, -8, 0, 8, 16, -24, 24, 4].map((x) => ({ x, z: -28.5 })),
  teamSpawns: [
    [0, -8, 8, -16, 16, -4, 4, 12].map((x) => ({ x, z: -28.5 })),
    [{ x: 0, z: 25 }]
  ]
});
