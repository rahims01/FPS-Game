/**
 * How bot friends talk. Each has a personality and a texting style; a message
 * is matched against a set of intents (greeting, invite, trash talk, tips...)
 * and answered from a phrase bank, with a little memory of the conversation.
 *
 * Safety rules that hold for every bot, whatever is said to them: they never
 * ask for or share personal details (age, school, where you live, real name,
 * photos), never suggest other apps or meeting up, and steer back to the game.
 */

export type Personality = 'hype' | 'chill' | 'sweaty' | 'friendly' | 'funny';
export const PERSONALITIES: Personality[] = ['hype', 'chill', 'sweaty', 'friendly', 'funny'];

export interface ChatMemory {
  /** Intents already answered, to avoid repeating the same line. */
  used: string[];
  /** What the player said they like. */
  theirGun?: string;
  theirMode?: string;
  /** Times the player was rude in a row. */
  rude: number;
  lastIntent?: string;
}

export interface ChatContext {
  personality: Personality;
  /** The bot's own favourite gun and mode, for "what do you use" questions. */
  favorite: string;
  favoriteMode: string;
  level: number;
  /** The player's in-game name, for the odd "gg <name>". */
  playerName: string;
  /** What the bot is doing right now (menu, a match). */
  busy: boolean;
  memory: ChatMemory;
  rand: () => number;
}

export interface BotReply {
  text: string;
  /** An invite the bot is making (the chat shows a Join button). */
  invite?: { mode: string };
}

type Bank = Partial<Record<Personality, string[]>> & { any: string[] };

const pick = <T,>(xs: T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];

