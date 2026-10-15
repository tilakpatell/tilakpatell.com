import { describe, expect, it, vi } from 'vitest';
import { createViews, readState } from './views';

// A stand-in for the DOM the views move the canvas through: elements with a
// parent, children in order, attributes and a style; a 2D context that
// records what was drawn onto it.
const node = (name = 'div') => {
  const attrs = new Map();
  const n = {
    name,
    parentNode: null,
    children: [],
    style: {},
    className: '',
    offsetLeft: 0,
    offsetTop: 0,
    get nextSibling() {
      const sibs = n.parentNode?.children ?? [];
      return sibs[sibs.indexOf(n) + 1] ?? null;
    },
    getAttributeNames: () => [...attrs.keys()],
    getAttribute: (k) => attrs.get(k) ?? null,
    hasAttribute: (k) => attrs.has(k),
    setAttribute: (k, v) => attrs.set(k, String(v)),
    removeAttribute: (k) => attrs.delete(k),
    insertBefore(child, ref) {
      child.parentNode?.children.splice(child.parentNode.children.indexOf(child), 1);
      child.parentNode = n;
      const at = ref ? n.children.indexOf(ref) : n.children.length;
      n.children.splice(at, 0, child);
    },
    prepend(child) {
      n.insertBefore(child, n.children[0] ?? null);
    },
    appendChild(child) {
      n.insertBefore(child, null);
    },
  };
  return n;
};
const surface = (parent, cls = 'shire-canvas') => {
  const el = node('canvas');
  el.className = cls;
  el.width = 300;
  el.height = 150;
  const drawn = [];
  el.drawn = drawn;
  el.getContext = () => ({ clearRect: () => drawn.push('clear'), drawImage: (...a) => drawn.push(['copy', ...a.slice(1)]) });
  parent.appendChild(el);
  return el;
};

// a renderer that keeps what three's would: its state, its viewport, and
// what drew on the buffer, in order
const fakeRenderer = (canvas) => {
  const log = [];
  let clear = { r: 0, g: 0, b: 0 };
  let clearAlpha = 0;
  const r = {
    log,
    domElement: canvas,
    toneMapping: 0,
    toneMappingExposure: 1,
    outputColorSpace: 'srgb',
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    autoClearStencil: true,
    sortObjects: true,
    localClippingEnabled: false,
    shadowMap: { enabled: false, type: 1 },
    info: { autoReset: true },
    getPixelRatio: () => 1,
    getClearColor: (t) => t.copy(clear),
    getClearAlpha: () => clearAlpha,
    setClearColor: (c, a = 1) => {
      clear = typeof c === 'number' ? { r: ((c >> 16) & 255) / 255, g: ((c >> 8) & 255) / 255, b: (c & 255) / 255 } : { r: c.r, g: c.g, b: c.b };
      clearAlpha = a;
    },
    setRenderTarget: () => {},
    setScissorTest: () => {},
    setViewport: (x, y, w, h) => log.push(['viewport', w, h]),
    clear: () => log.push('clear'),
    getDrawingBufferSize: (t) => t.set(canvas.width, canvas.height),
  };
  return r;
};

const setup = () => {
  const page = node('page');
  const host = node('atlas');
  page.appendChild(host);
  const canvas = node('canvas');
  canvas.width = 1440;
  canvas.height = 900;
  host.prepend(canvas);
  const renderer = fakeRenderer(canvas);
  const seen = new Map();
  const observe = (el, on) => {
    seen.set(el, on);
    return () => seen.delete(el);
  };
  const gfx = { renderer, canvas, ratio: 1 };
  renderer.getPixelRatio = () => gfx.ratio;
  const views = createViews(gfx, { observe });
  const box = (px) => {
    const stage = node('stage');
    page.appendChild(stage);
    const el = surface(stage);
    return { stage, el, show: (n = px) => seen.get(el)?.(n) };
  };
  return { page, host, canvas, renderer, views, box, gfx };
};

