import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { matchPath } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HELLO, SHELL_STOPS, TOURS, textOf } from './steps';
import { BRIEFS } from './briefs';
import { END } from './chapters/shared';
import { WALKED } from './chapters/player';
import { isLightRoute, shellStopsFor } from '../../lib/tour';
import { WORLDS, WORLD_MB } from '../worlds/worlds';
import { ACHIEVEMENTS } from '../Achievements';
import { ABOUT } from '../guide/abouts';
import { linkOf } from '../avengers/world/links';

const SRC = join(import.meta.dirname, '../..');

// every data-tour name marked in a file under `dir`: data-tour="…", or an
// expression naming it (data-tour={preview ? undefined : 'resume-skills'})
const markedIn = (dir) => {
  const names = new Set();
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.jsx$/.test(e.name)) for (const m of readFileSync(p, 'utf8').matchAll(/data-tour=(?:"([^"]+)"|\{[^}']*'([^'}]+)'[^}]*\})/g)) (m[1] ?? m[2]).split(' ').forEach((n) => names.add(n));
    }
  };
  walk(dir);
  return names;
};
const marked = () => new Set([...markedIn(join(SRC, 'components')), ...markedIn(join(SRC, 'pages'))]);

// the routes App.jsx declares, matched as the router does (spec 8, A19)
const ROUTES = [...readFileSync(join(SRC, 'App.jsx'), 'utf8').matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*');
const routed = (to) => ROUTES.some((path) => matchPath({ path, end: true }, to.split(/[?#]/)[0]));

// the things a phone folds into the menu (steps.js's header)
const FOLDED = new Set(['pages', 'search', 'colours', 'terminal', 'resume']);
// the shell's own marks, which the view tours use (every other mark is an audience stop's)
const SHELL_MARKS = new Set(['view', 'ships', 'panel', 'navmap', 'guide', 'pages', 'terminal', 'search', 'colours', 'resume', 'menu']);

const AUDIENCES = ['recruiter', 'player', 'mixed'];
const VIEWS = ['universe', 'classic'];
// the spec's minutes (8, B5): the hiring tour under 5, the player's under 8, the whole under 12
const BUDGET = { recruiter: 5 * 60, player: 11 * 60, mixed: 15 * 60 }; // the player's and the whole with the walk through the worlds
const SHELL = { stops: 5, words: 60 }; // the allowance for the view's tour, prepended by planFor

// every way a stop's text can read: the shortcut, a phone or not, a ship or not
const CTXS = [
  { key: '⌘K', touch: false, ship: null, mb: WORLD_MB },
  { key: 'Ctrl K', touch: true, ship: 'The X-wing', mb: WORLD_MB },
];
const ctx = CTXS[0];
const words = (s, c = ctx) => textOf(s, c).split(/\s+/).filter(Boolean).length;
const labelOf = (a, c = ctx) => (typeof a.label === 'function' ? a.label(c) : a.label);
const most = (s) => Math.max(...CTXS.map((c) => words(s, c)));

// a chapter's stops: its own, or the basics it borrows; and a heavy one's
// phone chapters (lib/tour's planFor takes them in its place on a coarse pointer)
const stopsOf = (c) => (c.brief ? BRIEFS[c.brief] : c.stops);
const versions = (chapters) => chapters.flatMap((c) => [c, ...(c.phone ?? [])]);
const allStops = (chapters) => versions(chapters).flatMap(stopsOf);
const own = (chapters) => versions(chapters).filter((c) => !c.brief).flatMap((c) => c.stops);
// what a visitor sees in order, on a laptop (the heavy chapters as they are) or a phone
const seen = (chapters, phone) => chapters.flatMap((c) => (phone && c.heavy ? c.phone : [c]));
const seconds = (chapters) => chapters.reduce((t, c) => t + 3 + stopsOf(c).reduce((u, s) => u + most(s) / 3 + 4, 0), 0);

describe('the view tours', () => {
  it('opens and closes each on a card that points at nothing', () => {
    for (const name of VIEWS) {
      expect(TOURS[name][0].at, name).toBeUndefined();
      expect(TOURS[name].at(-1).at, name).toBeUndefined();
    }
  });

  it('gives every stop a title and something to say, and a name of its own', () => {
    for (const name of VIEWS) {
      const steps = TOURS[name];
      expect(new Set(steps.map((s) => s.id)).size, name).toBe(steps.length);
      for (const s of steps) {
        expect(s.title, `${name}/${s.id}`).toBeTruthy();
        expect(textOf(s, ctx).length, `${name}/${s.id}`).toBeGreaterThan(20);
      }
    }
  });

  it('says the shortcut this device uses', () => {
    const search = TOURS.classic.find((s) => s.at === 'search');
    expect(textOf(search, { key: 'Ctrl K' })).toContain('Ctrl K');
  });

  it('ends by saying where to take it again', () => {
    for (const name of VIEWS) expect(textOf(TOURS[name].at(-1), ctx)).toMatch(/guide/);
  });

  it('lets the keys a stop names through only by its own field, never as key rows', () => {
    for (const s of VIEWS.flatMap((v) => TOURS[v])) {
      if (s.keys) expect(Array.isArray(s.keys), s.id).toBe(true);
      if (s.release) expect(s.release.every((k) => ['?', 'palette'].includes(k)), s.id).toBe(true);
    }
  });
});

describe('the marks in the pages', () => {
  it('has one for every stop that lights something', () => {
    const names = marked();
    const ats = [...VIEWS.flatMap((v) => TOURS[v]), ...AUDIENCES.flatMap((a) => allStops(TOURS[a]))].filter((s) => s.at);
    for (const s of ats) expect(names.has(s.at), `data-tour="${s.at}" (${s.id})`).toBe(true);
  });

  it('has no mark a stop doesn’t use, but the shell’s own', () => {
    // (a world's basics light its own marks: briefs.js)
    const used = new Set([...AUDIENCES.flatMap((a) => allStops(TOURS[a])), ...Object.values(BRIEFS).flat()].map((s) => s.at));
    for (const n of marked()) if (!SHELL_MARKS.has(n)) expect(used.has(n), `data-tour="${n}" is lit by no stop`).toBe(true);
  });
});

describe('the audience tours', () => {
  it('are the five tours, the views’ and the audiences’', () => {
    expect(Object.keys(TOURS).sort()).toEqual(['classic', 'mixed', 'player', 'recruiter', 'universe']);
  });

  it('are chapters, each on a light route, or staying put, or borrowing basics', () => {
    for (const name of AUDIENCES)
      for (const c of versions(TOURS[name])) {
        const at = `${name}/${c.id}`;
        expect(c.id && c.title, at).toBeTruthy();
        // (a world chapter walks into its world: the one exception to the light routes)
        if (c.world) expect(WORLDS.some((w) => c.path === w.to || c.path.startsWith(`${w.to}/`)), `${at}: ${c.path}`).toBe(true);
        else if (c.path !== null) expect(isLightRoute(c.path), `${at}: ${c.path}`).toBe(true);
        if (c.brief) expect(BRIEFS[c.brief], at).toBeTruthy();
        else expect(c.stops.length, at).toBeGreaterThan(0);
        if (c.heavy) expect(c.phone?.length, at).toBeGreaterThan(0);
      }
  });

  it('has the spec’s chapters, the shell (the view’s tour) being the first', () => {
    expect(TOURS.recruiter.length + 1).toBe(8);
    expect(TOURS.player.length + 1).toBe(9 + WALKED.length); // the achievements folded into the checklist (spec 8, B3); then the walk through the worlds
  });

  it('stays where the last chapter was for the end cards', () => {
    for (const name of AUDIENCES) expect(TOURS[name].at(-1).path, name).toBeNull();
    expect(TOURS.mixed.at(-1)).toBe(END);
  });

  it('opens on its own card, and keeps a shell of stops the view tours have', () => {
    const ids = { universe: new Set(TOURS.universe.map((s) => s.id)), classic: new Set(TOURS.classic.map((s) => s.id)) };
    for (const a of AUDIENCES) {
      expect(HELLO[a].at, a).toBeUndefined();
      for (const v of VIEWS) {
        const list = shellStopsFor(a, v, SHELL_STOPS);
        expect(list.length, `${a}/${v}`).toBeLessThanOrEqual(SHELL.stops + 1); // the menu stands in on a phone
        for (const id of list) expect(ids[v].has(id), `${a}/${v}: ${id}`).toBe(true);
        expect(list, a).not.toContain('hello');
        expect(list, a).not.toContain('done');
      }
    }
  });

  it('names every chapter and stop once in a tour, the shell and the hello included', () => {
    for (const name of AUDIENCES) {
      const chapters = TOURS[name].map((c) => c.id);
      expect(new Set(chapters).size, name).toBe(chapters.length);
      for (const v of VIEWS)
        for (const phone of [false, true]) {
          const ids = [HELLO[name].id, ...shellStopsFor(name, v, SHELL_STOPS), ...seen(TOURS[name], phone).flatMap(stopsOf).map((s) => s.id)];
          expect(
            ids.filter((x, i) => ids.indexOf(x) !== i),
            `${name}/${v}${phone ? ' (phone)' : ''}`,
          ).toEqual([]);
        }
    }
  });

  it('lights nothing twice in a tour but the guide, the shell included', () => {
    for (const name of AUDIENCES)
      for (const v of VIEWS)
        for (const phone of [false, true]) {
          const shell = TOURS[v].filter((s) => shellStopsFor(name, v, SHELL_STOPS).includes(s.id));
          const ats = [...shell, ...seen(TOURS[name], phone).flatMap(stopsOf)].map((s) => s.at).filter((a) => a && a !== 'guide');
          expect(
            ats.filter((x, i) => ats.indexOf(x) !== i),
            `${name}/${v}${phone ? ' (phone)' : ''}`,
          ).toEqual([]);
        }
  });

  it('says 12 to 45 words a stop, the hiring tour’s 30 at most, in the house’s spelling and quotes', () => {
    const US = /\b(color|colors|favorite|center|centered|theater|gray|realize|organize|recognize|traveler|traveling|catalog)\b/i;
    const hiring = new Set(own(TOURS.recruiter).map((s) => s.id));
    for (const name of AUDIENCES)
      for (const s of [HELLO[name], ...own(TOURS[name])]) {
        const at = `${name}/${s.id}`;
        for (const c of CTXS) {
          const n = words(s, c);
          expect(n, `${at}: ${n} words`).toBeGreaterThanOrEqual(12);
          expect(n, `${at}: ${n} words`).toBeLessThanOrEqual(hiring.has(s.id) ? 30 : 45);
          for (const t of [s.title, textOf(s, c), ...(s.actions ?? []).map((x) => labelOf(x, c))]) {
            expect(t, at).not.toMatch(/['"]/);
            expect(t, at).not.toMatch(US);
            expect(t, at).not.toMatch(/!.*!/);
          }
        }
      }
  });

  it('calls the hiring tour that, never the recruiter’s', () => {
    for (const id of ['tour', 'tourRecruiter', 'tourPlayer']) for (const t of Object.values(ACHIEVEMENTS[id])) expect(t, id).not.toMatch(/recruiter/i);
    for (const name of AUDIENCES)
      for (const s of [HELLO[name], ...own(TOURS[name])]) for (const t of [s.title, textOf(s, ctx), ...(s.actions ?? []).map((x) => labelOf(x))]) expect(t, `${name}/${s.id}`).not.toMatch(/recruiter/i);
  });

  it('ends on a card in the middle that points to the guide', () => {
    for (const name of AUDIENCES) {
      const last = stopsOf(TOURS[name].at(-1)).at(-1);
      expect(last.at, name).toBeUndefined();
      expect(textOf(last, ctx), name).toMatch(/guide/);
    }
  });

  it('offers places by buttons: a route the site has, a link, or the next tour', () => {
    for (const name of AUDIENCES)
      for (const s of own(TOURS[name]))
        if (s.actions) {
          expect(s.actions.length, `${name}/${s.id}`).toBeLessThanOrEqual(4);
          for (const a of s.actions) {
            const at = `${name}/${s.id}: ${a.label}`;
            expect(labelOf(a), at).toBeTruthy();
            expect([a.to, a.href, a.tour].filter(Boolean).length, at).toBe(1);
            if (a.to) expect(routed(a.to), `${at} → ${a.to}`).toBe(true);
            if (a.tour) expect(['recruiter', 'player'], at).toContain(a.tour);
          }
        }
  });

  it('knows a route from a page it doesn’t have', () => {
    expect(routed('/experience')).toBe(true);
    expect(routed('/experience/aws')).toBe(true);
    expect(routed('/galaxy/hoth/surface?mission=assault')).toBe(true);
    expect(routed('/nowhere/at/all')).toBe(false);
  });

  it('keeps a lit stop or a card in the middle in every chapter on a phone', () => {
    for (const name of AUDIENCES) for (const c of seen(TOURS[name], true)) expect(stopsOf(c).some((s) => !s.at || !FOLDED.has(s.at)), `${name}/${c.id}`).toBe(true);
  });

  it('shows things to do from the catalogue', async () => {
    const todos = AUDIENCES.flatMap((a) => own(TOURS[a]))
      .filter((s) => s.todo)
      .map((s) => s.todo);
    expect(todos.length).toBeGreaterThan(5);
    for (const id of todos) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    // the catalogue is stream A's (src/data/todo.js); until it lands the ids are only checked for shape
    if (!existsSync(join(SRC, 'data/todo.js'))) return;
    const { todoFor } = await import('../../data/todo.js');
    const ids = new Set(todoFor('mixed').map((t) => t.id));
    for (const id of todos) expect(ids.has(id), `todo ${id}`).toBe(true);
  });

  it('reads in the spec’s minutes: words ÷ 3 a second, 4 s a stop and 3 s a chapter, with the shell’s allowance', () => {
    const shell = SHELL.words / 3 + SHELL.stops * 4 + 3;
    const times = {};
    for (const name of AUDIENCES) {
      const hello = most(HELLO[name]) / 3 + 4;
      times[name] = Math.round(shell + hello + Math.max(seconds(seen(TOURS[name], false)), seconds(seen(TOURS[name], true))));
      expect(times[name], `${name}: ${times[name]} s`).toBeLessThanOrEqual(BUDGET[name]);
    }
    console.log('reading times (s):', times);
  });
});

describe('the player’s worlds', () => {
  const galaxy = TOURS.player.find((c) => c.id === 'galaxy');
  const worlds = TOURS.player.find((c) => c.id === 'worlds');
  const offered = (c) => c.stops.flatMap((s) => (s.actions ?? []).map((a) => a.to)).filter(Boolean);
  const cards = [...galaxy.stops, ...worlds.stops.slice(1)];

  it('has every world on the map once, Star Wars’ in the galaxy’s chapter and the rest a card each', () => {
    expect([...offered(galaxy), ...offered(worlds)].sort()).toEqual(WORLDS.map((w) => w.to).sort());
    expect(offered(worlds)).toEqual(WORLDS.filter((w) => w.from !== 'Star Wars').map((w) => w.to));
  });

  it('counts the worlds as the worlds chapter says', () => {
    const n = { 13: 'Thirteen', 14: 'Fourteen', 15: 'Fifteen' }[offered(worlds).length];
    expect(worlds.stops[0].title).toContain(n);
  });

  it('opens each card with the guide’s line on the world, under 25 words on a phone too', () => {
    for (const s of cards) {
      const to = s.actions[0].to;
      expect(ABOUT[to], to).toBeTruthy();
      expect(textOf(s, ctx).startsWith(ABOUT[to]), to).toBe(true);
      expect(most(s), `${to}: ${most(s)} words`).toBeLessThan(25);
    }
  });

  it('says the download on a phone where it’s more than a megabyte', () => {
    for (const s of cards) {
      const mb = WORLD_MB[s.actions[0].to];
      if (mb > 1) expect(textOf(s, { ...ctx, touch: true }), s.id).toContain(`${mb} MB`);
      expect(textOf(s, ctx), s.id).not.toMatch(/MB/);
    }
  });

  it('takes its Flying chapter from the map’s own basics', () => {
    expect(TOURS.player[0]).toMatchObject({ id: 'flying', path: '/universe', brief: '/universe/fly' });
    expect(TOURS.player[0].stops).toBeUndefined();
  });
  it('walks into Avengers HQ with the gate a button away, and the Space Stone opening the portal', () => {
    const stop = WALKED.find((c) => c.id === 'walk-avengers').stops[0];
    expect(stop.actions).toEqual([{ label: 'Play Thwip! at the gate', to: linkOf('spidey') }]);
    expect(textOf(stop, ctx)).toMatch(/the Space Stone opens a portal to Titan/);
  });
});

describe('the whole tour', () => {
  it('is the hiring tour from Home to Under the hood, the player’s from the galaxy to the colours, and one end', () => {
    const ids = (list, from, to) => list.slice(list.findIndex((c) => c.id === from), list.findIndex((c) => c.id === to) + 1).map((c) => c.id);
    expect(TOURS.mixed.map((c) => c.id)).toEqual([...ids(TOURS.recruiter, 'home', 'hood'), ...ids(TOURS.player, 'galaxy', 'colours'), 'end']);
  });
});

describe('the universe’s button on a phone', () => {
  it('says the download once worlds.js measures it', () => {
    const terminal = TOURS.recruiter.find((c) => c.id === 'hood').phone.flatMap((c) => c.stops).flatMap((s) => s.actions ?? []).find((a) => a.to === '/universe');
    expect(labelOf(terminal, { ...ctx, mb: { '/universe': 6 } })).toBe('Open the universe map · 6 MB');
    expect(labelOf(terminal, { ...ctx, mb: {} })).toBe('Open the universe map');
  });
});

describe('the hiring tour’s ships', () => {
  it('says whether you have one', () => {
    const s = own(TOURS.recruiter).find((x) => x.at === 'ships');
    expect(textOf(s, { ...ctx, ship: null })).toMatch(/^Pick a ship/);
    expect(textOf(s, { ...ctx, ship: 'The X-wing' })).toMatch(/^Your ship/);
  });
});
