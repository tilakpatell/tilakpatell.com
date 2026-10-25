import { describe, expect, it } from 'vitest';
import { AREAS, HOTSPOTS, LINKS, PLANET_TASKS, TASKS, areaAt, progress } from './rules';
import { DESTINATIONS, PLANETS, destinationById, isBigPlanet, isPlanet, isWayHome } from './dimensions/destinations';
import { newDeal, stepDeal } from './games/deal';
import { newFind, stepFind } from './games/find';
import { ALL_DONE_HERE, WAY_HOME, backLink, boundOf, hereHint, inLine, listOf, planetOf, planetPage, planetProgress, playOf, relabel } from './planetMode';

const prompt = (l) => ({ kind: 'link', id: l.id, name: l.label, verb: 'Step through', link: l });
// a spot's prompt, as RmWorld's PROMPT has it
const spotPrompt = (id) => {
  const h = HOTSPOTS.find((o) => o.id === id);
  return { kind: 'spot', id, name: h.label, verb: h.verb, spot: h };
};

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
    // (the four planets on the gun: dialled, or landed on from the map)
    const DIALLED = {
      birdworld: 'Dial Bird World on the portal gun (or land on it from the universe map), and pick up the crystals round Birdperson’s house: three in the grass, and one up each clay tower, where the clay crumbles.',
      gearworld: 'Dial Gear World on the portal gun (or land on it from the universe map), and wind the city’s cogs in the order the meter gives before the city runs down, with the gear police after you.',
      pluto: 'Dial Pluto on the portal gun (or land on it from the universe map), and tell the king only the claims on his palace that are true: weigh up two at most, and Scroopy calls out a lie.',
      squanch: 'Dial Planet Squanch on the portal gun (or land on it from the universe map), raise a glass at the wedding, and get back through the portal when the Federation arrives.',
    };
    expect(l.rows).toEqual(TASKS.map((t) => ({ id: t.id, name: t.name, hint: DIALLED[t.id] ?? t.hint, done: t.id === 'cable' })));
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

  it('says a done game’s spots only look (or talk, where someone stands), and leaves anyone else’s verb be', () => {
    const booth = spotPrompt('cablebooth');
    expect(relabel(booth, { done: ['cablestudio'] })).toMatchObject({ id: 'cablebooth', name: 'The control booth', verb: 'Look' });
    expect(relabel(booth, { done: [] })).toBe(booth);
    expect(relabel(booth)).toBe(booth);
    expect(booth.verb).toBe('Start the countdown');
    expect(relabel(spotPrompt('set-ants'), { done: ['cablestudio'] }).verb).toBe('Look');
    // (Heist-Con's plan, booths and badge only look; its recruits, who stand at their spots, talk)
    const heist = ['heistplan', 'heistbooth', 'heistbadge', 'heister-a1', 'heister-b1'].map((id) => relabel(spotPrompt(id), { done: ['heistcon'] }).verb);
    expect(heist).toEqual(['Look', 'Look', 'Look', 'Talk', 'Talk']);
    expect(relabel(spotPrompt('claim-planet'), { done: ['pluto'] }).verb).toBe('Look');
    expect(relabel(spotPrompt('gcog-nw'), { done: ['gearworld'] }).verb).toBe('Look');
    expect(relabel(spotPrompt('zeepcells'), { done: ['microverse'] }).verb).toBe('Look');
    // someone who isn't one of the game's things talks either way
    for (const done of [[], ['heistcon']]) expect(relabel(spotPrompt('miles'), { done })).toMatchObject({ verb: 'Talk' });
    expect(relabel(spotPrompt('flippynips'), { done: ['pluto'] }).verb).toBe('Talk');
    expect(relabel(spotPrompt('gearhead'), { done: ['gearworld'] }).verb).toBe('Talk');
    // (another task done is no matter)
    expect(relabel(booth, { done: ['heistcon'] })).toBe(booth);
  });

  it('says a game’s second press takes the thing, once its first has looked it over or heard him', () => {
    const shop = DESTINATIONS.find((d) => d.id === 'needful').deal;
    // (cursed: all but the cream; two looks, so the aftershave's chanced blind)
    const deal = ['typewriter', 'cream', 'aftershave'].reduce((g, use) => stepDeal(g, { use }), newDeal({ items: shop.items, bad: ['typewriter', 'aftershave', 'shopclock', 'shopmirror'], need: 1, looks: 2 }));
    expect(deal.seen).toEqual({ typewriter: 'bad', cream: 'good', aftershave: 'blind' });
    const at = (id, play) => relabel(spotPrompt(id), play).verb;
    expect(['cream', 'aftershave', 'typewriter', 'shopclock'].map((id) => at(id, { deal }))).toEqual(['Take', 'Take', 'Look', 'Look over']);
    // (not looked at, it's as it is; done, it only looks)
    const clock = spotPrompt('shopclock');
    expect(relabel(clock, { deal })).toBe(clock);
    expect(at('cream', { deal, done: ['needful'] })).toBe('Look');
    // Pluto's claims: one weighed true is told the king; one told, or a lie weighed, only looks
    const claims = DESTINATIONS.find((d) => d.id === 'pluto').deal;
    const weighed = (uses) => uses.reduce((g, use) => stepDeal(g, { use }), newDeal({ items: claims.items, bad: claims.bad, need: 2, looks: 2 }));
    expect(at('claim-moons', { deal: weighed(['claim-moons']) })).toBe('Tell the king');
    expect(at('claim-moons', { deal: weighed(['claim-moons', 'claim-moons']) })).toBe('Look');
    expect(at('claim-growing', { deal: weighed(['claim-growing']) })).toBe('Look');
    expect(at('claim-planet', { deal: weighed(['claim-moons']) })).toBe('Weigh up');
    // the Jerryboree: a Jerry heard is taken by the next press; one ruled out, or not yet heard, talks
    const jerrys = DESTINATIONS.find((d) => d.id === 'jerryboree').find;
    const asked = (uses) => uses.reduce((g, use) => stepFind(g, { use }, 0), newFind({ items: jerrys.items, ours: 'jerryreal', s: 45, cost: 15 }));
    expect(at('jerrytv', { find: asked(['jerrytv']) })).toBe('Take him');
    expect(at('jerrytv', { find: asked(['jerrytv', 'jerrytv']) })).toBe('Talk');
    expect(at('jerryrobe', { find: asked(['jerrytv']) })).toBe('Talk');
    expect(at('jerrytv', { find: asked(['jerrytv']), done: ['jerryboree'] })).toBe('Talk');
    // (a game not under way, lost or not begun, takes nothing)
    expect(at('cream', { deal: { ...deal, phase: 'lost' } })).toBe('Look over');
    expect(at('jerrytv', { find: { ...asked(['jerrytv']), phase: 'lost' } })).toBe('Talk');
  });

  it('reads the game a prompt’s at, for relabel: the deal’s snapshot at one of its things, the find’s at a Jerry', () => {
    const calls = [];
    const act = (area, name) => {
      calls.push([area, name]);
      return { phase: 'run', name };
    };
    expect(playOf(spotPrompt('cream'), act)).toEqual({ deal: { phase: 'run', name: 'deal' } });
    expect(playOf(spotPrompt('claim-moons'), act)).toEqual({ deal: { phase: 'run', name: 'deal' } });
    expect(playOf(spotPrompt('jerrytv'), act)).toEqual({ find: { phase: 'run', name: 'find' } });
    expect(calls).toEqual([
      ['needful', 'deal'],
      ['pluto', 'deal'],
      ['jerryboree', 'find'],
    ]);
    // (anything else asks nothing)
    for (const p of [spotPrompt('needful'), spotPrompt('cablebooth'), prompt(LINKS[0]), null]) expect(playOf(p, act)).toEqual({});
    expect(calls).toHaveLength(3);
    // (a place with no stage yet says nothing)
    expect(playOf(spotPrompt('cream'), () => undefined)).toEqual({ deal: null });
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
    // (it names what's left: the four on the gun only while they are)
    expect(p.objective).toBe('Everything here’s done. The rest are on the planets in the Rick and Morty sector of the universe map: the Purge Planet, Snake Planet, Nuptia 4, the Immortality Field Resort and Cronenberg World, and Bird World, Gear World, Pluto and Planet Squanch, which are on the portal gun too.');
    const four = progress([...here, 'birdworld', 'gearworld', 'pluto', 'squanch'], { skip: PLANET_TASKS });
    expect(four.objective).toBe('Everything here’s done. The rest are on the planets in the Rick and Morty sector of the universe map: the Purge Planet, Snake Planet, Nuptia 4, the Immortality Field Resort and Cronenberg World.');
    const one = progress([...here, 'gearworld', 'pluto', 'squanch', 'purge', 'snakeplanet', 'nuptia', 'resort', 'cronenberg'], { skip: PLANET_TASKS });
    expect(one.objective).toBe('Everything here’s done. The rest are on the planets in the Rick and Morty sector of the universe map: Bird World, which is on the portal gun too.');
    // what's skipped and left isn't on a planet: only that this place is done
    expect(progress(TASKS.slice(1).map((t) => t.id), { skip: ['cable'] }).objective).toBe('Everything here’s done.');
    // and all of it done is all done, skipped or not
    expect(progress(TASKS.map((t) => t.id), { skip: PLANET_TASKS }).objective).toBe('Everything’s done. Wubba lubba dub dub.');
  });
});
