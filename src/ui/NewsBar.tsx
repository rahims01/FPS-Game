import { useEffect, useState } from 'react';
import { account, dismissNotice, subscribeAccount, type AccountState } from '../net/account';
import { countdown, eventDef } from '../game/events';
const DISMISSED = 'fps-news-seen-v1';

const seen = (): number[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED) ?? '[]');
  } catch {
    return [];
  }
};

/** Announcements from the admin, live events and maintenance notices, under the menu's top bar. */
export const NewsBar = () => {
  const [st, setSt] = useState<AccountState>(account);
  const [hidden, setHidden] = useState<number[]>(seen);
  const [now, setNow] = useState(Date.now);
  useEffect(() => subscribeAccount(setSt), []);
  // The countdowns tick.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const events = Object.entries(st.events)
    .filter(([, e]) => e.until > now)
    .sort((a, b) => a[1].from - b[1].from);
  const news = st.news.filter((n) => !hidden.includes(n.id));
  if (!st.maintenance && !events.length && !news.length) return null;
  const hide = (id: number) => {
    const next = [...hidden, id].slice(-50);
    setHidden(next);
    try {
      localStorage.setItem(DISMISSED, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="news-bar" role="region" aria-label="News">
      {st.maintenance && <p className="news warning">{st.maintenance}</p>}
      {events.length > 2 ? (
        // Lots on at once: one row of chips (the blurb on hover).
        <p className="news event multi">
          <b>Events</b>
          {events.map(([k, e]) => {
            const d = eventDef(k);
            const live = e.from <= now;
            return (
              <span key={k} className={`ev-chip ${live ? '' : 'soon'}`} title={d?.blurb}>
                {d?.name ?? k}
                <span className="news-clock">{live ? countdown(e.until - now) : `starts in ${countdown(e.from - now)}`}</span>
              </span>
            );
          })}
        </p>
      ) : events.map(([k, e]) => {
        const d = eventDef(k);
        const live = e.from <= now;
        return (
          <p key={k} className={`news event ${live ? '' : 'soon'}`}>
            <span>
              <b>{d?.name ?? k}</b> {live ? 'is on' : 'starts soon'}
              {d && <small> · {d.blurb}</small>}
            </span>
            <span className="news-clock">{live ? `ends in ${countdown(e.until - now)}` : `in ${countdown(e.from - now)}`}</span>
          </p>
        );
      })}
      {news.map((n) => (
        <p key={n.id} className={`news ${n.kind}`}>
          {n.kind === 'celebrate' && <span className="confetti" aria-hidden="true" />}
          <span>{n.text}</span>
          <button className="news-x" onClick={() => hide(n.id)} aria-label="Dismiss">
            Dismiss
          </button>
        </p>
      ))}
    </div>
  );
};

/** One-time messages: a warning from a moderator, a gift, a rename, being signed out. */
export const NoticeBox = () => {
  const [st, setSt] = useState<AccountState>(account);
  useEffect(() => subscribeAccount(setSt), []);
  const n = st.notices[0];
  if (!n) return null;
  return (
    <div className="overlay notice-overlay" role="alertdialog" aria-modal="true" aria-label="Message">
      <div className="menu-card small">
        <p className="notice-text">{n}</p>
        <div className="row">
          <button className="play" onClick={dismissNotice} autoFocus>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
