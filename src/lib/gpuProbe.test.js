import { describe, expect, it, vi } from 'vitest';
import { adapterFacts, CAPPING, SLOW_DAYS, classifyTier, decideTier, judgeTier, keepTier, lossHolds, LOST_DAYS, lostTwice, nameScore, nameVendor, noteLoss, PROBE, probeTier, readTier, tierHold, TIER_KEY } from './gpuProbe';

const TS = 'timestamp-query';
const set = (...f) => new Set(f);
const NVIDIA = { vendor: 'nvidia', architecture: 'blackwell' };
const INTEL = { vendor: 'intel', architecture: 'xe-lpg' };
const AMD = { vendor: 'amd', architecture: 'rdna-3' };
const R740M = 'ANGLE (AMD, AMD Radeon(TM) 740M Graphics (0x000015BF) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const R5090 = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 (0x00002B85) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const DAY = 86400000;
const kept = (tier, info = NVIDIA) => JSON.stringify({ tier, info });

describe('the renderer tier from the adapter and the probe', () => {
  it('is T0 on a phone, whatever the chip says', () => {
    expect(classifyTier({ features: set(TS, 'subgroups', 'atomic-vec2u-min-max'), limits: { maxStorageBuffersPerShaderStage: 16 }, medianMs: 1, phone: true })).toBe('T0');
  });

  it('is T0 without timestamp-query (nothing to measure the frame by)', () => {
    expect(classifyTier({ features: set('subgroups'), medianMs: 1 })).toBe('T0');
  });

  it('is T0 when the probe scene took over 8 ms of the chip, and T1 at 8 ms or under', () => {
    expect(classifyTier({ features: set(TS), medianMs: 8.1 })).toBe('T0');
    expect(classifyTier({ features: set(TS), medianMs: 8 })).toBe('T1');
    expect(classifyTier({ features: set(TS), medianMs: 2.4 })).toBe('T1');
  });

  it('is T0 when the probe measured nothing, or the adapter is the software fallback', () => {
    expect(classifyTier({ features: set(TS), medianMs: null })).toBe('T0');
    expect(classifyTier({ features: set(TS), medianMs: 1, info: { fallback: true } })).toBe('T0');
  });

  it('is T2 with 64-bit min-max atomics, subgroups and 16 storage buffers a stage', () => {
    const features = set(TS, 'subgroups', 'atomic-vec2u-min-max');
    expect(classifyTier({ features, limits: { maxStorageBuffersPerShaderStage: 16 }, medianMs: 1 })).toBe('T2');
    // (one short of any of the three: T1)
    expect(classifyTier({ features, limits: { maxStorageBuffersPerShaderStage: 8 }, medianMs: 1 })).toBe('T1');
    expect(classifyTier({ features: set(TS, 'subgroups'), limits: { maxStorageBuffersPerShaderStage: 16 }, medianMs: 1 })).toBe('T1');
    expect(classifyTier({ features: set(TS, 'atomic-vec2u-min-max'), limits: { maxStorageBuffersPerShaderStage: 16 }, medianMs: 1 })).toBe('T1');
    // (and a slow chip with them all is still T0: the probe decides first)
    expect(classifyTier({ features, limits: { maxStorageBuffersPerShaderStage: 16 }, medianMs: 12 })).toBe('T0');
  });

  it('defaults to T0 when told nothing', () => {
    expect(classifyTier()).toBe('T0');
  });
});

