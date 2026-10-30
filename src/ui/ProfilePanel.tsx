import { useEffect, useState } from 'react';
import { MELEES } from '../assets/melees';
import { BADGES, CARDS, COLLECTIONS, EMBLEMS, FRAMES, MASTERY, RARITY, TITLES, claimCollections, earned, frameDef, masteryOf, rarityOf, titleDef, unlockText, unlocked, type BadgeGroup, type Cosmetics } from '../game/cosmetics';
import type { GameSettings } from '../game/settings';
import { canPrestige, divisionOf, levelLabel, levelOf, loadProfile, MAX_PRESTIGE, MEDALS, rankOf, saveProfile, type Profile } from '../game/progression';
import { MODES } from '../sim/Match';
import { PRIMARIES, SECONDARIES, WEAPONS } from '../sim/weapons';
import { LockIcon, StarIcon } from './icons';

/** The banner shown when you kill someone (and on the end screen if you are MVP). */
export const CallingCard = ({
  card,
  emblem,
  name,
  level,
  sub,
  title,
  frame,
  prestige
}: {
  card: string;
  emblem: string;
  name: string;
  level?: number;
  sub?: string;
  title?: string;
  frame?: string;
  prestige?: number;
}) => {
  const c = CARDS.find((x) => x.id === card) ?? CARDS[0];
  const e = EMBLEMS.find((x) => x.id === emblem) ?? EMBLEMS[0];
  return (
    <div className="calling-card" style={{ background: c.bg, color: c.ink }}>
      <span className="cc-emblem" style={{ color: e.color }}>
        {e.glyph}
      </span>
      <span className="cc-text">
        <b>{name}</b>
        {title && title !== 'none' && <em className="cc-title">{titleDef(title).text}</em>}
        {sub && <small>{sub}</small>}
      </span>
      {level !== undefined && level > 0 && <LevelBadge level={level} prestige={prestige ?? 0} frame={frame ?? 'none'} />}
    </div>
  );
};

/** Your level in its frame, with a prestige star. */
export const LevelBadge = ({ level, prestige, frame }: { level: number; prestige: number; frame: string }) => {
  const f = frameDef(frame);
  return (
    <span className={`lvl-badge fr-${f.id}`} style={{ borderColor: f.border, background: f.bg }}>
      {prestige > 0 && <i className="lvl-prestige">P{prestige}</i>}
      {level}
    </span>
  );
};

type Tab = 'look' | 'badges' | 'collections' | 'mastery' | 'stats';

