// The worlds you can land on, from the ground: one site for each of the
// galaxy's systems with a planet you can stand on (Alderaan's gone; the
// rest are all here). A site is data: the scene (surface/scene.js) builds
// it, the page (pages/GalaxySurface.jsx) names it, and the tests check it.
//
//   place, line    where you've come down, and a line about it
//   sky            sky.js's: the colours, the sun or suns, clouds, stars,
//                  what hangs in the sky
//   fog            { color, density } (exponential: thick or thin air)
//   light          { sun, second?, sky, ground, ambient }: the sun's
//                  strength (and a second sun's), the sky's and the
//                  ground's colours for the light from all round
//   ground         terrain.js's layers and flats, ground.js's palette;
//                  wind (radians) for ripples and blowing sand
//   water          { level, color, deep, kind: sea | swamp | lava | salt |
//                  clouds, wade? } or left out
//   weather        weather.js's: [{ kind, count? }]
//   land           { at: [x, z], yaw }: where your ship sets down
//   places         what there is to find: { id, name, at, r (you've found
//                  it within this), about, flat? { r, h?, edge? }, pits?
//                  [{ at, r, depth, cone? }] (relative to it), things
//                  (placed relative to it) }
//   things         placed things (placer.js's specs), at world positions
//   scatter        [{ kind, n, within: [r0, r1], scale: [a, b], solid?,
//                  opts?, flat? (on level ground only), at? (the middle
//                  of its ring, the world's 0, 0 unless said: a stand
//                  round a place, its clearing kept) }]
//   places' city   a place that is a city says how its streets go (city.js's
//                  cityOf: plan, r, street, block, plaza, kit (kinds, or
//                  { kind, weight, scale, face }), lamps, clutter, crowd,
//                  traffic): its buildings, lamps and clutter laid as
//                  scatter rows (instanced, each building solid over its
//                  footprint, footprints.json), its crowd and traffic added
//                  to the life, its flat widened to the city's, its own
//                  things, its people and its quests' spots kept clear
//   flora          { biome, tint?, density?, trees?, living? }: the nature
//                  kit's cover, middle layer and trees by a recipe
//                  (flora.js), its rows added after the scatter's own (or
//                  streamed round you, living.js); and its biome's `air`:
//                  pollen after the weather's own, and `air` { song,
//                  flocks } (sounds.js's birdsong, flocks.js's birds)
//   life           actors.js's
//   rides          [{ kind (rides.js's), at, yaw }]
//   flyovers       [{ kind (a galaxy ship), n, metres, alt, speed, every }]
//   skyships       [{ kind, metres, at: [x, y, z], yaw }]: hanging in the sky
//   floors         walker.js's, over the land (platforms, walkways)
//   wants          needs.js's: where the people with `needs` go, and what
//                  they do there, [{ id, kind, at: [x, z], pause?, slots?,
//                  spots?, clip?, base?, face? }]
//   zones          places you go into: { id, name, door: { at, r, prompt },
//                  back: [x, z] (where you come out), inside: { build (a
//                  props kind), spawn, yaw, exit: { at, r }, bounds: [hw,
//                  hd, h], rooms?: [[x, z, hw, hd, floor, ceiling]…] (the
//                  camera keeps in the one you're in), light: { sky,
//                  ground, ambient, fog, density },
//                  lamps: [[x, y, z, color, intensity, distance]],
//                  fall?: a height (relative) below which you've fallen off
//                  what's in it, respawn?: [x, z] where you're put then }, life
//                  (as the site's, placed relative to the inside), things
//                  (placer specs, placed relative to the inside: a model
//                  in a room), wants (as the site's, placed relative to the
//                  inside: a cantina's bar) }
//   quests         quests.js's: things to do (talk to someone, get
//                  somewhere, pick things up, race, shoot, ride, use); a
//                  step's start and end: what happens then ({ signal (to
//                  what's built), floor / solid (a tag) + off, kill (a
//                  tag), hide / show (an actor's id), music, sound, shake,
//                  say, to: [x, z], leave }); respawn: where you're put if
//                  you go down in it; steps in a zone say `zone`, and their
//                  spots are its
//   reach          how far you can go (terrain.js's REACH unless said)
//   districts      more than one of the game's maps on one world (lane E0):
//                  [{ id, name, level (a pack: '<world>/<district>'),
//                  land: { at, yaw }, line, ground? (in place of the
//                  site's: an interior's flat floor), door? { at, r,
//                  prompt, to? (a district's id: the way back is to it,
//                  not the main map) } (the way back), zones? (its own
//                  doors: `to: { district }`), site? (any of the site's own
//                  rows in place: an interior's fog, no weather; another
//                  map's own people and things) }]; the route's
//                  ?district=<id>, a zone's door `to: { district }`, the
//                  system panel's "Land at" rows. The default (none, or an
//                  id the site lacks) is the site as written
//   fall           a world with nothing under its floors (Bespin, Coruscant,
//                  Kamino): how far down counts as falling off

