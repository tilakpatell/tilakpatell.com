import { describe, expect, it } from 'vitest';
import { AREAS, HOTSPOTS, LINKS, MORTY, PEOPLE, ROOM_IDS, TASKS } from '../rules';
import { newDeal, stepDeal } from '../games/deal';
import { gameGoal } from './gameGoal';
import { ACHIEVEMENTS } from '../../../Achievements';
import { KEYS } from '../../../hangar/skills/tree';
import { DEST_COL, DESTINATIONS, DIAL, GARAGE_BACK, PLANETS, destArea, destinationById, isBigPlanet, isPlanet, isWayHome, linkTarget, pageOf, planetStart, portalTarget, validArrive } from './destinations';

const inside = (a, x, z, pad = 0) => x >= a.x0 + pad && x <= a.x1 - pad && z >= a.z0 + pad && z <= a.z1 - pad;
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

describe('the destinations', () => {
  it('give every place whose task has an achievement a way to earn it', () => {
    // (a spot's unlock, an escape, a game's or a duel's unlock, or the place's own `achieve` once its task's done;
    // the Vindicators' is RmWorld's own, at the rooms' win, and the eyepatch Morty's the lair's builder's: ./evilrick.js)
    const BY_THE_WORLD = ['vindicators', 'evilmorty'];
    const ways = (d) =>
      new Set([
        ...Object.values(d.unlock ?? {}),
        ...(d.escape ? [d.escape.task] : []),
        ...(d.collect?.escape ? [d.collect.task] : []),
        ...['power', 'deal', 'freeze', 'find', 'sequence', 'rhythm', 'climb'].map((k) => d[k]?.unlock).filter(Boolean),
        ...d.people.map((p) => p.ai?.hunt?.duel?.unlock).filter(Boolean),
        ...(d.achieve ? [d.achieve] : []),
        ...BY_THE_WORLD,
      ]);
    const none = DESTINATIONS.flatMap((d) => d.tasks.filter((t) => t.id in ACHIEVEMENTS && !ways(d).has(t.id)).map((t) => `${d.id}: ${t.id}`));
    expect(none).toEqual([]);
  });
  it('name every Rick and Morty achievement differently', () => {
    const names = KEYS.rickmorty.map((k) => ACHIEVEMENTS[k].name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });
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
  it('point the map at one of their own spots for each thing to do', () => {
    // (as RmWorld's GOAL has it: the talk that finishes it, the escape's first spot, or the place's goal)
    for (const d of DESTINATIONS)
      for (const t of d.tasks) {
        const spot = Object.keys(d.done).find((k) => d.done[k] === t.id) ?? d.escape?.after ?? d.escape?.spot ?? d.goal;
        expect(d.hotspots.map((h) => h.id), `${d.id}: ${t.id}`).toContain(spot);
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
    expect(dealing.map((d) => d.id)).toEqual(['needful', 'pluto']);
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
      // (where the map falls back to once the game has nothing left to mark: never one of the things, which may be a lie)
      expect(d.deal.items, `${d.id}: its goal`).not.toContain(d.goal);
      expect(Object.values(d.done), `${d.id}: a talk ticks the task`).not.toContain(d.deal.task);
      // (cursed: a count dealt each run, short of them all; or the very ones, each a thing for sale, leaving enough to win)
      if (Array.isArray(d.deal.bad)) {
        for (const id of d.deal.bad) expect(d.deal.items, `${d.id}: ${id}`).toContain(id);
        expect(new Set(d.deal.bad).size, d.id).toBe(d.deal.bad.length);
        expect(d.deal.bad.length, d.id).toBeLessThan(d.deal.items.length);
        expect(d.deal.items.length - d.deal.bad.length, d.id).toBeGreaterThanOrEqual(d.deal.need);
      } else expect(d.deal.bad).toBeLessThan(d.deal.items.length);
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
  it('is Pluto’s four claims on the palace, two of them lies: two weighed up at most, two told the king', () => {
    const pluto = destinationById('pluto');
    const ITEMS = ['claim-growing', 'claim-moons', 'claim-mines', 'claim-planet'];
    expect(pluto.deal).toMatchObject({ task: 'pluto', items: ITEMS, bad: ['claim-growing', 'claim-mines'], need: 2, looks: 2, who: 'scroopy' });
    expect(pluto.deal.lost).toBe('That’s a lie, kid, and the whole plain heard it: back to the portal with you.');
    const w = pluto.deal.words;
    expect([w.good, w.bad, w.blind, w.taken(1, 2)]).toEqual(['True: once more to tell the king', 'Not true: leave it out', 'No checks left: once more to chance it', 'Told the king 1 of 2']);
    expect(pluto.deal.meter).toEqual({ title: 'The king’s ear', label: 'Checks', icon: 'crown' });
    // (the map marks the first claim to weigh up, then the one to tell; with nothing left to mark, the king, never a lie)
    expect(pluto.goal).toBe('flippynips');
    const weighed = (uses) => uses.reduce((g, use) => stepDeal(g, { use }), newDeal({ items: pluto.deal.items, bad: pluto.deal.bad, need: 2, looks: 2 }));
    expect(gameGoal(pluto, { deal: weighed([]) })).toBe('claim-growing');
    expect(gameGoal(pluto, { deal: weighed(['claim-growing', 'claim-moons']) })).toBe('claim-moons');
    expect(gameGoal(pluto, { deal: weighed(['claim-growing', 'claim-moons', 'claim-moons', 'claim-mines', 'claim-planet']) })).toBe(null);
    // (the podium no longer ticks it; the achievement stays on it)
    expect(pluto.done).toEqual({});
    expect(pluto.unlock).toEqual({ podium: 'pluto' });
    expect(pluto.tasks).toEqual([{ id: 'pluto', name: 'Tell the king what’s true', hint: 'Land on Pluto in the Rick and Morty sector, and tell the king only the claims on his palace that are true: weigh up two at most, and Scroopy calls out a lie.' }]);
    const at = (id) => pluto.hotspots.find((h) => h.id === id);
    const c = pluto.centre;
    expect(ITEMS.map((id) => [at(id).label, at(id).verb, at(id).r, +(at(id).x - c.x).toFixed(3), +(at(id).z - c.z).toFixed(3)])).toEqual([
      ['Pluto is growing', 'Weigh up', 1.2, -5.4, -13.2],
      ['Pluto has two moons', 'Weigh up', 1.2, -2.2, -13.2],
      ['Pluto has no mines', 'Weigh up', 1.2, 2.2, -13.2],
      ['Pluto is a planet', 'Weigh up', 1.2, 5.4, -13.2],
    ]);
    // (each claim far enough from the king that the two prompts never fight)
    for (const id of ITEMS) expect(Math.hypot(at(id).x - at('flippynips').x, at(id).z - at('flippynips').z), id).toBeGreaterThanOrEqual(2.5);
    expect(ITEMS.map((id) => pluto.say[id])).toEqual([
      { who: null, text: 'Scroopy’s sign across the plain says otherwise, in red.' },
      { who: null, text: 'Two moons hang low over the palace, and the king has them counted every night.' },
      { who: null, text: 'Out past the plain the mine wheels are turning, all night long.' },
      { who: null, text: 'The king’s favourite, and the crowd mouths along before you’ve said it.' },
    ]);
    expect(pluto.say.podium).toEqual({ who: null, text: 'You step up to the podium. “Pluto is a planet.” They cheer for a long, long time.' });
    // played: weighing never loses, nor does telling a true claim, nor a lie weighed and used again; telling a lie does
    const deal = () => newDeal({ items: ITEMS, bad: pluto.deal.bad, need: 2, looks: 2 });
    const play = (uses) => uses.reduce((g, use) => stepDeal(g, { use }), deal());
    expect(play(['claim-growing', 'claim-moons', 'claim-mines', 'claim-planet']).phase).toBe('run');
    expect(play(['claim-growing', 'claim-growing', 'claim-moons', 'claim-moons']).phase).toBe('run');
    expect(play(['claim-moons', 'claim-moons', 'claim-planet', 'claim-planet']).phase).toBe('won');
    expect(play(['claim-growing', 'claim-moons', 'claim-mines', 'claim-mines']).phase).toBe('lost');
    expect(play(['claim-moons', 'claim-planet', 'claim-growing', 'claim-growing']).phase).toBe('lost');
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
  it('has its sets as spots of their own, the countdown at a spot apart or none, and only the game ticks its task', () => {
    const running = DESTINATIONS.filter((d) => d.sequence);
    expect(running.map((d) => d.id)).toEqual(['gearworld', 'heistcon', 'cablestudio']);
    for (const d of running) {
      const sq = d.sequence;
      const spots = d.hotspots.map((h) => h.id);
      for (const id of sq.items) {
        expect(spots, `${d.id}: ${id} has a spot`).toContain(id);
        expect(d.say[id]?.text, `${d.id}: ${id} has a line`).toBeTruthy();
        expect(d.acts[id]).toBe(`sequence-${id}`);
      }
      // (a place's sets share one verb, and it's never a Look)
      const verbs = [...new Set(sq.items.map((id) => d.hotspots.find((h) => h.id === id).verb))];
      expect(verbs, d.id).toHaveLength(1);
      expect(verbs[0], d.id).not.toBe('Look');
      if (sq.start) {
        expect(spots).toContain(sq.start);
        expect(sq.items).not.toContain(sq.start);
        expect(d.acts[sq.start]).toBe('sequence-start');
        expect(d.goal).toBe(sq.start);
        // (a set used before the countdown says to start it, one sentence)
        expect(sq.early).toMatch(/^[A-Z][^!]*\.$/);
        expect(sq.early.split(/[.?]\s/)).toHaveLength(1);
        // (a countdown held for a crew: exactly where a collect that ticks nothing shares the task, and no escape ticks it)
        expect(Boolean(sq.before), d.id).toBe(Boolean(d.collect?.start));
        if (sq.before) {
          expect(sq.before).toMatch(/^[A-Z][^!]*\.$/);
          expect(sq.before.split(/[.?]\s/)).toHaveLength(1);
          expect(d.collect, d.id).toMatchObject({ task: sq.task, start: true });
          expect(d.collect.escape, d.id).toBe(undefined);
        }
      } else {
        // (or the first set used starts the clock: no countdown spot, nothing early, nothing held, the map at one of the sets)
        expect(Object.values(d.acts), d.id).not.toContain('sequence-start');
        expect(sq.early, d.id).toBe(undefined);
        expect(sq.before, d.id).toBe(undefined);
        expect(Boolean(d.collect?.start), d.id).toBe(false);
        expect(sq.items, d.id).toContain(d.goal);
      }
      // (its hunters, people or crowd, start only with the clock and never once the game's won; and `hunt` has someone to send)
      const hunters = [...d.people, ...d.extras].filter((o) => o.ai?.hunt);
      expect(hunters.length > 0, d.id).toBe(Boolean(sq.hunt));
      for (const p of hunters) {
        expect(p.ai.hunt.near, p.id ?? p.kind).toBe(undefined);
        expect(p.ai.hunt.until, p.id ?? p.kind).toBe(sq.task);
      }
      expect(sq.need).toBeLessThanOrEqual(sq.items.length);
      expect(d.tasks.map((t) => t.id)).toContain(sq.task);
      // (a collect shares the task only when it ticks nothing: `start`, its crew, pinned above)
      if (!d.collect?.start) expect(d.collect?.task, `${d.id}: a collect ticks the task`).not.toBe(sq.task);
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
    expect(studio.sequence.items.map((id) => studio.hotspots.find((h) => h.id === id).verb)).toEqual(Array(7).fill('Switch on'));
    expect(studio.collect).toBe(null);
    expect(studio.done).toEqual({});
    expect(studio.unlock).toEqual({});
  });
  it('is Gear World’s five cogs, four in an order dealt each run, forty-five seconds from the first one wound, the gear police after him', () => {
    const g = destinationById('gearworld');
    const ITEMS = ['cogs', 'gcog-nw', 'gcog-ne', 'gcog-se', 'gcog-sw'];
    expect(g.sequence).toMatchObject({ task: 'gearworld', items: ITEMS, need: 4, s: 45, hunt: true, who: null, unlock: null });
    expect(g.sequence.start).toBe(undefined);
    expect(g.sequence.order).toBe(undefined);
    expect(g.sequence.lost).toBe('The city ran down before every cog was wound: back to the portal, and wind them again.');
    expect(g.sequence.spotted).toBe('The gear police heard the city turn, and they’re coming for you.');
    expect(g.caught).toBe('He clamps a hand on your shoulder and marches you back to the portal, and every cog stops.');
    const w = g.sequence.words;
    expect([w.next('The great wheel', 1, 4), w.dark('The north-west cogs'), w.again('The south-east cogs')]).toEqual(['1 of 4 wound: next, the great wheel', 'Wrong cog, and the city’s jammed: start again with the north-west cogs', 'That one’s turning already: next, the south-east cogs']);
    expect(g.sequence.meter).toEqual({ title: 'The city’s cogs', label: 'Time', icon: 'cog' });
    expect(g.goal).toBe('cogs');
    // (Gearhead's hello no longer ticks it; the achievement stays on it)
    expect(g.done).toEqual({});
    expect(g.unlock).toEqual({ gearhead: 'gearworld' });
    expect(g.tasks).toEqual([{ id: 'gearworld', name: 'Wind Gear World’s cogs', hint: 'Land on Gear World in the Rick and Morty sector, and wind the city’s cogs in the order the meter gives before the city runs down, with the gear police after you.' }]);
    const at = (id) => g.hotspots.find((h) => h.id === id);
    const c = g.centre;
    expect(ITEMS.map((id) => [at(id).label, at(id).verb, at(id).x - c.x, at(id).z - c.z])).toEqual([
      ['The great wheel', 'Wind', 9, -8],
      ['The north-west cogs', 'Wind', -16, -9],
      ['The north-east cogs', 'Wind', 15.5, -10],
      ['The south-east cogs', 'Wind', 17.5, 5],
      ['The south-west cogs', 'Wind', -17.5, 6],
    ]);
    expect(at('cogs').r).toBe(2.5);
    expect(ITEMS.map((id) => g.say[id])).toEqual([
      { who: null, text: 'The whole city turns. If one gear stops, everyone hears about it.' },
      { who: null, text: 'A brass crank as tall as you, at the foot of a tower of gears.' },
      { who: null, text: 'The tallest tower’s crank, worn smooth by gear people’s hands.' },
      { who: null, text: 'It clanks round once and the whole stack wakes up.' },
      { who: null, text: 'The shortest tower’s crank, and the stiffest in the city.' },
    ]);
    expect(g.say.gearhead).toEqual({ who: 'Gearhead', text: 'Morty! Rick’s my best friend. Rick’s everyone’s best friend. That’s the problem with Rick.' });
  });
  it('puts Gear World’s police on beats of their own, away from the cogs and the way in, named as gear cops', () => {
    const g = destinationById('gearworld');
    const police = g.people.filter((p) => p.ai?.hunt);
    expect(police.map((p) => [p.id, p.who, p.ai.hunt])).toEqual([
      ['gpolice-a', 'gromflomite', { speed: 2.6, catchR: 1.2, until: 'gearworld' }],
      ['gpolice-b', 'gromflomite', { speed: 2.8, catchR: 1.2, until: 'gearworld' }],
    ]);
    expect(g.kinds).toContain('gromflomite');
    expect(g.say['gpolice-a']).toEqual({ who: 'A gear cop', text: 'A gear cop on his beat, in Federation blue.' });
    expect(g.say['gpolice-b']).toEqual({ who: 'A gear cop', text: 'A gear cop by the square, watching who touches the cogs.' });
    const cogs = g.sequence.items.map((id) => g.hotspots.find((h) => h.id === id));
    // (home, where the city's calm sends them, clear of every cog and well away from where a catch sends Morty)
    for (const p of police) {
      for (const h of cogs) expect(Math.hypot(p.x - h.x, p.z - h.z), `${p.id} by ${h.id}`).toBeGreaterThanOrEqual(7.4);
      expect(Math.hypot(p.x - g.arrive.x, p.z - g.arrive.z), `${p.id} by the way in`).toBeGreaterThanOrEqual(20.8);
    }
  });
  it('deals no running order that can’t be walked at a run in sixty per cent of the clock', () => {
    for (const d of DESTINATIONS.filter((p) => p.sequence)) {
      const sq = d.sequence;
      const at = (id) => d.hotspots.find((h) => h.id === id);
      // (straight lines from the start spot, or the way in, through every ordered `need` of the sets: the longest)
      const longest = (from, left, n) => (n === 0 ? 0 : Math.max(...left.map((id) => Math.hypot(at(id).x - from.x, at(id).z - from.z) + longest(at(id), left.filter((o) => o !== id), n - 1))));
      const far = longest(sq.start ? at(sq.start) : d.arrive, sq.items, sq.need);
      expect(far, `${d.id}: ${far.toFixed(1)} m`).toBeLessThanOrEqual(0.6 * sq.s * MORTY.run);
    }
  });
});

describe('Heist-Con', () => {
  const h = destinationById('heistcon');
  const BOOTHS = ['heistbooth', 'heisthire', 'heistskull', 'heistcars'];
  const spot = (id) => h.hotspots.find((o) => o.id === id);
  it('is Miles Knightly’s job: his crew first, then Heistotron’s plan, four booths lifted in an order dealt each run, forty-five seconds, the crew after him', () => {
    expect(h.collect).toEqual({ task: 'heistcon', spots: ['heistbadge', 'heister-b1', 'heister-a1'], start: true });
    expect(h.sequence).toMatchObject({ task: 'heistcon', start: 'heistplan', items: BOOTHS, need: 4, s: 45, hunt: true, who: null, unlock: 'heistcon' });
    expect(h.sequence.order).toBe(undefined);
    expect([h.sequence.before, h.sequence.early, h.sequence.spotted, h.sequence.lost, h.caught]).toEqual([
      'Miles won’t start the job without his crew: take a badge, then recruit a muscle and a cat burglar.',
      'The job hasn’t started yet: start it at Heistotron’s plan by the stage.',
      'Heistotron’s plan was a double-cross: it’s hypnotised your crew, and they’re coming for you.',
      'The keynote ends and the lights come up before the job’s done: back to the door, and get Miles a crew again.',
      'Glassy-eyed, the recruit you signed up for Miles marches you back to the door and tears up your badge.',
    ]);
    const w = h.sequence.words;
    expect([w.next('The gadget booth', 1, 4), w.dark('The skull booth'), w.again('The hiring booth')]).toEqual(['1 of 4 lifted: next, the gadget booth', 'Wrong booth, and the Zigerions take it all back: start again with the skull booth', 'That one’s lifted already: next, the hiring booth']);
    expect(h.sequence.meter).toEqual({ title: 'The job', label: 'Time', icon: 'safe' });
    expect([h.goal, h.done, h.unlock, h.spotted]).toEqual(['heistplan', {}, {}, null]);
    expect(h.tasks).toEqual([{ id: 'heistcon', name: 'Run the job at Heist-Con', hint: 'Dial Heist-Con on the portal gun, take a badge and recruit a muscle and a cat burglar for Miles Knightly, then start the job at Heistotron’s plan and lift from the four booths in the order the meter gives before the keynote ends, with your own crew after you.' }]);
    expect(['heistplan', ...BOOTHS].map((id) => [spot(id).label, spot(id).verb, spot(id).dx, spot(id).dz, spot(id).r])).toEqual([
      ['Heistotron’s plan', 'Start the job', 6, -10.6, 1.8],
      ['The gadget booth', 'Lift', 14, 10, 1.8],
      ['The hiring booth', 'Lift', -14, 10, 1.8],
      ['The skull booth', 'Lift', 14.6, -10, 1.8],
      ['The getaway booth', 'Lift', -14.6, -10, 1.8],
    ]);
    expect(['heistplan', 'heisthire', 'heistskull', 'heistcars'].map((id) => h.say[id])).toEqual([
      { who: null, text: 'Heistotron’s plan for the hall, taped to the edge of the stage: four booths circled in red, in an order of its own.' },
      { who: null, text: 'A board of crews for hire, and Miles Knightly’s name is scrawled across every card on it.' },
      { who: null, text: 'A crystal skull in a glass case, and the Zigerion minding it keeps a spare under the counter.' },
      { who: null, text: 'Getaway cars sold from a brochure, and somebody has left a set of keys on the counter.' },
    ]);
    // (every line said there before, word for word)
    expect(['miles', 'heister-a1', 'heister-b1', 'heistotron', 'heistbooth', 'heistbadge'].map((id) => h.say[id])).toEqual([
      { who: 'Miles Knightly', text: '“Kid. You in?” He doesn’t wait. “Get me a muscle and a cat burglar and we’ve got the start of something. Then we double-cross everyone. That’s the job.”' },
      { who: 'A heister', text: '“Muscle? Sure. I lift things. Sometimes they’re safes.” He hands you a card. It just says MUSCLE.' },
      { who: 'A cat burglar', text: '“Lasers, vents, roofs. I’m in if Knightly’s in. Tell him I want a bigger cut than last time.”' },
      { who: null, text: 'Heistotron. A robot built to plan heists. Rick built it to beat Miles, then it heisted Rick’s plan to heist it. It’s giving the keynote.' },
      { who: null, text: 'A booth selling grappling hooks, glass cutters and a book called “Your Crew And You”. Everything is stolen as you watch.' },
      { who: null, text: 'A badge: HELLO MY NAME IS and a blank. You write MORTY, and somebody steals the pen.' },
    ]);
    expect(h.people.find((p) => p.id === 'miles').ai.bark.lines).toEqual(['You look like a kid who could be a crew member. Everybody’s somebody’s crew member.', 'The heist of the century, and it’s this: the heist is the con. The con is the heist.']);
    expect(h.kinds).toEqual(['miles', 'heister-a', 'heister-b', 'heistotron']);
  });
  it('sets Miles’s crew on him once the job’s on: the two recruits, kept by their spots, clear of the plan and every booth', () => {
    const hunters = [...h.people, ...h.extras].filter((o) => o.ai?.hunt);
    expect(hunters.map((p) => [p.id, p.who, p.ai.hunt])).toEqual([
      ['heister-a1', 'heister-a', { speed: 2.6, catchR: 1.2, until: 'heistcon' }],
      ['heister-b1', 'heister-b', { speed: 2.8, catchR: 1.2, until: 'heistcon' }],
    ]);
    // (named as the job asks for them: a muscle and a cat burglar)
    expect(hunters.map((p) => spot(p.id).label)).toEqual(['A muscle', 'A cat burglar']);
    for (const p of hunters) {
      expect(spot(p.id).verb, p.id).toBe('Recruit');
      expect(h.say[p.id]?.who, p.id).toBeTruthy();
      const home = spot(p.id);
      for (const [x, z] of p.ai.wander) {
        expect(Math.hypot(x - home.x, z - home.z), `${p.id} strays`).toBeLessThanOrEqual(2.1);
        for (const id of ['heistplan', ...BOOTHS]) expect(Math.hypot(x - spot(id).x, z - spot(id).z), `${p.id} by ${id}`).toBeGreaterThanOrEqual(7.4);
      }
    }
  });
});

describe('a place that runs on a climb', () => {
  it('has its stairs as ledges and a top or things to pick up, its spots with their lines, and only the game ticks its task', () => {
    const climbing = DESTINATIONS.filter((d) => d.climb);
    expect(climbing.map((d) => d.id)).toEqual(['birdworld', 'fantasy']);
    for (const d of climbing) {
      const cl = d.climb;
      const ledge = (id) => d.solids.find((s) => s.id === id && s.ledge);
      for (const s of cl.stairs) {
        expect(s.steps.length, `${d.id}: ${s.id}`).toBeGreaterThan(0);
        for (const id of s.steps) expect(ledge(id), `${d.id}: ${id} is a ledge`).toBeTruthy();
      }
      const spots = d.hotspots.map((h) => h.id);
      // (a climb to the top: the stairs' foot, and the spot up there)
      if (cl.top != null) {
        expect(ledge(cl.top), `${d.id}: its top is a ledge`).toBeTruthy();
        expect(spots).toContain(cl.foot);
        expect(spots).toContain(cl.spot);
        expect(d.say[cl.foot]?.text).toBeTruthy();
        expect(d.say[cl.spot]?.text).toBeTruthy();
        // (the spot at the top is up on it: its pin floats there)
        expect(d.hotspots.find((h) => h.id === cl.spot).y).toBe(ledge(cl.top).top);
        expect(d.goal).toBe(cl.foot);
      } else {
        // (or things to pick up: each a spot of its own, gone once the task's done, that tells the stage)
        expect(cl.picks?.length, `${d.id}: a top or things to pick up`).toBeGreaterThanOrEqual(2);
        expect(cl.foot).toBe(null);
        expect(cl.spot).toBe(null);
        for (const id of cl.picks) {
          const h = d.hotspots.find((o) => o.id === id);
          expect(h, `${d.id}: ${id} is a spot`).toBeTruthy();
          expect(d.say[id]?.text, id).toBeTruthy();
          expect(h.until, id).toBe(cl.task);
          expect(h.verb, id).not.toBe('Look');
          expect(d.acts[id], id).toBe(`climb-pick-${id}`);
        }
        // (one up on a ledge, its pin floating there, out of reach from the ground round it)
        const up = cl.picks
          .map((id) => d.hotspots.find((o) => o.id === id))
          .filter((h) => h.y != null)
          .map((h) => [h, d.solids.find((s) => s.ledge && s.top === h.y && Math.hypot(s.x - h.x, s.z - h.z) < s.r)]);
        expect(up.length, `${d.id}: a pick up on a ledge`).toBeGreaterThan(0);
        for (const [h, l] of up) {
          expect(l, `${h.id} stands on a ledge at its height`).toBeTruthy();
          expect(l.r + MORTY.radius - Math.hypot(l.x - h.x, l.z - h.z), h.id).toBeGreaterThan(h.r);
        }
        expect(d.goal).toBe(cl.picks[0]);
      }
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
    expect(fantasy.tasks).toEqual([{ id: 'fantasy', name: 'Climb the beanstalk to the giants', hint: 'Dial Fantasy World on the portal gun in Rick’s garage and go up the Stair Goblins by the tavern while they keep still, then climb the beanstalk to the giants.' }]);
    expect(fantasy.say.giants).toEqual({ who: 'A giant', text: 'A little man, all the way up our beanstalk. Wipe your feet. And mind the edge: it’s cloud.' });
    expect(fantasy.say.fmeeseeks).toEqual({ who: 'A Meeseeks', text: 'Existence is pain to a Meeseeks, Morty. Give me something to do.' });
  });
  it('gives ledges to no place without a climb', () => {
    for (const d of DESTINATIONS.filter((p) => !p.climb)) expect(d.solids.filter((s) => s.ledge || s.top != null).map((s) => s.id), d.id).toEqual([]);
  });
  it('is Bird World’s five crystals: three in the grass and one up each clay tower, where the clay crumbles', () => {
    const bird = destinationById('birdworld');
    const PICKS = ['bcrystal-path', 'bcrystal-trees', 'bcrystal-east', 'bcrystal-west', 'bcrystal-grass'];
    expect(bird.climb).toMatchObject({ task: 'birdworld', top: null, foot: null, spot: null, picks: PICKS, who: null, unlock: null });
    expect(bird.climb.stairs).toEqual([
      { id: 'crumble-a', steps: ['tower-a-3', 'tower-a-4', 'tower-a-5'] },
      { id: 'crumble-b', steps: ['tower-b-3', 'tower-b-4', 'tower-b-5'] },
    ]);
    expect(bird.climb.lost).toBe('The clay crumbled under you: a drum that cracks is about to go.');
    expect(bird.climb.fell).toBe('A long way down, but the grass is soft.');
    const w = bird.climb.words;
    expect([w.still, w.shiver, w.bite, w.up(3), w.found(2, 5)]).toEqual(['The clay’s holding: up you go', 'It’s cracking: off it before it crumbles', 'It’s crumbling: wait till it holds', '3 m up the clay', '2 of 5 crystals found']);
    expect(bird.climb.meter).toEqual({ title: 'Bird World’s crystals', label: 'Crystals', icon: 'gem' });
    expect(bird.goal).toBe('bcrystal-path');
    // (the knock no longer ticks it; the achievement stays on the door)
    expect(bird.done).toEqual({});
    expect(bird.unlock).toEqual({ door: 'birdworld' });
    expect(bird.tasks).toEqual([{ id: 'birdworld', name: 'Pick up Bird World’s crystals', hint: 'Land on Bird World in the Rick and Morty sector, and pick up the crystals round Birdperson’s house: three in the grass, and one up each clay tower, where the clay crumbles.' }]);
    const at = (id) => bird.hotspots.find((h) => h.id === id);
    const c = bird.centre;
    expect(PICKS.map((id) => [at(id).label, at(id).verb, at(id).r])).toEqual([
      ['A crystal by the path', 'Pick up', 1.4],
      ['A crystal by the trees', 'Pick up', 1.4],
      ['The crystal on the east tower', 'Pick up', 1],
      ['The crystal on the west tower', 'Pick up', 1],
      ['A crystal in the long grass', 'Pick up', 1.4],
    ]);
    expect([at('bcrystal-path'), at('bcrystal-trees'), at('bcrystal-grass')].map((h) => [h.x - c.x, h.z - c.z, h.y])).toEqual([
      [6, 9, undefined],
      [24, 14, undefined],
      [-24, 8, undefined],
    ]);
    expect(at('bcrystal-east').y).toBe(9.6);
    expect(at('bcrystal-west').y).toBe(8);
    expect(PICKS.map((id) => bird.say[id])).toEqual([
      { who: null, text: 'It hums in your hand and goes quiet in your pocket.' },
      { who: null, text: 'A crystal the size of your fist, buzzing like a phone on silent.' },
      { who: null, text: 'The highest crystal on Bird World, still warm from the clay.' },
      { who: null, text: 'Grown right out of the clay up here, and it comes away clean.' },
      { who: null, text: 'It sings one note as you lift it, and the grass leans after it.' },
    ]);
    // (the old tower posts are the clay towers' tops now; the rest of the place's lines stay)
    expect(bird.solids.find((s) => s.id === 'tower-a')).toMatchObject({ r: 2, top: 8, ledge: true });
    expect(bird.solids.find((s) => s.id === 'tower-b')).toMatchObject({ r: 2.2, top: 9.6, ledge: true });
    expect(bird.say.door).toEqual({ who: null, text: 'Birdperson’s house. He doesn’t lock it. Nobody on Bird World does.' });
    expect(bird.say.crystals).toEqual({ who: null, text: 'The crystals hum when you walk past them. It’s nice.' });
  });
});

describe('Froopyland', () => {
  it('lets a visitor through its portal: no Froopylander’s rounds come within its reach of the way in', () => {
    const d = destinationById('froopyland');
    // (the nearest point of a segment to a point)
    const toSeg = ([ax, az], [bx, bz], p) => {
      const vx = bx - ax;
      const vz = bz - az;
      const k = Math.max(0, Math.min(1, ((p.x - ax) * vx + (p.z - az) * vz) / (vx * vx + vz * vz || 1)));
      return Math.hypot(ax + k * vx - p.x, az + k * vz - p.z);
    };
    const hunters = d.extras.filter((e) => e.ai?.hunt);
    expect(hunters.length).toBeGreaterThan(0);
    for (const [i, e] of hunters.entries()) {
      const loop = e.ai.wander;
      const near = Math.min(...loop.map((p, j) => toSeg(p, loop[(j + 1) % loop.length], d.arrive)));
      expect(near, `${e.kind} ${i}: ${near.toFixed(2)} m`).toBeGreaterThanOrEqual(e.ai.hunt.near + 1);
    }
  });
  it('keeps Tommy by his spot, and he hands over its achievement', () => {
    const d = destinationById('froopyland');
    const tommy = d.people.find((p) => p.id === 'tommy');
    const spot = d.hotspots.find((h) => h.id === 'tommy');
    for (const [x, z] of tommy.ai.wander) expect(Math.hypot(x - spot.x, z - spot.z), `${x}, ${z}`).toBeLessThanOrEqual(2.1);
    expect(d.unlock).toEqual({ tommy: 'froopyland' });
    expect(d.done).toEqual({ tommy: 'froopyland' });
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
