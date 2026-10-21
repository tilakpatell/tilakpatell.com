import { describe, expect, it } from 'vitest';
import {
  AUDIENCES,
  SHELL_STOPS,
  TOUR_MINUTES,
  TOUR_TIMES,
  WAIT_MS,
  chapterReady,
  clearOf,
  compose,
  isLightRoute,
  litBox,
  offerHere,
  parseTourLink,
  placeCard,
  plainDetail,
  planFor,
  readProgress,
  resolveChapter,
  resolveSteps,
  samePage,
  shellStopsFor,
  startAt,
  tourFor,
  unfinished,
  waitUntil,
  writeProgress,
} from './tour';

describe('which tour a page gets', () => {
  it('gives the map the universe’s, at the front door and every place on it', () => {
    for (const p of ['/', '/universe', '/universe/marvel']) expect(tourFor(p), p).toBe('universe');
  });

  it('gives every other page the classic site’s', () => {
    for (const p of ['/home', '/experience/aws', '/projects', '/terminal', '/c-137']) expect(tourFor(p), p).toBe('classic');
  });
});

describe('the offer on a first arrival', () => {
  it('is made on the map and the feed’s pages', () => {
    for (const p of ['/', '/universe', '/universe/marvel', '/home', '/experience', '/experience/aws', '/projects', '/resume', '/contact', '/travel']) expect(offerHere(p, null), p).toBe(true);
  });

  it('is never made over a world, a project or the terminal', () => {
    for (const p of ['/c-137', '/galaxy/hoth', '/middle-earth', '/projects/gameboy', '/terminal', '/changes', '/worlds', '/nowhere']) expect(offerHere(p, null), p).toBe(false);
  });

  it('is made once: once it’s been offered, taken or turned down, never again', () => {
    for (const seen of ['offered', 'done', 'skipped']) expect(offerHere('/home', readProgress(seen)), seen).toBe(false);
    expect(offerHere('/home', readProgress({ offered: true, done: [] }))).toBe(false);
  });

  it('is made when nothing’s been kept, or what was kept is unreadable', () => {
    expect(offerHere('/home', readProgress(null))).toBe(true);
    expect(offerHere('/home', readProgress(undefined))).toBe(true);
  });
});

describe('the stops that show on this screen', () => {
  const steps = [{ id: 'hello' }, { id: 'search', at: 'search' }, { id: 'menu', at: 'menu' }, { id: 'bye' }];

  it('keeps a stop whose target is showing, and the cards with none', () => {
    expect(resolveSteps(steps, (at) => at === 'search').map((s) => s.id)).toEqual(['hello', 'search', 'bye']);
  });

  it('swaps the nav’s stops for the menu’s on a phone', () => {
    expect(resolveSteps(steps, (at) => at === 'menu').map((s) => s.id)).toEqual(['hello', 'menu', 'bye']);
  });

  it('keeps every stop of a world’s basics, in the middle where its target isn’t showing', () => {
    const kept = resolveSteps(steps, (at) => at === 'menu', true);
    expect(kept.map((s) => s.id)).toEqual(['hello', 'search', 'menu', 'bye']);
    expect(kept.map((s) => s.at)).toEqual([undefined, undefined, 'menu', undefined]);
  });
});

