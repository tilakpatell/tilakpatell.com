import { describe, expect, it } from 'vitest';
import { RETURN_VERSION, returnFrom, watchReturn, withReturn } from './playReturn.js';

// a page's bones: elements as records, the body's class watched as the play page sets it
function page() {
  const observers = [];
  const assigned = [];
  const body = { className: '', children: [], append: (e) => body.children.push(e) };
  const head = { children: [], append: (e) => head.children.push(e) };
  const win = {
    document: { body, head, createElement: (tag) => ({ tag }) },
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
  const state = (s) => {
    win.__playFlow.state = s;
    body.className = `play-${s}`;
    for (const o of observers) o.fn();
  };
  return { win, body, head, observers, assigned, state };
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
    expect(p.body.children).toEqual([{ tag: 'a', className: 'tp-return', href: '/#/galaxy/hoth', textContent: 'Back to Hoth' }]);
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
    expect(p.observers).toEqual([]);
    expect(p.body.children[0].href).toBe('/#/battlefront');
  });

  it('adds itself to the exported page, which has no </body>, or before one', () => {
    const plain = withReturn('<!doctype html><canvas></canvas>');
    expect(plain.startsWith('<!doctype html><canvas></canvas><script>(')).toBe(true);
    expect(plain.endsWith('(location.search));</script>')).toBe(true);
    expect(withReturn('<body><p></p></body></html>')).toMatch(/<p><\/p><script>.*<\/script><\/body><\/html>$/s);
    expect(RETURN_VERSION).toMatch(/^[0-9a-f]{8}$/);
  });

  it('runs as the page runs it, from its source text alone', () => {
    const p = page();
    const script = /<script>(.*)<\/script>/s.exec(withReturn(''))[1];
    new Function('window', 'location', script)(p.win, { search: '?from=/galaxy/hoth' });
    expect(p.body.children[0].href).toBe('/#/galaxy/hoth');
    expect(p.observers).toHaveLength(1);
  });
});