describe('createViews', () => {
  it('parks the canvas, unseen, in the world’s host until a view leads', () => {
    const { host, canvas } = setup();
    expect(canvas.parentNode).toBe(host);
    expect(canvas.style.visibility).toBe('hidden');
  });

  it('draws a view that isn’t leading in the corner and copies it onto its own canvas', () => {
    const { views, box, renderer, canvas } = setup();
    const a = box(1000);
    const view = views.add(a.el, { ratio: 1 });
    view.resize(400, 200);
    views.frame();
    const fn = vi.fn();
    view.draw(fn);
    expect(fn).toHaveBeenCalledOnce();
    // (its corner: 400 × 200 of the 1440 × 900 buffer, read from the bottom)
    expect(renderer.log).toContainEqual(['viewport', 400, 200]);
    expect(a.el.width).toBe(400);
    expect(a.el.drawn).toContainEqual(['copy', 0, canvas.height - 200, 400, 200, 0, 0, 400, 200]);
  });

  it('moves the canvas under the view that drew the most of the screen, dressed as it and clipped to its size', () => {
    const { views, box, canvas } = setup();
    const a = box();
    const b = box();
    const va = views.add(a.el);
    const vb = views.add(b.el);
    a.el.setAttribute('data-on', '');
    va.resize(400, 200);
    vb.resize(300, 100);
    a.show(80000);
    b.show(30000);
    views.frame();
    va.draw(() => {});
    vb.draw(() => {});
    views.frame();
    expect(views.lead).toBe(va);
    expect(canvas.parentNode).toBe(a.stage);
    expect(canvas.nextSibling).toBe(a.el);
    expect(canvas.className).toBe('shire-canvas');
    expect(canvas.hasAttribute('data-on')).toBe(true);
    expect(canvas.style.clipPath).toBe('inset(700px 1040px 0px 0px)');
    expect(canvas.style.top).toBe(`${200 - 900}px`);
    // (the lead draws straight on the canvas: nothing copied)
    a.el.drawn.length = 0;
    va.draw(() => {});
    expect(a.el.drawn.filter((d) => d[0] === 'copy')).toHaveLength(0);
  });

  it('draws the lead again at the frame’s end when another view drew over it after', () => {
    const { views, box } = setup();
    const a = box();
    const b = box();
    const va = views.add(a.el);
    const vb = views.add(b.el);
    va.resize(400, 200);
    vb.resize(300, 100);
    a.show(80000);
    b.show(100);
    const lead = vi.fn();
    views.frame();
    va.draw(lead);
    views.frame();
    expect(views.lead).toBe(va);
    lead.mockClear();
    // (the lead's frame not drawn this time; the other's was)
    vb.draw(() => {});
    views.flush();
    expect(lead).toHaveBeenCalledOnce();
  });

  it('keeps a view’s last frame on its own canvas when the lead leaves it', () => {
    const { views, box } = setup();
    const a = box();
    const b = box();
    const va = views.add(a.el);
    const vb = views.add(b.el);
    va.resize(400, 200);
    vb.resize(300, 100);
    a.show(80000);
    views.frame();
    const last = vi.fn();
    va.draw(last);
    views.frame();
    expect(views.lead).toBe(va);
    last.mockClear();
    a.show(0);
    b.show(9000);
    vb.draw(() => {});
    views.frame();
    expect(views.lead).toBe(vb);
    expect(last).toHaveBeenCalledOnce();
    expect(a.el.drawn.at(-1)[0]).toBe('copy');
  });

  it('gives each view its own renderer state, read back when another enters', () => {
    const { views, box, renderer } = setup();
    const a = box();
    const b = box();
    const va = views.add(a.el, { state: { toneMapping: 7, toneMappingExposure: 1.15 } });
    // (what its maker sets next is its own)
    renderer.info.autoReset = false;
    views.add(b.el, { state: { toneMapping: 4 } });
    expect(renderer.toneMapping).toBe(4);
    expect(renderer.info.autoReset).toBe(true);
    views.enter(a.el);
    expect(renderer.toneMapping).toBe(7);
    expect(renderer.toneMappingExposure).toBe(1.15);
    expect(renderer.info.autoReset).toBe(false);
    // (an exposure set in its update, before it draws, is drawn with)
    renderer.toneMappingExposure = 1.4;
    views.enter(b.el);
    let seen = null;
    va.resize(10, 10);
    va.draw(() => {
      seen = renderer.toneMappingExposure;
    });
    expect(seen).toBe(1.4);
  });

  it('says the view’s size from getDrawingBufferSize while it draws, the canvas’s after', () => {
    const { views, box, renderer } = setup();
    const a = box();
    const va = views.add(a.el, { ratio: 1 });
    va.resize(320, 180);
    const v = { set(x, y) { this.x = x; this.y = y; return this; } };
    va.draw(() => renderer.getDrawingBufferSize(v));
    expect([v.x, v.y]).toEqual([320, 180]);
    renderer.getDrawingBufferSize(v);
    expect([v.x, v.y]).toEqual([1440, 900]);
  });

  it('draws a view at its own ratio, never past the gfx’s nor the buffer', () => {
    const { views, box, gfx } = setup();
    gfx.ratio = 1.5;
    const a = box();
    const va = views.add(a.el, { ratio: 1.75 });
    va.resize(400, 200);
    expect(va.ratio).toBe(1.5);
    va.setRatio(1);
    expect(va.buffer).toEqual([400, 200]);
    // (a box wider than the buffer is drawn softer, inside it)
    va.setRatio(1.5);
    va.resize(2000, 200);
    expect(va.buffer[0]).toBeLessThanOrEqual(1440);
  });

  it('keeps the lead on the view drawing most lately: one drawn every other frame doesn’t take it in turns', () => {
    const { views, box } = setup();
    const town = box();
    const map = box();
    const vt = views.add(town.el);
    const vm = views.add(map.el);
    vt.resize(1440, 700);
    vm.resize(1440, 900);
    town.show(1440 * 700);
    map.show(1440 * 900);
    const leads = [];
    for (let i = 0; i < 40; i++) {
      views.frame();
      vt.draw(() => {});
      if (i % 3 === 0) vm.draw(() => {});
      views.flush();
      leads.push(views.lead);
    }
    expect(leads.slice(5).every((l) => l === vt)).toBe(true);
    // (the town stops drawing: the map, drawing on, takes it)
    for (let i = 0; i < 40; i++) {
      views.frame();
      vm.draw(() => {});
    }
    expect(views.lead).toBe(vm);
  });

  it('sizes the buffer so the lead’s box comes out in whole CSS pixels, with room for every view', () => {
    const { views, box, renderer, canvas, gfx } = setup();
    gfx.ratio = 1.25;
    gfx.size = { w: 1440, h: 900 };
    renderer.setDrawingBufferSize = (w, h, r) => {
      canvas.width = Math.floor(w * r);
      canvas.height = Math.floor(h * r);
    };
    canvas.width = 1800;
    canvas.height = 1125;
    const town = box();
    const vt = views.add(town.el, { ratio: 1.25 });
    vt.resize(1440, 738);
    town.show(1440 * 738);
    views.frame();
    vt.draw(() => {});
    views.frame();
    expect(views.lead).toBe(vt);
    // (922 rows for 738 pixels: a multiple of 461 rows, at least the window's 1,125)
    expect(vt.buffer).toEqual([1800, 922]);
    expect([canvas.width, canvas.height]).toEqual([1800, 1383]);
    expect(canvas.style.height).toBe('1107px');
    expect(canvas.style.top).toBe(`${738 - 1107}px`);
  });

  it('draws a new lead that didn’t draw this frame over the old lead’s frame left in the corner', () => {
    const { views, box } = setup();
    const a = box();
    const b = box();
    const va = views.add(a.el);
    const vb = views.add(b.el);
    va.resize(400, 200);
    vb.resize(400, 200);
    a.show(80000);
    b.show(1000);
    const aLast = vi.fn();
    const bLast = vi.fn();
    for (let i = 0; i < 3; i++) {
      views.frame();
      va.draw(aLast);
      vb.draw(bLast);
      views.flush();
    }
    expect(views.lead).toBe(va);
    // (a goes off screen; b, idle this frame, takes the canvas)
    a.show(0);
    bLast.mockClear();
    views.frame();
    expect(views.lead).toBe(vb);
    views.flush();
    expect(bLast).toHaveBeenCalledOnce();
  });

  it('lets an idle lead go after a while, its last frame kept on its own canvas', () => {
    const { views, box, canvas, host } = setup();
    const a = box();
    const va = views.add(a.el);
    va.resize(400, 200);
    a.show(80000);
    const last = vi.fn();
    views.frame();
    va.draw(last);
    views.frame();
    expect(views.lead).toBe(va);
    last.mockClear();
    for (let i = 0; i < 40; i++) views.frame();
    expect(views.lead).toBe(null);
    expect(last).toHaveBeenCalledOnce();
    expect(a.el.drawn.at(-1)[0]).toBe('copy');
    expect(canvas.parentNode).toBe(host);
  });

  it('puts the runtime’s state back and the canvas in its host when let go', () => {
    const { views, box, renderer, canvas, host } = setup();
    const before = readState(renderer);
    const a = box();
    const va = views.add(a.el, { state: { toneMapping: 7 } });
    va.resize(400, 200);
    a.show(5000);
    views.frame();
    va.draw(() => {});
    views.frame();
    expect(canvas.parentNode).toBe(a.stage);
    views.dispose();
    expect(canvas.parentNode).toBe(host);
    expect(renderer.toneMapping).toBe(before.toneMapping);
  });
});