describe('where the card goes', () => {
  const view = { w: 1280, h: 800 };
  const card = { w: 320, h: 200 };
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

  it('goes in the middle with nothing to point at', () => {
    expect(placeCard(null, card, view)).toEqual({ side: 'center', top: 300, left: 480 });
  });

  it('goes below a target near the top, centred under it', () => {
    const at = placeCard(rect(600, 10, 80, 40), card, view);
    expect(at.side).toBe('bottom');
    expect(at.top).toBeGreaterThan(50);
    expect(at.left).toBe(480);
  });

  it('goes above a target near the bottom', () => {
    const at = placeCard(rect(600, 740, 80, 40), card, view);
    expect(at.side).toBe('top');
    expect(at.top + card.h).toBeLessThan(740);
  });

  it('goes beside a target as tall as the page', () => {
    const at = placeCard(rect(900, 80, 360, 700), card, view);
    expect(at.side).toBe('left');
    expect(at.left + card.w).toBeLessThan(900);
  });

  it('stays on the screen beside a target in a corner', () => {
    const at = placeCard(rect(1240, 10, 36, 36), card, view);
    expect(at.left + card.w).toBeLessThanOrEqual(view.w - 16);
    expect(at.left).toBeGreaterThanOrEqual(16);
  });

  it('takes the side with the most room when none has enough, still on the screen', () => {
    const phone = { w: 390, h: 760 };
    const at = placeCard(rect(0, 150, 390, 500), card, phone);
    expect(at.side).toBe('top');
    expect(at.top).toBeGreaterThanOrEqual(16);
    expect(at.left).toBeGreaterThanOrEqual(16);
    expect(at.left + card.w).toBeLessThanOrEqual(phone.w - 16);
  });
});

describe('the lit box', () => {
  const view = { w: 390, h: 780 };

  it('stands a little off its target', () => {
    expect(litBox({ left: 100, top: 100, right: 200, bottom: 140 }, view, 6)).toEqual({ left: 94, top: 94, width: 112, height: 52 });
  });

  it('stops at the window’s edges, for a list longer than a phone’s sheet', () => {
    expect(litBox({ left: 0, top: 480, right: 390, bottom: 1100 }, view, 6)).toEqual({ left: 2, top: 474, width: 386, height: 304 });
  });

  it('is nothing for a target off the screen', () => {
    expect(litBox({ left: 0, top: 900, right: 100, bottom: 940 }, view, 6)).toBe(null);
  });
});

describe('what the tour remembers', () => {
  it('reads what older visits kept: the three words', () => {
    expect(readProgress('done')).toEqual({ offered: true, done: ['view'] });
    expect(readProgress('offered')).toEqual({ offered: true, done: [] });
    expect(readProgress('skipped')).toEqual({ offered: true, done: [] });
  });

  it('reads nothing kept as nothing, so the offer’s still made', () => {
    expect(readProgress(null)).toBeNull();
    expect(readProgress(undefined)).toBeNull();
  });

  it('reads anything else it can’t make sense of as offered, without throwing', () => {
    for (const raw of ['{not json', 42, true, [], 'gibberish', { done: 'recruiter' }, { audience: 7, done: [1, 'player'] }]) {
      const p = readProgress(raw);
      expect(p.offered, JSON.stringify(raw)).toBe(true);
      expect(Array.isArray(p.done), JSON.stringify(raw)).toBe(true);
      expect(p.done.every((d) => typeof d === 'string'), JSON.stringify(raw)).toBe(true);
    }
    expect(readProgress({ audience: 7, done: [1, 'player'] })).toEqual({ offered: true, done: ['player'] });
  });

  it('reads the new shape back as written', () => {
    const p = { offered: true, audience: 'recruiter', chapter: 'projects', stop: 'cartridges', done: ['player'] };
    expect(readProgress(p)).toEqual(p);
  });

  it('drops an audience it doesn’t know, and where it was with it', () => {
    expect(readProgress({ offered: true, audience: 'pirate', chapter: 'x', stop: 'y', done: [] })).toEqual({ offered: true, done: [] });
  });

  it('writes a stop over the last, and adds a finished tour once', () => {
    let p = writeProgress(null, { audience: 'recruiter', chapter: 'home', stop: 'github' });
    expect(p).toEqual({ offered: true, audience: 'recruiter', chapter: 'home', stop: 'github', done: [] });
    p = writeProgress(p, { done: ['recruiter'] });
    p = writeProgress(p, { done: ['recruiter', 'player'] });
    expect(p.done).toEqual(['recruiter', 'player']);
  });

  it('forgets where it was when told, keeping what was finished', () => {
    const p = writeProgress({ offered: true, audience: 'player', chapter: 'worlds', stop: 'c137', done: ['view'] }, { audience: undefined, chapter: undefined, stop: undefined });
    expect(p).toEqual({ offered: true, done: ['view'] });
  });

  it('says which tour is unfinished, and how far in', () => {
    expect(unfinished(null)).toBeNull();
    expect(unfinished({ offered: true, done: [] })).toBeNull();
    expect(unfinished({ offered: true, audience: 'player', chapter: 'worlds', done: [] })).toEqual({ audience: 'player', chapter: 'worlds' });
    // (taken again after finishing it once, and left part way: still offered)
    expect(unfinished({ offered: true, audience: 'player', chapter: 'worlds', done: ['player'] })).toEqual({ audience: 'player', chapter: 'worlds' });
  });
});

