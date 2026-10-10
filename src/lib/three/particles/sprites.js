// The quad an emitter's particles are drawn as: one mesh a pool, `n`
// instances of a unit quad, every corner placed in the vertex stage from
// the pool's per-instance vec4s (gpu.js's nodes: storage on WebGPU,
// instanced attributes on WebGL 2), so the whole emitter is one draw.
//
// What the record asks, and how it is drawn:
// - alignment: `screen` faces the camera, turned by the rotation curve
//   (degrees over EfNormTime); `motionStretchScreen` lies along the
//   particle's velocity across the screen (the camera's own velocity taken
//   off, so falling snow streaks when the camera pans), its length
//   emitter.js's `stretchLength` (MotionStretchMultiplier over the speed
//   normalisation, and the clamp);
//   `velocity` the same without the camera's; `world` flat on the ground.
// - colour: the sheet's texel times the colour curve, HDR as stored (12.7
//   on Hoth's powder: scaled, never clamped, so it blooms as the game's
//   does); alpha the sheet's alpha to UpdateAlphaLevelScaleData's exponent
//   times its curve, times UpdateTransparencyData's.
// - light (alpha-blended sheets; additive ones glow unlit): the sky's
//   ambient plus the sun's colour times its n·l wrapped by
//   LightWrapAroundFactor (emitter.js's `wrapLight`), n the quad's facing
//   (towards the camera), times the sun's shadow when a shadow node is
//   given (lane S's sunShadowNode once it is on main), so a sprite in a dark
//   corridor is dark. A glow's colour is taken by the scene's exposure as far
//   as EmissiveExposureFactor says (1: wholly, at the light stack's
//   gameToSite); a lit sprite's is as stored (its calibration against the
//   game's exposure is lane S's).
// - frames: the sheet's grid (its name's), from a random start where
//   SpawnAnimationFrameData draws one, run once over the life where
//   SpawnAnimationData says BasedOnLifetime.
// - soft against the depth buffer (three's softParticles, written out) where the record
//   gives SoftParticleDistance; the scene's fog node applies to the
//   alpha-blended ones (the corners are in world space, so positionView and
//   positionWorld are the particle's).
//
// The positions are world space: the mesh stays at the origin and is never
// frustum-culled (effects.js culls by the blueprint's CullDistance).
//
// The second path, for what is not a quad:
// - EmittableType_Mesh: the same pool drawn as instances of a mesh (the
//   record's mesh once phase 0 cuts the effect meshes; a low icosahedron
//   until then), sized by the particle's size, turned about +Y by the
//   rotation curve, lit by the scene's lights as a standard node material.
// - EmittableType_Ribbon (contrails, engine trails): emitter.js's trails,
//   each a camera-facing strip through its points, built on the CPU every
//   frame into one mesh for all of a kind's trails (one draw), its width the
//   spawn size times the size curve (UpdateSizeYData's where given) and its colour and alpha the curves at
//   each point's age; the sheet runs along the age.
//
// curveNode(tsl, curve, t, r) → a float node, curves.js's evalCurve in TSL
// createShared() → Promise<shared uniforms>: { sunDir, sunColor, ambient, camVel, shadow }
// createSpriteMesh(em, sim, { shared, map, geometry }) → Promise<THREE.Mesh>
// createRibbonMesh(em, trails, { shared, map }) → Promise<{ mesh, update(camera) }>

import { evalCurve } from './curves.js';
import { trailPoint } from './emitter.js';
import { loadThree } from '../light/three.js';

export function curveNode(tsl, c, t, r) {
  const { float, uniformArray, clamp, floor, min } = tsl;
  if (typeof c === 'number') return float(c);
  if (c?.poly) {
    const [x, y, z, w] = c.poly;
    let v = t.mul(x).add(y).mul(t).add(z).mul(t).add(w);
    if (c.min !== null && c.min !== undefined && Number.isFinite(c.min)) v = v.max(c.min);
    if (c.max !== null && c.max !== undefined && Number.isFinite(c.max)) v = v.min(c.max);
    return v.mul(c.scale ?? 1);
  }
  if (c?.table) {
    const n = c.table.length - 1;
    const arr = uniformArray(c.table, 'float');
    const f = clamp(t, 0, 1).mul(n);
    const i = min(floor(f), n - 1);
    const a = arr.element(tsl.int(i));
    const b = arr.element(tsl.int(i).add(1));
    return a.add(b.sub(a).mul(f.sub(i)));
  }
  if (c?.random) return float(c.random[0]).add(r.mul(c.random[1] - c.random[0]));
  return float(0);
}

