/**
 * Equipment beyond guns: throwables (one lethal, one tactical per loadout)
 * and perks (pick three). Shared by the simulation and the loadout menu.
 */
export type ThrowableId = 'frag' | 'molotov' | 'tknife' | 'spear' | 'flash' | 'smoke';

export interface ThrowableDef {
  id: ThrowableId;
  name: string;
  slot: 'lethal' | 'tactical';
  /** How many you spawn with. */
  count: number;
  /** Launch speed (m/s). */
  speed: number;
  blurb: string;
}

export const THROWABLES: Record<ThrowableId, ThrowableDef> = {
  frag: { id: 'frag', name: 'Frag Grenade', slot: 'lethal', count: 2, speed: 17, blurb: 'Bounces, then explodes after 2.4 s.' },
  molotov: { id: 'molotov', name: 'Molotov', slot: 'lethal', count: 1, speed: 16, blurb: 'Shatters on impact and sets the ground on fire for 7 s.' },
  tknife: { id: 'tknife', name: 'Throwing Knife', slot: 'lethal', count: 2, speed: 32, blurb: 'A fast, flat throw. One hit kills, and it sticks.' },
  spear: { id: 'spear', name: 'Spear', slot: 'lethal', count: 1, speed: 25, blurb: 'Heavy and slow with a big arc. Pins whoever it hits.' },
  flash: { id: 'flash', name: 'Flashbang', slot: 'tactical', count: 2, speed: 18, blurb: 'Blinds anyone looking at it for a few seconds.' },
  smoke: { id: 'smoke', name: 'Smoke Grenade', slot: 'tactical', count: 1, speed: 16, blurb: 'A thick cloud for 14 s that nobody can see through.' }
};

export const LETHALS: ThrowableId[] = ['frag', 'molotov', 'tknife', 'spear'];
export const TACTICALS: ThrowableId[] = ['flash', 'smoke'];

export type PerkId = 'ghost' | 'quickhands' | 'marathon' | 'ninja' | 'lightweight' | 'scavenger' | 'hardline' | 'coldblooded' | 'flakjacket' | 'steadyaim' | 'tacmask';

export interface PerkDef {
  id: PerkId;
  name: string;
  blurb: string;
}

export const PERKS: PerkDef[] = [
  { id: 'ghost', name: 'Ghost', blurb: 'Hidden from enemy UAVs, and firing never shows you on their minimap.' },
  { id: 'quickhands', name: 'Quick Hands', blurb: 'Reload 35% faster and swap weapons 40% faster.' },
  { id: 'marathon', name: 'Marathon', blurb: 'Sprint 10% faster and slide further.' },
  { id: 'ninja', name: 'Ninja', blurb: 'Silent footsteps, even when sprinting.' },
  { id: 'lightweight', name: 'Lightweight', blurb: 'Move 7% faster with any weapon.' },
  { id: 'scavenger', name: 'Scavenger', blurb: 'Kills refill your ammo and give back a lethal.' },
  { id: 'hardline', name: 'Hardline', blurb: 'Killstreaks need one kill fewer.' },
  { id: 'coldblooded', name: 'Cold-Blooded', blurb: 'Enemies take longer to lock on to you.' },
  { id: 'flakjacket', name: 'Flak Jacket', blurb: 'Take 55% less damage from explosives and fire.' },
  { id: 'steadyaim', name: 'Steady Aim', blurb: 'Tighter hip-fire spread.' },
  { id: 'tacmask', name: 'Tactical Mask', blurb: 'Flashbangs barely affect you.' }
];

export const PERK_SLOTS = 3;
export const DEFAULT_PERKS: PerkId[] = ['quickhands', 'ninja', 'steadyaim'];

export const perkDef = (id: PerkId): PerkDef => PERKS.find((p) => p.id === id) ?? PERKS[0];

/** A valid pick of three perks (bad or incomplete picks fall back to the defaults). */
export const normalizePerks = (ids: readonly string[] | undefined): PerkId[] => {
  const valid = (ids ?? []).filter((id, i, all): id is PerkId => PERKS.some((p) => p.id === id) && all.indexOf(id) === i).slice(0, PERK_SLOTS);
  return valid.length === PERK_SLOTS ? valid : DEFAULT_PERKS.slice();
};

export const hasPerk = (a: { perks: readonly PerkId[] }, p: PerkId): boolean => a.perks.includes(p);
