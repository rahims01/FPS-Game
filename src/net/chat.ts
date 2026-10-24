/**
 * Party chat for online rooms. Only rooms with friends have chat (matchmade
 * games have none). The host filters every message before relaying it, so
 * everyone sees the same cleaned-up text.
 */
export interface ChatLine {
  id: number;
  name: string;
  color: number;
  text: string;
  /** System lines (joins, leaves) have no sender. */
  system?: boolean;
  at: number;
}

export const CHAT_MAX = 120;

/**
 * Words starred out wherever they start a word ("fucking", "shitty" too).
 * Each is matched loosely: look-alike characters (sh1t, a$$, niqqa),
 * repeated letters (fuuuck), symbols or spaces between letters (f.u.c.k,
 * f u c k), and one masked or missing letter (f*ck, f ck, fck).
 */
const ROOTS = [
  'fuck', 'fuk', 'fuq', 'fck', 'phuck', 'phuk', 'motherfucker', 'mofo',
  'shit', 'shyt', 'shiet', 'sht', 'bullshit', 'horseshit',
  'bitch', 'biatch', 'biotch', 'btch', 'bish',
  'cunt', 'dick', 'cock', 'pussy', 'asshole', 'dumbass', 'jackass', 'dipshit', 'bastard', 'twat', 'wanker', 'prick',
  'slut', 'whore', 'hoe', 'skank',
  'nigger', 'nigga', 'niggah', 'nigguh', 'nibba', 'nigra', 'ngga', 'nggr', 'negro', 'nig',
  'faggot', 'fag', 'tranny', 'retard', 'chink', 'spic', 'kike', 'wetback', 'beaner', 'gook', 'coon',
  'killyourself', 'kys', 'rape', 'rapist', 'penis', 'vagina', 'porn', 'cum', 'jizz', 'dildo', 'boob', 'tits',
  'nazi', 'hitler'
];

/** Short roots that only count as a whole word (they hide inside ordinary words: class, hoes vs shoes, cumulative). */
const WHOLE_WORD = new Set(['ass', 'hoe', 'cum', 'tit', 'tits', 'nig', 'fag', 'kys', 'spic', 'coon', 'gook', 'bish', 'rape', 'porn', 'boob', 'mofo', 'fuk', 'fuq', 'prick', 'negro', 'sht']);
ROOTS.push('ass');

/** Ordinary words that contain a root (the Scunthorpe problem). */
const SAFE = ['cocktail', 'cockpit', 'cockroach', 'peacock', 'hancock', 'shiitake', 'scunthorpe', 'dickens', 'dickinson', 'retardant', 'bassist', 'cockatoo', 'shitzu', 'therapist', 'grape', 'drape', 'scrape', 'skyscraper', 'spice', 'spicy', 'raccoon', 'cocoon', 'tycoon', 'snigger', 'bishop', 'hoedown', 'shoe', 'cumber', 'document', 'circumstance', 'title', 'titan', 'pricked', 'negroni', 'niger'];

/** Characters that stand in for each letter. */
const LOOKALIKE: Record<string, string> = {
  a: 'aа4@àáâäãå∆^',
  b: 'b8ß6',
  c: 'cс(¢ck<',
  d: 'd',
  e: 'eе3€èéêë',
  f: 'fƒ',
  g: 'g9q6',
  h: 'h#',
  i: 'iі1!|lìíîï¡',
  j: 'j',
  k: 'kc',
  l: 'l1|i',
  m: 'm',
  n: 'nñ',
  o: 'oо0òóôöø°',
  p: 'pр',
  q: 'qg9',
  r: 'r',
  s: 'sѕ5$z§',
  t: 't7+',
  u: 'uvüùúûµ',
  v: 'vu',
  w: 'w',
  x: 'xх',
  y: 'yу',
  z: 'zs2'
};

const esc = (s: string) => s.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&');
const cls = (ch: string) => `[${esc(LOOKALIKE[ch] ?? ch)}]`;
/** Junk allowed between letters inside a word: dots, dashes, stars, underscores, or one space ("sh it"). */
const JOIN = "(?:[^\\sa-z0-9]{0,2}|\\s)";
const JOIN_TIGHT = "[^\\sa-z0-9]{0,2}";
/** What a masked letter may be written as. */
const MASK = "[*#@!?._\\-\\s]";
const LETTER_BEFORE = '(?<![a-z0-9])';

/**
 * One regex per root: compact (f.u.c.k, fuuuck, sh1t, sh it), one letter masked
 * (f*ck, f ck), or fully spaced (f u c k). Dropped-letter spellings (fck, btch)
 * are listed as roots of their own: dropping letters in general would turn
 * "pick" into "prick" and "sit" into "shit".
 */
const buildPattern = (root: string): RegExp => {
  const letters = [...root];
  const L = letters.map((c) => `${cls(c)}+`);
  // Tight (symbols between letters) wherever a word starts; split by a space only if the word then ends,
  // so "sh it" and "bi tch" count but "bit chilly" doesn't.
  const variants = [L.join(JOIN_TIGHT), `${L.join(JOIN)}(?![a-z])`];
  // One inner letter masked: f*ck, f ck.
  if (letters.length >= 4) {
    for (let i = 1; i < letters.length - 1; i++) variants.push([...L.slice(0, i), MASK, ...L.slice(i + 1)].join(JOIN_TIGHT));
  }
  // Every letter on its own, separated by spaces or symbols: "f u c k", "n.i.g.g.a".
  variants.push(letters.map((c) => `${cls(c)}`).join('[\\s\\W_]+'));
  const end = WHOLE_WORD.has(root) ? '(?![a-z])' : '';
  return new RegExp(`${LETTER_BEFORE}(?:${variants.join('|')})${end}`, 'giu');
};

const PATTERNS = ROOTS.map(buildPattern);

/** The whole word around [start, end), for checking it against the safe list. */
const wordAround = (text: string, start: number, end: number): string => {
  let a = start;
  let b = end;
  while (a > 0 && /[a-z]/i.test(text[a - 1])) a--;
  while (b < text.length && /[a-z]/i.test(text[b])) b++;
  return text.slice(a, b).toLowerCase();
};

/** Replaces blocked words with asterisks. */
export const censor = (text: string): string => {
  const lower = text.toLowerCase();
  const hit = new Array<boolean>(text.length).fill(false);
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    for (let m = re.exec(lower); m; m = re.exec(lower)) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const start = m.index;
      const end = start + m[0].length;
      const word = wordAround(lower, start, end);
      if (SAFE.some((s) => word.includes(s))) continue;
      for (let i = start; i < end; i++) hit[i] = true;
    }
  }
  let out = '';
  for (let i = 0; i < text.length; i++) out += hit[i] && !/\s/.test(text[i]) ? '*' : text[i];
  return out;
};

/** Trims, collapses whitespace, caps length and filters. Empty means "don't send". */
export const cleanChat = (text: string): string =>
  censor(
    text
      // Full-width and stylised letters become plain ones; invisible characters are dropped.
      .normalize('NFKC')
      .replace(/[​-‏⁠﻿­]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, CHAT_MAX)
  );
