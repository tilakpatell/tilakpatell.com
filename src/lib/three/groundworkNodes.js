// groundwork.js for a 'nodes' world: the same groundWorld, on
// groundingNodes' hooks, groundingBakeNodes' bake and matcapNodes' matcaps;
// the scene's classic materials are swapped for their node twins first
// (hookNodes' twinScene), so the hooks change what is drawn. The rest is
// groundwork.js's, copied: it imports the GLSL hooks, which would bring
// their GLSL into a 'nodes' world's closure.
//
// A world put on baked floor light in one call: Bruno Simon's grounding (his
// folio-2019, bruno-simon.com; docs/research/2026-10-06-bruno-simon-folio.md),
// for any world built in code.
//
// Bruno's folio looks rich for almost nothing because its light lives in
// textures: a soft shadow mask under each area, a warm bounce on the
// underside of everything, a blob under whatever moves, and no shadow pass
// at all. This does the same for a world here, with the masks rendered by
// the world's own scene on the GPU when it's built (lib/three/grounding-bake's
// bakeFloorTexture) instead of in Blender:
//
//   - the shadow pass goes (every cast and received shadow off): a whole
//     render of the world a frame, and 9–18 pixels a metre of hard grey edge
//   - the floor reads the mask: the sun cut where the static world shades it
//     (soft-edged, a penumbra), the sky cut in corners and at wall feet, and
//     what's left in the dark warmed toward the world's shade (floorShadow)
//   - every lit thing's lower, downward faces take the floor's colour, by how
//     near the floor they are, wherever the floor is (bounce, from the mask's
//     baked height)
//   - what moves dims where it stands in the floor's shade (standIn) and
//     stands on a soft blob slid away from the sun (createBlobShadows)
//   - optionally, far and scattered things are painted with matcaps made
//     from the world's own light (lib/three/matcap)
//
// groundWorld({ renderer, scene, floor, area, sun, casters, skip, movers,
//   shade, bounce, height, tier, matcap, lights, auto, follow })
//   → { bake(), rebake(sun), update(), track(object, size, opts),
//       untrack(object), blobs, mask, stats, dispose() }
//
// `floor` the meshes that are the floor; `area` { x0, z0, w, d } the part of
// it to bake (the play space); `sun` a DirectionalLight or a direction to the
// sun; `casters` what shadows the floor (the whole scene by default; movers,
// skipped things, see-through and tiny things are left out of the bake);
// `movers` [{ object, size: [w, d], lift, contact }] what gets a blob and stands in
// the shade; `sunFloor` how much of the sun the floor keeps in full shade (0 to
// 1: a wood's floor, which the mask's sun never reaches, would go black); `height(x, z)` the floor's height, for the blobs (by default the
// floor's height as baked); `tier` the
// device's (lib/device), for the bake's cost. `auto` bakes on the first
// update (when the world has placed its sun); `follow` bakes again when the
// sun turns more than about 10° from where it was baked. `clip`: one zone
// of a world shown a zone at a time: blobs only while its floor is shown, and
// only for movers inside its area. `keepShadows`: a world too big or too
// fast for one sun's mask (a city flown over) keeps its own shadow pass, and
// the bake is the sky's occlusion alone, with the bounce.

import * as THREE from 'three';
import { BAKE_TIERS, bakeFloorTexture, heightFromPixels } from './groundingBakeNodes';
import { bounce as bounceOn, createBlobShadows, floorShadow, setFloorMask, setFloorTime, standIn } from './groundingNodes';
import { matcapFor } from './matcapNodes';
import { twinScene } from './hookNodes';

const LIT = (m) => m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial || m.isMeshMatcapMaterial);
const materialsOf = (o) => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);

// the floor's world box: where a default area and the height's range come from
function floorBox(floor) {
  const box = new THREE.Box3();
  for (const root of floor) box.expandByObject(root);
  return box;
}

// the direction to the sun, from a light (where it is, to where it points)
// or as given
function sunDirection(sun, out = new THREE.Vector3()) {
  if (sun?.isDirectionalLight) {
    const a = sun.getWorldPosition(new THREE.Vector3());
    const b = sun.target.getWorldPosition(new THREE.Vector3());
    out.subVectors(a, b);
  } else if (sun?.isVector3) out.copy(sun);
  else out.set(0.4, 0.8, 0.3);
  if (out.lengthSq() < 1e-9) out.set(0, 1, 0);
  return out.normalize();
}

