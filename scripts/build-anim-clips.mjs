// Extracts animation curves from FBX files into JSON clips.
//
//   node scripts/build-anim-clips.mjs [srcDir] [outDir]
//
// Defaults: assets-src/anims -> public/anims. Each output file is named after
// the source (lower-case, spaces -> dashes). Mesh data in the FBX is ignored:
// the rig is loaded once from public/models/stickman_base.fbx. Keyframe values
// are rounded to 5 dp; times are NOT rounded (doing so shifts fast tracks).
// Root motion is left in place; AssetRegistry strips hip X/Z at load time.
import fs from 'node:fs';
import path from 'node:path';

// FBXLoader touches a few browser globals; stub just enough for curve data.
globalThis.self = globalThis;
globalThis.window = globalThis;
const THREE = await import('three');
THREE.ImageLoader.prototype.load = function (_url, onLoad) {
  const img = {};
  onLoad?.(img);
  return img;
};
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');

const src = process.argv[2] ?? 'assets-src/anims';
const out = process.argv[3] ?? 'public/anims';
if (!fs.existsSync(src)) {
  console.error(`No source directory at ${src}`);
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });
const loader = new FBXLoader();
const round = (n) => Math.round(n * 1e5) / 1e5;
const report = [];
const skip = (f) => /t-pose/i.test(f);
for (const file of fs.readdirSync(src).filter((f) => f.toLowerCase().endsWith('.fbx') && !skip(f)).sort()) {
  const buf = fs.readFileSync(path.join(src, file));
  let group;
  try {
    group = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  } catch (e) {
    report.push(`${file}: FAILED to parse (${e.message})`);
    process.exitCode = 1;
    continue;
  }
  const clip = group.animations?.[0];
  if (!clip) {
    report.push(`${file}: no animation track (skipped)`);
    continue;
  }
  const json = THREE.AnimationClip.toJSON(clip);
  for (const t of json.tracks) {
    t.times = Array.from(t.times);
    t.values = Array.from(t.values, round);
  }
  const bones = new Set(json.tracks.map((t) => t.name.split('.')[0]));
  const hips = json.tracks.find((t) => t.name === 'mixamorigHips.position');
  const travel = hips ? Math.hypot(hips.values.at(-3) - hips.values[0], hips.values.at(-1) - hips.values[2]) : 0;
  const name = file.replace(/\.fbx$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(json));
  const mixamo = [...bones].every((b) => b.startsWith('mixamorig'));
  report.push(`${name}.json  ${clip.duration.toFixed(2)}s  ${json.tracks.length} tracks  hip travel ${travel.toFixed(0)}cm  ${mixamo ? 'mixamo rig' : 'NON-MIXAMO BONES: ' + [...bones].slice(0, 3).join(',')}`);
}
console.log(report.join('\n'));
