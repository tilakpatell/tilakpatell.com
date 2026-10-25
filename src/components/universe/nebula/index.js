// Every nebula in the universe, drawn by one renderer fixed in the world:
// the Veil, the Cradle, the Expanse's generated clouds and whatever pockets
// come after. A nebula shifts with parallax as you fly past, rolls with the
// stars, and grows as you come in. All of them and their young stars are one
// draw (shaders.js); the fog round the ship inside one is a second (fog.js).
//
// createNebulae({ renderer, tier }) → { group, add, remove, update, inside, dispose }
//   group             'nebulae', for the caller to add under the map; the
//                     camera is read in the map's space through it. It holds
//                     'nebula-clouds' and 'nebula-fog', made here and hidden
//                     until there's something to draw, so the scene's
//                     warm-up links their shaders before the map is seen
//   add(desc) → a handle; desc as rules.js's checkDesc takes it (a TypeError
//                     for what can't be drawn). The same id twice draws once,
//                     until every handle for it is removed
//   remove(handle)    a handle twice, a stale one or one after dispose does
//                     nothing
//   update(camera)    once a frame before the draw (nothing in a nebula moves
//                     with time)
//   inside(position) → { id, depth } | null: the deepest cloud a point in the
//                     map's space is in (rules.js's insideOf)
//   dispose()         leaves the parent and frees what it made
//
// Each frame every cloud is placed from the camera in doubles (rules.js's
// placement): one past the far plane is drawn in along its own direction,
// shrunk by the same factor. The mesh sits at the camera, so the instances
// it carries are small numbers and float32 holds them. A cloud out of the
// view is left out; of the rest the nearest row.drawn are drawn, far to near,
// and the nearest row.nearMax get more steps and their young stars, eased in
// by their level, so none is drawn far off and nothing pops.
//
// With the eye inside one (insideOf, at the camera), the deepest's fog is
// shown round it, its shells out to fogLayers' last, and that cloud starts
// its march there: the fog holds that stretch, so nothing is counted twice
// and none of it is drawn over the ship. Another cloud whose sphere holds
// the eye starts at the first shell, past the ship: the fog holds none of
// its gas, and starting at the last would lose that much of it.
//
// The instances' attributes (by these names; a test and the fog read them):
//   aCentre  vec3, the middle from the camera, drawn in
//   aRadius  drawn in;  aDist  the true distance
//   aDetail  0…1;  aStart  where the march starts along the ray, drawn in
//            (past the fog inside, 0 outside);  aKind  0 a cloud, 1 a young star
//   aCol0…2  the cloud's colours, linear, its brightest channel 1 (a star's
//            colour in aCol0);  aSeed  where in the noise it reads
//   aShape   (form, steps, a star's size, 1 when drawn in)

import * as THREE from 'three';
import { nebulaBudget } from './budget';
import { FOG_NEAR, FORMS, FORM_INDEX, LIMIT, checkDesc, detailAt, fogLayers, insideOf, placement, seedOf, stepsAt, youngStars } from './rules';
import { noiseVolume } from './volume';
import { CLOUD_FRAG, CLOUD_VERT } from './shaders';
import { createFog } from './fog';

// the forms in the shader's order (FORM_INDEX's)
const FORM_LIST = Object.keys(FORM_INDEX).sort((a, b) => FORM_INDEX[a] - FORM_INDEX[b]);

// (a star's own white, a little of the cloud's colour in it: deep space's)
const STAR_WHITE = new THREE.Color(0.85, 0.9, 1);

// a colour at full strength: the hue the palette gives, the brightness the gas's
const fullOf = (hex) => {
  const c = new THREE.Color(hex);
  return c.multiplyScalar(1 / Math.max(c.r, c.g, c.b, 1e-3));
};

const ATTRS = { aCentre: 3, aRadius: 1, aDist: 1, aDetail: 1, aStart: 1, aKind: 1, aCol0: 3, aCol1: 3, aCol2: 3, aSeed: 3, aShape: 4 };

