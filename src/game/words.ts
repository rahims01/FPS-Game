/**
 * Classroom mode's wording: takedowns and tag-outs instead of kills and
 * deaths, for a class or younger players. Everything that shows these words
 * asks here, so one setting changes them all.
 */
let classroom = false;
export const setClassroom = (on: boolean) => (classroom = on);
export const isClassroom = () => classroom;

/** Whole phrases first, then single words (matching the original's capitalisation). */
const PHRASES: [string, string][] = [
  ['Killing Spree', 'Hot Streak'],
  ['First Blood', 'First Takedown'],
  ['Kill Confirmed', 'Tag Confirmed'],
  ['Kill Denied', 'Tag Denied'],
  ['Knife Kill', 'Melee Takedown'],
  ['Airstrike Kill', 'Airstrike Takedown'],
  ['Carrier Kill', 'Carrier Takedown'],
  ['VIP Kill', 'VIP Takedown'],
  ['Killed by', 'Tagged out by'],
  ['KILLCAM', 'REPLAY'],
  ['Killcam', 'Replay'],
  ['kills', 'takedowns'],
  ['Kills', 'Takedowns'],
  ['kill', 'takedown'],
  ['Kill', 'Takedown'],
  ['deaths', 'tag-outs'],
  ['Deaths', 'Tag-outs']
];

export const say = (text: string): string => {
  if (!classroom) return text;
  let out = text;
  for (const [a, b] of PHRASES) out = out.replace(new RegExp(`\\b${a}\\b`, 'g'), b);
  return out;
};
