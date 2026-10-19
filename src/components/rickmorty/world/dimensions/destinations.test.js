import { describe, expect, it } from 'vitest';
import { AREAS, HOTSPOTS, LINKS, PEOPLE, ROOM_IDS, TASKS } from '../rules';
import { DEST_COL, DESTINATIONS, DIAL, GARAGE_BACK, PLANETS, destArea, destinationById, isBigPlanet, isPlanet, isWayHome, linkTarget, pageOf, planetStart, portalTarget, validArrive } from './destinations';

const inside = (a, x, z, pad = 0) => x >= a.x0 + pad && x <= a.x1 - pad && z >= a.z0 + pad && z <= a.z1 - pad;
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

describe('the destinations', () => {
  it('stand in their column, one row each', () => {
    expect(destArea(0)).toEqual({ x0: -470, x1: -330, z0: 875, z1: 925 });
    expect(destArea(3, 40).z0).toBe(1180);
    for (const d of DESTINATIONS) {
      expect(d.area.x0).toBeGreaterThanOrEqual(DEST_COL.x0);
      expect(d.area.x1).toBeLessThanOrEqual(DEST_COL.x1);
      for (const [id, a] of Object.entries(AREAS)) if (id !== d.id) expect(overlap(d.area, a), `${d.id} and ${id}`).toBe(false);
    }
  });
  it('have ids of their own', () => {
    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect([...ROOM_IDS, 'annex', 'street']).not.toContain(id);
    // and so do their hotspots, people and things to do, among everyone's
    for (const list of [HOTSPOTS, PEOPLE, TASKS]) {
      const all = list.map((o) => o.id);
      expect(new Set(all).size, 'unique ids').toBe(all.length);
    }
  });
  it('put the way in and the way home inside, clear of the edges and apart', () => {
    for (const d of DESTINATIONS) {
      expect(inside(d.area, d.arrive.x, d.arrive.z, 1.5), d.id).toBe(true);
      expect(inside(d.area, d.back.x, d.back.z, 1.5), d.id).toBe(true);
      expect(Math.hypot(d.arrive.x - d.back.x, d.arrive.z - d.back.z)).toBeGreaterThanOrEqual(3);
      for (const o of [...d.people, ...d.hotspots]) expect(inside(d.area, o.x, o.z), `${d.id}: ${o.id}`).toBe(true);
    }
  });
  it('each have a portal home to the garage, and are in the world’s lists', () => {
    for (const d of DESTINATIONS) {
      const home = LINKS.find((l) => l.id === `${d.id}-portal`);
      expect(home).toMatchObject({ area: d.id, kind: 'portal', to: 'garage', arrive: GARAGE_BACK });
      expect(AREAS[d.id]).toEqual(d.area);
      // (a big planet's box tasks are retired: it's a surface world now)
      for (const t of d.tasks) expect(TASKS.some((x) => x.id === t.id), t.id).toBe(!isBigPlanet(d.id));
      // what a talk finishes is one of the place's own things to do
      for (const id of Object.values(d.done)) expect(d.tasks.map((t) => t.id)).toContain(id);
      for (const id of Object.keys(d.done)) expect(d.hotspots.map((h) => h.id)).toContain(id);
    }
  });
});

describe('the dial', () => {
  it('lists the arcade first, then every destination but the planets, then the adventure’s five', () => {
    expect(DIAL[0].id).toBe('annex');
    expect(DIAL.map((d) => d.id).slice(1, -5)).toEqual(DESTINATIONS.filter((d) => !isPlanet(d.id)).map((d) => d.id));
    // (the other planets are landed on from the universe map only)
    const dialled = ['squanch', 'birdworld', 'gearworld', 'pluto'];
    for (const id of PLANETS.filter((p) => !dialled.includes(p))) expect(DIAL.map((d) => d.id)).not.toContain(id);
  });
  it('puts the Citadel and the four sector planets on the end of the dial', () => {
    expect(DIAL.slice(-5).map((d) => d.id)).toEqual(['citadel', 'birdworld', 'gearworld', 'pluto', 'squanch']);
    expect(DIAL).toHaveLength(32);
    expect(DIAL[0].id).toBe('annex');
    // a planet's row is its destination's name and note; the Citadel's is the site's own
    for (const d of DIAL.slice(-4)) expect(d).toEqual({ id: d.id, name: destinationById(d.id).name, note: destinationById(d.id).note });
    expect(DIAL.at(-5)).toMatchObject({ id: 'citadel', to: '/c-137/citadel' });
    expect(DIAL.at(-5).note).toBe('The Citadel of Ricks: every Rick there is, and a Council to keep them in line.');
  });
  it('sends the Citadel to its page, and every other dial place through the garage portal', () => {
    expect(pageOf('citadel')).toBe('/c-137/citadel');
    expect(pageOf('customs')).toBe(null);
    expect(pageOf('birdworld')).toBe(null);
    expect(pageOf('nope')).toBe(null);
    // the garage portal, dialled to the Citadel, names it and carries its page; to a planet, it goes to the planet's area
    const portal = LINKS.find((l) => l.id === 'garage-portal');
    expect(linkTarget(portal, 'citadel')).toMatchObject({ id: 'garage-portal', page: '/c-137/citadel', label: 'Through the portal to The Citadel' });
    expect(linkTarget(portal, 'birdworld')).toMatchObject({ to: 'birdworld', arrive: destinationById('birdworld').arrive });
    expect(linkTarget(portal, 'birdworld').page).toBeUndefined();
  });
  it('opens the portal on an open place only', () => {
    const open = (id) => id === 'customs' || id === 'annex';
    expect(portalTarget('annex', open)).toBe('annex');
    expect(portalTarget('vat', open)).toBe('annex'); // locked: the first open place
    expect(portalTarget('nowhere', open)).toBe('annex'); // not on the dial
    expect(portalTarget('vat')).toBe('vat'); // no lock given: as today
    expect(portalTarget('vat', () => false)).toBe('customs');
    expect(portalTarget('vat', (id) => id === 'customs')).toBe('customs');
  });
  it('sends the garage portal where it’s set, and anything unknown to the arcade', () => {
    expect(portalTarget('nope')).toBe('annex');
    expect(portalTarget(null)).toBe('annex');
    expect(portalTarget(DESTINATIONS[0].id)).toBe(DESTINATIONS[0].id);
    const portal = LINKS.find((l) => l.id === 'garage-portal');
    expect(linkTarget(portal, 'annex')).toBe(portal);
    expect(linkTarget(portal, 'x')).toBe(portal);
    const d = DESTINATIONS.filter((o) => !isPlanet(o.id))[2];
    expect(linkTarget(portal, d.id)).toMatchObject({ to: d.id, arrive: d.arrive });
    // a planet's no longer on the dial: an old setting for one is the arcade
    expect(portalTarget('gazorpazorp')).toBe('annex');
    expect(linkTarget(portal, 'gazorpazorp')).toBe(portal);
    // and nothing else is sent anywhere new
    const door = LINKS.find((l) => l.id === 'house-door');
    expect(linkTarget(door, d.id)).toBe(door);
  });
  it('keeps a saved spot that’s still somewhere, and sends the rest to the garage', () => {
    expect(validArrive({ area: 'nowhere', x: 0, z: 0 }, AREAS)).toEqual({ area: 'garage', ...GARAGE_BACK });
    expect(validArrive({ area: 'garage', x: -300, z: 100, face: 0 }, AREAS)).toEqual({ area: 'garage', x: -300, z: 100, face: 0 });
    const d = DESTINATIONS[0];
    expect(validArrive({ area: d.id, ...d.arrive }, AREAS).area).toBe(d.id);
    expect(validArrive({ area: d.id, x: 0, z: 0 }, AREAS).area).toBe('garage');
  });
});

