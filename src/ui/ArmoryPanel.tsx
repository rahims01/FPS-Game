import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { LoadedAssets } from '../assets/AssetRegistry';
import { tickSkins } from '../assets/skins';
import { FLASHES, NAMETAGS, RARITY, STYLES, THEME_COLORS, TRACERS, rarityOf, unlockText, unlocked, type Rarity, type Unlock, listedFor } from '../game/cosmetics';
import { COLORS, cssColor } from '../game/identity';
import type { GameSettings } from '../game/settings';
import { levelOf, type Profile } from '../game/progression';
import { SoldierView } from '../render/SoldierView';
import { drawNametag } from '../render/soldierStyle';
import { createAgent, setLoadout } from '../sim/Agent';
import { LockIcon } from './icons';
import { meleeDef } from '../assets/melees';

/** A turning 3D view of your soldier: colour, style, gun, camo and charm. */
const SoldierPreview = ({ assets, settings }: { assets: LoadedAssets | null; settings: GameSettings }) => {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{ scene: THREE.Scene; view: SoldierView | null; agent: ReturnType<typeof createAgent> } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || !assets) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x403a30, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb8ff, 1.2);
    rim.position.set(-3, 2, -2);
    scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), new THREE.MeshStandardMaterial({ color: 0x1c221c, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 30);
    camera.position.set(0, 1.25, 3.6);
    camera.lookAt(0, 0.95, 0);
    const resize = () => {
      const w = el.clientWidth || 300;
      const h = el.clientHeight || 360;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const agent = createAgent(0, 0, 'player', 0, 0, 0);
    state.current = { scene, view: null, agent };
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const s = state.current;
      if (s?.view) {
        // Turn slowly; stand idle with the gun up.
        agent.yaw = Math.sin(t / 2600) * 0.9 + 0.3;
        s.view.update(agent, 0, 0, 0, dt, t / 1000);
      }
      tickSkins(t / 1000);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      state.current?.view?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      state.current = null;
    };
  }, [assets]);

  // Rebuild the soldier whenever the look changes.
  useEffect(() => {
    const s = state.current;
    if (!s || !assets) return;
    s.view?.dispose();
    setLoadout(s.agent, [settings.primary, settings.secondary]);
    s.agent.kills = 6;
    const v = new SoldierView(assets, s.agent, settings.playerColor, settings.skins, settings.cosmetics.charm, meleeDef(settings.cosmetics.melee).id);
    v.setStyle(settings.cosmetics.style ?? 'none', settings.playerColor);
    s.scene.add(v.root);
    s.view = v;
  }, [assets, settings.playerColor, settings.cosmetics.style, settings.cosmetics.charm, settings.primary, settings.secondary, settings.skins]);

  return <div className="soldier-preview" ref={host} />;
};

/** A name tag rendered exactly as it looks in a match. */
const NametagPreview = ({ name, color, style }: { name: string; color: string; style: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    drawNametag(g, c.width, name, color, style, null);
  }, [name, color, style]);
  return <canvas ref={ref} width={512} height={96} className="nametag-preview" />;
};

interface Item {
  id: string;
  name: string;
  unlock: Unlock;
  rarity?: Rarity;
  secret?: boolean;
}

type Tab = 'colour' | 'style' | 'nametag' | 'tracer' | 'flash';

