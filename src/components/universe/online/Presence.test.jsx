import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Presence run by hand, as React would run it, with no DOM here: its hooks
// kept between runs, its refs given stand-in elements before its effects
// run, and its frame loop stepped one frame at a time. A stand-in keeps
// what’s written to it and has the sizes a test gives it.
const H = vi.hoisted(() => ({ hooks: [], at: 0, effects: [], frame: null, now: 0 }));
vi.mock('react', async (load) => {
  const React = await load();
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const slot = (make) => {
    const i = H.at++;
    H.hooks[i] ??= make();
    return H.hooks[i];
  };
  return {
    ...React,
    useRef: (current) => slot(() => ({ current })),
    useEffect(fn, deps) {
      const s = slot(() => ({}));
      if (same(s.deps, deps)) return;
      H.effects.push(() => {
        s.deps = deps;
        s.undo?.();
        const undo = fn();
        s.undo = typeof undo === 'function' ? undo : null;
      });
    },
  };
});

const { default: Presence } = await import('./Presence');

function fakeEl(tag, size = {}) {
  const el = {
    tag,
    className: '',
    textContent: '',
    hidden: false,
    attrs: {},
    kids: [],
    parentNode: null,
    offsetLeft: 0,
    offsetWidth: 0,
    offsetHeight: 0,
    clientWidth: 0,
    ...size,
    style: {
      transform: '',
      props: {},
      setProperty(k, v) {
        this.props[k] = v;
      },
    },
    setAttribute: (k, v) => (el.attrs[k] = String(v)),
    removeAttribute: (k) => delete el.attrs[k],
    toggleAttribute: (k, on) => (on ? (el.attrs[k] = '') : delete el.attrs[k]),
    appendChild(kid) {
      el.kids.push(kid);
      kid.parentNode = el;
      return kid;
    },
    querySelector: (sel) => (sel === '.presence-tag' ? el.tagEl : null),
  };
  return el;
}
// a pilot’s element: their tag inside it, `left` in from the element’s own
// left (the arrow and the tag’s margin before it), `width` across
const pilotEl = ({ left, width }) => {
  const el = fakeEl('div');
  el.tagEl = fakeEl('span', { offsetLeft: left, offsetWidth: width });
  return el;
};

// draws it, the refs given their elements as React would (a callback
// called, an object’s `current` set), then its effects
const attach = (ref, el) => (typeof ref === 'function' ? ref(el) : ref && (ref.current = el));
function render(online, els) {
  H.at = 0;
  H.effects = [];
  const tree = Presence({ online });
  attach(tree.props.ref, els.root);
  for (const child of [tree.props.children].flat()) attach(child.props.ref, els[child.key]);
  for (const fx of H.effects) fx();
  return tree;
}
const frame = () => {
  const f = H.frame;
  H.frame = null;
  f?.();
};
const bubbleOf = (el) => el.tagEl.kids.find((k) => k.className === 'quip-bubble');

const PAD = 4; // (quipBubble.js’s QUIP_PAD: kept clear of the edge)
const online = (cur, said) => {
  const peers = new Map([['ann', { id: 'ann', name: 'Ace', cur }]]);
  return {
    where: '/projects',
    room: { peers: [{ id: 'ann', name: 'Ace', kind: null, where: '/projects' }] },
    client: { peers, cursor() {}, quip: (id) => said.get(id) ?? null },
  };
};

beforeEach(() => {
  H.hooks = [];
  H.frame = null;
  H.now = 1000;
  vi.stubGlobal('window', { innerWidth: 390, innerHeight: 800, scrollY: 0, matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('document', { createElement: (tag) => fakeEl(tag) });
  vi.stubGlobal('performance', { now: () => H.now });
  vi.stubGlobal('requestAnimationFrame', (fn) => ((H.frame = fn), 1));
  vi.stubGlobal('cancelAnimationFrame', () => (H.frame = null));
});
afterEach(() => {
  for (const s of H.hooks) s?.undo?.();
  vi.unstubAllGlobals();
});

describe('a line over a pilot’s pointer', () => {
  it('shows in a bubble over their tag', () => {
    const said = new Map([['ann', 'Hello']]);
    const els = { root: fakeEl('div', { clientWidth: 390 }), ann: pilotEl({ left: 14, width: 72 }) };
    render(online({ x: 0, y: 300, at: 1000, touch: false }, said), els);
    frame();
    const bubble = bubbleOf(els.ann);
    expect(bubble.hidden).toBe(false);
    expect(bubble.textContent).toBe('Hello');
  });

  it('is moved in off the left edge over a phone reader’s marker, all of it on screen', () => {
    const said = new Map([['ann', 'See you at the map']]);
    // (on a phone, the marker’s at x = 10, no arrow: the tag’s 2px margin pulls it left)
    const els = { root: fakeEl('div', { clientWidth: 390 }), ann: pilotEl({ left: -2, width: 72 }) };
    render(online({ x: 0, y: 300, at: 1000, touch: true }, said), els);
    frame();
    const bubble = bubbleOf(els.ann);
    bubble.offsetWidth = 134;
    frame();
    const shift = parseFloat(bubble.style.props['--quip-shift']);
    // the tag’s middle at 10 − 2 + 36 = 44; the bubble’s start is where it was, moved by the shift
    expect(44 - 134 / 2 + shift).toBe(PAD);
  });

  it('is moved back off the right edge over a pointer held at it', () => {
    const said = new Map([['ann', 'See you at the map']]);
    const els = { root: fakeEl('div', { clientWidth: 375 }), ann: pilotEl({ left: 14, width: 72 }) };
    // (a pointer far to the right: held at the window’s width less 48)
    render(online({ x: 900, y: 300, at: 1000, touch: false }, said), els);
    frame();
    const bubble = bubbleOf(els.ann);
    bubble.offsetWidth = 134;
    frame();
    const shift = parseFloat(bubble.style.props['--quip-shift']);
    const mid = 390 - 48 + 14 + 36;
    // kept inside the box the pointers are drawn in, its scrollbar not counted
    expect(mid + 134 / 2 + shift).toBe(375 - PAD);
  });

  it('stays centred over a tag where it fits', () => {
    const said = new Map([['ann', 'Hello']]);
    const els = { root: fakeEl('div', { clientWidth: 390 }), ann: pilotEl({ left: 14, width: 72 }) };
    render(online({ x: -40, y: 300, at: 1000, touch: false }, said), els);
    frame();
    const bubble = bubbleOf(els.ann);
    bubble.offsetWidth = 60;
    frame();
    expect(bubble.style.props['--quip-shift'] ?? '0px').toBe('0px');
  });
});
