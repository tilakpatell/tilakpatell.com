import { describe, expect, it, vi } from 'vitest';
import { createRuntime } from './runtime';

// stand-ins: a backend, a loop the test ticks, a host box, and a world
const fakeBackend = () => ({
  backend: 'webgl',
  renderer: { r: true },
  canvas: { remove: vi.fn(), parentNode: null },
  size: { w: 1, h: 1 },
  ratio: 2,
  setSize: vi.fn(),
  setRatio: vi.fn(),
  snapshot: vi.fn(() => ({ set: vi.fn(), remove: vi.fn() })),
  lost: false,
  dispose: vi.fn(),
});
const fakeLoop = () => {
  let fn = null;
  let can = () => true;
  const ctl = { kick: vi.fn(), stop: vi.fn() };
  return {
    create: (step, opts) => {
      fn = step;
      can = opts?.can ?? can;
      return ctl;
    },
    tick: (now) => (can() ? fn(now) : false),
    ctl,
  };
};
const fakeHost = () => ({ prepend: vi.fn(), getBoundingClientRect: () => ({ width: 640, height: 360 }), appendChild: vi.fn() });
const fakeWorld = (extra = {}) => ({ resize: vi.fn(), draw: vi.fn(), dispose: vi.fn(), ...extra });
const fakeInput = () => ({ attach: vi.fn(), detach: vi.fn(), unbind: vi.fn(), sample: vi.fn(() => ({ keys: new Set() })) });
const fakeQuality = () => ({ frame: vi.fn(() => null), ratio: 2, budget: { ratio: 2 }, level: 0, on: () => () => {} });
const fakeAudio = () => ({ fadeOut: vi.fn() });
const fakeAssets = () => ({ owner: vi.fn(), drop: vi.fn() });

function make(overrides = {}) {
  const loop = fakeLoop();
  const makeBackend = vi.fn(() => fakeBackend());
  const input = fakeInput();
  const quality = fakeQuality();
  const audio = fakeAudio();
  const assets = fakeAssets();
  const rt = createRuntime({ makeBackend, loop: loop.create, input, quality, audio, assets, gpu: false, ...overrides });
  return { rt, loop, makeBackend, input, quality, audio, assets };
}
const flush = async (n = 6) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};
const settled = () => new Promise((r) => setTimeout(r, 0)); // (every microtask run: a build that's done has asked for its cover)