import { SYSTEMS } from '../../systems';
import { REACH } from '../terrain';
import { airOf, floraRows } from '../flora';
import { cityOf, rowsOf } from './city';
import FOOT from './footprints.json';
import { SITES as desert } from './desert';
import { SITES as ice } from './ice';
import { SITES as forest } from './forest';
import { SITES as core } from './core';
import { SITE as coruscant } from './coruscant';
import { SITE as yavin } from './yavin';
import { SITE as bespin } from './bespin';
import { SITES as edge } from './edge';
import { SITES as outer } from './outer';
import { SITES as drop } from './drop';
import { SITES as prequels } from './prequels';
import { SITES as rebellion } from './rebellion';
import { SITES as shows } from './shows';
import { EXTRA } from './quests';
import { turnSite } from './turnSite';

export const SITES = { ...desert, ...ice, ...forest, yavin, ...core, coruscant, ...edge, bespin, ...outer, ...drop, ...prequels, ...rebellion, ...shows };

// the systems with somewhere to land, in the galaxy's own order
export const LANDABLE = SYSTEMS.filter((s) => SITES[s.id]).map((s) => s.id);
export const canLand = (id) => Boolean(SITES[id]);

// A site's district by id: one of its `districts`, else the site as it is
// (`main`), so an unknown id lands where the world always did
export function districtOf(site, id) {
  const d = id && site?.districts?.find((q) => q.id === id);
  return d ?? { id: 'main', level: site?.level, land: site?.land };
}

// The site as a district has it: its level, landing, place, line and ground
// (a ground layer drawn from the world's pack is the district's own pack's).
// The same site back for the default, so nothing is made again.
export function withDistrict(site, id) {
  const d = districtOf(site, id);
  if (d.id === 'main') return site;
  const layers = (site.ground?.layers ?? []).map((l) => (l.type === 'image' && l.pack === site.level ? { ...l, pack: d.level } : l));
  // (the world's own zones are the main map's; a district's are its own
  // `zones`, and its way back is its `door`: to the main map, or to the
  // district its `to` names, as a cellar's goes back up to its house)
  const back = d.door?.to ? site.districts.find((q) => q.id === d.door.to) : null;
  const out = d.door ? [{ id: `${d.id}-out`, name: back?.name ?? site.place, door: d.door, to: { district: back?.id ?? 'main' } }] : [];
  const zones = [...(d.zones ?? []), ...out];
  return { ...site, ...(d.site ?? {}), district: d.id, level: d.level, land: { ...site.land, ...d.land }, place: d.name ?? site.place, line: d.line ?? site.line, zones, ground: d.ground ? { ...site.ground, ...d.ground } : { ...site.ground, layers } };
}

const turn = ([x, z], yaw = 0) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
const minus = (a, b) => [a[0] - b[0], a[1] - b[1]];