describe('the tier kept, and the one the address pins', () => {
  it('pins ?tier= for the visit over the kept one, in the search or the hash', () => {
    expect(readTier('?tier=T2', '', kept('T0'), NVIDIA)).toEqual({ tier: 'T2', fresh: false, pinned: true });
    expect(readTier('', '#/universe?tier=T1', kept('T2'), NVIDIA)).toEqual({ tier: 'T1', fresh: false, pinned: true });
  });

  it('pins nothing for an unknown value: the kept tier stands', () => {
    expect(readTier('?tier=T9', '', kept('T1'), NVIDIA)).toEqual({ tier: 'T1', fresh: false, pinned: false });
    expect(readTier('?tier=t1', '', null, NVIDIA)).toEqual({ tier: null, fresh: true, pinned: false });
  });

  it('keeps a stored tier from the same chip', () => {
    expect(readTier('', '', kept('T1'), { ...NVIDIA, description: 'whatever' })).toEqual({ tier: 'T1', fresh: false, pinned: false });
  });

  it('probes again when the kept tier came from another chip (a laptop docked to a different GPU)', () => {
    expect(readTier('', '', kept('T2', NVIDIA), INTEL)).toEqual({ tier: null, fresh: true, pinned: false });
    expect(readTier('', '', kept('T2', NVIDIA), { vendor: 'nvidia', architecture: 'ada' })).toEqual({ tier: null, fresh: true, pinned: false });
  });

  it('trusts the kept tier when the chip is not known yet (a read before the adapter answers)', () => {
    expect(readTier('', '', kept('T2'), null)).toEqual({ tier: 'T2', fresh: false, pinned: false });
  });

  it('probes when nothing usable is kept', () => {
    for (const s of [null, '', 'not json', JSON.stringify({ tier: 'T7', info: NVIDIA }), JSON.stringify('T1')]) expect(readTier('', '', s, NVIDIA).fresh).toBe(true);
  });

  it('keeps a tier with its chip under tp-tier, and keeps nothing it does not know', () => {
    const store = new Map();
    const storage = { setItem: (k, v) => store.set(k, v) };
    expect(TIER_KEY).toBe('tp-tier');
    keepTier('T1', { ...NVIDIA, description: 'RTX 5090' }, storage);
    expect(JSON.parse(store.get('tp-tier'))).toEqual({ tier: 'T1', info: NVIDIA });
    keepTier('T5', NVIDIA, storage);
    expect(JSON.parse(store.get('tp-tier')).tier).toBe('T1');
    // (storage that throws: a private window)
    expect(() => keepTier('T0', NVIDIA, { setItem: () => { throw new Error('quota'); } })).not.toThrow();
  });
});

describe('the adapter read into facts', () => {
  it('takes the features, the two limits and the chip’s vendor and architecture', () => {
    const adapter = { features: set(TS, 'subgroups'), limits: { maxStorageBuffersPerShaderStage: 10, maxColorAttachmentBytesPerSample: 64, maxTextureDimension2D: 8192 }, info: { vendor: 'apple', architecture: 'metal-3', isFallbackAdapter: false } };
    expect(adapterFacts(adapter)).toEqual({ features: set(TS, 'subgroups'), limits: { maxStorageBuffersPerShaderStage: 10, maxColorAttachmentBytesPerSample: 64 }, info: { vendor: 'apple', architecture: 'metal-3', fallback: false } });
  });

  it('is empty without an adapter', () => {
    expect(adapterFacts(null)).toEqual({ features: new Set(), limits: {}, info: { vendor: '', architecture: '', fallback: false } });
  });
});

