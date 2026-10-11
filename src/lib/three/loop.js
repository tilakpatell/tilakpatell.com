// One chain of animation frames, however often it's asked for.
//
// A scene asks for frames (kick) from anywhere, including from inside a frame
// it's drawing: a shot fired with the trigger held, a part easing in. A kick
// then must not start a second chain beside the one that's drawing (each
// would draw the whole scene again, every frame, from then on: hold the
// trigger for a few seconds and a dozen chains are drawing the same frame).
// So a kick while drawing is only noted, and the frame that's drawing asks
// for its next one once, whatever it returns.
//
// A cadence (GPU-first lane N2): `cadence: 2` steps on every second display
// beat exactly, the beats between asked for and let go by, so a visitor
// who pins 30 on a 60 Hz screen gets frames 33.3 ms apart every time, not
// a free-running loop that lands on 16.7 one frame and 50 the next. A kick
// from rest draws on its first beat; `setCadence(n)` takes from the next.
//
// createLoop(step, { raf, caf, can, cadence }) → { kick(), stop(), running,
//   cadence, setCadence(n) }
// step(now) → true for another frame; can() → whether a frame may be asked for.

export function createLoop(step, { raf = (f) => requestAnimationFrame(f), caf = (id) => cancelAnimationFrame(id), can = () => true, cadence: every = 1 } = {}) {
  let id = 0;
  let drawing = false;
  let again = false;
  const whole = (n) => (Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1);
  let cadence = whole(every);
  let wait = 0; // beats to let go by before the next step
  const frame = (now) => {
    id = 0;
    if (wait > 0) {
      wait -= 1;
      if (can()) id = raf(frame);
      return;
    }
    wait = cadence - 1;
    drawing = true;
    again = false;
    let more = false;
    try {
      more = step(now);
    } finally {
      drawing = false;
    }
    if ((more || again) && !id && can()) id = raf(frame);
    again = false;
  };
  return {
    kick() {
      if (drawing) again = true;
      else if (!id && can()) {
        wait = 0;
        id = raf(frame);
      }
    },
    get cadence() {
      return cadence;
    },
    setCadence(n) {
      cadence = whole(n);
      wait = Math.min(wait, cadence - 1);
    },
    stop() {
      if (id) caf(id);
      id = 0;
      again = false;
    },
    get running() {
      return id !== 0 || drawing;
    },
  };
}
