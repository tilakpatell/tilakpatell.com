import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { use3D } from '../../lib/gpu';
import { settle } from '../../lib/settle';
import { prefersReducedMotion } from '../../lib/hooks';
import { opened } from './opening';
import { SHEET } from './mapData';
import { framing } from './mapFraming';
import { FLIGHT_MS, TITLE } from './mapFlight.js';
import { waitOf } from './mapCover.js';
import { mapFont, paintMap } from './mapPaint.js';
import '../../styles/lazy/middleearth.css';

// The map of Middle-earth behind the whole page. The painted sheet is drawn
// flat from the first frame, on every device, and pans and zooms. With a
// graphics chip the WebGL map (./MapBackdrop3D.js), the sheet on a table and
// a camera gliding over it, fades in over the flat one once its first frame
// is drawn, and takes over from it. On the hub (`spot` null) it shows the
// whole sheet and leans towards the pointer; with a `spot` ([x, y] on the
// sheet) it flies down to it and stays there, close, behind the chapter.
//
// `opening` is the films' beginning: the map alone, with the title over it,
// before the page comes in; in WebGL the camera flies down the road while it
// lasts (./mapFlight.js). Any key, click, tap or scroll ends it early.
// `api` is a ref the hub keeps, to ask where places are on the screen
// (`api.current.project(x, y)`): it is the flat sheet’s until the WebGL one
// shows, then the WebGL one’s. `onFrame` is called after every frame drawn,
// so the hub can move its markers with the camera. `covers` is a selector for
// what the page lays opaque over the map, across its width (a chapter's town
// on its stage): while it hides most of the screen, the WebGL map is drawn
// less often (./mapCover.js).

// how long the opening holds, without a flight, for someone who has asked
// for less motion (without a graphics chip it lasts the title’s time)
const HOLD_STILL = 1500;

// what the page asks the map to show, for either of them
const viewOf = (s, lean) => ({ at: s.spot, zoom: s.zoom, hover: s.hover, mordor: s.mordor, dark: s.dark, alive: s.hub, lean: s.hub ? lean : [0, 0] });

// The flat sheet: drawn into the canvas at a scale and offset that ease
// towards where they should be.
function createFlat(canvas, sheet) {
  const ctx = canvas.getContext('2d');
  let W = 1;
  let H = 1;
  let ratio = 1;
  const cur = { x: SHEET.w / 2, y: SHEET.h / 2, z: 1 };
  const goal = { ...cur };
  const base = { ...cur };
  const user = { x: 0, y: 0, z: 1 };
  let hub = false;
  const apply = () => {
    const z = base.z * (hub ? user.z : 1);
    [goal.x, goal.y] = clampView(base.x + (hub ? user.x : 0), base.y + (hub ? user.y : 0), z);
    goal.z = z;
  };
  let first = true;
  const scale = () => Math.max(W / SHEET.w, H / SHEET.h) * cur.z;
  const draw = () => {
    const s = scale() * ratio;
    const sx = sheet.width / SHEET.w;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a110a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(s / sx, 0, 0, s / sx, (W * ratio) / 2 - cur.x * s, (H * ratio) / 2 - cur.y * s);
    ctx.drawImage(sheet, 0, 0);
  };
  const clampView = (x, y, z) => {
    const s = Math.max(W / SHEET.w, H / SHEET.h) * z;
    const hw = W / s / 2;
    const hh = H / s / 2;
    return [Math.min(SHEET.w - hw, Math.max(hw, x)), Math.min(SHEET.h - hh, Math.max(hh, y))];
  };
  return {
    setView({ at = null, zoom = null, alive = false }) {
      // `zoom` is the 3D camera's height (smaller is closer): turn it round
      base.z = zoom != null ? 2.75 / zoom : at ? 2.6 : 1.08;
      [base.x, base.y] = at || framing().at; // (the hub framed as the 3D map frames it, ./mapFraming.js)
      hub = !at && alive;
      apply();
    },
    // the visitor's hands: drag and zoom (on the map itself only)
    panBy(dx, dy) {
      const s = scale();
      user.x -= dx / s;
      user.y -= dy / s;
      apply();
      // a pan past the edge goes no further
      user.x = goal.x - base.x;
      user.y = goal.y - base.y;
      first = true;
    },
    zoomBy(f) {
      user.z = Math.max(1, Math.min(3.2, user.z / f));
      apply();
      first = true;
    },
    resize(w, h) {
      ratio = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, w);
      H = Math.max(1, h);
      // (a canvas given a size, even its own, is wiped: only when it changes,
      // and then drawn again where it was, live or under the WebGL map)
      const cw = Math.round(W * ratio);
      const ch = Math.round(H * ratio);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        draw();
      }
      first = true;
    },
    project(x, y) {
      const s = scale();
      return { x: W / 2 + (x - cur.x) * s, y: H / 2 + (y - cur.y) * s, on: true };
    },
    unproject(sx, sy) {
      const s = scale();
      return { x: cur.x + (sx - W / 2) / s, y: cur.y + (sy - H / 2) / s };
    },
    render(ms = 16) {
      const k = 1 - Math.exp(-3 * Math.min(0.05, ms / 1000));
      const far = Math.abs(goal.x - cur.x) + Math.abs(goal.y - cur.y) + Math.abs(goal.z - cur.z) * 200;
      if (!first && far < 0.05) return false;
      first = false;
      cur.x += (goal.x - cur.x) * k;
      cur.y += (goal.y - cur.y) * k;
      cur.z += (goal.z - cur.z) * k;
      draw();
      return true;
    },
    // the sheet again, once the page’s font is in to write its names
    repaint(next) {
      sheet = next;
      first = true;
    },
    dispose() {},
    lost: false,
  };
}

