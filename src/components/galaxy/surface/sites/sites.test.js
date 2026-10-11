import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SYSTEMS } from '../../systems';
import { GALAXY_KINDS } from '../../fleet';
import { BUILT_KINDS } from '../../../universe/trafficModels';
import { SURFACE_MODELS } from '../catalog';
import { FIGURES } from '../figures';
import { PROPS, SCATTER } from '../props';
import { RIDES } from '../rides';
import { LAYER_TYPES, REACH, heightGrid, makeHeight } from '../terrain';
import { LANDABLE, SITES, districtOf, siteFrom, siteOf, withDistrict } from '.';
import { EXTRA } from './quests';
import { CREW } from '../crew';
import { talkTree } from '../talk';
import { CLIPS } from '../../../../lib/three/clipLibrary';
import { floraNames } from '../flora';
import { RECIPES, recipeNames } from '../gameFlora';
import { isGame } from '../catalog/bf2017-library';
import LIBRARY from '../../../../data/bf2017/library.json';
import USED from '../../../../data/bf2017/library-used.json';
import { LIGHTS, PICTURED, gamePictureOf } from '../../../../data/bf2017/light/index';

const SHIPS = new Set([...GALAXY_KINDS, ...BUILT_KINDS]);
const placeable = (kind) => Boolean(PROPS[kind] || SURFACE_MODELS[kind]);
// (the nature kit's models: a scatter row that names one is drawn from the
// kit, so a typo in its name fails here and not in a browser)
const KIT = JSON.parse(readFileSync(new URL('../../../../../public/kit/naturemega/index.json', import.meta.url), 'utf8')).models;
const kitName = (model) => (typeof model === 'string' && model.startsWith('kit:naturemega/') ? model.slice('kit:naturemega/'.length) : null);
const WEATHER = ['sand', 'snow', 'rain', 'ash', 'embers', 'motes', 'spray'];

