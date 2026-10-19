import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { GAMES, GAME_AT, TOUCH_HELP, TOUCH_ICONS, fmt, local3DKey, nextFor, readLocal3D, resolveLocal3D, scoreLine, startable, stoneWords, switchFor, watchHidden, writeLocal3D } from './gameScreen';
import { PLACES, progress } from '../world/rules';
import { linkOf } from '../world/links';

// a localStorage that lives for one test
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const site = (o) => ({ on: false, can: true, held: false, ...o });
const ALL = ['power', 'reality', 'mind', 'soul-clint', 'soul-natasha', 'soul', 'time', 'space'];

describe('a game’s own 3D', () => {
  it('keeps one key a game, tp-hq-3d-<game>, with auto as no key', () => {
    const store = memoryStorage();
    expect(local3DKey('repulsor')).toBe('tp-hq-3d-repulsor');
    expect(readLocal3D('repulsor', store)).toBe('auto');
    writeLocal3D('repulsor', 'off', store);
    expect(store.getItem('tp-hq-3d-repulsor')).toBe('"off"');
    expect([readLocal3D('repulsor', store), readLocal3D('lawn', store)]).toEqual(['off', 'auto']);
    writeLocal3D('repulsor', 'auto', store);
    expect(store.getItem('tp-hq-3d-repulsor')).toBe(null);
    expect(store.getItem('tp-3d')).toBe(null);
  });
  it('reads junk, broken storage and no storage as auto, and never throws', () => {
    const store = memoryStorage();
    store.setItem('tp-hq-3d-thwip', '{nope');
    expect(readLocal3D('thwip', store)).toBe('auto');
    store.setItem('tp-hq-3d-thwip', '"maybe"');
    expect(readLocal3D('thwip', store)).toBe('auto');
    const broken = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
      removeItem() {
        throw new Error('denied');
      },
    };
    expect(readLocal3D('thwip', broken)).toBe('auto');
    expect(() => writeLocal3D('thwip', 'on', broken)).not.toThrow();
    expect(readLocal3D('thwip', null)).toBe('auto');
    expect(() => writeLocal3D('thwip', 'on', null)).not.toThrow();
    expect(readLocal3D('thwip')).toBe('auto'); // node: no localStorage at all
    expect(() => writeLocal3D('thwip', 'on')).not.toThrow();
  });
  it('draws in 3D by the game’s own choice first, and the site’s only on auto', () => {
    expect(resolveLocal3D('off', site({ on: true }))).toBe(false);
    expect(resolveLocal3D('on', site())).toBe(true);
    expect(resolveLocal3D('on', site({ can: false }))).toBe(false);
    expect(resolveLocal3D('on', site({ held: true }))).toBe(false);
    expect(resolveLocal3D('auto', site({ on: true }))).toBe(true);
    expect(resolveLocal3D('auto', site())).toBe(false);
  });
  it('never touches the site’s 3D setting', () => {
    const src = readFileSync(new URL('./useGame3D.js', import.meta.url), 'utf8');
    expect(src).toContain('readLocal3D(game)');
    expect(src).not.toMatch(/setMode3D|site\.set\b/);
  });
});

