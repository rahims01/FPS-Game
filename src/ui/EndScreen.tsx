import type { HudState, ScoreRow } from '../game/Game';
import { isDark } from '../game/identity';
import type { Division } from '../game/progression';

const acc = (r: ScoreRow) => (r.accuracy < 0 ? '–' : `${r.accuracy}%`);
const kd = (r: ScoreRow) => (r.deaths ? (r.kills / r.deaths).toFixed(2) : r.kills.toFixed(2));

const Table = ({ rows, mvp, title, color }: { rows: ScoreRow[]; mvp: number; title?: string; color?: string }) => (
  <div className="end-table">
    {title && (
      <div className="end-team" style={{ borderColor: color, color }}>
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
      <div key={p.id} className={`end-row ${p.isPlayer ? 'mine' : ''}`}>
        <span className={`name ${isDark(p.color) ? 'dark' : ''}`} style={{ color: p.color }}>
          <i className="lvl">{p.level}</i>
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
  onMenu
}: {
  hud: HudState;
  ranked: { delta: number; division: Division; sr: number } | null;
  onAgain: (() => void) | null;
  onMenu: () => void;
}) => {
  const me = hud.players.find((p) => p.isPlayer);
  const mvp = hud.players.find((p) => p.id === hud.mvp);
  const title = hud.spectator ? 'Match over' : hud.banner || (hud.result === 'win' ? 'Victory' : 'Defeat');
  return (
    <div className="overlay end">
      <div className="menu-card end-card">
        <h2 className={hud.spectator ? '' : hud.result === 'win' ? 'win' : 'lose'}>{title}</h2>
        <p className="end-sub">
          {hud.modeName}
          {hud.showTeams && ` · ${Math.floor(hud.scores[0])}–${Math.floor(hud.scores[1])}`}
          {!hud.spectator && <b className="xp-earned"> · +{hud.xp} XP</b>}
        </p>
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
              <b className={`mvp-name ${isDark(mvp.color) ? 'dark' : ''}`} style={{ color: mvp.color }}>
                {mvp.name}
              </b>
              <span>
                {mvp.kills} kills · {mvp.damage} damage · {acc(mvp)} accuracy
              </span>
            </div>
          )}
        </div>
        <div className="end-board">
          {hud.showTeams ? (
            <>
              <Table rows={hud.players.filter((p) => p.ally)} mvp={hud.mvp} title={hud.spectator ? 'Team 1' : 'Your team'} color={hud.teamColors?.[0]} />
              <Table rows={hud.players.filter((p) => !p.ally)} mvp={hud.mvp} title={hud.spectator ? 'Team 2' : 'Enemy team'} color={hud.teamColors?.[1]} />
            </>
          ) : (
            <Table rows={hud.players} mvp={hud.mvp} />
          )}
        </div>
        <div className="row">
          {onAgain && (
            <button className="play" onClick={onAgain}>
              {ranked ? 'NEXT RANKED MATCH' : 'PLAY AGAIN'}
            </button>
          )}
          <button className="chip" onClick={onMenu}>
            Main menu
          </button>
        </div>
      </div>
    </div>
  );
};
