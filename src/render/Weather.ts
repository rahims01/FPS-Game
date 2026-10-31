import * as THREE from 'three';

export type WeatherKind = 'snow' | 'rain';

const BOX = 36;
const HEIGHT = 22;

/**
 * Snow or rain (an admin event): a box of particles that follows the camera, so
 * it costs the same on any map. Rain is drawn as short streaks.
 */
export class Weather {
  readonly object: THREE.Object3D;
  private pos: Float32Array;
  private speed: Float32Array;
  private count: number;
  private t = 0;

  constructor(readonly kind: WeatherKind, low: boolean) {
    this.count = (kind === 'rain' ? 1400 : 1100) * (low ? 0.4 : 1);
    const n = Math.floor(this.count);
    this.count = n;
    this.speed = new Float32Array(n);
    for (let i = 0; i < n; i++) this.speed[i] = kind === 'rain' ? 16 + Math.random() * 6 : 1 + Math.random() * 1.2;
    if (kind === 'snow') {
      this.pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) this.pos.set([(Math.random() - 0.5) * BOX, Math.random() * HEIGHT, (Math.random() - 0.5) * BOX], i * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false, fog: true });
      this.object = new THREE.Points(geo, mat);
    } else {
      // Two points per drop: the top and the bottom of the streak.
      this.pos = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const x = (Math.random() - 0.5) * BOX;
        const y = Math.random() * HEIGHT;
        const z = (Math.random() - 0.5) * BOX;
        this.pos.set([x, y, z, x, y + 0.45, z], i * 6);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      const mat = new THREE.LineBasicMaterial({ color: 0xaac4e0, transparent: true, opacity: 0.45, depthWrite: false, fog: true });
      this.object = new THREE.LineSegments(geo, mat);
    }
    this.object.frustumCulled = false;
  }

  /** Moves the box with the camera and lets everything fall. */
  update(dt: number, cam: THREE.Vector3): void {
    this.t += dt;
    this.object.position.set(Math.round(cam.x), Math.round(cam.y) - HEIGHT / 2, Math.round(cam.z));
    const p = this.pos;
    if (this.kind === 'snow') {
      for (let i = 0; i < this.count; i++) {
        const k = i * 3;
        p[k + 1] -= this.speed[i] * dt;
        p[k] += Math.sin(this.t * 0.8 + i) * 0.3 * dt;
        if (p[k + 1] < 0) p[k + 1] += HEIGHT;
      }
    } else {
      for (let i = 0; i < this.count; i++) {
        const k = i * 6;
        const d = this.speed[i] * dt;
        p[k + 1] -= d;
        p[k + 4] -= d;
        if (p[k + 1] < 0) {
          p[k + 1] += HEIGHT;
          p[k + 4] += HEIGHT;
        }
      }
    }
    (this.object as THREE.Points).geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    const o = this.object as THREE.Points;
    o.geometry.dispose();
    (o.material as THREE.Material).dispose();
  }
}
