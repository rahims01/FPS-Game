import { useEffect, useState, type FormEvent } from 'react';
import { api, heartbeat, isAdmin } from '../net/account';
import { modeName } from '../game/botFriends';
import { levelOf, type Profile } from '../game/progression';

/**
 * Staff tools. Moderators: reports, warnings, mutes, bans, renames, news.
 * The admin also: rewards and codes, events, maintenance, roles, password
 * resets and deleting accounts. Every action is written to the log.
 */

type Section = 'overview' | 'reports' | 'players' | 'news' | 'rewards' | 'rooms' | 'log';
type Any = Record<string, unknown>;

const ago = (at: number) => {
  const m = Math.round((Date.now() - at) / 60_000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const when = (at: number) => (at >= 8_640_000_000_000_000 ? 'forever' : new Date(at).toLocaleString());

const EVENTS: [string, string, string][] = [
  ['doubleXp', 'Double XP', 'Every medal is worth twice the XP.'],
  ['bigHeads', 'Big Heads', 'Huge heads (and headshot hitboxes) in casual matches.'],
  ['lowGravity', 'Low Gravity', 'Moon jumps in casual matches.']
];

export const AdminPanel = ({ onWatchRoom }: { onWatchRoom: (code: string) => void }) => {
  const admin = isAdmin();
  const [section, setSection] = useState<Section>('overview');
  const [flash, setFlash] = useState<string | null>(null);
  const say = (s: string) => {
    setFlash(s);
    window.setTimeout(() => setFlash((f) => (f === s ? null : f)), 4000);
  };
  const [openUser, setOpenUser] = useState<number | null>(null);

  const tabs: [Section, string][] = [
    ['overview', 'Overview'],
    ['reports', 'Reports'],
    ['players', 'Players'],
    ['news', 'News & events'],
    ...(admin ? ([['rewards', 'Rewards & codes']] as [Section, string][]) : []),
    ['rooms', 'Live rooms'],
    ['log', 'Log']
  ];

  return (
    <div className="admin-panel">
      <div className="set-tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={`set-tab ${section === id ? 'on' : ''}`}
            onClick={() => {
              setSection(id);
              setOpenUser(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {flash && (
        <p className="adm-flash" role="status">
          {flash}
        </p>
      )}
      {openUser !== null ? (
        <PlayerDetail id={openUser} admin={admin} say={say} onBack={() => setOpenUser(null)} />
      ) : (
        <>
          {section === 'overview' && <Overview onGo={setSection} />}
          {section === 'reports' && <Reports say={say} onOpen={setOpenUser} />}
          {section === 'players' && <Players onOpen={setOpenUser} />}
          {section === 'news' && <News admin={admin} say={say} />}
          {section === 'rewards' && admin && <Rewards say={say} />}
          {section === 'rooms' && <Rooms onWatch={onWatchRoom} />}
          {section === 'log' && <Log />}
        </>
      )}
    </div>
  );
};

const useLoad = <T,>(path: string, deps: unknown[] = []): [T | null, () => void] => {
  const [data, setData] = useState<T | null>(null);
  const load = () => void api<T>(path).then((r) => r.ok && setData(r.data));
  useEffect(load, [path, ...deps]);
  return [data, load];
};

const Overview = ({ onGo }: { onGo: (s: Section) => void }) => {
  const [o] = useLoad<Any>('admin/overview');
  if (!o) return <p className="set-hint">Loading…</p>;
  const tiles: [string, unknown, Section?][] = [
    ['Players online', o.online],
    ['Accounts', o.users, 'players'],
    ['New today', o.newToday, 'players'],
    ['Open reports', o.openReports, 'reports'],
    ['Banned now', o.banned, 'players'],
    ['Muted now', o.muted, 'players'],
    ['Live rooms', o.rooms, 'rooms'],
    ['Messages today', o.messagesToday]
  ];
  const events = (o.events ?? {}) as Record<string, number>;
  return (
    <>
      <div className="adm-tiles">
        {tiles.map(([k, v, go]) => (
          <button key={k} className="adm-tile" disabled={!go} onClick={() => go && onGo(go)}>
            <b>{String(v ?? 0)}</b>
            <small>{k}</small>
          </button>
        ))}
      </div>
      <h3>Running now</h3>
      <ul className="adm-list">
        {Object.entries(events).map(([k, until]) => (
          <li key={k}>
            Event: <b>{EVENTS.find((e) => e[0] === k)?.[1] ?? k}</b> until {new Date(until).toLocaleString()}
          </li>
        ))}
        {((o.news ?? []) as Any[]).map((n) => (
          <li key={String(n.id)}>
            News ({String(n.kind)}): {String(n.text)}
          </li>
        ))}
        {o.maintenance ? <li>Maintenance notice: {String(o.maintenance)}</li> : null}
        {!Object.keys(events).length && !((o.news as Any[]) ?? []).length && !o.maintenance && <li className="set-hint">Nothing announced.</li>}
      </ul>
    </>
  );
};

const Reports = ({ say, onOpen }: { say: (s: string) => void; onOpen: (id: number) => void }) => {
  const [state, setState] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const [d, reload] = useLoad<{ reports: Any[] }>(`admin/reports?state=${state}`, [state]);
  const act = async (id: unknown, st: string) => {
    const note = st === 'resolved' ? (window.prompt('Note (optional): what did you do?') ?? '') : '';
    const r = await api('admin/reports/resolve', { body: { id, state: st, note } });
    say(r.ok ? 'Updated' : (r.data.error ?? 'Failed'));
    reload();
  };
  return (
    <>
      <div className="pc-reasons">
        {(['open', 'resolved', 'dismissed'] as const).map((s) => (
          <button key={s} className={`chip ${state === s ? 'on' : ''}`} onClick={() => setState(s)}>
            {s}
          </button>
        ))}
      </div>
      {!d ? (
        <p className="set-hint">Loading…</p>
      ) : !d.reports.length ? (
        <p className="set-hint">No {state} reports.</p>
      ) : (
        d.reports.map((r) => (
          <article key={String(r.id)} className="adm-report">
            <header>
              <b>{String(r.target_name)}</b> <span className="adm-tag">{String(r.reason)}</span>
              {Number(r.total) > 1 && <span className="adm-tag hot">{String(r.total)} reports</span>}
              {!r.target_uid && <span className="adm-tag">no account</span>}
              <small>
                by {String(r.reporter_name ?? 'unknown')} · {ago(Number(r.at))}
                {r.context ? ` · ${String(r.context)}` : ''}
              </small>
            </header>
            {r.details ? <p>{String(r.details)}</p> : null}
            {r.note ? <p className="set-hint">Note: {String(r.note)}</p> : null}
            <div className="pc-actions">
              {r.target_uid ? (
                <button className="chip" onClick={() => onOpen(Number(r.target_uid))}>
                  Open player
                </button>
              ) : null}
              {state === 'open' && (
                <>
                  <button className="chip on" onClick={() => act(r.id, 'resolved')}>
                    Resolve
                  </button>
                  <button className="chip" onClick={() => act(r.id, 'dismissed')}>
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </article>
        ))
      )}
    </>
  );
};

const Players = ({ onOpen }: { onOpen: (id: number) => void }) => {
  const [q, setQ] = useState('');
  const [d] = useLoad<{ users: Any[] }>(`admin/users?q=${encodeURIComponent(q)}`, [q]);
  return (
    <>
      <input className="field" placeholder="Search by username or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search players" />
      <table className="adm-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Role</th>
            <th>Last on</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {(d?.users ?? []).map((u) => (
            <tr key={String(u.id)} onClick={() => onOpen(Number(u.id))} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(Number(u.id))}>
              <td>
                <b>{String(u.name)}</b>
                {u.email ? <small> {String(u.email)}</small> : null}
              </td>
              <td>{String(u.role)}</td>
              <td>{u.online ? 'Online now' : u.last_seen ? ago(Number(u.last_seen)) : 'Never'}</td>
              <td>{Number(u.banned_until) > Date.now() ? 'Banned' : Number(u.muted_until) > Date.now() ? 'Muted' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

const PlayerDetail = ({ id, admin, say, onBack }: { id: number; admin: boolean; say: (s: string) => void; onBack: () => void }) => {
  const [d, reload] = useLoad<{ user: Any; profile: Partial<Profile> | null; reportsAgainst: Any[]; reportsMade: number; friends: number; recentMessages: Any[]; history: Any[] }>(`admin/user?id=${id}`, [id]);
  const run = async (path: string, body: Any, ok: string) => {
    const r = await api<Any>(`admin/${path}`, { body: { id, ...body } });
    say(r.ok ? ok : String(r.data.error ?? 'Failed'));
    reload();
    return r;
  };
  if (!d) return <p className="set-hint">Loading…</p>;
  const u = d.user;
  const banned = Number(u.banned_until) > Date.now();
  const muted = Number(u.muted_until) > Date.now();
  const p = d.profile;
  const ban = (minutes: number) => {
    const reason = window.prompt(`Ban ${String(u.name)} ${minutes ? `for ${minutes >= 1440 ? `${minutes / 1440} day(s)` : `${minutes / 60} hour(s)`}` : 'permanently'}. Reason (they see this):`);
    if (reason !== null) void run('ban', { minutes, reason }, 'Banned');
  };
  return (
    <div className="adm-detail">
      <button className="chip" onClick={onBack}>
        Back
      </button>
      <h2>
        {String(u.name)} {u.title ? <span className="pc-staff">{String(u.title)}</span> : null}
      </h2>
      <dl className="pc-facts">
        <div>
          <dt>Role</dt>
          <dd>{String(u.role)}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{String(u.email ?? 'None')}</dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd>{new Date(Number(u.created)).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt>Last on</dt>
          <dd>{u.online ? 'Online now' : u.last_seen ? ago(Number(u.last_seen)) : 'Never'}</dd>
        </div>
        <div>
          <dt>Level</dt>
          <dd>{p?.xp !== undefined ? levelOf(p.xp).level : '–'}</dd>
        </div>
        <div>
          <dt>K / D</dt>
          <dd>{p ? `${p.kills ?? 0} / ${p.deaths ?? 0}` : '–'}</dd>
        </div>
        <div>
          <dt>Friends</dt>
          <dd>{d.friends}</dd>
        </div>
        <div>
          <dt>Reports made</dt>
          <dd>{d.reportsMade}</dd>
        </div>
        {banned && (
          <div>
            <dt>Banned until</dt>
            <dd>
              {when(Number(u.banned_until))}
              {u.ban_reason ? ` (${String(u.ban_reason)})` : ''}
            </dd>
          </div>
        )}
        {muted && (
          <div>
            <dt>Muted until</dt>
            <dd>{when(Number(u.muted_until))}</dd>
          </div>
        )}
      </dl>

      <h3>Moderate</h3>
      <div className="pc-actions adm-actions">
        <button
          className="chip"
          onClick={() => {
            const text = window.prompt('Warning they will see:', 'Please be kind to other players.');
            if (text) void run('warn', { text }, 'Warning sent');
          }}
        >
          Warn
        </button>
        {muted ? (
          <button className="chip" onClick={() => void run('mute', { minutes: -1 }, 'Unmuted')}>
            Unmute
          </button>
        ) : (
          <>
            <button className="chip" onClick={() => void run('mute', { minutes: 60 }, 'Muted for 1 hour')}>
              Mute 1 h
            </button>
            <button className="chip" onClick={() => void run('mute', { minutes: 1440 }, 'Muted for 1 day')}>
              Mute 1 day
            </button>
          </>
        )}
        {banned ? (
          <button className="chip" onClick={() => void run('unban', {}, 'Unbanned')}>
            Unban
          </button>
        ) : (
          <>
            <button className="chip" onClick={() => ban(1440)}>
              Ban 1 day
            </button>
            <button className="chip" onClick={() => ban(7 * 1440)}>
              Ban 7 days
            </button>
            {admin && (
              <button className="chip danger" onClick={() => ban(0)}>
                Ban forever
              </button>
            )}
          </>
        )}
        <button
          className="chip"
          onClick={() => {
            const name = window.prompt('New username:', String(u.name));
            if (name) void run('rename', { name }, 'Renamed');
          }}
        >
          Rename
        </button>
      </div>

      {admin && (
        <>
          <h3>Admin</h3>
          <div className="pc-actions adm-actions">
            <button
              className="chip"
              onClick={async () => {
                if (!window.confirm(`Reset ${String(u.name)}'s password? They will be signed out everywhere.`)) return;
                const r = await run('reset-password', {}, 'Password reset');
                if (r.ok) window.prompt('Their new password (give it to them; they can change it):', String(r.data.password));
              }}
            >
              Reset password
            </button>
            {u.role !== 'admin' && (
              <button className="chip" onClick={() => void run('role', { role: u.role === 'mod' ? 'player' : 'mod' }, u.role === 'mod' ? 'Now a player' : 'Now a moderator')}>
                {u.role === 'mod' ? 'Remove moderator' : 'Make moderator'}
              </button>
            )}
            <button
              className="chip"
              onClick={() => {
                const title = window.prompt('Title shown on their card (empty to remove), e.g. "OG", "Tester", "Champion":', String(u.title ?? ''));
                if (title !== null) void run('title', { title }, 'Title set');
              }}
            >
              Set title
            </button>
            <button className="chip" onClick={() => void run('grant', { reward: { xp: 10_000, note: 'A gift from the admin' } }, 'Gave 10,000 XP')}>
              Give 10k XP
            </button>
            <button className="chip" onClick={() => void run('grant', { reward: { unlocks: ['*'], note: 'Everything unlocked by the admin' } }, 'Unlocked everything')}>
              Unlock all cosmetics
            </button>
            <button className="chip" onClick={() => void run('grant', { reward: { weaponKills: { '*': 500 }, note: 'Every camo, from the admin' } }, 'All camos given')}>
              Give all camos
            </button>
            <button
              className="chip danger"
              onClick={() => {
                if (window.confirm(`Reset ALL of ${String(u.name)}'s progress? This can't be undone.`)) void run('reset-progress', {}, 'Progress reset');
              }}
            >
              Reset progress
            </button>
            {u.role !== 'admin' && (
              <button
                className="chip danger"
                onClick={async () => {
                  if (window.prompt(`Type DELETE to delete ${String(u.name)}'s account forever.`) !== 'DELETE') return;
                  const r = await run('delete', {}, 'Account deleted');
                  if (r.ok) onBack();
                }}
              >
                Delete account
              </button>
            )}
          </div>
        </>
      )}

      <h3>Reports about them ({d.reportsAgainst.length})</h3>
      <ul className="adm-list">
        {d.reportsAgainst.map((r) => (
          <li key={String(r.id)}>
            <b>{String(r.reason)}</b> · {ago(Number(r.at))} · {String(r.state)}
            {r.details ? ` · ${String(r.details)}` : ''}
          </li>
        ))}
        {!d.reportsAgainst.length && <li className="set-hint">None.</li>}
      </ul>
      <h3>Their recent messages</h3>
      <ul className="adm-list">
        {d.recentMessages.map((m, i) => (
          <li key={i}>
            to <b>{String(m.to_name)}</b> · {ago(Number(m.at))}: {String(m.text)}
          </li>
        ))}
        {!d.recentMessages.length && <li className="set-hint">None.</li>}
      </ul>
      <h3>Staff history</h3>
      <ul className="adm-list">
        {d.history.map((h, i) => (
          <li key={i}>
            {String(h.action)} by {String(h.admin)} · {ago(Number(h.at))}
            {h.details ? ` · ${String(h.details)}` : ''}
          </li>
        ))}
        {!d.history.length && <li className="set-hint">Nothing yet.</li>}
      </ul>
    </div>
  );
};

const News = ({ admin, say }: { admin: boolean; say: (s: string) => void }) => {
  const [o, reload] = useLoad<Any>('admin/overview');
  const [text, setText] = useState('');
  const [kind, setKind] = useState('info');
  const [hours, setHours] = useState(24);
  const [maint, setMaint] = useState('');
  const post = async (e: FormEvent) => {
    e.preventDefault();
    const r = await api('admin/news', { body: { text, kind, hours } });
    say(r.ok ? 'Posted' : (r.data.error ?? 'Failed'));
    if (r.ok) setText('');
    reload();
  };
  const events = (o?.events ?? {}) as Record<string, number>;
  return (
    <>
      <h3>Announcement on everyone’s menu</h3>
      <form className="adm-form" onSubmit={post}>
        <textarea className="field" rows={2} maxLength={280} placeholder="e.g. Double XP all weekend! / New melees are out." value={text} onChange={(e) => setText(e.target.value)} />
        <div className="acc-row">
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind">
            <option value="info">Info</option>
            <option value="event">Event</option>
            <option value="celebrate">Celebration (confetti)</option>
            <option value="warning">Warning</option>
          </select>
          <label className="adm-inline">
            for
            <input className="field" type="number" min={1} max={720} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
            hours
          </label>
          <button className="chip on" disabled={!text.trim()}>
            Post
          </button>
        </div>
      </form>
      <ul className="adm-list">
        {((o?.news ?? []) as Any[]).map((n) => (
          <li key={String(n.id)}>
            <b>{String(n.kind)}</b> · {String(n.text)} · until {new Date(Number(n.until)).toLocaleString()}{' '}
            <button
              className="chip"
              onClick={async () => {
                await api('admin/news/end', { body: { id: n.id } });
                reload();
              }}
            >
              End
            </button>
          </li>
        ))}
      </ul>

      {admin && (
        <>
          <h3>Events</h3>
          <div className="adm-events">
            {EVENTS.map(([key, name, blurb]) => {
              const on = (events[key] ?? 0) > Date.now();
              return (
                <div key={key} className={`adm-event ${on ? 'on' : ''}`}>
                  <b>{name}</b>
                  <small>{on ? `On until ${new Date(events[key]).toLocaleString()}` : blurb}</small>
                  <span className="pc-actions">
                    {[2, 24, 48].map((h) => (
                      <button
                        key={h}
                        className="chip"
                        onClick={async () => {
                          await api('admin/event', { body: { key, hours: h } });
                          say(`${name} on for ${h} h`);
                          reload();
                        }}
                      >
                        {h} h
                      </button>
                    ))}
                    {on && (
                      <button
                        className="chip"
                        onClick={async () => {
                          await api('admin/event', { body: { key, hours: 0 } });
                          say(`${name} off`);
                          reload();
                        }}
                      >
                        Stop
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <h3>Maintenance notice</h3>
          <p className="set-hint">Shown at the top of everyone’s menu until you clear it (the game keeps working).</p>
          <form
            className="acc-row"
            onSubmit={async (e) => {
              e.preventDefault();
              await api('admin/maintenance', { body: { message: maint } });
              say(maint ? 'Notice on' : 'Notice cleared');
              reload();
            }}
          >
            <input className="field" placeholder={String(o?.maintenance ?? 'e.g. Servers restarting at 3pm')} value={maint} onChange={(e) => setMaint(e.target.value)} maxLength={200} />
            <button className="chip">{maint ? 'Set' : 'Clear'}</button>
          </form>
        </>
      )}
    </>
  );
};

const Rewards = ({ say }: { say: (s: string) => void }) => {
  const [codes, reload] = useLoad<{ codes: Any[] }>('admin/codes');
  const [who, setWho] = useState('');
  const [xp, setXp] = useState(5000);
  const [codeName, setCodeName] = useState('');
  const [codeXp, setCodeXp] = useState(2500);
  const [uses, setUses] = useState(100);
  const [days, setDays] = useState(7);

  const giveMe = async (reward: Any, msg: string) => {
    // Through your inbox like any gift (so it's logged and applied once), fetched right away.
    const r = await api('admin/grant', { body: { id: (await api<{ user: { id: number } }>('account/me')).data.user.id, reward } });
    if (r.ok) await heartbeat();
    say(r.ok ? msg : (r.data.error ?? 'Failed'));
  };
  const findId = async (name: string) => (await api<{ users: Any[] }>(`admin/users?q=${encodeURIComponent(name)}`)).data.users?.find((u) => String(u.name).toLowerCase() === name.toLowerCase())?.id;

  return (
    <>
      <h3>For you</h3>
      <div className="pc-actions adm-actions">
        <button className="chip on" onClick={() => giveMe({ levels: 55, unlocks: ['*'], weaponKills: { '*': 500 }, note: 'Admin kit' }, 'Max level, everything unlocked, every camo')}>
          Give me everything
        </button>
        <button className="chip" onClick={() => giveMe({ xp: 50_000 }, '+50,000 XP')}>
          +50k XP
        </button>
        <button className="chip" onClick={() => giveMe({ unlocks: ['*'] }, 'Every cosmetic unlocked')}>
          Unlock all cosmetics
        </button>
        <button className="chip" onClick={() => giveMe({ weaponKills: { '*': 500 } }, 'Every camo on every gun')}>
          All camos
        </button>
      </div>

      <h3>Give to a player, or everyone</h3>
      <div className="acc-row">
        <input className="field" placeholder="Username (empty = everyone)" value={who} onChange={(e) => setWho(e.target.value)} />
        <input className="field" type="number" value={xp} onChange={(e) => setXp(Number(e.target.value))} aria-label="XP" />
        <button
          className="chip on"
          onClick={async () => {
            if (!who && !window.confirm(`Give ${xp} XP to EVERY account?`)) return;
            const id = who ? await findId(who) : undefined;
            if (who && !id) return say('No player with that username');
            const r = await api<{ count: number }>('admin/grant', { body: { id, everyone: !who, reward: { xp, note: who ? 'A gift from the admin' : 'A gift for everyone!' } } });
            say(r.ok ? `Sent to ${r.data.count} player(s)` : (r.data.error ?? 'Failed'));
          }}
        >
          Give XP
        </button>
      </div>

      <h3>Gift codes</h3>
      <p className="set-hint">Players type these under Account. Good for class rewards and giveaways.</p>
      <div className="acc-row">
        <input className="field" placeholder="CODE (empty = random)" value={codeName} onChange={(e) => setCodeName(e.target.value.toUpperCase())} maxLength={16} />
        <label className="adm-inline">
          XP <input className="field" type="number" value={codeXp} onChange={(e) => setCodeXp(Number(e.target.value))} />
        </label>
        <label className="adm-inline">
          uses <input className="field" type="number" value={uses} onChange={(e) => setUses(Number(e.target.value))} />
        </label>
        <label className="adm-inline">
          days <input className="field" type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </label>
        <button
          className="chip on"
          onClick={async () => {
            const r = await api<{ code: string }>('admin/codes', { body: { code: codeName, reward: { xp: codeXp, note: 'Code reward' }, uses, hours: days * 24 } });
            say(r.ok ? `Code ${r.data.code} is live` : (r.data.error ?? 'Failed'));
            reload();
          }}
        >
          Make code
        </button>
      </div>
      <table className="adm-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Reward</th>
            <th>Uses left</th>
            <th>Ends</th>
          </tr>
        </thead>
        <tbody>
          {(codes?.codes ?? []).map((c) => (
            <tr key={String(c.code)}>
              <td>
                <b>{String(c.code)}</b>
              </td>
              <td>{String(c.reward)}</td>
              <td>{String(c.uses_left)}</td>
              <td>{new Date(Number(c.until)).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

const Rooms = ({ onWatch }: { onWatch: (code: string) => void }) => {
  const [d, reload] = useLoad<{ rooms: Any[] }>('admin/rooms');
  useEffect(() => {
    const t = window.setInterval(reload, 15_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <p className="set-hint">Rooms hosted by signed-in players right now. Watch joins as a spectator.</p>
      <table className="adm-table">
        <thead>
          <tr>
            <th>Host</th>
            <th>Mode</th>
            <th>Players</th>
            <th>Code</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(d?.rooms ?? []).map((r) => (
            <tr key={String(r.code)}>
              <td>
                <b>{String(r.host)}</b>
              </td>
              <td>{modeName(String(r.mode))}</td>
              <td>
                {String(r.players)} / {String(r.max)}
              </td>
              <td>{String(r.code)}</td>
              <td>
                <button className="chip on" onClick={() => onWatch(String(r.code))}>
                  Watch
                </button>
              </td>
            </tr>
          ))}
          {!d?.rooms.length && (
            <tr>
              <td colSpan={5} className="set-hint">
                No rooms right now.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
};

const Log = () => {
  const [d] = useLoad<{ audit: Any[] }>('admin/audit');
  return (
    <ul className="adm-list">
      {(d?.audit ?? []).map((a) => (
        <li key={String(a.id)}>
          <b>{String(a.admin)}</b> {String(a.action)} {a.target_name ? <b>{String(a.target_name)}</b> : a.target ? String(a.target) : ''} · {ago(Number(a.at))}
          {a.details ? <small> {String(a.details)}</small> : null}
        </li>
      ))}
    </ul>
  );
};
