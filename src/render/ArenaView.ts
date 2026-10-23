import * as THREE from 'three';
import type { Arena, Box } from '../sim/Arena';
import type { FpsSim } from '../sim/FpsSim';

/** Procedural canvas textures so the game ships without texture files. */
const canvasTexture = (size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = 1): THREE.CanvasTexture => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const noise = (g: CanvasRenderingContext2D, s: number, base: string, spread: number, n: number) => {
  g.fillStyle = base;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    const v = (Math.random() - 0.5) * spread;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
};

const groundTex = () =>
  canvasTexture(
    512,
    (g, s) => {
      noise(g, s, '#5b6152', 0.18, 9000);
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        g.beginPath();
        g.moveTo((i * s) / 4, 0);
        g.lineTo((i * s) / 4, s);
        g.moveTo(0, (i * s) / 4);
        g.lineTo(s, (i * s) / 4);
        g.stroke();
      }
    },
    1
  );

const concreteTex = () =>
  canvasTexture(256, (g, s) => {
    noise(g, s, '#9a968c', 0.14, 5000);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, s / 2 - 1, s, 2);
  });

const crateTex = () =>
  canvasTexture(256, (g, s) => {
    noise(g, s, '#8a6a3f', 0.16, 4000);
    g.strokeStyle = '#4e3a1f';
    g.lineWidth = 14;
    g.strokeRect(7, 7, s - 14, s - 14);
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(10, 10);
    g.lineTo(s - 10, s - 10);
    g.stroke();
  });

const medkitTex = () =>
  canvasTexture(128, (g, s) => {
    g.fillStyle = '#f2f2f2';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#d21f1f';
    g.fillRect(s * 0.4, s * 0.15, s * 0.2, s * 0.7);
    g.fillRect(s * 0.15, s * 0.4, s * 0.7, s * 0.2);
  });

const SUN_OFFSET = new THREE.Vector3(30, 70, 18);

export class ArenaView {
  readonly group = new THREE.Group();
  private zoneMesh: THREE.Mesh | null = null;
  private hill: THREE.Group | null = null;
  /** Team colours (team 0, team 1) for objective markers. */
  teamColors: [number, number] = [0x4ccf6a, 0xe0453a];
  private flagViews: { group: THREE.Group; ring: THREE.Mesh; cloth: THREE.Mesh; label: THREE.Sprite }[] = [];
  private medkitMeshes: THREE.Mesh[] = [];
  private medkitGeo = new THREE.BoxGeometry(0.5, 0.32, 0.5);
  private medkitMat: THREE.MeshStandardMaterial;
  private tagGeo = new THREE.BoxGeometry(0.22, 0.32, 0.04);
  private tagMatAlly = new THREE.MeshStandardMaterial({ color: 0x4fa8ff, emissive: 0x1a4a88, metalness: 0.6, roughness: 0.3 });
  private tagMatEnemy = new THREE.MeshStandardMaterial({ color: 0xffc04d, emissive: 0x885a10, metalness: 0.6, roughness: 0.3 });
  readonly sun: THREE.DirectionalLight;

  constructor(private sim: FpsSim) {
    const arena = sim.arena;
    const H = arena.half;
    const g = this.group;

    // Sky and light.
    const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a4535, 1.4);
    g.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    this.sun.position.set(SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z);
    this.sun.castShadow = true;
    // The shadow box follows the camera (see update), so big maps keep crisp shadows.
    const sc = this.sun.shadow.camera;
    const S = Math.min(H + 4, 48);
    sc.left = sc.bottom = -S;
    sc.right = sc.top = S;
    sc.near = 1;
    sc.far = 200;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    g.add(this.sun, this.sun.target);

