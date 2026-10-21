import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MOONS, UNIVERSES } from '../universes';
import { STYLES } from './ground';
import { CLEAR, LANDINGS, SCATTER_MAX, landingOf, scatterSpots, seedOf, tableSet } from './landings';
import { biomeAt } from './biomes';
import { shapeFor } from './bodies';

const HEX = /^#[0-9a-f]{6}$/i;
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '../../../../public');
// the planets you can land on: the fandoms (not the gate into the galaxy)
const LANDABLE = [...UNIVERSES.filter((u) => u.kind === 'fandom' && !u.portal), ...MOONS].map((u) => u.id);
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
// the planets whose things are built (their files, as furnish.js loads them)
const FILES = {
  middleearth: () => import('./middleearth.js'),
  breakingbad: () => import('./breakingbad.js'),
  rickmorty: () => import('./rickmorty.js'),
  transformers: () => import('./transformers.js'),
  gaming: () => import('./gaming.js'),
  marvel: () => import('./marvel.js'),
  office: () => import('./office.js'),
  music: () => import('./music.js'),
  travel: () => import('./travel.js'),
  caribbean: () => import('./caribbean.js'),
  invincible: () => import('./invincible.js'),
  potter: () => import('./potter.js'),
  gazorpazorp: () => import('./rmmoons.js'),
  squanch: () => import('./rmmoons.js'),
  birdworld: () => import('./rmmoons.js'),
  gearworld: () => import('./rmmoons.js'),
  pluto: () => import('./rmmoons.js'),
  snakeplanet: () => import('./rmmoons.js'),
  nuptia: () => import('./rmmoons.js'),
  resort: () => import('./rmmoons.js'),
  cronenberg: () => import('./rmmoons.js'),
  purge: () => import('./rmmoons.js'),
};

// each landing as it is, and as each of its biomes has it (biomes.js), by name
const PLACES = Object.entries(LANDINGS).flatMap(([id, l]) => [[id, id, l], ...(l.biomes ?? []).map((b) => [id, `${id}/${b.id}`, biomeAt({ ...l, biomes: [b] }, [0, 0, 0])])]);

