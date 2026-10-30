import type { HudState, ScoreRow } from '../game/Game';
import { isDark } from '../game/identity';
import type { Division } from '../game/progression';
import { BADGES } from '../game/cosmetics';
import { CallingCard } from './ProfilePanel';
import { inkOn } from './ink';

const acc = (r: ScoreRow) => (r.accuracy < 0 ? '–' : `${r.accuracy}%`);
const kd = (r: ScoreRow) => (r.deaths ? (r.kills / r.deaths).toFixed(2) : r.kills.toFixed(2));

const Table = ({ rows, mvp, title, color, onPick }: { rows: ScoreRow[]; mvp: number; title?: string; color?: string; onPick?: (id: number) => void }) => (
  <div className="end-table">
    {title && (
      <div className="end-team" style={color ? { background: color, color: inkOn(color) } : undefined}>
        {title}
      </div>
    )}
    <div className="end-row head">
      <span>Player</span>
      <span>K</span>
      <span>D</span>
      <span>K/D</span>
      <span>Dmg</span>
      <span>Acc</span>
      <span>HS</span>
      <span>Best</span>
    </div>
    {rows.map((p) => (
      <div
        key={p.id}
        className={`end-row ${p.isPlayer ? 'mine' : ''} ${onPick ? 'pick' : ''}`}
        {...(onPick ? { role: 'button', tabIndex: 0, title: `See ${p.name}'s card`, onClick: () => onPick(p.id), onKeyDown: (e: { key: string }) => e.key === 'Enter' && onPick(p.id) } : {})}
      >
        <span className={`name ${isDark(p.color) ? 'dark' : ''}`} style={{ color: p.color }}>
          <i className="lvl">{p.level}</i>
          {p.emblem && (
            <em className="emblem" style={{ color: p.emblem.color }}>
              {p.emblem.glyph}
            </em>
          )}
          {p.id === mvp && <em className="mvp-tag">MVP</em>}
          {p.name}
          {p.bot && <small className="bot-tag">BOT</small>}
        </span>
        <span>{p.kills}</span>
        <span>{p.deaths}</span>
        <span>{kd(p)}</span>
        <span>{p.damage}</span>
        <span>{acc(p)}</span>
        <span>{p.headshots}</span>
        <span>{p.bestStreak}</span>
      </div>
    ))}
  </div>
);

/** After the match: result, your numbers, MVP and the full scoreboard. */
export const EndScreen = ({
  hud,
  ranked,
  onAgain,
  againLabel,
  onLobby,
  waitingForHost,
  onMenu,
  mine,
  onPick
}: {
  hud: HudState;
  ranked: { delta: number; division: Division; sr: number } | null;
  onAgain: (() => void) | null;
  againLabel?: string;
  /** Online host: take everyone back to the room. */
  onLobby: (() => void) | null;
  /** Online guest: the host decides what happens next. */
  waitingForHost: boolean;
  onMenu: () => void;
  mine: { card: string; emblem: string; name: string; level: number; title: string; frame: string; prestige: number };
  /** Opens someone's player card. */
  onPick?: (id: number) => void;
}) => {
  const badges = hud.newBadges.map((id) => BADGES.find((b) => b.id === id)).filter((b): b is (typeof BADGES)[number] => !!b);
  const me = hud.players.find((p) => p.isPlayer);
  const mvp = hud.players.find((p) => p.id === hud.mvp);
  const title = hud.spectator ? 'Match over' : hud.banner || (hud.result === 'win' ? 'Victory' : 'Defeat');
  return (
    <div className="overlay end">
      <div className="menu-card end-card">
        <header className={`end-result ${hud.spectator ? '' : hud.result === 'win' ? 'win' : 'lose'}`}>
          <h2>{title}</h2>
          <div className="end-sub">
            <span>Final · {hud.modeName}</span>
            {hud.showTeams && (
              <b className="end-score">
                <span style={hud.teamColors ? { background: hud.teamColors[0], color: inkOn(hud.teamColors[0]) } : undefined}>{Math.floor(hud.scores[0])}</span>
                <span style={hud.teamColors ? { background: hud.teamColors[1], color: inkOn(hud.teamColors[1]) } : undefined}>{Math.floor(hud.scores[1])}</span>
              </b>
            )}
            {!hud.spectator && <b className="xp-earned">+{hud.xp.toLocaleString()} XP</b>}
          </div>
        </header>
        {ranked && (
          <div className="end-ranked" style={{ borderColor: ranked.division.color }}>
            <b style={{ color: ranked.division.color }}>{ranked.division.name}</b>
            <span className={ranked.delta >= 0 ? 'up' : 'down'}>
              {ranked.delta >= 0 ? '+' : ''}
              {ranked.delta} SR
            </span>
            <small>{ranked.sr} SR</small>
          </div>
        )}
        <div className="end-cards">
          {me && (
            <div className="end-stat-card">
              <small>Your match</small>
              <div className="end-stats">
                <span>
                  <b>{me.kills}</b> kills
                </span>
                <span>
                  <b>{me.deaths}</b> deaths
                </span>
                <span>
                  <b>{me.damage}</b> damage
                </span>
                <span>
                  <b>{acc(me)}</b> accuracy
                </span>
                <span>
                  <b>{me.headshots}</b> headshots
                </span>
                <span>
                  <b>{me.bestStreak}</b> best streak
                </span>
              </div>
            </div>
          )}
          {mvp && (
            <div className="end-stat-card mvp">
              <small>MVP</small>
              <CallingCard card={mvp.isPlayer ? mine.card : mvp.card} emblem={mvp.isPlayer ? mine.emblem : mvp.emblemId} title={mvp.isPlayer ? mine.title : mvp.title} frame={mvp.isPlayer ? mine.frame : mvp.frame} prestige={mvp.isPlayer ? mine.prestige : mvp.prestige} name={mvp.name} level={mvp.level} sub={`${mvp.kills} kills · ${mvp.damage} damage · ${acc(mvp)} accuracy`} />
            </div>
          )}
        </div>
        {badges.length > 0 && (
          <div className="end-badges">
            <small>New badges</small>
            {badges.map((b) => (
              <span key={b.id} className="end-badge" title={b.blurb}>
                {b.icon} {b.name}
              </span>
            ))}
          </div>
        )}
        <div className="end-board">
          {hud.showTeams ? (
            <>
              <Table rows={hud.players.filter((p) => p.ally)} mvp={hud.mvp} title={hud.spectator ? 'Team 1' : 'Your team'} color={hud.teamColors?.[0]} onPick={onPick} />
              <Table rows={hud.players.filter((p) => !p.ally)} mvp={hud.mvp} title={hud.spectator ? 'Team 2' : 'Enemy team'} color={hud.teamColors?.[1]} onPick={onPick} />
            </>
          ) : (
            <Table rows={hud.players} mvp={hud.mvp} onPick={onPick} />
          )}
        </div>
        <div className="row">
          {onAgain && (
            <button className="play" onClick={onAgain}>
              {againLabel ?? (ranked ? 'NEXT RANKED MATCH' : 'PLAY AGAIN')}
            </button>
          )}
          {onLobby && (
            <button className="play" onClick={onLobby}>
              BACK TO LOBBY
            </button>
          )}
          {waitingForHost && <span className="policy-note">Waiting for the host to start the next one…</span>}
          <button className="chip" onClick={onMenu}>
            Main menu
          </button>
        </div>
      </div>
    </div>
  );
};
