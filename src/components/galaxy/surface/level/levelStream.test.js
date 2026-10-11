import { describe, expect, it } from 'vitest';
import { createLevelStream } from './levelStream';
import { wanted } from './levelPack';

const pack = (() => {
  const cells = {};
  for (let x = -6; x < 6; x++) for (let z = -6; z < 6; z++) cells[`${x},${z}`] = { bin: `cells/${x}_${z}.bin` };
  return { cell: 128, cells, far: { bin: 'far.bin' }, horizon: { bin: 'horizon.bin' } };
})();

// a fetch whose answers the test hands out, one path at a time
function fakeFetch() {
  const waiting = new Map();
  const asked = [];
  const fetch = (path, { signal }) =>
    new Promise((resolve, reject) => {
      asked.push(path);
      waiting.set(path, resolve);
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  const give = (path) => {
    waiting.get(path)?.(new ArrayBuffer(32));
    waiting.delete(path);
  };
  return { fetch, asked, give, waiting };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

function stream(f) {
  const got = { cells: new Map(), far: 0, horizon: 0, removed: [] };
  const s = createLevelStream({
    pack,
    fetch: f.fetch,
    wanted,
    tier: 'high',
    onFar: () => got.far++,
    onHorizon: () => got.horizon++,
    onCell: (key, bin, band) => got.cells.set(key, band),
    onDrop: (key) => {
      got.cells.delete(key);
      got.removed.push(key);
    },
  });
  return { s, got };
}

describe('createLevelStream', () => {
  it('asks for the far list first without a coarse grid, and is not ready on it alone', async () => {
    const f = fakeFetch();
    const { s, got } = stream(f);
    s.update([10, 10], 'high');
    expect(f.asked[0]).toBe('far.bin');
    expect(s.status().phase).toBe('boot');
    expect(s.ready()).toBe(false);
    f.give('far.bin');
    await tick();
    expect(got.far).toBe(1);
    expect(got.cells.size).toBe(0);
    // (the boot slice is the near cells too: your cell and its eight neighbours)
    expect(s.ready()).toBe(false);
    s.dispose();
  });

  it('is ready once the boot slice is in: the far list and the nine cells round you', async () => {
    const f = fakeFetch();
    const { s } = stream(f);
    s.update([10, 10], 'high');
    f.give('far.bin');
    await tick();
    for (const key of ['0,0', '-1,-1', '0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1', '1,1']) {
      expect(s.ready()).toBe(false);
      f.give(`cells/${key.replace(',', '_')}.bin`);
      await tick();
      s.update([10, 10], 'high');
    }
    expect(s.ready()).toBe(true);
    expect(s.status()).toMatchObject({ phase: 'detail', bootDone: true });
    s.dispose();
  });

  it('then the near cells, nearest first, then the ring', async () => {
    const f = fakeFetch();
    const { s, got } = stream(f);
    s.update([10, 10], 'high');
    f.give('far.bin');
    await tick();
    const cellsAsked = f.asked.filter((p) => p.startsWith('cells/'));
    expect(cellsAsked[0]).toBe('cells/0_0.bin');
    // (four at a time: hand out every answer until nothing is asked)
    while (f.waiting.size) {
      for (const p of [...f.waiting.keys()]) f.give(p);
      await tick();
    }
    expect([...got.cells.values()].filter((b) => b === 'near').length).toBe(9);
    expect([...got.cells.values()].filter((b) => b === 'mid').length).toBe(16);
    expect(s.progress()).toBe(1);
    s.dispose();
  });

  it('a near cell arriving after dispose adds nothing, and every fetch is aborted', async () => {
    const f = fakeFetch();
    const { s, got } = stream(f);
    s.update([10, 10], 'high');
    f.give('far.bin');
    await tick();
    s.dispose();
    f.give('cells/0_0.bin');
    await tick();
    expect(got.cells.size).toBe(0);
  });

  it('removes a cell left three cells behind, and keeps its bytes for coming back', async () => {
    const f = fakeFetch();
    const { s, got } = stream(f);
    s.update([10, 10], 'high');
    f.give('far.bin');
    await tick();
    while (f.waiting.size) {
      for (const p of [...f.waiting.keys()]) f.give(p);
      await tick();
    }
    expect(got.cells.has('-2,0')).toBe(true);
    s.update([10 + 128, 10], 'high'); // one cell east: -2,0 is three behind now
    await tick();
    expect(got.removed).toContain('-2,0');
    expect(got.cells.get('0,0')).toBe('near');
    expect(got.cells.has('-1,0')).toBe(true); // (two behind: the ring still)
    const before = f.asked.length;
    s.update([10, 10], 'high');
    await tick();
    expect(got.cells.has('-2,0')).toBe(true);
    expect(f.asked.slice(before)).not.toContain('cells/-2_0.bin');
    s.dispose();
  });
});

describe('a cell that will not come', () => {
  it('is asked again only after a wait that grows, and holds nothing else back', async () => {
    const asked = [];
    let now = 0;
    const fetch = (path) => {
      asked.push(path);
      return path === 'cells/0_0.bin' ? Promise.reject(new Error('404')) : Promise.resolve(new ArrayBuffer(32));
    };
    const got = { horizon: 0 };
    const s = createLevelStream({ pack, fetch, wanted, tier: 'high', now: () => now, onFar: () => {}, onHorizon: () => got.horizon++, onCell: () => {} });
    for (let i = 0; i < 30; i++) {
      s.update([10, 10], 'high');
      await tick();
    }
    expect(asked.filter((p) => p === 'cells/0_0.bin').length).toBe(1);
    expect(got.horizon).toBe(1);
    now = 11000; // (past the first wait: once more)
    for (let i = 0; i < 5; i++) {
      s.update([10, 10], 'high');
      await tick();
    }
    expect(asked.filter((p) => p === 'cells/0_0.bin').length).toBe(2);
    s.dispose();
  });
});

// a pack with a coarse grid (lane N4)
const coarsePack = { ...pack, coarse: { index: 'horizon/index.json', cell: 512 } };
const coarseIndex = {
  cell: 512,
  cells: {
    '0,0': { plain: { glb: 'horizon/0_0.glb' }, lo: { glb: 'horizon/0_0.lo.glb' } },
    '-1,0': { plain: { glb: 'horizon/-1_0.glb' }, lo: { glb: 'horizon/-1_0.lo.glb' } },
    '9,9': { plain: { glb: 'horizon/9_9.glb' }, lo: { glb: 'horizon/9_9.lo.glb' } },
  },
};
function coarseFetch() {
  const f = fakeFetch();
  const give = f.give;
  f.give = (path) => {
    if (path !== 'horizon/index.json') return give(path);
    f.waiting.get(path)?.(new TextEncoder().encode(JSON.stringify(coarseIndex)).buffer);
    f.waiting.delete(path);
  };
  return f;
}
function coarseStream(f, opts = {}) {
  const got = { far: 0, coarse: [], index: null, cells: new Map() };
  const s = createLevelStream({
    pack: coarsePack,
    fetch: f.fetch,
    wanted,
    tier: 'high',
    parallel: 1,
    onFar: () => got.far++,
    onCoarse: (index) => (got.index = index),
    onHorizonCell: (key, bin, entry) => got.coarse.push([key, entry.glb]),
    onCell: (key, bin, band) => got.cells.set(key, band),
    ...opts,
  });
  return { s, got };
}
const drain = async (f, until = () => false) => {
  while (f.waiting.size && !until()) {
    for (const p of [...f.waiting.keys()]) f.give(p);
    await tick();
  }
};

describe('the coarse grid first (lane N4)', () => {
  it('asks the horizon grid before the far list, the cells nearest first', async () => {
    const f = coarseFetch();
    const { s, got } = coarseStream(f);
    s.update([10, 10], 'high');
    expect(f.asked[0]).toBe('horizon/index.json');
    expect(s.status().phase).toBe('horizon');
    await drain(f, () => f.asked.includes('far.bin'));
    expect(f.asked.slice(0, 5)).toEqual(['horizon/index.json', 'horizon/0_0.glb', 'horizon/-1_0.glb', 'horizon/9_9.glb', 'far.bin']);
    expect(got.coarse.map(([k]) => k)).toEqual(['0,0', '-1,0', '9,9']);
    expect(got.index.cell).toBe(512);
    s.dispose();
  });

  it('takes the light cut and a ring of the grid on low', async () => {
    const f = coarseFetch();
    const { s, got } = coarseStream(f, { tier: 'low' });
    s.update([10, 10], 'low');
    await drain(f, () => f.asked.includes('far.bin'));
    expect(got.coarse).toEqual([
      ['0,0', 'horizon/0_0.lo.glb'],
      ['-1,0', 'horizon/-1_0.lo.glb'],
    ]);
    s.dispose();
  });

  it('falls back to the far list where the grid’s index cannot be had', async () => {
    const f = coarseFetch();
    const { s, got } = coarseStream(f);
    s.update([10, 10], 'high');
    f.waiting.get('horizon/index.json')(Promise.reject(new Error('404')));
    f.waiting.delete('horizon/index.json');
    await tick();
    await tick();
    expect(f.asked).toContain('far.bin');
    expect(got.coarse).toEqual([]);
    s.dispose();
  });
});

describe('the loader’s asks through the stream (lane N4)', () => {
  const meshPack = {
    ...pack,
    meshes: [
      { glb: ['meshes/near.lod0.glb', 'meshes/near.lod1.glb'], lods: [1000, 500], radius: 5 },
      { glb: ['meshes/far.lod0.glb'], lods: [1000], radius: 5 },
    ],
    far: {
      bin: 'far.bin',
      draws: [
        { mesh: 0, offset: 0, count: 1, cells: { '0,0': [0, 1] } },
        { mesh: 1, offset: 1, count: 1, cells: { '5,5': [0, 1] } },
      ],
    },
  };

  it('asks a boot-slice mesh in the boot class, the rest as detail, and the boot waits for it', async () => {
    const f = fakeFetch();
    const s = createLevelStream({ pack: meshPack, fetch: f.fetch, wanted, tier: 'high', parallel: 1, onFar: () => {}, onCell: () => {} });
    s.update([10, 10], 'high');
    f.give('far.bin');
    await tick();
    s.fetch('meshes/far.lod0.glb');
    s.fetch('meshes/near.lod0.glb');
    await drain(f, () => f.asked.includes('meshes/far.lod0.glb'));
    const near = f.asked.indexOf('meshes/near.lod0.glb');
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(f.asked.indexOf('meshes/far.lod0.glb'));
    s.dispose();
  });
});

describe('which meshes stand in a cell shown (lane N4)', () => {
  it('says a GLB shows once a cell its mesh stands in is handed on, and not after the cell goes', async () => {
    const f = fakeFetch();
    const meshPack = { ...pack, meshes: [{ glb: ['meshes/a.lod0.glb'] }], far: { bin: 'far.bin', draws: [{ mesh: 0, offset: 0, count: 1, cells: { '0,0': [0, 1] } }] } };
    const s = createLevelStream({ pack: meshPack, fetch: f.fetch, wanted, tier: 'high', onFar: () => {}, onCell: () => {}, onDrop: () => {} });
    s.update([10, 10], 'high');
    expect(s.shows('meshes/a.lod0.glb')).toBe(false);
    await drain(f);
    expect(s.shows('meshes/a.lod0.glb')).toBe(true);
    expect(s.shows('meshes/other.glb')).toBe(false);
    s.update([10 + 128 * 6, 10], 'high');
    expect(s.shows('meshes/a.lod0.glb')).toBe(false);
    s.dispose();
  });
});

describe('the heading’s prefetch (lane N4)', () => {
  it('asks two cells ahead, and a flip abandons what waits but not what flies', async () => {
    const f = fakeFetch();
    const s = createLevelStream({ pack, fetch: f.fetch, wanted, tier: 'high', parallel: 1, onFar: () => {}, onCell: () => {} });
    s.update([10, 10], 'high');
    await drain(f);
    // (walking north: the third and fourth cells ahead, beyond the mid ring)
    s.update([10, 30], 'high');
    expect(f.asked.at(-1)).toBe('cells/0_3.bin');
    expect([...f.waiting.keys()]).toEqual(['cells/0_3.bin']);
    // (turned round: 0_4 had waited, so is dropped; 0_3 is in flight, so lands)
    s.update([10, 10], 'high');
    f.give('cells/0_3.bin');
    await drain(f);
    expect(f.asked).not.toContain('cells/0_4.bin');
    expect(f.asked).toContain('cells/0_-3.bin');
    s.dispose();
  });
});

describe('the budgets (lane N4)', () => {
  it('ends the boot at its bytes, whatever is left of it', async () => {
    const f = fakeFetch();
    const s = createLevelStream({ pack, fetch: f.fetch, wanted, tier: 'high', parallel: 1, budgets: () => ({ bootMB: 32 * 3 * 1e-6, visitMB: Infinity }), onFar: () => {}, onCell: () => {} });
    s.update([10, 10], 'high');
    f.give('far.bin');
    await tick();
    f.give('cells/0_0.bin');
    await tick();
    expect(s.ready()).toBe(false);
    f.give(f.asked.at(-1));
    await tick();
    s.update([10, 10], 'high');
    expect(s.ready()).toBe(true);
    s.dispose();
  });

  it('pauses the detail past the visit’s bytes, and a quality raised raises the budget', async () => {
    const f = fakeFetch();
    const budgets = (t) => ({ bootMB: Infinity, visitMB: t === 'high' ? 1 : 1e-6 });
    const s = createLevelStream({ pack, fetch: f.fetch, wanted, tier: 'mid', parallel: 1, budgets, onFar: () => {}, onCell: () => {} });
    s.update([10, 10], 'mid');
    f.give('far.bin');
    await tick();
    s.update([10, 10], 'mid');
    expect(s.status().paused).toBe(true);
    const finer = s.fetch('tex/a.1024.ktx2', { promote: true });
    let landed = false;
    finer.then(() => (landed = true));
    await drain(f);
    expect(f.asked).not.toContain('tex/a.1024.ktx2');
    // (the cells keep coming: walkable first)
    expect(f.asked.filter((p) => p.startsWith('cells/')).length).toBeGreaterThan(9);
    s.update([10, 10], 'high');
    expect(s.status().paused).toBe(false);
    f.give('tex/a.1024.ktx2');
    await tick();
    expect(landed).toBe(true);
    s.dispose();
  });
});