/** Lines by intent. {gun} {mode} {name} {level} {theirgun} are filled in. */
const LINES: Record<string, Bank> = {
  greeting: {
    any: ['hey', 'yo', 'hi', 'heyy', 'sup', 'wassup', 'hello hello', 'oh hey'],
    hype: ['YOOO', 'yooo whats good', 'HEYYY', 'ayo its {name}!!'],
    chill: ['hey', 'yo whats up', 'sup', 'hey hey'],
    sweaty: ['yo', 'sup. wanna run some games', 'hey'],
    friendly: ['hi!! how are you', 'heyy good to see you', 'hello :)', 'hey {name}!'],
    funny: ['greetings fellow gamer', 'yo its me ur favorite teammate', 'hiii', 'ah {name} has arrived']
  },
  how: {
    any: ['good wbu', 'pretty good, you?', 'im good just playing', 'chillin wbu', 'not bad', 'tired but good lol', 'just grinding levels', 'good! you?'],
    hype: ['GREAT just hit a 15 streak', 'amazing honestly wbu', 'so good rn i keep winning'],
    sweaty: ['grinding ranked', 'trying to get my sr up', 'ok, lost a close one though'],
    funny: ['living the dream (losing gunfights)', 'my aim is having a day off', 'good my knife skills are improving'],
    friendly: ['im good thanks for asking! how about you?', 'doing well :) you?']
  },
  doing: {
    any: ['just playing some {mode}', 'grinding camos', 'about to queue up', 'nothing much', 'trying to unlock stuff for the {gun}', 'messing around in free roam', 'doing some aim training'],
    sweaty: ['grinding {gun} camos', 'ranked', 'warming up in aim trainer'],
    funny: ['trying to hit one shot with the sniper', 'losing to bots honestly', 'running around with the knife being annoying']
  },
  inviteYes: {
    any: ['sure lets go', 'ok im down', 'yeah send it', 'lets run it', 'ok join me', 'yes', 'bet', 'sure what mode'],
    hype: ['LETS GOOO', 'YES lets go', 'im so down'],
    chill: ['sure', 'yeah why not', 'ok lets play'],
    sweaty: ['ok but we tryhard', 'yeah lets win some', 'sure, dont throw lol'],
    friendly: ['yes!! lets play', 'of course!'],
    funny: ['only if you carry me', 'ok but if we lose its your fault', 'fine ill carry you']
  },
  inviteBusy: {
    any: ['in a match rn, after?', 'give me a sec im mid game', 'one sec finishing this round', 'after this game', 'cant rn, in a game'],
    funny: ['busy getting destroyed rn one sec', 'mid gunfight pray for me']
  },
  duel: {
    any: ['1v1? you sure', 'ok 1v1 me', 'bet', 'you are not ready', 'ok first to 5'],
    hype: ['OH YOU WANT A 1V1??', 'lets gooo im not holding back'],
    sweaty: ['ez', 'ok i wont go easy', 'sure, snipers only?'],
    friendly: ['haha sure lets do it', 'ok good luck!'],
    funny: ['prepare to lose (or win idk)', 'ok but no knifing me']
  },
  compliment: {
    any: ['thanks!', 'ty', 'thanks lol', 'appreciate it', 'you too', 'gg', 'ty ty'],
    hype: ['THANKS', 'yesss thank you', 'we did that'],
    chill: ['ty', 'thanks man', 'appreciate it'],
    sweaty: ['ty', 'could be better', 'yeah not bad'],
    friendly: ['aw thanks! you were good too', 'thank you!!'],
    funny: ['i know im amazing', 'please tell my teammates that', 'finally someone noticed']
  },
  gg: {
    any: ['gg', 'gg!', 'ggs', 'gg wp', 'good game', 'gg that was close', 'gg {name}'],
    hype: ['GG that was crazy', 'GGGG', 'gg we were cooking'],
    sweaty: ['gg', 'gg, close one', 'gg next one we win'],
    funny: ['gg i carried (i did not)', 'gg my aim was on vacation']
  },
  rude: {
    any: ['ok chill', 'calm down lol', 'why so mad', 'its just a game', 'ok...', 'thats not very nice', 'chill bro'],
    sweaty: ['check the scoreboard', 'ok', 'lol ok'],
    friendly: ['hey thats not nice :(', 'lets keep it fun ok'],
    funny: ['ouch my feelings', 'i will be telling my mom', 'wow ok that hurt']
  },
  rudeAgain: { any: ['ok im gonna go play', 'not talking if youre gonna be mean', 'bye then', 'whatever'] },
  // Playful deflection, never a claim either way.
  botQuestion: {
    any: ['why lol', 'what makes you say that', 'lol', 'just focus on the game', 'huh', 'does it matter lol', 'lets just play'],
    funny: ['beep boop', 'thats what a bot would ask', 'the real question is are YOU a bot'],
    sweaty: ['lol ok', 'focus up']
  },
  personal: {
    any: ['i dont really share that stuff online', 'lets not do personal stuff lol', 'i keep that private', 'nah i dont share that', 'lol lets just play', "can't say, internet rules", 'thats personal haha']
  },
  offPlatform: {
    any: ['nah i only use this', 'i just play here', 'i dont have that', 'lets just chat here', 'no i only play on here', 'i only talk on this lol']
  },
  sad: {
    any: ['oh no thats rough', 'aw that sucks', 'hope it gets better', 'wanna play a game to forget about it', 'sorry to hear that', 'that sounds annoying', 'take it easy'],
    friendly: ['aw im sorry :( wanna play together', 'that sounds hard, hope youre ok'],
    funny: ['want me to lose on purpose to cheer you up', 'sending virtual snacks']
  },
  bored: {
    any: ['same lol', 'wanna play?', 'lets run some {mode}', 'try zombies, its fun', 'we should do a 1v1', 'try the movement course', 'aim trainer?']
  },
  tip: {
    any: [
      'slide by crouching while you sprint, its so good',
      'aim for the head, way faster kills',
      'use cover and peek, dont just stand in the open',
      'reload behind cover not in the middle of a fight',
      'try the {gun}, its really good rn',
      'put toggle aim on if your on a trackpad',
      'aim trainer helps a lot honestly',
      'shotguns only work up close, switch to pistol if theyre far',
      'flash before you push a room',
      'smoke helps if you need to run away',
      'quick hands perk is underrated',
      'killstreaks are worth it, try the uav first',
      'crouch when you shoot from far, less spread',
      'listen for footsteps, crouching is silent'
    ]
  },
  gunQuestion: {
    any: ['{gun} for sure', 'i use the {gun} mostly', 'the {gun}, its so good', '{gun}. you?', 'probably {gun}'],
    sweaty: ['{gun}, best ttk', '{gun} no question'],
    funny: ['the knife. just the knife', '{gun} but i still miss']
  },
  modeQuestion: { any: ['{mode}', 'probably {mode}', 'i like {mode} a lot', '{mode} or zombies', 'gunfight is fun too'] },
  levelQuestion: { any: ['level {level}', "im {level}", '{level} rn', 'like {level}', '{level}, grinding to 55'] },
  theirGun: { any: ['{theirgun} is good', 'oh nice {theirgun}', 'ive seen people cook with the {theirgun}', '{theirgun}? respect'] },
  laugh: { any: ['lol', 'lmao', 'haha', 'lol yeah', 'ikr', 'haha true'] },
  thanks: { any: ['np', 'no problem', 'anytime', 'np!', 'of course'] },
  bye: {
    any: ['bye', 'cya', 'later', 'see ya', 'gn', 'bye!', 'cya later', 'ok bye'],
    hype: ['BYEEE', 'later!! gg today'],
    friendly: ['bye! was fun', 'see you later!'],
    funny: ['farewell', 'bye dont forget me']
  },
  yes: { any: ['ok', 'cool', 'nice', 'bet', 'ok sounds good', 'yeah'] },
  no: { any: ['ok', 'oh ok', 'fair', 'alright', 'np'] },
  school: { any: ['ugh same', 'school is so long', 'homework is the worst', 'lol relatable', 'cant wait for the weekend'] },
  question: {
    any: ['idk', 'hmm not sure', 'good question', 'maybe?', 'i think so', 'probably', 'no idea lol', 'why do you ask'],
    funny: ['the answer is always more headshots', 'ask the zombies']
  },
  unknown: {
    any: ['lol', 'yeah', 'true', 'fr', 'ok', 'haha', 'nice', 'oh ok', 'hmm', 'interesting', 'yea', 'same'],
    hype: ['LOL', 'fr fr', 'thats crazy'],
    chill: ['true', 'yeah', 'lol'],
    sweaty: ['ok', 'k', 'yeah'],
    friendly: ['haha yeah', 'oh cool!', 'nice!'],
    funny: ['bold of you to say', 'i agree with whatever that means', 'lmao what']
  }
};

