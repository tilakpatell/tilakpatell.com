// A duel's hearts on the site's one health scale (the HUD kit's Vitals, 100
// on foot, as the universe's and the galaxy's are): a heart is 100 ÷ hearts,
// rounded up, so Morty's three are 100 and a hit takes 34; low on the last
// one. An enemy keeps its hits, as an enemy should, shown as the share of
// them it has left. Pure, tested.
//
//   heartsToHealth(hp, max) → { value, max: 100, low }
//   enemyShare(hp, max) → 0–100

const FULL = 100;
const whole = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function heartsToHealth(hp, max) {
  const of = whole(max);
  if (!of) return { value: FULL, max: FULL, low: false };
  const left = Math.min(of, whole(hp));
  const value = Math.max(0, FULL - (of - left) * Math.ceil(FULL / of));
  return { value, max: FULL, low: left <= 1 };
}

export const enemyShare = (hp, max) => (whole(max) ? Math.round((Math.min(whole(max), whole(hp)) / whole(max)) * FULL) : FULL);