describe('createRuntime', () => {
  it('mounts: loading, ready after create, on after the first frame, in frame order', async () => {
    const { rt, loop, makeBackend, input } = make();
    const order = [];
    const world = fakeWorld({ step: vi.fn(() => order.push('step')), draw: vi.fn(() => order.push('draw')), wants: () => true });
    const mod = { id: 'a', create: vi.fn(() => world) };
    const host = fakeHost();
    const statuses = [];
    rt.on((s) => statuses.push(s));
    const p = rt.mount(mod, { x: 1 }, host);
    expect(rt.status).toBe('loading');
    await p;
    expect(rt.status).toBe('ready');
    expect(makeBackend).toHaveBeenCalledWith('webgl', expect.anything());
    expect(host.prepend).toHaveBeenCalledWith(rt.gfx.canvas);
    expect(world.resize).toHaveBeenCalledWith(640, 360);
    expect(mod.create.mock.calls[0][1]).toEqual({ x: 1 });
    expect(input.attach).toHaveBeenCalled();
    expect(loop.tick(16)).toBe(true);
    expect(rt.status).toBe('on');
    expect(order).toEqual(['step', 'draw']);
    expect(world.draw.mock.calls[0][0]).toMatchObject({ dt: 0.016, now: 16, renderer: rt.gfx.renderer });
    expect(statuses).toEqual(['loading', 'ready', 'on']);
    expect(rt.current.module).toBe(mod); // the very object the page mounted, so useWorld can tell its own
  });

  it("waits for a world's prepare before showing it, and tells its progress", async () => {
    const { rt } = make();
    let finish;
    const seen = [];
    rt.events.on('prepare', (e) => seen.push([e.module, e.value, e.step]));
    const world = fakeWorld({
      prepare: vi.fn((report) => {
        report(0.5, 'shaders');
        return new Promise((r) => (finish = r));
      }),
    });
    const p = rt.mount({ id: 'p', create: () => world }, {}, fakeHost());
    await settled();
    expect(world.prepare).toHaveBeenCalled();
    expect(rt.status).toBe('loading');
    finish();
    await p;
    expect(rt.status).toBe('ready');
    expect(seen).toEqual([
      ['p', 0.5, 'shaders'],
      ['p', 1, 'first draw'],
    ]);
  });

  it('drops a world still preparing when something newer is mounted', async () => {
    const { rt } = make();
    let alive = null;
    const first = fakeWorld({
      prepare: vi.fn((report, opts) => {
        alive = opts.alive;
        return new Promise(() => {});
      }),
    });
    rt.mount({ id: 'old', create: () => first }, {}, fakeHost());
    await settled();
    const second = fakeWorld();
    await rt.mount({ id: 'new', create: () => second }, {}, fakeHost());
    expect(alive()).toBe(false);
    expect(rt.current.world).toBe(second);
  });

  it('a module with a label makes the canvas a picture', async () => {
    const { rt } = make();
    const canvas = { remove: vi.fn(), parentNode: null, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
    const gfx = fakeBackend();
    gfx.canvas = canvas;
    const { rt: rt2 } = make({ makeBackend: () => gfx });
    await rt2.mount({ id: 'a', label: 'The Earth in 3D', create: () => fakeWorld() }, {}, fakeHost());
    expect(canvas.attrs).toEqual({ role: 'img', 'aria-label': 'The Earth in 3D' });
    await rt2.mount({ id: 'b', create: () => fakeWorld() }, {}, fakeHost());
    expect(canvas.attrs).toEqual({});
    expect(rt.status).toBe('idle');
  });

  it('a mount during loading wins: the first world is disposed, never drawn', async () => {
    const { rt, loop } = make();
    const first = fakeWorld();
    const second = fakeWorld({ wants: () => true });
    let release;
    const slow = { id: 'slow', create: () => new Promise((r) => (release = r)) };
    const quick = { id: 'quick', create: () => second };
    const p1 = rt.mount(slow, {}, fakeHost());
    await flush(); // slow's create has begun
    const p2 = rt.mount(quick, {}, fakeHost());
    await p2;
    release(first);
    await p1;
    await flush();
    expect(first.dispose).toHaveBeenCalled();
    loop.tick(16);
    expect(first.draw).not.toHaveBeenCalled();
    expect(second.draw).toHaveBeenCalled();
    expect(rt.current.module.id).toBe('quick');
  });

  it('two mounts while the backend is made share it: one context, and the one kept is the one given the ratio', async () => {
    const quality = fakeQuality();
    quality.ratioUnder = vi.fn((cap) => Math.min(cap ?? Infinity, 2));
    const made = [];
    const makeBackend = vi.fn(() => {
      let resolve;
      const p = new Promise((r) => (resolve = r));
      made.push({ gfx: fakeBackend(), resolve });
      return p;
    });
    const { rt, loop } = make({ quality, makeBackend });
    const mod = { id: 'galaxy', ratio: 1.5, create: () => fakeWorld({ wants: () => true }) };
    // (React's second run of an effect in development mounts the same module again at once)
    const p1 = rt.mount(mod, {}, fakeHost());
    const p2 = rt.mount(mod, {}, fakeHost());
    await flush();
    expect(makeBackend).toHaveBeenCalledTimes(1);
    made[0].resolve(made[0].gfx);
    expect(await p1).toBe(false);
    expect(await p2).toBe(true);
    expect(rt.gfx).toBe(made[0].gfx);
    expect(made[0].gfx.setRatio).toHaveBeenCalledWith(1.5);
    expect(made[0].gfx.dispose).not.toHaveBeenCalled();
    loop.tick(16);
    expect(rt.status).toBe('on');
  });

  it('a backend of another kind asked for meanwhile wins, whichever arrives first, and the other goes', async () => {
    const made = {};
    const makeBackend = vi.fn((kind) => {
      let resolve;
      const p = new Promise((r) => (resolve = r));
      made[kind] = { gfx: { ...fakeBackend(), backend: kind }, resolve };
      return p;
    });
    const { rt } = make({ makeBackend, gpu: true });
    const p1 = rt.mount({ id: 'old', create: () => fakeWorld() }, {}, fakeHost());
    const p2 = rt.mount({ id: 'new', shading: 'nodes', create: () => fakeWorld() }, {}, fakeHost());
    await flush();
    expect(makeBackend.mock.calls.map((c) => c[0])).toEqual(['webgl', 'webgpu']);
    made.webgpu.resolve(made.webgpu.gfx);
    expect(await p2).toBe(true);
    made.webgl.resolve(made.webgl.gfx);
    expect(await p1).toBe(false);
    await flush();
    expect(rt.gfx).toBe(made.webgpu.gfx);
    expect(made.webgpu.gfx.setRatio).toHaveBeenCalled();
    expect(made.webgl.gfx.dispose).toHaveBeenCalled(); // (not left holding a context)
    expect(made.webgpu.gfx.dispose).not.toHaveBeenCalled();
  });

  it('a backend that fails to make fails the mount, and the next mount tries again', async () => {
    let fails = true;
    const makeBackend = vi.fn(() => (fails ? Promise.reject(new Error('no context')) : fakeBackend()));
    const { rt } = make({ makeBackend });
    expect(await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost())).toBe(false);
    expect(rt.status).toBe('failed');
    fails = false;
    expect(await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost())).toBe(true);
    expect(makeBackend).toHaveBeenCalledTimes(2);
  });

  it("marks a fresh mount's box until its first frame (its canvas fades in), and a handover's never", async () => {
    const { rt, loop } = make();
    const host = { ...fakeHost(), dataset: {} };
    const p = rt.mount({ id: 'a', create: () => fakeWorld({ wants: () => true, handoff: () => null }) }, {}, host);
    expect(host.dataset.fresh).toBe('');
    await p;
    expect(host.dataset.fresh).toBe(''); // (placed, not yet drawn)
    loop.tick(16);
    expect(host.dataset).not.toHaveProperty('fresh');
    // a handover into another box (the surface's, as the ship lands): no mark, so no dip under its cover
    const host2 = { ...fakeHost(), dataset: {} };
    const h = rt.handover({ id: 'b', create: () => fakeWorld({ wants: () => true }) }, {}, host2);
    expect(host2.dataset).not.toHaveProperty('fresh');
    await settled();
    loop.tick(32);
    await h;
    loop.tick(48);
    expect(host2.dataset).not.toHaveProperty('fresh');
    // a mount that never draws (failed, or left) doesn't leave its box marked
    const host3 = { ...fakeHost(), dataset: {} };
    await rt.mount({ id: 'bad', create: () => { throw new Error('no'); } }, {}, host3);
    expect(host3.dataset).not.toHaveProperty('fresh');
    const host4 = { ...fakeHost(), dataset: {} };
    rt.mount({ id: 'slow', create: () => new Promise(() => {}) }, {}, host4);
    expect(host4.dataset.fresh).toBe('');
    rt.unmount();
    expect(host4.dataset).not.toHaveProperty('fresh');
  });

  it("a box's resize is applied at the start of the next frame, before its draw, and only if the size changed", async () => {
    const order = [];
    const gfx = fakeBackend();
    gfx.setSize = vi.fn((w, h) => {
      gfx.size.w = w;
      gfx.size.h = h;
      order.push(`setSize ${w}x${h}`);
    });
    const { rt, loop } = make({ makeBackend: () => gfx });
    rt.resize(800, 450); // (no world yet: nothing)
    expect(gfx.setSize).not.toHaveBeenCalled();
    const world = fakeWorld({ wants: () => true, resize: vi.fn((w, h) => order.push(`resize ${w}x${h}`)), draw: vi.fn(() => order.push('draw')) });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    expect(order).toEqual(['setSize 640x360', 'resize 640x360']); // (placed at once: it has to be sized before it draws)
    loop.tick(16);
    order.length = 0;
    // from a ResizeObserver, which runs after the frame's drawn: resized
    // then, the buffer would be shown cleared until the next one
    rt.resize(800, 450);
    expect(order).toEqual([]);
    loop.tick(33);
    expect(order).toEqual(['setSize 800x450', 'resize 800x450', 'draw']);
    order.length = 0;
    rt.resize(800.3, 449.8); // (the same box, rounded: a ResizeObserver's first call repeats it)
    loop.tick(50);
    expect(order).toEqual(['draw']);
    order.length = 0;
    rt.resize(700, 400);
    rt.resize(720, 405); // (only the last before a frame counts)
    loop.tick(66);
    expect(order).toEqual(['setSize 720x405', 'resize 720x405', 'draw']);
  });

  it("the last world's box out of sight doesn't keep the next world from drawing", async () => {
    const { rt, loop } = make();
    await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost());
    rt.setVisible(false); // (its box scrolled away)
    rt.unmount();
    const next = fakeWorld({ wants: () => true, setVisible: vi.fn() });
    await rt.mount({ id: 'b', create: () => next }, {}, fakeHost());
    expect(next.setVisible).toHaveBeenLastCalledWith(true);
    expect(loop.tick(16)).toBe(true);
    expect(next.draw).toHaveBeenCalled();
    expect(rt.status).toBe('on');
    // and its own box going out of sight still stops it
    rt.setVisible(false);
    expect(loop.tick(32)).toBe(false);
    expect(next.draw).toHaveBeenCalledTimes(1);
  });

  it('a frame that throws fails the world', async () => {
    const { rt, loop } = make();
    const world = fakeWorld({ draw: () => { throw new Error('boom'); } });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    expect(loop.tick(16)).toBe(false);
    expect(rt.status).toBe('failed');
    expect(world.dispose).toHaveBeenCalled();
    expect(rt.current).toBe(null);
  });

  it('a world at rest asks for no more frames until kicked', async () => {
    const { rt, loop } = make();
    let want = false;
    const world = fakeWorld({ wants: () => want });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    expect(loop.tick(16)).toBe(false);
    want = true;
    expect(loop.tick(32)).toBe(true);
    expect(world.draw.mock.calls[1][0].dt).toBeCloseTo(0.016);
  });

  it('dt is clamped to 50 ms', async () => {
    const { rt, loop } = make();
    const world = fakeWorld({ wants: () => true });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    loop.tick(16);
    loop.tick(5000);
    expect(world.draw.mock.calls[1][0].dt).toBe(0.05);
  });

  it('the first frame waits for ready, then the world is told its props again', async () => {
    const { rt } = make();
    let ready;
    const world = fakeWorld({ ready: new Promise((r) => (ready = r)), update: vi.fn() });
    const p = rt.mount({ id: 'a', create: () => world }, { n: 1 }, fakeHost());
    await flush();
    expect(rt.status).toBe('loading');
    ready();
    await p;
    expect(rt.status).toBe('ready');
    expect(world.update).toHaveBeenCalledWith({ n: 1 });
  });

  it('handover keeps the old world drawing until the new one is ready, then fades it out', async () => {
    const { rt, loop, audio, assets } = make();
    const old = fakeWorld({ wants: () => true, handoff: () => ({ pose: 7 }) });
    await rt.mount({ id: 'old', create: () => old }, {}, fakeHost());
    loop.tick(0);
    let readyNew;
    const next = fakeWorld({ wants: () => true, ready: new Promise((r) => (readyNew = r)) });
    const nextMod = { id: 'next', create: vi.fn(() => next) };
    const host2 = fakeHost();
    const p = rt.handover(nextMod, { a: 1 }, host2, { fade: 600 });
    await flush();
    expect(nextMod.create.mock.calls[0][1]).toEqual({ a: 1, from: { pose: 7 } });
    loop.tick(100);
    expect(old.draw).toHaveBeenCalledTimes(2); // still the old world, and seen: no cover over it yet
    expect(next.draw).not.toHaveBeenCalled();
    expect(rt.gfx.snapshot).not.toHaveBeenCalled();
    readyNew();
    await settled();
    loop.tick(150); // the old world's last frame, kept as the cover
    expect(old.draw).toHaveBeenCalledTimes(3);
    const snap = rt.gfx.snapshot.mock.results[0].value;
    expect(await p).toBe(true);
    expect(old.dispose).toHaveBeenCalled();
    expect(audio.fadeOut).toHaveBeenCalled();
    expect(assets.drop).toHaveBeenCalledWith('old');
    expect(host2.prepend).toHaveBeenCalledWith(rt.gfx.canvas);
    expect(rt.current.module.id).toBe('next');
    loop.tick(200);
    expect(next.draw).toHaveBeenCalledTimes(1);
    expect(snap.set).toHaveBeenLastCalledWith(1);
    loop.tick(500);
    expect(snap.set).toHaveBeenLastCalledWith(0.5);
    loop.tick(900);
    expect(snap.remove).toHaveBeenCalled();
    expect(rt.status).toBe('on');
  });

  it('a handover says whether its world is the one drawing now', async () => {
    const { rt, loop } = make();
    await rt.mount({ id: 'old', create: () => fakeWorld() }, {}, fakeHost());
    // something newer asked for while it was made: no
    let readyNew;
    const p = rt.handover({ id: 'next', create: () => fakeWorld({ ready: new Promise((r) => (readyNew = r)) }) }, {}, fakeHost());
    await settled();
    rt.unmount();
    readyNew();
    expect(await p).toBe(false);
    expect(rt.current).toBe(null);
    // failed: no, and the old world stays up with nothing over it
    const old = fakeWorld({ wants: () => true });
    expect(await rt.mount({ id: 'old', create: () => old }, {}, fakeHost())).toBe(true);
    expect(await rt.handover({ id: 'bad', create: () => { throw new Error('no'); } }, {}, fakeHost())).toBe(false);
    expect(rt.current.module.id).toBe('old');
    expect(rt.gfx.snapshot).not.toHaveBeenCalled();
    loop.tick(10);
    expect(old.draw).toHaveBeenCalled();
    // over: yes
    expect(await rt.handover({ id: 'next', create: () => fakeWorld() }, {}, fakeHost())).toBe(true);
    expect(rt.current.module.id).toBe('next');
    expect(old.dispose).toHaveBeenCalledTimes(1);
  });

  it('a handover off screen, where no frame comes, goes on without a cover after a moment', async () => {
    let seen = false;
    const { rt, loop } = make({ visible: () => seen });
    await rt.mount({ id: 'old', create: () => fakeWorld() }, {}, fakeHost());
    const next = fakeWorld({ wants: () => false });
    const t0 = Date.now();
    expect(await rt.handover({ id: 'next', create: () => next }, {}, fakeHost())).toBe(true);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(rt.gfx.snapshot).not.toHaveBeenCalled();
    seen = true;
    expect(loop.tick(10)).toBe(false); // (no cover to fade, a world at rest)
    expect(next.draw).toHaveBeenCalledTimes(1);
  });

  it('a handover with `after` keeps the old world drawing until that is done, then takes the cover', async () => {
    const { rt, loop } = make();
    const old = fakeWorld({ wants: () => true });
    await rt.mount({ id: 'old', create: () => old }, {}, fakeHost());
    loop.tick(0);
    let done;
    const after = new Promise((r) => (done = r));
    const next = fakeWorld({ wants: () => true });
    const p = rt.handover({ id: 'next', create: () => next }, {}, fakeHost(), { fade: 600, after });
    await settled();
    loop.tick(100);
    loop.tick(200);
    expect(old.draw).toHaveBeenCalledTimes(3); // made, and still the old world's moment
    expect(rt.gfx.snapshot).not.toHaveBeenCalled();
    done();
    await settled();
    loop.tick(300); // the cover
    expect(rt.gfx.snapshot).toHaveBeenCalledTimes(1);
    expect(await p).toBe(true);
    loop.tick(400);
    expect(next.draw).toHaveBeenCalledTimes(1);
    expect(old.draw).toHaveBeenCalledTimes(4);
  });

  it('a handoff that throws still hands over with from null', async () => {
    const { rt } = make();
    const old = fakeWorld({ handoff: () => { throw new Error('no'); } });
    await rt.mount({ id: 'old', create: () => old }, {}, fakeHost());
    const create = vi.fn(() => fakeWorld());
    await rt.handover({ id: 'next', create }, { b: 2 }, fakeHost());
    expect(create.mock.calls[0][1]).toEqual({ b: 2, from: null });
    expect(old.dispose).toHaveBeenCalled();
  });

  it('a handover with nothing mounted is a mount', async () => {
    const { rt } = make();
    const create = vi.fn(() => fakeWorld());
    await rt.handover({ id: 'next', create }, {}, fakeHost());
    expect(create.mock.calls[0][1]).toEqual({ from: null });
    expect(rt.status).toBe('ready');
  });

  it('unmount disposes, clears input and fades audio, keeps the canvas', async () => {
    const { rt, input, audio, assets } = make();
    const world = fakeWorld();
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    rt.unmount();
    expect(world.dispose).toHaveBeenCalled();
    expect(input.detach).toHaveBeenCalled();
    expect(input.unbind).toHaveBeenCalled();
    expect(audio.fadeOut).toHaveBeenCalled();
    expect(assets.drop).toHaveBeenCalledWith('a');
    expect(rt.gfx.dispose).not.toHaveBeenCalled();
    expect(rt.status).toBe('idle');
    expect(rt.current).toBe(null);
  });

  it('a lost context sets lost, and a later mount makes a new backend', async () => {
    const { rt, makeBackend } = make();
    const world = fakeWorld();
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    const first = rt.gfx;
    makeBackend.mock.calls[0][1].onLost();
    expect(rt.status).toBe('lost');
    expect(world.dispose).toHaveBeenCalled();
    expect(first.dispose).toHaveBeenCalled();
    await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost());
    expect(makeBackend).toHaveBeenCalledTimes(2);
    expect(rt.status).toBe('ready');
  });

  it('a webgpu loss comes back on webgl', async () => {
    const { rt, makeBackend } = make({ gpu: true });
    await rt.mount({ id: 'n', shading: 'nodes', create: () => fakeWorld() }, {}, fakeHost());
    expect(makeBackend.mock.calls[0][0]).toBe('webgpu');
    makeBackend.mock.calls[0][1].onLost();
    await rt.mount({ id: 'n', shading: 'nodes', create: () => fakeWorld() }, {}, fakeHost());
    expect(makeBackend.mock.calls[1][0]).toBe('webgl');
  });

  it('a create that throws fails the mount', async () => {
    const { rt } = make();
    await rt.mount({ id: 'a', create: () => { throw new Error('nope'); } }, {}, fakeHost());
    expect(rt.status).toBe('failed');
    expect(rt.current).toBe(null);
  });

  it('a new quality level sets the ratio and tells the world', async () => {
    const quality = fakeQuality();
    quality.frame = vi.fn(() => 2);
    quality.ratio = 1.44;
    const { rt, loop } = make({ quality });
    const world = fakeWorld({ wants: () => true, lowerQuality: vi.fn() });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    loop.tick(16);
    expect(rt.gfx.setRatio).toHaveBeenCalledWith(1.44);
    expect(world.lowerQuality).toHaveBeenCalledWith(2);
  });

  it('a new quality level is set before the frame is drawn, so the resized buffer is never shown cleared', async () => {
    const order = [];
    const quality = fakeQuality();
    let next = null;
    quality.frame = vi.fn(() => {
      const l = next;
      next = null;
      return l;
    });
    const gfx = fakeBackend();
    gfx.setRatio = vi.fn(() => order.push('setRatio'));
    const { rt, loop } = make({ quality, makeBackend: () => gfx });
    const world = fakeWorld({ wants: () => true, lowerQuality: vi.fn(() => order.push('lowerQuality')), draw: vi.fn(() => order.push('draw')) });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    loop.tick(16);
    order.length = 0;
    next = 1;
    loop.tick(33);
    expect(order).toEqual(['setRatio', 'lowerQuality', 'draw']);
  });

  it('a frame whose draw throws after a level change still fails the world', async () => {
    const quality = fakeQuality();
    quality.frame = vi.fn(() => 1);
    const { rt, loop } = make({ quality });
    const world = fakeWorld({ lowerQuality: vi.fn(), draw: () => { throw new Error('boom'); } });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    expect(loop.tick(16)).toBe(false);
    expect(world.lowerQuality).toHaveBeenCalledWith(1);
    expect(rt.status).toBe('failed');
    expect(world.dispose).toHaveBeenCalled();
  });

  it('each world gives the governor a fresh start: reset and held before its ratio is set, so that ratio is the sharpest', async () => {
    const order = [];
    const quality = fakeQuality();
    let scale = 0.72; // (the last world had it softened)
    quality.ratioUnder = (cap) => Math.min(cap ?? Infinity, 2) * scale;
    quality.reset = vi.fn(() => {
      order.push('reset');
      scale = 1;
    });
    quality.hold = vi.fn((ms) => order.push(`hold ${ms}`));
    const gfx = fakeBackend();
    gfx.setRatio = vi.fn((r) => order.push(`setRatio ${r}`));
    const { rt } = make({ quality, makeBackend: () => gfx });
    await rt.mount({ id: 'galaxy', ratio: 1.5, create: () => fakeWorld() }, {}, fakeHost());
    expect(order).toEqual(['reset', 'hold 3000', 'setRatio 1.5']);
  });

  // This replaced a test that pinned a kick after the new ratio was set
  // under the old world. The kick only helped a handover begun outside a
  // frame. A take-off begins inside the surface's own draw, so the build
  // resumed after that draw, in the same task, with the next frame already
  // queued, and the resize showed the cleared buffer for a frame. The new
  // world's fresh start now waits for the cover instead.
  it("a handover begun inside the old world's draw leaves its canvas alone: the new world's fresh start and ratio come under the cover", async () => {
    const order = [];
    const quality = fakeQuality();
    let scale = 1;
    quality.ratioUnder = (cap) => Math.min(cap ?? Infinity, 2) * scale;
    quality.reset = vi.fn(() => {
      order.push('reset');
      scale = 1;
    });
    quality.hold = vi.fn((ms) => order.push(`hold ${ms}`));
    const gfx = fakeBackend();
    gfx.setRatio = vi.fn((r) => order.push(`setRatio ${r}`));
    gfx.setSize = vi.fn((w, h) => order.push(`setSize ${w}x${h}`));
    gfx.snapshot = vi.fn(() => {
      order.push('snapshot');
      return { set: vi.fn(), remove: vi.fn() };
    });
    const { rt, loop } = make({ quality, makeBackend: () => gfx });
    let board = false;
    const galaxy = fakeWorld({ wants: () => true, draw: vi.fn(() => order.push('draw galaxy')) });
    const surface = fakeWorld({
      wants: () => true,
      draw: vi.fn(() => {
        order.push('draw surface');
        // (taking off: the surface's draw emits 'leaving', and the page hands over there and then)
        if (board) {
          board = false;
          rt.handover({ id: 'galaxy', ratio: 1.5, create: () => galaxy }, {}, fakeHost());
        }
      }),
    });
    await rt.mount({ id: 'surface', ratio: 1.5, create: () => surface }, {}, fakeHost());
    loop.tick(0);
    scale = 0.85; // (it struggled: softened, and its canvas drawn at 1.275)
    board = true;
    order.length = 0;
    loop.tick(16);
    await settled(); // (the microtasks after the frame: still before the browser paints)
    expect(order).toEqual(['draw surface']); // nothing written to the canvas it has just drawn
    loop.tick(33); // the old world's last frame, kept as the cover
    await settled();
    loop.tick(50);
    expect(order).toEqual(['draw surface', 'draw surface', 'snapshot', 'reset', 'hold 3000', 'setRatio 1.5', 'setSize 640x360', 'draw galaxy']);
  });

  it("the governor isn't fed the old world's frames while the next world is made", async () => {
    const { rt, loop, quality } = make();
    await rt.mount({ id: 'old', create: () => fakeWorld({ wants: () => true }) }, {}, fakeHost());
    loop.tick(0);
    expect(quality.frame).toHaveBeenCalledTimes(1);
    let readyNew;
    const p = rt.handover({ id: 'next', create: () => fakeWorld({ wants: () => true, ready: new Promise((r) => (readyNew = r)) }) }, {}, fakeHost());
    await flush();
    loop.tick(100);
    loop.tick(200); // (the old world drawing on, its frames carrying the new one's making)
    expect(quality.frame).toHaveBeenCalledTimes(1);
    readyNew();
    await settled();
    loop.tick(300); // (the cover)
    await p;
    loop.tick(400); // the new world's first frame: its own from here
    expect(quality.frame).toHaveBeenCalledTimes(2);
    expect(quality.frame).toHaveBeenLastCalledWith(400);
  });

  it('a module that softens through its own post chain keeps its canvas as it is, and is told the level', async () => {
    const quality = fakeQuality();
    let scale = 1;
    quality.ratioUnder = vi.fn((cap, { unscaled = false } = {}) => Math.min(cap ?? Infinity, 2) * (unscaled ? 1 : scale));
    quality.frame = vi.fn(() => {
      scale = 0.72;
      return 2;
    });
    const { rt, loop } = make({ quality });
    const world = fakeWorld({ wants: () => true, lowerQuality: vi.fn() });
    await rt.mount({ id: 'galaxy', ratio: 1.5, sharpness: 'own', create: () => world }, {}, fakeHost());
    expect(rt.gfx.setRatio).toHaveBeenLastCalledWith(1.5);
    loop.tick(16);
    expect(world.lowerQuality).toHaveBeenCalledWith(2);
    for (const [r] of rt.gfx.setRatio.mock.calls) expect(r).toBe(1.5); // (never the scaled 1.08)
    // a module without it is drawn at the scaled ratio, as before
    const plain = fakeWorld({ wants: () => true, lowerQuality: vi.fn() });
    scale = 1;
    await rt.mount({ id: 'surface', ratio: 1.5, create: () => plain }, {}, fakeHost());
    loop.tick(32);
    expect(rt.gfx.setRatio).toHaveBeenLastCalledWith(1.5 * 0.72);
    expect(plain.lowerQuality).toHaveBeenCalledWith(2);
  });

  it("a module's ratio caps the sharpness it's drawn at", async () => {
    const quality = fakeQuality();
    quality.ratioUnder = vi.fn((cap) => Math.min(cap ?? Infinity, 2));
    const { rt } = make({ quality });
    await rt.mount({ id: 'a', ratio: 1.5, create: () => fakeWorld() }, {}, fakeHost());
    expect(rt.gfx.setRatio).toHaveBeenLastCalledWith(1.5);
    await rt.mount({ id: 'b', create: () => fakeWorld() }, {}, fakeHost());
    expect(rt.gfx.setRatio).toHaveBeenLastCalledWith(2);
  });

  it('a handover keeps the keys the new world bound as it was made', async () => {
    const { rt, input } = make();
    input.bind = vi.fn();
    input.bindings = vi.fn(() => ({ actions: { old: ['KeyO'] }, axes: {} }));
    await rt.mount({ id: 'old', create: () => fakeWorld() }, {}, fakeHost());
    input.unbind.mockClear();
    let order = [];
    input.unbind.mockImplementation(() => order.push('unbind'));
    const create = vi.fn(() => {
      order.push('create');
      rt.input.bind({ fly: ['KeyW'] });
      return fakeWorld();
    });
    await rt.handover({ id: 'next', create }, {}, fakeHost());
    expect(order).toEqual(['unbind', 'create']); // (never unbound after it bound them)
    // and a handover that fails gives the old world its keys back
    order = [];
    await rt.handover({ id: 'bad', create: () => { throw new Error('no'); } }, {}, fakeHost());
    expect(input.bind).toHaveBeenLastCalledWith({ old: ['KeyO'] }, { axes: {} });
  });

  it("a handover gives the old world its keys back while the new one prepares, and the new one's once it's prepared", async () => {
    const { rt, input } = make();
    let bound = { actions: {}, axes: {} };
    input.bind = vi.fn((actions, { axes = {} } = {}) => (bound = { actions, axes }));
    input.bindings = vi.fn(() => bound);
    input.unbind.mockImplementation(() => (bound = { actions: {}, axes: {} }));
    await rt.mount({ id: 'old', create: () => (rt.input.bind({ old: ['KeyO'] }), fakeWorld()) }, {}, fakeHost());
    let finish;
    const seen = [];
    const next = fakeWorld({
      prepare: () => {
        seen.push(bound.actions);
        return new Promise((r) => (finish = r));
      },
    });
    const p = rt.handover({ id: 'next', create: () => (rt.input.bind({ fly: ['KeyW'] }), next) }, {}, fakeHost());
    await settled();
    expect(seen).toEqual([{ old: ['KeyO'] }]); // (the old world's, while the new one prepares)
    finish();
    await settled();
    expect(bound.actions).toEqual({ fly: ['KeyW'] });
    expect(await p).toBe(true);
    expect(bound.actions).toEqual({ fly: ['KeyW'] });
  });

  it('a newer mount during the prepare leaves the keys to it', async () => {
    const { rt, input } = make();
    let bound = { actions: {}, axes: {} };
    input.bind = vi.fn((actions, { axes = {} } = {}) => (bound = { actions, axes }));
    input.bindings = vi.fn(() => bound);
    input.unbind.mockImplementation(() => (bound = { actions: {}, axes: {} }));
    await rt.mount({ id: 'old', create: () => (rt.input.bind({ old: ['KeyO'] }), fakeWorld()) }, {}, fakeHost());
    let finish;
    const next = fakeWorld({ prepare: () => new Promise((r) => (finish = r)) });
    const p = rt.handover({ id: 'next', create: () => (rt.input.bind({ fly: ['KeyW'] }), next) }, {}, fakeHost());
    await settled();
    await rt.mount({ id: 'third', create: () => (rt.input.bind({ walk: ['KeyA'] }), fakeWorld()) }, {}, fakeHost());
    finish();
    expect(await p).toBe(false);
    expect(bound.actions).toEqual({ walk: ['KeyA'] });
  });

  it('a held cover waits for the page to adopt the world, then fades in its box', async () => {
    const { rt, loop, input } = make();
    const old = fakeWorld({ wants: () => true });
    const host1 = fakeHost();
    await rt.mount({ id: 'old', create: () => old }, {}, host1);
    loop.tick(0);
    const nextMod = { id: 'next', create: () => fakeWorld({ wants: () => true }) };
    const p = rt.handover(nextMod, {}, host1, { fade: 600, held: true });
    await settled();
    loop.tick(16); // (the old world's last frame, kept as the cover)
    await p;
    const snap = rt.gfx.snapshot.mock.results[0].value;
    snap.el = { parentNode: host1 };
    loop.tick(100);
    loop.tick(700);
    expect(snap.set).not.toHaveBeenCalled(); // still covering: no page has it yet
    expect(snap.remove).not.toHaveBeenCalled();
    const host2 = fakeHost();
    expect(rt.adopt({ id: 'other' }, host2)).toBe(false);
    input.attach.mockClear();
    expect(rt.adopt(nextMod, host2)).toBe(true);
    expect(host2.prepend).toHaveBeenCalledWith(rt.gfx.canvas);
    expect(host2.appendChild).toHaveBeenCalledWith(snap.el);
    expect(input.attach).toHaveBeenCalledWith(expect.objectContaining({ host: host2 }));
    expect(rt.host).toBe(host2);
    loop.tick(800);
    loop.tick(1100);
    expect(snap.set).toHaveBeenLastCalledWith(0.5);
    loop.tick(1500);
    expect(snap.remove).toHaveBeenCalled();
  });

  it('a held cover gives up waiting after a few seconds', async () => {
    const { rt, loop } = make();
    await rt.mount({ id: 'old', create: () => fakeWorld({ wants: () => true }) }, {}, fakeHost());
    loop.tick(0);
    const p = rt.handover({ id: 'next', create: () => fakeWorld({ wants: () => true }) }, {}, fakeHost(), { fade: 600, held: true });
    await settled();
    loop.tick(16); // (the old world's last frame, kept as the cover)
    await p;
    const snap = rt.gfx.snapshot.mock.results[0].value;
    loop.tick(100);
    loop.tick(3200);
    loop.tick(3300);
    loop.tick(4000);
    expect(snap.remove).toHaveBeenCalled();
  });

  it('says which module is being made, so a page that leaves drops only its own', async () => {
    const { rt } = make();
    let done;
    const mod = { id: 'a', create: () => new Promise((r) => (done = r)) };
    expect(rt.loading).toBe(null);
    const p = rt.mount(mod, {}, fakeHost());
    expect(rt.loading).toBe(mod);
    await flush();
    done(fakeWorld());
    await p;
    expect(rt.loading).toBe(null);
    const bad = { id: 'b', create: () => { throw new Error('no'); } };
    await rt.mount(bad, {}, fakeHost());
    expect(rt.loading).toBe(null);
    const slow = { id: 'c', create: () => new Promise(() => {}) };
    rt.mount(slow, {}, fakeHost());
    rt.unmount();
    expect(rt.loading).toBe(null); // (dropped)
  });

  it('events reach the page and leave with the world', async () => {
    const { rt } = make();
    const fn = vi.fn();
    const off = rt.events.on('hud', fn);
    rt.events.emit('hud', { km: 1 });
    expect(fn).toHaveBeenCalledWith({ km: 1 });
    off();
    rt.events.emit('hud', { km: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a world with an anchor moves the floating origin before its step, and the shift is an origin event', async () => {
    const { rt, loop } = make();
    const seen = [];
    rt.events.on('origin', (e) => seen.push(e));
    let pos = [10, 0, 10];
    const order = [];
    const world = fakeWorld({ anchor: () => pos, step: vi.fn(() => order.push(rt.origin.at[0])), wants: () => true });
    await rt.mount({ id: 'far', create: () => world }, {}, fakeHost());
    loop.tick(16);
    expect(seen).toEqual([]);
    pos = [rt.origin.cell + 1, 0, 0];
    loop.tick(32);
    expect(seen).toEqual([{ shift: [rt.origin.cell, 0, 0] }]);
    expect(order).toEqual([0, rt.origin.cell]); // (moved before the step that frame)
  });

  it('a new world starts at a zero origin; one without an anchor never moves it', async () => {
    const { rt, loop } = make();
    const world = fakeWorld({ anchor: () => [3 * rt.origin.cell, 0, 0], wants: () => true });
    await rt.mount({ id: 'far', create: () => world }, {}, fakeHost());
    loop.tick(16);
    expect(rt.origin.at[0]).toBe(3 * rt.origin.cell);
    await rt.mount({ id: 'near', create: () => fakeWorld({ wants: () => true }) }, {}, fakeHost());
    expect(rt.origin.at).toEqual([0, 0, 0]);
    loop.tick(32);
    expect(rt.origin.at).toEqual([0, 0, 0]);
  });

  it('carries the worker pool it is given', () => {
    const workers = { request: vi.fn() };
    expect(make({ workers }).rt.workers).toBe(workers);
  });
});

