import { describe, expect, it } from 'vitest';
import { AREAS, HOTSPOTS, LINKS, PLANET_TASKS, TASKS, areaAt, progress } from './rules';
import { DESTINATIONS, PLANETS, destinationById, isBigPlanet, isPlanet, isWayHome } from './dimensions/destinations';
import { ALL_DONE_HERE, WAY_HOME, backLink, boundOf, hereHint, inLine, listOf, planetOf, planetPage, planetProgress, relabel } from './planetMode';

const prompt = (l) => ({ kind: 'link', id: l.id, name: l.label, verb: 'Step through', link: l });

describe('C-137: a planet played on its own', () => {
  it('knows each planet: where Morty starts, its way home, its name and things to do', () => {
    for (const id of PLANETS) {
      const p = planetOf(id);
      const d = destinationById(id);
      expect(p, id).toMatchObject({ id, area: id, x: d.arrive.x, z: d.arrive.z, face: d.arrive.face, back: d.back, name: d.name, note: d.note });
      expect(p.tasks.length, id).toBeGreaterThan(0);
      expect(areaAt(p.x, p.z), id).toBe(id);
      // its one way out is its own portal, by where it comes back
      const ways = LINKS.filter((l) => l.area === id);
      expect(ways.map((l) => l.id), id).toEqual([`${id}-portal`]);
      expect(isWayHome(ways[0], id)).toBe(true);
      expect(Math.hypot(ways[0].x - p.back.x, ways[0].z - p.back.z), id).toBeLessThan(0.01);
    }
    for (const id of ['fantasy', 'annex', 'street', 'citadel', 'nope', null, undefined]) expect(planetOf(id), String(id)).toBeNull();
  });

  it('is after the planet’s own first thing not done, then the way home; everything still counts', () => {
    const squanch = planetOf('squanch');
    const fresh = planetProgress(squanch, []);
    expect(fresh.next.id).toBe('squanch');
    // (he's landed: the hint without the landing)
    expect(fresh.objective).toBe('Raise a glass at the wedding, and get back through the portal when the Federation arrives.');
    expect(fresh).toMatchObject({ count: 0, total: TASKS.length });
    // C-137's things done count, but don't make a planet's next
    const home = TASKS.filter((t) => !PLANET_TASKS.has(t.id)).map((t) => t.id);
    expect(planetProgress(squanch, home)).toMatchObject({ count: home.length, next: { id: 'squanch' } });
    const done = planetProgress(squanch, ['squanch', 'cable']);
    expect(done).toMatchObject({ next: null, objective: ALL_DONE_HERE, count: 2 });
    expect(ALL_DONE_HERE).not.toMatch(/!/);
    // every planet's things to do are planet tasks (but a big planet's,
    // retired: it's a surface world now), and what's next is one of its own
    for (const id of PLANETS) {
      const p = planetOf(id);
      for (const t of p.tasks) {
        expect(PLANET_TASKS.has(t.id), t.id).toBe(!isBigPlanet(id));
        // (every one's hint loses its landing there, and still says what to do)
        const here = hereHint(t.hint);
        expect(here, t.id).not.toMatch(/^Land |Rick and Morty sector|^and /i);
        expect(here, t.id).toMatch(/^[A-Z]/);
        expect(here.length, t.id).toBeGreaterThan(15);
      }
      expect(p.tasks).toContain(planetProgress(p, []).next);
    }
    // (a hint without a landing is as it was)
    expect(hereHint('Talk to Beth.')).toBe('Talk to Beth.');
    expect(hereHint('Land on Gazorpazorp in the Rick and Morty sector, and knock at the gate.')).toBe('Knock at the gate.');
  });

  it('leaves to space by the planet (in its place in the history), or to the site from C-137', () => {
    expect(backLink(planetOf('purge'))).toEqual({ to: '/universe/purge', label: WAY_HOME, replace: true });
    expect(backLink(null)).toEqual({ to: '/', label: 'Back to the site', replace: false });
  });

  it('takes only the sector’s ten planets at their own address, and sends anything else to C-137', () => {
    for (const id of PLANETS) {
      const d = destinationById(id);
      expect(planetPage(id), id).toEqual({ id, name: d.name, note: d.note, space: `/universe/${id}` });
    }
    // (the Citadel's a page of its own, Fantasy World's through the garage portal)
    for (const id of ['citadel', 'fantasy', 'nope', '', null, undefined]) expect(planetPage(id), String(id)).toBeNull();
  });

  it('lists the planet’s own things to do there, as said there, and the rest as one line', () => {
    const squanch = planetOf('squanch');
    const fresh = listOf(squanch, []);
    expect(fresh.label).toBe('Things to do on Planet Squanch');
    expect(fresh.rows).toEqual(squanch.tasks.map((t) => ({ id: t.id, name: t.name, hint: hereHint(t.hint), done: false })));
    expect(fresh.rest).toBe(`0 of ${TASKS.length} done in all, with Dimension C-137’s.`);
    // C-137's things done count in the line, not as rows; its own, ticked
    const done = listOf(squanch, ['cable', 'butter', 'squanch']);
    expect(done.rows.map((r) => [r.id, r.done])).toEqual([['squanch', true]]);
    expect(done.rest).toBe(`3 of ${TASKS.length} done in all, with Dimension C-137’s.`);
    // (a name with 'The' in front, mid-sentence)
    expect(listOf(planetOf('purge')).label).toBe('Things to do on the Purge Planet');
    for (const id of PLANETS) for (const r of listOf(planetOf(id)).rows) expect(r.hint, r.id).not.toMatch(/Rick and Morty sector|garage/);
  });

  it('lists everything in C-137, with where to go for it', () => {
    const l = listOf(null, ['cable']);
    expect(l).toMatchObject({ label: 'Things to do in Dimension C-137', rest: null });
    expect(l.rows).toEqual(TASKS.map((t) => ({ id: t.id, name: t.name, hint: t.hint, done: t.id === 'cable' })));
  });

  it('names the bench for what it does at the story’s last step: the gun put back, not a dimension picked', () => {
    const bench = { kind: 'spot', id: 'dial', name: HOTSPOTS.find((h) => h.id === 'dial').label, verb: 'Dial' };
    expect(relabel(bench, { bench: true })).toMatchObject({ name: 'The portal gun, back on Rick’s bench', verb: 'Put it back' });
    expect(relabel(bench)).toBe(bench);
    const other = { kind: 'spot', id: HOTSPOTS[0].id, name: HOTSPOTS[0].label };
    expect(relabel(other, { bench: true })).toBe(other);
  });

  it('names the way home on a planet, and where the garage portal is dialled', () => {
    const purge = planetOf('purge');
    const home = prompt(LINKS.find((l) => l.id === 'purge-portal'));
    const garage = prompt(LINKS.find((l) => l.id === 'garage-portal'));
    expect(relabel(home, { planet: purge })).toMatchObject({ name: WAY_HOME, verb: 'Step through', link: home.link });
    // (another planet's portal, and C-137's portals, are as they are)
    expect(relabel(home, { planet: planetOf('squanch') })).toBe(home);
    expect(relabel(home)).toBe(home);
    expect(relabel(garage, { portal: 'Through the portal to Fantasy World' })).toMatchObject({ name: 'Through the portal to Fantasy World', link: garage.link });
    expect(relabel(garage)).toBe(garage);
    const spot = { kind: 'spot', id: HOTSPOTS[0].id, name: HOTSPOTS[0].label };
    expect(relabel(spot, { planet: purge, portal: 'x' })).toBe(spot);
    expect(relabel(null, { planet: purge })).toBeNull();
  });

  it('reaches every area, for others online (the places past the portal are out to z 4425)', () => {
    const bound = boundOf(AREAS);
    expect(bound).toBeGreaterThanOrEqual(4425);
    for (const [id, a] of Object.entries(AREAS)) for (const v of [a.x0, a.x1, a.z0, a.z1]) expect(Math.abs(v), id).toBeLessThanOrEqual(bound);
    expect(boundOf({ a: { x0: -3, x1: 2, z0: -1.5, z1: 7.2 } })).toBe(8);
  });

  it('puts a name inside a sentence', () => {
    expect(inLine('The Purge Planet')).toBe('the Purge Planet');
    expect(inLine('Planet Squanch')).toBe('Planet Squanch');
  });
});