/** Things bots say on their own: coming online, wanting to play, after a match together. */
const OPENERS: Bank = {
  any: ['yo wanna play', 'you on?', 'wanna run some {mode}', 'hey you playing rn?', 'lets play', 'just got on', 'anyone wanna play {mode}', 'squad up?', 'you down for a few games?'],
  hype: ['YO GET ON', 'lets play right now!!', 'i just unlocked a new camo come see'],
  sweaty: ['ranked?', 'need a duo for gunfight', 'wanna grind some games'],
  friendly: ['hi! wanna play together?', 'hey! hope youre having a good day, wanna play?'],
  funny: ['i need someone to carry me', 'zombies? i promise not to die first', 'who wants to watch me miss every shot']
};
const AFTER_MATCH: Record<'won' | 'lost', Bank> = {
  won: { any: ['gg that was fun', 'we won!!', 'ez win', 'gg nice one', 'good game, again?', 'gg you were cracked'], hype: ['WE WON LETS GOOO', 'GG WE COOKED'], sweaty: ['gg, solid', 'nice, next'], funny: ['gg i was the mvp (i was not)'] },
  lost: { any: ['gg close one', 'unlucky', 'gg next one', 'ugh so close', 'rematch?', 'we will get them next time'], sweaty: ['they were sweaty', 'rematch.'], funny: ['i blame lag', 'my controller unplugged itself (i use a keyboard)'] }
};

const GUNS = ['m16', 'ak', 'ak47', 'scar', 'burst', 'vector', 'smg', 'uzi', 'shotgun', 'saiga', 'dmr', 'sniper', 'barrett', '50 cal', 'lmg', 'm60', 'pistol', 'magnum', 'revolver', 'deagle', 'desert eagle', 'knife', 'katana', 'machete', 'bat', 'axe'];
const MODES = ['tdm', 'team deathmatch', 'ffa', 'free for all', 'gunfight', 'zombies', 'kill confirmed', 'domination', 'search', 'snd', 'gun game', 'battle royale', 'br', 'paintball', 'ctf', 'capture the flag', 'infected', 'boss', 'survival', 'hardpoint', 'duel', '1v1'];

