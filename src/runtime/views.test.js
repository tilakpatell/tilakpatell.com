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
    expect(canvas.style.display).toBe('none');
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

  it('clears with no tone map and in the working colour space, then gives the view its own', () => {
    const { views, box, renderer } = setup();
    const a = box(1000);
    const view = views.add(a.el, { ratio: 1, state: { toneMapping: 7, outputColorSpace: 'srgb' } });
    view.resize(400, 200);
    views.frame();
    const atClear = [];
    const clear = renderer.clear;
    renderer.clear = (...args) => (atClear.push([renderer.toneMapping, renderer.outputColorSpace]), clear(...args));
    const during = [];
    view.draw(() => during.push([renderer.toneMapping, renderer.outputColorSpace]));
    expect(atClear[0]).toEqual([0, 'srgb-linear']);
    expect(during[0]).toEqual([7, 'srgb']);
  });

  it('gives each view its own of the node renderer’s targets for the canvas, so its tone map’s quad is its own', () => {
    const { views, box, renderer } = setup();
    renderer._canvasTarget = { canvas: true };
    renderer._frameBufferTargets = new Map();
    const shared = { name: 'shared', dispose: vi.fn() };
    renderer._frameBufferTargets.set(renderer._canvasTarget, shared);
    const a = box(1000);
    const b = box(800);
    const va = views.add(a.el, { ratio: 1 });
    const vb = views.add(b.el, { ratio: 1 });
    va.resize(400, 200);
    vb.resize(300, 100);
    views.frame();
    // (three makes one when there is none for the canvas, and keeps it there)
    const made = [];
    const drawing = (name) => () => {
      const map = renderer._frameBufferTargets;
      if (!map.get(renderer._canvasTarget)) map.set(renderer._canvasTarget, { name, dispose: vi.fn() });
      made.push(map.get(renderer._canvasTarget).name);
    };
    va.draw(drawing('a'));
    vb.draw(drawing('b'));
    views.flush();
    views.frame();
    va.draw(drawing('a again'));
    views.flush();
    // (the next frame, the first view's own again)
    expect(made.slice(0, 2)).toEqual(['a', 'b']);
    expect(made).toContain('a');
    expect(made).not.toContain('a again');
    expect(made).not.toContain('shared');
    expect(renderer._frameBufferTargets.get(renderer._canvasTarget)).toBe(shared);
  });

  it('moves the canvas under the view that drew the biggest buffer, dressed as it and clipped to its size', () => {
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

  it('gives the canvas to the view whose copy would cost the most: its buffer, not its share of the screen', () => {
    const { views, box, gfx } = setup();
    gfx.ratio = 2;
    const a = box();
    const b = box();
    const va = views.add(a.el, { ratio: 1 });
    const vb = views.add(b.el, { ratio: 2 });
    va.resize(400, 200);
    vb.resize(300, 100);
    // (a shows more of the screen; b's buffer is the bigger, 600 × 200)
    a.show(80000);
    b.show(30000);
    for (let i = 0; i < 3; i++) {
      views.frame();
      va.draw(() => {});
      vb.draw(() => {});
      views.flush();
    }
    expect(views.lead).toBe(vb);
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

  it('makes the buffer the lead’s own size, and grows it, the lead’s box in whole CSS pixels, only while a bigger view draws', () => {
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
    const map = box();
    const vt = views.add(town.el, { ratio: 1.25 });
    const vm = views.add(map.el, { ratio: 1.25 });
    vt.resize(1440, 738);
    vm.resize(1440, 900);
    town.show(1440 * 738);
    map.show(1);
    views.frame();
    vt.draw(() => {});
    views.flush();
    views.frame();
    expect(views.lead).toBe(vt);
    // (alone: its own 922 rows, as its own canvas had)
    expect(vt.buffer).toEqual([1800, 922]);
    expect([canvas.width, canvas.height]).toEqual([1800, 922]);
    // (laid out by the page's CSS, as its own canvas was: nothing sized by hand)
    expect(canvas.style.height).toBe('');
    expect(canvas.style.clipPath).toBe('');
    // (the map drawing too: room for its 1,125 rows, a multiple of 461 for the town's box)
    vt.draw(() => {});
    vm.draw(() => {});
    views.flush();
    views.frame();
    expect(views.lead).toBe(vt);
    expect([canvas.width, canvas.height]).toEqual([1800, 1383]);
    expect(canvas.style.height).toBe('1107px');
    expect(canvas.style.top).toBe(`${738 - 1107}px`);
    // (the map stopped: back to the town's own once it's been idle a while)
    for (let i = 0; i < 40; i++) {
      vt.draw(() => {});
      views.flush();
      views.frame();
    }
    expect([canvas.width, canvas.height]).toEqual([1800, 922]);
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

  it('leaves a view off screen undrawn after its first frame, the buffer kept to the lead’s own', () => {
    const { views, box } = setup();
    const a = box();
    const b = box();
    const va = views.add(a.el);
    const vb = views.add(b.el);
    va.resize(400, 200);
    vb.resize(400, 200);
    a.show(80000);
    b.show(0);
    const first = vi.fn();
    views.frame();
    vb.draw(first);
    expect(first).toHaveBeenCalledOnce();
    const later = vi.fn();
    views.frame();
    vb.draw(later);
    expect(later).not.toHaveBeenCalled();
    // (on screen again: drawn)
    b.show(100);
    views.frame();
    vb.draw(later);
    expect(later).toHaveBeenCalledOnce();
  });

  it('makes an opaque view’s alpha one after it draws, the GL state handed back through three’s, never asked of GL', () => {
    const { views, box, renderer } = setup();
    const calls = [];
    let mask = [true, true, true, true];
    let glClear = [0.1, 0.2, 0.3, 0];
    let scissor = true;
    renderer.getContext = () => ({
      COLOR_BUFFER_BIT: 4,
      // (a query waits on the graphics chip to finish all it was given: never)
      getParameter: () => {
        throw new Error('asked GL');
      },
      isEnabled: () => {
        throw new Error('asked GL');
      },
      colorMask: (...m) => {
        mask = m;
      },
      clearColor: (...c) => {
        glClear = c;
      },
      clear: (b) => calls.push(['clear', b, scissor, ...mask, ...glClear]),
    });
    renderer.getScissorTest = () => true;
    renderer.state = {
      setScissorTest: (on) => (scissor = on),
      buffers: {
        color: {
          reset: () => calls.push('reset'),
          setMask: (on) => (mask = [on, on, on, on]),
        },
      },
    };
    renderer.setClearColor(0x336699, 0.5);
    renderer.setClearColor = (c, a) => {
      glClear = [c.r, c.g, c.b, a];
    };
    const a = box();
    const b = box();
    const va = views.add(a.el, { opaque: true });
    const vb = views.add(b.el);
    va.resize(100, 100);
    vb.resize(100, 100);
    calls.length = 0;
    va.draw(() => {});
    // (alpha alone, cleared to one, the scissor off)
    expect(calls).toContainEqual(['clear', 4, false, false, false, false, true, 0, 0, 0, 1]);
    // (then three's state: its cache forgotten, the mask, the clear colour and the scissor its own again)
    expect(calls).toContain('reset');
    expect(mask).toEqual([true, true, true, true]);
    expect(glClear).toEqual([0x33 / 255, 0x66 / 255, 0x99 / 255, 0.5]);
    expect(scissor).toBe(true);
    calls.length = 0;
    vb.draw(() => {});
    expect(calls).toEqual([]);
  });

  it('draws a frame outside a frame onto the view’s own canvas, the lead drawn again at once', () => {
    const { views, box } = setup();
    const a = box();
    const b = box();
    const va = views.add(a.el);
    const vb = views.add(b.el);
    va.resize(400, 200);
    vb.resize(300, 100);
    a.show(80000);
    const lead = vi.fn();
    views.frame();
    va.draw(lead);
    views.flush();
    views.frame();
    expect(views.lead).toBe(va);
    lead.mockClear();
    const warm = vi.fn();
    vb.drawNow(warm);
    expect(warm).toHaveBeenCalledOnce();
    expect(b.el.drawn.at(-1)[0]).toBe('copy');
    expect(lead).toHaveBeenCalledOnce();
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