describe('the worlds you can land on', () => {
  it('are the galaxy’s systems with somewhere to stand (Alderaan’s gone)', () => {
    for (const id of Object.keys(SITES)) expect(SYSTEMS.some((s) => s.id === id), id).toBe(true);
    expect(LANDABLE).not.toContain('alderaan');
    expect(LANDABLE).toContain('tatooine');
  });

  for (const id of Object.keys(SITES)) {
    describe(id, () => {
      const site = siteOf(id);

      it('wears the game’s own maps for its props’ trims and its ground’s grain (the owner’s rule: every texture in a Star Wars world is the game’s)', () => {
        expect(site.look?.scanned).toBe('bf2017');
      });

      it('has its sky, its light, its land and where to come down', () => {
        expect(site.place, 'place').toBeTruthy();
        expect(site.line, 'line').toBeTruthy();
        for (const k of ['zenith', 'horizon']) expect(site.sky[k], k).toMatch(/^#[0-9a-f]{6}$/i);
        expect(site.sky.suns?.length ?? 0).toBeLessThanOrEqual(2);
        expect(site.fog.density).toBeGreaterThan(0);
        expect(site.light.sun).toBeGreaterThan(0);
        for (const l of site.ground.layers) expect(LAYER_TYPES, l.type).toContain(l.type);
        for (const k of ['low', 'high', 'rock']) expect(site.ground.palette[k], k).toBeTruthy();
        expect(Math.hypot(...site.land.at)).toBeLessThan(REACH - 40);
        for (const w of site.weather) expect(WEATHER, w.kind).toContain(w.kind);
      });

      it('passes its record’s picture where the game lights it, a row for every weather', async () => {
        if (!site.gameLight) {
          expect(site.picture, 'picture without a record').toBeUndefined();
          return;
        }
        expect(PICTURED, 'a picture file for its record').toContain(site.gameLight);
        expect(site.picture).toBe(`${site.gameLight}.picture.json`);
        const pic = await gamePictureOf(site);
        expect(pic.world).toBe(site.gameLight);
        for (const w of Object.keys(LIGHTS[site.gameLight].weathers)) {
          const row = pic.weathers[w];
          expect(row, w).toBeTruthy();
          // (the picture's LUT is the game's whole 33³, read after the linear tone map)
          expect(row.lut?.size, `${w} lut`).toBe(33);
          expect(row.panorama === null || row.panorama.url.endsWith('.ktx2'), `${w} panorama`).toBe(true);
        }
      });

      it('has places to find, each one somewhere you can get to', () => {
        expect(site.places.length).toBeGreaterThanOrEqual(3);
        const ids = site.places.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const p of site.places) {
          expect(p.name, p.id).toBeTruthy();
          expect(p.about?.length, p.id).toBeGreaterThan(30);
          expect(p.r, p.id).toBeGreaterThan(5);
          // (its middle within reach, or its edge at least)
          expect(Math.hypot(...p.at) - p.r, p.id).toBeLessThan(REACH);
        }
      });

      it('has everything it places built or brought in', () => {
        // (one of the drop's library objects, `game:<name>`: imported and published)
        for (const t of site.things_all) expect(isGame(t.model) ? Boolean(SURFACE_MODELS[t.model]) : placeable(t.kind), `${t.kind} ${t.model ?? ''}`).toBe(true);
        for (const s of site.scatter) {
          const kit = kitName(s.model);
          if (isGame(s.model)) expect(Boolean(SURFACE_MODELS[s.model]), `scatter ${s.model}`).toBe(true);
          else if (kit) expect(Boolean(KIT[kit]), `scatter ${s.model}`).toBe(true);
          else expect(Boolean(SCATTER[s.kind] || placeable(s.kind)), `scatter ${s.kind}`).toBe(true);
        }
        // (a person may be a crew figure, which actors.js tries first)
        for (const a of site.life) expect(Boolean(CREW[a.kind] || FIGURES.includes(a.kind) || placeable(a.kind)), `life ${a.kind}`).toBe(true);
        for (const r of site.rides) expect(RIDES[r.kind], `ride ${r.kind}`).toBeTruthy();
        for (const r of site.rides) if (!RIDES[r.kind].figure) expect(placeable(r.kind), `ride ${r.kind}`).toBe(true);
        for (const f of site.flyovers) expect(SHIPS.has(f.kind), `flyover ${f.kind}`).toBe(true);
        for (const f of site.skyships) expect(SHIPS.has(f.kind), `skyship ${f.kind}`).toBe(true);
      });

      it('names only kit models the manifest has', () => {
        for (const name of floraNames(site.scatter)) expect(KIT[name], name).toBeTruthy();
      });

      it('sends its people to wants that exist, of kinds someone needs, within reach', () => {
        const kinds = new Set(site.wants.map((w) => w.kind));
        const ids = site.wants.map((w) => w.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const w of site.wants) if (!w.zone) expect(Math.hypot(...w.at), w.id).toBeLessThan(REACH);
        // (a zone's in its zone, among its people)
        for (const w of site.wants.filter((q) => q.zone)) {
          const z = site.zones.find((q) => q.id === w.zone);
          expect(Math.hypot(w.at[0] - z.origin[0], w.at[1] - z.origin[2]), w.id).toBeLessThan(40);
          expect(site.life.some((a) => a.zone === w.zone && a.needs?.includes(w.kind)), `someone in ${w.zone} needs ${w.kind}`).toBe(true);
        }
        // what's done at each is a clip the library has (a seat: the figure's own), its spots round it, one a slot
        for (const w of site.wants) {
          if (w.clip) expect(Object.hasOwn(CLIPS, w.clip), `${w.id}: ${w.clip}`).toBe(true);
          if (w.base) expect(w.base === 'sit' || Object.hasOwn(CLIPS, w.base), `${w.id}: ${w.base}`).toBe(true);
          if (w.spots) expect(w.spots.length, w.id).toBe(w.slots ?? 1);
          for (const q of w.spots ?? []) expect(Math.hypot(q[0] - w.at[0], q[1] - w.at[1]), w.id).toBeLessThan(6);
        }
        for (const a of site.life) for (const k of a.needs ?? []) expect(kinds.has(k), `${a.kind} needs ${k}`).toBe(true);
        const life = new Set(site.life.map((a) => a.kind));
        for (const a of site.life) for (const k of [...(a.fears ?? []), ...(a.chases ?? [])]) expect(life.has(k), `${a.kind} knows ${k}`).toBe(true);
      });

      it('every `says` that is a tree validates, and every list is lines', () => {
        for (const a of site.life) {
          if (!a.says) continue;
          const lines = talkTree(a.says, `${id} ${a.name ?? a.kind}`);
          expect(lines.length, `${a.name ?? a.kind}`).toBeGreaterThan(0);
          for (const l of lines) expect(typeof l === 'string' || (Array.isArray(l) && l.length === 2)).toBe(true);
        }
      });

      it('can start every quest it has (its giver offers it)', () => {
        const ids = (a) => [a.quest ?? []].flat();
        for (const q of site.quests) {
          if (!q.giver) continue;
          const giver = site.life.filter((a) => a.id === q.giver);
          expect(giver.length, `${q.id}'s giver ${q.giver}`).toBeGreaterThan(0);
          expect(giver.some((a) => ids(a).includes(q.id)), `${q.giver} offers ${q.id}`).toBe(true);
        }
      });

      it('sets the ship down on level ground, inside the world', () => {
        if (site.noGround) {
          expect(site.floors.length + site.things_all.length).toBeGreaterThan(0);
          return;
        }
        const g = heightGrid(makeHeight(site.ground), { n: 64, grow: 1.4 });
        const [x, z] = site.land.at;
        const n = g.normalAt(x, z, 2);
        expect(n[1]).toBeGreaterThan(0.97);
        if (site.water && site.water.kind !== 'clouds') expect(g.heightAt(x, z)).toBeGreaterThan(site.water.level);
      });
    });
  }
});

