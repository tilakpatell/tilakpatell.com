// The bodies a person may walk in, best first, for a figure whose file may
// not arrive (a 2017 hero's body lives in the asset bucket alone: a build
// with no bucket base asks the site, which has none, and gets a 404). A
// pick is never refused for that: the hero's own body, else the site's
// committed figure of them (Meshy's, for Luke, Han, Leia, Vader and the
// Emperor), else a trooper of their side on the game's skeleton, whose
// light cut the site always carries.
//
//   STAND_INS                   lean → the trooper kind that stands in
//   bodiesFor(spec, hero)       [{ spec, stoodIn }]: the specs to try, in order (stoodIn null, 'meshy', 'standin')
//   firstBody(tries, load)      → { fig, stoodIn } | null: the first that loads
//   standInLine(name, stoodIn)  the toast's line for it

import { CREW } from './crewList';

export const STAND_INS = { light: 'rebel', dark: 'stormtrooper' };

export function bodiesFor(spec, hero = null) {
  const tries = [{ spec, stoodIn: null }];
  if (spec?.rig !== 'walrus' || !hero) return tries;
  if (hero?.fallback) {
    tries.push({ spec: { ...spec, src: { url: hero.fallback }, rig: undefined, pack: undefined }, stoodIn: 'meshy' });
  }
  const kind = STAND_INS[hero?.lean] ?? STAND_INS.light;
  const row = CREW[kind];
  if (row) tries.push({ spec: { ...spec, src: { url: row.url }, tall: row.tall, rig: 'walrus', pack: null }, stoodIn: 'standin' });
  return tries;
}

export async function firstBody(tries, load) {
  for (const t of tries) {
    const fig = await Promise.resolve()
      .then(() => load(t.spec))
      .catch((e) => {
        if (e?.name === 'AbortError') throw e;
        return null;
      });
    if (fig) return { fig, stoodIn: t.stoodIn };
  }
  return null;
}

export const standInLine = (name, stoodIn) => (stoodIn === 'meshy' ? `${name}, in the site’s own figure: the game’s body didn’t arrive.` : stoodIn === 'standin' ? `${name}, stood in by a trooper: the game’s body didn’t arrive.` : null);
