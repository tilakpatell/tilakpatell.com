import { describe, expect, it } from 'vitest';
import POINTS from '../../../../data/bf2017/points.json';
import { EARN, HERO_ICON, canAfford, earnFor, offersFor, onObjective, priceOf, sideIdOf, whole } from './points';
import { ASSAULTS } from './assaults';
import { warSideOf } from './assault';
import { HEROES, heroById } from '../../heroes';
import { SIDES } from '../../sides';

const MAP = { system: 'hoth', sides: { attack: { id: 'empire' }, defend: { id: 'rebels' } } };
const ids = (list) => list.map((o) => o.id);

describe('what a deed earns', () => {
  it('is the game’s table, and a post taken by hand', () => {
    expect(EARN).toMatchObject({ kill: 100, assist: 50, objectiveTick: 10, heroKill: 250, squadSpawn: 25, capture: 200 });
    expect(EARN.source).toBeUndefined();
    expect(EARN.kill).toBe(POINTS.earn.kill);
  });
  it('goes onto yours, a share of it for a share of a second', () => {
    const b = { you: { points: 0 } };
    expect(earnFor(b, 'kill')).toBe(100);
    earnFor(b, 'objectiveTick', 0.5);
    expect(b.you.points).toBe(105);
    expect(earnFor(b, 'nothing')).toBe(0);
    // (ten tenths of a second make a whole tick, a float's hair short of it or not)
    const c = { you: { points: 0 } };
    for (let i = 0; i < 10; i++) earnFor(c, 'objectiveTick', 0.1);
    expect(whole(c.you.points)).toBe(10);
  });
});

describe('the prices', () => {
  it('a class is free, a hero the game’s by its own id for them, else the default', () => {
    expect(priceOf('class', 'trooper-rebel-assault')).toBe(0);
    expect(priceOf('hero', 'luke')).toBe(POINTS.cost.heroes.luke);
    expect(priceOf('hero', 'chewie')).toBe(POINTS.cost.heroes.chewbacca);
    expect(priceOf('hero', 'han')).toBe(POINTS.cost.heroes.hansolo);
    expect(priceOf('hero', 'vader')).toBe(POINTS.cost.heroes.darthvader);
    expect(priceOf('hero', 'palpatine')).toBe(POINTS.cost.heroes.emperor);
    expect(priceOf('hero', 'nobody')).toBe(POINTS.cost.heroes.default);
    expect(priceOf('hero', 'luke')).toBe(4000);
  });
  it('an enforcer the level’s own table where the world has one, else the default list', () => {
    expect(priceOf('enforcer', 'deathtrooper', { system: 'hoth' })).toBe(POINTS.cost.byMode.galacticAssault.hoth_01.units.DeathTrooper);
    expect(priceOf('enforcer', 'wookiee', { system: 'scarif' })).toBe(POINTS.cost.units.WookieWarrior);
    // (where a level's own price differs from the list's: Endor's Ewoks)
    expect(POINTS.cost.byMode.galacticAssault.endor_01.units.EwokRebel).not.toBe(POINTS.cost.units.EwokRebel);
    expect(priceOf('enforcer', 'EwokRebel', { system: 'endor' })).toBe(POINTS.cost.byMode.galacticAssault.endor_01.units.EwokRebel);
    expect(priceOf('enforcer', 'EwokRebel', { system: 'scarif' })).toBe(POINTS.cost.units.EwokRebel);
    // (the super battle droid: the game's B2, among its others)
    expect(priceOf('enforcer', 'superdroid', { system: 'geonosis' })).toBe(1500);
  });
});