describe('the planets', () => {
  it('are the ten of the Rick and Morty sector, in its order, each a destination', () => {
    expect(PLANETS).toEqual(['gazorpazorp', 'squanch', 'birdworld', 'gearworld', 'pluto', 'snakeplanet', 'nuptia', 'resort', 'cronenberg', 'purge']);
    for (const id of PLANETS) {
      expect(destinationById(id), id).toBeTruthy();
      expect(isPlanet(id), id).toBe(true);
    }
    for (const id of ['fantasy', 'customs', 'annex', 'garage', 'citadel', 'nope', '', null, undefined]) expect(isPlanet(id), String(id)).toBe(false);
  });
  it('start Morty at the planet’s way in', () => {
    for (const id of PLANETS) {
      const d = destinationById(id);
      expect(planetStart(id), id).toEqual({ area: id, x: d.arrive.x, z: d.arrive.z, face: d.arrive.face });
      expect(validArrive(planetStart(id), AREAS), id).toEqual(planetStart(id));
    }
    // a destination that isn't a planet, or nowhere at all, isn't a start
    for (const id of ['fantasy', 'nope', 'annex', null, undefined]) expect(planetStart(id), String(id)).toBe(null);
  });
  it('tell you to land on them from the map, not to dial them', () => {
    for (const id of PLANETS) {
      for (const t of destinationById(id).tasks) {
        expect(t.hint, t.id).toMatch(/^Land (on|at) .+ in the Rick and Morty sector, /);
        expect(t.hint, t.id).not.toMatch(/portal gun|Dial/);
      }
    }
  });
  it('know their own portal as the way home, and nothing else', () => {
    for (const id of PLANETS) {
      const home = LINKS.find((l) => l.id === `${id}-portal`);
      expect(isWayHome(home, id), id).toBe(true);
      expect(isWayHome(home, PLANETS.find((o) => o !== id)), id).toBe(false);
    }
    expect(isWayHome(LINKS.find((l) => l.id === 'garage-portal'), 'squanch')).toBe(false);
    expect(isWayHome(LINKS.find((l) => l.id === 'fantasy-portal'), 'squanch')).toBe(false);
    expect(isWayHome(null, 'squanch')).toBe(false);
    expect(isWayHome(undefined, 'squanch')).toBe(false);
  });
});

describe('a place’s set of things to find', () => {
  it('names its own hotspots and one of its own tasks, and the map points at the first', () => {
    for (const d of DESTINATIONS.filter((d) => d.collect)) {
      expect(d.tasks.map((t) => t.id)).toContain(d.collect.task);
      for (const id of d.collect.spots) expect(d.hotspots.map((h) => h.id), `${d.id}: ${id}`).toContain(id);
      expect(d.collect.spots.length).toBeGreaterThanOrEqual(2);
      expect(d.goal ?? Object.keys(d.done)[0]).toBeTruthy();
    }
  });
  it('is the Zigerions’ three slips', () => {
    const sim = DESTINATIONS.find((d) => d.id === 'simulation');
    expect(sim.collect).toEqual({ task: 'simulation', spots: ['twins', 'poptart', 'sun'], escape: { s: 45 } });
    expect(sim.people.find((p) => p.id === 'nebulon').y).toBe(3.2);
  });
});
