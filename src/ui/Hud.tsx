import type { RefObject } from 'react';
import type { HudState, ScoreRow } from '../game/Game';
import type { GameSettings } from '../game/settings';
import { isDark } from '../game/identity';
import { THROWABLES } from '../sim/gear';
import { CallingCard, LevelBadge } from './ProfilePanel';
import { isClassroom, say } from '../game/words';
import { inkOn } from './ink';
import { HeadshotIcon } from './icons';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Modes where a kill leaderboard is shown on screen. */
const LEADERBOARD_MODES = new Set(['ffa', 'headshot', 'instagib', 'snipers', 'gungame', 'br', 'roulette', 'marksman']);

const Name = ({ row }: { row: Pick<ScoreRow, 'name' | 'color' | 'isPlayer'> & { bot?: boolean } }) => (
  <span className={`name ${row.isPlayer ? 'me' : ''} ${isDark(row.color) ? 'dark' : ''}`} style={{ color: row.color }}>
    {row.name}
    {row.bot && <small className="bot-tag">BOT</small>}
  </span>
);

export const Hud = ({ hud, minimap, settings }: { hud: HudState; minimap: RefObject<HTMLCanvasElement | null>; settings: GameSettings }) => {
  const ch = settings.crosshair;
  const gap = ch.gap + (ch.dynamic ? hud.spread * 900 : 0);
  const markerAge = hud.time - hud.hitMarkerAt;
  const hpLow = hud.hp < 35;
  const [mine, theirs] = hud.teamColors ?? ['var(--blue)', 'var(--red)'];
  const leader = hud.players[0];
  const top = hud.players.slice(0, 5);
  const me = hud.players.find((p) => p.isPlayer);
  const myRank = hud.players.findIndex((p) => p.isPlayer) + 1;
  const watching = !!hud.spectating;
  return (
    <div className={`hud ${hud.killcam ? 'in-killcam' : ''} ${watching ? 'watching' : ''} ${hud.spectator ? 'benched' : ''} ${hud.touch ? 'touch' : ''}`}>
      {hud.scoped && (
        <div className="scope">
          <div className="scope-ring" />
          <i className="h" />
          <i className="v" />
        </div>
      )}
      {hud.alive && !watching && !hud.aiming && !hud.scoped && !hud.hardcore && (
        <div className="crosshair" style={{ ['--gap' as string]: `${gap}px`, ['--len' as string]: `${ch.size}px`, ['--thick' as string]: `${ch.thickness}px`, ['--col' as string]: ch.color }}>
          <i className="t" />
          <i className="b" />
          <i className="l" />
          <i className="r" />
          {ch.dot && <i className="d" />}
        </div>
      )}
      {hud.alive && hud.aiming && !hud.scoped && !hud.optic && <div className="dot" />}
      {hud.optic && <div className={`optic-reticle ${hud.optic}`} aria-hidden="true" />}
      {markerAge < 0.25 && <div key={hud.hitMarkerAt} className={`hitmarker ${hud.hitMarkerKind}`} />}
      {hud.damage.map((d, i) => (
        <div key={`${d.at}-${i}`} className="dmg" style={{ transform: `translate(-50%, -50%) rotate(${-d.angle}rad)`, opacity: 1 - (hud.time - d.at) / 1.2 }}>
          <i />
        </div>
      ))}
      {hpLow && hud.alive && <div className="vignette" style={{ opacity: (35 - hud.hp) / 35 }} />}
      {hud.outsideZone && <div className="zone-tint" />}
      {hud.time - hud.pickupAt < 0.4 && <div className="heal-flash" />}
      {hud.flashed > 0 && <div className="flashbang" style={{ opacity: hud.flashed }} />}
      {hud.sounds.map((c, i) => (
        <div key={`${c.at}-${i}`} className={`sound-cue ${c.kind}`} style={{ transform: `translate(-50%, -50%) rotate(${-c.angle}rad)`, opacity: 1 - (hud.time - c.at) / 1.2 }}>
          <i />
        </div>
      ))}
      {hud.boss && (
        <div className="boss-bar">
          <span>BOSS · phase {hud.boss.phase + 1}</span>
          <div>
            <i style={{ width: `${hud.boss.hp * 100}%` }} />
          </div>
        </div>
      )}

      <div className="top">
        <div className="mode-name">{hud.modeName}</div>
        {hud.showTeams && (
          <div className="score teams">
            <span className="team-score" style={{ background: mine, color: inkOn(mine) }}>
              <em key={Math.floor(hud.scores[0])}>{Math.floor(hud.scores[0])}</em>
            </span>
            <span className="alive">
              {hud.mode === 'infected'
                ? `${hud.scores[0]} survivors · ${fmt(hud.infectedSeconds ?? 0)}`
                : hud.targetScore && !['1v1', '2v2', '3v3'].includes(hud.mode)
                  ? `first to ${hud.targetScore}`
                  : `${hud.teamCounts[0]} v ${hud.teamCounts[1]}`}
            </span>
            <span className="team-score" style={{ background: theirs, color: inkOn(theirs) }}>
              <em key={Math.floor(hud.scores[1])}>{Math.floor(hud.scores[1])}</em>
            </span>
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
        {hud.modeStatus && <div className="mode-status">{hud.modeStatus}</div>}
        {hud.ctf && (
          <div className="ctf">
            <span className={`ctf-flag us ${hud.ctf.ours}`}>
              <i style={{ background: mine }} />
              Your flag: {hud.ctf.ours === 'home' ? 'safe' : hud.ctf.ours}
            </span>
            <span className={`ctf-flag them ${hud.ctf.theirs}`}>
              <i style={{ background: theirs }} />
              Enemy flag: {hud.ctf.theirs === 'home' ? 'at base' : hud.ctf.theirs}
            </span>
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
        {(hud.mode === 'survival' || hud.mode === 'zombies') && (
          <div className="score">
            <span>Wave {hud.wave}</span>
            <span className="alive">{hud.enemiesLeft} left</span>
          </div>
        )}
        {(hud.mode === 'ffa' || hud.mode === 'headshot' || hud.mode === 'instagib' || hud.mode === 'snipers') && (
          <div className="score">
            <span>
              <em key={hud.kills}>{hud.kills}</em>
            </span>
            <span className="alive">first to {hud.targetScore}</span>
            <span className={leader && isDark(leader.color) ? 'dark' : ''} style={{ color: leader?.color }}>
              {leader?.kills ?? 0}
            </span>
          </div>
        )}
        {hud.mode.startsWith('br') && (
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

      {hud.banner && hud.phase !== 'over' && hud.intro === null && <div className="banner">{hud.banner}</div>}
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
      {hud.hint && (
        <div className="hint" key={hud.hint.text} role="status">
          <span className="hint-keys">
            {hud.hint.keys.map((k) => (
              <kbd key={k}>{k}</kbd>
            ))}
          </span>
          <span>{hud.hint.text}</span>
        </div>
      )}
      {hud.protected && hud.alive && <div className="protected">Spawn protection</div>}
      {hud.outsideZone && <div className="warning">Outside the zone — get back in!</div>}
      {hud.blind !== null && (
        <div className="blindfold">
          <b>You are seeking</b>
          <span>Hiders get a head start. Released in {hud.blind}s</span>
        </div>
      )}
      {hud.reconnecting !== null && (
        <div className="reconnecting">
          <i />
          <b>Reconnecting…</b>
          <span>The admin restarted the server · {hud.reconnecting}s</span>
        </div>
      )}
      {hud.killcam && (
        <div className="killcam">
          <div className="kc-bar kc-top" />
          <div className="kc-bar kc-bottom" />
          <div className="kc-label">
            <b>{say('KILLCAM')}</b>
            <span>
              <i style={{ color: hud.killcam.color }}>{hud.killcam.killer}</i> · {hud.killcam.weapon}
            </span>
          </div>
          <div className="kc-skip">Press Space or click to skip</div>
        </div>
      )}
      {hud.spectating && !hud.killcam && hud.phase !== 'over' && (
        <div className="spectate-bar">
          <small>{hud.spectator ? 'Spectating the match' : 'You are out · spectating'}</small>
          <b className={isDark(hud.spectating.color) ? 'dark' : ''} style={{ color: hud.spectating.color }}>
            {hud.spectating.name}
          </b>
          <span>{hud.spectating.weapon}</span>
          <em>{hud.touch ? 'Tap FIRE for the next player' : 'Click or Space: next player · Right click: previous'}</em>
        </div>
      )}
      {!hud.alive && !watching && !hud.spectator && hud.phase !== 'over' && !hud.killcam && (
        <div className="dead">
          <h2>{isClassroom() ? 'Tagged out' : 'You died'}</h2>
          {hud.killedBy && (
            <div className="killed-by">
              <span>{say('Killed by')}</span>
              <CallingCard card={hud.killedBy.card} emblem={hud.killedBy.emblem} name={hud.killedBy.name} level={hud.killedBy.level} title={hud.killedBy.title} frame={hud.killedBy.frame} prestige={hud.killedBy.prestige} />
              <small>
                {hud.killedBy.weapon}
                {hud.killedBy.headshot ? ' · headshot' : ''}
                {hud.killedBy.distance > 0 ? ` · ${hud.killedBy.distance} m` : ''}
                {hud.killedBy.hp > 0 ? ` · they had ${hud.killedBy.hp} HP` : ''}
              </small>
            </div>
          )}
          {hud.redeployIn !== null ? (
            <p>Redeploying next to your squad in {Math.ceil(hud.redeployIn)}s, as long as one of them survives</p>
          ) : hud.canRespawn ? (
            <p>Click or press Space to respawn</p>
          ) : hud.mode.startsWith('br') || hud.mode === 'survival' ? null : hud.mode.startsWith('1') || hud.mode.startsWith('2') || hud.mode.startsWith('3') ? (
            <p>Spectating — waiting for the round to end</p>
          ) : (
            <p>Respawning…</p>
          )}
        </div>
      )}

      <div className="right-col">
        <div className="feed">
          {hud.feed.map((f) =>
            f.system ? (
              <div key={f.id} className="feed-row system">
                {f.system}
              </div>
            ) : (
            <div key={f.id} className="feed-row">
              <span className={`${f.killerIsPlayer ? 'me' : ''} ${isDark(f.killerColor) ? 'dark' : ''}`} style={{ color: f.killerColor }}>
                {f.killerAdmin && <b className="feed-crown" title="Admin">♛ </b>}
                {f.killer}
              </span>
              <span className="gun">
                {f.weapon}
                {f.headshot && <HeadshotIcon size={13} title="Headshot" />}
              </span>
              <span className={`${f.victimIsPlayer ? 'me' : ''} ${isDark(f.victimColor) ? 'dark' : ''}`} style={{ color: f.victimColor }}>
                {f.victim}
              </span>
            </div>
            )
          )}
        </div>
        {LEADERBOARD_MODES.has(hud.mode) && (
          <div className="leaderboard">
            <div className="lb-title">{say('Kills')}</div>
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

      <canvas ref={minimap} className="minimap" width={180} height={180} style={hud.hardcore ? { display: 'none' } : undefined} />
      {(settings.showFps || (settings.showPing && hud.ping !== null)) && (
        <div className="perf">
          {settings.showFps && <span>{hud.fps} FPS</span>}
          {settings.showPing && hud.ping !== null && <span className={hud.ping > 150 ? 'bad' : ''}>{hud.ping === 0 ? 'host' : `${Math.round(hud.ping)} ms`}</span>}
        </div>
      )}

      <div className="vitals">
        <div className="streak">
          {hud.juggernaut && <b className="jugg">JUGGERNAUT</b>}
          {hud.uav && <b className="uav">UAV</b>}
          {hud.jammed && <b className="jammed">JAMMED</b>}
          <span className="streak-picks">
            {hud.streaks.length > 0 && `Streak ${hud.streak}`}
            {hud.streaks.map((s) => (
              <i key={s.name} className={s.earned ? 'earned' : hud.nextStreak?.name === s.name ? 'next' : ''} title={`${s.name} at ${s.kills} kills`}>
                {s.name} <em>{s.kills}</em>
              </i>
            ))}
          </span>
          {hud.crouching && <span className="stance">crouched</span>}
        </div>
        <div className={`hp ${hpLow ? 'low' : ''}`}>
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
          <span className="nades" title="Lethal">
            {THROWABLES[hud.throwables.lethal].name} ×{hud.throwables.lethals}
          </span>
          <span className="nades" title="Tactical">
            {THROWABLES[hud.throwables.tactical].name} ×{hud.throwables.tacticals}
          </span>
        </div>
        <div className="kd">
          {hud.kills} K · {hud.deaths} D · {hud.xp} XP · Tab scores
        </div>
      </div>
    </div>
  );
};

/** Full scoreboard while Tab is held. Team modes are split by team. */
export const Scoreboard = ({ hud, onPick }: { hud: HudState; onPick?: (id: number) => void }) => {
  const groups: { title: string; color?: string; rows: ScoreRow[] }[] = hud.showTeams
    ? [
        { title: hud.spectator ? 'Team 1' : 'Your team', color: hud.teamColors?.[0], rows: hud.players.filter((p) => p.ally) },
        { title: hud.spectator ? 'Team 2' : 'Enemy team', color: hud.teamColors?.[1], rows: hud.players.filter((p) => !p.ally) }
      ]
    : [{ title: `${hud.players.length} players`, rows: hud.players }];
  return (
    <div className="scoreboard">
      <h3>{hud.modeName}</h3>
      {groups.map((g) => (
        <div key={g.title} className="sb-group">
          <div className="sb-head">
            <span className="sb-title" style={g.color ? { background: g.color, color: inkOn(g.color) } : undefined}>
              {g.title}
            </span>
            <span>K</span>
            <span>D</span>
            <span>Ping</span>
          </div>
          {g.rows.map((p) => (
            <div
              key={p.id}
              className={`sb-row ${p.isPlayer ? 'mine' : ''} ${p.alive ? '' : 'gone'} ${onPick ? 'pick' : ''}`}
              {...(onPick ? { role: 'button', tabIndex: 0, title: `See ${p.name}'s card`, onClick: () => onPick(p.id), onKeyDown: (e: { key: string }) => e.key === 'Enter' && onPick(p.id) } : {})}
            >
              <span className="sb-name">
                <LevelBadge level={p.level} prestige={p.prestige} frame={p.frame} />
                {p.emblem && (
                  <em className="emblem" style={{ color: p.emblem.color }}>
                    {p.emblem.glyph}
                  </em>
                )}
                {p.mastery && <em className="mastery-dot" style={{ background: p.mastery }} title="Weapon mastery" />}
                <Name row={p} />
              </span>
              <span>{p.kills}</span>
              <span>{p.deaths}</span>
              <span className={`ping ${p.ping !== null && p.ping > 120 ? 'bad' : p.ping !== null && p.ping > 70 ? 'meh' : ''}`}>{p.bot ? '–' : p.ping === null ? '' : p.ping}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
