import { useState } from 'react';
import { BADGES, CARDS, CHARMS, EMBLEMS, MASTERY, earned, masteryOf, unlockText, unlocked, type Cosmetics } from '../game/cosmetics';
import type { GameSettings } from '../game/settings';
import { divisionOf, levelOf, rankOf, type Profile } from '../game/progression';
import { PRIMARIES, SECONDARIES, WEAPONS } from '../sim/weapons';

/** The banner shown when you kill someone (and on the end screen if you are MVP). */
export const CallingCard = ({ card, emblem, name, level, sub }: { card: string; emblem: string; name: string; level?: number; sub?: string }) => {
  const c = CARDS.find((x) => x.id === card) ?? CARDS[0];
  const e = EMBLEMS.find((x) => x.id === emblem) ?? EMBLEMS[0];
  return (
    <div className="calling-card" style={{ background: c.bg, color: c.ink }}>
      <span className="cc-emblem" style={{ color: e.color }}>
        {e.glyph}
      </span>
      <span className="cc-text">
        <b>{name}</b>
        {sub && <small>{sub}</small>}
      </span>
      {level !== undefined && level > 0 && <span className="cc-level">{level}</span>}
    </div>
  );
};

type Tab = 'look' | 'badges' | 'mastery' | 'stats';

/** Your calling card, emblem and weapon charm, badges, weapon mastery and lifetime stats. */
export const ProfilePanel = ({ settings, onChange, profile }: { settings: GameSettings; onChange: (s: GameSettings) => void; profile: Profile }) => {
  const [tab, setTab] = useState<Tab>('look');
  const level = levelOf(profile.xp).level;
  const cos = settings.cosmetics;
  const setCos = (patch: Partial<Cosmetics>) => onChange({ ...settings, cosmetics: { ...cos, ...patch } });
  const earnedCount = BADGES.filter((b) => earned(b, profile, level)).length;
  const st = profile.stats;
  const div = divisionOf(profile);

  return (
    <div className="profile-panel">
      <CallingCard card={cos.card} emblem={cos.emblem} name={settings.playerName || 'You'} level={level} sub={`${rankOf(level)} · ${div.name}`} />
      <div className="set-tabs">
        {(
          [
            ['look', 'Card, emblem & charm'],
            ['badges', `Badges ${earnedCount}/${BADGES.length}`],
            ['mastery', 'Weapon mastery'],
            ['stats', 'Stats']
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} className={`set-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'look' && (
        <>
          <h3>Calling card</h3>
          <div className="card-grid">
            {CARDS.map((c) => {
              const ok = unlocked(c.unlock, profile, level);
              return (
                <button key={c.id} className={`card-pick ${cos.card === c.id ? 'on' : ''} ${ok ? '' : 'locked'}`} disabled={!ok} title={ok ? c.name : unlockText(c.unlock)} onClick={() => setCos({ card: c.id })} style={{ background: c.bg, color: c.ink }}>
                  <span>{c.name}</span>
                  {!ok && <small>🔒 {unlockText(c.unlock)}</small>}
                </button>
              );
            })}
          </div>
          <h3>Emblem</h3>
          <div className="emblem-grid">
            {EMBLEMS.map((e) => {
              const ok = unlocked(e.unlock, profile, level);
              return (
                <button key={e.id} className={`emblem-pick ${cos.emblem === e.id ? 'on' : ''} ${ok ? '' : 'locked'}`} disabled={!ok} title={ok ? e.id : unlockText(e.unlock)} onClick={() => setCos({ emblem: e.id })}>
                  <span style={{ color: e.color }}>{e.glyph}</span>
                  {!ok && <small>🔒</small>}
                </button>
              );
            })}
          </div>
          <h3>Weapon charm</h3>
          <div className="skin-grid">
            {CHARMS.map((c) => {
              const ok = unlocked(c.unlock, profile, level);
              return (
                <button key={c.id} className={`skin ${cos.charm === c.id ? 'on' : ''} ${ok ? '' : 'locked'}`} disabled={!ok} title={ok ? c.name : unlockText(c.unlock)} onClick={() => setCos({ charm: c.id })}>
                  <i style={{ background: c.shape === 'none' ? 'transparent' : `#${c.color.toString(16).padStart(6, '0')}`, borderRadius: c.shape === 'ball' || c.shape === 'heart' || c.shape === 'duck' ? '50%' : 6 }} />
                  <span>{c.name}</span>
                  {!ok && <small>🔒 {unlockText(c.unlock)}</small>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {tab === 'badges' && (
        <div className="badge-grid">
          {BADGES.map((b) => {
            const [have, need] = b.progress(profile, level);
            const done = have >= need;
            return (
              <div key={b.id} className={`badge ${done ? 'done' : ''}`}>
                <span className="badge-icon">{b.icon}</span>
                <b>{b.name}</b>
                <small>{b.blurb}</small>
                {!done && (
                  <div className="badge-bar">
                    <i style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
                  </div>
                )}
                {!done && need > 1 && (
                  <small className="badge-count">
                    {Math.min(have, need).toLocaleString()} / {need.toLocaleString()}
                  </small>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'mastery' && (
        <div className="mastery-list">
          <p className="set-hint">
            Kills with a gun earn its mastery badge: {MASTERY.map((m) => `${m.name} ${m.kills}`).join(' · ')}. Your best one shows next to your name on the scoreboard.
          </p>
          {[...PRIMARIES, ...SECONDARIES].map((w) => {
            const k = profile.weaponKills[w] ?? 0;
            const m = masteryOf(k);
            const next = m.next ?? MASTERY[MASTERY.length - 1].kills;
            const from = m.tier >= 0 ? MASTERY[m.tier].kills : 0;
            return (
              <div key={w} className="mastery-row">
                <span className="mastery-badge" style={{ background: m.color, opacity: m.tier >= 0 ? 1 : 0.25 }}>
                  {m.tier >= 0 ? '★'.repeat(m.tier + 1) : '–'}
                </span>
                <b>{WEAPONS[w].name}</b>
                <div className="badge-bar">
                  <i style={{ width: `${m.next === null ? 100 : ((k - from) / Math.max(1, next - from)) * 100}%`, background: m.next === null ? m.color : undefined }} />
                </div>
                <small>
                  {k} kills{m.next !== null ? ` · ${m.next - k} to ${MASTERY[m.tier + 1].name}` : ' · maxed'}
                </small>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'stats' && (
        <div className="stat-tiles">
          {(
            [
              ['Level', level],
              ['Matches', profile.matches],
              ['Wins', profile.wins],
              ['Win rate', profile.matches ? `${Math.round((profile.wins / profile.matches) * 100)}%` : '–'],
              ['Kills', profile.kills],
              ['Deaths', profile.deaths],
              ['K/D', profile.deaths ? (profile.kills / profile.deaths).toFixed(2) : profile.kills],
              ['Headshots', st.headshots ?? 0],
              ['Best streak', st.bestStreak ?? 0],
              ['Knife kills', st.knifeKills ?? 0],
              ['Throwing kills', st.throwKills ?? 0],
              ['Grenade kills', st.fragKills ?? 0],
              ['Longshots', st.longshots ?? 0],
              ['Nukes', st.nukes ?? 0],
              ['Flawless wins', st.flawlessWins ?? 0],
              ['Ranked', `${div.name}${div.placed ? ` · ${profile.sr} SR` : ''}`],
              ['Aim trainer best', st.aimBest ?? 0]
            ] as [string, string | number][]
          ).map(([k, v]) => (
            <div key={k} className="stat-tile">
              <small>{k}</small>
              <b>{v}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
