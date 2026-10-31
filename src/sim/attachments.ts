import { WEAPONS, type WeaponDef, type WeaponId } from './weapons';

/**
 * Weapon attachments: four slots per gun, each unlocked by kills with that
 * gun. Every one is a trade or a small edge, never a straight upgrade.
 */
export type AttachSlot = 'optic' | 'muzzle' | 'mag' | 'grip';
export type AttachSet = Partial<Record<AttachSlot, string>>;
export type AttachChoice = Partial<Record<string, AttachSet>>;

export interface AttachmentDef {
  id: string;
  name: string;
  slot: AttachSlot;
  /** Kills with the gun to unlock it. */
  kills: number;
  blurb: string;
  apply: (w: WeaponDef) => WeaponDef;
  /** Guns it doesn't fit. */
  not?: (w: WeaponDef) => boolean;
}

const scoped = (w: WeaponDef) => w.scope;
const shotgun = (w: WeaponDef) => w.pellets > 1;

export const ATTACHMENTS: AttachmentDef[] = [
  { id: 'reddot', name: 'Red Dot', slot: 'optic', kills: 10, blurb: 'A clean dot to aim with: 15% tighter while aiming.', apply: (w) => ({ ...w, adsSpread: w.adsSpread * 0.85, optic: 'reddot' }), not: scoped },
  { id: 'holo', name: 'Holographic', slot: 'optic', kills: 30, blurb: 'A ring sight with a little more zoom.', apply: (w) => ({ ...w, adsSpread: w.adsSpread * 0.9, adsFov: w.adsFov + 6, optic: 'holo' }), not: scoped },
  { id: 'comp', name: 'Compensator', slot: 'muzzle', kills: 25, blurb: '25% less recoil.', apply: (w) => ({ ...w, recoil: w.recoil * 0.75 }) },
  { id: 'suppressor', name: 'Suppressor', slot: 'muzzle', kills: 80, blurb: 'Quiet, and firing doesn’t show you on enemy minimaps. Damage drops off 15% sooner.', apply: (w) => ({ ...w, suppressed: true, falloffStart: w.falloffStart * 0.85, falloffEnd: w.falloffEnd * 0.85 }) },
  { id: 'extmag', name: 'Extended Mag', slot: 'mag', kills: 40, blurb: '50% more rounds, 15% slower reload.', apply: (w) => ({ ...w, magazine: Math.round(w.magazine * 1.5), reload: w.reload * 1.15 }) },
  { id: 'fastmag', name: 'Fast Mag', slot: 'mag', kills: 120, blurb: 'Reload 25% faster.', apply: (w) => ({ ...w, reload: w.reload * 0.75 }) },
  { id: 'vgrip', name: 'Vertical Grip', slot: 'grip', kills: 60, blurb: '20% steadier while moving.', apply: (w) => ({ ...w, spreadMoving: w.spreadMoving * 0.8 }), not: shotgun },
  { id: 'laser', name: 'Laser', slot: 'grip', kills: 150, blurb: '15% tighter hip fire, and a visible beam.', apply: (w) => ({ ...w, spreadStill: w.spreadStill * 0.85, laser: true }) }
];

export const SLOT_NAMES: Record<AttachSlot, string> = { optic: 'Optic', muzzle: 'Muzzle', mag: 'Magazine', grip: 'Grip' };

export const attachmentDef = (id: string | undefined) => ATTACHMENTS.find((a) => a.id === id);

/** What fits a gun (the knife takes nothing). */
export const fits = (a: AttachmentDef, gun: WeaponId): boolean => gun !== 'knife' && WEAPONS[gun].slot !== 'melee' && !a.not?.(WEAPONS[gun]);

/** A gun's stats with its attachments applied. */
export const modded = (gun: WeaponId, set: AttachSet | undefined): WeaponDef => {
  let w = WEAPONS[gun];
  if (!set) return w;
  for (const id of Object.values(set)) {
    const a = attachmentDef(id);
    if (a && fits(a, gun)) w = a.apply(w);
  }
  return w;
};

/** Per-agent weapon stats for everything they carry (only the guns with attachments). */
export const moddedDefs = (weapons: WeaponId[], choice: AttachChoice | undefined): Partial<Record<WeaponId, WeaponDef>> | undefined => {
  if (!choice) return undefined;
  const out: Partial<Record<WeaponId, WeaponDef>> = {};
  for (const w of weapons) if (choice[w] && Object.values(choice[w]!).some(Boolean)) out[w] = modded(w, choice[w]);
  return Object.keys(out).length ? out : undefined;
};
