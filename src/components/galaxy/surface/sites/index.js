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
//                  opts?, flat? (on level ground only) }]
//   flora          { biome, tint?, density?, trees? }: the nature kit's
//                  cover, middle layer and trees by a recipe (flora.js),
//                  its rows added after the scatter's own
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
//   fall           a world with nothing under its floors (Bespin, Coruscant,
//                  Kamino): how far down counts as falling off

import { SYSTEMS } from '../../systems';
import { REACH } from '../terrain';
import { floraRows } from '../flora';
import { SITES as desert } from './desert';
import { SITES as ice } from './ice';
import { SITES as forest } from './forest';
import { SITES as core } from './core';
import { SITE as coruscant } from './coruscant';
import { SITE as yavin } from './yavin';
import { SITE as bespin } from './bespin';
import { SITES as edge } from './edge';
import { SITES as outer } from './outer';
import { EXTRA } from './quests';

export const SITES = { ...desert, ...ice, ...forest, yavin, ...core, coruscant, ...edge, bespin, ...outer };

// the systems with somewhere to land, in the galaxy's own order
export const LANDABLE = SYSTEMS.filter((s) => SITES[s.id]).map((s) => s.id);
export const canLand = (id) => Boolean(SITES[id]);

const turn = ([x, z], yaw = 0) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];

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
  const places = (raw.places ?? []).map((p) => ({
    ...p,
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
    weather: [],
    things: [],
    rides: [],
    flyovers: [],
    skyships: [],
    floors: [],
    ...raw,
    // (the site's own rows, then its flora's: the recipe adds, never replaces)
    scatter: [...(raw.scatter ?? []), ...floraRows(raw)],
    land,
    places,
    zones,
    quests,
    life: [...(raw.life ?? []), ...zoneLife],
    wants: [...(raw.wants ?? []), ...zoneWants],
    ground: { ...raw.ground, flats, pits },
    things_all: [...(raw.things ?? []), ...places.flatMap((p) => p.things)],
  };
}