describe('a link that starts a tour', () => {
  it('reads the audience, with all meaning the whole tour', () => {
    expect(parseTourLink('?tour=recruiter')).toEqual({ audience: 'recruiter' });
    expect(parseTourLink('?tour=hiring')).toEqual({ audience: 'recruiter' });
    expect(parseTourLink('?tour=player')).toEqual({ audience: 'player' });
    expect(parseTourLink('?tour=all&chapter=worlds')).toEqual({ audience: 'mixed', chapter: 'worlds' });
    expect(parseTourLink('?place=hoth&tour=recruiter&chapter=resume')).toEqual({ audience: 'recruiter', chapter: 'resume' });
  });

  it('ignores a link without one, or with one it doesn’t know', () => {
    for (const s of ['', '?', '?place=hoth', '?tour=', '?tour=pirate', '?tour=mixed', undefined]) expect(parseTourLink(s), String(s)).toBeNull();
  });

  it('names three audiences', () => {
    expect(AUDIENCES).toEqual(['recruiter', 'player', 'mixed']);
  });
});

describe('the pages a tour may take you to', () => {
  it('are the light pages: the feed, a project, the terminal, the log and the map', () => {
    for (const p of ['/home', '/experience', '/projects', '/projects/gameboy-emulator', '/resume', '/contact', '/travel', '/terminal', '/changes', '/universe']) expect(isLightRoute(p), p).toBe(true);
  });

  it('are never the front door, a place on the map, or a world', () => {
    for (const p of ['/', '/universe/marvel', '/experience/aws', '/galaxy', '/deathstar', '/c-137', '/dot-matrix/64', '/projects/', '/homes', '']) expect(isLightRoute(p), p).toBe(false);
  });
});

describe('what starts a tour', () => {
  it('takes a plain object as where to start, and anything else (a click) as nothing', () => {
    expect(plainDetail({ audience: 'player' })).toEqual({ audience: 'player' });
    for (const d of [null, undefined, new Event('click'), 'player', 3, []]) expect(plainDetail(d), String(d)).toBeNull();
  });
});

