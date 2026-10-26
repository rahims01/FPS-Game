import { useState } from 'react';
import type { LoadedAssets } from '../assets/AssetRegistry';
import { SKINS, type SkinId } from '../assets/skins';
import type { GameSettings } from '../game/settings';
import type { Profile } from '../game/progression';
import { masteryOf, MASTERY, RARITY } from '../game/cosmetics';
import { KILLSTREAKS, normalizeStreaks, STREAK_SLOTS, type StreakId } from '../sim/killstreaks';
import { LETHALS, PERK_SLOTS, PERKS, TACTICALS, THROWABLES, normalizePerks, type PerkId, type ThrowableId } from '../sim/gear';
import { PRIMARIES, SECONDARIES, WEAPONS, type WeaponDef, type WeaponId } from '../sim/weapons';
import { GunPreview } from './GunPreview';

const BLURB: Record<string, string> = {
  rifle: 'Accurate all-rounder',
  ak: 'Hits harder, kicks harder',
  burst: '3-round bursts, deadly at range',
  smg: 'Fast and mobile up close',
  shotgun: 'One pump at close range',
  dmr: 'Semi-auto, two-shot headshots',
  sniper: 'One shot, one kill',
  lmg: '75 rounds of suppression',
  pistol: 'Quick backup',
  revolver: 'Six heavy rounds',
  scar: 'Hard-hitting battle rifle',
  uzi: 'Fastest fire rate up close',
  autoshotgun: 'Auto shotgun, room clearer',
  barrett: 'Semi-auto .50 cal, one-shot body',
  deagle: 'Hand cannon',
  mpistol: 'Full-auto sidearm'
};

/** Weapon stats, each 0..1 for the comparison bars, plus a few raw numbers. */
const statsOf = (w: WeaponDef) => {
  const perShot = w.damage.torso * w.pellets;
  const rpm = w.burst ? (60 / (w.interval + (w.burst - 1) * (w.burstGap ?? 0.07))) * w.burst : 60 / w.interval;
  const shots = Math.ceil(100 / Math.max(1, perShot));
  const ttk = (shots - 1) * (w.burst ? 60 / rpm : w.interval);
  return {
    bars: [
      ['Damage', Math.min(1, perShot / 110)],
      ['Fire rate', Math.min(1, rpm / 1100)],
      ['Range', Math.min(1, w.falloffEnd / 90)],
      ['Accuracy', Math.max(0.05, 1 - (w.spreadMoving * 0.5 + w.spreadStill * w.adsSpread * 6) / 0.06)],
      ['Control', Math.max(0.05, 1 - w.recoil / 0.1)],
      ['Mobility', Math.min(1, Math.max(0.05, (w.move - 0.8) / 0.32))]
    ] as [string, number][],
    rpm: Math.round(rpm),
    ttk: Math.round(ttk * 1000),
    shots
  };
};

type Tab = 'weapons' | 'equipment' | 'perks' | 'streaks';

