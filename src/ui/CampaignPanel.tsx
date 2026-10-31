import { useEffect, useState } from 'react';
import { campaignStars, MISSIONS, missionOpen, XP_PER_STAR, type Mission } from '../game/campaign';
import { LockIcon, StarIcon } from './icons';

/** Three stars, filled up to `n`. */
export const Stars = ({ n, size = 14 }: { n: number; size?: number }) => (
  <span className="m-stars" aria-label={`${n} of 3 stars`}>
    {[0, 1, 2].map((i) => (
      <i key={i} className={i < n ? 'on' : ''}>
        <StarIcon size={size} />
      </i>
    ))}
  </span>
);

/** The campaign: missions in order, their stars, and the briefing of the one you pick. */
export const CampaignPanel = ({ onStart, onClose }: { onStart: (m: Mission) => void; onClose: () => void }) => {
  const stars = campaignStars();
  const next = MISSIONS.findIndex((m) => !(stars[m.id] > 0));
  const [pick, setPick] = useState(next < 0 ? MISSIONS.length - 1 : next);
  const total = MISSIONS.reduce((n, m) => n + (stars[m.id] ?? 0), 0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const m = MISSIONS[pick];
  const open = missionOpen(pick, stars);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Campaign" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="menu-card campaign-card">
        <div className="acc-head">
          <h2>Campaign</h2>
          <span className="m-total">
            <Stars n={3} size={12} /> {total} / {MISSIONS.length * 3}
          </span>
          <button className="chip" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="campaign">
          <ol className="m-list">
            {MISSIONS.map((x, i) => {
              const ok = missionOpen(i, stars);
              return (
                <li key={x.id}>
                  <button className={`m-row ${i === pick ? 'on' : ''} ${ok ? '' : 'locked'}`} onClick={() => setPick(i)}>
                    <span className="m-num">{i + 1}</span>
                    <span className="m-text">
                      <b>{x.title}</b>
                      <small>{x.place}</small>
                    </span>
                    {ok ? <Stars n={stars[x.id] ?? 0} /> : <LockIcon size={14} />}
                  </button>
                </li>
              );
            })}
          </ol>
          <section className="m-brief">
            <small className="m-kicker">
              Mission {pick + 1} · {m.place} · {m.difficulty}
            </small>
            <h3>{m.title}</h3>
            <p>{m.briefing}</p>
            <ul className="m-goals">
              {m.goals.map((g, i) => (
                <li key={g.text} className={(stars[m.id] ?? 0) > i ? 'done' : ''}>
                  <Stars n={(stars[m.id] ?? 0) > i ? 1 : 0} size={12} /> {g.text}
                </li>
              ))}
            </ul>
            <p className="set-hint">+{XP_PER_STAR} XP for every new star. Finish all ten for the “Campaign Hero” title.</p>
            <button className="play" disabled={!open} onClick={() => onStart(m)}>
              {open ? ((stars[m.id] ?? 0) > 0 ? 'PLAY AGAIN' : 'START MISSION') : 'LOCKED'}
            </button>
            {!open && <p className="set-hint">Get a star on mission {pick} first.</p>}
          </section>
        </div>
      </div>
    </div>
  );
};
