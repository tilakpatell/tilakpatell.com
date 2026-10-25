// A planet of the universe map's Rick and Morty sector, played on its own
// (#/c-137/<id>, pages/RmPlanet.jsx): RmWorld starts Morty at the planet's way
// in, its own portal takes him back out to space, and the HUD is about that
// planet only. Pure: whether an address is a planet's, what the world needs to
// know about the planet, what's next there, and what the HUD says.

import { byId } from '../../universe/universes';
import { DIAL, GAME_SPOTS, destinationById, isPlanet, planetStart } from './dimensions/destinations';
import { TASKS, hintOf, progress } from './rules';

export const WAY_HOME = 'Back to space';
export const ALL_DONE_HERE = 'All done here. Back through the portal to space.';

// a place's name inside a sentence ('The Purge Planet' → 'the Purge Planet')
export const inLine = (name) => name.replace(/^The /, 'the ');

// the planet Morty's landed on, if `id` is one: where he starts (its way in,
// facing in), where its portal home is, its name, note and things to do
export function planetOf(id) {
  const at = planetStart(id);
  if (!at) return null;
  const d = destinationById(id);
  return { id, ...at, back: { x: d.back.x, z: d.back.z }, name: d.name, note: d.note, tasks: d.tasks };
}

// the page at a planet's address (#/c-137/<id>, pages/RmPlanet.jsx): the planet,
// if it's one of the sector's ten on the universe map; else null, and the page
// goes to C-137
export function planetPage(id) {
  if (byId(id)?.kind !== 'moon' || !isPlanet(id)) return null;
  const d = destinationById(id);
  return { id, name: d.name, note: d.note, space: `/universe/${id}` };
}

// a planet's hint, once he's on it: without the landing ('Land on Pluto in
// the Rick and Morty sector, and step up…' → 'Step up…')
const GUN = new Set(DIAL.filter((d) => isPlanet(d.id)).map((d) => d.name));
const onTheGun = (hint) => hint.replace(/^Land on (.+?) in the Rick and Morty sector, (?:and )?/, (all, name) => (GUN.has(name) ? `Dial ${name} on the portal gun (or land on it from the universe map), ${all.endsWith('and ') ? 'and ' : ''}` : all));
export const hereHint = (hint) => hint.replace(/^Land (?:on|at) .+? in the Rick and Morty sector, (?:and )?/, '').replace(/^./, (c) => c.toUpperCase());

// what's done and what's next, there: everything counts as it does in C-137,
// but what's next is the planet's own first thing not done, and once
// they're all done, the way home
export function planetProgress(planet, done = []) {
  const next = planet.tasks.find((t) => !done.includes(t.id)) ?? null;
  return { ...progress(done), next, objective: next ? hereHint(next.hint) : ALL_DONE_HERE };
}

// the way out of the game: back to space by the planet (in the planet's place
// in the history, so Back from the map doesn't land him on it again), or back
// to the site
export const backLink = (planet) => (planet ? { to: `/universe/${planet.id}`, label: WAY_HOME, replace: true } : { to: '/', label: 'Back to the site', replace: false });

// the list (M): in C-137, every thing to do with where to go for it; on a
// planet, its own things to do as said there, and one line for the rest. On
// `touch`, a row whose hint names a key says its buttons instead (hintOf)
export function listOf(planet, done = [], { touch = false } = {}) {
  const row = (t, hint) => ({ id: t.id, name: t.name, hint, done: done.includes(t.id) });
  // (in C-137 the four planets on the gun are dialled too: their rows say so)
  if (!planet) return { label: 'Things to do in Dimension C-137', rows: TASKS.map((t) => row(t, onTheGun(hintOf(t, touch)))), rest: null };
  const { count, total } = progress(done);
  return { label: `Things to do on ${inLine(planet.name)}`, rows: planet.tasks.map((t) => row(t, hereHint(hintOf(t, touch)))), rest: `${count} of ${total} done in all, with Dimension C-137’s.` };
}

// what a press at a game's own spot does now (`done` the tasks done; `deal`
// and `find` the stage's snapshots, from playOf): once its game's task is
// done, it only says its line (a look, or a talk where someone stands); a
// thing seen clean or chanced, or a Jerry heard and not ruled out, is taken
// by it (the game's own `take`); a thing taken or seen cursed, or a Jerry
// ruled out, only says its line too; else the spot's own verb
function verbOf(p, { done, deal, find }) {
  const g = GAME_SPOTS[p.id];
  if (!g) return p.verb;
  if (done.includes(g.task)) return g.rest;
  if (g.game === 'deal' && deal?.phase === 'run' && deal.seen[p.id]) return deal.taken.includes(p.id) || deal.seen[p.id] === 'bad' ? g.rest : g.take;
  if (g.game === 'find' && find?.phase === 'run' && find.heard.includes(p.id)) return find.wrong.includes(p.id) ? g.rest : g.take;
  return p.verb;
}

// what relabel reads of the game a prompt's at, for its press: the deal's
// snapshot at one of its things, the find's at one of its people, nothing
// anywhere else (`act`: the world's api.act)
export function playOf(p, act) {
  const g = p?.kind === 'spot' ? GAME_SPOTS[p.id] : null;
  return g?.take ? { [g.game]: act(g.area, g.game) ?? null } : {};
}

// the prompt as the HUD shows it: the garage portal naming where it's dialled,
// a planet's own portal the way back to space, Rick's bench at the story's
// last step (`bench`) what its press does then, a game's own spot what its
// press does now (verbOf); anything else as it is
export function relabel(p, { planet = null, portal = null, bench = false, done = [], deal = null, find = null } = {}) {
  if (bench && p?.kind === 'spot' && p.id === 'dial') return { ...p, name: 'The portal gun, back on Rick’s bench', verb: 'Put it back' };
  if (p?.kind === 'spot') {
    const verb = verbOf(p, { done, deal, find });
    return verb === p.verb ? p : { ...p, verb };
  }
  if (!p || p.kind !== 'link') return p;
  if (planet && p.id === `${planet.id}-portal`) return { ...p, name: WAY_HOME };
  if (portal && p.id === 'garage-portal') return { ...p, name: portal };
  return p;
}

// how far out any area reaches from the middle, in metres (others online are
// clamped to it: it has to reach the furthest of the places past the portal)
export const boundOf = (areas) => Math.ceil(Math.max(...Object.values(areas).flatMap((a) => [a.x0, a.x1, a.z0, a.z1].map(Math.abs))));