// two small audience tours, as steps.js gives them (the shell's not in them)
const fixture = () => ({
  universe: [{ id: 'hello' }, { id: 'panel', at: 'panel' }, { id: 'ships', at: 'ships' }, { id: 'view', at: 'view' }, { id: 'search', at: 'search' }, { id: 'menu', at: 'menu' }, { id: 'guide', at: 'guide' }, { id: 'resume', at: 'resume' }, { id: 'done' }],
  classic: [{ id: 'hello' }, { id: 'pages', at: 'pages' }, { id: 'view', at: 'view' }, { id: 'search', at: 'search' }, { id: 'menu', at: 'menu' }, { id: 'terminal', at: 'terminal' }, { id: 'guide', at: 'guide' }, { id: 'resume', at: 'resume' }, { id: 'done' }],
  recruiter: [
    { id: 'home', title: 'Home', path: '/home', stops: [{ id: 'github', at: 'home-github', todo: 'github' }, { id: 'gameboy' }] },
    { id: 'projects', title: 'Projects', path: '/projects', stops: [{ id: 'cartridges', todo: 'gameboy-emulator' }] },
    {
      id: 'hood',
      title: 'Under the hood',
      path: '/universe',
      heavy: true,
      phone: [
        { id: 'hood-log', title: 'The ship’s log', path: '/changes', stops: [{ id: 'log', at: 'changes-log' }] },
        { id: 'hood-term', title: 'The terminal', path: '/terminal', stops: [{ id: 'term', at: 'terminal-input' }] },
      ],
      stops: [{ id: 'panel' }],
    },
    { id: 'end', title: 'That’s the tour', path: null, stops: [{ id: 'bye' }] },
  ],
  player: [
    { id: 'flying', title: 'Flying', path: '/universe', brief: '/universe/fly', stops: [] },
    { id: 'galaxy', title: 'The galaxy', path: '/universe', stops: [{ id: 'gal' }] },
    { id: 'worlds', title: 'The worlds', path: '/universe', stops: [{ id: 'c137', todo: 'c137' }, { id: 'scranton' }] },
    { id: 'colours', title: 'Colours', path: '/universe', stops: [{ id: 'col' }] },
    { id: 'end', title: 'That’s the tour', path: null, stops: [{ id: 'bye' }] },
  ],
});