const has = (t: string, re: RegExp) => re.test(t);

/** What the message is about. Safety intents come first so they always win. */
export const intentOf = (raw: string): string => {
  const t = ` ${raw.toLowerCase().replace(/[^a-z0-9?' ]/g, ' ').replace(/\s+/g, ' ')} `;
  if (has(t, /\b(discord|snap ?chat|snap|insta(gram)?|tik ?tok|whats ?app|telegram|kik|phone|number|text me|call me|facetime|meet up|meet irl|irl|email|gmail|add me on|dm me on)\b/)) return 'offPlatform';
  if (has(t, /\b(how old|your age|ur age|what age|where do you live|where u live|where you from|wya|what school|which school|your school|ur school|real name|your name|ur name|send (a )?(pic|photo|selfie)|picture of you|what do you look like|address|what state|what city|what country|boy or girl|are you a (boy|girl))\b/)) return 'personal';
  if (has(t, /\b(are you|r u|ru|you) (a )?(bot|ai|robot|npc|real|human|person)\b|\bbot\?|\bur a bot\b|\byoure a bot\b/)) return 'botQuestion';
  if (has(t, /\b(trash|noob|suck|sucks|garbage|bad at|loser|stupid|dumb|idiot|shut up|stfu|ez|cringe|hate you|ratio)\b/)) return 'rude';
  if (has(t, /\b(1v1|1 v 1|one v one|duel me|fight me)\b/)) return 'duel';
  if (has(t, /\b(wanna|want to|wana|tryna|lets|let's|can we|should we|you down|u down|join|invite|squad|party|run it|play with me|play together|get on|hop on)\b/) && has(t, /\b(play|game|games|match|join|squad|party|run|on|zombies|tdm|ffa|gunfight|ranked|together)\b/)) return 'invite';
  if (has(t, /\b(gg|ggs|good game|well played|wp)\b/)) return 'gg';
  if (has(t, /\b(nice|good job|great|you're good|youre good|ur good|cracked|insane|goated|carried|carry|w)\b/) && !has(t, /\?/)) return 'compliment';
  if (has(t, /\b(tip|tips|how do i|how to|help me|advice|get better|improve)\b/)) return 'tip';
  if (has(t, /\b(fav|favorite|favourite|best|what) (gun|weapon|loadout|class)\b|\bwhat (do|gun do) you use\b|\bwhat do u use\b/)) return 'gunQuestion';
  if (has(t, /\b(fav|favorite|favourite|best) (mode|game mode)\b|\bwhat mode\b/)) return 'modeQuestion';
  if (has(t, /\b(what level|your level|ur level|what lvl|what rank|your rank)\b/)) return 'levelQuestion';
  if (has(t, /\b(my (fav|favorite|favourite|main)( gun)? is|i (use|main|like)) /) && GUNS.some((g) => t.includes(` ${g}`))) return 'theirGun';
  if (has(t, /\b(how are you|how r u|hru|how are u|hows it going|how you doing|how u doing)\b/)) return 'how';
  if (has(t, /\b(wyd|what are you doing|what r u doing|whatcha doing|what you doing|whats up|what's up|wassup|sup)\b/) && !has(t, /^ (sup|wassup) $/)) return 'doing';
  if (has(t, /\b(sad|upset|bad day|crying|lonely|stressed|annoyed|angry|mad at)\b/)) return 'sad';
  if (has(t, /\b(bored|boring|nothing to do)\b/)) return 'bored';
  if (has(t, /\b(school|homework|teacher|class|test|exam|math)\b/)) return 'school';
  if (has(t, /\b(thanks|thank you|thx|ty|tysm)\b/)) return 'thanks';
  if (has(t, /\b(bye|cya|gtg|got to go|gotta go|goodnight|good night|gn|later|see ya|see you)\b/)) return 'bye';
  if (has(t, /^ (hi|hey|hello|yo|sup|wassup|hii+|heyy+|ello|hola|howdy) /)) return 'greeting';
  if (has(t, /^ ?(lol|lmao|haha+|lmfao|xd|rofl|hehe) ?$/)) return 'laugh';
  if (has(t, /^ ?(yes|yeah|yea|yep|ok|okay|k|sure|bet|alright|sounds good) ?$/)) return 'yes';
  if (has(t, /^ ?(no|nah|nope|not really|maybe later) ?$/)) return 'no';
  if (t.includes('?')) return 'question';
  return 'unknown';
};

/** Lowercasing, dropped punctuation and the odd abbreviation, by personality. */
const style = (text: string, p: Personality, rand: () => number): string => {
  let s = text;
  if (p === 'chill' || p === 'funny' || (p === 'sweaty' && rand() < 0.7)) s = s.toLowerCase();
  if (p !== 'friendly' && rand() < 0.6) s = s.replace(/[.,]$/, '');
  if (rand() < 0.25) s = s.replace(/\byou\b/g, 'u').replace(/\byour\b/g, 'ur').replace(/\bright now\b/g, 'rn');
  if (p === 'hype' && rand() < 0.3 && /[a-z0-9]$/i.test(s)) s += '!!';
  if (p === 'chill' && rand() < 0.15) s += ' lol';
  return s;
};

const fill = (line: string, c: ChatContext): string =>
  line
    .replace(/\{gun\}/g, c.favorite)
    .replace(/\{mode\}/g, c.favoriteMode)
    .replace(/\{level\}/g, String(c.level))
    .replace(/\{name\}/g, c.playerName)
    .replace(/\{theirgun\}/g, c.memory.theirGun ?? 'that');

const fromBank = (bank: Bank, c: ChatContext): string => {
  const own = bank[c.personality];
  const pool = own && c.rand() < 0.6 ? own : bank.any;
  // Avoid repeating a line said in the last few messages.
  const fresh = pool.filter((l) => !c.memory.used.includes(l));
  const line = pick(fresh.length ? fresh : pool, c.rand);
  c.memory.used = [...c.memory.used.slice(-12), line];
  return style(fill(line, c), c.personality, c.rand);
};

/** The bot's answer to one message (null: it doesn't answer, like a real person sometimes doesn't). */
export const replyTo = (message: string, c: ChatContext): BotReply | null => {
  const intent = intentOf(message);
  const m = c.memory;
  const t = message.toLowerCase();
  if (intent === 'rude') m.rude++;
  else if (intent !== 'laugh') m.rude = 0;
  for (const g of GUNS) if (t.includes(g) && /\b(my|i use|i main|i like)\b/.test(t)) m.theirGun = g;
  for (const md of MODES) if (t.includes(md) && /\b(i like|my fav|i play)\b/.test(t)) m.theirMode = md;
  m.lastIntent = intent;
  if ((intent === 'laugh' || intent === 'unknown') && c.rand() < 0.25) return null;
  switch (intent) {
    case 'invite': {
      if (c.busy) return { text: fromBank(LINES.inviteBusy, c) };
      const mode = MODES.find((md) => t.includes(md)) ?? m.theirMode ?? c.favoriteMode;
      return { text: fromBank(LINES.inviteYes, c), invite: { mode } };
    }
    case 'duel':
      return { text: fromBank(LINES.duel, c), invite: c.busy ? undefined : { mode: 'duel' } };
    case 'rude':
      return { text: fromBank(m.rude >= 3 ? LINES.rudeAgain : LINES.rude, c) };
    case 'bored':
      return { text: fromBank(LINES.bored, c), invite: c.busy || c.rand() < 0.5 ? undefined : { mode: c.favoriteMode } };
    default:
      return { text: fromBank(LINES[intent] ?? LINES.unknown, c) };
  }
};

/** A message a bot sends on its own: an opener, or a reaction to a match you played together. */
export const opener = (c: ChatContext): BotReply => ({ text: fromBank(OPENERS, c), invite: c.rand() < 0.6 ? { mode: c.favoriteMode } : undefined });
export const afterMatch = (won: boolean, c: ChatContext): BotReply => ({ text: fromBank(AFTER_MATCH[won ? 'won' : 'lost'], c) });

/** How long a bot "types" before a reply lands: longer messages take longer, with a human pause first. */
export const typingDelay = (text: string, rand: () => number): number => 900 + rand() * 1800 + text.length * (55 + rand() * 40);
