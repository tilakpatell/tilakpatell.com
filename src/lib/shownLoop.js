// A frame loop that runs only while its element is on screen and the tab
// is showing: a small canvas drawn every frame beside the world's own (the
// portal swirl, the hangar's ship, the wardrobe's figure, the Collection's
// hero) was a draw, and a GL context's work, on every display beat, scrolled
// away or not, and the rAF chain kept the page's main thread waking for it
// (the performance lanes' P8, docs/superpowers/HANDOFF-performance-lanes.md).
// Out of view, no frame is asked for at all, rather than one asked for and
// skipped; back in view, the loop starts again (each caller clamps its dt,
// so the gap is never a jump).
//
// shownLoop(el, frame, { IO, doc, raf, caf, onShown }) → { stop(), running }
//   frame(now) on every frame while shown; onShown(shown) on each change
//   (a caller that draws once on change, under reduced motion, hears it there)
//   IO, doc, raf and caf are the browser's unless given (the test gives its own)

export function shownLoop(el, frame, { IO = globalThis.IntersectionObserver, doc = globalThis.document, raf = globalThis.requestAnimationFrame?.bind(globalThis), caf = globalThis.cancelAnimationFrame?.bind(globalThis), onShown = null } = {}) {
  // (in view until the observer says not: its first word comes a frame on,
  // and where there is none the tab's showing is all there is to go on)
  let inView = true;
  let live = true;
  let id = 0;
  let was = true;
  const shown = () => live && inView && !doc?.hidden;
  const tick = (now) => {
    id = raf(tick);
    frame(now);
  };
  const sync = () => {
    const now = shown();
    if (now && !id) id = raf(tick);
    else if (!now && id) {
      caf(id);
      id = 0;
    }
    if (now !== was && live) {
      was = now;
      onShown?.(now);
    }
  };
  const io = IO
    ? new IO((entries) => {
        inView = entries[entries.length - 1].isIntersecting;
        sync();
      })
    : null;
  io?.observe(el);
  doc?.addEventListener?.('visibilitychange', sync);
  sync();
  return {
    stop() {
      live = false;
      sync();
      io?.disconnect();
      doc?.removeEventListener?.('visibilitychange', sync);
    },
    get running() {
      return id !== 0;
    },
  };
}