function makeVolume(size, renderer) {
  const volume = new THREE.Data3DTexture(noiseVolume(size, 1), size, size, size);
  volume.format = THREE.RGFormat;
  volume.type = THREE.UnsignedByteType;
  volume.wrapS = volume.wrapT = volume.wrapR = THREE.RepeatWrapping;
  volume.minFilter = volume.magFilter = THREE.LinearFilter;
  volume.generateMipmaps = false;
  volume.unpackAlignment = 1;
  volume.needsUpdate = true;
  // (sent now, so the first frame doesn't wait on it)
  renderer?.initTexture?.(volume);
  return volume;
}

function makeClouds(row, volume) {
  const cap = row.drawn * (1 + row.stars);
  const geometry = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(2, 2);
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.attributes.position);
  for (const [name, size] of Object.entries(ATTRS)) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, a);
  }
  geometry.instanceCount = 0;
  const forms = FORM_LIST.map((name) => FORMS[name]);
  const material = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    defines: { MAX_STEPS: row.nearSteps },
    uniforms: {
      uVolume: { value: volume },
      uForms: { value: forms.map((f) => new THREE.Vector4(f.inner, f.peak, f.outer, f.flat)) },
      uCore: { value: forms.map((f) => f.core) },
      uTan: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.1 },
      uScale: { value: 500 },
      uPixel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    // (premultiplied: the gas adds its light and hides what's behind by its alpha)
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'nebula-clouds';
  mesh.frustumCulled = false;
  mesh.renderOrder = -5;
  mesh.visible = false;
  // the view's shape and the pixels' size, for the whole-screen quad and the
  // stars (a star's size in pixels is how many a unit is at a distance of one)
  const u = material.uniforms;
  const px = new THREE.Vector2();
  mesh.onBeforeRender = (renderer, scene, camera) => {
    const target = renderer.getRenderTarget();
    if (target) px.set(target.width, target.height);
    else renderer.getDrawingBufferSize(px);
    const e = camera.projectionMatrix.elements;
    u.uTan.value.set(1 / (e[0] || 1), 1 / (e[5] || 1));
    u.uNear.value = camera.near ?? 0.1;
    u.uScale.value = (px.y / 2) * (e[5] || 1);
    u.uPixel.value.set(1 / Math.max(px.x, 1), 1 / Math.max(px.y, 1));
  };
  return { mesh, cap };
}

