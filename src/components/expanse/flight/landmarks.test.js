import { describe, expect, it } from 'vitest';
import { PROPS, SURFACE_MODELS } from '../../galaxy/shared/models';
import { planetField } from '../../../lib/land/flight/field';
import { PLANETS, planetSpecOf } from './planets';
import { LANDMARK_MAX, LANDMARK_MIN } from '../../../lib/land/flight/landmarkTables';
import { placementsFor, siteFor, siteGround } from './landmarks';

const NAMED = PLANETS.map((p) => p.id).filter((id) => planetSpecOf(id).pois.length);
// (the POIs planetTables.js builds itself are the flight module's)
const ours = (spec) => spec.pois.filter((p) => !(spec.landmarks ?? []).some((l) => l.at === p.id));
const known = (p) => (typeof p.model === 'string' && p.model.startsWith('game:') ? Boolean(SURFACE_MODELS[p.model]) : p.model ? /^kit:[a-z0-9-]+\/\S+$/.test(p.model) : Boolean(SURFACE_MODELS[p.kind] || PROPS[p.kind]));

describe('placementsFor', () => {
  it('stands every POI of every named world with its buildings', () => {
    for (const id of NAMED) {
      const spec = planetSpecOf(id);
      const { heightAt } = planetField(spec);
      for (const poi of ours(spec)) {
        const { list } = placementsFor(spec, poi, { heightAt });
        expect(list.length, `${id}/${poi.id}`).toBeGreaterThanOrEqual(LANDMARK_MIN);
        expect(list.length, `${id}/${poi.id}`).toBeLessThanOrEqual(LANDMARK_MAX);
        for (const p of list) {
          expect(known(p), `${id}/${poi.id}: ${p.kind} ${p.model ?? ''}`).toBe(true);
          expect([...p.at, p.y, p.yaw, p.scale].every(Number.isFinite), `${id}/${poi.id}: ${p.kind}`).toBe(true);
          expect(p.abs).toBe(true);
          // (within the POI's reach of its middle: nothing strays into the next one)
          expect(Math.hypot(p.at[0] - poi.at[0], p.at[1] - poi.at[1])).toBeLessThanOrEqual(poi.r + poi.edge + 1e-6);
        }
      }
    }
  });

  it('reads a site on the game’s level by its own land, the flight’s, not its image', () => {
    // (Hoth's surface ground is the game's heightmap, which the flight has not got)
    const g = siteGround('hoth');
    expect(g.layers.map((l) => l.type)).not.toContain('image');
    expect(g.layers[0].type).toBe('swell');
    expect(siteGround('tatooine').layers[0].type).toBe('swell');
  });

  it('takes Echo Base from the walkable Hoth, its doors and generator and all', () => {
    const spec = planetSpecOf('hoth');
    const poi = spec.pois.find((p) => p.id === 'echo-base');
    const { heightAt } = planetField(spec);
    expect(siteFor(spec, poi)?.id).toBe('hoth');
    const kinds = placementsFor(spec, poi, { heightAt }).list.map((p) => p.kind);
    expect(kinds).toContain('echobase');
    expect(kinds).toContain('hothgenerator');
  });

  it('stands Theed’s palace and the Lars homestead from their sites', () => {
    const kinds = (id, poiId) => {
      const spec = planetSpecOf(id);
      return placementsFor(spec, spec.pois.find((p) => p.id === poiId), { heightAt: planetField(spec).heightAt }).list.map((p) => p.kind);
    };
    expect(kinds('naboo', 'theed')).toEqual(expect.arrayContaining(['theedpalace', 'hangar']));
    expect(kinds('tatooine', 'lars')).toEqual(expect.arrayContaining(['homestead', 'vaporator']));
  });

  it('stands a POI with no site on its own list, at the ground', () => {
    const spec = planetSpecOf('mustafar');
    const poi = spec.pois.find((p) => p.id === 'arm');
    expect(siteFor(spec, poi)).toBeNull();
    const heightAt = () => 7;
    const { list } = placementsFor(spec, poi, { heightAt });
    expect(list.some((p) => p.model === 'kit:space/MetalSupport')).toBe(true);
    for (const p of list) expect(p.y).toBe(7);
  });

  it('drops what the site stood on ground the flight hasn’t got, and counts it', () => {
    const spec = planetSpecOf('hoth');
    const poi = spec.pois[0];
    const flat = placementsFor(spec, poi, { heightAt: () => 12 });
    // (ground that rises and falls 25 m every 40: everything the site stood on level ground goes)
    const walled = placementsFor(spec, poi, { heightAt: (x) => 12 + 25 * Math.abs(Math.sin(x / 13)) });
    expect(walled.dropped).toBeGreaterThan(0);
    expect(walled.list.length + walled.dropped).toBe(flat.list.length + flat.dropped);
  });

  it('drops under a tenth of any site’s things on the planet’s own ground', () => {
    // (summed over the site's POIs, as the plan has it: one place on a slope
    // can lose a thing of seven, a whole site loses under a tenth)
    for (const id of NAMED) {
      const spec = planetSpecOf(id);
      const { heightAt } = planetField(spec);
      let kept = 0;
      let dropped = 0;
      for (const poi of ours(spec)) {
        if (!siteFor(spec, poi)) continue;
        const got = placementsFor(spec, poi, { heightAt });
        kept += got.list.length;
        dropped += got.dropped;
      }
      if (kept + dropped) expect(dropped / (kept + dropped), id).toBeLessThan(0.1);
    }
  });

  it('is the same list every time', () => {
    const spec = planetSpecOf('tatooine');
    const { heightAt } = planetField(spec);
    expect(placementsFor(spec, spec.pois[0], { heightAt })).toEqual(placementsFor(spec, spec.pois[0], { heightAt }));
  });
});