// the uniforms every effect's quads share; effects.js keeps them current
export async function createShared() {
  const { THREE, tsl } = await loadThree();
  return {
    sunDir: tsl.uniform(new THREE.Vector3(0.3, 0.8, 0.5).normalize()),
    sunColor: tsl.uniform(new THREE.Color(1, 1, 1)),
    ambient: tsl.uniform(new THREE.Color(0.35, 0.38, 0.42)),
    camVel: tsl.uniform(new THREE.Vector3()),
    // the light stack's game-to-site factor (entry.js's gameToSite): a glow's
    // colour is taken towards it by its EmissiveExposureFactor
    gameToSite: tsl.uniform(1),
    // (a function of the world position to a float node, 1 lit and 0 in shadow)
    shadow: null,
  };
}

// Soft against the depth buffer: three's softParticles (addons/tsl/utils/
// SoftParticles.js) written out here, since its contrast curve names a
// parameter `input`, a reserved word in GLSL, and fails to compile on the
// node renderer over WebGL 2 (r186). The same sum: the gap between the
// scene's depth and the quad's over `distance`, through a contrast curve
// of power 2.
function softFade(tsl, opacity, distance) {
  const { viewportDepthTexture, perspectiveDepthToViewZ, cameraNear, cameraFar, positionView, select } = tsl;
  const sceneZ = perspectiveDepthToViewZ(viewportDepthTexture(), cameraNear, cameraFar);
  const gap = positionView.z.sub(sceneZ).div(distance).saturate();
  const upper = gap.greaterThan(0.5);
  const folded = select(upper, gap.oneMinus(), gap);
  const curve = folded.mul(2).saturate().pow(2).mul(0.5);
  return opacity.mul(select(upper, curve.oneMinus(), curve));
}

// where on the sheet: frame k of a [columns, rows] grid, counted from the top row
function frameUv(tsl, uvNode, frame, [cols, rows]) {
  const { vec2, floor, float } = tsl;
  const col = frame.mod(cols);
  const row = floor(frame.div(cols));
  return vec2(uvNode.x.add(col).div(cols), uvNode.y.add(float(rows - 1).sub(row)).div(rows));
}