describe('a tour’s plan', () => {
  it('opens on the shell of the view you’re in, cut to this audience’s stops', () => {
    const tours = fixture();
    const u = planFor(tours, 'recruiter', 'universe', '/universe/marvel');
    expect(u[0]).toMatchObject({ id: 'shell', path: '/universe' });
    expect(u[0].stops.map((s) => s.id)).toEqual(['panel', 'view', 'search', 'menu', 'guide', 'resume']);
    expect(u.slice(1).map((c) => c.id)).toEqual(['home', 'projects', 'hood', 'end']);
    const c = planFor(tours, 'recruiter', 'classic', '/resume');
    expect(c[0].path).toBe('/resume');
    expect(c[0].stops.map((s) => s.id)).toEqual(['pages', 'view', 'search', 'menu', 'guide', 'resume']);
    expect(planFor(tours, 'player', 'classic', '/c-137')[0]).toMatchObject({ path: '/home' });
    expect(planFor(tours, 'player', 'universe', '/universe')[0].stops.map((s) => s.id)).toEqual(['view', 'search', 'menu', 'resume']);
  });

  it('takes the shell’s stops the spec gives each audience', () => {
    expect(SHELL_STOPS.player).toEqual(['view', 'search', 'menu', 'resume']);
    expect(shellStopsFor('recruiter', 'universe')).toContain('panel');
    expect(shellStopsFor('recruiter', 'classic')).toContain('pages');
    expect(shellStopsFor('mixed', 'classic')).toEqual(shellStopsFor('recruiter', 'classic'));
    for (const a of ['recruiter', 'player', 'mixed']) for (const v of ['universe', 'classic']) expect(shellStopsFor(a, v)).not.toContain('hello'), expect(shellStopsFor(a, v)).not.toContain('done');
  });

  it('opens on the audience’s hello, and takes the shell’s stops steps.js gives', () => {
    const hello = { recruiter: { id: 'hi', title: 'Hello' } };
    const plan = planFor(fixture(), 'recruiter', 'classic', '/home', { hello, shell: { recruiter: ['view', 'resume'] } });
    expect(plan[0].stops.map((s) => s.id)).toEqual(['hi', 'view', 'resume']);
    expect(planFor(fixture(), 'mixed', 'classic', '/home', { hello })).toEqual([]);
    expect(shellStopsFor('player', 'universe', { player: { universe: ['ships'], classic: ['pages'] } })).toEqual(['ships']);
  });

  it('keeps an end card on the page before it', () => {
    const plan = planFor(fixture(), 'recruiter', 'classic', '/home');
    expect(plan.at(-1)).toMatchObject({ id: 'end', path: '/universe' });
  });

  it('shows a heavy chapter’s phone version on a coarse pointer, and only there', () => {
    const tours = fixture();
    expect(planFor(tours, 'recruiter', 'classic', '/home').find((c) => c.id === 'hood')).toMatchObject({ path: '/universe' });
    const phone = planFor(tours, 'recruiter', 'classic', '/home', { coarse: true });
    expect(phone.map((c) => c.id)).toEqual(['shell', 'home', 'projects', 'hood-log', 'hood-term', 'end']);
    expect(phone.at(-1).path).toBe('/terminal');
    expect(startAt(phone, { chapter: 'hood' })).toEqual({ c: 3, stop: undefined });
  });

  it('folds two tours together by chapter id, the shared end card as it is', () => {
    const tours = fixture();
    const end = { id: 'end', title: 'That’s the tour', path: null, stops: [{ id: 'both' }] };
    const mixed = compose(tours, [['recruiter', 'home', 'hood'], ['player', 'galaxy', 'colours'], end]);
    expect(mixed.map((c) => c.id)).toEqual(['home', 'projects', 'hood', 'galaxy', 'worlds', 'colours', 'end']);
    expect(mixed.at(-1)).toBe(end);
    expect(new Set(mixed.map((c) => c.id)).size).toBe(mixed.length);
    tours.mixed = mixed;
    expect(planFor(tours, 'mixed', 'universe', '/universe').map((c) => c.id)).toEqual(['shell', ...mixed.map((c) => c.id)]);
  });

  it('says plainly when a recipe names something it hasn’t got', () => {
    expect(() => compose(fixture(), [['pirate', 'a', 'b']])).toThrow(/pirate/);
    expect(() => compose(fixture(), [['player', 'galaxy', 'nowhere']])).toThrow(/nowhere/);
    expect(() => compose(fixture(), [['player', 'colours', 'galaxy']])).toThrow(/colours/);
  });

  it('gives no plan for a tour that isn’t there', () => {
    expect(planFor(fixture(), 'mixed', 'universe', '/universe')).toEqual([]);
  });

  it('finds where a link, a chapter or a thing to do starts it', () => {
    const plan = planFor(fixture(), 'recruiter', 'classic', '/home');
    expect(startAt(plan, {})).toEqual({ c: 0 });
    expect(startAt(plan, { chapter: 'projects' })).toEqual({ c: 2, stop: undefined });
    expect(startAt(plan, { chapter: 'home', stop: 'gameboy' })).toEqual({ c: 1, stop: 'gameboy' });
    expect(startAt(plan, { todo: 'gameboy-emulator' })).toEqual({ c: 2, stop: 'cartridges' });
    expect(startAt(plan, { chapter: 'nowhere' })).toBeNull();
    expect(startAt(plan, { todo: 'nothing' })).toBeNull();
  });
});

