import { describe, expect, it } from 'vitest';
import { AREAS, HOTSPOTS, LINKS, MORTY, PEOPLE, ROOM_IDS, TASKS } from '../rules';
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

describe('a place that runs on power', () => {
  it('carries its cells between its own spots, and only the game ticks its task', () => {
    const powered = DESTINATIONS.filter((d) => d.power);
    expect(powered.map((d) => d.id)).toEqual(['microverse']);
    for (const d of powered) {
      const spots = d.hotspots.map((h) => h.id);
      expect(spots, d.id).toContain(d.power.from);
      expect(spots, d.id).toContain(d.power.to);
      expect(d.tasks.map((t) => t.id)).toContain(d.power.task);
      expect(spots).toContain(d.goal);
      expect(d.acts[d.power.from]).toBe('power-take');
      expect(d.acts[d.power.to]).toBe('power-give');
      expect(Object.values(d.done), `${d.id}: a talk ticks the task`).not.toContain(d.power.task);
      expect(d.power.lost.length).toBeGreaterThan(10);
      // the boxes' prompt reads as a way to hand a cell over, not only to look
      expect(d.hotspots.find((h) => h.id === d.power.to).verb).not.toBe('Look');
      // the loss is said by `who`, in their own voice (not of themselves by name)
      expect(d.power.lost).not.toContain(d.say[d.power.who].who.split(' ')[0]);
    }
  });
  it('is Zeep’s cells to the gooble boxes, four of them on 25 seconds of charge', () => {
    const micro = destinationById('microverse');
    expect(micro.power).toMatchObject({ task: 'microverse', from: 'zeepcells', to: 'gooble', need: 4, s: 25, who: 'zeep' });
    expect(micro.goal).toBe('zeepcells');
    expect(micro.unlock).toEqual({ zeep: 'microverse' });
  });
});

describe('a place that runs on a deal', () => {
  it('sells its own things, each looked over and taken by its own spot, and only the game ticks its task', () => {
    const dealing = DESTINATIONS.filter((d) => d.deal);
    expect(dealing.map((d) => d.id)).toEqual(['needful']);
    for (const d of dealing) {
      const spots = d.hotspots.map((h) => h.id);
      for (const id of d.deal.items) {
        expect(spots, `${d.id}: ${id}`).toContain(id);
        expect(d.say[id]?.text, `${d.id}: ${id} has a line`).toBeTruthy();
        expect(d.acts[id]).toBe(`deal-${id}`);
        // (its prompt reads as more than a look: a look over, and a take)
        expect(d.hotspots.find((h) => h.id === id).verb).not.toBe('Look');
      }
      expect(d.tasks.map((t) => t.id)).toContain(d.deal.task);
      expect(spots).toContain(d.goal);
      expect(Object.values(d.done), `${d.id}: a talk ticks the task`).not.toContain(d.deal.task);
      expect(d.deal.bad).toBeLessThan(d.deal.items.length);
      expect(d.deal.lost.length).toBeGreaterThan(10);
      expect(d.deal.lost).not.toMatch(/!/);
      expect(d.deal.lost.split(/[.?]\s/)).toHaveLength(1);
      // the loss is said by `who`, in their own voice (not of themselves by name)
      expect(d.deal.lost).not.toContain(d.say[d.deal.who].who.split(' ')[0]);
    }
  });
  it('is Mr. Needful’s five free things, all but one cursed, three looks and one to take', () => {
    const shop = destinationById('needful');
    expect(shop.deal).toMatchObject({ task: 'needful', items: ['typewriter', 'aftershave', 'cream', 'shopclock', 'shopmirror'], bad: 4, need: 1, looks: 3, who: 'needful' });
    expect(shop.goal).toBe('needful');
    expect(shop.unlock).toEqual({ needful: 'needful' });
  });
});

