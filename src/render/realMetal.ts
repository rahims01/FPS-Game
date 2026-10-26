import * as THREE from 'three';

/**
 * The "Real Metal" soldier finish. Plain Phong shininess only reads as glossy
 * plastic; metal has no colour of its own beyond a tint, and what you see is
 * the world reflected in it, smeared along the brushing. So this is a
 * physically based material at full metalness, reflecting a small painted
 * environment (sky, bright horizon, ground, a few dark shapes so the
 * reflections have edges to catch), with a brushed grain driving roughness.
 * Both textures are drawn once on canvases and shared by every soldier.
 */
let env: THREE.Texture | null = null;
let grain: THREE.Texture | null = null;

/** A tiny equirectangular "world" for the metal to reflect. */
const environment = (): THREE.Texture => {
  if (env) return env;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#5f7fa6');
  sky.addColorStop(0.35, '#b9d0e8');
  sky.addColorStop(0.48, '#ffffff');
  sky.addColorStop(0.52, '#8b8f80');
  sky.addColorStop(0.7, '#4a4d40');
  sky.addColorStop(1, '#1d1f1a');
  g.fillStyle = sky;
  g.fillRect(0, 0, 256, 128);
  // Buildings and crates on the horizon: dark bands that give metal its contrast.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = 'rgba(30, 32, 30, 0.85)';
  for (let x = 0; x < 256; ) {
    const w = 8 + rnd() * 26;
    const h = 6 + rnd() * 22;
    if (rnd() > 0.35) g.fillRect(x, 64 - h, w, h);
    x += w + rnd() * 10;
  }
  // The sun: one hot spot for a crisp highlight.
  const sun = g.createRadialGradient(70, 26, 0, 70, 26, 18);
  sun.addColorStop(0, 'rgba(255,255,245,1)');
  sun.addColorStop(1, 'rgba(255,255,245,0)');
  g.fillStyle = sun;
  g.fillRect(40, 0, 60, 60);
  env = new THREE.CanvasTexture(c);
  env.mapping = THREE.EquirectangularReflectionMapping;
  env.colorSpace = THREE.SRGBColorSpace;
  return env;
};

/** Fine horizontal brushing: streaks of slightly different roughness. */
const brushed = (): THREE.Texture => {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7a7a7a';
  g.fillRect(0, 0, 128, 128);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const v = Math.round(90 + rnd() * 90);
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(rnd() * 128, rnd() * 128, 10 + rnd() * 60, 1);
  }
  grain = new THREE.CanvasTexture(c);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(3, 3);
  return grain;
};

/** How strongly reflections show: lower on night maps, where the painted daylight would glow. */
export let metalEnvIntensity = 1;
export const setMetalNight = (night: boolean): void => {
  metalEnvIntensity = night ? 0.3 : 1;
};

/** A Real Metal material in `color` (the colour tints the reflections, like steel, gold or anodised metal). */
export const realMetalMaterial = (color: THREE.ColorRepresentation): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    metalness: 1,
    roughness: 0.42,
    roughnessMap: brushed(),
    envMap: environment(),
    envMapIntensity: metalEnvIntensity
  });
