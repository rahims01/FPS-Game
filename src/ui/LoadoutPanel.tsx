import { useState } from 'react';
import type { LoadedAssets } from '../assets/AssetRegistry';
import { SKINS, type SkinId } from '../assets/skins';
import { keyLabel, type GameSettings } from '../game/settings';
import { levelOf, type Profile } from '../game/progression';
import { CHARMS, masteryOf, MASTERY, RARITY, rarityOf, unlocked, unlockText, type Cosmetics } from '../game/cosmetics';
import { KILLSTREAKS, normalizeStreaks, STREAK_SLOTS, type StreakId } from '../sim/killstreaks';
import { LETHALS, PERK_SLOTS, PERKS, TACTICALS, THROWABLES, normalizePerks, type PerkId, type ThrowableId } from '../sim/gear';
import { PRIMARIES, SECONDARIES, WEAPONS, type WeaponDef, type WeaponId } from '../sim/weapons';
import { GunPreview } from './GunPreview';
import { camoKey, MELEES, meleeDef } from '../assets/melees';
import { LockIcon } from './icons';

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
  mpistol: 'Full-auto sidearm',
  knife: 'Always carried · one stab kills'
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
  const melee = fw.slot === 'melee';
  const meleeOn = meleeDef(settings.cosmetics.melee);
  const st = statsOf(fw);
  const cmp = statsOf(WEAPONS[fw.slot === 'secondary' ? settings.secondary : settings.primary]);
  // In the knife slot, camos and kills belong to the chosen melee.
  const slotKey = camoKey(focus, settings.cosmetics.melee);
  const focusKills = profile.weaponKills[slotKey] ?? 0;
  const focusName = melee ? meleeOn.name : fw.name;
  const mastery = masteryOf(focusKills);
  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const level = levelOf(profile.xp).level;
  const cos = settings.cosmetics;
  const setCos = (patch: Partial<Cosmetics>) => set({ cosmetics: { ...cos, ...patch } });

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

  const gun = (w: WeaponId, slot: 'primary' | 'secondary' | 'melee') => {
    const on = slot === 'melee' || settings[slot] === w;
    const skin = SKINS.find((s) => s.id === (settings.skins[w] ?? 'none'))!;
    const m = masteryOf(kills(w));
    return (
      <button
        key={w}
        className={`gun-card ${on ? 'on' : ''} ${focus === w ? 'focus' : ''}`}
        onClick={() => {
          if (slot !== 'melee') set({ [slot]: w } as Partial<GameSettings>);
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
            <GunPreview assets={assets} weapon={focus} skin={(settings.skins[slotKey] ?? 'none') as SkinId} charm={settings.cosmetics.charm} melee={meleeOn.id} />
            <div className="gun-stats">
              <h3>
                {melee ? meleeOn.name : fw.name}
                <small>
                  {' '}
                  · {melee ? `melee · always carried · ${keyLabel(settings.keys.melee)} to use` : `${fw.slot} · ${fw.magazine} rounds · ${st.rpm} rpm${fw.burst ? ` (${fw.burst}-round burst)` : ''}`}
                </small>
              </h3>
              {!melee && st.bars.map(([label, v], i) => {
                const other = cmp.bars[i][1];
                return (
                  <div key={label} className="stat-row">
                    <span>{label}</span>
                    <div className="stat-bar">
                      <i style={{ width: `${v * 100}%` }} />
                      {!melee && focus !== settings[fw.slot === 'secondary' ? 'secondary' : 'primary'] && <b style={{ left: `${other * 100}%` }} title="Your equipped gun" />}
                    </div>
                  </div>
                );
              })}
              <p className="set-hint">
                {melee ? `One stab kills at up to ${fw.range} m, and you move ${Math.round((fw.move - 1) * 100)}% faster with it out` : `Body-shot kill: ${st.shots} ${st.shots === 1 ? 'hit' : 'hits'} (${st.ttk} ms) · headshot ${fw.damage.head} damage`} · mastery {mastery.name}
                {mastery.next !== null ? ` (${focusKills}/${mastery.next} kills to ${MASTERY[mastery.tier + 1].name})` : ''}
              </p>
              <div className="showcase-jumps">
                <button className="chip" onClick={() => jumpTo('camo-picker')}>
                  Change camo · {SKINS.filter((sk) => focusKills >= sk.kills).length}/{SKINS.length} unlocked
                </button>
                <button className="chip" onClick={() => jumpTo('charm-picker')}>
                  Charm
                </button>
              </div>
            </div>
          </div>
          <h3>Primary</h3>
          <div className="gun-grid">{PRIMARIES.map((w) => gun(w, 'primary'))}</div>
          <h3>Secondary</h3>
          <div className="gun-grid">{SECONDARIES.map((w) => gun(w, 'secondary'))}</div>
          <h3>Melee</h3>
          <p className="set-hint">Every melee fights like the Combat Knife (same reach, speed and one-stab kill); pick the one you like the look of. Each has its own camos, unlocked by kills with it.</p>
          <div className="streak-grid melee-grid">
            {MELEES.map((d) => {
              const ok = unlocked(d.unlock, profile, level, d.id);
              const on = meleeOn.id === d.id;
              return (
                <button
                  key={d.id}
                  className={`streak-card ${on ? 'on' : ''} ${ok ? '' : 'locked'}`}
                  disabled={!ok}
                  title={ok ? d.name : unlockText(d.unlock)}
                  onClick={() => {
                    setFocus('knife');
                    setCos({ melee: d.id });
                  }}
                >
                  <b>{d.name}</b>
                  <small>{ok ? d.blurb : <><LockIcon size={11} /> {unlockText(d.unlock)}</>}</small>
                  {ok && <small className="gun-kills">{profile.weaponKills[d.id] ?? 0} kills</small>}
                </button>
              );
            })}
          </div>
          <h3 id="camo-picker">
            Camo · {focusName} <small>({focusKills} kills; click a gun or melee above to see its camos)</small>
          </h3>
          <div className="skin-grid">
            {SKINS.map((s) => {
              const locked = focusKills < s.kills;
              const on = (settings.skins[slotKey] ?? 'none') === s.id;
              return (
                <button
                  key={s.id}
                  className={`skin ${on ? 'on' : ''} ${locked ? 'locked' : ''}`}
                  style={{ borderColor: on ? undefined : RARITY[s.kind === 'mastery' || s.kills >= 400 ? 'mythic' : s.kind || s.kills >= 150 ? 'legendary' : s.kills >= 60 ? 'epic' : s.kills >= 15 ? 'rare' : 'common'].color }}
                  disabled={locked}
                  title={locked ? `${s.kills} kills with the ${focusName} to unlock` : s.name}
                  onClick={() => set({ skins: { ...settings.skins, [slotKey]: s.id } })}
                >
                  <i style={{ background: s.swatch }} className={s.kind ? `camo-${s.kind}` : ''} />
                  <span>{s.name}</span>
                  {s.kind && <small className={`camo-kind ${s.kind}`}>{s.kind === 'mastery' ? (s.kills >= 500 ? 'Diamond mastery' : 'Gold mastery') : s.kind}</small>}
                  {locked && <small><LockIcon size={11} /> {s.kills}</small>}
                </button>
              );
            })}
          </div>
          <h3 id="charm-picker">
            Charm <small>(hangs off every gun)</small>
          </h3>
          <div className="skin-grid">
            {CHARMS.map((c) => {
              const ok = unlocked(c.unlock, profile, level, c.id);
              const hidden = c.secret && !ok;
              return (
                <button
                  key={c.id}
                  className={`skin ${cos.charm === c.id ? 'on' : ''} ${ok ? '' : 'locked'}`}
                  disabled={!ok}
                  style={{ borderColor: RARITY[rarityOf(c)].color }}
                  title={ok ? c.name : hidden ? 'Secret' : unlockText(c.unlock)}
                  onClick={() => setCos({ charm: c.id })}
                >
                  <i style={{ background: c.shape === 'none' ? 'transparent' : `#${c.color.toString(16).padStart(6, '0')}`, borderRadius: c.shape === 'ball' || c.shape === 'heart' || c.shape === 'duck' ? '50%' : 6 }} />
                  <span>{hidden ? '???' : c.name}</span>
                  {!ok && <small><LockIcon size={11} /> {hidden ? 'Secret' : unlockText(c.unlock)}</small>}
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
          <p className="set-hint">
            Lethal: {keyLabel(settings.keys.grenade)} (RB on a controller). Tactical: {keyLabel(settings.keys.tactical)} (LB). Throwing knives and spears stick in whoever they hit.
          </p>
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
