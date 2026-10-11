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
import { LANDABLE, SITES, siteFrom, siteOf } from '.';
import { EXTRA } from './quests';
import { CREW } from '../crew';
import { talkTree } from '../talk';
import { CLIPS } from '../../../../lib/three/clipLibrary';
import { floraNames } from '../flora';
import { RECIPES, recipeNames } from '../gameFlora';
import { isGame } from '../catalog/bf2017-library';
import LIBRARY from '../../../../data/bf2017/library.json';
import USED from '../../../../data/bf2017/library-used.json';

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