const GROUPS: (BadgeGroup | 'All')[] = ['All', 'Combat', 'Weapons', 'Modes', 'Career', 'Social', 'Secret'];
const hours = (sec: number) => (sec < 3600 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`);

/** Your calling card, title, frame and emblem, badges, weapon mastery and lifetime stats. */
export const ProfilePanel = ({ settings, onChange, profile, onPrestige }: { settings: GameSettings; onChange: (s: GameSettings) => void; profile: Profile; onPrestige: () => void }) => {
  const [tab, setTab] = useState<Tab>('look');
  const [group, setGroup] = useState<BadgeGroup | 'All'>('All');
  const [, bump] = useState(0);
  const level = levelOf(profile.xp).level;
  const cos = settings.cosmetics;
  const setCos = (patch: Partial<Cosmetics>) => onChange({ ...settings, cosmetics: { ...cos, ...patch } });
  const earnedCount = BADGES.filter((b) => earned(b, profile, level)).length;
  const st = profile.stats;
  const div = divisionOf(profile);
  const duel = divisionOf(profile, 'duel');
  // Collections finished outside a match (a gift, a code) are claimed here.
  useEffect(() => {
    const p = loadProfile();
    if (claimCollections(p, levelOf(p.xp).level).length) saveProfile(p);
  }, [profile]);
  const showcase = loadProfile().showcase ?? [];
  const pin = (id: string) => {
    const p = loadProfile();
    const cur = p.showcase ?? [];
    p.showcase = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-3);
    saveProfile(p);
    bump((n) => n + 1);
  };
  const collectionsDone = COLLECTIONS.filter((c) => {
    const [have, need] = c.progress(profile, level);
    return have >= need;
  }).length;

  return (
    <div className="profile-panel">
      <CallingCard card={cos.card} emblem={cos.emblem} name={settings.playerName || 'You'} level={level} sub={`${rankOf(level)} · ${div.name}`} title={cos.title} frame={cos.frame} prestige={profile.prestige} />
      {canPrestige(profile) && (
        <div className="prestige-offer">
          <div>
            <b>Prestige {profile.prestige + 1} available</b>
            <small>
              Go back to level 1 with a prestige rank. You keep every unlock, gun, camo and stat, and get new prestige cards, emblems, frames, titles, colours and styles. ({MAX_PRESTIGE - profile.prestige} prestiges left)
            </small>
          </div>
          <button className="play" onClick={onPrestige}>
            PRESTIGE
          </button>
        </div>
      )}
      <div className="set-tabs">
        {(
          [
            ['look', 'Card, title & emblem'],
            ['badges', `Achievements ${earnedCount}/${BADGES.length}`],
            ['collections', `Collections ${collectionsDone}/${COLLECTIONS.length}`],
            ['mastery', 'Weapon mastery'],
            ['stats', 'Career']
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
              const ok = unlocked(c.unlock, profile, level, c.id);
              const hidden = c.secret && !ok;
              return (
                <button
                  key={c.id}
                  className={`card-pick ${cos.card === c.id ? 'on' : ''} ${ok ? '' : 'locked'}`}
                  disabled={!ok}
                  title={ok ? c.name : hidden ? 'Secret' : unlockText(c.unlock)}
                  onClick={() => setCos({ card: c.id })}
                  style={{ background: hidden ? '#111' : c.bg, color: c.ink, boxShadow: `inset 0 -3px 0 ${RARITY[rarityOf(c)].color}` }}
                >
                  <span>{hidden ? '???' : c.name}</span>
                  {!ok && <small><LockIcon size={11} /> {hidden ? 'Secret' : unlockText(c.unlock)}</small>}
                </button>
              );
            })}
          </div>
          <h3>Title</h3>
          <div className="title-grid">
            {TITLES.map((t) => {
              const ok = unlocked(t.unlock, profile, level, t.id);
              const hidden = t.secret && !ok;
              return (
                <button
                  key={t.id}
                  className={`title-pick ${cos.title === t.id ? 'on' : ''} ${ok ? '' : 'locked'}`}
                  disabled={!ok}
                  style={{ borderColor: RARITY[rarityOf(t)].color }}
                  title={ok ? '' : hidden ? 'Secret' : unlockText(t.unlock)}
                  onClick={() => setCos({ title: t.id })}
                >
                  <span>{hidden ? '???' : t.text}</span>
                  {!ok && <small><LockIcon size={11} /> {hidden ? 'Secret' : unlockText(t.unlock)}</small>}
                </button>
              );
            })}
          </div>
          <h3>Level frame</h3>
          <div className="title-grid">
            {FRAMES.map((f) => {
              const ok = unlocked(f.unlock, profile, level, f.id);
              return (
                <button
                  key={f.id}
                  className={`title-pick ${cos.frame === f.id ? 'on' : ''} ${ok ? '' : 'locked'}`}
                  disabled={!ok}
                  style={{ borderColor: RARITY[rarityOf(f)].color }}
                  title={ok ? f.name : unlockText(f.unlock)}
                  onClick={() => setCos({ frame: f.id })}
                >
                  <LevelBadge level={level} prestige={profile.prestige} frame={f.id} />
                  <span>{f.name}</span>
                  {!ok && <small><LockIcon size={11} /> {unlockText(f.unlock)}</small>}
                </button>
              );
            })}
          </div>
          <h3>Emblem</h3>
          <div className="emblem-grid">
            {EMBLEMS.map((e) => {
              const ok = unlocked(e.unlock, profile, level, e.id);
              const hidden = e.secret && !ok;
              return (
                <button
                  key={e.id}
                  className={`emblem-pick ${cos.emblem === e.id ? 'on' : ''} ${ok ? '' : 'locked'}`}
                  disabled={!ok}
                  style={{ borderColor: RARITY[rarityOf(e)].color }}
                  title={ok ? e.id : hidden ? 'Secret' : unlockText(e.unlock)}
                  onClick={() => setCos({ emblem: e.id })}
                >
                  <span style={{ color: e.color }}>{hidden ? '?' : e.glyph}</span>
                  {!ok && <small><LockIcon size={11} /></small>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {tab === 'badges' && (
        <>
          <div className="pc-reasons">
            {GROUPS.map((g) => (
              <button key={g} className={`chip ${group === g ? 'on' : ''}`} onClick={() => setGroup(g)}>
                {g}
              </button>
            ))}
          </div>
          <p className="set-hint">Pin up to 3 earned achievements to show them on your player card ({showcase.length}/3 pinned).</p>
        <div className="badge-grid">
          {BADGES.filter((b) => group === 'All' || (b.group ?? 'Combat') === group).map((b) => {
            const [have, need] = b.progress(profile, level);
            const done = have >= need;
            const hidden = b.secret && !done;
            const pinned = showcase.includes(b.id);
            return (
              <div key={b.id} className={`badge ${done ? 'done' : ''} ${hidden ? 'secret' : ''}`}>
                <span className="badge-icon">{hidden ? '?' : b.icon}</span>
                <b>{hidden ? 'Secret achievement' : b.name}</b>
                <small>{hidden ? 'Keep playing to find out.' : b.blurb}</small>
                {done && (
                  <button className={`chip badge-pin ${pinned ? 'on' : ''}`} onClick={() => pin(b.id)}>
                    {pinned ? 'Pinned' : 'Pin to card'}
                  </button>
                )}
                {!done && !hidden && (
                  <div className="badge-bar">
                    <i style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
                  </div>
                )}
                {!done && !hidden && need > 1 && (
                  <small className="badge-count">
                    {Math.min(have, need).toLocaleString()} / {need.toLocaleString()}
                  </small>
                )}
              </div>
            );
          })}
        </div>
        </>
      )}

      {tab === 'collections' && (
        <div className="badge-grid">
          {COLLECTIONS.map((c) => {
            const [have, need] = c.progress(profile, level);
            const done = have >= need;
            return (
              <div key={c.id} className={`badge collection ${done ? 'done' : ''}`}>
                <b>{c.name}</b>
                <small>{c.blurb}</small>
                <div className="badge-bar">
                  <i style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
                </div>
                <small className="badge-count">
                  {Math.min(have, need)} / {need} · Reward: title “{titleDef(c.reward).text}”{done ? ' (yours)' : ''}
                </small>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'mastery' && (
        <div className="mastery-list">
          <p className="set-hint">
            Kills with a weapon earn its mastery badge: {MASTERY.map((m) => `${m.name} ${m.kills}`).join(' · ')}. Your best one shows next to your name on the scoreboard.
          </p>
          {[...[...PRIMARIES, ...SECONDARIES].map((w) => [w, WEAPONS[w].name]), ...MELEES.map((d) => [d.id, d.name])].map(([w, name]) => {
            const k = profile.weaponKills[w] ?? 0;
            const m = masteryOf(k);
            const next = m.next ?? MASTERY[MASTERY.length - 1].kills;
            const from = m.tier >= 0 ? MASTERY[m.tier].kills : 0;
            return (
              <div key={w} className="mastery-row">
                <span className="mastery-badge" style={{ background: m.color, opacity: m.tier >= 0 ? 1 : 0.25 }}>
                  {m.tier >= 0 ? Array.from({ length: m.tier + 1 }, (_, i) => <StarIcon key={i} size={12} />) : '–'}
                </span>
                <b>{name}</b>
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
              ['Level', levelLabel(level, profile.prestige)],
              ['Tournaments won', profile.tourneyWins],
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
              ['Ranked team', `${div.name}${div.placed ? ` · ${profile.sr} SR` : ''}`],
              ['Ranked 1v1', `${duel.name}${duel.placed ? ` · ${profile.duelSr} SR` : ''}`],
              ['Aim trainer best', st.aimBest ?? 0],
              ['Time played', hours(st.seconds ?? 0)],
              ['Distance run', `${((st.meters ?? 0) / 1000).toFixed(1)} km`],
              ['Damage dealt', (st.damage ?? 0).toLocaleString()],
              ['Accuracy', st.shots ? `${Math.round(((st.hits ?? 0) / st.shots) * 100)}%` : '–'],
              ['Longest kill', `${st.longestKill ?? 0} m`],
              ['Most kills in a match', st.bestMatchKills ?? 0],
              ['Best Zombies wave', st.zombieWave ?? 0],
              ['Best Survival wave', st.survivalWave ?? 0]
            ] as [string, string | number][]
          ).map(([k, v]) => (
            <div key={k} className="stat-tile">
              <small>{k}</small>
              <b className={typeof v === 'string' && v.length > 8 ? 'wordy' : undefined}>{v}</b>
            </div>
          ))}
        </div>
      )}
      {tab === 'stats' && (
        <div className="career-more">
          <h3>By mode</h3>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Mode</th>
                <th>Played</th>
                <th>Won</th>
                <th>Win rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(profile.modes ?? {})
                .sort((a, b) => b[1].played - a[1].played)
                .map(([id, m]) => (
                  <tr key={id}>
                    <td>{MODES.find((d) => d.id === id)?.name ?? id}</td>
                    <td>{m.played}</td>
                    <td>{m.won}</td>
                    <td>{m.played ? `${Math.round((m.won / m.played) * 100)}%` : '–'}</td>
                  </tr>
                ))}
              {!Object.keys(profile.modes ?? {}).length && (
                <tr>
                  <td colSpan={4} className="set-hint">
                    Play a few matches to see your record in each mode.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <h3>Medals</h3>
          <div className="medal-tally">
            {Object.entries(profile.medals ?? {})
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <span key={k}>
                  {MEDALS[k as keyof typeof MEDALS]?.name ?? k} <b>×{n.toLocaleString()}</b>
                </span>
              ))}
            {!Object.keys(profile.medals ?? {}).length && <span className="set-hint">None yet.</span>}
          </div>
        </div>
      )}
    </div>
  );
};
