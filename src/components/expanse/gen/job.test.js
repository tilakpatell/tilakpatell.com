import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sectorCentre } from '../../../lib/space/address.js';
import { createWorkerPool } from '../../../runtime/workers';
import { starsOf } from '../scene/specks';
import { BEYOND_KEEP, POOLS, beyondJob, beyondKeys, beyondSector, definePools, runJob, sectorJob, withMoons } from './job';
import { KEEP_OUTS, clearOfKeepOuts } from './keepOuts';
import { UNIVERSE, universeOf } from './seed';
import { fullSector } from './space';
import { moonsOf } from './systems';

const cheb = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const sectorMsg = (universe, sx, sy, sz, key = `${sx},${sy},${sz}`) => ({ type: 'sector', key, universe, sx, sy, sz });
const beyondMsg = (centre, ring, universe = UNIVERSE, key = 'beyond') => ({ type: 'beyond', key, universe, centre, ring });
// the answer as the page gets it: cloned across, its buffers handed over
const across = ({ answer, transfer }) => structuredClone(answer, { transfer });
const planetsOf = (sector) => sector.systems.flatMap((s) => s.planets);
// every typed array's buffer in a value
function buffersIn(v, out = new Set(), seen = new Set()) {
  if (!v || typeof v !== 'object' || seen.has(v)) return out;
  seen.add(v);
  if (ArrayBuffer.isView(v)) out.add(v.buffer);
  else for (const x of Object.values(v)) buffersIn(x, out, seen);
  return out;
}

// a sector's every own enumerable value (getters read), keys sorted, in one string: a deep
// compare at a third of toStrictEqual's time, for sectors of 30,000 objects
const canon = (v) =>
  JSON.stringify(v, (k, x) => {
    if (typeof x === 'bigint') return { bigint: String(x) };
    if (ArrayBuffer.isView(x)) return { [x.constructor.name]: Array.from(x) };
    if (x && typeof x === 'object' && !Array.isArray(x)) return Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]]));
    return x;
  });
const same = (got, want) => {
  if (canon(got) !== canon(want)) expect(got).toStrictEqual(want); // (only on a miss: the slow, readable diff)
};

// (made once, read only)
let e10 = null;
const E10 = () => (e10 ??= fullSector(UNIVERSE, 1, 0, 0));

describe('a sector made in a worker', () => {
  it('(the compare tells apart what toStrictEqual does, and reads getters)', () => {
    expect(canon({ a: 1, b: [2] })).toBe(canon({ b: [2], a: 1 }));
    for (const [a, b] of [[{ a: 1n }, { a: '1' }], [new Float32Array([1]), [1]], [new Float32Array([1]), new Float64Array([1])], [{ a: [1, 2] }, { a: [2, 1] }], [{}, { a: [] }]])
      expect(canon(a)).not.toBe(canon(b));
    expect(canon(Object.defineProperty({}, 'a', { get: () => 3, enumerable: true }))).toBe(canon({ a: 3 }));
  });

  it('comes back as fullSector makes it, its moons put back on this side', () => {
    const out = sectorJob(sectorMsg(UNIVERSE, 1, 0, 0, 'E:1,0'));
    expect(planetsOf(out.answer.sector).some((p) => 'moonList' in p)).toBe(false); // (not on the wire)
    const got = across(out);
    expect(got.key).toBe('E:1,0');
    same(withMoons(got.sector), E10());
  });

  it('makes a planet’s moons only when they’re asked for, and once', () => {
    const s = withMoons(across(sectorJob(sectorMsg(UNIVERSE, 1, 0, 0))).sector);
    const p = planetsOf(s).find((x) => x.moons > 0);
    expect(Object.getOwnPropertyDescriptor(p, 'moonList').get).toBeTypeOf('function');
    const list = p.moonList;
    expect(list).toEqual(moonsOf(p));
    expect(Object.getOwnPropertyDescriptor(p, 'moonList').value).toBe(list);
    expect(p.moonList).toBe(list);
    // (a sector that has its moons keeps them)
    same(withMoons(structuredClone(E10())), E10());
  });

  it('hands every typed array over, with a speck for every system and wonder', () => {
    const { answer, transfer } = sectorJob(sectorMsg(UNIVERSE, 2, 0, -1, 'E:2,-1'));
    const { sector, stars } = answer;
    expect(sector.wonders.length).toBeGreaterThan(0);
    expect(stars.count).toBe(sector.systems.length + sector.wonders.length);
    expect(stars).toEqual(starsOf(sector));
    const found = buffersIn(answer);
    expect(transfer).toHaveLength(found.size);
    for (const b of transfer) expect(found.has(b)).toBe(true);
    expect(transfer).toHaveLength(7); // (the lattice's four, the specks' three)
    structuredClone(answer, { transfer });
    expect(stars.at.byteLength).toBe(0); // handed over, not copied
  });

  it('makes a pocket universe its own, the same every time', () => {
    const word = universeOf('word');
    const got = withMoons(across(sectorJob(sectorMsg(word, 1, 0, 0, 'E:1,0'))).sector);
    same(got, fullSector(word, 1, 0, 0));
    expect(got.seed).not.toBe(E10().seed);
    expect(got.systems[0].at).not.toEqual(E10().systems[0].at);
  });

  it('keeps a pocket universe’s core clear of the keep-outs', () => {
    const core = sectorJob(sectorMsg(universeOf('word'), 0, 0, 0, 'E:0,0')).answer.sector;
    expect(core.systems.length).toBeGreaterThan(0);
    for (const s of core.systems) expect(clearOfKeepOuts(s.at, s.reach, KEEP_OUTS)).toBe(true);
  });
});

