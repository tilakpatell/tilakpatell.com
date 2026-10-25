import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIG, PLANETS, destinationById, isBigPlanet as isBigDestination } from '../world/dimensions/destinations';
import { PLANET_TASKS, TASKS } from '../world/rules';
import { planetOf, planetProgress } from '../world/planetMode';
import { MOONS } from '../../universe/universes';
import { LAYER_TYPES, REACH } from '../../galaxy/surface/terrain';
import { spawnProblems, standable } from '../../galaxy/surface/sites/validity';
import { PLANET_ACHIEVE, PLANET_SITES, isBigPlanet, planetAchievements, planetMission, planetSite } from '.';
import { ACHIEVEMENTS } from '../../Achievements';
import { RM_MODELS } from './catalog';
import { RM_RIDES } from './rides';

const publicFile = (url) => new URL(`../../../../public${url}`, import.meta.url);

describe('the Rick and Morty sector’s big planets', () => {
  it('are planets of the sector, and moons on the universe map', () => {
    for (const id of Object.keys(PLANET_SITES)) {
      expect(PLANETS, id).toContain(id);
      expect(MOONS.some((m) => m.id === id), id).toBe(true);
    }
  });

  it('earn a place’s achievement once it’s found: Gazorpazorp’s gate, An exception for a Morty', () => {
    expect(planetAchievements('gazorpazorp', ['gate'])).toEqual(['gazorp']);
    expect(ACHIEVEMENTS.gazorp.name).toBe('An exception for a Morty');
    expect(planetAchievements('gazorpazorp', [])).toEqual([]);
    expect(planetAchievements('squanch', ['gate'])).toEqual([]);
    // (every one a site's own place, and an achievement there is)
    for (const [planet, places] of Object.entries(PLANET_ACHIEVE))
      for (const [place, a] of Object.entries(places)) {
        expect(planetSite(planet).places.some((p) => p.id === place), `${planet}: ${place}`).toBe(true);
        expect(ACHIEVEMENTS[a], a).toBeTruthy();
      }
  });

  it('are the ones C-137 hands over to the surface, and no others', () => {
    expect([...BIG].sort()).toEqual(Object.keys(PLANET_SITES).sort());
    for (const id of PLANETS) expect(isBigPlanet(id), id).toBe(isBigDestination(id));
    expect(isBigPlanet('nuptia')).toBe(false);
    expect(isBigPlanet('resort')).toBe(false);
    expect(isBigPlanet('citadel')).toBe(false);
  });

  it('are made whole on the galaxy’s rules, named as the map names them', () => {
    const site = planetSite('gazorpazorp');
    expect(site.id).toBe('gazorpazorp');
    expect(site.name).toBe('Gazorpazorp');
    expect(site.accent).toBe('#8dff5a');
    expect(Math.hypot(...site.land.at)).toBeLessThan(REACH);
    expect(site.reach).toBe(REACH);
    expect(planetSite('nuptia')).toBeNull();
    expect(planetSite('tatooine')).toBeNull();
  });

  it('have no mission yet (each planet’s own phase gives it one)', () => {
    expect(planetMission('gazorpazorp')).toBeNull();
    expect(planetMission('nuptia')).toBeNull();
  });

  it('leave their old box tasks behind: C-137 neither counts them nor points to them', () => {
    for (const id of BIG) {
      for (const t of destinationById(id).tasks) {
        expect(PLANET_TASKS.has(t.id), t.id).toBe(false);
        expect(TASKS.some((u) => u.id === t.id), t.id).toBe(false);
      }
    }
  });

  it('leave the small planets as they were', () => {
    const nuptia = planetOf('nuptia');
    for (const t of nuptia.tasks) expect(PLANET_TASKS.has(t.id), t.id).toBe(true);
    const fresh = planetProgress(nuptia, []);
    expect(nuptia.tasks).toContain(fresh.next);
    expect(fresh.total).toBe(TASKS.length);
  });
});

describe('Gazorpazorp, bare', () => {
  const site = planetSite('gazorpazorp');

  it('is land, sky and light the scene can build', () => {
    for (const l of site.ground.layers) expect(LAYER_TYPES, l.type).toContain(l.type);
    expect(site.sky.zenith).toMatch(/^#/);
    expect(site.light.sun).toBeGreaterThan(0);
    expect(site.fog.density).toBeGreaterThan(0);
    expect(spawnProblems(site)).toEqual([]);
  });

  it('sets the cruiser down on dry ground, and has the women’s gate to find within reach', () => {
    expect(standable(site, site.land.at)).toBe(true);
    const gate = site.places.find((p) => p.id === 'gate');
    expect(gate.name).toBe('The women’s gate');
    expect(Math.hypot(...gate.at) + gate.r).toBeLessThan(REACH);
    // (the gate stands as its model, the planets' catalogue's)
    const gateModel = site.things_all.find((t) => t.place === 'gate' && RM_MODELS[t.kind]);
    expect(gateModel.kind).toBe('gazorpgate');
    expect(existsSync(publicFile(RM_MODELS[gateModel.kind].url)), gateModel.kind).toBe(true);
  });

  it('has the men out in the wasteland, the cast’s rigged Gazorpians, and the rock sled parked by the cruiser', () => {
    const men = site.life.filter((a) => a.kind === 'gazorpian');
    expect(men.length).toBeGreaterThan(0);
    expect(RM_MODELS.gazorpian.rigged).toBe(true);
    for (const a of men) expect(standable(site, a.at), JSON.stringify(a.at)).toBe(true);
    const sled = site.rides.find((r) => r.kind === 'rocksled');
    expect(RM_RIDES[sled.kind]).toBeTruthy();
    expect(standable(site, sled.at)).toBe(true);
  });

  it('is data, with nothing of three.js in it', () => {
    const src = readFileSync(new URL('./sites/gazorpazorp.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from 'three'|THREE\./);
  });
});
