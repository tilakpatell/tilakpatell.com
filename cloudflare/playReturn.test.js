import { describe, expect, it } from 'vitest';
import { RETURN_VERSION, returnFrom, watchReturn, withReturn } from './playReturn.js';

// a page's bones: elements as records, the body's class watched as the play page sets it
function page({ batchMutations = false } = {}) {
  const observers = [];
  const assigned = [];
  const copied = [];
  const keys = [];
  const body = { className: '', children: [], append: (e) => body.children.push(e) };
  const head = { children: [], append: (e) => head.children.push(e) };
  const element = (tag) => {
    const e = { tag, style: {}, children: [], attributes: {} };
    // (the bones' own fields kept out of what the tests compare)
    Object.defineProperties(e, {
      setAttribute: { value: (k, v) => (e.attributes[k] = v) },
      append: { value: (...c) => e.children.push(...c) },
      remove: { value: () => body.children.splice(body.children.indexOf(e), 1) },
    });
    return e;
  };
  const win = {
    navigator: { userAgent: 'test', gpu: { requestAdapter: async () => ({ info: { vendor: 'nvidia', architecture: 'ampere', device: '', description: 'RTX 3050 Laptop' } }) }, clipboard: { writeText: async (t) => (copied.push(t), undefined) } },
    document: { body, head, createElement: element, querySelector: (q) => body.children.find((c) => q === '.' + c.className) ?? null },
    location: { assign: (to) => assigned.push(to) },
    addEventListener: (type, fn, capture) => keys.push({ type, fn, capture }),
    MutationObserver: class {
      constructor(fn) {
        this.fn = fn;
      }
      observe(target, opts) {
        observers.push({ fn: this.fn, target, opts });
      }
    },
    __playFlow: { state: 'boot', sessions: [] },
  };
  let scheduled = false;
  const state = (s) => {
    win.__playFlow.state = s;
    body.className = `play-${s}`;
    if (!batchMutations) for (const o of observers) o.fn();
    else if (!scheduled) {
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        for (const o of observers) o.fn();
      });
    }
  };
  // a key press as the browser sends it to the window's capture listeners first
  const press = (key) => {
    const e = { key, prevented: false, stopped: false, preventDefault: () => (e.prevented = true), stopImmediatePropagation: () => (e.stopped = true) };
    for (const k of keys) if (k.type === 'keydown') k.fn(e);
    return e;
  };
  return { win, body, head, observers, assigned, copied, keys, press, state };
}

// the elements under an element, depth first
const all = (e) => [e, ...(e.children ?? []).flatMap(all)];
const find = (e, className) => all(e).find((c) => c.className === className);
const failedBox = (p) => p.body.children.find((c) => c.className === 'tp-failed');

