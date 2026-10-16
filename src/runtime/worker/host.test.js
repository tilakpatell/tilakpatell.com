import { describe, expect, it, vi } from 'vitest';
import { createEvents } from '../runtime';
import { createWorkerRuntime, workerAsked } from './host';

// a stand-in for the page runtime (runtime.js's rt): what the façade hands
// every world it does not take to the worker
function fakePage() {
  const listeners = new Set();
  const page = {
    events: createEvents(),
    input: { attach: vi.fn(), detach: vi.fn(), bind: vi.fn(), unbind: vi.fn(), sample: vi.fn(() => ({ keys: new Set(['KeyW']), pressed: new Set(), pad: null, tapped: {}, pointer: { x: 1, y: 2, down: false, drag: null }, stick: { x: 0, y: 0 } })) },
    quality: { tier: 'high' },
    saves: { get: vi.fn((k, f = null) => (k === 'tp-best' ? 7 : f)), set: vi.fn() },
    store: { get: vi.fn(async () => ({ t: 1 })) },
    audio: { fadeOut: vi.fn() },
    video: { hdr: 'off' },
    gfx: null,
    status: 'idle',
    current: null,
    tier: null,
    on: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    say: (s) => listeners.forEach((fn) => fn(s)),
    mount: vi.fn(async () => true),
    unmount: vi.fn(),
    resize: vi.fn(),
    setVisible: vi.fn(),
    invalidate: vi.fn(),
  };
  return page;
}
// a stand-in for a module Worker: what it was sent, and a way to answer
function fakeWorker() {
  const w = { sent: [], onmessage: null, onerror: null, terminate: vi.fn() };
  w.postMessage = (m, transfer) => w.sent.push({ m, transfer });
  w.answer = (data) => w.onmessage({ data });
  w.of = (type) => w.sent.filter((s) => s.m.type === type);
  return w;
}
function fakeHost() {
  const kids = [];
  return {
    kids,
    dataset: {},
    prepend: (el) => kids.unshift(el),
    getBoundingClientRect: () => ({ width: 640.4, height: 359.6 }),
  };
}
function setUp({ makeWorker = null } = {}) {
  const page = fakePage();
  const workers = [];
  const frames = [];
  const offscreen = { offscreen: true };
  const doc = { createElement: () => ({ className: '', remove: vi.fn(), transferControlToOffscreen: () => offscreen }) };
  const win = { devicePixelRatio: 2, location: { search: '?worker=on', hash: '' }, performance: { now: () => 10, timeOrigin: 1000 } };
  const rt = createWorkerRuntime({
    page,
    win,
    doc,
    can: () => true,
    makeWorker: () => {
      if (makeWorker) return makeWorker();
      const w = fakeWorker();
      workers.push(w);
      return w;
    },
    raf: (fn) => frames.push(fn),
    caf: () => {},
    detail: () => 'high',
  });
  return { rt, page, workers, frames, offscreen };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const LIT = { id: 'fixture-lit', shading: 'nodes', saves: ['tp-best'] };

describe('the page’s face of a world drawn in a worker', () => {
  it('is asked for by ?worker=on or tp-worker, and by nothing else', () => {
    const at = (search, kept = null) => ({ location: { search, hash: '' }, localStorage: { getItem: () => kept } });
    expect(workerAsked(at('?worker=on'))).toBe(true);
    expect(workerAsked(at('', 'on'))).toBe(true);
    expect(workerAsked(at(''))).toBe(false);
    expect(workerAsked(at('?worker=off', 'on'))).toBe(false);
  });

  it('mounts a candidate in a worker, the canvas transferred, and is ready when the worker says', async () => {
    const { rt, page, workers, offscreen } = setUp();
    const host = fakeHost();
    const shown = rt.mount(LIT, { a: 1 }, host);
    expect(page.mount).not.toHaveBeenCalled();
    const [w] = workers;
    const [init] = w.of('init');
    expect(init.m).toMatchObject({ module: 'litWorld', props: { a: 1 }, w: 640, h: 360, dpr: 2, detail: 'high', saves: { 'tp-best': 7 } });
    expect(init.m.canvas).toBe(offscreen);
    expect(init.transfer).toEqual([offscreen]);
    expect(host.kids).toHaveLength(1);
    expect(rt.status).toBe('loading');
    expect(rt.loading).toBe(LIT);
    w.answer({ type: 'ready', backend: 'nodes-webgl' });
    await expect(shown).resolves.toBe(true);
    expect(rt.status).toBe('on');
    expect(rt.current.module).toBe(LIT);
  });

  it('posts the page’s input once a page frame', async () => {
    const { rt, page, workers, frames } = setUp();
    rt.mount(LIT, {}, fakeHost());
    expect(page.input.attach).toHaveBeenCalled();
    const before = workers[0].of('input').length;
    frames.shift()(16);
    const sent = workers[0].of('input');
    expect(sent).toHaveLength(before + 1);
    expect(sent.at(-1).m.snapshot.keys).toEqual(['KeyW']);
    expect(sent.at(-1).m.at).toBe(1010); // (the page's clock on the epoch, which the worker's shares)
    expect(frames).toHaveLength(1); // (and the next asked for)
  });

  it('relays the worker’s events, HUD numbers and bindings to the page', async () => {
    const { rt, page, workers } = setUp();
    rt.mount(LIT, {}, fakeHost());
    const heard = [];
    page.events.onAny((type, data) => heard.push([type, data]));
    workers[0].answer({ type: 'event', name: 'score', data: { n: 2 } });
    workers[0].answer({ type: 'hud', values: { hp: 9 } });
    expect(heard).toEqual([
      ['score', { n: 2 }],
      ['hud', { hp: 9 }],
    ]);
    workers[0].answer({ type: 'bind', actions: { fire: ['Space'] }, axes: {} });
    expect(page.input.bind).toHaveBeenCalledWith({ fire: ['Space'] }, { axes: {} });
  });

  it('sends a resize, visibility and props to the worker, not the page', () => {
    const { rt, page, workers } = setUp();
    rt.mount(LIT, {}, fakeHost());
    rt.resize(800.2, 450);
    rt.setVisible(false);
    rt.current.world.update({ b: 2 });
    expect(workers[0].of('resize').at(-1).m).toEqual({ type: 'resize', w: 800, h: 450, ratio: 2 });
    expect(workers[0].of('visible').at(-1).m).toEqual({ type: 'visible', on: false });
    expect(workers[0].of('props').at(-1).m).toEqual({ type: 'props', props: { b: 2 } });
    expect(page.resize).not.toHaveBeenCalled();
  });

  it('answers the worker’s calls from the page’s services', async () => {
    const { rt, page, workers } = setUp();
    rt.mount(LIT, {}, fakeHost());
    workers[0].answer({ type: 'call', id: 4, name: 'store.get', args: ['runs', 'last'] });
    workers[0].answer({ type: 'call', id: 0, name: 'saves.set', args: ['tp-best', 9] });
    workers[0].answer({ type: 'call', id: 5, name: 'location.reload', args: [] });
    await tick();
    expect(page.store.get).toHaveBeenCalledWith('runs', 'last');
    expect(page.saves.set).toHaveBeenCalledWith('tp-best', 9);
    const results = workers[0].of('result').map((s) => s.m);
    expect(results).toContainEqual({ type: 'result', id: 4, value: { t: 1 } });
    expect(results.find((r) => r.id === 5).error).toMatch(/not a call/);
    expect(results.some((r) => r.id === 0)).toBe(false); // (a write wants no answer)
  });

  it('keeps the worker’s frame times for the probe, and its GPU clock', () => {
    const { rt, workers } = setUp();
    rt.mount(LIT, {}, fakeHost());
    workers[0].answer({ type: 'frame', ms: 3.5, at: 100, gpu: 1.2, inputAt: 990, drawnAt: 1004 });
    expect(rt.gpuClock).toMatchObject({ available: true, last: 1.2 });
    expect(rt.workerFrames()).toEqual([{ ms: 3.5, at: 100, gpu: 1.2, lag: 14 }]);
    expect(rt.workerFrames()).toEqual([]); // (taken once)
  });

  it('on a lost device stops the worker and lets useWorld mount again, on the page', async () => {
    const { rt, page, workers } = setUp();
    const host = fakeHost();
    rt.mount(LIT, {}, host);
    workers[0].answer({ type: 'ready', backend: 'webgpu' });
    const statuses = [];
    rt.on((s) => statuses.push(s));
    workers[0].answer({ type: 'lost', kind: 'webgpu', reason: 'destroyed' });
    await tick();
    expect(workers[0].terminate).toHaveBeenCalled();
    expect(rt.status).toBe('lost');
    expect(statuses).toContain('lost');
    expect(rt.recoverable).toBe(true);
    expect(rt.lostModule).toBe('fixture-lit');
    expect(host.kids[0].remove).toHaveBeenCalled();
    // (useWorld's recoverNow mounts again: on the page runtime this time)
    await rt.mount(LIT, {}, host);
    expect(page.mount).toHaveBeenCalledWith(LIT, {}, host);
    expect(workers).toHaveLength(1);
  });

  it('mounts on the page a world the worker cannot draw, or one that failed there', async () => {
    const { rt, page, workers } = setUp();
    const other = { id: 'battlefront', shading: 'nodes' };
    await rt.mount(other, {}, fakeHost());
    expect(page.mount).toHaveBeenCalledWith(other, {}, expect.anything());
    expect(workers).toHaveLength(0);
    page.status = 'on';
    page.say('on');
    expect(rt.status).toBe('on');
    const host = fakeHost();
    const shown = rt.mount(LIT, {}, host);
    workers[0].answer({ type: 'failed', message: 'no adapter' });
    await shown;
    await tick();
    expect(page.mount).toHaveBeenLastCalledWith(LIT, {}, host);
    expect(workers[0].terminate).toHaveBeenCalled();
  });

  it('lets the worker go on unmount, and hands the page’s own calls through', () => {
    const { rt, page, workers } = setUp();
    rt.mount(LIT, {}, fakeHost());
    rt.unmount();
    expect(workers[0].of('unmount')).toHaveLength(1);
    expect(rt.status).toBe('idle');
    expect(rt.current).toBe(null);
    expect(page.input.detach).toHaveBeenCalled();
    rt.resize(10, 10);
    expect(page.resize).toHaveBeenCalledWith(10, 10);
    // (a value set on the face is the page's: index.js's held() sets the video)
    rt.video = { hdr: 'on' };
    expect(page.video).toEqual({ hdr: 'on' });
    expect(rt.saves).toBe(page.saves);
  });

  it('lets a world still being made on the page go before the worker draws', () => {
    const { rt, page } = setUp();
    page.loading = { id: 'universe' };
    rt.mount(LIT, {}, fakeHost());
    expect(page.unmount).toHaveBeenCalled();
  });

  it('mounts on the page when no worker can be had', async () => {
    const { rt, page } = setUp({
      makeWorker: () => {
        throw new Error('no module workers');
      },
    });
    const host = fakeHost();
    await expect(rt.mount(LIT, {}, host)).resolves.toBe(true);
    expect(page.mount).toHaveBeenCalledWith(LIT, {}, host);
    expect(host.kids).toHaveLength(0);
  });

  it('answers a worker mount another mount replaced: not shown', async () => {
    const { rt } = setUp();
    const first = rt.mount(LIT, {}, fakeHost());
    rt.mount({ id: 'battlefront' }, {}, fakeHost());
    await expect(first).resolves.toBe(false);
  });

  it('offers a reload for a quality the world cannot take in place', () => {
    const { rt, page, workers } = setUp();
    page.quality.retune = vi.fn();
    rt.mount(LIT, {}, fakeHost());
    expect(rt.requality('low')).toBe('reload');
    expect(page.quality.retune).toHaveBeenCalledWith('low');
    expect(workers[0].of('quality').at(-1).m).toEqual({ type: 'quality', level: 'low' });
  });
});
