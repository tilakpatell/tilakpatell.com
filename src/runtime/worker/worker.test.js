import { describe, expect, it, vi } from 'vitest';
import { createEvents } from '../runtime';
import { packInput } from './protocol';
import { createInputStore, serve } from './worker';

// a stand-in for the worker's global scope: what it posts, and a way to
// hand it a message as the page would
function fakeScope() {
  const posted = [];
  const scope = {
    posted,
    onmessage: null,
    closed: false,
    navigator: {},
    postMessage: (m) => posted.push(m),
    close() {
      scope.closed = true;
    },
    send: (data) => scope.onmessage({ data }),
    of: (type) => posted.filter((m) => m.type === type),
  };
  return scope;
}

// a stand-in for runtime.js's createRuntime: it keeps what it was made with,
// and its mount makes the module's world the way the real one does
function fakeCreateRuntime(made) {
  return (opts) => {
    const events = opts.events ?? createEvents();
    const rt = {
      opts,
      events,
      input: opts.input,
      gfx: { backend: 'nodes-webgl' },
      current: null,
      resize: vi.fn(),
      setVisible: vi.fn(),
      invalidate: vi.fn(),
      requality: vi.fn(() => 'tuned'),
      dispose: vi.fn(),
      async mount(module, props, host) {
        // (the real runtime asks its backend first, with the canvas the worker was given)
        await opts.makeBackend('nodes', { budget: {} });
        const world = await module.create(rt, props);
        rt.current = { module, world, host, props };
        // (and its loop steps the world: the frame a probe reads)
        rt.step = (opts.loop ?? ((s) => s))((t) => {
          world.step?.(1 / 60, opts.input.sample(t), t);
          return true;
        }, {});
        return true;
      },
    };
    made.push(rt);
    return rt;
  };
}

