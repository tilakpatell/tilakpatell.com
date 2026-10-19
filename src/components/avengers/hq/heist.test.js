import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { PLACES } from '../world/rules';
import { STONE_IDS } from './stones';
import { BEFORE, HEIST_GAMES, HEIST_KEY, HEIST_STONES, HEIST_VERSION, cleanHeist, heistSummary, loadHeist, migrateHeist, registerHeist, spanWords, withStone, withTry } from './heist';

// saves.test.js's store
const store = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
};
const M = 60e3, H = 60 * M, D = 24 * H;
const games = [{ id: 'stark', name: 'Tony Stark’s workshop' }, { id: 'cap', name: 'The training center' }];

describe('the heist record', () => {
  it('names its key, its version and the stones and games it keeps', () => {
    expect(HEIST_KEY).toBe('tp-hq-heist');
    expect(HEIST_VERSION).toBe(1);
    expect(HEIST_STONES).toEqual(STONE_IDS);
    expect(HEIST_GAMES).toEqual(PLACES.map((p) => p.id));
  });
  it('keeps the time a stone was first won, never a later one', () => {
    const empty = cleanHeist(null);
    const a = withStone(empty, 'power', 1000);
    expect(a).toEqual({ stones: { power: 1000 }, tries: {} });
    expect(empty).toEqual({ stones: {}, tries: {} });
    for (const id of ['power', 'soul-clint', 'aether']) expect(withStone(a, id, 5000)).toBe(a);
  });
  it('counts a try per start, for the eight games only', () => {
    const r = withTry(withTry(withTry(cleanHeist(null), 'stark'), 'stark'), 'vault');
    expect(r.tries).toEqual({ stark: 2, vault: 1 });
    expect(withTry(r, 'nowhere')).toBe(r);
  });
  it('cleans junk out of what was stored', () => {
    for (const junk of ['{not a record', ['power'], { stones: null, tries: 'x' }, 42]) expect(cleanHeist(junk)).toEqual({ stones: {}, tries: {} });
    expect(cleanHeist({ stones: { power: 5, mind: null, aether: 3, time: 'soon', space: -1 }, tries: { stark: 2.7, thor: -1, nowhere: 4, cap: 'x' } }))
      .toEqual({ stones: { power: 5, mind: null }, tries: { stark: 2 } });
  });
  it('gives stones held before records began no time (the migration from no key)', () => {
    expect(migrateHeist(null, ['power', 'mind', 'soul-clint'])).toEqual({ stones: { power: null, mind: null }, tries: {} });
    expect(migrateHeist({ stones: { power: 7 }, tries: {} }, ['power', 'time'])).toEqual({ stones: { power: 7, time: null }, tries: {} });
  });
  it('keeps the record through runtime/saves at version 1', () => {
    const local = store();
    const saves = createSaves({ local, session: store() });
    registerHeist(saves);
    expect(loadHeist(saves, ['space'])).toEqual({ stones: { space: null }, tries: {} });
    expect(local.map.has('tp-hq-heist')).toBe(false); // reading writes nothing
    saves.set(HEIST_KEY, withTry(loadHeist(saves, ['space']), 'cap'));
    expect(JSON.parse(local.getItem('tp-hq-heist'))).toEqual({ v: 1, data: { stones: { space: null }, tries: { cap: 1 } } });
    local.setItem('tp-hq-heist', JSON.stringify({ stones: { mind: 9, x: 1 }, tries: {} })); // unversioned
    expect(loadHeist(saves)).toEqual({ stones: { mind: 9 }, tries: {} });
    expect(JSON.parse(local.getItem('tp-hq-heist')).v).toBe(1);
    local.setItem('tp-hq-heist', JSON.stringify({ v: 1, data: { stones: { power: 'x', time: 4 }, tries: { stark: -3, vault: 2 } } }));
    expect(loadHeist(saves)).toEqual({ stones: { time: 4 }, tries: { vault: 2 } });
  });
});