/** Guns (with stats and a 3D preview), camos, throwables, perks and killstreaks. Camos unlock with kills using that gun. */
export const LoadoutPanel = ({ settings, onChange, profile, assets }: { settings: GameSettings; onChange: (s: GameSettings) => void; profile: Profile; assets: LoadedAssets | null }) => {
  const [tab, setTab] = useState<Tab>('weapons');
  const [focus, setFocus] = useState<WeaponId>(settings.primary);
  const set = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });
  const kills = (w: WeaponId) => profile.weaponKills[w] ?? 0;
  const picked = settings.streaks;
  const fw = WEAPONS[focus];
  const st = statsOf(fw);
  const cmp = statsOf(WEAPONS[fw.slot === 'secondary' ? settings.secondary : settings.primary]);
  const mastery = masteryOf(kills(focus));

  const toggleStreak = (id: StreakId) => {
    let next = picked.includes(id) ? picked.filter((s) => s !== id) : [...picked, id];
    if (next.length > STREAK_SLOTS) next = next.slice(next.length - STREAK_SLOTS);
    set({ streaks: next.length === STREAK_SLOTS ? normalizeStreaks(next) : next });
  };
  const togglePerk = (id: PerkId) => {
    let next = settings.perks.includes(id) ? settings.perks.filter((p) => p !== id) : [...settings.perks, id];
    if (next.length > PERK_SLOTS) next = next.slice(next.length - PERK_SLOTS);
    set({ perks: next.length === PERK_SLOTS ? normalizePerks(next) : next });
  };

  const gun = (w: WeaponId, slot: 'primary' | 'secondary') => {
    const on = settings[slot] === w;
    const skin = SKINS.find((s) => s.id === (settings.skins[w] ?? 'none'))!;
    const m = masteryOf(kills(w));
    return (
      <button
        key={w}
        className={`gun-card ${on ? 'on' : ''} ${focus === w ? 'focus' : ''}`}
        onClick={() => {
          set({ [slot]: w } as Partial<GameSettings>);
          setFocus(w);
        }}
      >
        <i className="gun-swatch" style={{ background: skin.swatch }} />
        <b>
          {WEAPONS[w].name}
          {m.tier >= 0 && <em className="mastery-dot" style={{ background: m.color }} title={`${m.name} mastery`} />}
        </b>
        <small>{BLURB[w]}</small>
        <small className="gun-kills">{kills(w)} kills</small>
      </button>
    );
  };

  const throwable = (id: ThrowableId) => {
    const d = THROWABLES[id];
    const on = settings[d.slot] === id;
    return (
      <button key={id} className={`streak-card ${on ? 'on' : ''}`} onClick={() => set({ [d.slot]: id } as Partial<GameSettings>)}>
        <b>
          {d.name} <em>×{d.count}</em>
        </b>
        <small>{d.blurb}</small>
      </button>
    );
  };

  return (
    <div className="loadout-panel">
      <div className="set-tabs">
        {(
          [
            ['weapons', 'Weapons & camos'],
            ['equipment', 'Equipment'],
            ['perks', `Perks ${settings.perks.length}/${PERK_SLOTS}`],
            ['streaks', `Killstreaks ${picked.length}/${STREAK_SLOTS}`]
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} className={`set-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'weapons' && (
        <>
          <div className="gun-showcase">
            <GunPreview assets={assets} weapon={focus} skin={(settings.skins[focus] ?? 'none') as SkinId} charm={settings.cosmetics.charm} />
            <div className="gun-stats">
              <h3>
                {fw.name}
                <small>
                  {' '}
                  · {fw.slot} · {fw.magazine} rounds · {st.rpm} rpm{fw.burst ? ` (${fw.burst}-round burst)` : ''}
                </small>
              </h3>
              {st.bars.map(([label, v], i) => {
                const other = cmp.bars[i][1];
                return (
                  <div key={label} className="stat-row">
                    <span>{label}</span>
                    <div className="stat-bar">
                      <i style={{ width: `${v * 100}%` }} />
                      {focus !== settings[fw.slot === 'secondary' ? 'secondary' : 'primary'] && <b style={{ left: `${other * 100}%` }} title="Your equipped gun" />}
                    </div>
                  </div>
                );
              })}
              <p className="set-hint">
                Body-shot kill: {st.shots} {st.shots === 1 ? 'hit' : 'hits'} ({st.ttk} ms) · headshot {fw.damage.head} damage · mastery {mastery.name}
                {mastery.next !== null ? ` (${kills(focus)}/${mastery.next} kills to ${MASTERY[mastery.tier + 1].name})` : ''}
              </p>
            </div>
          </div>
          <h3>Primary</h3>
          <div className="gun-grid">{PRIMARIES.map((w) => gun(w, 'primary'))}</div>
          <h3>Secondary</h3>
          <div className="gun-grid">{SECONDARIES.map((w) => gun(w, 'secondary'))}</div>
          <h3>
            Camo · {fw.name} <small>({kills(focus)} kills)</small>
          </h3>
          <div className="skin-grid">
            {SKINS.map((s) => {
              const locked = kills(focus) < s.kills;
              const on = (settings.skins[focus] ?? 'none') === s.id;
              return (
                <button
                  key={s.id}
                  className={`skin ${on ? 'on' : ''} ${locked ? 'locked' : ''}`}
                  style={{ borderColor: on ? undefined : RARITY[s.kind === 'mastery' || s.kills >= 400 ? 'mythic' : s.kind || s.kills >= 150 ? 'legendary' : s.kills >= 60 ? 'epic' : s.kills >= 15 ? 'rare' : 'common'].color }}
                  disabled={locked}
                  title={locked ? `${s.kills} kills with the ${fw.name} to unlock` : s.name}
                  onClick={() => set({ skins: { ...settings.skins, [focus]: s.id } })}
                >
                  <i style={{ background: s.swatch }} className={s.kind ? `camo-${s.kind}` : ''} />
                  <span>{s.name}</span>
                  {s.kind && <small className={`camo-kind ${s.kind}`}>{s.kind === 'mastery' ? (s.kills >= 500 ? 'Diamond mastery' : 'Gold mastery') : s.kind}</small>}
                  {locked && <small>🔒 {s.kills}</small>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {tab === 'equipment' && (
        <>
          <h3>Lethal</h3>
          <div className="streak-grid">{LETHALS.map(throwable)}</div>
          <h3>Tactical</h3>
          <div className="streak-grid">{TACTICALS.map(throwable)}</div>
          <p className="set-hint">Lethal: G (RB on a controller). Tactical: H (LB). Throwing knives and spears stick in whoever they hit.</p>
        </>
      )}

      {tab === 'perks' && (
        <>
          <div className="streak-grid">
            {PERKS.map((p) => (
              <button key={p.id} className={`streak-card ${settings.perks.includes(p.id) ? 'on' : ''}`} onClick={() => togglePerk(p.id)}>
                <b>{p.name}</b>
                <small>{p.blurb}</small>
              </button>
            ))}
          </div>
          {settings.perks.length !== PERK_SLOTS && <p className="set-hint">Pick {PERK_SLOTS} perks (the defaults are used until you do).</p>}
        </>
      )}

      {tab === 'streaks' && (
        <>
          <div className="streak-grid">
            {KILLSTREAKS.map((k) => (
              <button key={k.id} className={`streak-card ${picked.includes(k.id) ? 'on' : ''}`} onClick={() => toggleStreak(k.id)}>
                <b>
                  {k.name} <em>{k.kills}</em>
                </b>
                <small>{k.blurb}</small>
              </button>
            ))}
          </div>
          {picked.length !== STREAK_SLOTS && <p className="set-hint">Pick {STREAK_SLOTS} killstreaks (the defaults are used until you do).</p>}
        </>
      )}
    </div>
  );
};
