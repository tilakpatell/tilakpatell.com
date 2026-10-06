// What's near you, for the things only worth doing near you.
//
// The scattered trees and rocks are drawn instanced, hundreds to a draw; if
// every one of them cast a shadow, the sun's shadow pass would draw them all
// again, though its map only covers the ground round you. So each scattered
// part casts through a stand-in holding only the instances within a few tens
// of metres (placer.js), and this finds those.
//
//   nearInstances(xs, zs, x, z, r, max = Infinity) → Int32Array: the indices
//     of the points (xs[i], zs[i]) within r of (x, z) across the ground; past
//     `max` of them, the nearest `max`. Pure.
//   zoneVisibility(inZone) → { outdoors, zones }: which of the two is drawn.
//     Inside a zone (a cantina, a base) the outdoors is out of sight, and
//     outside, every zone's room is; drawing both would pay for one you
//     can't see. Pure.

export function nearInstances(xs, zs, x, z, r, max = Infinity) {
  const r2 = r * r;
  const hits = [];
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - x;
    const dz = zs[i] - z;
    const d = dx * dx + dz * dz;
    if (d <= r2) hits.push(i, d);
  }
  let n = hits.length / 2;
  if (n > max) {
    // (the nearest, by distance: rare, so a sort of the few that got in is fine)
    const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => hits[a * 2 + 1] - hits[b * 2 + 1]);
    const out = new Int32Array(max);
    for (let k = 0; k < max; k++) out[k] = hits[order[k] * 2];
    return out;
  }
  const out = new Int32Array(n);
  for (let k = 0; k < n; k++) out[k] = hits[k * 2];
  return out;
}

export function zoneVisibility(inZone) {
  return { outdoors: !inZone, zones: Boolean(inZone) };
}

// Things drawn into the sun's shadow and nowhere else (the scatter's near
// stand-ins). three tests a thing's layers against the main camera in the
// shadow pass too, so a layer can't hide one from the view and not the
// shadow; but each pass asks the thing whether it's in its frustum, and the
// shadow pass always starts by setting the light's shadow camera up
// (shadow.updateMatrices). So: a flag, cleared as each render of the scene
// begins and set as the light's shadow pass begins, and the stand-ins in
// the frustum only while it's set.
//   createShadowPhase(scene, light) → { only(mesh), dispose() }
export function createShadowPhase(scene, light) {
  const phase = { shadow: false };
  const before = scene.onBeforeRender;
  scene.onBeforeRender = function (...args) {
    phase.shadow = false;
    return before.apply(this, args);
  };
  const shadow = light.shadow;
  const update = shadow.updateMatrices;
  shadow.updateMatrices = function (...args) {
    phase.shadow = true;
    return update.apply(this, args);
  };
  return {
    phase,
    only(mesh) {
      mesh.frustumCulled = true;
      mesh.intersectsFrustum = () => phase.shadow;
      return mesh;
    },
    dispose() {
      scene.onBeforeRender = before;
      shadow.updateMatrices = update;
    },
  };
}

// Every instance as near (within r of (x, z)) or far, each once: a scattered
// model drawn whole near you and as its light copy past r (placer.js). Pure.
//   splitNear(xs, zs, x, z, r) → { near: Int32Array, far: Int32Array }
export function splitNear(xs, zs, x, z, r) {
  const r2 = r * r;
  const near = [];
  const far = [];
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - x;
    const dz = zs[i] - z;
    (dx * dx + dz * dz <= r2 ? near : far).push(i);
  }
  return { near: Int32Array.from(near), far: Int32Array.from(far) };
}