export function createNebulae({ renderer = null, tier = 'mid' } = {}) {
  const row = nebulaBudget(tier);
  const group = new THREE.Group();
  group.name = 'nebulae';
  const volume = makeVolume(row.volume, renderer);
  const { mesh, cap } = makeClouds(row, volume);
  const fog = createFog({ volume, row });
  group.add(mesh, fog.mesh);

  const geometry = mesh.geometry;
  const A = geometry.attributes;
  const entries = new Map(); // id → { desc, handles, colours, tints, seed, form, stars }
  const handles = new Map(); // handle → id
  let live = null; // (the entries' descriptions, for insideOf: made again when one comes or goes)
  const descs = () => (live ??= [...entries.values()].map((e) => e.desc));
  let disposed = false;

  const entryOf = (desc) => {
    const colours = desc.colors.map(fullOf);
    return {
      desc,
      handles: new Set(),
      colours: colours.map((c) => c.toArray()),
      tints: colours,
      seed: seedOf(desc.seed),
      form: FORM_INDEX[desc.form],
      stars: youngStars(desc, row.stars).map((s) => ({
        at: s.at.map((v, i) => desc.at[i] + v),
        size: s.size,
        colour: STAR_WHITE.clone().lerp(colours[s.pal], 0.2).multiplyScalar(s.bright).toArray(),
      })),
    };
  };

  const add = (given) => {
    const desc = checkDesc(given);
    if (disposed) return null;
    let e = entries.get(desc.id);
    if (!e) {
      entries.set(desc.id, (e = entryOf(desc)));
      live = null;
    }
    const handle = Object.freeze({ id: desc.id });
    handles.set(handle, desc.id);
    e.handles.add(handle);
    return handle;
  };

  const remove = (handle) => {
    const id = handles.get(handle);
    if (id === undefined) return;
    handles.delete(handle);
    const e = entries.get(id);
    e?.handles.delete(handle);
    if (e && !e.handles.size) {
      entries.delete(id);
      live = null;
    }
  };

  const inside = (position) => (disposed ? null : insideOf(descs(), position));

  const eye = new THREE.Vector3();
  const frustum = new THREE.Frustum();
  const viewProj = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  const ZERO3 = [0, 0, 0];

  let n = 0;
  const put = (kind, centre, radius, dist, detail, start, cols, seed, shape) => {
    if (n >= cap) return;
    A.aCentre.setXYZ(n, centre[0], centre[1], centre[2]);
    A.aRadius.setX(n, radius);
    A.aDist.setX(n, dist);
    A.aDetail.setX(n, detail);
    A.aStart.setX(n, start);
    A.aKind.setX(n, kind);
    A.aCol0.setXYZ(n, ...cols[0]);
    A.aCol1.setXYZ(n, ...cols[1]);
    A.aCol2.setXYZ(n, ...cols[2]);
    A.aSeed.setXYZ(n, seed[0], seed[1], seed[2]);
    A.aShape.setXYZW(n, shape[0], shape[1], shape[2], shape[3]);
    n += 1;
  };

  const update = (camera) => {
    if (disposed || !camera) return;
    // (this brings the camera's matrices up to date too)
    camera.getWorldPosition(eye);
    group.updateWorldMatrix(true, false);
    group.worldToLocal(eye);
    mesh.position.copy(eye);
    const cam = eye.toArray();
    const limit = camera.far * LIMIT;
    frustum.setFromProjectionMatrix(viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), camera.coordinateSystem);
    const grow = group.matrixWorld.getMaxScaleOnAxis();
    // inside one: the deepest's fog round the eye, out to its last shell
    const deep = insideOf(descs(), cam);
    let clear = 0;
    if (deep) {
      const e = entries.get(deep.id);
      const layers = fogLayers(row, e.desc.r);
      clear = layers.at(-1) ?? 0;
      const centre = [e.desc.at[0] - cam[0], e.desc.at[1] - cam[1], e.desc.at[2] - cam[2]];
      fog.show({ centre, r: e.desc.r, colours: e.tints, seed: e.seed, form: e.form, depth: deep.depth }, layers);
    } else fog.hide();
    const seen = [];
    for (const e of entries.values()) {
      const at = placement(e.desc.at, e.desc.r, cam, limit);
      sphere.center.set(cam[0] + at.centre[0], cam[1] + at.centre[1], cam[2] + at.centre[2]).applyMatrix4(group.matrixWorld);
      sphere.radius = at.radius * grow;
      if (frustum.intersectsSphere(sphere)) seen.push({ e, at });
    }
    seen.sort((a, b) => a.at.dist - b.at.dist);
    if (seen.length > row.drawn) seen.length = row.drawn;
    n = 0;
    for (let i = seen.length - 1; i >= 0; i--) {
      const { e, at } = seen[i];
      const detail = i < row.nearMax ? detailAt(at.dist, e.desc.r) : 0;
      const drawnIn = at.scale < 1 ? 1 : 0;
      // with the fog shown, the cloud it is of starts its march past it, and
      // another round the eye past the ship, where its quad is (the fog
      // holds none of its gas)
      const start = clear && at.dist < e.desc.r ? (e.desc.id === deep.id ? clear : FOG_NEAR) * at.scale : 0;
      put(0, at.centre, at.radius, at.dist, detail, start, e.colours, e.seed, [e.form, stepsAt(detail, row), 0, drawnIn]);
      if (!(detail > 0)) continue;
      // its young stars, right after it, eased in by its level
      for (const s of e.stars) {
        const d = [s.at[0] - cam[0], s.at[1] - cam[1], s.at[2] - cam[2]];
        const colour = s.colour.map((v) => v * detail);
        put(1, d.map((v) => v * at.scale), 0, Math.hypot(d[0], d[1], d[2]), detail, 0, [colour, ZERO3, ZERO3], ZERO3, [0, 0, s.size, drawnIn]);
      }
    }
    geometry.instanceCount = n;
    mesh.visible = n > 0;
    if (!n) return;
    for (const name of Object.keys(ATTRS)) {
      const a = A[name];
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    geometry.dispose();
    mesh.material.dispose();
    fog.dispose();
    volume.dispose();
    entries.clear();
    handles.clear();
    live = null;
  };

  return { group, add, remove, update, inside, dispose };
}