describe('the switch, the touch help and the games', () => {
  it('says what the switch says: 3D game on, Try 3D, Play in 2D and Try 3D again', () => {
    expect(switchFor({ can: true, on: true, status: 'on' })).toEqual({ bar: { label: '3D game: on', pressed: true, next: 'off' }, note: null });
    expect(switchFor({ can: true, on: false, status: 'idle' })).toEqual({ bar: null, note: { text: 'The stone here is won in the 3D game.', action: { label: 'Try 3D', next: 'on' } } });
    expect(switchFor({ can: true, on: false, status: 'idle', stone: false }).note.text).toBe('This game is played in 3D.');
    expect(switchFor({ can: true, on: true, status: 'on', flat: true })).toEqual({ bar: { label: 'Play in 2D', next: 'off' }, note: null });
    expect(switchFor({ can: true, on: false, status: 'idle', flat: true })).toEqual({ bar: { label: 'Play in 3D', next: 'on' }, note: null });
    expect(switchFor({ can: false, on: false, status: 'idle' })).toEqual({ bar: null, note: { text: 'The stone here is won in the 3D game.', action: null } });
    expect(switchFor({ can: false, on: false, status: 'idle', flat: true })).toEqual({ bar: null, note: null });
    for (const [status, text] of [
      ['failed', '3D couldn’t start here, so here is the simple version.'],
      ['slow', 'This device was struggling with 3D, so here is the simple version.'],
      ['lost', 'The graphics chip reset, so here is the simple version.'],
    ]) {
      expect(switchFor({ can: true, on: true, status })).toEqual({ bar: null, note: { text, action: { label: 'Try 3D again', next: 'retry' } } });
    }
  });
  it('has touch words for every game, each with an icon it can draw', () => {
    expect(Object.keys(TOUCH_HELP).sort()).toEqual([...GAMES].sort());
    for (const rows of Object.values(TOUCH_HELP)) {
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.length).toBeLessThanOrEqual(3);
      for (const { icon, text } of rows) {
        expect(TOUCH_ICONS).toContain(icon);
        expect(text).toMatch(/^[A-Z]/);
        expect(text).not.toMatch(/\.$/);
        expect(text).not.toContain("'");
      }
    }
  });
  it('names the game at every door', () => {
    expect(Object.keys(GAME_AT)).toEqual(PLACES.map((p) => p.id));
    expect(Object.values(GAME_AT)).toEqual(GAMES);
  });
});

describe('the way on and the score', () => {
  it('points the way on at the next stone not yet won, never this building nor the gate', () => {
    expect(nextFor(progress(['power']), 'stark', linkOf)).toEqual({ id: 'thor', label: 'Mjolnir', to: '/avengers/lawn' });
    expect(nextFor(progress([]), 'stark', linkOf).id).toBe('thor');
    expect(nextFor(progress([]), 'thor', linkOf).id).toBe('stark');
    expect(nextFor(progress(['power', 'reality', 'mind', 'soul-clint', 'time', 'space']), 'spidey', linkOf).id).toBe('widow');
    expect(nextFor(progress(ALL), 'vault', linkOf)).toBe(null);
    expect(nextFor(progress([]), 'stark', () => null)).toBe(null);
  });
  it('reads a score against the best, and words a stone whole or whose half', () => {
    expect(scoreLine({ score: 12340, best: 15200 })).toEqual({ big: '12,340', small: 'best 15,200' });
    expect(scoreLine({ score: 15300, best: 15200, newBest: true }).small).toBe('a new best');
    expect(scoreLine({ score: 40 }).small).toBe('points');
    expect(scoreLine({ score: 1840.6, best: 2000, format: (n) => `${fmt(n)} m` })).toEqual({ big: '1,841 m', small: 'best 2,000 m' });
    expect(scoreLine({ score: null })).toBe(null);
    expect(stoneWords('Power Stone')).toBe('The Power Stone is yours.');
    expect(stoneWords('Soul Stone', 'Clint’s')).toBe('Clint’s half of the Soul Stone is yours.');
  });
  it('starts a game only on a stage that has drawn', () => {
    expect(startable('on')).toBe(true);
    for (const s of ['idle', 'loading', 'failed', 'slow', 'lost']) expect(startable(s)).toBe(false);
  });
});

describe('a hidden tab', () => {
  it('pauses a game when its tab is hidden, and stops listening when asked', () => {
    const doc = {
      hidden: false,
      on: null,
      addEventListener(t, f) {
        if (t === 'visibilitychange') this.on = f;
      },
      removeEventListener(t, f) {
        if (this.on === f) this.on = null;
      },
    };
    const hide = vi.fn();
    const stop = watchHidden(doc, hide);
    doc.on();
    expect(hide).not.toHaveBeenCalled();
    doc.hidden = true;
    doc.on();
    expect(hide).toHaveBeenCalledTimes(1);
    stop();
    expect(doc.on).toBe(null);
    expect(() => watchHidden(null, hide)()).not.toThrow();
  });
});