export async function createSpriteMesh(em, sim, { shared, map = null, geometry = null } = {}) {
  const { THREE, tsl } = await loadThree();
  const { float, vec3, vec4, clamp, max, min, cos, sin, floor, pow, select, length, normalize, cross, dot, positionGeometry, cameraWorldMatrix, texture, uv } = tsl;
  const { posAge, velLife, extra } = sim.nodes;
  const age = posAge.w;
  const life = velLife.w;
  const t = clamp(age.div(max(life, 1e-3)), 0, 1);
  const r = extra.z;
  const alive = select(age.lessThan(life), float(1), float(0));
  const size = extra.x.mul(curveNode(tsl, em.size ?? 1, t, r)).mul(alive);
  // (UpdateSizeYData: the quad's height its own curve; the width's when absent)
  const sizeY = em.sizeY !== null && em.sizeY !== undefined ? extra.x.mul(curveNode(tsl, em.sizeY, t, r)).mul(alive) : size;
  // the angle in radians: the spawn's (its draw) and the curve's over life
  const angle = curveNode(tsl, em.spawn?.rotation ?? 0, t, r).add(curveNode(tsl, em.rotation ?? 0, t, r));
  const center = posAge.xyz;
  const right = cameraWorldMatrix.element(0).xyz;
  const up = cameraWorldMatrix.element(1).xyz;
  const back = cameraWorldMatrix.element(2).xyz;
  const c = positionGeometry.xy;

  let corner;
  if (em.kind === 'mesh') {
    const a = angle.add(r.mul(Math.PI * 2));
    const g = tsl.positionGeometry;
    corner = center.add(vec3(g.x.mul(cos(a)).add(g.z.mul(sin(a))), g.y, g.z.mul(cos(a)).sub(g.x.mul(sin(a)))).mul(size));
  } else if (em.alignment === 'motionStretchScreen' || em.alignment === 'velocity') {
    const rel = em.alignment === 'velocity' ? velLife.xyz : velLife.xyz.sub(shared.camVel);
    const across = rel.sub(back.mul(dot(rel, back)));
    const speed = length(across);
    const axis = select(speed.greaterThan(1e-4), across.div(max(speed, 1e-4)), up);
    const side = normalize(cross(axis, back));
    const s = em.stretch ?? { mult: 0, min: 1, max: null };
    let len = sizeY.mul(speed.div(s.norm ?? 50).mul(s.mult).add(1));
    len = max(len, sizeY.mul(s.min ?? 1));
    if (s.max !== null && s.max !== undefined && Number.isFinite(s.max)) len = min(len, sizeY.mul(s.max));
    corner = center.add(axis.mul(c.y).mul(len)).add(side.mul(c.x).mul(size));
  } else if (em.alignment === 'world') {
    corner = center.add(vec3(c.x.mul(size), 0, c.y.mul(sizeY)));
  } else {
    const a = angle;
    const qx = c.x.mul(size);
    const qy = c.y.mul(sizeY);
    const rx = qx.mul(cos(a)).sub(qy.mul(sin(a)));
    const ry = qx.mul(sin(a)).add(qy.mul(cos(a)));
    corner = center.add(right.mul(rx).add(up.mul(ry)));
  }

  // the sheet's frame
  const grid = em.uv?.grid ?? [1, 1];
  const frames = Math.max(1, Math.min(em.uv?.frames ?? 1, grid[0] * grid[1]));
  let frame = float(0);
  if (frames > 1) {
    const start = em.uv?.randomStart ? floor(r.mul(frames)) : float(0);
    // (over the life where SpawnAnimationData says BasedOnLifetime, at
    // FramesPerSecond where a record gives one, else the start frame held)
    const run = em.uv?.overLife ? floor(t.mul(frames - 0.001)) : em.uv?.fps > 0 ? floor(age.mul(em.uv.fps)) : float(0);
    frame = start.add(run).mod(frames);
  }
  const texel = map ? texture(map, frameUv(tsl, uv(), frame, grid)) : vec4(1);

  const col = (em.color ?? [1, 1, 1]).map((ch) => curveNode(tsl, ch, t, r));
  let rgb = texel.rgb.mul(vec3(col[0], col[1], col[2]));
  if (em.additive && em.exposure > 0) rgb = rgb.mul(shared.gameToSite.sub(1).mul(em.exposure).add(1));
  if (!em.additive && em.kind !== 'mesh') {
    const w = em.lightWrap ?? 0;
    const sun = max(dot(back, shared.sunDir).add(w).div(1 + w), 0);
    const shade = shared.shadow ? shared.shadow(corner) : float(1);
    rgb = rgb.mul(shared.ambient.add(shared.sunColor.mul(sun).mul(shade)));
  }
  let alpha = pow(max(texel.a, 0), em.alpha?.exponent ?? 1)
    .mul(clamp(curveNode(tsl, em.alpha?.curve ?? 1, t, r), 0, 1))
    .mul(clamp(curveNode(tsl, em.transparency ?? 1, t, r), 0, 1))
    .mul(alive);
  if (em.soft > 0) alpha = softFade(tsl, alpha, em.soft);

  const isMesh = em.kind === 'mesh';
  const material = isMesh ? new THREE.MeshStandardNodeMaterial({ transparent: true, roughness: 0.8 }) : new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  material.positionNode = corner;
  material.colorNode = rgb;
  material.opacityNode = alpha;
  material.blending = em.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  // (fog would add its colour to a glow: the additive ones go without)
  material.fog = !em.additive;
  material.toneMapped = true;
  const mesh = new THREE.Mesh(geometry ?? (isMesh ? new THREE.IcosahedronGeometry(0.5, 0) : new THREE.PlaneGeometry(1, 1)), material);
  mesh.count = sim.n;
  mesh.frustumCulled = false;
  mesh.renderOrder = em.additive ? 2 : 1;
  mesh.name = `fx:${String(em.name).split('/').pop()}`;
  return mesh;
}

