// How each crew member is styled, wherever they walk: an outfit, a blade
// (its colour and hilt) and the gun in their hand. One small save for the
// whole site (`tp-crew`, versioned, through runtime/saves.js): the Hangar's
// Crew and Arms write it, the galaxy's worlds dress the hero picked by it and
// write back what their deploy panel changes. Shape only: every reader
// checks the ids against its own tables (heroes.js's skins, blades and
// hilts; the guns' table), so an id one world doesn't know is ignored there,
// never believed. Rick, Morty, Walt and Jesse's looks are the Wardrobe's
// (tp-wardrobe); here it's only their gun. Pure, tested.
//
//   CREW_KEY, CREW_VERSION, CREW_WHO
//   readCrew(raw) → { [who]: { skin?, saber?: { color, hilt }, gun? } }   (a JSON string, an object or junk)
//   styleOf(crew, who) → the entry, or {}
//   setStyle(crew, who, patch) → a new crew (null in the patch takes that field off)
//   seedFromHero(crew, hero) → crew, with the galaxy's picked hero copied in if they have no entry yet
//   registerCrew(saves)

export const CREW_KEY = 'tp-crew';
export const CREW_VERSION = 1;
export const CREW_WHO = ['luke', 'artoo', 'han', 'chewie', 'rick', 'morty', 'walt', 'jesse'];

const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 40;
const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const readSaber = (v) => (isObject(v) && isId(v.color) && isId(v.hilt) ? { color: v.color, hilt: v.hilt } : null);
const readEntry = (v) => {
  if (!isObject(v)) return null;
  const out = {};
  if (isId(v.skin)) out.skin = v.skin;
  const saber = readSaber(v.saber);
  if (saber) out.saber = saber;
  if (isId(v.gun)) out.gun = v.gun;
  return Object.keys(out).length ? out : null;
};

export function readCrew(raw) {
  let v = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      v = null;
    }
  }
  const out = {};
  if (!isObject(v)) return out;
  for (const who of CREW_WHO) {
    const e = readEntry(v[who]);
    if (e) out[who] = e;
  }
  return out;
}

export const styleOf = (crew, who) => (isObject(crew?.[who]) ? crew[who] : {});

export function setStyle(crew, who, patch) {
  if (!CREW_WHO.includes(who) || !isObject(patch)) return crew;
  const next = { ...styleOf(crew, who) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete next[k];
    else next[k] = v;
  }
  const e = readEntry(next);
  const out = { ...crew };
  if (e) out[who] = e;
  else delete out[who];
  return out;
}

export function seedFromHero(crew, hero) {
  const who = hero?.id;
  if (!CREW_WHO.includes(who) || crew?.[who]) return crew;
  const e = readEntry({ skin: hero.skin, gun: hero.gun, saber: hero.color && hero.hilt ? { color: hero.color, hilt: hero.hilt } : null });
  return e ? { ...crew, [who]: e } : crew;
}

// (version 1 is the first: nothing older to bring up)
export const registerCrew = (saves) => saves?.register({ key: CREW_KEY, version: CREW_VERSION, migrate: (old) => old });
