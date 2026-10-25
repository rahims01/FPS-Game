import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { LoadedAssets } from '../assets/AssetRegistry';
import { weaponModels } from '../assets/weaponModels';
import { skinned, type SkinId } from '../assets/skins';
import { charmDef } from '../game/cosmetics';
import type { WeaponId } from '../sim/weapons';

/** A slowly turning 3D view of a gun wearing a camo (and charm), for the loadout screen. */
export const GunPreview = ({ assets, weapon, skin, charm }: { assets: LoadedAssets | null; weapon: WeaponId; skin: SkinId; charm: string }) => {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; holder: THREE.Group; raf: number } | null>(null);

  // One renderer for the panel's lifetime.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x403a30, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(1.5, 2, 2);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(30, 2, 0.01, 20);
    camera.position.set(0, 0.18, 1.35);
    camera.lookAt(0, 0, 0);
    const holder = new THREE.Group();
    scene.add(holder);
    const resize = () => {
      const w = el.clientWidth || 300;
      const h = el.clientHeight || 150;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const s = { renderer, scene, camera, holder, raf: 0 };
    state.current = s;
    const loop = (t: number) => {
      s.raf = requestAnimationFrame(loop);
      holder.rotation.y = Math.sin(t / 2400) * 0.7 + 0.25;
      renderer.render(scene, camera);
    };
    s.raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(s.raf);
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      state.current = null;
    };
  }, []);

  // Swap the gun whenever the pick changes.
  useEffect(() => {
    const s = state.current;
    if (!s || !assets) return;
    s.holder.clear();
    const m = weaponModels(assets.rifle)[weapon];
    const c = charmDef(charm);
    const gun = skinned(m.object, skin, weapon === 'knife' ? undefined : { shape: c.shape, color: c.color, at: m.length * 0.45 });
    // Prop space (+Y barrel, +Z up) to a side view: barrel pointing right.
    gun.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    const box = new THREE.Box3().setFromObject(gun);
    const size = box.getSize(new THREE.Vector3());
    const scale = 1.25 / Math.max(size.x, size.y, size.z, 0.01);
    gun.scale.setScalar(scale);
    const center = new THREE.Box3().setFromObject(gun).getCenter(new THREE.Vector3());
    gun.position.sub(center);
    s.holder.add(gun);
  }, [assets, weapon, skin, charm]);

  return <div className="gun-preview" ref={host} />;
};