const world = () => ({ step: vi.fn(), draw: vi.fn(), resize: vi.fn(), update: vi.fn(), dispose: vi.fn() });
function setUp({ modules } = {}) {
  const scope = fakeScope();
  const made = [];
  const backends = [];
  const w = world();
  const mod = { id: 'fixture-lit', shading: 'nodes', create: vi.fn(() => w) };
  serve(scope, {
    load: async () => ({
      createRuntime: fakeCreateRuntime(made),
      makeBackend: (kind, opts) => {
        backends.push({ kind, opts });
        return {};
      },
      createQuality: (o) => ({ made: o }),
      createAssets: () => ({}),
      createLoop: (step) => {
        const loop = { step };
        return loop;
      },
      modules: modules ?? { litWorld: async () => ({ default: mod }) },
    }),
    now: (() => {
      let t = 0;
      return () => (t += 4);
    })(),
  });
  return { scope, made, backends, mod, w };
}
const canvas = { width: 300, height: 150 };
const init = (extra = {}) => ({ type: 'init', canvas, module: 'litWorld', props: { a: 1 }, w: 640, h: 360, dpr: 2, detail: 'high', sharp: 1, ...extra });
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('the runtime in a worker', () => {
  it('makes the runtime on the canvas it was given and mounts the module named', async () => {
    const { scope, made, backends, mod } = setUp();
    scope.send(init());
    await settle();
    expect(made).toHaveLength(1);
    expect(made[0].opts.quality.made).toMatchObject({ dpr: 2, detail: 'high', sharp: 1 });
    // (the canvas went to the backend: browser.js's makeBackend makes none of its own here)
    expect(backends[0].opts.canvas).toBe(canvas);
    expect(mod.create).toHaveBeenCalledWith(made[0], { a: 1 });
    // (the box the runtime measures is the page's size, there being no DOM)
    expect(made[0].current.host.getBoundingClientRect()).toMatchObject({ width: 640, height: 360 });
    expect(scope.of('ready')).toEqual([{ type: 'ready', backend: 'nodes-webgl' }]);
  });

  it('says it failed for a module it has no door for', async () => {
    const { scope, made } = setUp();
    scope.send(init({ module: 'battlefront' }));
    await settle();
    expect(made).toHaveLength(0);
    expect(scope.of('failed')[0].message).toMatch(/battlefront/);
  });

  it('replaces the snapshot with each input message, and the world reads it in its step', async () => {
    const { scope, made, w } = setUp();
    scope.send(init());
    await settle();
    made[0].input.bind({ fire: ['Space'] }, { axes: {} });
    scope.send({ type: 'input', snapshot: packInput({ keys: new Set(['Space']), pressed: new Set(['Space']), pointer: { x: 3, y: 4, down: false } }) });
    made[0].step.step(16);
    const snap = w.step.mock.calls.at(-1)[1];
    expect(snap.action('fire')).toBe(true);
    expect(snap.pressed.has('Space')).toBe(true);
    expect(snap.pointer).toMatchObject({ x: 3, y: 4 });
    // (and the binding went to the page, whose input prevents the bound keys' default)
    expect(scope.of('bind')).toEqual([{ type: 'bind', actions: { fire: ['Space'] }, axes: {} }]);
  });

  it('passes the page’s size to the runtime, which sizes the canvas itself', async () => {
    const { scope, made } = setUp();
    scope.send(init());
    await settle();
    scope.send({ type: 'resize', w: 800, h: 450, ratio: 2 });
    expect(made[0].resize).toHaveBeenCalledWith(800, 450);
    expect(made[0].current.host.getBoundingClientRect()).toMatchObject({ width: 800, height: 450 });
  });

  it('posts a frame’s time each frame, and the world’s events and HUD numbers', async () => {
    const { scope, made } = setUp();
    scope.send(init());
    await settle();
    made[0].step.step(16);
    expect(scope.of('frame')[0]).toMatchObject({ type: 'frame', ms: 4, at: 16, gpu: null });
    made[0].events.emit('score', { n: 3 });
    expect(scope.of('event')).toEqual([{ type: 'event', name: 'score', data: { n: 3 } }]);
    made[0].hud({ hp: 80 });
    expect(scope.of('hud')).toEqual([{ type: 'hud', values: { hp: 80 } }]);
  });

  it('tells the page of a lost device, so useWorld can mount on the page again', async () => {
    const { scope, made } = setUp();
    scope.send(init());
    await settle();
    made[0].opts.onLoss({ kind: 'webgpu', reason: 'destroyed' });
    expect(scope.of('lost')).toEqual([{ type: 'lost', kind: 'webgpu', reason: 'destroyed' }]);
  });

  it('hands visibility, quality, props and the end to the runtime', async () => {
    const { scope, made, w } = setUp();
    scope.send(init());
    await settle();
    scope.send({ type: 'visible', on: false });
    expect(made[0].setVisible).toHaveBeenCalledWith(false);
    scope.send({ type: 'quality', level: 'low' });
    expect(made[0].requality).toHaveBeenCalledWith('low');
    scope.send({ type: 'props', props: { b: 2 } });
    expect(w.update).toHaveBeenCalledWith({ b: 2 });
    scope.send({ type: 'unmount' });
    expect(made[0].dispose).toHaveBeenCalled();
    expect(scope.closed).toBe(true);
  });

  it('asks the page for its services and hears the answer', async () => {
    const { scope, made } = setUp();
    scope.send(init({ saves: { 'tp-best': 12 } }));
    await settle();
    const rt = made[0];
    // (a save is read from what the page sent and written through to the page)
    expect(rt.opts.saves.get('tp-best')).toBe(12);
    rt.opts.saves.set('tp-best', 14);
    expect(rt.opts.saves.get('tp-best')).toBe(14);
    const asked = rt.opts.store.get('runs', 'last');
    const call = scope.of('call').at(-1);
    expect(call).toMatchObject({ name: 'store.get', args: ['runs', 'last'] });
    expect(scope.of('call').map((c) => c.name)).toContain('saves.set');
    scope.send({ type: 'result', id: call.id, value: { t: 9 } });
    await expect(asked).resolves.toEqual({ t: 9 });
    // (the AudioContext is the page's: no node crosses)
    expect(() => rt.opts.audio.bus()).toThrow(/page/);
  });
});

describe('createInputStore', () => {
  it('keeps a press the worker drew no frame for, once', () => {
    const store = createInputStore(() => {});
    store.take(packInput({ keys: new Set(['KeyE']), pressed: new Set(['KeyE']) }));
    store.take(packInput({ keys: new Set(), pressed: new Set() }));
    expect(store.sample().pressed.has('KeyE')).toBe(true);
    expect(store.sample().pressed.size).toBe(0);
  });
});