describe('a place that runs on a freeze', () => {
  it('has its lookouts and its spot to jump in at, and only the game ticks its task', () => {
    const still = DESTINATIONS.filter((d) => d.freeze);
    expect(still.map((d) => d.id)).toEqual(['vat']);
    for (const d of still) {
      const spot = d.hotspots.find((h) => h.id === d.freeze.spot);
      expect(spot, d.id).toBeTruthy();
      expect(spot.verb).not.toBe('Look');
      expect(d.acts[d.freeze.spot]).toBe('freeze-in');
      expect(d.tasks.map((t) => t.id)).toContain(d.freeze.task);
      expect(Object.values(d.done), `${d.id}: a talk ticks the task`).not.toContain(d.freeze.task);
      expect(d.collect?.task, `${d.id}: a collect ticks the task`).not.toBe(d.freeze.task);
      expect(d.goal).toBe(d.freeze.spot);
      expect(d.people.filter((p) => p.ai?.lookout).length).toBeGreaterThan(0);
      expect(d.freeze.lost.length).toBeGreaterThan(10);
      expect(d.freeze.lost).not.toMatch(/!/);
      expect(d.freeze.lost.split(/[.?]\s/)).toHaveLength(1);
    }
  });
  it('is the two Gromflomites at the vat of acid, and its win is the fake death’s achievement', () => {
    const vat = destinationById('vat');
    expect(vat.freeze).toMatchObject({ task: 'vat', spot: 'vatrim', unlock: 'vat' });
    expect(vat.people.filter((p) => p.ai?.lookout).map((p) => p.id)).toEqual(['vgromflomite-a', 'vgromflomite-b']);
    expect(vat.collect).toBe(null);
  });
});

describe('a place that runs on a sequence', () => {
  it('has its sets as spots of their own, the countdown at a spot apart, and only the game ticks its task', () => {
    const running = DESTINATIONS.filter((d) => d.sequence);
    expect(running.map((d) => d.id)).toEqual(['cablestudio']);
    for (const d of running) {
      const sq = d.sequence;
      const spots = d.hotspots.map((h) => h.id);
      for (const id of sq.items) {
        expect(spots, `${d.id}: ${id} has a spot`).toContain(id);
        expect(d.say[id]?.text, `${d.id}: ${id} has a line`).toBeTruthy();
        expect(d.acts[id]).toBe(`sequence-${id}`);
        expect(d.hotspots.find((h) => h.id === id).verb).toBe('Switch on');
      }
      expect(spots).toContain(sq.start);
      expect(sq.items).not.toContain(sq.start);
      expect(d.acts[sq.start]).toBe('sequence-start');
      expect(d.goal).toBe(sq.start);
      // (a set used before the countdown says to start it, one sentence)
      expect(sq.early).toMatch(/^[A-Z][^!]*\.$/);
      expect(sq.early.split(/[.?]\s/)).toHaveLength(1);
      expect(sq.need).toBeLessThanOrEqual(sq.items.length);
      expect(d.tasks.map((t) => t.id)).toContain(sq.task);
      expect(d.collect?.task, `${d.id}: a collect ticks the task`).not.toBe(sq.task);
      expect(Object.values(d.done), `${d.id}: a talk ticks the task`).not.toContain(sq.task);
      expect(Object.values(d.unlock), `${d.id}: a talk gives the achievement`).not.toContain(sq.unlock);
      expect(sq.lost).not.toMatch(/!/);
      expect(sq.lost).not.toContain('Rick');
      expect(sq.lost.split(/[.?]\s/)).toHaveLength(1);
    }
  });
  it('is the cable studio’s seven sets, five in a running order dealt each run, forty-five seconds from the booth', () => {
    const studio = destinationById('cablestudio');
    expect(studio.sequence).toMatchObject({ task: 'cablestudio', start: 'cablebooth', items: ['set-ants', 'set-legs', 'set-sneezy', 'set-field', 'set-doors', 'set-bits', 'set-shmlo'], need: 5, s: 45, who: null, unlock: 'cablestudio' });
    expect(studio.sequence.order).toBe(undefined);
    expect(studio.sequence.early).toBe('The studio isn’t counting down yet: start it at the control booth.');
    expect(studio.hotspots.find((h) => h.id === 'cablebooth').verb).toBe('Start the countdown');
    expect(studio.collect).toBe(null);
    expect(studio.done).toEqual({});
    expect(studio.unlock).toEqual({});
  });
  it('deals no running order that can’t be walked at a run in sixty per cent of the clock', () => {
    for (const d of DESTINATIONS.filter((p) => p.sequence)) {
      const sq = d.sequence;
      const at = (id) => d.hotspots.find((h) => h.id === id);
      // (straight lines from the start spot through every ordered `need` of the sets: the longest)
      const longest = (from, left, n) => (n === 0 ? 0 : Math.max(...left.map((id) => Math.hypot(at(id).x - from.x, at(id).z - from.z) + longest(at(id), left.filter((o) => o !== id), n - 1))));
      const far = longest(at(sq.start), sq.items, sq.need);
      expect(far, `${d.id}: ${far.toFixed(1)} m`).toBeLessThanOrEqual(0.6 * sq.s * MORTY.run);
    }
  });
});