describe('the probe and the decision', () => {
  it('draws the probe scene for a second into a fixed-size target and answers the GPU median', async () => {
    let t = 0;
    const renderer = { render: vi.fn(), setRenderTarget: vi.fn(), getRenderTarget: () => 'screen' };
    const gpuTime = { available: true, median: 3.2, frame: vi.fn(async () => { t += 100; }), reset: vi.fn() };
    const ms = await probeTier({ renderer, scene: 'scene', camera: 'camera', target: 'target', gpuTime, now: () => t });
    expect(ms).toBe(3.2);
    expect(renderer.render).toHaveBeenCalledWith('scene', 'camera');
    expect(renderer.render.mock.calls.length).toBe(PROBE.ms / 100);
    expect(renderer.setRenderTarget.mock.calls.map((c) => c[0])).toEqual(['target', 'screen']);
    expect(gpuTime.reset).toHaveBeenCalled();
  });

  it('draws at least the fewest frames however slow the clock, and answers null without the clock', async () => {
    const renderer = { render: vi.fn() };
    let t = 0;
    const gpuTime = { available: true, median: 9, frame: async () => { t += 5000; }, reset() {} };
    await probeTier({ renderer, scene: 1, camera: 2, gpuTime, now: () => t });
    expect(renderer.render.mock.calls.length).toBe(PROBE.frames);
    expect(await probeTier({ renderer, scene: 1, camera: 2, gpuTime: { available: false } })).toBeNull();
  });

  it('a kept tier skips the probe', async () => {
    const probe = vi.fn();
    const keep = vi.fn();
    const got = await decideTier({ stored: kept('T1'), facts: { features: set(TS), limits: {}, info: NVIDIA }, probe, keep });
    expect(got).toEqual({ tier: 'T1', probed: false, pinned: false, why: null });
    expect(probe).not.toHaveBeenCalled();
    expect(keep).not.toHaveBeenCalled();
  });

  it('a pinned tier skips the probe and keeps nothing', async () => {
    const probe = vi.fn();
    const keep = vi.fn();
    expect(await decideTier({ search: '?tier=T0', facts: { features: set(TS), info: NVIDIA }, probe, keep })).toEqual({ tier: 'T0', probed: false, pinned: true, why: 'pinned' });
    expect(probe).not.toHaveBeenCalled();
    expect(keep).not.toHaveBeenCalled();
  });

  it('with nothing kept, probes, classifies and keeps the answer with its chip', async () => {
    const probe = vi.fn(async () => 2);
    const keep = vi.fn();
    const facts = { features: set(TS), limits: {}, info: NVIDIA };
    expect(await decideTier({ facts, probe, keep })).toEqual({ tier: 'T1', probed: true, pinned: false, why: null });
    expect(keep).toHaveBeenCalledWith('T1', NVIDIA, { why: null });
  });

  it('without timestamp-query (or on a phone) needs no probe to say T0', async () => {
    const probe = vi.fn();
    const keep = vi.fn();
    expect(await decideTier({ facts: { features: set(), info: INTEL }, probe, keep })).toEqual({ tier: 'T0', probed: false, pinned: false, why: 'features' });
    expect(await decideTier({ facts: { features: set(TS), info: INTEL }, phone: true, probe, keep })).toEqual({ tier: 'T0', probed: false, pinned: false, why: 'phone' });
    expect(probe).not.toHaveBeenCalled();
    expect(keep).toHaveBeenCalledWith('T0', INTEL, { why: 'features' });
  });

  it('a probe that throws answers T0 and keeps nothing (it is asked again next visit)', async () => {
    const keep = vi.fn();
    const got = await decideTier({ facts: { features: set(TS), info: NVIDIA }, probe: async () => { throw new Error('lost'); }, keep });
    expect(got).toEqual({ tier: 'T0', probed: false, pinned: false, why: 'probe' });
    expect(keep).not.toHaveBeenCalled();
  });
});