describe('the sectors beyond', () => {
  // a maker that counts what it makes: two systems a sector and a wonder (never a speck beyond)
  const counting = () => {
    const made = [];
    const make = (universe, sx, sy, sz) => {
      made.push([universe, sx, sy, sz]);
      const origin = sectorCentre(sx, sy, sz);
      const sys = (d, color) => ({ at: [origin[0] + d, origin[1], origin[2] - d], star: { color, size: 10 + sx } });
      return { origin, systems: [sys(0, '#ff8000'), sys(500, '#0080ff')], wonders: [{ at: origin, kind: 'pulsar', size: 99 }] };
    };
    return { made, make };
  };

  it('are the shell one past the ring, the core among them, never the middle or the 3 × 3 × 3', () => {
    for (const [ring, n] of [[1, 98], [2, 218]]) {
      for (const centre of [[0, 0, 0], [2, 0, 0], [-1, 3, -2]]) {
        const keys = beyondKeys(centre, ring);
        expect(keys).toHaveLength(n);
        expect(new Set(keys.map(String)).size).toBe(n);
        for (const k of keys) expect(cheb(k, centre)).toBe(ring + 1);
      }
    }
    expect(beyondKeys([2, 0, 0], 1)).toContainEqual([0, 0, 0]);
    expect(beyondKeys([0, 0, 0], 1)).not.toContainEqual([0, 0, 0]);
    expect(beyondKeys([0, 0, 0], 0)).toEqual([]);
    expect(beyondKeys([-0, -0, -0], 1).flat().some((v) => Object.is(v, -0))).toBe(false);
  });

  it('has every system of the shell, from the centre’s middle, each sector made once', () => {
    const { made, make } = counting();
    const { answer, transfer } = beyondJob(beyondMsg([3, -1, 2], 1, UNIVERSE, 'beyond:1'), new Map(), make);
    expect(made).toHaveLength(98);
    expect(new Set(made.map(String)).size).toBe(98);
    expect(answer.key).toBe('beyond:1');
    expect(answer.centre).toEqual([3, -1, 2]);
    const { stars } = answer;
    expect(stars.count).toBe(196);
    expect(transfer).toEqual([stars.at.buffer, stars.color.buffer, stars.r.buffer]);
    const o = sectorCentre(3, -1, 2);
    const keys = beyondKeys([3, -1, 2], 1);
    const want = keys.flatMap(([sx, sy, sz]) => {
      const c = sectorCentre(sx, sy, sz).map((v, i) => v - o[i]);
      return [c, [c[0] + 500, c[1], c[2] - 500]];
    });
    expect([...stars.at]).toEqual(want.flat());
    expect([...stars.color]).toEqual(keys.flatMap(() => [255, 128, 0, 0, 128, 255]));
    expect([...stars.r]).toEqual(keys.flatMap(([sx]) => [10 + sx, 10 + sx]));
  });

  it('makes only the new face a sector over, nothing coming back, and another universe apart', () => {
    const { made, make } = counting();
    const cache = new Map();
    beyondJob(beyondMsg([0, 0, 0], 1), cache, make);
    made.length = 0;
    beyondJob(beyondMsg([1, 0, 0], 1), cache, make);
    expect(made.length).toBeGreaterThan(0);
    expect(made.length).toBeLessThanOrEqual(49);
    made.length = 0;
    beyondJob(beyondMsg([0, 0, 0], 1), cache, make);
    expect(made).toHaveLength(0);
    beyondJob(beyondMsg([0, 0, 0], 1, universeOf('word')), cache, make);
    expect(made).toHaveLength(98);
  });

  it('keeps at most 400 sectors, and hands over copies, never what it keeps', () => {
    const { make } = counting();
    const cache = new Map();
    expect(BEYOND_KEEP).toBe(400);
    let out = null;
    for (let i = 0; i < 4; i++) {
      out = beyondJob(beyondMsg([i * 10, 0, 0], 2), cache, make);
      expect(cache.size).toBeLessThanOrEqual(BEYOND_KEEP);
      structuredClone(out.answer, { transfer: out.transfer });
    }
    expect(out.answer.stars.at.byteLength).toBe(0);
    const again = beyondJob(beyondMsg([30, 0, 0], 2), cache, make).answer.stars;
    const fresh = beyondJob(beyondMsg([30, 0, 0], 2), new Map(), make).answer.stars;
    expect(again.count).toBe(436);
    expect([...again.at]).toEqual([...fresh.at]);
    expect([...again.r]).toEqual([...fresh.r]);
  });

  it('makes each sector beyond as fullSector does: its systems’ specks the same', () => {
    expect(starsOf(beyondSector(UNIVERSE, 1, 0, 0), { wonders: false })).toEqual(starsOf(E10(), { wonders: false }));
  });
});

