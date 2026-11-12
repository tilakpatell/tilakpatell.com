// The nebula renderer: every nebula on the map, the Veil, the Cradle and
// the Expanse's, drawn as a place fixed in the world. Far, a cloud is a
// few steps marched through its sphere (its true angle on the sky, no
// floor); near, many more, a finer tap of the gas and its young stars;
// inside, ./fog.js's layers round the ship. Every cloud is one instance of
// one draw, far to near; the fog is a second draw, only while you are in
// one. The pure rules are ./rules.js, the rows ./budget.js, the gas
// ./volume.js's noise, made in code.
//
// The clouds' state is absolute (the map's own doubles); each frame they
// are written round the camera (the mesh sits at the camera, so its
// modelViewMatrix, made in doubles, carries them camera-relative). One past
// the far plane is pulled in along its own direction and shrunk with it.
//
// createNebulae({ renderer, tier }) → { group, add(desc) → handle, remove(handle), update(camera), inside(position) → { id, depth } | null, dispose() }
//   desc: { id, at: [x, y, z], r, colors: string[], seed, form?: 'cloud' | 'shell' | 'nursery' }
//   The same id added twice draws once, until each handle is removed; a
//   stale handle, or anything after dispose(), does nothing. The group goes
//   under the map; both materials are made here, hidden, so the map's
//   prepare compiles them before the first frame.

import * as THREE from 'three';
import { nebulaBudget } from './budget';
import { FORM_INDEX, LIMIT, checkDesc, detailAt, fogLayers, insideOf, placement, seedOf, stepsAt, youngStars } from './rules';
import { CLOUD_FRAG, CLOUD_VERT } from './shaders';
import { createFog } from './fog';
import { ABSORB, EMIT } from './tone';
import { formUniforms, volumeTexture } from './uniforms';


// a colour at full strength: its hue is the palette's, how bright is the gas's
const fullColour = (hex) => {
  const c = new THREE.Color(hex);
  return c.multiplyScalar(1 / Math.max(c.r, c.g, c.b, 1e-3));
};

const STAR_WHITE = new THREE.Color(0.85, 0.92, 1);

