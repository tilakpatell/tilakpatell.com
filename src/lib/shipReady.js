// Whether the ship you fly is whole on the universe map: its own model
// mounted over the stand-in, its pictures sent and its shaders made
// (universe/scene.js's setShip says so). The cockpit's launch holds its white
// on it (cockpit/scene.js), a while at most, so the map comes out of the
// flash with the cruiser and its crew on it, not a stand-in that turns into
// them a moment later. Pure: no DOM, no three.js; cockpit and map meet here
// as they do in lib/arrival and lib/foreground.
//
// shipPending(kind)   the map has `kind` coming (null: no ship)
// shipMounted(kind)   it's whole (or as whole as it will be: no model to load)
// forgetShip()        the map's gone
// whenShipReady(kind, ms) → Promise<boolean>: true once `kind` is whole on
//   the map, at once with no map that has a ship coming; false after `ms`

let current = null; // { kind, whole }, or null with no map
const waiting = new Set();

const wake = () => {
  for (const w of [...waiting]) w();
};

export function shipPending(kind) {
  current = { kind, whole: false };
  wake();
}

export function shipMounted(kind) {
  if (current?.kind !== kind) return; // (a ship the map has since given up)
  current.whole = true;
  wake();
}

export function forgetShip() {
  current = null;
  wake();
}

export function whenShipReady(kind, ms) {
  const done = () => !current || (current.kind === kind && current.whole);
  if (done()) return Promise.resolve(true);
  return new Promise((resolve) => {
    let timer = null;
    const check = () => {
      if (!done()) return;
      waiting.delete(check);
      clearTimeout(timer);
      resolve(true);
    };
    timer = setTimeout(() => {
      waiting.delete(check);
      resolve(done());
    }, ms);
    waiting.add(check);
  });
}
