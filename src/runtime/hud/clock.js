// A HUD part's clock for something drawn a few times a second (a minimap
// at 10): the draw in an animation frame, so it lands with the page's
// paint, and the wait between draws on a timer, so the page is woken its
// rate a second rather than on every display beat. A requestAnimationFrame
// chain that skipped the beats in between was a second loop beside the
// world's, woken 60 to 144 times a second to draw 10 (the every-world
// hand-off's performance item 4).
//
// paced(hz, draw, { setTimeout, clearTimeout, raf, caf }) → stop()
//   draw(now) at once (in the next frame), then every 1000 / hz ms or so

export function paced(hz, draw, { setTimeout: wait = globalThis.setTimeout?.bind(globalThis), clearTimeout: unwait = globalThis.clearTimeout?.bind(globalThis), raf = globalThis.requestAnimationFrame?.bind(globalThis), caf = globalThis.cancelAnimationFrame?.bind(globalThis) } = {}) {
  let timer = 0;
  let frame = 0;
  let live = true;
  const step = (now) => {
    frame = 0;
    if (!live) return;
    timer = wait(ask, 1000 / hz);
    draw(now);
  };
  function ask() {
    timer = 0;
    if (live) frame = raf(step);
  }
  ask();
  return () => {
    live = false;
    if (timer) unwait(timer);
    if (frame) caf(frame);
    timer = frame = 0;
  };
}