describe('Bespin, inside', () => {
  const site = siteOf('bespin');
  const quest = (id) => site.quests.find((q) => q.id === id);
  const zone = (id) => site.zones.find((z) => z.id === id);

  it('offers the duel and Lobot’s codes only after the freezing', () => {
    expect(quest('freezing').after).toBeUndefined();
    expect(quest('duel').after).toEqual(['freezing']);
    expect(quest('lobot').after).toEqual(['freezing']);
    for (const id of ['freezing', 'duel', 'lobot']) expect(quest(id).achievement).toBe(`bespin${id}`);
  });

  it('puts the chamber’s guards and the platform in the freezing chamber, and the freeze lowers the platform', () => {
    const q = quest('freezing');
    const o = zone('carbon').origin;
    const fight = q.steps.find((s) => s.type === 'shoot');
    expect(fight.spawn.reduce((n, s) => n + s.n, 0)).toBe(6);
    for (const s of fight.spawn) {
      expect(Math.abs(s.at[0] - o[0])).toBeLessThan(17);
      expect(Math.abs(s.at[1] - o[2])).toBeLessThan(17);
    }
    expect(fight.spawn.some((s) => s.hostile.melee)).toBe(true);
    const use = q.steps.find((s) => s.type === 'use');
    expect(use.at).toEqual([o[0], o[2]]);
    expect(use.end).toEqual(expect.arrayContaining([{ signal: 'freeze' }]));
  });

  it('sets Vader on the gantry with a blade and the Force, and you back on the control room floor when you fall', () => {
    const q = quest('duel');
    const o = zone('reactor').origin;
    const duel = q.steps.find((s) => s.type === 'shoot');
    const [vader] = [].concat(duel.spawn);
    expect(vader.kind).toBe('vader');
    expect(Math.hypot(vader.at[0] - o[0], vader.at[1] - o[2])).toBeLessThan(12);
    expect(vader.hostile.blade).toBeTruthy();
    expect(vader.hostile.force).toEqual({ every: 7, push: 9 });
    expect(vader.hostile.parry).toBeGreaterThan(0.5);
    expect(duel.respawn).toEqual([o[0], o[2] + 19.5]);
    expect(zone('reactor').inside.fall).toBeLessThan(0);
  });

  it('sends the Wing Guard in on your side through the corridor, and the codes open its doors', () => {
    const q = quest('lobot');
    const fight = q.steps.find((s) => s.type === 'shoot');
    const guards = fight.spawn.filter((s) => s.side === 'yours');
    expect(guards.length).toBe(1);
    expect(guards[0].kind).toBe('wingguard');
    expect(guards[0].hostile.range).toBeGreaterThan(0);
    expect(fight.spawn.filter((s) => s.tag === 'escort').reduce((n, s) => n + s.n, 0)).toBe(fight.n);
    const uses = q.steps.filter((s) => s.type === 'use');
    expect(uses.map((u) => u.id)).toEqual(['lobot1', 'lobot2']);
    expect(uses[0].end).toEqual(expect.arrayContaining([{ signal: 'lobot1' }, { solid: 'door1', off: true }]));
    expect(uses[1].end).toEqual(expect.arrayContaining([{ signal: 'lobot2' }, { solid: 'door2', off: true }, { leave: true }]));
    const race = q.steps.at(-1);
    expect(race.type).toBe('race');
    expect(Math.hypot(race.gates.at(-1)[0], race.gates.at(-1)[1] + 255)).toBeLessThan(28);
  });
});