describe('planet landings', () => {
  it('give every planet you can land on its own place: a name, a ground and a sky', () => {
    expect(LANDABLE.length).toBe(22);
    const titles = new Set();
    for (const id of LANDABLE) {
      const l = landingOf(id);
      expect(l, id).toBeTruthy();
      expect(l.title.length, id).toBeGreaterThan(2);
      titles.add(l.title);
      expect(STYLES[l.ground.style], `${id}'s ground`).toBeTruthy();
      expect(l.ground.colors).toHaveLength(3);
      for (const c of l.ground.colors) expect(c, id).toMatch(HEX);
      for (const k of ['zenith', 'horizon', 'sun']) expect(l.sky[k], `${id}'s ${k}`).toMatch(HEX);
      expect(l.sky.space ?? 0).toBeGreaterThanOrEqual(0);
      expect(l.sky.space ?? 0).toBeLessThanOrEqual(1);
    }
    expect(titles.size).toBe(LANDABLE.length);
    expect(landingOf('starwars')).toBeNull(); // (a gate, not a planet)
  });

  it('only name models that are there to load', () => {
    for (const [, id, l] of PLACES) {
      for (const [kind, m] of Object.entries(l.models ?? {})) {
        expect(existsSync(join(PUBLIC, m.url)), `${id}'s ${kind}: ${m.url}`).toBe(true);
        expect(Boolean(m.tall || m.long || m.wide), `${id}'s ${kind} has a size`).toBe(true);
      }
    }
  });

  // (the Quaternius kits, scripts/quaternius.mjs: a GLB a family of models, a node a model)
  it('name a kit’s model by a node the kit has, and give what can be knocked about a body', () => {
    const manifest = JSON.parse(readFileSync(join(PUBLIC, 'models/quaternius/manifest.json'), 'utf8'));
    let named = 0;
    for (const [, id, l] of PLACES) {
      for (const [kind, m] of Object.entries(l.models ?? {})) {
        if (m.node) {
          named++;
          expect(manifest[m.node]?.url, `${id}'s ${kind}: ${m.node} in ${m.url}`).toBe(m.url);
        }
        if (m.tint) expect(m.tint, `${id}'s ${kind}`).toMatch(HEX);
        if (!m.body) continue;
        // (the shapes and masses landings/bodies.js makes bodies of: a loose
        // one light or middling, so a shot sends it and a shove moves it)
        expect(['box', 'cylinder', 'ball'], `${id}'s ${kind}`).toContain(m.body.shape);
        if (m.body.fixed) continue;
        expect(m.body.mass, `${id}'s ${kind}`).toBeGreaterThanOrEqual(0.5);
        expect(m.body.mass, `${id}'s ${kind}`).toBeLessThanOrEqual(30);
      }
    }
    expect(named).toBeGreaterThan(20);
  });

  // (what a bolt meets at a lamp post or a sign is the pole you see, not a
  // column as wide as its plate or its head: landings/bodies.js shapeFor)
  it('stand a street thing’s post as thick as its pole, inside the model', () => {
    const manifest = JSON.parse(readFileSync(join(PUBLIC, 'models/quaternius/manifest.json'), 'utf8'));
    const seen = new Set();
    for (const [, , l] of PLACES) {
      for (const m of Object.values(l.models ?? {})) {
        const own = manifest[m.node];
        if (!own || m.body?.shape !== 'cylinder' || !m.body.fixed || seen.has(m.node)) continue;
        seen.add(m.node);
        const { half, mid } = own.collider;
        const post = shapeFor(m.body, { min: mid.map((a, i) => a - half[i]), max: mid.map((a, i) => a + half[i]) }).colliders[0];
        const [x, , z] = post.position;
        const r = post.args[1];
        expect(r, m.node).toBeLessThanOrEqual(0.2);
        // (one that says its pole: within the model's own footprint, to a few millimetres)
        if (m.body.r) {
          expect(Math.abs(x) + r, m.node).toBeLessThanOrEqual(half[0] + 0.005);
          expect(Math.abs(z) + r, m.node).toBeLessThanOrEqual(half[2] + 0.005);
        }
        // (a sign's pole, under a plate 0.62 m across: a few centimetres)
        if (/^Sign_/.test(m.node)) expect(r, m.node).toBeLessThan(0.05);
      }
    }
    expect([...seen].sort()).toEqual(['Prop_Bollard', 'Sign_NoParking', 'Sign_Stop', 'Streetlight_Single', 'TrafficLight']);
  });

  it('give the leafy places fallen leaves, and a wind every place that has one', () => {
    for (const [, id, l] of PLACES) {
      if (l.leaves) {
        const { colours, density, size, shed, crown } = l.leaves;
        expect(colours, id).toHaveLength(3);
        for (const c of colours) expect(c, id).toMatch(HEX);
        expect(density, id).toBeGreaterThan(0);
        expect(density, id).toBeLessThanOrEqual(1);
        expect(size, id).toBeGreaterThanOrEqual(0.1);
        expect(size, id).toBeLessThanOrEqual(0.3);
        expect(shed, id).toBeGreaterThanOrEqual(0);
        if (crown) for (const k of ['lit', 'shade']) expect(crown[k], `${id}'s crown ${k}`).toHaveLength(3);
      }
      if (l.wind) {
        expect(l.wind.strength, id).toBeGreaterThanOrEqual(0.1);
        expect(l.wind.strength, id).toBeLessThanOrEqual(1);
      }
    }
    const at = (id) => PLACES.filter(([, x]) => x === id).map(([, , l]) => l);
    for (const id of ['middleearth', 'middleearth/shire', 'middleearth/forest', 'marvel', 'travel', 'travel/land', 'music']) for (const l of at(id)) expect(l.leaves, id).toBeTruthy();
    expect(at('middleearth/forest')).toHaveLength(2);
    for (const id of ['middleearth/mordor', 'middleearth/harad', 'middleearth/mountains', 'breakingbad', 'breakingbad/mountains', 'caribbean', 'travel/ice']) for (const l of at(id)) expect(l.leaves ?? null, id).toBeNull();
  });

  it('give the lots and streets small things lying about to knock over', () => {
    const at = Object.fromEntries(PLACES.map(([, id, l]) => [id, l]));
    for (const id of ['office', 'breakingbad/city', 'invincible/city', 'rickmorty/street', 'marvel']) {
      const l = at[id];
      const loose = (l.things ?? []).filter((t) => l.models?.[t.kind]?.body && !l.models[t.kind].body.fixed);
      expect(loose.length, id).toBeGreaterThanOrEqual(3);
    }
  });

  it('set a table’s chairs round it, pulled out, each facing it', () => {
    const [table, ...chairs] = tableSet([10, 30], { yaw: 0.4, chairs: 3, out: 1.2 });
    expect(table).toMatchObject({ kind: 'table', at: [10, 30], yaw: 0.4, face: false });
    expect(chairs).toHaveLength(3);
    for (const c of chairs) {
      const [dx, dz] = [table.at[0] - c.at[0], table.at[1] - c.at[1]];
      expect(Math.hypot(dx, dz)).toBeCloseTo(1.2);
      // (its front, +z turned by its yaw as three.js turns it, toward the table)
      expect(Math.sin(c.yaw) * dx + Math.cos(c.yaw) * dz).toBeCloseTo(1.2);
      expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(table.r + c.r);
    }
  });

  it("build every thing and scatter from a model or the planet's own file", async () => {
    for (const [planet, id, l] of PLACES) {
      if (!l.things && !l.scatter) continue;
      expect(FILES[planet], `${id} has a file`).toBeTruthy();
      const P = await FILES[planet]();
      const models = l.models ?? {};
      // (a figure is built by furnish itself: landings/people.js)
      for (const t of l.things ?? []) expect(Boolean(models[t.kind] || P.PROPS?.[t.kind] || (t.kind === 'figure' && (t.opts?.url || t.opts?.meshy))), `${id}: ${t.kind}`).toBe(true);
      for (const t of l.things ?? []) if (t.kind === 'figure' && t.opts?.url) expect(existsSync(join(PUBLIC, t.opts.url)), `${id}: ${t.opts.url}`).toBe(true);
      for (const e of l.scatter ?? []) expect(Boolean(models[e.kind] || P.SCATTER?.[e.kind] || P.PROPS?.[e.kind]), `${id}: scattered ${e.kind}`).toBe(true);
    }
  });

  it('stand things clear of the ship and of each other', () => {
    for (const [, id, l] of PLACES) {
      const things = (l.things ?? []).filter((t) => !t.strip && !t.around);
      for (const t of things) {
        expect(t.at, `${id}: ${t.kind}`).toHaveLength(2);
        expect(t.r, `${id}: ${t.kind}'s reach`).toBeGreaterThanOrEqual(0);
        expect(Math.hypot(...t.at) - t.r, `${id}: ${t.kind} by the ship`).toBeGreaterThanOrEqual(CLEAR);
      }
      for (let i = 0; i < things.length; i++)
        for (let j = i + 1; j < things.length; j++) {
          const [a, b] = [things[i], things[j]];
          expect(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]), `${id}: ${a.kind} and ${b.kind}`).toBeGreaterThanOrEqual(a.r + b.r);
        }
    }
  });

  it('scatter within its ring, clear of the things and (if solid) the ship, within budget', () => {
    for (const [planet, id, l] of PLACES) {
      let total = 0;
      for (const e of l.scatter ?? []) {
        expect(e.n, `${id}: ${e.kind}`).toBeLessThanOrEqual(SCATTER_MAX);
        expect(e.from).toBeLessThan(e.to);
        total += e.n;
        const reach = 0.6;
        const spots = scatterSpots(e, l.things ?? [], seeded(seedOf(planet)), { reach });
        expect(spots.length, `${id}: ${e.kind} found room`).toBeGreaterThan(e.n * 0.8);
        for (const p of spots) {
          const d = Math.hypot(p.x, p.z);
          expect(d).toBeGreaterThanOrEqual(e.from - 1e-9);
          expect(d).toBeLessThanOrEqual(e.to + 1e-9);
          if (e.solid !== false) expect(d - reach * p.s).toBeGreaterThanOrEqual(CLEAR);
          for (const t of (l.things ?? []).filter((x) => !x.strip && !x.around)) expect(Math.hypot(t.at[0] - p.x, t.at[1] - p.z)).toBeGreaterThanOrEqual(t.r + reach * p.s);
        }
      }
      expect(total, `${id}'s scatter`).toBeLessThanOrEqual(1200);
    }
  });

  it('give every planet a way into its page, and its doors and lines their words', () => {
    for (const id of LANDABLE) {
      const doors = (LANDINGS[id].things ?? []).filter((t) => t.door);
      expect(doors.length, `${id} has a door`).toBeGreaterThanOrEqual(1);
      for (const t of doors) expect(t.door.label.length).toBeGreaterThan(2);
      for (const t of (LANDINGS[id].things ?? []).filter((x) => x.say)) {
        expect(t.say.name.length).toBeGreaterThan(1);
        expect(t.say.line.length).toBeGreaterThan(3);
      }
    }
  });

  it('lays a planet out the same for everyone, and each planet its own way', () => {
    const e = LANDINGS.breakingbad.scatter[0];
    const a = scatterSpots(e, LANDINGS.breakingbad.things, seeded(seedOf('breakingbad')));
    const b = scatterSpots(e, LANDINGS.breakingbad.things, seeded(seedOf('breakingbad')));
    expect(a).toEqual(b);
    expect(seedOf('breakingbad')).not.toBe(seedOf('rickmorty'));
  });
});