// A place's city (city.js), laid in the place's frame: its kit's footprints
// from the table, its own things and the spots of the site's people and
// quests near it kept clear; then into the world, rows and life and flat.
const KEPT = 4; // metres kept round a person or a quest's spot
const SPREAD = 0.3; // the share of a crowd's spread kept clear round its middle
const STEP = 12; // metres at most kept round a quest's spot (a `reach` step's ring is wider: you walk in among the houses)
function cityIn(p, i, raw) {
  const spec = p.city;
  const kit = (spec.kit ?? []).map((k) => (typeof k === 'string' ? { kind: k } : k)).map((k) => ({ foot: FOOT[k.kind], ...k })).filter((k) => k.foot);
  const local = (at) => turn(minus(at, p.at), -(p.yaw ?? 0));
  const near = (at) => at && Math.hypot(at[0] - p.at[0], at[1] - p.at[1]) < spec.r + 20;
  const steps = (raw.quests ?? []).flatMap((q) => q.steps.filter((st) => !st.zone));
  const spots = [
    // (a crowd's middle, not all it roams: townsfolk walk the streets)
    ...(raw.life ?? []).filter((a) => !a.zone && near(a.at)).map((a) => ({ at: local(a.at), r: KEPT + (a.spread ?? 0) * SPREAD })),
    ...steps.filter((st) => near(st.at)).map((st) => ({ at: local(st.at), r: Math.min(STEP, Math.max(KEPT, st.r ?? 0)) })),
    ...steps.flatMap((st) => [].concat(st.spawn ?? [])).filter((sp) => near(sp.at)).map((sp) => ({ at: local(sp.at), r: KEPT + (sp.spread ?? 0) * SPREAD })),
    // (and the other places it reaches: a garden inside the walls)
    ...(raw.places ?? []).filter((q) => q !== p && near(q.at)).map((q) => ({ at: local(q.at), r: q.flat?.r ?? q.r * 0.6 })),
  ];
  const own = (p.things ?? []).map((t) => ({ at: t.at ?? [0, 0], r: FOOT[t.kind] ? (Math.hypot(FOOT[t.kind][0], FOOT[t.kind][1]) / 2) * (t.scale ?? 1) + 3 : 6 }));
  const built = cityOf({ ...spec, kit, marks: own, keep: [...own, ...spots, ...(spec.keep ?? [])] }, { seed: (raw.ground?.seed ?? 1) * 101 + i });
  const world = (q) => plus(p.at, turn(q, p.yaw));
  return {
    rows: [...rowsOf(built.things, FOOT), ...(built.rows ?? [])].map((r) => ({ ...r, items: r.items.map((it) => ({ ...it, at: world(it.at), yaw: it.yaw + (p.yaw ?? 0) })) })),
    life: built.life.map((a) => ({ ...a, path: a.path.map(world) })),
    flat: { ...(p.flat ?? {}), r: Math.max(p.flat?.r ?? 0, built.flat.r) },
    paving: built.paving.map((s) => (s.a ? { ...s, a: world(s.a), b: world(s.b) } : { ...s, at: world(s.at) })),
  };
}

// A galaxy site made whole, named for its system.
export function siteOf(id) {
  const base = SITES[id];
  if (!base) return null;
  // (with what quests.js adds: things to do where the world has none of its own)
  const more = EXTRA[id];
  const added = more ? { ...base, life: [...(base.life ?? []), ...more.life], quests: [...(base.quests ?? []), ...more.quests] } : base;
  // (every Star Wars world wears the game's own maps for its props' trims and
  // its ground's grain, lib/three/scans.js's bf2017 set, the owner's rule
  // that every texture here is the game's; a site says `scanned: 'cc0'` to
  // keep the photo scans. The galaxy's sites only: siteFrom serves others.)
  const raw = { ...added, look: { scanned: 'bf2017', ...(added.look ?? {}) } };
  const sys = SYSTEMS.find((s) => s.id === id);
  return siteFrom(raw, id, { name: sys?.name, accent: sys?.accent });
}