// The owner's work laptop (2026-10-13): a Ryzen 5's Radeon 740M, four compute
// units, put on the High chain by its name and hung by it (DXGI_ERROR_DEVICE_HUNG)
describe('a weak chip by its name, the reason kept, and a lost device', () => {
  it('reads the vendor from the WebGL name', () => {
    expect(nameVendor(R740M)).toBe('amd');
    expect(nameVendor(R5090)).toBe('nvidia');
    expect(nameVendor('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('intel');
    expect(nameVendor('Apple M3 Pro')).toBe('apple');
    expect(nameVendor('Adreno (TM) X1-85')).toBe('qualcomm');
    expect(nameVendor('')).toBe(null);
  });

  it('scores the name only when its vendor is the WebGPU adapter’s (a dual-GPU laptop is left to the probe)', () => {
    expect(nameScore(R740M, 'amd')).toBe(40);
    expect(nameScore(R740M, '')).toBe(40); // (an adapter that will not say: the name stands)
    expect(nameScore(R5090, 'intel')).toBe(null);
    expect(nameScore('AMD Radeon(TM) Graphics', 'amd')).toBe(null); // (no model: the probe decides)
  });

  it('is T0 by name under the high grade, with the reason', () => {
    expect(judgeTier({ features: set(TS), medianMs: 1, score: 40 })).toEqual({ tier: 'T0', why: 'name' });
    expect(judgeTier({ features: set(TS), medianMs: 1, score: 71 })).toEqual({ tier: 'T1', why: null });
    expect(judgeTier({ features: set(TS), medianMs: 9, score: 1170 })).toEqual({ tier: 'T0', why: 'slow' });
    expect(judgeTier({ features: set(TS), medianMs: null })).toEqual({ tier: 'T0', why: 'probe' });
    expect(classifyTier({ features: set(TS), medianMs: 1, score: 40 })).toBe('T0');
  });

  it('decides the 740M without a probe, and over a T1 kept by the old rule', async () => {
    const probe = vi.fn(async () => 2);
    const keep = vi.fn();
    const facts = { features: set(TS), limits: {}, info: AMD };
    expect(await decideTier({ facts, name: R740M, stored: kept('T1', AMD), probe, keep })).toEqual({ tier: 'T0', probed: false, pinned: false, why: 'name' });
    expect(probe).not.toHaveBeenCalled();
    expect(keep).toHaveBeenCalledWith('T0', AMD, { why: 'name' });
    // (the address's pin still wins)
    expect((await decideTier({ search: '?tier=T1', facts, name: R740M, probe, keep })).tier).toBe('T1');
    // (the same name with the adapter on another vendor's chip: probed)
    expect(await decideTier({ facts: { ...facts, info: INTEL }, name: R740M, probe, keep })).toEqual({ tier: 'T1', probed: true, pinned: false, why: null });
  });

  it('keeps the reason with the tier, and only name, slow and lost hold Auto', () => {
    const store = new Map();
    const storage = { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) ?? null };
    keepTier('T0', AMD, storage, { why: 'name' });
    expect(JSON.parse(store.get(TIER_KEY))).toEqual({ tier: 'T0', info: AMD, why: 'name' });
    expect([...CAPPING].sort()).toEqual(['lost', 'name', 'slow']);
    expect(tierHold(store.get(TIER_KEY), 0)).toBe('low');
    expect(tierHold(JSON.stringify({ tier: 'T0', info: AMD, why: 'features' }), 0)).toBe(null);
    expect(tierHold(JSON.stringify({ tier: 'T1', info: NVIDIA }), 0)).toBe(null);
    expect(tierHold(null, 0)).toBe(null);
    expect(tierHold('not json', 0)).toBe(null);
  });

  it('counts a chip’s losses for seven days: twice is WebGL 2 from the start, and a loss holds Auto for those days only', () => {
    const store = new Map();
    const storage = { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) ?? null };
    expect(LOST_DAYS).toBe(7);
    noteLoss(NVIDIA, storage, 1000);
    expect(lostTwice(store.get(TIER_KEY), 1000 + DAY)).toBe(false);
    expect(tierHold(store.get(TIER_KEY), 1000 + DAY)).toBe('low');
    expect(tierHold(store.get(TIER_KEY), 1000 + 8 * DAY)).toBe(null);
    noteLoss(NVIDIA, storage, 1000 + DAY);
    expect(JSON.parse(store.get(TIER_KEY))).toMatchObject({ tier: 'T0', why: 'lost', losses: 2 });
    expect(lostTwice(store.get(TIER_KEY), 1000 + 2 * DAY)).toBe(true);
    expect(lostTwice(store.get(TIER_KEY), 1000 + 9 * DAY)).toBe(false);
    // (eight days apart: the count starts again)
    noteLoss(NVIDIA, storage, 1000 + 10 * DAY);
    expect(JSON.parse(store.get(TIER_KEY)).losses).toBe(1);
    // (another chip's loss starts its own count)
    noteLoss(INTEL, storage, 1000 + 10 * DAY);
    expect(JSON.parse(store.get(TIER_KEY))).toMatchObject({ info: INTEL, losses: 1 });
    // (storage that throws: nothing kept, nothing thrown)
    expect(() => noteLoss(NVIDIA, { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } }, 0)).not.toThrow();
  });

  it('keeps a live loss over the name rule, so its count survives the next visit', async () => {
    const keep = vi.fn();
    const lost = JSON.stringify({ tier: 'T0', info: AMD, why: 'lost', losses: 1, lostAt: 0 });
    expect(await decideTier({ stored: lost, facts: { features: set(TS), limits: {}, info: AMD }, name: R740M, probe: vi.fn(), keep, now: DAY })).toEqual({ tier: 'T0', probed: false, pinned: false, why: 'lost' });
    expect(keep).not.toHaveBeenCalled();
  });

  it('judges a slow chip again after SLOW_DAYS: one busy probe does not hold it at Low for good', async () => {
    expect(SLOW_DAYS).toBe(30);
    const store = new Map();
    const storage = { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) ?? null };
    const keep = (tier, info, extra) => keepTier(tier, info, storage, extra);
    await decideTier({ facts: { features: set(TS), limits: {}, info: NVIDIA }, probe: async () => 12, keep, now: 0 });
    expect(JSON.parse(store.get(TIER_KEY))).toMatchObject({ tier: 'T0', why: 'slow', at: 0 });
    expect(tierHold(store.get(TIER_KEY), 29 * DAY)).toBe('low');
    expect(tierHold(store.get(TIER_KEY), 31 * DAY)).toBe(null);
    expect(readTier('', '', store.get(TIER_KEY), NVIDIA, 31 * DAY).fresh).toBe(true);
  });

  // (the review's finding: keep's third argument is the extras, keepTier's the storage)
  it('keeps the tier in the page’s storage when no keep is passed (the runtime passes none)', async () => {
    const store = new Map();
    vi.stubGlobal('window', { localStorage: { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) ?? null } });
    try {
      await decideTier({ facts: { features: set(TS), limits: {}, info: NVIDIA }, probe: async () => 12, now: 0 });
      expect(JSON.parse(store.get(TIER_KEY))).toMatchObject({ tier: 'T0', why: 'slow', at: 0, info: { vendor: 'nvidia' } });
      await decideTier({ facts: { features: set(TS), limits: {}, info: AMD }, name: R740M, probe: async () => 1 });
      expect(JSON.parse(store.get(TIER_KEY))).toMatchObject({ tier: 'T0', why: 'name' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reads a kept lost tier as fresh once its seven days are gone (the chip is probed again)', () => {
    const lost = JSON.stringify({ tier: 'T0', info: NVIDIA, why: 'lost', losses: 1, lostAt: 0 });
    expect(readTier('', '', lost, NVIDIA, DAY)).toMatchObject({ tier: 'T0', fresh: false, why: 'lost' });
    expect(readTier('', '', lost, NVIDIA, 8 * DAY).fresh).toBe(true);
  });
});

// (the owner's word, 2026-10-13: a loss holds a weak chip at Low, never a strong one)
describe('a loss holds a weak chip only', () => {
  it('holds a T0 chip and one its name does not grade; never a T1 or T2 chip, nor a strong name with no tier yet', () => {
    expect(lossHolds({ tier: 'T0', name: R5090 })).toBe(true);
    expect(lossHolds({ tier: 'T1', name: R740M })).toBe(false);
    expect(lossHolds({ tier: 'T2' })).toBe(false);
    expect(lossHolds({ tier: null, name: R5090 })).toBe(false);
    expect(lossHolds({ tier: null, name: R740M })).toBe(true);
    expect(lossHolds({ tier: null, name: 'Some New GPU' })).toBe(true);
  });
});