    // Ground: playable square plus a darker apron out to the horizon.
    const gt = groundTex();
    gt.repeat.set(H / 4, H / 4);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * H, 2 * H), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    g.add(ground);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: 0x4a5040, roughness: 1 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.02;
    g.add(apron);

    const concrete = concreteTex();
    const crate = crateTex();
    const wallMat = new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.9 });
    const pillarMat = new THREE.MeshStandardMaterial({ map: concrete, color: 0xc9c2b4, roughness: 0.85 });
    const crateMat = new THREE.MeshStandardMaterial({ map: crate, roughness: 0.8 });
    for (const b of arena.boxes) g.add(this.boxMesh(b, b.kind === 'crate' ? crateMat : b.kind === 'pillar' ? pillarMat : wallMat));

    this.medkitMat = new THREE.MeshStandardMaterial({ map: medkitTex(), roughness: 0.5, emissive: 0x330000 });
  }

  private boxMesh(b: Box, mat: THREE.MeshStandardMaterial): THREE.Mesh {
    const w = b.maxX - b.minX;
    const d = b.maxZ - b.minZ;
    const geo = new THREE.BoxGeometry(w, b.h, d);
    // World-scaled UVs so textures keep their size on every box.
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const nrm = geo.attributes.normal as THREE.BufferAttribute;
    const tile = b.kind === 'crate' ? Math.max(w, d, b.h) : 2;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(nrm.getX(i));
      const ny = Math.abs(nrm.getY(i));
      const px = pos.getX(i) + (b.minX + b.maxX) / 2;
      const py = pos.getY(i) + b.h / 2;
      const pz = pos.getZ(i) + (b.minZ + b.maxZ) / 2;
      if (b.kind === 'crate') continue;
      if (ny > 0.5) uv.setXY(i, px / tile, pz / tile);
      else if (nx > 0.5) uv.setXY(i, pz / tile, py / tile);
      else uv.setXY(i, px / tile, py / tile);
    }
    const m = new THREE.Mesh(geo, mat);
    m.position.set((b.minX + b.maxX) / 2, b.h / 2, (b.minZ + b.maxZ) / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  update(time: number, focus: THREE.Vector3): void {
    const sim = this.sim;
    if (sim.arena.half + 4 > 48) {
      // Snap to whole metres so the shadow map doesn't shimmer as the camera moves.
      const fx = Math.round(focus.x);
      const fz = Math.round(focus.z);
      this.sun.target.position.set(fx, 0, fz);
      this.sun.position.set(fx + SUN_OFFSET.x, SUN_OFFSET.y, fz + SUN_OFFSET.z);
    }
    // Zone wall.
    if (sim.zone) {
      if (!this.zoneMesh) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x3fa9ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
        this.zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 40, 96, 1, true), mat);
        this.zoneMesh.position.y = 20;
        this.group.add(this.zoneMesh);
      }
      this.zoneMesh.visible = sim.zone.r > 0.1;
      this.zoneMesh.position.x = sim.zone.x;
      this.zoneMesh.position.z = sim.zone.z;
      this.zoneMesh.scale.set(Math.max(0.1, sim.zone.r), 1, Math.max(0.1, sim.zone.r));
    }
    // King-of-the-hill marker: a glowing ring and a faint light column.
    if (sim.rally) {
      if (!this.hill) {
        this.hill = new THREE.Group();
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.92, 1, 64),
          new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(1, 64),
          new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.12, depthWrite: false })
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 0.02;
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(1, 1, 12, 48, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })
        );
        beam.position.y = 6;
        this.hill.add(ring, disc, beam);
        this.group.add(this.hill);
      }
      this.hill.position.set(sim.rally.x, 0, sim.rally.z);
      this.hill.scale.set(sim.rally.r, 1, sim.rally.r);
    }
    // Domination flags: pole, cloth in the owner's colour, capture ring and a letter.
    sim.objectives.forEach((o, i) => {
      let fv = this.flagViews[i];
      if (!fv) {
        const g = new THREE.Group();
        g.position.set(o.x, 0, o.z);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 8), new THREE.MeshStandardMaterial({ color: 0xcfd3d6, metalness: 0.8, roughness: 0.3 }));
        pole.position.y = 2;
        pole.castShadow = true;
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 }));
        cloth.position.set(0.62, 3.55, 0);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(o.r - 0.12, o.r, 64),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const ctx = c.getContext('2d')!;
        ctx.font = `bold ${o.label.length > 1 ? 40 : 96}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(o.label, 64, 68);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(o.label, 64, 68);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
        label.position.y = 5;
        label.scale.setScalar(1.6);
        label.renderOrder = 9;
        g.add(pole, cloth, ring, label);
        this.group.add(g);
        fv = { group: g, ring, cloth, label };
        this.flagViews.push(fv);
      }
      const color = o.owner === 0 || o.owner === 1 ? this.teamColors[o.owner] : 0xf2f2f2;
      (fv.cloth.material as THREE.MeshStandardMaterial).color.setHex(color);
      (fv.ring.material as THREE.MeshBasicMaterial).color.setHex(color);
      (fv.label.material as THREE.SpriteMaterial).color.setHex(color);
      fv.cloth.rotation.y = Math.sin(time * 2 + i) * 0.25;
      // Capture-the-flag flags move: carried ones ride on the carrier, smaller and without a ring.
      fv.group.position.set(o.x, 0, o.z);
      fv.group.scale.setScalar(o.carried ? 0.55 : 1);
      fv.ring.visible = !o.carried;
    });
    // Medkits.
    while (this.medkitMeshes.length < sim.pickups.length) {
      const m = sim.pickups[this.medkitMeshes.length];
      const mesh =
        m.kind === 'medkit'
          ? new THREE.Mesh(this.medkitGeo, this.medkitMat)
          : new THREE.Mesh(this.tagGeo, m.team === sim.agents.find((a) => a.control === 'player')?.team ? this.tagMatAlly : this.tagMatEnemy);
      mesh.position.set(m.x, 0.35, m.z);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.medkitMeshes.push(mesh);
    }
    sim.pickups.forEach((m, i) => {
      const mesh = this.medkitMeshes[i];
      mesh.visible = m.active;
      if (m.active) {
        mesh.rotation.y = time * 1.5 + i;
        mesh.position.y = 0.35 + Math.sin(time * 2.5 + i) * 0.08;
      }
    });
  }

  static arenaSize(a: Arena): number {
    return a.half * 2;
  }
}