describe('the quality level changed while a world is up', () => {
  it('lets a world that can retune itself do so, with the ratio set again', async () => {
    const { rt, quality } = make();
    quality.retune = vi.fn();
    const world = fakeWorld({ onQuality: vi.fn() });
    await rt.mount({ id: 'a', create: () => world }, {}, fakeHost());
    rt.gfx.setRatio.mockClear();
    expect(rt.requality('ultra')).toBe('tuned');
    expect(quality.retune).toHaveBeenCalledWith('ultra');
    expect(world.onQuality).toHaveBeenCalledWith('ultra');
    expect(rt.gfx.setRatio).toHaveBeenCalled();
  });

  it('hands the level to a module’s own onQuality with the world', async () => {
    const { rt } = make();
    const world = fakeWorld();
    const mod = { id: 'a', create: () => world, onQuality: vi.fn() };
    await rt.mount(mod, {}, fakeHost());
    expect(rt.requality('low')).toBe('tuned');
    expect(mod.onQuality).toHaveBeenCalledWith('low', world, rt);
  });

  it('says a world that can’t retune needs a reload, and reloads it with what it had', async () => {
    const { rt } = make();
    const create = vi.fn(() => fakeWorld());
    const mod = { id: 'a', create };
    const host = fakeHost();
    await rt.mount(mod, { x: 1 }, host);
    expect(rt.requality('high')).toBe('reload');
    expect(await rt.reload()).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][1]).toEqual({ x: 1 });
    expect(rt.current.module).toBe(mod);
  });

  it('does nothing with no world up, or one still on its way, but the next world is built at the new level', async () => {
    const { rt, quality } = make();
    quality.retune = vi.fn();
    expect(rt.requality('high')).toBe('idle');
    expect(quality.retune).toHaveBeenCalledWith('high');
    expect(await rt.reload()).toBe(false);
    let finish;
    const p = rt.mount({ id: 'a', create: () => new Promise((r) => (finish = r)) }, {}, fakeHost());
    await flush();
    expect(rt.requality('high')).toBe('idle');
    finish(fakeWorld());
    await p;
  });

  it('a world whose retune throws is offered a reload instead', async () => {
    const { rt } = make();
    await rt.mount({ id: 'a', create: () => fakeWorld({ onQuality: () => { throw new Error('no'); } }) }, {}, fakeHost());
    expect(rt.requality('high')).toBe('reload');
  });

  it('sets the sharpness and draws again', async () => {
    const { rt, quality } = make();
    quality.setSharpness = vi.fn();
    await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost());
    rt.gfx.setRatio.mockClear();
    rt.sharpen(1.5);
    expect(quality.setSharpness).toHaveBeenCalledWith(1.5);
    expect(rt.gfx.setRatio).toHaveBeenCalled();
  });
});

describe('calibration switched off (the QA scripts: ?calibrate=off)', () => {
  const tuneSteps = (rt) => {
    const steps = [];
    rt.events.on('prepare', (e) => e.step === 'tune' && steps.push(e));
    return steps;
  };

  it('calibrates a world on mount by default', async () => {
    const { rt, quality } = make();
    quality.setLevel = vi.fn();
    const steps = tuneSteps(rt);
    await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost());
    await settled();
    expect(steps).toHaveLength(1);
  });

  it('skips the walk and leaves the world at its sharpest step', async () => {
    const { rt, quality } = make({ calibrate: false });
    quality.setLevel = vi.fn();
    const steps = tuneSteps(rt);
    await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost());
    await settled();
    expect(steps).toHaveLength(0);
    expect(quality.setLevel).not.toHaveBeenCalled();
  });
});