describe('a place that runs on a climb', () => {
  it('has its stairs and its top as ledges, the stairs’ foot and the giants as spots, and only the game ticks its task', () => {
    const climbing = DESTINATIONS.filter((d) => d.climb);
    expect(climbing.map((d) => d.id)).toEqual(['fantasy']);
    for (const d of climbing) {
      const cl = d.climb;
      const ledge = (id) => d.solids.find((s) => s.id === id && s.ledge);
      for (const s of cl.stairs) {
        expect(s.steps.length, `${d.id}: ${s.id}`).toBeGreaterThan(0);
        for (const id of s.steps) expect(ledge(id), `${d.id}: ${id} is a ledge`).toBeTruthy();
      }
      expect(ledge(cl.top), `${d.id}: its top is a ledge`).toBeTruthy();
      const spots = d.hotspots.map((h) => h.id);
      expect(spots).toContain(cl.foot);
      expect(spots).toContain(cl.spot);
      expect(d.say[cl.foot]?.text).toBeTruthy();
      expect(d.say[cl.spot]?.text).toBeTruthy();
      // (the spot at the top is up on it: its pin floats there)
      expect(d.hotspots.find((h) => h.id === cl.spot).y).toBe(ledge(cl.top).top);
      expect(d.goal).toBe(cl.foot);
      expect(d.tasks.map((t) => t.id)).toContain(cl.task);
      expect(d.collect?.task, `${d.id}: a collect ticks the task`).not.toBe(cl.task);
      expect(Object.values(d.done), `${d.id}: a talk ticks the task`).not.toContain(cl.task);
      expect(Object.values(d.unlock), `${d.id}: a talk gives the achievement`).not.toContain(cl.unlock);
      for (const line of [cl.lost, cl.fell]) {
        expect(line).not.toMatch(/!/);
        expect(line).not.toContain('Rick');
        expect(line.split(/[.?]\s/)).toHaveLength(1);
      }
    }
  });
  it('is Fantasy World’s three Stair Goblins and the beanstalk to the giants', () => {
    const fantasy = destinationById('fantasy');
    expect(fantasy.climb).toMatchObject({ task: 'fantasy', top: 'beanstalk', foot: 'goblins', spot: 'giants', who: null, unlock: 'fantasy' });
    expect(fantasy.climb.stairs).toEqual([
      { id: 'g1', steps: ['g1-low', 'g1-mid', 'g1-top'] },
      { id: 'g2', steps: ['g2-low', 'g2-mid', 'g2-top'] },
      { id: 'g3', steps: ['g3-low', 'g3-mid', 'g3-top'] },
    ]);
    expect(fantasy.climb.lost).toBe('The stair bit you: one that shivers is about to bite.');
    expect(fantasy.climb.fell).toBe('A long way down: back up the stairs, then.');
    expect(fantasy.done).toEqual({});
    expect(fantasy.unlock).toEqual({});
    expect(fantasy.tasks).toEqual([{ id: 'fantasy', name: 'Climb the beanstalk to the giants', hint: 'Dial Fantasy World on the portal gun in Rick’s garage, go up the Stair Goblins by the tavern while they keep still, and climb the beanstalk to the giants.' }]);
    expect(fantasy.say.giants).toEqual({ who: 'A giant', text: 'A little man, all the way up our beanstalk. Wipe your feet. And mind the edge: it’s cloud.' });
    expect(fantasy.say.fmeeseeks).toEqual({ who: 'A Meeseeks', text: 'Existence is pain to a Meeseeks, Morty. Give me something to do.' });
  });
  it('gives ledges to no other place', () => {
    for (const d of DESTINATIONS.filter((p) => p.id !== 'fantasy')) expect(d.solids.filter((s) => s.ledge || s.top != null).map((s) => s.id), d.id).toEqual([]);
  });
});