// A raw site made whole: its places' things and pits moved to where the
// places are, its flats gathered (the landing spot's, each place's, each
// pit), and what's left out filled in. On its own (not inside siteOf) so a
// book of sites outside the galaxy (the Rick and Morty planets) is made
// whole by the same rules the scene was built for.
export function siteFrom(raw, id, { name, accent } = {}) {
  // (a site laid out another way than its game map turns to it: turnSite.js)
  raw = turnSite(raw, raw.turn);
  const cities = (raw.places ?? []).map((p, i) => (p.city ? cityIn(p, i, raw) : null));
  const places = (raw.places ?? []).map((p, i) => ({
    ...p,
    ...(cities[i] ? { flat: cities[i].flat } : {}),
    things: (p.things ?? []).map((t) => ({ ...t, at: plus(p.at, turn(t.at, p.yaw)), yaw: (t.yaw ?? 0) + (p.yaw ?? 0), place: p.id })),
    pits: (p.pits ?? []).map((q) => ({ ...q, at: plus(p.at, turn(q.at, p.yaw)) })),
  }));
  const land = { at: [0, 0], yaw: 0, ...raw.land };
  const flats = [
    ...(raw.ground.flats ?? []),
    { at: land.at, r: raw.land?.r ?? 26, edge: 22, h: raw.land?.h },
    // (`game`: a world drawn from the game's level leaves this flat out: the game's ground is the ground)
    ...places.filter((p) => p.flat).map((p) => ({ at: p.at, r: p.flat.r, edge: p.flat.edge, h: p.flat.h, ...(p.flat.game ? { game: true } : {}) })),
  ];
  // (the ground's own pits, Beggar's Canyon's run of them, and the places')
  const pits = [...(raw.ground.pits ?? []), ...places.flatMap((p) => p.pits)];
  // the places you go into (zones): each built high over the world where
  // nothing outside can be seen, at `origin`; what's in one is placed
  // relative to it (its life, and its quests' steps that say `zone`)
  const zones = (raw.zones ?? []).map((z, i) => {
    const origin = z.origin ?? [-1600 + i * 700, 1500, -4200];
    const things = (z.things ?? []).map((t) => ({ ...t, at: [origin[0] + t.at[0], origin[2] + t.at[1]], y: origin[1] + (t.y ?? 0), abs: true, zone: true }));
    return { ...z, origin, things };
  });
  const inZone = (id, xz) => {
    const z = zones.find((q) => q.id === id);
    return z && xz ? [z.origin[0] + xz[0], z.origin[2] + xz[1]] : xz;
  };
  const zoneLife = zones.flatMap((z) => (z.life ?? []).map((a) => ({ ...a, zone: z.id, at: a.at && inZone(z.id, a.at), path: a.path?.map((q) => inZone(z.id, q)), level: a.level != null ? z.origin[1] + a.level : undefined })));
  // (and the places in them its people go to, where they are)
  const zoneWants = zones.flatMap((z) => (z.wants ?? []).map((w) => ({ ...w, zone: z.id, at: inZone(z.id, w.at), ...(w.spots ? { spots: w.spots.map((q) => inZone(z.id, q)) } : {}) })));
  const air = airOf({ ...raw, places });
  const levelIn = (id, y) => (y == null ? undefined : zones.find((q) => q.id === id).origin[1] + y);
  const quests = (raw.quests ?? []).map((q) => ({
    ...q,
    steps: q.steps.map((st) => {
      const zid = st.zone && st.type !== 'enter' ? st.zone : null;
      if (!zid) return st;
      const fx = (list) => list?.map((e) => (e.to ? { ...e, to: inZone(zid, e.to) } : e));
      return { ...st, at: st.at && inZone(zid, st.at), gates: st.gates?.map((g) => inZone(zid, g)), spots: st.spots?.map((g) => inZone(zid, g)), spawn: st.spawn && [].concat(st.spawn).map((sp) => ({ ...sp, at: inZone(zid, sp.at), level: levelIn(zid, sp.level ?? st.level) })), respawn: st.respawn && inZone(zid, st.respawn), start: fx(st.start), end: fx(st.end), level: levelIn(zid, st.level) };
    }),
  }));
  return {
    id,
    name: name ?? id,
    accent: accent ?? '#ffffff',
    reach: REACH,
    things: [],
    rides: [],
    flyovers: [],
    skyships: [],
    floors: [],
    ...raw,
    // (the site's own rows, then its flora's: the recipe adds, never replaces)
    scatter: [...(raw.scatter ?? []), ...cities.flatMap((c) => c?.rows ?? []), ...floraRows({ ...raw, places })],
    weather: [...(raw.weather ?? []), ...air.weather],
    air: { song: air.song, flocks: air.flocks },
    land,
    places,
    zones,
    quests,
    life: [...(raw.life ?? []), ...cities.flatMap((c) => c?.life ?? []), ...zoneLife],
    // (the cities' streets, paved into the ground: groundPaint.js)
    paving: [...(raw.paving ?? []), ...cities.flatMap((c) => c?.paving ?? [])],
    wants: [...(raw.wants ?? []), ...zoneWants],
    ground: { ...raw.ground, flats, pits },
    things_all: [...(raw.things ?? []), ...places.flatMap((p) => p.things)],
  };
}