// siteOf's "made whole" step stands on its own, so another book of sites
// (the Rick and Morty planets) is made whole exactly as the galaxy's are
describe('siteFrom', () => {
  const named = (id) => {
    const sys = SYSTEMS.find((s) => s.id === id);
    return { name: sys.name, accent: sys.accent };
  };

  it('makes a raw site whole exactly as siteOf does', () => {
    expect(EXTRA.bespin).toBeUndefined();
    // (with the galaxy's own default, the game's maps, which siteOf gives every one of its sites)
    expect(siteFrom({ ...SITES.bespin, look: { scanned: 'bf2017', ...SITES.bespin.look } }, 'bespin', named('bespin'))).toEqual(siteOf('bespin'));
  });

  it('gives siteOf’s result once the extra quests are folded in', () => {
    const more = EXTRA.endor;
    const raw = { ...SITES.endor, look: { scanned: 'bf2017' }, life: [...(SITES.endor.life ?? []), ...more.life], quests: [...(SITES.endor.quests ?? []), ...more.quests] };
    expect(siteFrom(raw, 'endor', named('endor'))).toEqual(siteOf('endor'));
  });

  it('names a site by its id, in white, when nothing names it', () => {
    const site = siteFrom(SITES.bespin, 'elsewhere');
    expect(site.id).toBe('elsewhere');
    expect(site.name).toBe('elsewhere');
    expect(site.accent).toBe('#ffffff');
  });
});

describe('districts: more than one of the game’s maps on a world', () => {
  const site = { level: 'tatooine', land: { at: [0, 0], yaw: 0 }, place: 'Mos Eisley', ground: { layers: [{ type: 'image', pack: 'tatooine' }] }, districts: [{ id: 'jabba', name: 'Jabba’s palace', level: 'tatooine/jabba', land: { at: [10, 0], yaw: 1 }, line: 'The palace.' }] };

  it('finds a district by its id, and the world as it is for none or an unknown one', () => {
    expect(districtOf(site, 'jabba').level).toBe('tatooine/jabba');
    expect(districtOf(site, null)).toEqual({ id: 'main', level: 'tatooine', land: site.land });
    expect(districtOf(site, 'nowhere').id).toBe('main');
    expect(districtOf({ land: { at: [0, 0] } }, 'jabba')).toEqual({ id: 'main', level: undefined, land: { at: [0, 0] } });
  });

  it('puts a district’s level, landing and ground on the site, and leaves the site alone without one', () => {
    const d = withDistrict(site, 'jabba');
    expect(d).toMatchObject({ level: 'tatooine/jabba', land: { at: [10, 0], yaw: 1 }, place: 'Jabba’s palace', line: 'The palace.', district: 'jabba' });
    // (the ground's own heightmap is the district's pack's)
    expect(d.ground.layers).toEqual([{ type: 'image', pack: 'tatooine/jabba' }]);
    expect(withDistrict({ ...site, weather: [{ kind: 'snow' }], districts: [{ ...site.districts[0], site: { weather: [] } }] }, 'jabba').weather).toEqual([]);
    expect(withDistrict(site, 'nowhere')).toBe(site);
    expect(withDistrict(site, null)).toBe(site);
  });

  it('gives a district its own doors, and a way back to another district than the main map', () => {
    const below = { id: 'pit', name: 'The pit', level: 'tatooine/pit', land: { at: [5, 5] }, door: { at: [4, 4], r: 2, prompt: 'Back up', to: 'jabba' } };
    const palace = { ...site.districts[0], door: { at: [1, 1], r: 2, prompt: 'Back to town' }, zones: [{ id: 'down', name: 'The pit', door: { at: [2, 2], r: 2, prompt: 'Down' }, to: { district: 'pit' } }] };
    const two = { ...site, districts: [palace, below] };
    expect(withDistrict(two, 'jabba').zones.map((z) => [z.id, z.to.district])).toEqual([['down', 'pit'], ['jabba-out', 'main']]);
    expect(withDistrict(two, 'pit').zones).toEqual([{ id: 'pit-out', name: 'Jabba’s palace', door: below.door, to: { district: 'jabba' } }]);
  });
});