describe('a place that plays a rhythm', () => {
  it('has its song at a spot of its own, with its line, and only the song ticks its task', () => {
    const singing = DESTINATIONS.filter((d) => d.rhythm);
    expect(singing.map((d) => d.id)).toEqual(['schwifty']);
    for (const d of singing) {
      const spot = d.hotspots.find((h) => h.id === d.rhythm.spot);
      expect(spot, `${d.id}: ${d.rhythm.spot} is a spot`).toBeTruthy();
      expect(d.say[spot.id]?.text, `${d.id}: its spot has a line`).toBeTruthy();
      expect(d.goal).toBe(spot.id);
      expect(d.tasks.map((t) => t.id)).toContain(d.rhythm.task);
      expect(d.collect?.task, `${d.id}: a collect ticks the task`).not.toBe(d.rhythm.task);
      expect(Object.values(d.done), `${d.id}: a talk ticks the task`).not.toContain(d.rhythm.task);
      expect(Object.values(d.unlock), `${d.id}: a talk gives the achievement`).not.toContain(d.rhythm.unlock);
    }
  });
  it('is Get Schwifty’s mic, its achievement handed over by the stage', () => {
    const show = destinationById('schwifty');
    expect(show.rhythm).toEqual({ task: 'schwifty', spot: 'mic', unlock: 'schwifty' });
    expect(show.hotspots.find((h) => h.id === 'mic').verb).toBe('Get schwifty');
    expect(show.collect).toBe(null);
  });
});

describe('a place that runs on a find', () => {
  it('has its candidates as people with spots of their own, each with a tell, and only the game ticks its task', () => {
    const finding = DESTINATIONS.filter((d) => d.find);
    expect(finding.map((d) => d.id)).toEqual(['jerryboree']);
    for (const d of finding) {
      const spots = d.hotspots.map((h) => h.id);
      const people = d.people.map((p) => p.id);
      for (const id of d.find.items) {
        expect(people, `${d.id}: ${id} is someone`).toContain(id);
        expect(spots, `${d.id}: ${id} has a spot`).toContain(id);
        expect(d.say[id]?.text, `${d.id}: ${id} has a line`).toBeTruthy();
        expect(d.acts[id]).toBe(`find-${id}`);
        expect(d.hotspots.find((h) => h.id === id).verb).toBe('Talk');
        const tell = d.find.tells[id];
        expect(tell, `${d.id}: ${id} has a tell`).toBeTruthy();
        expect(tell.length).toBeLessThanOrEqual(36);
        expect(tell).not.toMatch(/[!:.]/);
      }
      expect(d.find.tells.ours.length).toBeLessThanOrEqual(36);
      expect(d.find.tells.ours).not.toMatch(/[!:.]/);
      const tells = [d.find.tells.ours, ...d.find.items.map((id) => d.find.tells[id])];
      expect(new Set(tells).size).toBe(tells.length);
      expect(d.tasks.map((t) => t.id)).toContain(d.find.task);
      // the map's marker on a spot, never on a candidate (it would give ours away)
      expect(spots).toContain(d.goal);
      expect(d.find.items).not.toContain(d.goal);
      expect(Object.values(d.done), `${d.id}: a talk ticks the task`).not.toContain(d.find.task);
      expect(Object.values(d.unlock), `${d.id}: a talk gives the achievement`).not.toContain(d.find.unlock);
      expect(d.find.lost).not.toMatch(/!/);
      expect(d.find.lost).not.toContain('Rick');
      expect(d.find.lost.split(/[.?]\s/)).toHaveLength(1);
    }
  });
  it('is the Jerryboree’s six Jerrys standing still, ours dealt each run, forty-five seconds and fifteen a wrong pick', () => {
    const daycare = destinationById('jerryboree');
    expect(daycare.find).toMatchObject({ task: 'jerryboree', items: ['jerryreal', 'jerrytv', 'jerrygown', 'jerrytux', 'jerrytrack', 'jerryrobe'], s: 45, cost: 15, who: 'receptionist', unlock: 'jerryboree' });
    expect(daycare.find.ours).toBe(undefined);
    expect(daycare.goal).toBe('receptionist');
    expect(daycare.done).toEqual({});
    expect(daycare.unlock).toEqual({});
  });
  it('has each Jerry’s tell as something he does, never something he says, so it can’t contradict the line he’s just said', () => {
    const daycare = destinationById('jerryboree');
    for (const [id, tell] of Object.entries(daycare.find.tells)) expect(tell, id).not.toMatch(/\b(asks?|says?|shushes|tells?)\b/);
    expect(daycare.find.tells.ours).toBe('He offers you an apple');
    expect(daycare.tasks[0].hint).toContain('ours offers you an apple');
  });
});

