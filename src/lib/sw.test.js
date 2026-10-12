import { describe, expect, it, vi } from 'vitest';
import { createWorkerSwitch } from './sw';

const navOf = (regs = []) => ({ serviceWorker: { register: vi.fn(async () => ({})), getRegistrations: vi.fn(async () => regs) } });
const cachesOf = (names) => ({ keys: async () => names });

describe('the service worker’s registration', () => {
  it('registers /sw.js once, when a world is installed', async () => {
    const nav = navOf();
    const sw = createWorkerSwitch({ nav, caches: cachesOf(['tp-pack-earth-abc']), prod: true });
    await sw.start();
    await sw.start();
    await sw.need();
    expect(nav.serviceWorker.register).toHaveBeenCalledTimes(1);
    expect(nav.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('registers nothing for a visitor with nothing installed, until an install begins', async () => {
    const nav = navOf();
    const sw = createWorkerSwitch({ nav, caches: cachesOf([]), prod: true });
    await sw.start();
    expect(nav.serviceWorker.register).not.toHaveBeenCalled();
    await sw.need();
    expect(nav.serviceWorker.register).toHaveBeenCalledTimes(1);
  });

  it('goes when the last pack does', async () => {
    const reg = { unregister: vi.fn(async () => true), active: { scriptURL: 'http://x/sw.js' } };
    const sw = createWorkerSwitch({ nav: navOf([reg]), caches: cachesOf([]), prod: true });
    await sw.tidy();
    expect(reg.unregister).toHaveBeenCalled();
  });

  it('does nothing in development, or with no service workers', async () => {
    const nav = navOf();
    await createWorkerSwitch({ nav, caches: cachesOf(['tp-pack-earth-abc']), prod: false }).need();
    expect(nav.serviceWorker.register).not.toHaveBeenCalled();
    await expect(createWorkerSwitch({ nav: {}, caches: cachesOf([]), prod: true }).need()).resolves.toBeNull();
  });

  it('tells the worker the asset base in its URL, so it serves the bucket’s files of an installed pack', async () => {
    const nav = navOf();
    await createWorkerSwitch({ nav, caches: cachesOf(['tp-pack-earth-abc']), prod: true, base: 'https://b.test/a' }).start();
    expect(nav.serviceWorker.register).toHaveBeenCalledWith('/sw.js?base=https%3A%2F%2Fb.test%2Fa', { scope: '/' });
    const reg = { unregister: vi.fn(async () => true), active: { scriptURL: 'http://x/sw.js?base=https%3A%2F%2Fb.test%2Fa' } };
    await createWorkerSwitch({ nav: navOf([reg]), caches: cachesOf([]), prod: true, base: 'https://b.test/a' }).tidy();
    expect(reg.unregister).toHaveBeenCalled();
  });
});

describe('the world being played (lane N4)', () => {
  it('registers the worker and tells it the world, in production only', async () => {
    const post = vi.fn();
    const nav = { serviceWorker: { register: vi.fn(async () => ({ active: { postMessage: post } })), getRegistrations: vi.fn(async () => []), controller: null } };
    const sw = createWorkerSwitch({ nav, caches: cachesOf([]), prod: true });
    await sw.playing('hoth');
    expect(nav.serviceWorker.register).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith({ type: 'tp-play', world: 'hoth' });
    const dev = createWorkerSwitch({ nav: navOf(), caches: cachesOf([]), prod: false });
    expect(await dev.playing('hoth')).toBeNull();
  });

  it('comes back for a visitor who has played a world, and stays while one is kept', async () => {
    const nav = navOf();
    const sw = createWorkerSwitch({ nav, caches: cachesOf(['tp-play-hoth']), prod: true });
    await sw.start();
    expect(nav.serviceWorker.register).toHaveBeenCalledTimes(1);
    const reg = { unregister: vi.fn(async () => true), active: { scriptURL: 'http://x/sw.js' } };
    await createWorkerSwitch({ nav: navOf([reg]), caches: cachesOf(['tp-play-hoth']), prod: true }).tidy();
    expect(reg.unregister).not.toHaveBeenCalled();
  });
});