// A stand-in sheet while the game's are not on the machine: a soft round
// flake in every cell of the grid, white, its alpha falling off from the
// middle (the fixture's and a missing sheet's)
const sheets = new Map();
export async function placeholderSheet([cols, rows] = [1, 1], px = 32) {
  const key = `${cols}x${rows}`;
  if (sheets.has(key)) return sheets.get(key);
  const { THREE } = await loadThree();
  const w = cols * px;
  const h = rows * px;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = ((x % px) + 0.5) / px - 0.5;
      const dy = ((y % px) + 0.5) / px - 0.5;
      const a = Math.max(0, 1 - Math.hypot(dx, dy) * 2);
      data.set([255, 255, 255, Math.round(a * a * 255)], (y * w + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, w, h);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  sheets.set(key, tex);
  return tex;
}

export async function createRibbonMesh(em, trails, { shared, map = null } = {}) {
  const { THREE, tsl } = await loadThree();
  const { attribute, float, vec3, vec4, clamp, max, pow, dot, texture, uv } = tsl;
  const { slots, m } = trails;
  const verts = slots * m * 2;
  const position = new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const life = new THREE.BufferAttribute(new Float32Array(verts * 2), 2).setUsage(THREE.DynamicDrawUsage);
  const uvs = new THREE.BufferAttribute(new Float32Array(verts * 2), 2).setUsage(THREE.DynamicDrawUsage);
  const index = [];
  for (let s = 0; s < slots; s++) {
    for (let k = 0; k < m - 1; k++) {
      const a = (s * m + k) * 2;
      const b = a + 2;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', position);
  geometry.setAttribute('uv', uvs);
  geometry.setAttribute('ribbonLife', life);
  geometry.setIndex(index);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);

  const lf = attribute('ribbonLife', 'vec2');
  const t = clamp(lf.x, 0, 1);
  const r = float(0.5);
  const texel = map ? texture(map, uv()) : vec4(1);
  const col = (em.color ?? [1, 1, 1]).map((ch) => curveNode(tsl, ch, t, r));
  let rgb = texel.rgb.mul(vec3(col[0], col[1], col[2]));
  if (em.additive && em.exposure > 0) rgb = rgb.mul(shared.gameToSite.sub(1).mul(em.exposure).add(1));
  if (!em.additive) {
    const w = em.lightWrap ?? 0;
    const back = tsl.cameraWorldMatrix.element(2).xyz;
    rgb = rgb.mul(shared.ambient.add(shared.sunColor.mul(max(dot(back, shared.sunDir).add(w).div(1 + w), 0))));
  }
  const alpha = pow(max(texel.a, 0), em.alpha?.exponent ?? 1)
    .mul(clamp(curveNode(tsl, em.alpha?.curve ?? 1, t, r), 0, 1))
    .mul(lf.y);
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  material.colorNode = rgb;
  material.opacityNode = alpha;
  material.blending = em.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  material.fog = !em.additive;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.name = `fx-ribbon:${String(em.name).split('/').pop()}`;

  const size = evalCurve(em.spawn?.size ?? 1, 0, 0.5);
  const p = trails.pos;
  return {
    mesh,
    // the strips rebuilt round the camera, newest point first
    update(camera) {
      const cx = camera.position.x;
      const cy = camera.position.y;
      const cz = camera.position.z;
      const P = position.array;
      const L = life.array;
      const U = uvs.array;
      for (let s = 0; s < slots; s++) {
        for (let k = 0; k < m; k++) {
          const i = trailPoint(trails, s, k);
          const age = trails.age[i];
          const tt = age / trails.life;
          const alive = tt < 1 ? 1 : 0;
          // the tangent: from the next older point that is not on this one
          // (a point is frozen on the head, so the two may coincide) to the newer
          const i0 = trailPoint(trails, s, Math.max(0, k - 1)) * 3;
          let i1 = trailPoint(trails, s, Math.min(m - 1, k + 1)) * 3;
          if (p[i1] === p[i0] && p[i1 + 1] === p[i0 + 1] && p[i1 + 2] === p[i0 + 2]) i1 = trailPoint(trails, s, Math.min(m - 1, k + 2)) * 3;
          const tx = p[i0] - p[i1];
          const ty = p[i0 + 1] - p[i1 + 1];
          const tz = p[i0 + 2] - p[i1 + 2];
          const x = p[i * 3];
          const y = p[i * 3 + 1];
          const z = p[i * 3 + 2];
          // the side: across the trail and the line to the camera
          const vx = cx - x;
          const vy = cy - y;
          const vz = cz - z;
          let sx = ty * vz - tz * vy;
          let sy = tz * vx - tx * vz;
          let sz = tx * vy - ty * vx;
          const sl = Math.hypot(sx, sy, sz);
          const half = alive && sl > 1e-9 ? (size * evalCurve(em.sizeY ?? em.size ?? 1, Math.min(1, tt), 0.5)) / 2 / sl : 0;
          sx *= half;
          sy *= half;
          sz *= half;
          const v = (s * m + k) * 2;
          P[v * 3] = x - sx;
          P[v * 3 + 1] = y - sy;
          P[v * 3 + 2] = z - sz;
          P[v * 3 + 3] = x + sx;
          P[v * 3 + 4] = y + sy;
          P[v * 3 + 5] = z + sz;
          L[v * 2] = L[v * 2 + 2] = Math.min(1, tt);
          L[v * 2 + 1] = L[v * 2 + 3] = half > 0 ? 1 : 0;
          U[v * 2] = U[v * 2 + 2] = Math.min(1, tt);
          U[v * 2 + 1] = 0;
          U[v * 2 + 3] = 1;
        }
      }
      position.needsUpdate = true;
      life.needsUpdate = true;
      uvs.needsUpdate = true;
    },
  };
}
