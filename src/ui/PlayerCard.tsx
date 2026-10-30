import { useEffect, useState } from 'react';
import { BADGES, CARDS, CHARMS, DEFAULT_COSMETICS, EMBLEMS, FLASHES, FRAMES, NAMETAGS, STYLES, TITLES, TRACERS, type Cosmetics } from '../game/cosmetics';
import { meleeDef } from '../assets/melees';
import { addBotFriend, botFriendByName, levelNow, modeName, seedOf, statsFor, statusOf, type BotFriend } from '../game/botFriends';
import { levelOf, type Profile } from '../game/progression';
import type { PlayerCardData } from '../game/Game';
import { account, api } from '../net/account';
import { WEAPONS, type WeaponId } from '../sim/weapons';
import { CallingCard } from './ProfilePanel';

/** Who a card is about: someone from a match, a friend from the list, or an account looked up by name. */
export type CardSubject = { from: 'match'; data: PlayerCardData } | { from: 'bot'; friend: BotFriend } | { from: 'account'; name: string };

interface Remote {
  id: number;
  name: string;
  title: string | null;
  role: string;
  created: number;
  online: boolean;
  status: { state: string; mode: string | null; room: string | null } | null;
  profile: Partial<Profile> | null;
  cosmetics: Cosmetics | null;
  favorite: string | null;
  friend: 'none' | 'sent' | 'received' | 'friends';
}

const REASONS = ['Cheating', 'Offensive name', 'Bad language or bullying', 'Teamkilling or throwing', 'Spamming', 'Something else'];

const nameIn = <T extends { id: string; name?: string; text?: string }>(list: T[], id: string | undefined) => {
  const x = list.find((i) => i.id === id);
  return x ? (x.name ?? x.text ?? x.id) : 'Default';
};

const statusText = (s: { online: boolean; state: string; mode?: string | null; lastSeenMin?: number }) =>
  !s.online ? (s.lastSeenMin !== undefined ? `Offline · on ${s.lastSeenMin < 60 ? `${s.lastSeenMin} min` : `${Math.round(s.lastSeenMin / 60)} h`} ago` : 'Offline') : s.state === 'match' && s.mode ? `In a match · ${modeName(s.mode)}` : s.state === 'lobby' ? 'In a lobby' : 'Online · In the menu';