// every mesh under `roots`, but none under `but`
function meshesUnder(roots, but) {
  const out = [];
  const visit = (o) => {
    if (but.has(o)) return;
    if (o.isMesh) out.push(o);
    for (const c of o.children) visit(c);
  };
  for (const r of roots) visit(r);
  return out;
}

// How far (radians) the sun may turn from where the floor was baked before
// it's baked again: a mood or a time of day moving the light. Under it, the
// shadows a few degrees off aren't seen; over it, they point the wrong way.
const FOLLOW = 0.17; // about 10°

export function shouldRebake(baked, now, threshold = FOLLOW) {
  if (!baked || !now) return false;
  return baked.angleTo(now) > threshold;
}

// One blank picture stands in for the mask until the bake lands: the sun
// everywhere, the sky everywhere, and no height (the bounce falls back to
// its one height).
function blankMask() {
  const t = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

export function groundWorld({ renderer, scene, floor = [], area = null, sun = null, casters = null, skip = [], movers = [], shade = 0x3a2c22, sunFloor = 0, bounce = {}, height = null, tier = 'mid', matcap = [], lights = null, blobOpacity = 0.75, auto = false, follow = true, clip = false, keepShadows = false } = {}) {
  const box = floorBox(floor);
  if (!area) {
    // the floor's own extent, at most 240 m a side about its middle
    const c = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    const s = box.isEmpty() ? new THREE.Vector3(100, 0, 100) : box.getSize(new THREE.Vector3());
    const w = Math.min(240, s.x || 100);
    const d = Math.min(240, s.z || 100);
    area = { x0: c.x - w / 2, z0: c.z - d / 2, w, d };
  }
  const range = box.isEmpty() ? [-1, 1] : [box.min.y - 0.5, box.max.y + 0.5];
  const roots = casters ?? [scene];
  const hemi = (() => {
    let h = null;
    scene.traverse((o) => (!h && o.isHemisphereLight ? (h = o) : null));
    return h;
  })();
  const sunLight = sun?.isDirectionalLight ? sun : null;

  // ── the shadow pass goes (unless the world keeps its own for the sun, or
  // this GPU can't bake: no float pictures to add the light up in, and the
  // world then stands as it did, its own shadows and all) ──
  const hadShadows = renderer.shadowMap?.enabled;
  // (the node renderer reads a float picture back on either backend)
  const canBake = typeof renderer.readRenderTargetPixelsAsync === 'function';
  // (every material a node one before the hooks go on, so they change what's drawn)
  twinScene(scene);
  if (!keepShadows && canBake) {
    if (renderer.shadowMap) renderer.shadowMap.enabled = false;
    scene.traverse((o) => {
      if (o.isLight && o.castShadow) o.castShadow = false;
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        if (hadShadows) for (const m of materialsOf(o)) m.needsUpdate = true;
      }
    });
  }

  // ── the mask, blank until the bake lands ──
  const blank = blankMask();
  // (keeping its own shadow pass, a world's mask is the sky's alone: channel
  // 3 reads no sun, so the sun's light is the shadow map's business)
  const mask = { areas: [{ texture: blank, ...area }], times: [{ tod: 0.5, channel: keepShadows ? 3 : 0 }], shade: new THREE.Color(shade), sunFloor, range };
  setFloorTime(mask, 0.5, 1);

  const floorMeshes = new Set();
  for (const r of floor) r.traverse((o) => o.isMesh && floorMeshes.add(o));
  const moverRoots = new Set(movers.map((m) => m.object).filter(Boolean));
  const skipRoots = new Set(skip.filter(Boolean));

  // ── matcaps, where asked for (before the bounce, which goes on them too) ──
  // (a matcap is drawn into a half-float picture: where the GPU can't, the
  // things stay lit as they were)
  if (matcap.length && canBake) {
    const rig = lights ?? { sun: sunLight, hemi };
    const swapped = new Map();
    for (const o of meshesUnder(matcap, new Set([...floorMeshes, ...moverRoots]))) {
      if (floorMeshes.has(o)) continue;
      const mats = materialsOf(o).map((m) => {
        if (!swapped.has(m)) swapped.set(m, matcapFor(m, renderer, rig));
        return swapped.get(m);
      });
      o.material = Array.isArray(o.material) ? mats : mats[0];
    }
  }

  // ── the floor, the statics, the movers ──
  for (const o of floorMeshes) for (const m of materialsOf(o)) floorShadow(m, mask);
  // (the sky light's own ground colour, the very object, so a mood that
  // changes it changes the bounce)
  const bounceColor = bounce === false ? null : bounce.color?.isColor ? bounce.color : bounce.color != null ? new THREE.Color(bounce.color) : (hemi?.groundColor ?? new THREE.Color(0x8a6a4a));
  const bounced = [];
  const bounceMat = (m) => {
    if (!bounceColor || !LIT(m) || m.userData?.bounce) return;
    bounceOn(m, { color: bounceColor, strength: bounce.strength, height: bounce.height, mask });
    bounced.push(m.userData.bounce);
  };
  const staticMats = new Set();
  const stood = [];
  const notStatic = new Set([...floorMeshes, ...moverRoots, ...skipRoots]);
  for (const o of meshesUnder(roots, notStatic)) for (const m of materialsOf(o)) staticMats.add(m);
  for (const m of staticMats) bounceMat(m);
  const groundMover = (root) => {
    for (const o of meshesUnder([root], new Set())) {
      o.castShadow = false;
      o.receiveShadow = false;
      for (const m of materialsOf(o)) {
        bounceMat(m);
        // (a material a static shares would read its own footprint: left lit)
        if (LIT(m) && !staticMats.has(m) && !m.userData?.standIn) {
          standIn(m, mask);
          stood.push(m.userData.standIn);
          if (landed) m.userData.standIn.uMoverRange.value.set(landed.range[0] - 2, landed.range[1] + 8);
        }
      }
    }
  };
  let landed = null;
  for (const r of moverRoots) groundMover(r);

  // ── blobs under what moves ──
  // (laid on the world's own height where it has one, else on the floor as
  // baked, else on the floor's lowest point until the bake lands)
  let baked = null;
  const low = box.isEmpty() ? 0 : box.min.y;
  const floorAt = height ?? ((x, z) => (baked ? (heightFromPixels(baked.pixels, baked.size, baked.area, baked.range, x, z) ?? low) : low));
  const blobs = createBlobShadows({ color: mask.shade, max: Math.max(16, movers.length + 16), ground: floorAt, opacity: blobOpacity });
  scene.add(blobs.mesh);
  // (`contact`: a mover's own contact shadow, an old circle under its feet,
  // kept for where this floor isn't: hidden while a blob is drawn for it)
  const tracked = movers.filter((m) => m.object).map((m) => ({ object: m.object, size: m.size ?? [1, 1], lift: m.lift ?? 0, contact: m.contact ?? null }));
  let active = true;
  const sunDir = new THREE.Vector3();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  // (shown: every ancestor visible, all the way up to this scene: a thing
  // taken out of the world is no longer in it)
  const shown = (o) => {
    let x = o;
    for (; x.parent; x = x.parent) if (!x.visible) return false;
    return x === scene && x.visible;
  };

  let disposed = false;
  let job = null;
  // (switched off, for an A/B of the same moment: the floor's mask, kept)
  let on = true;
  let keptTex = null;
  const keptStrength = new Map();
  const floorU = () => {
    for (const o of floorMeshes) for (const m of materialsOf(o)) if (m.userData?.floorShadow) return m.userData.floorShadow;
    return null;
  };
  let abort = null;
  const stats = { ms: 0, passes: 0, baked: false, started: false };
  let bakedDir = null;

  const land = (result) => {
    if (disposed) {
      result.dispose();
      return false;
    }
    const old = landed;
    landed = result;
    baked = result.pixels ? result : null;
    setFloorMask(mask, 0, result.texture);
    if (!on) {
      // (switched off: kept for when it's on again)
      keptTex = result.texture;
      const fu = floorU();
      if (fu) fu.uMask.value[0] = blank;
    }
    for (const u of bounced) {
      if (u.uBounceMask) u.uBounceMask.value = result.texture;
      u.uBounceRange?.value.set(result.range[0], result.range[1]);
    }
    for (const u of stood) u.uMoverRange.value.set(result.range[0] - 2, result.range[1] + 8);
    old?.dispose();
    Object.assign(stats, { ms: result.ms, passes: result.passes, baked: true, landedAt: Math.round(performance.now()) });
    return true;
  };

  const bake = () => {
    if (job) return job;
    if (disposed) return Promise.resolve(false);
    abort = { aborted: false };
    stats.started = true;
    stats.startedAt = Math.round(performance.now());
    bakedDir = sunDirection(sun, new THREE.Vector3());
    const preset = BAKE_TIERS[tier] ?? BAKE_TIERS.mid;
    job = bakeFloorTexture(renderer, scene, {
      area,
      floor,
      casters: roots,
      skip: [...skipRoots, ...moverRoots, blobs.mesh],
      sun: keepShadows ? null : bakedDir.clone(),
      size: preset.size,
      sunSamples: preset.sun,
      skySamples: preset.sky,
      shadowSize: preset.shadow,
      range,
      signal: abort,
    })
      .then((result) => (result ? land(result) : false))
      .catch(() => false)
      .finally(() => {
        job = null;
      });
    return job;
  };

  return {
    mask,
    blobs,
    stats,
    bake,
    // the whole kit off and on again, at once: the floor's mask, the bounce
    // and the blobs (for an A/B of the same moment; the bake is kept)
    get enabled() {
      return on;
    },
    set enabled(v) {
      const want = Boolean(v);
      if (want === on) return;
      on = want;
      const fu = floorU();
      if (!on) {
        keptTex = fu?.uMask.value[0] ?? null;
        if (fu) fu.uMask.value[0] = blank;
        for (const u of bounced) {
          keptStrength.set(u, u.uBounceStrength.value);
          u.uBounceStrength.value = 0;
        }
        blobs.mesh.visible = false;
      } else {
        if (fu && keptTex) fu.uMask.value[0] = keptTex;
        for (const u of bounced) if (keptStrength.has(u)) u.uBounceStrength.value = keptStrength.get(u);
        blobs.mesh.visible = true;
      }
    },
    // the sun moved (a mood, a time of day): bake again for where it is now
    rebake(next) {
      if (next) sun = next;
      if (abort) abort.aborted = true;
      const pending = job;
      return (pending ?? Promise.resolve()).then(() => bake());
    },
    // a mover that comes later (a figure swapped for another): its blob, and
    // its materials stood in the shade as the first ones were
    track(object, size = [1, 1], { lift = 0, contact = null } = {}) {
      if (!object || tracked.some((t) => t.object === object)) return;
      groundMover(object);
      tracked.push({ object, size, lift, contact });
    },
    untrack(object) {
      const i = tracked.findIndex((t) => t.object === object);
      if (i >= 0) tracked.splice(i, 1);
    },
    // once a frame: each blob under its mover, slid away from the sun by how
    // high the mover is over the floor
    update() {
      blobs.setSun(sunDirection(sun, sunDir), sunDir.y > 0.05 ? 1 : 0.5);
      // (the first frame the floor is out, the world's sun is where it will
      // be: bake then. A floor put away, a zone not yet visited, the world
      // while you're indoors, waits: hidden, it can't be drawn from above.)
      if (auto && !stats.started) {
        if (floor.every((f) => shown(f))) bake();
      }
      // (a sky-only bake doesn't care where the sun is)
      else if (follow && !keepShadows && !job && stats.baked && floor.every((f) => shown(f)) && shouldRebake(bakedDir, sunDir)) bake();
      blobs.clear();
      // (one zone of several: its blobs only while it's the one shown, and
      // only for who's in it)
      if (clip && !floor.every((f) => shown(f))) {
        if (active) for (const t of tracked) if (t.contact) t.contact.visible = true;
        active = false;
        return;
      }
      active = true;
      let i = 0;
      for (const t of tracked) {
        if (t.contact) t.contact.visible = true;
        if (!shown(t.object)) continue;
        t.object.getWorldPosition(p);
        if (clip && !(p.x >= area.x0 && p.x <= area.x0 + area.w && p.z >= area.z0 && p.z <= area.z0 + area.d)) continue;
        t.object.getWorldQuaternion(q);
        e.setFromQuaternion(q, 'YXZ');
        const above = p.y - floorAt(p.x, p.z) - t.lift;
        // (a mover well under the floor is somewhere else: an interior below)
        if (above < -2) continue;
        blobs.set(i++, p, Math.max(0, above), 0, t.size, e.y);
        if (t.contact) t.contact.visible = false;
      }
    },
    dispose() {
      disposed = true;
      if (abort) abort.aborted = true;
      blobs.mesh.removeFromParent();
      blobs.dispose();
      landed?.dispose();
      landed = null;
      blank.dispose();
    },
  };
}
