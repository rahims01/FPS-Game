import { useState } from 'react';
import { SKINS, type SkinId } from '../assets/skins';
import type { GameSettings } from '../game/settings';
import type { Profile } from '../game/progression';
import { KILLSTREAKS, normalizeStreaks, STREAK_SLOTS, type StreakId } from '../sim/killstreaks';
import { PRIMARIES, SECONDARIES, WEAPONS, type WeaponId } from '../sim/weapons';

const STATS: Record<string, string> = {
  rifle: 'Accurate all-rounder',
  ak: 'Hits harder, kicks harder',
  burst: '3-round bursts, deadly at range',
  smg: 'Fast and mobile up close',
  shotgun: 'One pump at close range',
  dmr: 'Semi-auto, two-shot headshots',
  sniper: 'One shot, one kill',
  lmg: '75 rounds of suppression',
  pistol: 'Quick backup',
  revolver: 'Six heavy rounds'
};

/** Guns, camos and killstreaks. Camos unlock with kills using that gun. */
export const LoadoutPanel = ({ settings, onChange, profile }: { settings: GameSettings; onChange: (s: GameSettings) => void; profile: Profile }) => {
  const [skinFor, setSkinFor] = useState<WeaponId>(settings.primary);
  const set = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });
  const kills = (w: WeaponId) => profile.weaponKills[w] ?? 0;
  const picked = settings.streaks;

  const toggleStreak = (id: StreakId) => {
    let next = picked.includes(id) ? picked.filter((s) => s !== id) : [...picked, id];
    // Picking a fourth swaps out the oldest pick.
    if (next.length > STREAK_SLOTS) next = next.slice(next.length - STREAK_SLOTS);
    // Only save complete picks; a partial pick stays on screen until it is complete.
    set({ streaks: next.length === STREAK_SLOTS ? normalizeStreaks(next) : next });
  };

  const gun = (w: WeaponId, slot: 'primary' | 'secondary') => {
    const on = settings[slot] === w;
    const skin = SKINS.find((s) => s.id === (settings.skins[w] ?? 'none'))!;
    return (
      <button
        key={w}
        className={`gun-card ${on ? 'on' : ''}`}
        onClick={() => {
          set({ [slot]: w } as Partial<GameSettings>);
          setSkinFor(w);
        }}
      >
        <i className="gun-swatch" style={{ background: skin.swatch }} />
        <b>{WEAPONS[w].name}</b>
        <small>{STATS[w]}</small>
        <small className="gun-kills">{kills(w)} kills</small>
      </button>
    );
  };

  return (
    <div className="loadout-panel">
      <h3>Primary</h3>
      <div className="gun-grid">{PRIMARIES.map((w) => gun(w, 'primary'))}</div>
      <h3>Secondary</h3>
      <div className="gun-grid">{SECONDARIES.map((w) => gun(w, 'secondary'))}</div>

      <h3>
        Camo · {WEAPONS[skinFor].name} <small>({kills(skinFor)} kills)</small>
      </h3>
      <div className="skin-tabs">
        {[...PRIMARIES, ...SECONDARIES].map((w) => (
          <button key={w} className={`chip ${skinFor === w ? 'on' : ''}`} onClick={() => setSkinFor(w)}>
            {WEAPONS[w].tag}
          </button>
        ))}
      </div>
      <div className="skin-grid">
        {SKINS.map((s) => {
          const locked = kills(skinFor) < s.kills;
          const on = (settings.skins[skinFor] ?? 'none') === s.id;
          return (
            <button
              key={s.id}
              className={`skin ${on ? 'on' : ''} ${locked ? 'locked' : ''}`}
              disabled={locked}
              title={locked ? `${s.kills} kills with the ${WEAPONS[skinFor].name} to unlock` : s.name}
              onClick={() => set({ skins: { ...settings.skins, [skinFor]: s.id as SkinId } })}
            >
              <i style={{ background: s.swatch }} />
              <span>{s.name}</span>
              {locked && <small>🔒 {s.kills}</small>}
            </button>
          );
        })}
      </div>

      <h3>
        Killstreaks <small>pick {STREAK_SLOTS} · {picked.length}/{STREAK_SLOTS}</small>
      </h3>
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
    </div>
  );
};
