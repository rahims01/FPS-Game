/**
 * Events the admin can switch on (now or on a schedule) for everyone. Reward and
 * look events apply to every match; rule events only to casual matches (never
 * ranked, tournaments or the campaign).
 */
export type EventGroup = 'Rewards' | 'Looks' | 'Rules';

export interface EventDef {
  key: string;
  name: string;
  blurb: string;
  icon: string;
  group: EventGroup;
}

export const EVENTS: EventDef[] = [
  { key: 'doubleXp', name: 'Double XP', blurb: 'Every medal is worth twice the XP.', icon: '⚡', group: 'Rewards' },
  { key: 'tripleXp', name: 'Triple XP Hour', blurb: 'Every medal is worth three times the XP.', icon: '🔥', group: 'Rewards' },
  { key: 'doubleWeaponXp', name: 'Double Weapon XP', blurb: 'Every kill counts twice toward camos and mastery.', icon: '🔫', group: 'Rewards' },
  { key: 'freeCamos', name: 'Free Camo Weekend', blurb: 'Every camo on every gun is yours to wear while it lasts.', icon: '🎨', group: 'Rewards' },
  { key: 'happyHour', name: 'Happy Hour Medals', blurb: 'Every medal gives 50 bonus XP.', icon: '🍹', group: 'Rewards' },
  { key: 'goldenGuns', name: 'Golden Guns', blurb: 'Every gun in every match is gold.', icon: '🏆', group: 'Looks' },
  { key: 'confettiKills', name: 'Confetti Kills', blurb: 'Every takedown bursts into confetti.', icon: '🎉', group: 'Looks' },
  { key: 'nightOps', name: 'Night Ops', blurb: 'Every map at night, flashlights on.', icon: '🌙', group: 'Looks' },
  { key: 'snow', name: 'Snowfall', blurb: 'Snow falling on every map.', icon: '🌨', group: 'Looks' },
  { key: 'rain', name: 'Rain', blurb: 'A downpour on every map.', icon: '🌧', group: 'Looks' },
  { key: 'fog', name: 'Fog', blurb: 'Thick fog: you see half as far.', icon: '🌫', group: 'Looks' },
  { key: 'disco', name: 'Disco', blurb: 'The light cycles through every colour.', icon: '🪩', group: 'Looks' },
  { key: 'rainbowTracers', name: 'Rainbow Tracers', blurb: 'Everyone’s bullets leave rainbow streaks.', icon: '🌈', group: 'Looks' },
  { key: 'flyingRagdolls', name: 'Flying Ragdolls', blurb: 'Takedowns send people flying.', icon: '🪁', group: 'Looks' },
  { key: 'paintParty', name: 'Paint Party', blurb: 'Hits splash paint in the shooter’s colour.', icon: '🖌', group: 'Looks' },
  { key: 'retro', name: 'Retro', blurb: 'Chunky pixels and punchy colours.', icon: '👾', group: 'Looks' },
  { key: 'halloween', name: 'Halloween', blurb: 'Spooky skies. Play a match to keep the Jack-o’-Lantern charm.', icon: '🎃', group: 'Looks' },
  { key: 'winter', name: 'Winter', blurb: 'Snow and pale skies. Play a match to keep the Snowflake charm.', icon: '❄', group: 'Looks' },
  { key: 'bigHeads', name: 'Big Heads', blurb: 'Huge heads (and headshot hitboxes).', icon: '🎈', group: 'Rules' },
  { key: 'lowGravity', name: 'Low Gravity', blurb: 'Moon jumps.', icon: '🌕', group: 'Rules' },
  { key: 'speedDemon', name: 'Speed Demon', blurb: 'Everyone moves 30% faster.', icon: '💨', group: 'Rules' },
  { key: 'streakFrenzy', name: 'Streak Frenzy', blurb: 'Killstreaks cost half the kills.', icon: '📈', group: 'Rules' },
  { key: 'headshotsOnly', name: 'Headshots Only', blurb: 'Only headshots do damage.', icon: '🎯', group: 'Rules' },
  { key: 'oneShot', name: 'One Shot Party', blurb: 'Any hit takes someone down.', icon: '💥', group: 'Rules' },
  { key: 'knivesOut', name: 'Knives Out', blurb: 'Knives only, for everyone.', icon: '🔪', group: 'Rules' },
  { key: 'mystery', name: 'Mystery Playlist', blurb: 'Find Match drops you into a random mode.', icon: '❓', group: 'Rules' }
];

export const eventDef = (key: string): EventDef | undefined => EVENTS.find((e) => e.key === key);

/** The limited charm an event gives for playing a match during it. */
export const EVENT_CHARMS: Record<string, string> = { halloween: 'pumpkin', winter: 'snowflake' };

/** "2d 4h", "3h 12m", "5m 09s". */
export const countdown = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
};
