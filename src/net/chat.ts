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
 * Words that get starred out, matched after undoing common disguises
 * (leetspeak, repeated letters, spacing like "f u c k"). Roots match inside
 * longer words ("fucking"), so this list stays short.
 */
const BLOCKED = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'asshole',
  'bastard',
  'slut',
  'whore',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'killyourself',
  'penis',
  'vagina',
  'porn',
  'tranny',
  'wetback',
  'twat',
  'wanker',
  'motherfucker'
];

/** Whole words that only count on their own (they appear inside innocent words). */
const BLOCKED_WORDS = new Set(['ass', 'cum', 'tit', 'tits', 'hoe', 'hoes', 'sex', 'nazi', 'hitler', 'piss', 'rape', 'raped', 'kys', 'fag', 'fags', 'spic', 'kike', 'chink']);

/** Innocent words that contain a blocked root (the Scunthorpe problem). */
const SAFE = ['cocktail', 'cockpit', 'cockroach', 'peacock', 'hancock', 'shiitake', 'shitake', 'scunthorpe', 'dickens', 'dickinson', 'retardant', 'bassist', 'cockatoo', 'shitzu'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', $: 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '(': 'c', '€': 'e' };

/** Lowercase letters only, disguises undone; `squeeze` also collapses runs of one letter ("fuuuck" -> "fuck"). */
const normalize = (s: string, squeeze = true): string => {
  let out = '';
  for (const ch of s.toLowerCase()) {
    const c = LEET[ch] ?? ch;
    if (c >= 'a' && c <= 'z' && (!squeeze || out[out.length - 1] !== c)) out += c;
  }
  return out;
};

const blocked = (word: string): boolean => {
  const plain = normalize(word, false);
  const squeezed = normalize(word);
  if (BLOCKED_WORDS.has(plain) || BLOCKED_WORDS.has(squeezed)) return true;
  if (SAFE.some((w) => plain.includes(w) || squeezed.includes(w))) return false;
  return BLOCKED.some((b) => squeezed.includes(b) || plain.includes(b));
};

const stars = (s: string) => s.replace(/[^\s]/g, '*');

/** Replaces blocked words with asterisks. */
export const censor = (text: string): string => {
  // Pass 1: each word on its own.
  const words = text.split(/(\s+)/);
  const cleaned = words.map((w) => {
    if (/^\s+$/.test(w)) return w;
    return normalize(w) && blocked(w) ? stars(w) : w;
  });
  // Pass 2: words spelled out with spaces or dots ("f u c k", "s.h.i.t").
  const tokens = cleaned.map((w, i) => ({ w, i })).filter((t) => !/^\s+$/.test(t.w));
  for (let start = 0; start < tokens.length; start++) {
    let joined = '';
    for (let end = start; end < tokens.length && end < start + 12; end++) {
      const piece = normalize(tokens[end].w);
      if (piece.length > 2) break;
      joined += piece;
      if (end > start && BLOCKED.some((b) => joined === b || (joined.length >= 4 && joined.includes(b)))) {
        for (let k = start; k <= end; k++) cleaned[tokens[k].i] = stars(tokens[k].w);
        break;
      }
    }
  }
  return cleaned.join('');
};

/** Trims, collapses whitespace, caps length and filters. Empty means "don't send". */
export const cleanChat = (text: string): string => censor(text.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX));
