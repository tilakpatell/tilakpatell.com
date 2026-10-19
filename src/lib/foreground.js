// A scene in front of the page that wants the graphics chip to itself for a
// while: the cockpit, over the universe map on a first visit. Two strengths:
//
//   'drawing'   it's up and drawing; what's made behind it may go on a
//               slice at a time, but a measurement taken now is not the
//               chip's alone (the map's calibration: universe/scene.js)
//   'launch'    its launch is playing, the moment that must not drop a
//               frame; what's made behind it waits until it's over
//               (universe/prepFrame.js)
//
// The map under the cockpit draws nothing (html[data-covered]), but its
// prepare uploads, links and draws on the same chip, and every WebGL context
// on a page shares the browser's one graphics process: a big texture or a
// shader link behind the launch is a held frame in it.
//
// inFront(strength) → release()     (several may be held; each releases once)
// foreground() → 'launch' | 'drawing' | null
// whenClear(strength = 'launch') → Promise, kept once nothing that strong is held

const RANK = { drawing: 1, launch: 2 };
const held = new Map(); // a hold → its strength
const waiting = []; // [rank, resolve]

const top = () => {
  let r = 0;
  for (const s of held.values()) r = Math.max(r, RANK[s] ?? 0);
  return r;
};

const wake = () => {
  const r = top();
  for (let i = waiting.length - 1; i >= 0; i--) {
    if (r >= waiting[i][0]) continue;
    const [, resolve] = waiting[i];
    waiting.splice(i, 1);
    resolve();
  }
};

export function inFront(strength = 'drawing') {
  const hold = {};
  held.set(hold, RANK[strength] ? strength : 'drawing');
  return () => {
    if (!held.delete(hold)) return;
    wake();
  };
}

export function foreground() {
  const r = top();
  return r >= RANK.launch ? 'launch' : r >= RANK.drawing ? 'drawing' : null;
}

export function whenClear(strength = 'launch') {
  const rank = RANK[strength] ?? RANK.launch;
  if (top() < rank) return Promise.resolve();
  return new Promise((resolve) => waiting.push([rank, resolve]));
}
