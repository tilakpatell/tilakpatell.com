import { describe, expect, it } from 'vitest';
import { RETURN_VERSION, returnFrom, watchReturn, withReturn } from './playReturn.js';

// a page's bones: elements as records, the body's class watched as the play page sets it
function page({ batchMutations = false } = {}) {
  const observers = [];
  const assigned = [];
  const copied = [];
  const body = { className: '', children: [], append: (e) => body.children.push(e) };
  const head = { children: [], append: (e) => head.children.push(e) };
  const element = (tag) => {
    const e = { tag, style: {}, children: [], attributes: {} };
    // (the bones' own fields kept out of what the tests compare)
    Object.defineProperties(e, {
      setAttribute: { value: (k, v) => (e.attributes[k] = v) },
      append: { value: (c) => e.children.push(c) },
      remove: { value: () => body.children.splice(body.children.indexOf(e), 1) },
    });
    return e;
  };
  const win = {
    navigator: { userAgent: 'test', gpu: { requestAdapter: async () => ({ info: { vendor: 'nvidia', architecture: 'ampere', device: '', description: 'RTX 3050 Laptop' } }) }, clipboard: { writeText: async (t) => (copied.push(t), undefined) } },
    document: { body, head, createElement: element, querySelector: (q) => body.children.find((c) => q === '.' + c.className) ?? null },
    location: { assign: (to) => assigned.push(to) },
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
  return { win, body, head, observers, assigned, copied, state };
}

describe('the way back from the engine’s page', () => {
  it('goes back to the galaxy world the visitor came from, else to the site’s Battlefront', () => {
    expect(returnFrom('?from=%2Fgalaxy%2Fhoth')).toEqual({ to: '/#/galaxy/hoth', label: 'Back to Hoth', onQuit: true });
    expect(returnFrom('?seed=3&from=/galaxy/endor')).toEqual({ to: '/#/galaxy/endor', label: 'Back to Endor', onQuit: true });
    for (const search of ['', '?from=https://evil.example/', '?from=//evil.example', '?from=/galaxy/../x', '?from=/universe'])
      expect(returnFrom(search)).toEqual({ to: '/#/battlefront', label: 'Back to the site', onQuit: false });
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
    expect(p.body.children[0].href).toBe('/#/battlefront');
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

  it('retains a completed failure under batched mutations without leaving the page', async () => {
    const p = page({ batchMutations: true });
    watchReturn(p.win, returnFrom('?from=/galaxy/hoth'));
    p.state('ending');
    p.win.__playFlow.sessions.push({ endReason: 'failed', passed: false, error: 'Error: frame 0 failed' });
    p.state('menu');
    await Promise.resolve();
    expect(p.assigned).toEqual([]);
    expect(p.body.children.find((c) => c.className === 'tp-failed')?.textContent).toBe('The round stopped: Error: frame 0 failed');
  });

  it('keeps a failed round’s reason up, and copies it with the GPU the browser gave', async () => {
    const p = page();
    watchReturn(p.win, returnFrom('?from=/galaxy/hoth'));
    p.state('loading');
    p.win.__playFlow.sessions.push({ endReason: 'failed', passed: false, level: 'Hoth_01', error: 'Error: world-startup-presentation-timeout: frame 0\n    at warm' });
    p.state('menu');
    const box = p.body.children.find((c) => c.className === 'tp-failed');
    expect(box.textContent).toBe('The round stopped: Error: world-startup-presentation-timeout: frame 0');
    expect(box.attributes.role).toBe('alert');
    await box.children[0].onclick();
    expect(JSON.parse(p.copied[0])).toMatchObject({ endReason: 'failed', level: 'Hoth_01', adapter: { description: 'RTX 3050 Laptop' } });
    expect(box.children[0].textContent).toBe('Copied');
    expect(p.assigned).toEqual([]);
    // (one box: the next failure takes its place)
    p.state('loading');
    p.win.__playFlow.sessions.push({ endReason: 'failed', passed: false, error: 'TypeError: Failed to fetch' });
    p.state('menu');
    expect(p.body.children.filter((c) => c.className === 'tp-failed').map((c) => c.textContent)).toEqual(['The round stopped: TypeError: Failed to fetch']);
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