describe('the way back from the engine’s page', () => {
  it('goes back to the galaxy world the visitor came from, else to the site home without reopening the engine', () => {
    expect(returnFrom('?from=%2Fgalaxy%2Fhoth')).toEqual({ to: '/#/galaxy/hoth', label: 'Back to Hoth', onQuit: true });
    expect(returnFrom('?seed=3&from=/galaxy/endor')).toEqual({ to: '/#/galaxy/endor', label: 'Back to Endor', onQuit: true });
    for (const search of ['', '?from=https://evil.example/', '?from=//evil.example', '?from=/galaxy/../x', '?from=/universe'])
      expect(returnFrom(search)).toEqual({ to: '/#/', label: 'Back to the site', onQuit: false });
  });

  it('puts the link in the corner, shown on the front end only', () => {
    const p = page();
    watchReturn(p.win, returnFrom('?from=/galaxy/hoth'));
    expect(p.body.children).toMatchObject([{ tag: 'a', className: 'tp-return', href: '/#/galaxy/hoth', textContent: 'Back to Hoth' }]);
    expect(p.head.children[0].textContent).toContain('body:not(.play-menu) .tp-return{display:none}');
  });

  it('leaves for the galaxy once a round’s Quit has brought the front end back, and not for another ending', () => {
    const p = page();
    watchReturn(p.win, returnFrom('?from=/galaxy/hoth'));
    p.state('menu');
    p.state('loading');
    p.win.__playFlow.sessions.push({ endReason: 'failed' });
    p.state('menu');
    expect(p.assigned).toEqual([]);
    p.state('loading');
    p.state('ending');
    p.win.__playFlow.sessions.push({ endReason: 'quit' });
    expect(p.assigned).toEqual([]);
    p.state('menu');
    expect(p.assigned).toEqual(['/#/galaxy/hoth']);
  });

  it('keeps the game’s own Quit without a world to go back to', () => {
    const p = page();
    watchReturn(p.win, returnFrom(''));
    expect(p.body.children[0].href).toBe('/#/');
    p.state('loading');
    p.win.__playFlow.sessions.push({ endReason: 'quit', passed: true });
    p.state('menu');
    expect(p.assigned).toEqual([]);
  });

  it('returns after a completed Quit when menu and the next preload batch into one observer callback', async () => {
    const p = page({ batchMutations: true });
    watchReturn(p.win, returnFrom('?from=/galaxy/hoth'));
    // A requested Quit has not completed shutdown and has no session record yet.
    p.state('ending');
    await Promise.resolve();
    expect(p.assigned).toEqual([]);
    // world-play.finish() appends the completed record, then synchronously changes menu -> loading.
    p.win.__playFlow.sessions.push({ endReason: 'quit', passed: true });
    p.state('menu');
    p.state('loading');
    expect(p.assigned).toEqual([]);
    await Promise.resolve();
    expect(p.assigned).toEqual(['/#/galaxy/hoth']);
    p.state('menu');
    await Promise.resolve();
    expect(p.assigned).toEqual(['/#/galaxy/hoth']);
  });

  it.each(['failed', 'quit'])('retains a completed %s failure under batched mutations without leaving the page', async (endReason) => {
    const p = page({ batchMutations: true });
    watchReturn(p.win, returnFrom('?from=/galaxy/hoth'));
    p.state('ending');
    p.win.__playFlow.sessions.push({ endReason, passed: false, error: 'Error: runtime shutdown failed' });
    p.state('menu');
    await Promise.resolve();
    expect(p.assigned).toEqual([]);
    expect(find(failedBox(p), 'tp-failed-line').textContent).toBe('The round stopped: Error: runtime shutdown failed');
  });

  it('keeps a failed round’s reason up, and copies it with the GPU the browser gave', async () => {
    const p = page();
    watchReturn(p.win, returnFrom('?from=/galaxy/hoth'));
    p.state('loading');
    p.win.__playFlow.sessions.push({ endReason: 'failed', passed: false, level: 'Hoth_01', error: 'Error: world-startup-presentation-timeout: frame 0\n    at warm' });
    p.state('menu');
    const box = failedBox(p);
    expect(find(box, 'tp-failed-line').textContent).toBe('The round stopped: Error: world-startup-presentation-timeout: frame 0');
    expect(box.attributes.role).toBe('alert');
    await find(box, 'tp-failed-copy').onclick();
    expect(JSON.parse(p.copied[0])).toMatchObject({ endReason: 'failed', level: 'Hoth_01', adapter: { description: 'RTX 3050 Laptop' } });
    expect(find(box, 'tp-failed-copy').textContent).toBe('Copied');
    expect(p.assigned).toEqual([]);
    // (one box: the next failure takes its place)
    p.state('loading');
    p.win.__playFlow.sessions.push({ endReason: 'failed', passed: false, error: 'TypeError: Failed to fetch' });
    p.state('menu');
    expect(p.body.children.filter((c) => c.className === 'tp-failed').map((c) => find(c, 'tp-failed-line').textContent)).toEqual(['The round stopped: TypeError: Failed to fetch']);
    expect(find(failedBox(p), 'tp-failed-words').textContent).toBe('A download for the game was cut off. Check the connection, then choose PLAY to try again.');
  });

  // owner report 28 (live 1074, 16 Nov): "There is no way to x out the red box too"
  const DEVICE_REFUSED = "OperationError: Failed to execute 'requestDevice' on 'GPUAdapter': D3D12 create command queue failed with DXGI_ERROR_DEVICE_REMOVED (0x887A0005)";

  it('a refused graphics device: plain words first, the technical line under Details, closed by its X', () => {
    const p = page();
    watchReturn(p.win, returnFrom('?from=/galaxy/hoth'));
    p.state('loading');
    p.win.__playFlow.sessions.push({ endReason: 'failed', passed: false, error: DEVICE_REFUSED });
    p.state('menu');
    const box = failedBox(p);
    expect(find(box, 'tp-failed-words').textContent).toBe(
      'The browser could not get the graphics card for the game: it was busy, reset or refused. Close other tabs or lower the quality, then choose PLAY to try again.',
    );
    const details = all(box).find((c) => c.tag === 'details');
    expect(all(details).find((c) => c.tag === 'summary').textContent).toBe('Details');
    expect(find(details, 'tp-failed-line').textContent).toBe(`The round stopped: ${DEVICE_REFUSED}`);
    expect(find(details, 'tp-failed-copy')).toBeTruthy();
    // the X: a labelled button that takes the box away, and nothing else
    const x = find(box, 'tp-failed-close');
    expect(x).toMatchObject({ tag: 'button', textContent: '×', attributes: { 'aria-label': 'Close' } });
    x.onclick();
    expect(failedBox(p)).toBeUndefined();
    expect(p.body.children.map((c) => c.className)).toEqual(['tp-return']);
    expect(p.assigned).toEqual([]);
  });

  it('Escape closes the box first and only; without a box the page keeps its own Escape', () => {
    const p = page();
    watchReturn(p.win, returnFrom(''));
    expect(p.keys.filter((k) => k.type === 'keydown').map((k) => k.capture)).toEqual([true]);
    const idle = p.press('Escape');
    expect([idle.prevented, idle.stopped]).toEqual([false, false]);
    p.state('loading');
    p.win.__playFlow.sessions.push({ endReason: 'failed', passed: false, error: DEVICE_REFUSED });
    p.state('menu');
    expect(p.press('Enter').prevented).toBe(false);
    expect(failedBox(p)).toBeTruthy();
    const esc = p.press('Escape');
    expect([esc.prevented, esc.stopped]).toEqual([true, true]);
    expect(failedBox(p)).toBeUndefined();
    expect(p.press('Escape').prevented).toBe(false);
  });

  it('after a failed start the menu is the visitor’s: PLAY again takes the box away, and a second failure shows one box again', () => {
    const p = page();
    watchReturn(p.win, returnFrom('?from=/galaxy/hoth'));
    p.state('loading');
    p.win.__playFlow.sessions.push({ endReason: 'failed', passed: false, error: DEVICE_REFUSED });
    p.state('menu');
    expect(failedBox(p)).toBeTruthy();
    // menu clicks (the body stays play-menu) leave it; PLAY (the body leaves the menu) takes it away
    p.state('menu');
    expect(failedBox(p)).toBeTruthy();
    p.state('loading');
    expect(failedBox(p)).toBeUndefined();
    p.state('playing');
    p.win.__playFlow.sessions.push({ endReason: 'failed', passed: false, error: DEVICE_REFUSED });
    p.state('menu');
    expect(p.body.children.filter((c) => c.className === 'tp-failed')).toHaveLength(1);
    // a Quit after that still goes back to the galaxy
    p.state('loading');
    expect(failedBox(p)).toBeUndefined();
    p.win.__playFlow.sessions.push({ endReason: 'quit', passed: true });
    p.state('menu');
    expect(p.assigned).toEqual(['/#/galaxy/hoth']);
  });

  it('a failure and the menu batched with the next load keep the box until a later delivery', async () => {
    const p = page({ batchMutations: true });
    watchReturn(p.win, returnFrom(''));
    p.win.__playFlow.sessions.push({ endReason: 'failed', passed: false, error: DEVICE_REFUSED });
    p.state('menu');
    p.state('loading');
    await Promise.resolve();
    expect(failedBox(p)).toBeTruthy();
    p.state('playing');
    await Promise.resolve();
    expect(failedBox(p)).toBeUndefined();
  });

  it.each([
    ['RangeError: Array buffer allocation failed', 'This computer could not give the game the memory it needed. Close other tabs or programs, then choose PLAY to try again.'],
    ['Error: render thread aborted: abort(7)', 'The game stopped unexpectedly. Choose PLAY to try again.'],
    ['Error: the graphics device was lost (destroyed)', 'The browser could not get the graphics card for the game: it was busy, reset or refused. Close other tabs or lower the quality, then choose PLAY to try again.'],
  ])('says %s in plain words', (error, words) => {
    const p = page();
    watchReturn(p.win, returnFrom(''));
    p.win.__playFlow.sessions.push({ endReason: 'failed', passed: false, error });
    p.state('menu');
    expect(find(failedBox(p), 'tp-failed-words').textContent).toBe(words);
    expect(find(failedBox(p), 'tp-failed-line').textContent).toBe(`The round stopped: ${error}`);
  });

  it('adds itself to the exported page, which has no </body>, or before one', () => {
    const plain = withReturn('<!doctype html><canvas></canvas>');
    expect(plain.startsWith('<!doctype html><canvas></canvas><script>(')).toBe(true);
    expect(plain).toContain('(location.search));');
    // (the hidden tab's timers first, playTimers.js; the way back; then the worker that keeps the build on disk
    // registered, and the round's files warmed onto it, engineCache.js)
    const order = ['MessageChannel', '(location.search));', '/battlefront/engine/sw.js', 'x-tp-warm'].map((s) => plain.indexOf(s));
    expect(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1]))).toBe(true);
    expect(plain.endsWith('})();\n</script>')).toBe(true);
    expect(withReturn('<body><p></p></body></html>')).toMatch(/<p><\/p><script>.*<\/script><\/body><\/html>$/s);
    expect(RETURN_VERSION).toMatch(/^[0-9a-f]{8}$/);
  });

  it('runs as the page runs it, from its source text alone', () => {
    const p = page();
    const script = /<script>(.*)<\/script>/s.exec(withReturn(''))[1];
    new Function('window', 'location', script)(p.win, { search: '?from=/galaxy/hoth' });
    expect(p.body.children[0].href).toBe('/#/galaxy/hoth');
    expect(p.observers).toHaveLength(1);
    // (it reaches nothing outside itself: Date and JSON are the page's own)
  });
});