describe('when a chapter’s page is ready', () => {
  it('is clear with nothing over the page, or only the tour’s own card', () => {
    expect(clearOf({})).toBe(true);
    expect(clearOf({ dataset: { touring: '' }, modals: [true] })).toBe(true);
    for (const k of ['covered', 'intro', 'menu']) expect(clearOf({ dataset: { [k]: '' } }), k).toBe(false);
    expect(clearOf({ modals: [true, false] })).toBe(false);
    expect(clearOf({ gate: true })).toBe(false);
  });

  it('waits for the router to have the page, or the feed to have it under a neighbour’s address', () => {
    const base = { clear: true, loading: false };
    expect(chapterReady({ ...base, pathname: '/projects', path: '/projects' })).toBe(true);
    expect(chapterReady({ ...base, pathname: '/home', path: '/projects', feedTo: '/home' })).toBe(false);
    expect(chapterReady({ ...base, pathname: '/experience/aws', path: '/experience', feedTo: '/experience' })).toBe(true);
    expect(chapterReady({ ...base, pathname: '/projects', path: '/projects', loading: true })).toBe(false);
    expect(chapterReady({ ...base, pathname: '/projects', path: '/projects', clear: false })).toBe(false);
  });

  it('drops the stops whose target isn’t on this screen, but keeps one told to wait', () => {
    const stops = [{ id: 'hello' }, { id: 'search', at: 'search' }, { id: 'menu', at: 'menu' }, { id: 'late', at: 'cartridges', wait: true }];
    expect(resolveChapter(stops, (at) => at === 'menu').map((s) => s.id)).toEqual(['hello', 'menu', 'late']);
  });

  it('keeps every stop of a world’s basics, in the middle where its target isn’t showing', () => {
    const kept = resolveChapter([{ id: 'a', at: 'x' }, { id: 'b', at: 'y' }], (at) => at === 'y', true);
    expect(kept.map((s) => s.at)).toEqual([undefined, 'y']);
  });

  it('gives up after eight seconds', () => {
    expect(WAIT_MS).toBe(8000);
  });

  it('resolves on the tick that passes, or times out, with no real clock', async () => {
    let t = 0;
    let ticks = 0;
    const timers = { now: () => t, tick: (fn) => (t += 100, ticks++, Promise.resolve().then(fn)) };
    let n = 0;
    await expect(waitUntil(() => (++n >= 3 ? 'ready' : null), timers)).resolves.toBe('ready');
    expect(n).toBe(3);
    t = 0;
    ticks = 0;
    await expect(waitUntil(() => null, { ...timers, timeout: 1000 })).resolves.toBe('timeout');
    expect(ticks).toBe(10);
  });

  it('holds, the clock started again, while a world asks whether to download', async () => {
    let t = 0;
    let ticks = 0;
    const timers = { now: () => t, tick: (fn) => ((t += 100), ticks++, Promise.resolve().then(fn)) };
    // asking until just before 2 s, then nothing: the second counts from the last hold (1.9 s)
    await expect(waitUntil(() => (t < 2000 ? 'hold' : null), { ...timers, timeout: 1000 })).resolves.toBe('timeout');
    expect(t).toBe(2900);
    expect(ticks).toBe(29);
  });

  it('stops waiting when told to', async () => {
    let t = 0;
    const ctl = { cancelled: false };
    const timers = { now: () => t, tick: (fn) => ((t += 100), (ctl.cancelled = t >= 300), Promise.resolve().then(fn)) };
    await expect(waitUntil(() => null, { ...timers, cancelled: () => ctl.cancelled })).resolves.toBe('cancelled');
  });
});

describe('whether you’re on a chapter’s page', () => {
  it('is the page itself', () => {
    expect(samePage('/projects', '/projects')).toBe(true);
    expect(samePage('/universe', '/universe')).toBe(true);
  });

  it('is any of the feed’s pages for another of them, since the feed moves the address as it settles', () => {
    expect(samePage('/experience/aws', '/experience')).toBe(true);
    expect(samePage('/projects', '/experience')).toBe(true);
  });

  it('is not a project for the projects page, nor the projects page for a project', () => {
    expect(samePage('/projects/gameboy-emulator', '/projects')).toBe(false);
    expect(samePage('/projects', '/projects/gameboy-emulator')).toBe(false);
    expect(samePage('/projects/a', '/projects/b')).toBe(false);
  });

  it('is not a place on the map for the map, nor another page', () => {
    expect(samePage('/universe/marvel', '/universe')).toBe(false);
    expect(samePage('/terminal', '/home')).toBe(false);
    expect(samePage('/home', '/changes')).toBe(false);
  });
});

describe('how long each tour takes', () => {
  it('says it the same everywhere: minutes for the offer, words for the guide and the palette', () => {
    expect(Object.keys(TOUR_MINUTES)).toEqual(AUDIENCES);
    expect(TOUR_TIMES).toEqual({ recruiter: 'About 5 minutes', player: 'About 10 minutes', mixed: 'About 12 minutes' });
  });
});