export function createNebulae({ renderer = null, tier = 'mid' } = {}) {
  const row = nebulaBudget(tier);
  const group = new THREE.Group();
  group.name = 'nebulae';
  const volume = volumeTexture(row.volume);
  renderer?.initTexture?.(volume);

  // ── the clouds: one instanced quad, row.drawn clouds and their stars ──
  const cap = row.drawn * (1 + row.stars);
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(2, 2);
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  const A = {};
  for (const [name, size] of [['aCentre', 3], ['aRadius', 1], ['aDist', 1], ['aDetail', 1], ['aStart', 1], ['aKind', 1], ['aC0', 3], ['aC1', 3], ['aC2', 3], ['aSeed', 4], ['aSteps', 2]]) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(name, a);
    A[name] = a;
  }
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    defines: { NEB_MAX_STEPS: row.nearSteps },
    uniforms: { uVolume: { value: volume }, ...formUniforms(), uEmit: { value: EMIT }, uAbsorb: { value: ABSORB }, uViewport: { value: new THREE.Vector2(1, 1) }, uScale: { value: 500 } },
    transparent: true,
    side: THREE.DoubleSide, // (the square facing the view is wound either way round)
    depthTest: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
  });
  const clouds = new THREE.Mesh(geo, mat);
  clouds.name = 'nebula-clouds';
  clouds.frustumCulled = false;
  clouds.renderOrder = -5;
  clouds.visible = false;
  // a star's size is in pixels: how many a unit is at a distance of one
  const px = new THREE.Vector2();
  clouds.onBeforeRender = (r, scene, camera) => {
    const target = r.getRenderTarget();
    if (target) px.set(target.width, target.height);
    else r.getDrawingBufferSize(px);
    mat.uniforms.uViewport.value.copy(px);
    mat.uniforms.uScale.value = (px.y / 2) * (camera.projectionMatrix.elements[5] || 1);
  };
  group.add(clouds);
  quad.dispose(); // (its buffers live on in geo)

  // ── the fog round the ship, inside one ──
  const fog = createFog({ volume, row });
  group.add(fog.mesh);

  // ── the clouds known: id → { desc, colours, seed, form, stars, handles } ──
  const entries = new Map();
  const handles = new Map(); // handle → id
  let nextHandle = 1;
  let disposed = false;

  function add(desc) {
    const d = checkDesc(desc);
    const h = nextHandle++;
    if (disposed) return h;
    let e = entries.get(d.id);
    if (!e) {
      e = { desc: d, colours: d.colors.map(fullColour), seed: seedOf(d.seed), form: FORM_INDEX[d.form], stars: null, count: 0 };
      entries.set(d.id, e);
    }
    e.count++;
    handles.set(h, d.id);
    return h;
  }

  function remove(handle) {
    const id = handles.get(handle);
    if (id === undefined) return;
    handles.delete(handle);
    const e = entries.get(id);
    if (e && --e.count <= 0) entries.delete(id);
  }

  // a near cloud's young stars, made the first time it comes near
  const starsOf = (e) =>
    (e.stars ??= youngStars(e.desc, row.stars).map((s) => {
      const c = STAR_WHITE.clone().lerp(e.colours[s.pal], 0.2).multiplyScalar(s.bright);
      return { at: s.at, size: s.size, colour: [c.r, c.g, c.b] };
    }));

  const camWorld = new THREE.Vector3();
  const camMap = new THREE.Vector3();
  const frustum = new THREE.Frustum();
  const viewProj = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  const groupScale = new THREE.Vector3();
  const seen = [];
  let lastInside = null;

  function update(camera) {
    if (disposed || !camera) return;
    camera.getWorldPosition(camWorld);
    group.updateWorldMatrix(true, false);
    camMap.copy(camWorld);
    group.worldToLocal(camMap);
    const cam = [camMap.x, camMap.y, camMap.z];
    clouds.position.copy(camMap);
    fog.mesh.position.copy(camMap);
    const limit = camera.far * LIMIT;
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewProj, camera.coordinateSystem);
    group.getWorldScale(groupScale);
    const unit = groupScale.x;

    // which are in view, the nearest row.drawn of them
    seen.length = 0;
    for (const e of entries.values()) {
      const p = placement(e.desc.at, e.desc.r, cam, limit);
      sphere.center.set(camMap.x + p.centre[0], camMap.y + p.centre[1], camMap.z + p.centre[2]).applyMatrix4(group.matrixWorld);
      sphere.radius = p.radius * unit;
      if (!frustum.intersectsSphere(sphere)) continue;
      seen.push({ e, p, detail: 0, holds: p.dist <= e.desc.r });
    }
    seen.sort((a, b) => a.p.dist - b.p.dist);
    if (seen.length > row.drawn) seen.length = row.drawn;
    for (let i = 0; i < Math.min(row.nearMax, seen.length); i++) seen[i].detail = detailAt(seen[i].p.dist, seen[i].e.desc.r);

    // inside one: its fog round the ship, and every cloud that holds the
    // camera marched only past the fog (nothing counted twice, nothing
    // marched over the ship)
    const live = [];
    for (const e of entries.values()) live.push({ id: e.desc.id, at: e.desc.at, r: e.desc.r, form: e.desc.form });
    const inside = insideOf(live, cam);
    lastInside = inside;
    let fogEnd = 0;
    if (inside) {
      const e = entries.get(inside.id);
      const layers = fogLayers(row, e.desc.r);
      fogEnd = layers.at(-1);
      fog.show({ centre: e.desc.at.map((v, i) => v - cam[i]), r: e.desc.r, colours: e.colours, seed: e.seed, form: e.form, depth: inside.depth }, layers);
    } else fog.hide();

    // written far to near (one draw blends in instance order)
    let n = 0;
    const put = (name, i, ...v) => A[name].array.set(v, i * A[name].itemSize);
    for (let k = seen.length - 1; k >= 0; k--) {
      const { e, p, detail, holds } = seen[k];
      const [c0, c1, c2] = e.colours;
      put('aCentre', n, ...p.centre);
      put('aRadius', n, p.radius);
      put('aDist', n, p.dist);
      put('aDetail', n, detail);
      put('aStart', n, holds && fogEnd ? fogEnd * p.scale : 0);
      put('aKind', n, 0);
      put('aC0', n, c0.r, c0.g, c0.b);
      put('aC1', n, c1.r, c1.g, c1.b);
      put('aC2', n, c2.r, c2.g, c2.b);
      put('aSeed', n, ...e.seed, e.form);
      put('aSteps', n, stepsAt(detail, row), p.scale);
      n++;
      if (detail <= 0) continue;
      for (const s of starsOf(e)) {
        put('aCentre', n, p.centre[0] + s.at[0] * p.scale, p.centre[1] + s.at[1] * p.scale, p.centre[2] + s.at[2] * p.scale);
        put('aRadius', n, 0);
        put('aDist', n, Math.max(1e-3, p.dist));
        put('aDetail', n, detail);
        put('aStart', n, 0);
        put('aKind', n, 1);
        put('aC0', n, ...s.colour);
        put('aSteps', n, 0, s.size);
        n++;
      }
    }
    geo.instanceCount = n;
    clouds.visible = n > 0;
    if (n) for (const a of Object.values(A)) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
  }

  return {
    group,
    add,
    remove,
    update,
    inside: (position) => (disposed ? null : position ? insideOf([...entries.values()].map((e) => ({ id: e.desc.id, at: e.desc.at, r: e.desc.r, form: e.desc.form })), position) : lastInside),
    dispose() {
      if (disposed) return;
      disposed = true;
      entries.clear();
      handles.clear();
      group.removeFromParent();
      geo.dispose();
      mat.dispose();
      fog.dispose();
      volume.dispose();
    },
  };
}
