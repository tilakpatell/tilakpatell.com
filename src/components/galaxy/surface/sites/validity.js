// Can a world be played as written? Pure checks on a siteOf() result: the
// quests' enemies stand somewhere they can walk from, near enough to reach
// you, and nobody named is there twice. validity.test.js runs them over every
// site; the layout tasks lean on the same helpers.
import { makeHeight } from '../terrain';

// the site's own ground, with its flats and pits dug in (siteOf gathers them
// on `ground`, so the whole of what the player walks on)
export const heightFor = (site) => makeHeight({ ...site.ground, flats: site.ground.flats, pits: site.ground.pits });

const heights = new WeakMap();
const groundOf = (site) => {
  let h = heights.get(site);
  if (!h) heights.set(site, (h = heightFor(site)));
  return h;
};

// What stands over the water on a floor of its own, which the height field
// knows nothing about: Kamino's landing pads, round decks on stilts (props/core.js
// kpad, r its opts.r, 28 when it says nothing). The thing's y is the deck.
const FLOOR_KINDS = { kpad: (t) => t.opts?.r ?? 28 };

const onDeck = (site, [x, z]) => (site.things_all ?? []).some((t) => FLOOR_KINDS[t.kind] && Math.hypot(x - t.at[0], z - t.at[1]) <= FLOOR_KINDS[t.kind](t) && (t.y ?? 0) >= (site.water?.level ?? 0) + 0.2);

// Dry enough to stand on: at least 0.2 m over the water (so the swell and the
// beach's wet edge don't count), or, for something that wades, no deeper than
// `wade` under it; or on a deck built over it. A world with no water is
// standable everywhere.
export function standable(site, [x, z], { wade = 0 } = {}) {
  const level = site.water?.level;
  if (level == null) return true;
  const y = groundOf(site)(x, z);
  if (wade > 0 ? y >= level - wade : y >= level + 0.2) return true;
  return onDeck(site, [x, z]);
}

const giverAt = (site, id) => site.life?.find((l) => l.id === id)?.at;

// The spawns that don't work: an enemy under water, or one tethered too
// short to ever come at you where the step wants you.
export function spawnProblems(site) {
  const out = [];
  for (const q of site.quests ?? []) {
    // a step with no `at` of its own happens where the last one took you
    // (a shoot step after a reach step), and before any, at the giver
    let here = giverAt(site, q.giver);
    for (const [i, st] of q.steps.entries()) {
      // (a place you go into, and a spawn on a floor, stand on a floor, not the ground)
      if (st.zone) continue;
      if (st.at) here = st.at;
      if (!st.spawn) continue;
      for (const sp of [].concat(st.spawn)) {
        if (!sp.hostile || sp.side === 'yours' || sp.level != null) continue;
        const tag = `${q.id}/${sp.tag ?? st.tag ?? sp.kind ?? i}`;
        const [x, z] = sp.at;
        if (!standable(site, sp.at, { wade: sp.wade ? 0.8 : 0 })) {
          const depth = groundOf(site)(x, z) - site.water.level;
          out.push(`${tag}: under water at [${x}, ${z}] (${depth.toFixed(1)} m)`);
          continue;
        }
        const target = here;
        if (!target || st.respawn) continue;
        // 6 m is where the fight can reach you from; a spawn's leash is how
        // far it strays, plus the range it shoots across from there
        const need = Math.hypot(sp.at[0] - target[0], sp.at[1] - target[1]) - 6;
        const leash = sp.leash ?? (sp.roam ?? 8) + 10 + (sp.hostile.range ?? 30);
        if (need > leash) out.push(`${tag}: leash ${Math.round(leash)} m, ${Math.round(need)} m to go`);
      }
    }
  }
  return out;
}

// Names that appear twice in one scene when one of them is a person the story
// depends on (marked `named`: every quest giver who is a someone carries it; a
// giver who is only a role, a Wing Guard among Wing Guards, doesn't). The same person in two
// places is fine when the places are different scenes (the surface, a zone you
// go into), so each is counted on its own.
export function namedTwice(site) {
  const life = (site.life ?? []).filter((l) => l.name);
  const scenes = new Map();
  for (const l of life) {
    const key = `${l.zone ?? ''}|${l.name}`;
    scenes.set(key, [...(scenes.get(key) ?? []), l]);
  }
  const out = [];
  for (const group of scenes.values()) {
    if (group.length < 2) continue;
    if (group.some((l) => l.named)) out.push(`${group[0].name}: ${group.length} times${group[0].zone ? ` (in ${group[0].zone})` : ''}`);
  }
  return out;
}

// A site's districts whose pack has no level.json (`has(level)` says whether
// public/models/galaxy/bf2017/levels/<level>/level.json is committed)
export function districtProblems(site, has) {
  return (site.districts ?? []).filter((d) => !d.level || !has(d.level)).map((d) => `${d.id}: no pack at levels/${d.level}/level.json`);
}

