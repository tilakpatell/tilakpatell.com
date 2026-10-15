import { describe, expect, it } from 'vitest';
import { adoptable, madeFor, recoverNow, watchNear } from './useWorld';

// A page mounting a module finds a world of that module already on the
// runtime: one handed over to it (adopt it), or one made for something else
// (a world built for the hero or the mission the page has since changed
// from: make it again, not adopt it and show the old one)
describe('which world on the runtime a page may adopt', () => {
  const mod = { id: 'galaxy-surface' };
  const world = () => ({ draw() {} });
  it('one handed over (made by no page): adopted, whatever the page asks for', () => {
    expect(adoptable({ module: mod, world: world() }, mod, 'chase')).toBe(true);
    expect(adoptable({ module: mod, world: world() }, mod, null)).toBe(true);
  });
  it('one a page made for the same thing: adopted (React’s second run, the page again)', () => {
    const w = world();
    madeFor.set(w, 'explore');
    expect(adoptable({ module: mod, world: w }, mod, 'explore')).toBe(true);
  });
  it('one a page made for something else: not adopted', () => {
    const w = world();
    madeFor.set(w, 'explore');
    expect(adoptable({ module: mod, world: w }, mod, 'chase')).toBe(false);
  });
  it('another module’s, or none: not adopted', () => {
    expect(adoptable({ module: { id: 'earth' }, world: world() }, mod, null)).toBe(false);
    expect(adoptable(null, mod, null)).toBe(false);
  });
});

// A lost device on WebGPU: the page mounts its world again, once, on the
// node renderer over WebGL 2; a second loss leaves the page's own fallback
describe('when a page mounts its world again after a loss', () => {
  it('once, after a loss the runtime can come back from', () => {
    expect(recoverNow({ status: 'lost', recoverable: true, tried: false, mine: true })).toBe(true);
    // (a page opened while another page's world is lost: that page's to mount again, not this one's)
    expect(recoverNow({ status: 'lost', recoverable: true, tried: false, mine: false })).toBe(false);
    expect(recoverNow({ status: 'lost', recoverable: true, tried: true, mine: true })).toBe(false);
    expect(recoverNow({ status: 'lost', recoverable: false, tried: false, mine: true })).toBe(false);
    expect(recoverNow({ status: 'failed', recoverable: true, tried: false, mine: true })).toBe(false);
    expect(recoverNow({ status: 'on', recoverable: true, tried: false, mine: true })).toBe(false);
  });
});

// A page with its world below the fold (`near`): the world is made once its
// box comes within the margin of the viewport, as lib/three/useScene's
// scenes were, and stays made; with no margin, or no IntersectionObserver
// to ask, at once.
describe('a world made when its box comes near', () => {
  const fakeIO = () => {
    const made = [];
    class IO {
      constructor(fn, opts) {
        this.fn = fn;
        this.opts = opts;
        this.off = false;
        made.push(this);
      }
      observe(el) {
        this.el = el;
      }
      disconnect() {
        this.off = true;
      }
    }
    return { IO, made };
  };
  it('no margin: near at once, nothing watched', () => {
    const { IO, made } = fakeIO();
    const seen = [];
    watchNear({}, null, () => seen.push(true), { IO });
    expect(seen).toEqual([true]);
    expect(made).toEqual([]);
  });
  it('no IntersectionObserver: near at once', () => {
    const seen = [];
    watchNear({}, '0px', () => seen.push(true), { IO: undefined });
    expect(seen).toEqual([true]);
  });
  it('a margin: near the first time the box is within it, then no longer watched', () => {
    const { IO, made } = fakeIO();
    const el = {};
    const seen = [];
    watchNear(el, '100% 0px', () => seen.push(true), { IO });
    expect(made[0].opts).toEqual({ rootMargin: '100% 0px' });
    expect(made[0].el).toBe(el);
    made[0].fn([{ isIntersecting: false }]);
    expect(seen).toEqual([]);
    made[0].fn([{ isIntersecting: true }]);
    expect(seen).toEqual([true]);
    expect(made[0].off).toBe(true);
  });
  it('let go before it came near: nothing said', () => {
    const { IO, made } = fakeIO();
    const seen = [];
    const stop = watchNear({}, '0px', () => seen.push(true), { IO });
    stop();
    expect(made[0].off).toBe(true);
  });
});
