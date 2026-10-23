import type { RefObject } from 'react';
import type { HudState, ScoreRow } from '../game/Game';
import { isDark } from '../game/identity';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Modes where a kill leaderboard is shown on screen. */
const LEADERBOARD_MODES = new Set(['ffa', 'headshot', 'instagib', 'snipers', 'gungame', 'br']);

const Name = ({ row }: { row: Pick<ScoreRow, 'name' | 'color' | 'isPlayer'> }) => (
  <span className={`name ${row.isPlayer ? 'me' : ''} ${isDark(row.color) ? 'dark' : ''}`} style={{ color: row.color }}>
    {row.name}
  </span>
);

export const Hud = ({ hud, minimap }: { hud: HudState; minimap: RefObject<HTMLCanvasElement | null> }) => {
  const gap = 6 + hud.spread * 900;
  const markerAge = hud.time - hud.hitMarkerAt;
  const hpLow = hud.hp < 35;
  const [mine, theirs] = hud.teamColors ?? ['var(--blue)', 'var(--red)'];
  const leader = hud.players[0];
  const top = hud.players.slice(0, 5);
  const me = hud.players.find((p) => p.isPlayer);
  const myRank = hud.players.findIndex((p) => p.isPlayer) + 1;
  return (
    <div className="hud">
      {hud.scoped && (
        <div className="scope">
          <div className="scope-ring" />
          <i className="h" />
          <i className="v" />
        </div>
      )}
      {hud.alive && !hud.aiming && !hud.scoped && (
        <div className="crosshair" style={{ ['--gap' as string]: `${gap}px` }}>
          <i className="t" />
          <i className="b" />
          <i className="l" />
          <i className="r" />
        </div>
      )}
      {hud.alive && hud.aiming && !hud.scoped && <div className="dot" />}
      {markerAge < 0.25 && <div key={hud.hitMarkerAt} className={`hitmarker ${hud.hitMarkerKind}`} />}
      {hud.damage.map((d, i) => (
        <div key={`${d.at}-${i}`} className="dmg" style={{ transform: `translate(-50%, -50%) rotate(${-d.angle}rad)`, opacity: 1 - (hud.time - d.at) / 1.2 }}>
          <i />
        </div>
      ))}
      {hpLow && hud.alive && <div className="vignette" style={{ opacity: (35 - hud.hp) / 35 }} />}
      {hud.outsideZone && <div className="zone-tint" />}
      {hud.time - hud.pickupAt < 0.4 && <div className="heal-flash" />}

      <div className="top">
        <div className="mode-name">{hud.modeName}</div>
        {hud.showTeams && (
          <div className="score">
            <span style={{ color: mine }}>{Math.floor(hud.scores[0])}</span>
            <span className="alive">
              {hud.mode === 'infected'
                ? `${hud.scores[0]} survivors · ${fmt(hud.infectedSeconds ?? 0)}`
                : hud.targetScore && !['1v1', '2v2', '3v3'].includes(hud.mode)
                  ? `first to ${hud.targetScore}`
                  : `${hud.teamCounts[0]} v ${hud.teamCounts[1]}`}
            </span>
            <span style={{ color: theirs }}>{Math.floor(hud.scores[1])}</span>
          </div>
        )}
        {hud.flags.length > 0 && (
          <div className="flags">
            {hud.flags.map((f) => (
              <div
                key={f.label}
                className={`flag ${f.owner} ${f.onIt ? 'on' : ''}`}
                style={f.owner === 'none' ? undefined : { background: `${f.owner === 'us' ? mine : theirs}99`, borderColor: f.owner === 'us' ? mine : theirs }}
              >
                <span>{f.label}</span>
                {f.onIt && f.owner !== 'us' && <i style={{ width: `${Math.max(0, f.progress) * 100}%` }} />}
              </div>
            ))}
          </div>
        )}
        {hud.ctf && (
          <div className="ctf">
            <span className={`ctf-flag us ${hud.ctf.ours}`} style={{ borderColor: mine }}>Your flag: {hud.ctf.ours === 'home' ? 'safe' : hud.ctf.ours}</span>
            <span className={`ctf-flag them ${hud.ctf.theirs}`} style={{ borderColor: theirs }}>Enemy flag: {hud.ctf.theirs === 'home' ? 'at base' : hud.ctf.theirs}</span>
          </div>
        )}
        {hud.ctf?.carrying && <div className="carrying">You have the flag — return to base!</div>}
        {hud.gunTier && (
          <div className="gun-tier">
            {Array.from({ length: hud.gunTier.total }, (_, i) => (
              <i key={i} className={i < hud.gunTier!.index ? 'done' : i === hud.gunTier!.index ? 'now' : ''} />
            ))}
            <span>
              {hud.gunTier.weapon} · {hud.gunTier.kills}/{hud.gunTier.perTier} · next: {hud.gunTier.next}
            </span>
          </div>
        )}
        {hud.hill && (
          <div className={`hill-status ${hud.hill.holder}`}>
            {hud.hill.holder === 'us' && 'Your team holds the hill'}
            {hud.hill.holder === 'them' && 'Enemy holds the hill'}
            {hud.hill.holder === 'contested' && 'Hill contested'}
            {hud.hill.holder === 'none' && 'Hill is open'}
            {hud.hill.onHill && ' · you are on it'}
            <small> · moves in {fmt(hud.hill.seconds)}</small>
          </div>
        )}
        {hud.mode === 'survival' && (
          <div className="score">
            <span>Wave {hud.wave}</span>
            <span className="alive">{hud.enemiesLeft} left</span>
          </div>
        )}
        {(hud.mode === 'ffa' || hud.mode === 'headshot' || hud.mode === 'instagib' || hud.mode === 'snipers') && (
          <div className="score">
            <span>{hud.kills}</span>
            <span className="alive">first to {hud.targetScore}</span>
            <span className={leader && isDark(leader.color) ? 'dark' : ''} style={{ color: leader?.color }}>
              {leader?.kills ?? 0}
            </span>
          </div>
        )}
        {hud.mode === 'br' && (
          <div className="score">
            <span>{hud.aliveTotal} alive</span>
            {hud.zone && (
              <span className={`alive ${hud.zone.shrinking ? 'warn' : ''}`}>
                {hud.zone.shrinking ? 'Zone closing' : `Zone ${hud.zone.phase} in`} {fmt(hud.zone.seconds)}
              </span>
            )}
          </div>
        )}
      </div>

      {hud.banner && hud.phase !== 'over' && <div className="banner">{hud.banner}</div>}
      <div className="callouts">
        {hud.callouts.map((c) => (
          <div key={c.id} className="callout">
            {c.text}
          </div>
        ))}
      </div>
      <div className="medals">
        {hud.medals.map((m) => (
          <div key={m.id} className={`medal ${m.big ? 'big' : ''}`}>
            <b>{m.name}</b>
            <span>+{m.xp}</span>
          </div>
        ))}
      </div>
      {hud.protected && hud.alive && <div className="protected">Spawn protection</div>}
      {hud.outsideZone && <div className="warning">Outside the zone — get back in!</div>}
      {!hud.alive && hud.phase !== 'over' && (
        <div className="dead">
          <h2>You died</h2>
          {hud.killedBy && (
            <div className="killed-by">
              <span>Killed by</span>
              <b style={{ color: hud.killedBy.color }}>{hud.killedBy.name}</b>
              <small>
                {hud.killedBy.weapon}
                {hud.killedBy.headshot ? ' · headshot' : ''}
                {hud.killedBy.distance > 0 ? ` · ${hud.killedBy.distance} m` : ''}
                {hud.killedBy.hp > 0 ? ` · they had ${hud.killedBy.hp} HP` : ''}
              </small>
            </div>
          )}
          {hud.canRespawn ? (
            <p>Click or press Space to respawn</p>
          ) : hud.mode === 'br' || hud.mode === 'survival' ? null : hud.mode.startsWith('1') || hud.mode.startsWith('2') || hud.mode.startsWith('3') ? (
            <p>Spectating — waiting for the round to end</p>
          ) : (
            <p>Respawning…</p>
          )}
        </div>
      )}

      <div className="right-col">
        <div className="feed">
          {hud.feed.map((f) => (
            <div key={f.id} className="feed-row">
              <span className={`${f.killerIsPlayer ? 'me' : ''} ${isDark(f.killerColor) ? 'dark' : ''}`} style={{ color: f.killerColor }}>
                {f.killer}
              </span>
              <span className="gun">
                {f.weapon}
                {f.headshot ? ' ⌖' : ''}
              </span>
              <span className={`${f.victimIsPlayer ? 'me' : ''} ${isDark(f.victimColor) ? 'dark' : ''}`} style={{ color: f.victimColor }}>
                {f.victim}
              </span>
            </div>
          ))}
        </div>
        {LEADERBOARD_MODES.has(hud.mode) && (
          <div className="leaderboard">
            <div className="lb-title">Kills</div>
            {top.map((p, i) => (
              <div key={p.id} className={`lb-row ${p.isPlayer ? 'mine' : ''} ${p.alive ? '' : 'gone'}`}>
                <span className="rank">{i + 1}</span>
                <Name row={p} />
                <span className="k">{p.kills}</span>
              </div>
            ))}
            {me && myRank > 5 && (
              <div className="lb-row mine">
                <span className="rank">{myRank}</span>
                <Name row={me} />
                <span className="k">{me.kills}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {hud.showScoreboard && <Scoreboard hud={hud} />}

      <canvas ref={minimap} className="minimap" width={180} height={180} />

      <div className="vitals">
        <div className="streak">
          {hud.juggernaut && <b className="jugg">JUGGERNAUT</b>}
          {hud.uav && <b className="uav">UAV</b>}
          {hud.nextStreak && (
            <span>
              Streak {hud.streak} · {hud.nextStreak.name} at {hud.nextStreak.kills}
            </span>
          )}
          {hud.crouching && <span className="stance">crouched</span>}
        </div>
        <div className="hp">
          <span>{hud.hp}</span>
          <div className="bar">
            <div style={{ width: `${hud.hp}%` }} className={hpLow ? 'low' : ''} />
          </div>
        </div>
      </div>
      <div className="ammo">
        {hud.reloading > 0 ? (
          <div className="reload">
            RELOADING
            <div className="bar">
              <div style={{ width: `${hud.reloading * 100}%` }} />
            </div>
          </div>
        ) : (
          <>
            {hud.magazine > 0 ? (
              <>
                <span className={hud.ammo <= Math.max(1, hud.magazine / 6) ? 'low' : ''}>{hud.ammo}</span>
                <small>/ {hud.magazine}</small>
              </>
            ) : (
              <span className="melee">KNIFE</span>
            )}
          </>
        )}
        <div className="weapon-name">{hud.weaponName}</div>
        <div className="loadout">
          {hud.loadout.map((w, i) => (
            <span key={w.id} className={w.active ? 'on' : ''}>
              {i + 1} {w.name}
            </span>
          ))}
          <span className="nades">G ×{hud.grenades}</span>
        </div>
        <div className="kd">
          {hud.kills} K · {hud.deaths} D · {hud.xp} XP · Tab scores
        </div>
      </div>
    </div>
  );
};

/** Full scoreboard while Tab is held. Team modes are split by team. */
const Scoreboard = ({ hud }: { hud: HudState }) => {
  const groups: { title: string; color?: string; rows: ScoreRow[] }[] = hud.showTeams
    ? [
        { title: 'Your team', color: hud.teamColors?.[0], rows: hud.players.filter((p) => p.ally) },
        { title: 'Enemy team', color: hud.teamColors?.[1], rows: hud.players.filter((p) => !p.ally) }
      ]
    : [{ title: `${hud.players.length} players`, rows: hud.players }];
  return (
    <div className="scoreboard">
      <h3>{hud.modeName}</h3>
      {groups.map((g) => (
        <div key={g.title} className="sb-group">
          <div className="sb-head" style={{ borderColor: g.color }}>
            <span>{g.title}</span>
            <span>K</span>
            <span>D</span>
          </div>
          {g.rows.map((p) => (
            <div key={p.id} className={`sb-row ${p.isPlayer ? 'mine' : ''} ${p.alive ? '' : 'gone'}`}>
              <Name row={p} />
              <span>{p.kills}</span>
              <span>{p.deaths}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