describe('the worlds drawn from the game’s levels', () => {
  it('Endor stands on Endor_01, its ground the pack’s, its built bunker left to the level', () => {
    const endor = SITES.endor;
    expect(endor.level).toBe('endor');
    expect(endor.ground.layers).toEqual([{ type: 'image', pack: 'endor' }]);
    const bunker = endor.places.find((p) => p.id === 'bunker');
    expect(bunker.flat.game).toBe(true);
    expect(bunker.things.filter((t) => t.kind === 'bunker' || t.kind === 'bunkerbank').every((t) => t.game)).toBe(true);
  });

  // (lane E2: the packs' level.json, in git though their bytes are published)
  const pack = (level) => JSON.parse(readFileSync(new URL(`../../../../../public/models/galaxy/bf2017/levels/${level}/level.json`, import.meta.url), 'utf8'));

  it('Naboo stands on Naboo_01, its water at the canals the game floats its lilies on (Review Focus 1)', () => {
    const naboo = SITES.naboo;
    expect(naboo.level).toBe('naboo');
    expect(naboo.ground.layers).toEqual([{ type: 'image', pack: 'naboo' }]);
    // (36 lilies on Theed's canals in Naboo_01's instances, all at 432.81 m;
    // the pack's origin is the plaza's ground in the game)
    const CANALS = 432.81;
    expect(Math.abs(naboo.water.level - (CANALS - pack('naboo').origin[1]))).toBeLessThan(0.2);
    // (the site's built palace is the flight's: the level draws the game's)
    expect(naboo.places.find((p) => p.id === 'palace').things.every((t) => t.game)).toBe(true);
  });

  it('Kamino stands on Kamino_01 over its sea: off a platform is into the sea and back, onto nothing under it (Review Focus 2)', () => {
    const kamino = SITES.kamino;
    expect(kamino.level).toBe('kamino');
    // (no ground in the map, so the site's y is the game's; the ocean is
    // Shared_Art's WaterSurfaceEntityData, at -296.42 m)
    expect(pack('kamino').origin[1]).toBe(0);
    expect(kamino.water.level).toBeCloseTo(-296.42, 2);
    // the line under which you are put back where you landed is over the sea,
    // so no solid under the water is ever stood on, and 10 m under every deck
    // the site stands its people on, so nobody on a deck is put back
    expect(kamino.fall).toBeGreaterThan(kamino.water.level);
    for (const f of kamino.floors) expect(kamino.fall, `${f.x}, ${f.z}`).toBeLessThan(f.y - 10);
    for (const a of kamino.life.filter((q) => q.level != null)) expect(a.level, a.kind).toBeGreaterThan(kamino.fall);
  });

  it('every door into a district names one its world has, and every district has its door back (Review Focus 3)', () => {
    for (const id of ['hoth', 'naboo', 'kamino']) {
      const site = SITES[id];
      const ids = new Set(site.districts.map((d) => d.id));
      const doors = site.zones.filter((z) => z.to?.district);
      expect(doors.length, id).toBeGreaterThan(0);
      for (const z of doors) expect(ids.has(z.to.district), `${id}: ${z.id}`).toBe(true);
      for (const d of site.districts) expect(withDistrict(site, d.id).zones.map((z) => z.to.district), `${id}/${d.id}`).toEqual(['main']);
    }
  });

  it('Tatooine stands on Tatooine_01, Mos Eisley’s built town left to the level, its palace and pit districts in their own frame', () => {
    const t = siteOf('tatooine');
    expect(t.level).toBe('tatooine');
    expect(t.ground.layers).toEqual([{ type: 'image', pack: 'tatooine' }]);
    // (the flight keeps the desert it drew)
    expect(t.ground.flight.map((l) => l.type)).toEqual(['swell', 'dunes', 'mesas', 'mountains']);
    const mos = t.places.find((p) => p.id === 'moseisley');
    expect(mos.flat.game).toBe(true);
    expect(mos.things.every((x) => x.game)).toBe(true);
    // (the stalls' people stand at the game's own stalls, none at a built one the level leaves out)
    const built = t.things_all.filter((x) => x.kind === 'stall' && !x.game);
    for (const w of t.wants.filter((q) => q.id.startsWith('stall'))) for (const at of w.spots) expect(built.every((x) => Math.hypot(at[0] - x.at[0], at[1] - x.at[1]) > 4), w.id).toBe(true);
    // (the palace's road leads to the game's palace; its pit's way back is to the palace, not the town)
    expect(t.zones.find((z) => z.id === 'jabbaroad').to).toEqual({ district: 'jabba' });
    const palace = withDistrict(t, 'jabba');
    expect(palace).toMatchObject({ level: 'tatooine/jabba', district: 'jabba', places: [], things_all: [] });
    expect(palace.ground.layers).toEqual([{ type: 'image', pack: 'tatooine/jabba' }]);
    expect(palace.zones.map((z) => z.to.district)).toEqual(['jabba-inside', 'main']);
    const pit = withDistrict(t, 'jabba-inside');
    expect(pit).toMatchObject({ level: 'tatooine/jabba-inside', weather: [], life: [] });
    expect(pit.zones).toEqual([expect.objectContaining({ to: { district: 'jabba' } })]);
  });

  it('Bespin stands on CloudCity_01’s walkways, its fall above the city below, the campaign’s palace a district (Review Focus 3)', () => {
    const bespin = SITES.bespin;
    const pack = JSON.parse(readFileSync(new URL('../../../../../public/models/galaxy/bf2017/levels/bespin/level.json', import.meta.url), 'utf8'));
    expect(bespin.level).toBe('bespin');
    expect(bespin.noGround).toBe(true);
    // (the walkways at the game's 199 m are the site's 0; the plazas the map draws below them, at -5 m, are
    // the backdrop: one who falls off is counted fallen long before them, never caught on their floors)
    expect(pack.origin[1]).toBe(199);
    expect(bespin.fall).toBeLessThan(0);
    expect(bespin.fall).toBeGreaterThan(-5 - pack.origin[1]);
    // (the built deck, its towers and bridges the flight's: the level's walkways are what you stand on)
    for (const t of bespin.things.filter((x) => ['bespindeck', 'bespinplatform', 'bespinbridge', 'cloudcity'].includes(x.kind))) expect(t.game, t.kind).toBe(true);
    const palace = bespin.districts.find((d) => d.id === 'm2bes');
    expect(palace.level).toBe('bespin/m2bes');
    expect(bespin.zones.some((z) => z.to?.district === 'm2bes')).toBe(true);
    // (the map has no carbon-freezing chamber: the site's stays, and its zone)
    expect(bespin.places.find((p) => p.id === 'carbon').things.find((t) => t.kind === 'carbonchamber').game).toBeUndefined();
  });

  it('Hoth’s outpost is Hoth_02, a district reached on foot where the game put it on the same ice', () => {
    const hoth = SITES.hoth;
    const outpost = hoth.districts.find((d) => d.id === 'outpost');
    expect(outpost.level).toBe('hoth/outpost');
    const pack = JSON.parse(readFileSync(new URL('../../../../../public/models/galaxy/bf2017/levels/hoth/outpost/level.json', import.meta.url), 'utf8'));
    const main = JSON.parse(readFileSync(new URL('../../../../../public/models/galaxy/bf2017/levels/hoth/level.json', import.meta.url), 'utf8'));
    // (Hoth_02 is drawn on Hoth_01's own terrain: its door on the main map is where its spot lies there)
    const door = hoth.zones.find((z) => z.to?.district === 'outpost').door.at;
    expect(door[0]).toBeCloseTo(pack.origin[0] - main.origin[0], 0);
    expect(door[1]).toBeCloseTo(pack.origin[2] - main.origin[2], 0);
    expect(withDistrict(hoth, 'outpost').ground.layers).toEqual([{ type: 'image', pack: 'hoth/outpost' }]);
  });

  it('the second Death Star’s inside is DeathStar02_01, an Endor district up the shuttle, with none of the forest in it', () => {
    const endor = siteOf('endor');
    const zone = endor.zones.find((z) => z.to?.district === 'deathstar');
    // (the Lambda on the shield generator's pad)
    const pad = endor.places.find((p) => p.id === 'generator').things.find((t) => t.kind === 'lambda').at;
    expect(Math.hypot(zone.door.at[0] - pad[0], zone.door.at[1] - pad[1])).toBeLessThan(zone.door.r);
    const ds = withDistrict(endor, 'deathstar');
    expect(ds.level).toBe('endor/deathstar');
    const pack = JSON.parse(readFileSync(new URL('../../../../../public/models/galaxy/bf2017/levels/endor/deathstar/level.json', import.meta.url), 'utf8'));
    // (landed on the game's first team-one spawn point, on the spawn deck at the pack's 0)
    expect(pack.inside).toBe(true);
    expect(ds.land.at).toEqual([2.1, 35.9]);
    expect([ds.noGround, ds.fall]).toEqual([true, -60]);
    expect([ds.places, ds.life, ds.quests, ds.scatter, ds.weather]).toEqual([[], [], [], [], []]);
    expect(ds.gameLight).toBeNull();
    // (and back down by the same shuttle)
    expect(ds.zones.find((z) => z.to?.district === 'main')).toBeTruthy();
  });

  it('Scarif stands on Scarif_02’s beach, its sea the game’s, its built base left to the level', () => {
    const scarif = SITES.scarif;
    const pack = JSON.parse(readFileSync(new URL('../../../../../public/models/galaxy/bf2017/levels/scarif/level.json', import.meta.url), 'utf8'));
    expect(scarif.level).toBe('scarif');
    expect(scarif.ground.layers).toEqual([{ type: 'image', pack: 'scarif' }]);
    // (the game's sea, WaterSurfaceEntityData at 212.03 m, under the landing's 212.95: you come down on the shore)
    expect(scarif.water.level).toBeCloseTo(212.03 - pack.origin[1], 1);
    expect(scarif.water.level).toBeLessThan(0);
    for (const t of scarif.things) if (['bunker', 'pad', 'lamp'].includes(t.kind)) expect(t.game, t.kind).toBe(true);
    for (const s of scarif.scatter) expect(s.game, s.kind).toBe(true);
    // (the vault's door needs its tower: the game's Citadel stands 3 km west, past the arena, on the horizon)
    expect(scarif.places.find((p) => p.id === 'citadel').things.find((t) => t.kind === 'citadel').game).toBeUndefined();
  });
});