// a dev-only way to see the WebGL map in a browser that draws in software
const forced = () => {
  try {
    return import.meta.env.DEV && window.localStorage.getItem('tp-map3d') === 'force';
  } catch {
    return false;
  }
};

export default function MapBackdrop({ spot = null, zoom = null, hover = null, mordor = false, dark = false, hub = false, opening = false, covers = null, onOpened, api: outer, onFrame }) {
  const three = use3D();
  const gl = three.on && (!three.info.software || forced());
  const flatCanvas = useRef(null);
  const glCanvas = useRef(null);
  const api = useRef(null);
  const state = useRef({});
  state.current = { spot, zoom, hover, mordor, dark, hub, opening, covers };
  const lean = useRef([0, 0]);
  const done = useRef(onOpened);
  done.current = onOpened;
  const frame = useRef(onFrame);
  frame.current = onFrame;
  const kick = useRef(() => {});
  // the opening has ended (or been skipped), so the flight is over even
  // before the page says so
  const landed = useRef(false);
  const flatApi = useRef(null); // the painted sheet, drawn flat
  const [painted, setPainted] = useState(false); // the flat sheet is drawn
  const [on, setOn] = useState(false); // the WebGL map has drawn its first frame, and shows

  // The sheet before the first frame is shown, in Georgia if Cinzel isn’t in
  // yet, and again in Cinzel when it is: a page waiting on a font shows
  // nothing. It lives as long as the page does, under the WebGL map too.
  useLayoutEffect(() => {
    const c = flatCanvas.current;
    if (!c) return undefined;
    let dead = false;
    const flat = createFlat(c, paintMap(1024));
    flatApi.current = flat;
    flat.resize(c.clientWidth, c.clientHeight);
    flat.setView(viewOf(state.current, lean.current));
    flat.render(16);
    setPainted(true);
    mapFont().then(() => {
      if (dead) return;
      flat.repaint(paintMap(1024));
      kick.current();
    });
    return () => {
      dead = true;
      flatApi.current = null;
    };
  }, []);

  useEffect(() => {
    let dead = false;
    let raf = 0;
    let last = 0;
    const flat = flatApi.current;
    let deep = null; // the WebGL map, once its shaders are in
    let shown = false; // the WebGL map is over the flat one
    let t0 = 0; // when the opening’s flight began
    let flying = false;
    const still = prefersReducedMotion();
    const both = () => [flat, deep && !deep.lost ? deep : null].filter(Boolean);
    // the one the hub and the page ask: the WebGL map once it shows
    const publish = () => {
      const a = shown ? deep : flat;
      api.current = a;
      if (outer) outer.current = a;
      if (import.meta.env.DEV) window.__ME__ = { ...window.__ME__, map: a }; // for the browser tests
    };
    const size = () => {
      const c = flatCanvas.current;
      if (c) both().forEach((a) => a.resize(c.clientWidth, c.clientHeight));
    };
    const view = () => {
      const v = viewOf(state.current, lean.current);
      both().forEach((a) => a.setView(v));
    };
    // how long the WebGL map may wait between frames, for how much of the
    // screen what the page lays over it hides (only what spans the width)
    const wait = () => {
      const c = flatCanvas.current;
      const page = c?.parentElement?.parentElement;
      if (!page) return 0;
      const spans = [];
      for (const el of page.querySelectorAll(state.current.covers)) {
        const r = el.getBoundingClientRect();
        if (r.left <= 0 && r.right >= c.clientWidth) spans.push([r.top, r.bottom]);
      }
      return waitOf(c.clientHeight, spans);
    };
    // draw while the camera is on its way, then stop until something changes
    const loop = (now) => {
      raf = 0;
      if (dead) return;
      const ms = last ? Math.min(50, now - last) : 16;
      last = now;
      const s = state.current;
      // the flat sheet draws until the WebGL map is over it, and in the frame
      // it comes on too, so the WebGL fades in over the sheet
      let drew = Boolean(flat && !shown && flat.render(ms));
      if (deep && !deep.lost) {
        // the opening flies the WebGL camera down the road, from its first frame
        if (s.opening && !landed.current && !still) {
          t0 = t0 || now;
          deep.flight(now - t0);
          flying = true;
        } else if (flying) {
          deep.flight(null);
          flying = false;
        }
        if (deep.render(ms, s.opening && !flying ? 0.3 : 1, s.covers ? wait : null)) {
          drew = true;
          if (!shown) {
            shown = true;
            publish();
            setOn(true);
          }
        }
      }
      if (drew) {
        frame.current?.();
        if (!raf) raf = requestAnimationFrame(loop); // (unless something in the frame kicked already)
      } else last = 0;
    };
    kick.current = () => {
      view();
      if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const fit = () => {
      size();
      kick.current();
    };
    publish();
    fit();
    // the WebGL map gone (its context lost): the flat sheet takes over again
    const lose = () => {
      shown = false;
      flying = false;
      publish();
      setOn(false);
      fit();
    };
    if (gl) {
      import('./MapBackdrop3D')
        .then(async ({ createMapBackdrop }) => {
          await mapFont();
          // only now, and only if still wanted: a canvas has one context to give
          if (dead || !glCanvas.current) return;
          const a = createMapBackdrop(glCanvas.current, { onLost: () => !dead && lose() });
          // its shaders link in the background (the flat sheet meanwhile),
          // so its first frame doesn't stop the page
          await settle(a.ready);
          if (dead || a.lost) return a.dispose();
          deep = a;
          fit();
        })
        .catch(() => {});
    }
    // anything the visitor does to the map wakes the loop
    const onMove = () => kick.current();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', fit);
    document.addEventListener('visibilitychange', kick.current);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', fit);
      document.removeEventListener('visibilitychange', kick.current);
      deep?.dispose();
      api.current = null;
      if (outer) outer.current = null;
    };
    // `outer` is a ref, the same one throughout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  // somewhere new to go: a place, the hub, Mordor, the dark, the opening ending
  useEffect(() => {
    kick.current();
  }, [spot, zoom, hover, mordor, dark, hub, opening]);

  // The opening is the painted sheet with the title over it from the first
  // frame. The map is up once the WebGL map has drawn its first frame, or
  // without a graphics chip once the flat sheet is: in WebGL the camera then
  // flies down the road and the opening lasts the flight; without a chip it
  // lasts the title’s time.
  const up = gl ? on : painted;
  const still = prefersReducedMotion();
  const hold = still ? HOLD_STILL : gl ? FLIGHT_MS : TITLE.outMs;

  // the opening: on the map, then let the page in
  useEffect(() => {
    if (!opening) return undefined;
    const end = () => {
      landed.current = true;
      api.current?.flight?.(null);
      opened();
      done.current?.();
    };
    // if the map hasn't come up in a moment, don't keep the page waiting for it
    const timer = setTimeout(end, up ? hold : 1800);
    const skip = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    skip.forEach((e) => window.addEventListener(e, end, { passive: true, once: true }));
    return () => {
      clearTimeout(timer);
      skip.forEach((e) => window.removeEventListener(e, end));
    };
  }, [opening, up, hold]);

  return (
    <div className="me-atlas" data-hub={hub || undefined} data-opening={opening || undefined} aria-hidden="true">
      <canvas ref={flatCanvas} data-layer="flat" />
      {gl && <canvas ref={glCanvas} data-layer="gl" data-on={on || undefined} />}
      {opening && (
        <div className="me-atlas-title" style={{ '--me-title-in': `${TITLE.inMs}ms`, '--me-title-out': `${TITLE.outMs}ms` }}>
          <p>The Third Age</p>
          <strong>Middle-earth</strong>
          <span>A map, a road, and a ring</span>
        </div>
      )}
    </div>
  );
}
