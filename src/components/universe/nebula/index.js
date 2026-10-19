// The nebulae, drawn: every cloud fixed in the world, all of them in one
// instanced draw. A cloud is a quad over its sphere that ray-marches it
// through a tiling noise volume (./volume.js, made in code), its steps set
// by how near it is and the tier (./budget.js); a near one has its young
// stars in the same draw. The rules (./rules.js) are pure and tested; the
// GLSL is ./shaders.js.
//
// State is absolute, in doubles (a far sector is ~1e9 out); only values
// from the camera, scaled, go into the float32 attributes. The mesh sits at
// the camera, so its modelViewMatrix, made on the CPU in doubles, cancels
// the big translation. A cloud past the far plane is pulled in along its
// own line of sight and shrunk alike (rules.js placement), so it keeps its
// true direction and angle.
//
// createNebulae({ renderer, tier }) → { group, add, remove, update, inside, dispose }
//   group: 'nebulae', for the caller to put under the map (which turns: the
//     camera is read in the map’s space through it). It holds 'nebula-clouds'
//     and 'nebula-fog' (the fog round the ship), made now and hidden till
//     needed, so the scene’s warm-up compiles them before the map is seen
//   add(desc) → handle; a TypeError for what can’t be drawn (checkDesc)
//   remove(handle): a stale handle, or one after dispose(), does nothing;
//     an id added twice draws once, till every handle for it is gone
//   update(camera); inside(position) → { id, depth } | null (insideOf)
//
// 'nebula-clouds'’ instance attributes, read by name (the tests, the fog):
//   aCentre the middle from the camera, scaled; aRadius scaled (a young
//   star’s size); aDist the true distance; aDetail 0…1 (a young star’s, its
//   cloud’s); aStart where the march starts along the ray, scaled, 0 outside;
//   aKind 0 a cloud, 1 a young star; aCol0, aCol1, aCol2 the colours at full
//   strength (a young star’s light in aCol0); aSeed the noise’s offset and
//   the form’s index; aSteps the march’s steps.

import * as THREE from 'three';
import { nebulaBudget } from './budget';
import { FORMS, FORM_INDEX, LIMIT, checkDesc, detailAt, insideOf, placement, seedOf, stepsAt, youngStars } from './rules';
import { CLOUD_FRAG, CLOUD_VERT } from './shaders';
import { noiseVolume } from './volume';

// (the one place this file makes a GLSL material: glsl-sites counts each)
const glslMaterial = (opts) => new THREE.ShaderMaterial(opts);

// handles count up across every renderer, so one kept from a disposed
// renderer can never name another’s cloud
let nextHandle = 1;

const FORM_ORDER = Object.keys(FORM_INDEX).sort((a, b) => FORM_INDEX[a] - FORM_INDEX[b]);
// a young star before its brightness: the sparks’ blue-white, a fifth of the
// way to one of its cloud’s colours
const STAR_WHITE = new THREE.Color(0.85, 0.9, 1);

// at full strength: the hue is the palette’s, how bright is the gas’s
function fullStrength(c) {
  const k = new THREE.Color(c);
  return k.multiplyScalar(1 / Math.max(k.r, k.g, k.b, 1e-3));
}