/** Colours, soldier styles, name tags, tracers and muzzle flashes, with a 3D preview. */
export const ArmoryPanel = ({
  settings,
  onChange,
  profile,
  assets,
  onOpenLoadout
}: {
  settings: GameSettings;
  onChange: (s: GameSettings) => void;
  profile: Profile;
  assets: LoadedAssets | null;
  /** Gun camos and charms live in Loadout; Armory points there. */
  onOpenLoadout?: () => void;
}) => {
  const [tab, setTab] = useState<Tab>('colour');
  const level = levelOf(profile.xp).level;
  const listed = listedFor(profile, level);
  const cos = settings.cosmetics;
  const setCos = (patch: Partial<typeof cos>) => onChange({ ...settings, cosmetics: { ...cos, ...patch } });

  /** A picker tile: rarity border, lock with what unlocks it, secrets hidden until earned. */
  const tile = (item: Item, on: boolean, pick: () => void, preview: React.ReactNode) => {
    const ok = unlocked(item.unlock, profile, level, item.id);
    const r = rarityOf(item);
    const hidden = item.secret && !ok;
    return (
      <button
        key={item.id}
        className={`arm-tile ${on ? 'on' : ''} ${ok ? '' : 'locked'}`}
        style={{ borderColor: on ? 'var(--accent)' : RARITY[r].color }}
        disabled={!ok}
        title={ok ? item.name : hidden ? 'Secret: keep playing to find out' : unlockText(item.unlock)}
        onClick={pick}
      >
        <span className="arm-preview">{hidden ? '?' : preview}</span>
        <b>{hidden ? '???' : item.name}</b>
        <small style={{ color: RARITY[r].color }}>{RARITY[r].name}</small>
        {!ok && <small className="arm-lock"><LockIcon size={11} /> {hidden ? 'Secret' : unlockText(item.unlock)}</small>}
      </button>
    );
  };

  return (
    <div className="armory">
      <div className="armory-stage">
        <SoldierPreview assets={assets} settings={settings} />
        <NametagPreview name={settings.playerName || 'You'} color={cssColor(settings.playerColor)} style={cos.nametag} />
      </div>
      <div className="armory-picks">
        {onOpenLoadout && (
          <p className="armory-elsewhere">
            Looking for gun camos or charms? They're in Loadout, next to each gun.
            <button className="chip" onClick={onOpenLoadout}>
              Open Loadout
            </button>
          </p>
        )}
        <div className="set-tabs">
          {(
            [
              ['colour', 'Colour'],
              ['style', 'Style'],
              ['nametag', 'Name tag'],
              ['tracer', 'Tracers'],
              ['flash', 'Muzzle flash']
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} className={`set-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'colour' && (
          <>
            <p className="set-hint">Your colour in free-for-all modes and on your soldier. Team modes use team colours.</p>
            <div className="arm-grid">
              {COLORS.map((c) => tile({ id: String(c.hex), name: c.name, unlock: null }, settings.playerColor === c.hex, () => onChange({ ...settings, playerColor: c.hex }), <i className="arm-swatch" style={{ background: cssColor(c.hex) }} />))}
              {THEME_COLORS.filter(listed).map((c) =>
                tile(c, settings.playerColor === c.hex, () => onChange({ ...settings, playerColor: c.hex }), <i className={`arm-swatch ${c.finish}`} style={{ background: cssColor(c.hex) }} />)
              )}
            </div>
          </>
        )}
        {tab === 'style' && (
          <>
            <p className="set-hint">How your soldier wears its colour. In team modes, styles that change colour pulse in your team's colour instead.</p>
            <div className="arm-grid">
              {STYLES.filter(listed).map((s) =>
                tile(s, (cos.style ?? 'none') === s.id, () => setCos({ style: s.id }), <i className={`arm-style ${s.kind} st-${s.id}`} style={{ ['--c' as string]: cssColor(settings.playerColor) }} title={s.blurb} />)
              )}
            </div>
          </>
        )}
        {tab === 'nametag' && (
          <div className="arm-grid">
            {NAMETAGS.filter(listed).map((n) => tile(n, cos.nametag === n.id, () => setCos({ nametag: n.id }), <span className={`nt-chip nt-${n.id}`}>Aa</span>))}
          </div>
        )}
        {tab === 'tracer' && (
          <div className="arm-grid">
            {TRACERS.filter(listed).map((t) =>
              tile(t, cos.tracer === t.id, () => setCos({ tracer: t.id }), <i className="arm-tracer" style={{ background: t.color === 'rainbow' ? 'linear-gradient(90deg,#ff3b3b,#ffb03b,#3bff6b,#3bb9ff,#a03bff)' : cssColor(t.color) }} />)
            )}
          </div>
        )}
        {tab === 'flash' && (
          <div className="arm-grid">
            {FLASHES.filter(listed).map((f) =>
              tile(f, cos.flash === f.id, () => setCos({ flash: f.id }), <i className="arm-flash" style={{ background: `radial-gradient(circle, #fff 0, ${cssColor(f.color)} 35%, transparent 70%)`, transform: `scale(${0.7 + f.scale * 0.3})` }} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
};
