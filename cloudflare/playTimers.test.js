import { describe, expect, it } from 'vitest';
import { steadyTimers } from './playTimers.js';
import { withReturn } from './playReturn.js';

// a page's timers: the browser's own counted, a MessageChannel delivered when the test says
function page() {
  const own = [];
  const cleared = [];
  const ports = [];
  const win = {
    document: { hidden: false },
    setTimeout: (fn, ms, ...args) => (own.push({ fn, ms, args }), own.length),
    clearTimeout: (id) => void cleared.push(id),
    MessageChannel: class {
      constructor() {
        this.port1 = { onmessage: null };
        this.port2 = { postMessage: () => ports.push(this.port1) };
      }
    },
  };
  const deliver = () => {
    while (ports.length) ports.shift().onmessage?.({});
  };
  return { win, own, cleared, deliver };
}

describe('the engine page’s timers while its tab is hidden', () => {
  it('leaves every timer to the browser while the page is shown', () => {
    const p = page();
    steadyTimers(p.win);
    p.win.setTimeout(() => {}, 0);
    expect(p.own).toHaveLength(1);
  });

  it('runs a short timer through a channel the browser doesn’t hold back, its arguments passed', () => {
    const p = page();
    steadyTimers(p.win);
    p.win.document.hidden = true;
    const ran = [];
    p.win.setTimeout((a, b) => ran.push(['poll', a, b]), 0, 1, 2);
    p.win.setTimeout(() => ran.push(['warm']), 2);
    expect(p.own).toHaveLength(0);
    expect(ran).toEqual([]);
    p.deliver();
    expect(ran).toEqual([['poll', 1, 2], ['warm']]);
  });

  it('keeps a longer timer, and code given as text, the browser’s', () => {
    const p = page();
    steadyTimers(p.win);
    p.win.document.hidden = true;
    p.win.setTimeout(() => {}, 100);
    p.win.setTimeout('void 0', 0);
    expect(p.own.map((t) => t.ms)).toEqual([100, 0]);
  });

  it('cancels its own timers, and hands the browser’s back to it', () => {
    const p = page();
    steadyTimers(p.win);
    p.win.document.hidden = true;
    let ran = false;
    const id = p.win.setTimeout(() => (ran = true), 0);
    p.win.clearTimeout(id);
    p.deliver();
    expect(ran).toBe(false);
    p.win.clearTimeout(7);
    expect(p.cleared).toEqual([7]);
  });

  it('is part of the script the engine’s page is sent', () => {
    expect(withReturn('')).toContain('MessageChannel');
  });
});
