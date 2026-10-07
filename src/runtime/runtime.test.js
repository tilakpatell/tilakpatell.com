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
  return {
    create: (step, opts) => {
      fn = step;
      can = opts?.can ?? can;
      return { kick: vi.fn(), stop: vi.fn() };
    },
    tick: (now) => (can() ? fn(now) : false),
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

  it('a context lost while a world is made: made again on a fresh backend, drawn with it', async () => {
    const { rt, loop, makeBackend } = make();
    const first = fakeWorld();
    const second = fakeWorld({ wants: () => true });
    const made = [];
    const releases = [];
    const mod = {
      id: 'a',
      create: vi.fn((r) => {
        made.push(r.gfx.renderer); // (what a module captures at create)
        return new Promise((res) => releases.push(res));
      }),
    };
    const host = fakeHost();
    const p = rt.mount(mod, {}, host);
    await flush();
    const old = rt.gfx;
    const statuses = [];
    rt.on((s) => statuses.push(s));
    makeBackend.mock.calls[0][1].onLost();
    expect(rt.status).toBe('loading'); // (not lost: a page would give up on it)
    releases[0](first);
    await flush();
    expect(first.dispose).toHaveBeenCalled(); // (made on a renderer that's gone)
    expect(makeBackend).toHaveBeenCalledTimes(2);
    expect(rt.status).toBe('loading');
    releases[1](second);
    expect(await p).toBe(true);
    expect(rt.gfx).not.toBe(old);
    expect(made).toEqual([old.renderer, rt.gfx.renderer]);
    expect(host.prepend).toHaveBeenCalledWith(rt.gfx.canvas);
    loop.tick(16);
    expect(first.draw).not.toHaveBeenCalled();
    expect(second.draw.mock.calls[0][0].renderer).toBe(rt.gfx.renderer);
    expect(statuses).toEqual(['ready', 'on']);
  });

  it('a create that breaks on its context going is made again', async () => {
    const { rt, loop, makeBackend } = make();
    const world = fakeWorld({ wants: () => true });
    let n = 0;
    const mod = {
      id: 'a',
      create: async (r) => {
        n += 1;
        await flush(2);
        if (n === 1) makeBackend.mock.calls[0][1].onLost();
        const { renderer } = r.gfx; // (read after an await: null once lost)
        return { ...world, renderer };
      },
    };
    expect(await rt.mount(mod, {}, fakeHost())).toBe(true);
    expect(n).toBe(2);
    expect(rt.current.world.renderer).toBe(rt.gfx.renderer);
    loop.tick(16);
    expect(rt.status).toBe('on');
  });

  it('lost again while made again: lost, nothing drawn', async () => {
    const { rt, makeBackend } = make();
    const worlds = [fakeWorld(), fakeWorld()];
    let n = 0;
    const mod = {
      id: 'a',
      create: () => {
        const w = worlds[n++];
        return flush(2).then(() => {
          makeBackend.mock.calls.at(-1)[1].onLost();
          return w;
        });
      },
    };
    expect(await rt.mount(mod, {}, fakeHost())).toBe(false);
    expect(n).toBe(2);
    expect(worlds[0].dispose).toHaveBeenCalled();
    expect(worlds[1].dispose).toHaveBeenCalled();
    expect(rt.status).toBe('lost');
    expect(rt.current).toBe(null);
    expect(rt.loading).toBe(null);
  });

  it('two mounts at once make one backend', async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    const makeBackend = vi.fn(() => gate.then(() => fakeBackend()));
    const { rt, loop } = make({ makeBackend });
    const seen = [];
    const mod = { id: 'a', create: (r) => (seen.push(r.gfx), fakeWorld({ wants: () => true })) };
    const p1 = rt.mount(mod, {}, fakeHost());
    const p2 = rt.mount(mod, {}, fakeHost()); // (React's second run of an effect, in development)
    release();
    expect(await p1).toBe(false);
    expect(await p2).toBe(true);
    expect(makeBackend).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([rt.gfx]);
    loop.tick(16);
    expect(rt.current.world.draw.mock.calls[0][0].renderer).toBe(rt.gfx.renderer);
  });

  it('a backend let go losing its context leaves the one in use alone', async () => {
    const { rt, makeBackend } = make();
    await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost());
    makeBackend.mock.calls[0][1].onLost();
    await rt.mount({ id: 'a', create: () => fakeWorld() }, {}, fakeHost());
    const now = rt.gfx;
    makeBackend.mock.calls[0][1].onLost(); // (the old one, again)
    expect(rt.status).toBe('ready');
    expect(rt.gfx).toBe(now);
    expect(now.dispose).not.toHaveBeenCalled();
  });

  it('a context lost during a handover: the new world is made again and shown', async () => {
    const { rt, loop, makeBackend } = make();
    const old = fakeWorld({ wants: () => true });
    await rt.mount({ id: 'old', create: () => old }, {}, fakeHost());
    const worlds = [fakeWorld(), fakeWorld({ wants: () => true })];
    const releases = [];
    let n = 0;
    const next = { id: 'next', create: () => new Promise((res) => releases.push(() => res(worlds[n++]))) };
    const p = rt.handover(next, {}, fakeHost());
    await flush();
    makeBackend.mock.calls[0][1].onLost();
    expect(old.dispose).toHaveBeenCalled();
    releases[0]();
    await flush(12);
    releases[1]();
    expect(await p).toBe(true);
    expect(worlds[0].dispose).toHaveBeenCalled();
    expect(rt.current.module).toBe(next);
    loop.tick(16);
    expect(worlds[1].draw.mock.calls[0][0].renderer).toBe(rt.gfx.renderer);
    expect(old.draw).not.toHaveBeenCalled();
  });

  it('a handover that ends in a lost context does not bring back the world it let go', async () => {
    const { rt, makeBackend } = make();
    const old = fakeWorld({ wants: () => true });
    await rt.mount({ id: 'old', create: () => old }, {}, fakeHost());
    const next = {
      id: 'next',
      create: () =>
        flush(2).then(() => {
          makeBackend.mock.calls.at(-1)[1].onLost();
          return fakeWorld();
        }),
    };
    expect(await rt.handover(next, {}, fakeHost())).toBe(false);
    expect(rt.status).toBe('lost');
    expect(rt.current).toBe(null);
  });

  it('a handover to the other backend kind: the old world is not drawn on the new backend', async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    let n = 0;
    const makeBackend = vi.fn((kind) => (n++ === 0 ? fakeBackend() : gate.then(() => ({ ...fakeBackend(), backend: kind }))));
    const { rt, loop } = make({ makeBackend, gpu: true });
    const old = fakeWorld({ wants: () => true });
    await rt.mount({ id: 'old', create: () => old }, {}, fakeHost());
    loop.tick(16);
    expect(old.draw).toHaveBeenCalledTimes(1);
    const p = rt.handover({ id: 'gpu', shading: 'nodes', create: () => fakeWorld() }, {}, fakeHost());
    await flush();
    loop.tick(32); // (its backend gone, the new one not made yet)
    expect(rt.status).toBe('on');
    expect(old.dispose).not.toHaveBeenCalled();
    release();
    await flush();
    loop.tick(48);
    expect(old.draw).toHaveBeenCalledTimes(1);
    expect(await p).toBe(true);
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
});