describe('the pools', () => {
  it('puts sector jobs on expanse, as wide as it’s told, and beyond jobs on expanse-beyond, one worker for its cache', () => {
    const make = () => ({ onmessage: null, onerror: null, postMessage() {}, terminate() {} });
    const pool = createWorkerPool();
    definePools(pool, { make, size: 3 });
    expect(POOLS).toEqual({ sector: 'expanse', beyond: 'expanse-beyond' });
    for (let i = 0; i < 5; i++) pool.request(POOLS.sector, { type: 'sector', key: `s${i}` });
    for (let i = 0; i < 3; i++) pool.request(POOLS.beyond, { type: 'beyond', key: `b${i}` });
    expect(pool.stats()).toEqual({ expanse: { workers: 3, busy: 3, queued: 2 }, 'expanse-beyond': { workers: 1, busy: 1, queued: 2 } });
  });

  it('answers through the pool as a worker does, and a job it doesn’t know is given up', async () => {
    // a worker run here: runJob on a later microtask, its answer cloned across
    const make = () => {
      const cache = new Map();
      const w = {
        onmessage: null,
        onerror: null,
        terminate() {},
        postMessage(msg) {
          queueMicrotask(() => {
            try {
              const out = runJob(msg, cache);
              if (out) w.onmessage({ data: structuredClone(out.answer, { transfer: out.transfer }) });
            } catch {
              w.onerror();
            }
          });
        },
      };
      return w;
    };
    const pool = createWorkerPool();
    definePools(pool, { make, size: 2 });
    const got = await pool.request(POOLS.sector, sectorMsg(UNIVERSE, 1, 0, 0, 'E:1,0'));
    same(withMoons(got.sector), E10());
    expect(await pool.request(POOLS.sector, { type: 'nothing', key: 'x' })).toBeNull();
  });

  it('runs a job by its type', () => {
    expect(runJob(null, new Map())).toBeNull();
    expect(runJob({ type: 'cancel', key: 'a' }, new Map())).toBeNull();
    expect(() => runJob({ type: 'nothing', key: 'a' }, new Map())).toThrow(/nothing/);
    const made = [];
    const make = (u, sx, sy, sz) => (made.push([sx, sy, sz]), { origin: sectorCentre(sx, sy, sz), systems: [], wonders: [] });
    const cache = new Map();
    const out = runJob(beyondMsg([0, 0, 0], 1, UNIVERSE, 'b'), cache, make);
    expect(made).toHaveLength(98);
    expect(cache.size).toBe(98);
    expect(out.answer).toMatchObject({ key: 'b', centre: [0, 0, 0], stars: { count: 0 } });
  });

  it('imports no three.js, React or page, so the worker runs it', () => {
    const src = readFileSync(new URL('./job.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''); // (its words aside)
    expect(src).not.toMatch(/from\s+['"](three|react)/);
    expect(src).not.toMatch(/\b(window|document)\.|new Worker\b/);
  });
});
