// Who you deploy as, from a galactic assault's spawn screen (AssaultHud.jsx's
// offer, ./points.js's): the choice pages/GalaxySurface.jsx wears, as the
// Loadout panel's pick is (heroes.js's readHero), a trooper in the world's
// own kit (its `body`: a snowtrooper on Hoth). A class or an enforcer is
// kept as your loadout; a hero bought for Battle Points is worn for that
// life only, and the class you were goes back on when they go down. Pure.
//
//   deployPick(offer, was, ship) → { next (the choice), keep (kept as the loadout, or not) }

import { readHero } from '../../heroes';

export function deployPick(offer, was = null, ship = 'xwing') {
  // (the same pick again keeps what's on it: a gun, its mods, the perks)
  const same = was?.id === offer.heroId ? was : {};
  const next = readHero({ ...same, id: offer.heroId, ...(offer.body ? { kind: offer.body } : {}) }, ship);
  return { next, keep: offer.kind !== 'hero' };
}
