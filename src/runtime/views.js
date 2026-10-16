// One renderer, several places on a page: the runtime's one canvas drawing
// a world whose pictures stand in more than one box (Middle-earth's map
// behind the page, a town's stage, the kitchen below it, the bridge and the
// Ring further down, each in its own section). A WebGL context draws on one
// canvas only, so the boxes take turns at it:
//
// - The lead, the view drawing the most of the screen lately, has the
//   canvas itself: moved in under the view's own canvas (`el`, the one the
//   page laid out and listens on), wearing its classes and data- attributes
//   (so the page's CSS and its data-on fade reach it) and clipped to the
//   view's size. The buffer stays the size of the world's host box at the
//   gfx's ratio; a view draws into its bottom-left corner at its own size
//   and ratio, so a new lead never reallocates the buffer (that waits on the
//   graphics chip, a second or two on Metal when it's busy), and a shader
//   reading gl_FragCoord sees what it saw on a canvas of its own.
// - Any other view that draws this frame draws into the same corner and is
//   copied out, in the same task, onto its own canvas as a 2D picture: what
//   that canvas showed when it had a context of its own.
// - The lead draws last: its draw is held until flush(), at the frame's
//   end, after every other view's (the pictures' own frame work runs in the
//   order it always did, so what they take from Math.random in it, a
//   splash of rain, is what it was); a lead that didn't draw this frame,
//   when another view did or it took the canvas this frame, is drawn again
//   from its last draw, so what the others left in the corner is never
//   shown. (A view's first frame is never the lead's: one that has drawn
//   before leads, so a first frame drawn whole, behind the frame guard's
//   warm-up, is drawn when it's asked.)
// - A view that stops leading keeps its last frame: drawn once more and
//   copied out before the canvas leaves it, as a canvas left alone kept it.
//
// Each view owns the renderer's state while its code runs (enter(el)):
// tone mapping, exposure, the clear colour, shadows, info.autoReset and the
// rest of STATE are read back off the renderer when another view enters and
// put back when it enters again, so a town that sets its exposure each frame
// in its update, before it draws, sets its own. While a view draws, the
// renderer's getDrawingBufferSize says the view's size (a shader sized from
// it is the size it was).
//
// createViews(gfx, { observe }) → { add(el, { ratio, state }) → view,
//   enter(el), of(el), frame(), flush(), resize(), lead, dispose() }
// view: { el, resize(w, h), setRatio(r), draw(fn), size, ratio, buffer,
//   leading, dispose() } (`draw(fn)`: fn draws the view's frame, the
//   renderer set for it; `size`: CSS pixels; `buffer`: its pixels in the
//   corner)
// `observe(el, onPixels) → stop`: how much of a view is on screen, in CSS
// pixels squared (an IntersectionObserver in the browser; the tests pass
// their own).

export const STATE = ['toneMapping', 'toneMappingExposure', 'outputColorSpace', 'autoClear', 'autoClearColor', 'autoClearDepth', 'autoClearStencil', 'sortObjects', 'localClippingEnabled'];

const SCORE = 0.1; // how fast a view's average follows what it drew
const MARGIN = 1.25; // how much more a view must draw to take the lead
const IDLE = 30; // frames a lead may go undrawn before it lets the canvas go
const THRESHOLDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const observeOnScreen = (el, onPixels) => {
  if (typeof IntersectionObserver === 'undefined') {
    onPixels(1);
    return () => {};
  }
  const io = new IntersectionObserver(([e]) => onPixels(e.isIntersecting ? e.intersectionRect.width * e.intersectionRect.height : 0), { threshold: THRESHOLDS });
  io.observe(el);
  return () => io.disconnect();
};

// a colour three's getClearColor can copy into, without three
const rgb = () => ({
  isColor: true,
  r: 0,
  g: 0,
  b: 0,
  copy(c) {
    this.r = c.r;
    this.g = c.g;
    this.b = c.b;
    return this;
  },
});

// what of the renderer a view owns, read off it and put back
export const readState = (r) => {
  const s = {};
  for (const k of STATE) s[k] = r[k];
  s.shadows = { enabled: r.shadowMap?.enabled, type: r.shadowMap?.type };
  s.clear = { color: r.getClearColor ? r.getClearColor(rgb()) : null, alpha: r.getClearAlpha?.() };
  s.infoReset = r.info?.autoReset;
  return s;
};
export const putState = (r, s) => {
  for (const k of STATE) if (s[k] !== undefined) r[k] = s[k];
  if (r.shadowMap && s.shadows) {
    if (s.shadows.enabled !== undefined) r.shadowMap.enabled = s.shadows.enabled;
    if (s.shadows.type !== undefined) r.shadowMap.type = s.shadows.type;
  }
  if (s.clear?.color && r.setClearColor) r.setClearColor(s.clear.color, s.clear.alpha ?? 1);
  if (r.info && s.infoReset !== undefined) r.info.autoReset = s.infoReset;
};

