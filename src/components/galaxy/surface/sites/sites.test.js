import { describe, expect, it } from 'vitest';
import { SYSTEMS } from '../../systems';
import { GALAXY_KINDS } from '../../fleet';
import { BUILT_KINDS } from '../../../universe/trafficModels';
import { SURFACE_MODELS } from '../catalog';
import { FIGURES } from '../figures';
import { PROPS, SCATTER } from '../props';
import { RIDES } from '../rides';
import { LAYER_TYPES, REACH, heightGrid, makeHeight } from '../terrain';
import { LANDABLE, SITES, siteOf } from '.';

const SHIPS = new Set([...GALAXY_KINDS, ...BUILT_KINDS]);
const placeable = (kind) => Boolean(PROPS[kind] || SURFACE_MODELS[kind]);
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
        for (const t of site.things_all) expect(placeable(t.kind), `${t.kind}`).toBe(true);
        for (const s of site.scatter) expect(Boolean(SCATTER[s.kind] || placeable(s.kind)), `scatter ${s.kind}`).toBe(true);
        for (const a of site.life) expect(Boolean(FIGURES.includes(a.kind) || placeable(a.kind)), `life ${a.kind}`).toBe(true);
        for (const r of site.rides) expect(RIDES[r.kind], `ride ${r.kind}`).toBeTruthy();
        for (const r of site.rides) if (!RIDES[r.kind].figure) expect(placeable(r.kind), `ride ${r.kind}`).toBe(true);
        for (const f of site.flyovers) expect(SHIPS.has(f.kind), `flyover ${f.kind}`).toBe(true);
        for (const f of site.skyships) expect(SHIPS.has(f.kind), `skyship ${f.kind}`).toBe(true);
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