describe('the sky on foot', () => {
  it('every landing’s sky stays near its hand-set colours at noon, and warms toward sunset', async () => {
    const { skyAt } = await import('./sky');
    const THREE = await import('three');
    const lin = (hex) => {
      const c = new THREE.Color(hex);
      return [c.r, c.g, c.b];
    };
    let checked = 0;
    // (each biome's own sky too, under its planet's air)
    for (const [u, landing] of UNIVERSES.flatMap((u) => [[u, landingOf(u.id)], ...(landingOf(u.id)?.biomes ?? []).filter((b) => b.sky).map((b) => [u, b])])) {
      if (!u.air || !landing?.sky) continue;
      checked++;
      const noon = skyAt(landing.sky, u.air, 1);
      for (const k of ['zenith', 'horizon', 'sun']) {
        const set = lin(landing.sky[k]);
        noon[k].forEach((v, i) => expect(Math.abs(v - set[i]), `${u.id} ${k}`).toBeLessThanOrEqual(0.15));
      }
      // (low, the sun's light comes through more air, which takes out most
      // what it scatters most: a bluer air's sun goes redder)
      const air = lin(u.air.colour);
      const low = skyAt(landing.sky, u.air, 0.06);
      const redder = low.sun[0] / Math.max(low.sun[2], 1e-6) >= noon.sun[0] / Math.max(noon.sun[2], 1e-6) - 1e-9;
      expect(redder, u.id).toBe(air[2] >= air[0]);
    }
    expect(checked).toBeGreaterThan(4);
    // a planet with no air keeps its hand-set sky, whatever the hour
    const office = landingOf('office');
    if (office?.sky) expect(skyAt(office.sky, null, 0.1).zenith).toEqual(lin(office.sky.zenith));
  });
});