export function createViews(gfx, { observe = observeOnScreen } = {}) {
  const views = new Map(); // el → v
  const { renderer, canvas } = gfx;
  const parking = canvas.parentNode ?? null; // (the world's host: where the canvas waits with no lead)
  const runtimeState = readState(renderer);
  let lead = null;
  let owner = null; // the view whose state is on the renderer
  let held = false; // the lead's draw this frame, run at flush()
  let switched = false; // the lead changed at this frame's start
  let disposed = false;
  const realSize = renderer.getDrawingBufferSize;
  // (the renderer's own: gfx's ratio fitted to what the chip holds at this size)
  const ratioOf = () => renderer.getPixelRatio?.() || gfx.ratio || 1;
  const full = () => renderer.setViewport?.(0, 0, canvas.width / ratioOf(), canvas.height / ratioOf());

  // the canvas parked, unseen, in the world's host
  const park = () => {
    if (parking && canvas.parentNode !== parking) parking.prepend(canvas);
    if (canvas.style) canvas.style.visibility = 'hidden';
  };

  // (the buffer drawn at the view's ratio: its bottom-left corner is the
  // view, scaled to its box on each axis as its own canvas was, stretched:
  // a 922-row picture in a 738-pixel box is 0.80043 to a row, not the
  // ratio's 0.8, which put every row up to half a texel off, and every edge
  // a fringe of a pixel)
  const place = (v) => {
    const { w, h } = v.size;
    const [bw, bh] = v.buffer;
    const st = canvas.style;
    // (out of the flow before anything of the view's place is read: in it,
    // the canvas pushed the view down by its own height)
    st.position = 'absolute';
    st.visibility = '';
    st.pointerEvents = 'none';
    // the buffer is the view's own: the canvas is laid out as its own canvas
    // was, by the page's CSS for it (its classes), however fractional its box
    if (canvas.width === bw && canvas.height === bh) {
      for (const k of ['left', 'top', 'right', 'bottom', 'width', 'height', 'clipPath']) st[k] = '';
      return;
    }
    const sx = w / bw;
    const sy = h / bh;
    const W = canvas.width * sx;
    const H = canvas.height * sy;
    Object.assign(st, {
      left: `${v.el.offsetLeft ?? 0}px`,
      top: `${(v.el.offsetTop ?? 0) + h - H}px`,
      right: 'auto',
      bottom: 'auto',
      width: `${W}px`,
      height: `${H}px`,
      clipPath: `inset(${H - h}px ${W - w}px 0px 0px)`,
    });
  };

  // the canvas dressed as `v`'s own and laid under it
  const dress = (v) => {
    const el = v.el;
    const parent = el.parentNode;
    if (!parent) return;
    if (canvas.parentNode !== parent || canvas.nextSibling !== el) {
      if (canvas.style) canvas.style.position = 'absolute';
      parent.insertBefore(canvas, el);
    }
    canvas.className = el.className ?? '';
    for (const name of canvas.getAttributeNames?.() ?? []) if (name.startsWith('data-') && !el.hasAttribute(name)) canvas.removeAttribute(name);
    for (const name of el.getAttributeNames?.() ?? []) if (name.startsWith('data-')) canvas.setAttribute(name, el.getAttribute(name));
    canvas.setAttribute?.('aria-hidden', 'true'); // (the view's own canvas carries its label)
    place(v);
  };
  const watchAttrs = (v) => {
    if (typeof MutationObserver === 'undefined') return () => {};
    const mo = new MutationObserver(() => {
      if (lead === v) dress(v);
    });
    mo.observe(v.el, { attributes: true });
    return () => mo.disconnect();
  };

  // the renderer's state made `v`'s (the one before it read back first)
  const enter = (v) => {
    if (owner === v || disposed) return;
    if (owner) owner.state = readState(renderer);
    putState(renderer, v.state);
    owner = v;
  };
  // `v`'s corner of the buffer, with the renderer set for it
  const within = (v, fn) => {
    enter(v);
    const mine = readState(renderer);
    renderer.setRenderTarget?.(null);
    renderer.setScissorTest?.(false);
    // (cleared whole, to clear: what's outside the corner is never left
    // from another view's frame, under a filter the page puts on it)
    full();
    renderer.setClearColor?.(0x000000, 0);
    renderer.clear?.(true, true, true);
    putState(renderer, mine);
    const [bw, bh] = v.buffer;
    renderer.setViewport?.(0, 0, bw / ratioOf(), bh / ratioOf());
    renderer.getDrawingBufferSize = (target) => target.set(bw, bh);
    try {
      fn();
    } finally {
      renderer.getDrawingBufferSize = realSize;
      full();
    }
  };
  // what's in the corner, onto the view's own canvas
  const copy = (v) => {
    const [bw, bh] = v.buffer;
    const el = v.el;
    if (el.width !== bw) el.width = bw;
    if (el.height !== bh) el.height = bh;
    const ctx = el.getContext?.('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, bw, bh);
    ctx.drawImage(canvas, 0, canvas.height - bh, bw, bh, 0, 0, bw, bh);
  };
  const blank = (v) => v.el.getContext?.('2d')?.clearRect(0, 0, v.el.width, v.el.height);

  // (the lead: the most of the screen drawn a frame, lately: an average
  // over about ten frames, and a margin to take it from the one that has it,
  // so the map drawn every other frame under a town, or two boxes drawing
  // the same, don't take turns at the canvas)
  // The buffer's size: the lead's own, as its own canvas was, so the
  // compositor shows the same texture the same size (a taller buffer,
  // scaled the same, still came out a level off along a few rows, the GPU's
  // rounding of a texel's place). Only while another view is drawing and
  // needs more room does it grow, to room for every view drawing, with the
  // lead's box still in whole CSS pixels: the compositor puts a canvas on
  // whole pixels, so H × h / bh is whole, H a multiple of bh / gcd(h, bh)
  // (1383 rows for a 738-pixel box drawn at 1.25, 922 rows), and the same
  // for W; it comes back to the lead's size once they've stopped.
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const room = (have, own, box) => {
    const step = own / gcd(box, own);
    return Math.max(own, Math.ceil(have / step) * step);
  };
  const ownBuffer = (v, R) => {
    const r = Math.min(v.want, R);
    return [Math.floor(v.size.w * r), Math.floor(v.size.h * r)];
  };
  const wanted = () => {
    const R = gfx.ratio || ratioOf();
    let W = lead ? 0 : canvas.width;
    let H = lead ? 0 : canvas.height;
    for (const v of views.values()) {
      if (v !== lead && v.idle >= IDLE) continue;
      const [w, h] = ownBuffer(v, R);
      W = Math.max(W, w);
      H = Math.max(H, h);
    }
    if (!lead) return [W, H];
    const [bw, bh] = ownBuffer(lead, R);
    if (W === bw && H === bh) return [bw, bh];
    return [room(W, bw, lead.size.w), room(H, bh, lead.size.h)];
  };
  // (made once, the next frame it's wanted, before anything is drawn in it:
  // a buffer resized is cleared)
  // (no more than the chip holds: past it, the views draw softer inside it)
  const most = () => renderer.capabilities?.maxRenderbufferSize ?? renderer.capabilities?.maxTextureSize ?? Infinity;
  const fitBuffer = () => {
    if (!renderer.setDrawingBufferSize) return;
    const side = most();
    const [W, H] = wanted().map((n) => Math.min(n, side));
    if (canvas.width === W && canvas.height === H) return;
    const R = ratioOf();
    renderer.setDrawingBufferSize((W + 0.5) / R, (H + 0.5) / R, R);
    for (const v of views.values()) v.fit();
    if (lead) {
      place(lead);
      // (a buffer made again is cleared: the lead drawn in it this frame)
      switched = true;
    }
  };

  const pick = () => {
    for (const v of views.values()) {
      v.score += ((v.drew ? v.pixels : 0) - v.score) * SCORE;
      v.idle = v.drew ? 0 : v.idle + 1;
    }
    // (a lead that has stopped drawing lets go after a while, its last frame
    // kept on its own canvas: else every other view's frame drew it again)
    let best = lead && views.get(lead.el) === lead && lead.pixels > 0 && lead.idle < IDLE ? lead : null;
    for (const v of views.values()) {
      if (v === best || !(v.score > 0) || !(v.pixels > 0) || v.idle >= IDLE) continue;
      if (!best || v.score > best.score * (best === lead ? MARGIN : 1)) best = v;
    }
    return best;
  };
  const setLead = (next) => {
    if (next === lead) return;
    const was = lead;
    // (its last frame kept on its own canvas, as a canvas let be kept it)
    if (was && views.get(was.el) === was && was.last) {
      within(was, was.last);
      copy(was);
    }
    lead = next;
    // (the corner holds the old lead's frame now: the new one is drawn at
    // the frame's end unless it draws in it)
    switched = Boolean(lead);
    if (lead) {
      blank(lead);
      dress(lead);
    } else park();
  };

  const api = {
    get lead() {
      return lead?.view ?? null;
    },
    of: (el) => views.get(el)?.view ?? null,
    enter(el) {
      const v = views.get(el);
      if (v) enter(v);
    },
    add(el, { ratio = 1, state = {} } = {}) {
      views.get(el)?.view.dispose();
      const v = {
        el,
        size: { w: 1, h: 1 },
        want: ratio,
        ratio: 1,
        state: { ...runtimeState, ...state },
        pixels: 0,
        score: 0,
        idle: IDLE, // (frames since it last drew: not yet)
        drew: false,
        last: null,
      };
      // (its pixels: its size at its ratio, inside the buffer)
      // (its sharpest, unless its pixels at that wouldn't fit in the buffer:
      // then as sharp as fits, until the buffer grows for it)
      const fit = () => {
        const r = Math.min(v.want, ratioOf());
        const fits = Math.floor(v.size.w * r) <= canvas.width && Math.floor(v.size.h * r) <= canvas.height;
        v.ratio = Math.max(0.01, fits ? r : Math.min(r, canvas.width / v.size.w, canvas.height / v.size.h));
      };
      v.fit = fit;
      Object.defineProperty(v, 'buffer', { get: () => [Math.floor(v.size.w * v.ratio), Math.floor(v.size.h * v.ratio)] });
      const stopObserving = observe(el, (px) => {
        v.pixels = px;
      });
      const stopAttrs = watchAttrs(v);
      const view = {
        el,
        get size() {
          return v.size;
        },
        get ratio() {
          return v.ratio;
        },
        get buffer() {
          return v.buffer;
        },
        get leading() {
          return lead === v;
        },
        resize(w, h) {
          v.size = { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
          fit();
          if (lead === v) place(v);
        },
        setRatio(r) {
          v.want = r;
          fit();
          if (lead === v) place(v);
        },
        draw(fn) {
          if (disposed || views.get(el) !== v) return;
          fit();
          v.drew = true;
          v.last = fn;
          if (lead === v) {
            held = true;
            return;
          }
          within(v, fn);
          copy(v);
        },
        dispose() {
          stopObserving();
          stopAttrs();
          if (views.get(el) === v) views.delete(el);
          if (owner === v) owner = null;
          if (lead === v) {
            lead = null;
            park();
          }
        },
      };
      v.view = view;
      fit();
      views.set(el, v);
      enter(v); // (what the view's maker sets on the renderer next is its own)
      return view;
    },
    // the buffer's new size (the world's host resized): each view fitted again
    resize() {
      fitBuffer();
      for (const v of views.values()) v.fit();
      if (lead) place(lead);
    },
    // a frame begins: the lead is the view that drew the most of the screen
    // last frame (or still holds it)
    frame() {
      switched = false;
      setLead(pick());
      fitBuffer();
      // (laid out again since: what's above it may have moved)
      if (lead && !switched) {
        if (canvas.parentNode !== lead.el.parentNode || canvas.nextSibling !== lead.el) dress(lead);
        else place(lead);
      }
      for (const v of views.values()) v.drew = false;
      held = false;
    },
    // the frame's end: the lead drawn again if another view drew over it, or
    // if it took the canvas this frame and didn't draw in it
    flush() {
      // (another view drew this frame, so the corner holds its picture, or
      // the lead's own draw is held, or it took the canvas this frame)
      const others = [...views.values()].some((v) => v !== lead && v.drew);
      if (lead?.last && (held || others || switched)) within(lead, lead.last);
      held = false;
      switched = false;
    },
    dispose() {
      if (disposed) return;
      for (const v of [...views.values()]) v.view.dispose();
      disposed = true;
      putState(renderer, runtimeState);
      canvas.removeAttribute?.('style');
      canvas.removeAttribute?.('aria-hidden');
      if (parking && canvas.parentNode !== parking) parking.prepend(canvas);
    },
  };
  park();
  return api;
}
