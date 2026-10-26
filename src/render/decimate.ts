import * as THREE from 'three';

/**
 * Low-detail copies of meshes for weak devices (the Simplified soldiers
 * setting). Vertex clustering: snap every vertex to a grid, merge the ones that
 * share a cell (each merged vertex keeps the first one's skin weights and UVs,
 * so skinned meshes still animate), and drop triangles that collapse.
 *
 * The cell size grows until the result is under `maxTris`, so it adapts to
 * whatever model is loaded.
 */
export const decimate = (geo: THREE.BufferGeometry, maxTris: number): THREE.BufferGeometry => {
  const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  if (tris <= maxTris) return geo;
  geo.computeBoundingBox();
  const size = geo.boundingBox!.getSize(new THREE.Vector3());
  let cell = Math.max(size.x, size.y, size.z) / 160;
  for (let attempt = 0; attempt < 12; attempt++) {
    const out = cluster(geo, cell);
    if (out.index!.count / 3 <= maxTris) return out;
    out.dispose();
    cell *= 1.35;
  }
  return cluster(geo, cell);
};

const cluster = (geo: THREE.BufferGeometry, cell: number): THREE.BufferGeometry => {
  const pos = geo.attributes.position;
  const n = pos.count;
  const rep = new Int32Array(n);
  const cells = new Map<string, number>();
  const kept: number[] = [];
  // Merged vertices sit at the average of their cell, which keeps the outline.
  const sum: number[] = [];
  const cnt: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)}`;
    let r = cells.get(key);
    if (r === undefined) {
      r = kept.length;
      cells.set(key, r);
      kept.push(i);
      sum.push(0, 0, 0);
      cnt.push(0);
    }
    sum[r * 3] += x;
    sum[r * 3 + 1] += y;
    sum[r * 3 + 2] += z;
    cnt[r]++;
    rep[i] = r;
  }

  const index: number[] = [];
  const seen = new Set<string>();
  const src = geo.index;
  const tri = src ? src.count / 3 : n / 3;
  for (let t = 0; t < tri; t++) {
    const a = rep[src ? src.getX(t * 3) : t * 3];
    const b = rep[src ? src.getX(t * 3 + 1) : t * 3 + 1];
    const c = rep[src ? src.getX(t * 3 + 2) : t * 3 + 2];
    if (a === b || b === c || a === c) continue;
    // The same triangle can survive from several merged ones; keep it once.
    const lo = Math.min(a, b, c);
    const hi = Math.max(a, b, c);
    const key = `${lo},${a + b + c - lo - hi},${hi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    index.push(a, b, c);
  }

  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    if (name === 'normal') continue;
    // Read through the accessors so interleaved (glTF) attributes work too.
    const a = attr as THREE.BufferAttribute;
    const size = a.itemSize;
    // (The accessors un-normalize, so normalized attributes come out as floats.)
    const Arr = a.normalized ? Float32Array : (a.array.constructor as new (len: number) => THREE.TypedArray);
    const arr = new Arr(kept.length * size);
    const get = [a.getX, a.getY, a.getZ, a.getW];
    kept.forEach((v, k) => {
      for (let j = 0; j < size; j++) arr[k * size + j] = get[j].call(a, v);
    });
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  const p = out.attributes.position;
  for (let k = 0; k < kept.length; k++) p.setXYZ(k, sum[k * 3] / cnt[k], sum[k * 3 + 1] / cnt[k], sum[k * 3 + 2] / cnt[k]);
  out.setIndex(index);
  out.computeVertexNormals();
  return out;
};
