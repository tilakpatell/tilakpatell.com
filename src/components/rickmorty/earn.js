// What Rick and Morty's deeds pay into the one wallet (the universe's
// economy.js, through useRmEarn.js, side 'rickmorty'): each deed is a key the
// wallet already has. What can be done only once (a C-137 task, a Citadel
// quest, a big planet's quest or place) carries a once-key, so the ledger
// that's seeded from the saves pays it only once; a fight won pays every
// time. Pure, tested.
//
//   RM_EARN                      deed → the wallet's EARN key
//   earnOf(deed, id, where?)     → { what, once (string or null) } or null
//   seedsOf(deed, ids, where?)   → the once-keys of what's already done

export const RM_EARN = {
  task: 'questDone', // a C-137 task (RmWorld)
  citadel: 'questDone', // a Citadel quest (CitadelWorld)
  quest: 'questDone', // a big planet's quest (RmSurface)
  found: 'found', // a big planet's place found
  duel: 'killAce', // a duel won (Evil Rick, the Blood Dome)
  parasite: 'killPirate', // a Total Rickall parasite
  boss: 'killCapital', // a Portal panic boss
  patrol: 'killHunter', // the street's Federation patrol, shot down
};

const ONCE = { task: (id) => `task:${id}`, citadel: (id) => `citadel:${id}`, quest: (id, where) => `quest:${where}:${id}`, found: (id, where) => `found:${where}:${id}` };

export function earnOf(deed, id = null, where = null) {
  const what = RM_EARN[deed];
  if (!what) return null;
  if (!ONCE[deed]) return { what, once: null };
  if (typeof id !== 'string' || !id) return null;
  return { what, once: ONCE[deed](id, where) };
}

export const seedsOf = (deed, ids, where = null) => (Array.isArray(ids) ? ids.map((id) => earnOf(deed, id, where)?.once).filter(Boolean) : []);
