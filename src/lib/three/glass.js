// Glass without transmission. A material with transmission makes three draw
// the whole scene a second time into a buffer for it to look through (every
// frame it's on screen), which is far too much to pay for a canopy. This
// turns each such material in a model into plain see-through glass instead: no
// transmission, drawn blended at about a third opaque, without writing depth
// (so what's behind it still draws and the glass doesn't hide it).
//
// dropTransmission(root) → how many materials it changed (one shared by many
// meshes counts once, and a model with none is left alone)

const OPACITY = 0.35;

export function dropTransmission(root) {
  const done = new Set();
  root.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!(m.transmission > 0) || done.has(m)) continue;
      m.transmission = 0;
      m.transparent = true;
      m.opacity = OPACITY;
      m.depthWrite = false;
      m.needsUpdate = true;
      done.add(m);
    }
  });
  return done.size;
}