// The seven worlds with no game map, dressed from the drop's library (the
// fifth design, lane O: gameFlora.js's recipes and the sites' `game:` things)
describe('the worlds without a map, dressed from the drop', () => {
  const INDEX = new Set(LIBRARY.map((r) => r.name));
  const MAPLESS = ['dagobah', 'mustafar', 'nevarro', 'mandalore', 'sorgan', 'lothal', 'coruscant'];

  it('gives each of the seven a recipe or the game’s things', () => {
    for (const id of MAPLESS) {
      const site = siteOf(id);
      const game = [...site.scatter, ...site.things_all].filter((t) => isGame(t.model));
      expect(game.length, id).toBeGreaterThan(0);
    }
  });

  it('scatters none of the drop’s rigged objects until lane A’s clips are there (Review Focus 5)', () => {
    for (const id of LANDABLE)
      for (const r of siteOf(id).scatter.filter((q) => isGame(q.model))) {
        const name = r.model.slice('game:'.length);
        expect(USED[name]?.rig ?? false, `${id}: ${name}`).toBe(false);
        expect(LIBRARY.find((q) => q.name === name)?.rig, `${id}: ${name}`).toBe(false);
      }
  });

  it('names in each recipe only objects the library has and the bucket holds (Review Focus 3)', () => {
    for (const recipe of Object.keys(RECIPES))
      for (const name of recipeNames(recipe)) {
        expect(INDEX.has(name.slice('game:'.length)), `${recipe}: ${name}`).toBe(true);
        expect(Boolean(SURFACE_MODELS[name]), `${recipe}: ${name} is not published`).toBe(true);
      }
  });
});