describe('the spawn screen’s offers', () => {
  it('are the four classes for nothing, the side’s enforcer, then its heroes', () => {
    const list = offersFor({ mission: MAP, side: 'defend', points: 0 });
    expect(list.map((o) => o.kind)).toEqual(['class', 'class', 'class', 'class', 'enforcer', 'hero', 'hero', 'hero', 'hero', 'hero']);
    expect(list.slice(0, 4).map((o) => o.name)).toEqual(['Assault', 'Heavy', 'Officer', 'Specialist']);
    expect(list.slice(0, 4).every((o) => o.cost === 0 && o.affordable)).toBe(true);
    // (the world's own kit: Hoth troopers on the ice)
    expect(list[0]).toMatchObject({ id: 'trooper-rebel-assault', heroId: 'trooper-rebel-assault', body: 'hothtrooper' });
    expect(list[4]).toMatchObject({ kind: 'enforcer', body: 'wookiee', gun: 'bowcaster', cost: 1500, affordable: false });
    expect(ids(list.slice(5))).toEqual(['luke', 'leia', 'han', 'chewie', 'lando']);
    expect(list.find((o) => o.id === 'luke')).toMatchObject({ name: 'Luke Skywalker', cost: 4000, affordable: false, icon: HERO_ICON });
  });
  it('the dark side gets its own, and the Empire a death trooper', () => {
    const list = offersFor({ mission: MAP, side: 'attack', points: 0 });
    expect(list[0].body).toBe('snowtrooper');
    expect(list[4]).toMatchObject({ body: 'deathtrooper', gun: 'dlt19', cost: 1500 });
    expect(ids(list.slice(5))).toEqual(['vader', 'palpatine', 'bobafett', 'bossk']);
  });
  it('a Clone Wars world offers its own war’s heroes, and the droids a super battle droid', () => {
    const geo = ASSAULTS.geonosis;
    const rep = offersFor({ mission: geo, side: 'attack', points: 0 });
    expect(rep[0].body).toBe('clone');
    expect(rep[4].body).toBe('wookiee');
    expect(ids(rep.filter((o) => o.kind === 'hero'))).toEqual(['obiwan', 'anakin']);
    const sep = offersFor({ mission: geo, side: 'defend', points: 0 });
    expect(sep[4]).toMatchObject({ body: 'superdroid', gun: 'e5' });
    expect(ids(sep.filter((o) => o.kind === 'hero'))).toEqual(['maul', 'dooku']);
  });
  it('greys what you can’t afford until you’ve earned it', () => {
    const at = (points) => offersFor({ mission: MAP, side: 'defend', points });
    expect(at(1499).find((o) => o.kind === 'enforcer').affordable).toBe(false);
    expect(at(1500).find((o) => o.kind === 'enforcer').affordable).toBe(true);
    expect(at(3999).find((o) => o.id === 'luke').affordable).toBe(false);
    expect(at(4000).find((o) => o.id === 'luke').affordable).toBe(true);
    expect(canAfford(4000, { cost: 4000 })).toBe(true);
    expect(canAfford(3999.5, { cost: 4000 })).toBe(false);
    expect(canAfford(0, null)).toBe(false);
  });
  it('never offers a hero still to come, nor anyone from elsewhere; every one is someone heroes.js knows', () => {
    const soon = HEROES.filter((h) => h.soon).map((h) => h.id);
    const elsewhere = HEROES.filter((h) => h.side === 'elsewhere').map((h) => h.id);
    expect(soon.length).toBeGreaterThan(0);
    for (const m of Object.values(ASSAULTS))
      for (const side of ['attack', 'defend']) {
        const list = offersFor({ mission: m, side, points: 1e6 });
        expect(list.length, `${m.system} ${side}`).toBeGreaterThan(5);
        for (const o of list) {
          expect(heroById(o.heroId), `${m.system}: ${o.heroId}`).toBeTruthy();
          expect(soon).not.toContain(o.heroId);
          expect(elsewhere).not.toContain(o.heroId);
          if (o.kind === 'hero') expect(heroById(o.heroId).lean).toBe(SIDES[sideIdOf(m, side)].stance);
        }
      }
  });
  it('reads the map’s side as assault.js’s warSideOf does', () => {
    for (const m of Object.values(ASSAULTS)) for (const k of ['attack', 'defend']) expect(sideIdOf(m, k)).toBe(warSideOf(m, k));
    expect(sideIdOf(null, 'empire')).toBe('empire');
    expect(offersFor({ side: 'hutt' })).toEqual([]);
  });
});

describe('the post you’re in pays its tick', () => {
  const b = { you: { side: 'attack' } };
  it('while your side takes it, or holds it with the enemy inside', () => {
    expect(onObjective(b, { owner: null, taking: 'attack', inside: { attack: 1, defend: 0 } })).toBe(true);
    expect(onObjective(b, { owner: 'defend', taking: null, inside: { attack: 2, defend: 1 } })).toBe(true);
    expect(onObjective(b, { owner: 'attack', taking: null, inside: { attack: 1, defend: 1 } })).toBe(true);
  });
  it('not while it’s quietly yours, nor while you’re outnumbered in theirs', () => {
    expect(onObjective(b, { owner: 'attack', taking: null, inside: { attack: 1, defend: 0 } })).toBe(false);
    expect(onObjective(b, { owner: 'defend', taking: null, inside: { attack: 1, defend: 2 } })).toBe(false);
    expect(onObjective(b, { owner: null, taking: 'defend', inside: { attack: 1, defend: 2 } })).toBe(false);
  });
});
