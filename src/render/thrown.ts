import * as THREE from 'three';
import type { ThrowableId } from '../sim/gear';

const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.25 });
const grip = new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.8 });
const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.8 });
const olive = new THREE.MeshStandardMaterial({ color: 0x3d4a2e, roughness: 0.6, metalness: 0.3 });
const tin = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.6 });
const smokeCan = new THREE.MeshStandardMaterial({ color: 0x5a6168, roughness: 0.6, metalness: 0.4 });
const bottle = new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
const rag = new THREE.MeshStandardMaterial({ color: 0xffb04a, emissive: 0xff5a00, emissiveIntensity: 1.5 });
const rubber = new THREE.MeshStandardMaterial({ color: 0xd8322d, roughness: 0.55 });

/**
 * A throwable, pointing along +Y (tip first for knives and spears). Used in
 * flight and when one sticks in a body or a wall.
 */
export const thrownModel = (kind: ThrowableId): THREE.Group => {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  switch (kind) {
    case 'tknife': {
      const blade = add(new THREE.BoxGeometry(0.03, 0.16, 0.004), steel, 0.04);
      blade.scale.x = 1;
      add(new THREE.ConeGeometry(0.015, 0.04, 4), steel, 0.14).scale.z = 0.15;
      add(new THREE.BoxGeometry(0.02, 0.1, 0.012), grip, -0.09);
      break;
    }
    case 'spear':
      add(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 6), wood, -0.6);
      add(new THREE.ConeGeometry(0.03, 0.18, 4), steel, 0.12);
      break;
    case 'molotov':
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10), bottle, 0);
      add(new THREE.CylinderGeometry(0.012, 0.016, 0.07, 8), bottle, 0.11);
      add(new THREE.SphereGeometry(0.02, 6, 6), rag, 0.16);
      break;
    case 'flash':
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.11, 10), tin, 0);
      add(new THREE.BoxGeometry(0.02, 0.03, 0.04), grip, 0.07);
      break;
    case 'smoke':
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.13, 10), smokeCan, 0);
      add(new THREE.BoxGeometry(0.02, 0.03, 0.04), grip, 0.08);
      break;
    case 'ball':
      add(new THREE.SphereGeometry(0.11, 14, 10), rubber, 0);
      break;
    default: {
      const body = add(new THREE.SphereGeometry(0.06, 10, 8), olive, 0);
      body.scale.set(1, 1.25, 1);
    }
  }
  return g;
};