describe('St. Gloopy Noops', () => {
  it('is a hunt: past the doctors to the theatre, Jerry’s things back, then out through the portal on the clock', () => {
    const ward = destinationById('gloopynoops');
    expect(ward.collect).toEqual({ task: 'gloopynoops', spots: ['shrimply', 'jerrysthings'], escape: { s: 30 } });
    expect(ward.goal).toBe('jerrysthings');
    const hunters = ward.people.filter((p) => p.ai?.hunt);
    expect(hunters.map((p) => p.id)).toEqual(['gdoctor-a', 'gdoctor-b', 'gdoctor-c']);
    const spots = ward.hotspots.map((h) => h.id);
    for (const p of hunters) {
      expect(p.who, p.id).toBe('glipglop');
      expect(p.roams, p.id).toBe(true);
      expect(spots, `${p.id} isn’t a spot`).not.toContain(p.id);
      expect(ward.say[p.id]?.who, `${p.id} has a name for a catch`).toBeTruthy();
    }
    expect(ward.done).toEqual({});
    expect(ward.unlock).toEqual({});
    expect(ward.hotspots.find((h) => h.id === 'jerrysthings').verb).not.toBe('Look');
    // (said in a doctor's voice, the toast naming him: never "A doctor" again)
    for (const line of [ward.caught, ward.spotted, ward.say.jerrysthings.text]) {
      expect(line).not.toMatch(/!/);
      expect(line.split(/[.?]\s/)).toHaveLength(1);
    }
    for (const line of [ward.caught, ward.spotted]) expect(line.startsWith('A doctor')).toBe(false);
    // (a catch starts the whole visit over, Shrimply too, and it can come before anything's taken)
    expect(ward.caught).toContain('your visit starts over');
    expect(ward.caught).not.toContain('Jerry’s things');
  });
});

describe('Anatomy Park', () => {
  it('is a chase: the park map’s four pieces while the diseases hunt, then out through the portal on the clock', () => {
    const park = destinationById('anatomy');
    expect(park.collect).toEqual({ task: 'anatomy', spots: ['mapkiosk', 'mapspleen', 'maprib', 'mapboat'], escape: { s: 40 } });
    expect(park.goal).toBe('mapkiosk');
    const hunters = park.people.filter((p) => p.ai?.hunt);
    expect(hunters.map((p) => p.who)).toEqual(['hepatitis', 'tuberculosis', 'gonorrhoea', 'ecoli']);
    const spots = new Set(park.hotspots.map((h) => h.id));
    for (const h of hunters) {
      expect(spots.has(h.id), `${h.id} is a hotspot too`).toBe(false);
      expect(park.say[h.id]?.who, `${h.id} has no name to be caught by`).toBeTruthy();
    }
    expect(Object.values(park.done)).not.toContain('anatomy');
    expect(park.unlock).toEqual({ pancreas: 'anatomy' });
    expect(park.caught.length).toBeGreaterThan(10);
  });
});
