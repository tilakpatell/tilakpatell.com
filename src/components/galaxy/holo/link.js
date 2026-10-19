// What the galaxy page and its scene share while the holotable is open (docs/superpowers/specs/2026-10-19-galaxy-
// holotable-design.md), so neither reaches into the other: the page (HoloMap.jsx, HoloStage.jsx) says it's open and
// what the map shows, steers the camera and hands over a label element a system; the scene (./holoScene.js, drawn
// by ../scene.js in the flight's place) eases the camera, draws, puts each label where its system is and says where
// that was on the screen. Made once a page (pages/Galaxy.jsx). Tested.
//
//   link.open                 whether the holotable is up (the page's open(on))
//   link.state                { war, current, pick, hover, lit, layers }: what the map shows (the page's set(patch));
//                             link.version counts its changes
//   link.pose, link.target    where the camera is and where it's going (holoCamera.js poses); aim(pose) moves the
//                             target (eased to), snap(pose) both
//   link.labels               id → the system's label element (the page's label(id, el))
//   link.screen               id → { x, y, on } where the scene last drew it, in the stage's pixels (place())
//   link.size                 { w, h } the stage's
//   link.inset                { top, right, bottom } px of it under the header and the side panel: the scene shifts
//                             its lens so the disc's middle is the free part's (holoCamera.js's lensOf)
//   link.blocks               [{ x0, y0, x1, y1 }] the page's controls over the stage, in its pixels: no name goes
//                             under one, and a dot under one goes unnamed (labelPlace.js's blocks and hideUnder)
//   link.at(x, y, within)     → the id of the system drawn nearest a screen point, within `within` px, or null
//   link.wake                 the scene's: a frame now (it idles when nothing moves)

import { WHOLE } from './holoCamera';

export function createHoloLink() {
  const link = {
    open: false,
    version: 0,
    state: { war: null, current: null, pick: null, hover: null, lit: null, layers: null },
    pose: WHOLE(),
    target: WHOLE(),
    labels: new Map(),
    screen: new Map(),
    size: { w: 1, h: 1 },
    inset: { top: 0, right: 0, bottom: 0 },
    blocks: [],
    wake: () => {},
    setOpen(on) {
      link.open = Boolean(on);
      link.wake();
    },
    set(patch) {
      let changed = false;
      for (const [k, v] of Object.entries(patch)) if (link.state[k] !== v) (link.state[k] = v), (changed = true);
      if (changed) {
        link.version += 1;
        link.wake();
      }
    },
    aim(pose) {
      link.target = pose;
      link.wake();
    },
    snap(pose) {
      link.pose = pose;
      link.target = pose;
      link.wake();
    },
    label(id, el) {
      if (el) link.labels.set(id, el);
      else link.labels.delete(id);
    },
    place(id, x, y, on) {
      link.screen.set(id, { x, y, on });
    },
    at(x, y, within = 18) {
      let best = null;
      let d = within;
      for (const [id, p] of link.screen) {
        if (!p.on) continue;
        const e = Math.hypot(p.x - x, p.y - y);
        if (e < d) (d = e), (best = id);
      }
      return best;
    },
  };
  return link;
}