function volumeOf(size) {
  const t = new THREE.Data3DTexture(noiseVolume(size, 1), size, size, size);
  t.format = THREE.RGFormat;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

function entryOf(d, row) {
  const pal = d.colors.map(fullStrength);
  const stars = youngStars(d, row.stars).map((s) => {
    const c = STAR_WHITE.clone().lerp(pal[s.pal], 0.2).multiplyScalar(s.bright);
    return { at: s.at, size: s.size, light: [c.r, c.g, c.b] };
  });
  return { ...d, pal, seed: seedOf(d.seed), stars, count: 0 };
}

export function createNebulae({ renderer = null, tier = 'mid' } = {}) {
  const row = nebulaBudget(tier);
  const group = new THREE.Group();
  group.name = 'nebulae';

  const volume = volumeOf(row.volume);
  renderer?.initTexture(volume); // (up before the first frame)

  const cap = row.drawn * (1 + row.stars);
  const quad = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.instanceCount = 0;
  const inst = (size) => new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size).setUsage(THREE.DynamicDrawUsage);
  const A = {
    aCentre: inst(3), aRadius: inst(1), aDist: inst(1), aDetail: inst(1), aStart: inst(1), aKind: inst(1),
    aCol0: inst(3), aCol1: inst(3), aCol2: inst(3), aSeed: inst(4), aSteps: inst(1),
  };
  for (const [k, a] of Object.entries(A)) geo.setAttribute(k, a);

  const uniforms = {
    uVolume: { value: volume },
    // (the forms’ numbers have one source: rules.js)
    uForms: { value: FORM_ORDER.map((f) => new THREE.Vector4(FORMS[f].inner, FORMS[f].peak, FORMS[f].outer, FORMS[f].flat)) },
    uCore: { value: FORM_ORDER.map((f) => FORMS[f].core) },
    uNear: { value: 0.1 },
    uScale: { value: 500 },
  };
  const mat = glslMaterial({
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    uniforms,
    defines: { MAX_STEPS: row.nearSteps },
    // premultiplied: the gas adds its light and dims what’s behind; a young star only adds
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    // (no winding, nor a mirrored parent, culls a cloud; and in one pass,
    // where three draws a transparent two-sided thing twice)
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'nebula-clouds';
  mesh.frustumCulled = false;
  mesh.renderOrder = -5;
  mesh.visible = false;
  // what the shader needs of the camera that draws it besides its
  // projection: a sprite’s pixels a unit is at a distance of one (as
  // deepspace’s young stars had it), and its near plane
  const px = new THREE.Vector2();
  mesh.onBeforeRender = (r, scene, camera) => {
    const target = r.getRenderTarget();
    const h = target ? target.height : r.getDrawingBufferSize(px).y;
    uniforms.uScale.value = (h / 2) * (camera.projectionMatrix.elements[5] || 1);
    uniforms.uNear.value = camera.near ?? 0.1;
  };
  group.add(mesh);

  // the fog round the ship, while you’re in a cloud
  const fog = new THREE.Mesh(new THREE.BufferGeometry());
  fog.name = 'nebula-fog';
  fog.visible = false;
  fog.frustumCulled = false;
  group.add(fog);

  const entries = new Map(); // id → its entry, while any handle holds it
  const handles = new Map(); // handle → id
  let disposed = false;

  const cloud = (i, e, pl, detail) => {
    A.aCentre.setXYZ(i, pl.centre[0], pl.centre[1], pl.centre[2]);
    A.aRadius.setX(i, pl.radius);
    A.aDist.setX(i, pl.dist);
    A.aDetail.setX(i, detail);
    A.aStart.setX(i, 0);
    A.aKind.setX(i, 0);
    A.aCol0.setXYZ(i, e.pal[0].r, e.pal[0].g, e.pal[0].b);
    A.aCol1.setXYZ(i, e.pal[1].r, e.pal[1].g, e.pal[1].b);
    A.aCol2.setXYZ(i, e.pal[2].r, e.pal[2].g, e.pal[2].b);
    A.aSeed.setXYZW(i, e.seed[0], e.seed[1], e.seed[2], FORM_INDEX[e.form]);
    A.aSteps.setX(i, stepsAt(detail, row));
  };
  // a young star goes where its cloud is drawn, shrunk with it; its size
  // is by its true distance, so a pulled-in one looks as far as it is
  const star = (i, e, s, eye, scale, detail) => {
    const d = [0, 1, 2].map((k) => e.at[k] + s.at[k] - eye[k]);
    A.aCentre.setXYZ(i, d[0] * scale, d[1] * scale, d[2] * scale);
    A.aRadius.setX(i, s.size);
    A.aDist.setX(i, Math.hypot(d[0], d[1], d[2]));
    A.aDetail.setX(i, detail);
    A.aStart.setX(i, 0);
    A.aKind.setX(i, 1);
    A.aCol0.setXYZ(i, s.light[0] * detail, s.light[1] * detail, s.light[2] * detail);
    A.aSeed.setXYZW(i, 0, 0, 0, 0);
    A.aSteps.setX(i, 0);
  };

  const camMap = new THREE.Vector3();
  const frustum = new THREE.Frustum();
  const viewProj = new THREE.Matrix4();
  const sphere = new THREE.Sphere();

  return {
    group,
    add(desc) {
      const d = checkDesc(desc);
      const handle = nextHandle++;
      if (disposed) return handle;
      if (!entries.has(d.id)) entries.set(d.id, entryOf(d, row));
      entries.get(d.id).count += 1;
      handles.set(handle, d.id);
      return handle;
    },
    remove(handle) {
      const id = handles.get(handle);
      if (id === undefined) return;
      handles.delete(handle);
      const e = entries.get(id);
      if (--e.count <= 0) entries.delete(id);
    },
    update(camera) {
      if (disposed) return;
      group.updateWorldMatrix(true, false);
      group.worldToLocal(camera.getWorldPosition(camMap));
      mesh.position.copy(camMap);
      const eye = camMap.toArray();
      const limit = camera.far * LIMIT;
      // (the frustum in the world, where the camera’s matrices are)
      frustum.setFromProjectionMatrix(viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const grow = group.matrixWorld.getMaxScaleOnAxis();
      const seen = [];
      for (const e of entries.values()) {
        const pl = placement(e.at, e.r, eye, limit);
        sphere.center.set(eye[0] + pl.centre[0], eye[1] + pl.centre[1], eye[2] + pl.centre[2]).applyMatrix4(group.matrixWorld);
        sphere.radius = pl.radius * grow;
        if (frustum.intersectsSphere(sphere)) seen.push({ e, pl });
      }
      // far to near, so each is drawn over what’s behind it; the nearest
      // row.drawn, and only the nearest row.nearMax of those in detail
      seen.sort((a, b) => b.pl.dist - a.pl.dist);
      const kept = seen.slice(Math.max(0, seen.length - row.drawn));
      let n = 0;
      kept.forEach(({ e, pl }, k) => {
        const detail = k >= kept.length - row.nearMax ? detailAt(pl.dist, e.r) : 0;
        cloud(n++, e, pl, detail);
        // (none far, so a far pose draws no more than its clouds)
        if (detail > 0) for (const s of e.stars) star(n++, e, s, eye, pl.scale, detail);
      });
      geo.instanceCount = n;
      mesh.visible = n > 0;
      if (n > 0) {
        for (const a of Object.values(A)) {
          a.clearUpdateRanges();
          a.addUpdateRange(0, n * a.itemSize);
          a.needsUpdate = true;
        }
      }
    },
    inside: (position) => insideOf(entries.values(), position),
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      geo.dispose();
      quad.dispose();
      mat.dispose();
      volume.dispose();
      fog.geometry.dispose();
      fog.material.dispose();
      entries.clear();
      handles.clear();
    },
  };
}
