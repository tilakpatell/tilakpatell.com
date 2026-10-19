// The One Ring, pure (the design’s §5): put on, the world drains into the
// wraith-world (`vision`, 0…1, in 0.4 s) and the Eye comes closer
// (`dread`, 0…1, in 40 s); taken off, both go back, the dread at half its
// pace. At dread 1 it is torn off: `torn` is true on that step alone, and
// it can’t go on again for COOLDOWN seconds.
//
//   newRing() → { worn, vision, dread, torn, cooldown }
//   wear(ring, on) → the ring put on or taken off (on refused while it cools)
//   stepRing(ring, dt) → the next
//   canWear(ring) → may it go on

export const VISION = 2.5; // a second
export const DREAD_UP = 1 / 40;
export const DREAD_DOWN = 1 / 20;
export const COOLDOWN = 8; // s after it is torn off

const clamp = (v) => Math.min(1, Math.max(0, v));

export const newRing = () => ({ worn: false, vision: 0, dread: 0, torn: false, cooldown: 0 });
export const canWear = (r) => r.cooldown <= 0;
export const wear = (r, on) => ({ ...r, worn: Boolean(on) && canWear(r) });

export function stepRing(r, dt) {
  const vision = clamp(r.vision + (r.worn ? 1 : -1) * VISION * dt);
  const dread = clamp(r.dread + (r.worn ? DREAD_UP : -DREAD_DOWN) * dt);
  const cooldown = Math.max(0, r.cooldown - dt);
  if (r.worn && dread >= 1) return { worn: false, vision, dread, torn: true, cooldown: COOLDOWN };
  return { worn: r.worn, vision, dread, torn: false, cooldown };
}