describe('the heist summary', () => {
  it('says a span in days, hours and minutes', () => {
    for (const ms of [20e3, -5, NaN]) expect(spanWords(ms)).toBe('Under a minute');
    expect(spanWords(M)).toBe('1 minute');
    expect(spanWords(42 * M)).toBe('42 minutes');
    expect(spanWords(H)).toBe('1 hour');
    expect(spanWords(3 * H + 12 * M)).toBe('3 hours 12 minutes');
    expect(spanWords(D + H)).toBe('1 day 1 hour');
    expect(spanWords(2 * D + 30 * M)).toBe('2 days');
  });
  it('times the first stone to the sixth, with tries and the best per game', () => {
    const rec = { stones: { power: 0, mind: H, reality: 2 * H, time: 3 * H, space: D, soul: D + 2 * H }, tries: { stark: 4, cap: 1 } };
    expect(heistSummary(rec, { games, bests: { stark: '12,400' } })).toEqual({
      span: '1 day 2 hours',
      rows: [
        { id: 'stark', name: 'Tony Stark’s workshop', tries: '4 tries', best: '12,400' },
        { id: 'cap', name: 'The training center', tries: '1 try', best: 'No best kept' },
      ],
    });
  });
  it('says “before records began” for what was won before the record', () => {
    const rec = migrateHeist({ stones: { space: 5 * D }, tries: { stark: 2 } }, ['power', 'mind', 'reality', 'time', 'soul', 'space']);
    const s = heistSummary(rec, { games });
    expect(BEFORE).toBe('Before records began');
    expect(s.span).toBe(BEFORE);
    expect(s.rows.map((r) => r.tries)).toEqual(['2 tries', BEFORE]);
  });
  it('writes its copy in sentence case, with no straight quotes', () => {
    const s = heistSummary(cleanHeist(null), { games });
    for (const t of [s.span, ...s.rows.flatMap((r) => [r.tries, r.best])]) {
      expect(t).toMatch(/^[A-Z0-9]/);
      expect(t).not.toMatch(/["']/);
      expect(t).not.toMatch(/\.$/);
    }
  });
});

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
// a component's `const <fn> = useCallback(`, up to its next declaration
const bodyOf = (src, fn) => {
  const at = src.indexOf(`const ${fn} = useCallback(`);
  return at < 0 ? '' : src.slice(at, src.indexOf('\n  const ', at + 1));
};
// [place id, file, the callback a run starts in, recordTry calls in the file]
const STARTS = [
  ['stark', 'repulsor/RepulsorRange.jsx', 'start', 1],
  ['thor', 'lawn/HoldTheLawn.jsx', 'begin', 1],
  ['cap', 'ricochet/Ricochet.jsx', 'enter', 1],
  ['hawkeye', 'trickshot/TrickShot.jsx', 'begin', 1],
  ['widow', 'widow/Infiltration.jsx', 'enter', 2],
  ['banner', 'smash/SmashRun.jsx', 'start', 1],
  ['spidey', 'thwip/Thwip.jsx', 'start', 1],
  ['vault', 'tesseract/TesseractRun.jsx', 'start', 1],
  ['cap', 'ricochet/Flat.jsx', 'enter', 1],
];

describe('every game', () => {
  it('counts a try where its run starts', () => {
    expect([...new Set(STARTS.map(([id]) => id))]).toEqual(HEIST_GAMES);
    for (const [id, file, fn, calls] of STARTS) {
      const src = read(file);
      expect(bodyOf(src, fn), file).toContain(`recordTry('${id}')`);
      expect(src.split('recordTry(').length - 1, file).toBe(calls);
    }
  });
  it('counts no try for a click that starts nothing new', () => {
    const repulsor = read('repulsor/RepulsorRange.jsx');
    const guard = repulsor.indexOf('if (!startable(stage.status)) return;');
    expect(guard).toBeGreaterThan(-1);
    expect(repulsor.indexOf("recordTry('stark')")).toBeGreaterThan(guard);
    expect(bodyOf(read('trickshot/TrickShot.jsx'), 'begin')).toMatch(/if \(round === 0\) \{[^}]*recordTry\('hawkeye'\)/);
    expect(read('widow/Infiltration.jsx')).toMatch(/recordTry\('widow'\);\s*game\.current = newLevel\(g\.index\)/);
  });
});