describe('C-137: the planets’ things to do, left to the planets', () => {
  it('passes over what it’s told to skip when it picks what’s next, and still counts it', () => {
    const p = progress([], { skip: ['cable', 'butter'] });
    expect(p).toMatchObject({ done: [], count: 0, total: TASKS.length });
    expect(p.next.id).toBe('meeseeks');
    expect(p.objective).toBe(TASKS[2].hint);
    // a Set will do, and a skipped thing that's done still counts
    const q = progress(['butter'], { skip: new Set(['cable', 'butter']) });
    expect(q).toMatchObject({ done: ['butter'], count: 1, total: TASKS.length });
    expect(q.next.id).toBe('meeseeks');
    // nothing to skip is as before
    expect(progress(['cable'], {}).next.id).toBe('butter');
    expect(progress(['cable'], { skip: [] }).next.id).toBe('butter');
  });

  it('leaves the planets’ things to the planets in C-137, and says where they are once the rest are done', () => {
    // (the small planets' box tasks: a big planet's are retired)
    const planets = DESTINATIONS.filter((d) => isPlanet(d.id) && !isBigPlanet(d.id)).flatMap((d) => d.tasks.map((t) => t.id));
    expect([...PLANET_TASKS].sort()).toEqual(planets.sort());
    expect(PLANET_TASKS.size).toBe(PLANETS.filter((id) => !isBigPlanet(id)).length);
    expect(PLANET_TASKS.size).toBeGreaterThanOrEqual(2);
    // customs is done: next is Fantasy World, not Planet Squanch
    const before = TASKS.slice(0, TASKS.findIndex((t) => t.id === 'customs') + 1).map((t) => t.id);
    expect(progress(before).next.id).toBe('squanch');
    expect(progress(before, { skip: PLANET_TASKS }).next.id).toBe('fantasy');
    // all of C-137's done, the planets' not
    const here = TASKS.filter((t) => !PLANET_TASKS.has(t.id)).map((t) => t.id);
    const p = progress(here, { skip: PLANET_TASKS });
    expect(p).toMatchObject({ count: here.length, total: TASKS.length, next: null });
    expect(p.objective).toMatch(/planets.*Rick and Morty sector/);
    expect(p.objective).not.toMatch(/!/);
    // what's skipped and left isn't on a planet: only that this place is done
    expect(progress(TASKS.slice(1).map((t) => t.id), { skip: ['cable'] }).objective).toBe('Everything here’s done.');
    // and all of it done is all done, skipped or not
    expect(progress(TASKS.map((t) => t.id), { skip: PLANET_TASKS }).objective).toBe('Everything’s done. Wubba lubba dub dub.');
  });
});