/** A player's card, opened from a scoreboard or the friends list: who they are, their stats and what they wear. */
export const PlayerCard = ({
  subject,
  myProfile,
  onClose,
  onMessage
}: {
  subject: CardSubject;
  myProfile: Profile;
  onClose: () => void;
  /** Open a chat with them (friends only). */
  onMessage?: (key: string) => void;
}) => {
  const [tab, setTab] = useState<'overview' | 'stats' | 'look'>('overview');
  const [remote, setRemote] = useState<Remote | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [, bump] = useState(0);
  const signedIn = !!account().user;

  // Resolve the subject into one shape.
  const match = subject.from === 'match' ? subject.data : null;
  const accountName = subject.from === 'account' ? subject.name : match?.kind === 'human' ? match.account : null;
  const isBot = subject.from === 'bot' || match?.kind === 'bot' || match?.kind === 'labelled';
  const name = subject.from === 'bot' ? subject.friend.name : subject.from === 'account' ? subject.name : match!.name;
  const botFriend = isBot ? botFriendByName(name) : undefined;

  useEffect(() => {
    if (!accountName || !signedIn) return;
    void api<Remote>(`profile?name=${encodeURIComponent(accountName)}`).then((r) => r.ok && setRemote(r.data));
  }, [accountName, signedIn]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const me = match?.kind === 'me';
  const level = me ? levelOf(myProfile.xp).level : botFriend ? levelNow(botFriend) : remote?.profile?.xp !== undefined ? levelOf(remote.profile.xp).level : (match?.level ?? 1);
  const prestige = me ? myProfile.prestige : (botFriend?.prestige ?? remote?.profile?.prestige ?? match?.prestige ?? 0);
  const cos: Cosmetics | null = botFriend?.cosmetics ?? remote?.cosmetics ?? match?.cosmetics ?? null;
  const favorite = (botFriend?.favorite ?? remote?.favorite ?? match?.favorite ?? 'rifle') as WeaponId;
  const seed = seedOf(name);
  const botStats = isBot ? statsFor(seed, level, prestige) : null;
  const prof = me ? myProfile : remote?.profile;
  const stats = botStats
    ? botStats
    : prof
      ? { matches: prof.matches ?? 0, wins: prof.wins ?? 0, kills: prof.kills ?? 0, deaths: prof.deaths ?? 0, headshots: prof.stats?.headshots ?? 0, bestStreak: prof.stats?.bestStreak ?? 0, hours: Math.round((prof.matches ?? 0) * 0.13) }
      : null;
  const status = botFriend ? statusOf(botFriend) : remote ? { online: remote.online, state: remote.status?.state ?? 'menu', mode: remote.status?.mode } : null;

  const friendState: 'none' | 'sent' | 'received' | 'friends' | 'self' | 'na' = me
    ? 'self'
    : match?.kind === 'labelled'
      ? 'na'
      : isBot
        ? botFriend
          ? botFriend.state === 'friends'
            ? 'friends'
            : 'sent'
          : 'none'
        : remote
          ? remote.friend
          : 'na';

  const addFriend = async () => {
    if (isBot) {
      addBotFriend({ name, color: match?.color ?? botFriend?.color ?? 0x5aa0ff, level, prestige, cosmetics: cos ?? { ...DEFAULT_COSMETICS }, favorite });
      setNote('Friend request sent');
      bump((n) => n + 1);
      return;
    }
    if (!signedIn) return setNote('Sign in to add friends');
    const r = await api<{ accepted?: boolean }>('friends/request', { body: { name: accountName } });
    setNote(r.ok ? (r.data.accepted ? 'You are now friends' : 'Friend request sent') : (r.data.error ?? 'Could not send'));
    if (r.ok && remote) setRemote({ ...remote, friend: r.data.accepted ? 'friends' : 'sent' });
  };

  const sendReport = async () => {
    if (!signedIn) return setNote('Sign in to report players');
    const r = await api('report', { body: { name: accountName ?? name, reason, details, context: match ? `${match.mode} (${match.kills}/${match.deaths})` : '' } });
    setNote(r.ok ? 'Thanks. A moderator will look at it.' : (r.data.error ?? 'Could not send the report'));
    if (r.ok) setReporting(false);
  };

  // Pinned achievements: yours, theirs (accounts), or a believable few for a computer player.
  const BOT_SHOWCASE = ['firstblood', 'centurion', 'headhunter', 'veteran', 'winner', 'unstoppable', 'knifemaster', 'longarm', 'triple', 'fragout', 'thousand', 'dedicated', 'payback', 'openingact'];
  const showcase: string[] = me
    ? (myProfile.showcase ?? [])
    : remote
      ? (remote.profile?.showcase ?? [])
      : isBot
        ? BOT_SHOWCASE.filter((_, i) => ((seed >>> (i % 24)) & 3) === 0).slice(0, level < 5 ? 0 : level < 20 ? 1 : level < 40 ? 2 : 3)
        : [];
  const card = cos?.card ?? 'recruit';
  const melee = meleeDef(cos?.melee).name;
  const wpn = WEAPONS[favorite]?.name ?? 'M16';
  const title = remote?.title;

  return (
    <div className="overlay pc-overlay" role="dialog" aria-modal="true" aria-label={`${name}'s card`} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="menu-card player-card">
        <div className="pc-top">
          <CallingCard card={card} emblem={cos?.emblem ?? 'star'} name={name} level={level} prestige={prestige} frame={cos?.frame ?? 'none'} title={cos?.title} sub={status ? statusText(status) : match ? `${match.kills} kills · ${match.deaths} deaths this match` : undefined} />
          {title && <span className="pc-staff">{title}</span>}
          <button className="chip pc-close" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        {(() => {
          // Everyone shows a username: an account's, yours, or (for computer players) their name.
          const handle = me ? account().user?.name : remote?.name ?? accountName ?? (isBot ? name : null);
          return handle ? <p className="pc-handle">@{handle}</p> : <p className="pc-handle">Not signed in</p>;
        })()}
        <div className="set-tabs">
          {(
            [
              ['overview', 'Overview'],
              ['stats', 'Stats'],
              ['look', 'Cosmetics']
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={`set-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && showcase.length > 0 && (
          <div className="pc-showcase" aria-label="Pinned achievements">
            {showcase.map((id) => {
              const b = BADGES.find((x) => x.id === id);
              return b ? (
                <span key={id} title={b.blurb}>
                  {b.icon} {b.name}
                </span>
              ) : null;
            })}
          </div>
        )}
        {tab === 'overview' && (
          <dl className="pc-facts">
            <div>
              <dt>Level</dt>
              <dd>{prestige > 0 ? `Prestige ${prestige} · ${level}` : level}</dd>
            </div>
            <div>
              <dt>Favourite gun</dt>
              <dd>{wpn}</dd>
            </div>
            <div>
              <dt>Melee</dt>
              <dd>{melee}</dd>
            </div>
            {stats && (
              <div>
                <dt>K/D</dt>
                <dd>{(stats.kills / Math.max(1, stats.deaths)).toFixed(2)}</dd>
              </div>
            )}
            {stats && (
              <div>
                <dt>Win rate</dt>
                <dd>{Math.round((stats.wins / Math.max(1, stats.matches)) * 100)}%</dd>
              </div>
            )}
            {remote && (
              <div>
                <dt>Joined</dt>
                <dd>{new Date(remote.created).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
        )}

        {tab === 'stats' &&
          (stats ? (
            <dl className="pc-facts">
              {(
                [
                  ['Matches', stats.matches],
                  ['Wins', stats.wins],
                  ['Kills', stats.kills],
                  ['Deaths', stats.deaths],
                  ['Headshots', stats.headshots],
                  ['Best streak', stats.bestStreak],
                  ['Hours played', stats.hours]
                ] as [string, number][]
              ).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="set-hint">{signedIn ? 'Stats are private for players who are not signed in.' : 'Sign in to see other players’ stats.'}</p>
          ))}

        {tab === 'look' && (
          <dl className="pc-facts">
            {(
              [
                ['Calling card', nameIn(CARDS, cos?.card)],
                ['Emblem', nameIn(EMBLEMS, cos?.emblem)],
                ['Title', nameIn(TITLES, cos?.title)],
                ['Frame', nameIn(FRAMES, cos?.frame)],
                ['Name tag', nameIn(NAMETAGS, cos?.nametag)],
                ['Style', nameIn(STYLES, cos?.style)],
                ['Tracers', nameIn(TRACERS, cos?.tracer)],
                ['Muzzle flash', nameIn(FLASHES, cos?.flash)],
                ['Charm', nameIn(CHARMS, cos?.charm)],
                ['Melee', melee]
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {reporting ? (
          <div className="pc-report">
            <h3>Report {name}</h3>
            <div className="pc-reasons">
              {REASONS.map((r) => (
                <button key={r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>
                  {r}
                </button>
              ))}
            </div>
            <textarea className="field" rows={3} maxLength={500} placeholder="What happened? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
            <div className="pc-actions">
              <button className="chip" onClick={() => setReporting(false)}>
                Cancel
              </button>
              <button className="chip on" onClick={sendReport}>
                Send report
              </button>
            </div>
          </div>
        ) : (
          friendState !== 'self' && (
            <div className="pc-actions">
              {friendState === 'none' && (
                <button className="chip on" onClick={addFriend}>
                  Add friend
                </button>
              )}
              {friendState === 'received' && (
                <button className="chip on" onClick={addFriend}>
                  Accept friend request
                </button>
              )}
              {friendState === 'sent' && (
                <button className="chip" disabled>
                  Request sent
                </button>
              )}
              {friendState === 'friends' && onMessage && (
                <button className="chip on" onClick={() => onMessage(botFriend ? botFriend.key : `u:${remote?.id}`)}>
                  Message
                </button>
              )}
              {friendState === 'na' && !isBot && (
                <button className="chip" disabled title="They aren't signed in">
                  Add friend
                </button>
              )}
              <button className="chip" onClick={() => setReporting(true)}>
                Report
              </button>
            </div>
          )
        )}
        {note && (
          <p className="set-hint pc-note" role="status">
            {note}
          </p>
        )}
      </div>
    </div>
  );
};
