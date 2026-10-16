// trail.js on the node renderer. An engine's exhaust: a thin plume of light laid behind it as it flies,
// in its ship's colour with a white-hot core along its middle, soft at its
// edges, narrow at the nozzle, swelling a little, then thinning to nothing,
// longer the faster it goes, up to a flame's length (`length`, in map units:
// seen from behind and above, anything longer runs off the bottom of the
// screen). Rick's cruiser's ripples like portal plasma and
// sheds sparks of portal green when it boosts.
// It always turns its face to the camera (so it never shows as a flat strip
// edge-on or end-on) and is gone well before it reaches the camera (by
// four fifths of the way from its engine to the lens, so riding close
// behind, it never fills the screen). One draw a plume; a ship has one for
// each engine.
//
// Boosting (`stretch` above 1), it draws out longer, a little wider and
// hotter, as an afterburner's flame does.
//
// With `cap` ({ length, peak }: engines.js's capPlume, for the ship you
// fly), the plume is never longer than cap.length at any stretch, and its
// middle never brighter than cap.peak (linear luminance): the boost draws it
// out, but doesn't brighten it. Without (the galaxy's), as it always was.
//
// createTrail({ width, life, length, wobble, sparks, cap }) → { mesh, setColors(color, core),
//   update(dt, t, nozzle, amount, camera, stretch), clear(), dispose() }
// (mesh carries the sparks too, as a child)
// `nozzle` and `camera` are in the mesh's parent's space.
//
// What differs on the node renderer: the plume is a MeshBasicNodeMaterial
// whose colourNode is the GLSL’s fragment shader, line for line; the
// sparks were points sized by gl_PointSize, and the node renderer draws a
// point one pixel wide, so a spark is a sprite instanced once a point
// (three’s PointsNodeMaterial on a Sprite with a count, its place and its
// life instance attributes), its sizeNode the GLSL’s gl_PointSize. The
// uniforms keep their names, as uniform nodes on `material.uniforms`, so
// the frame writes `.value` as before; the flags are the same.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import { abs, attribute, clamp, distance, instancedBufferAttribute, length, positionGeometry, positionView, pow, screenDPR, sin, smoothstep, uniform, uv } from 'three/tsl';

const POINTS = 36; // samples along the plume
// (a square root, not Math.hypot, which makes garbage of its arguments: this
// runs for every sample of every plume, every frame)
const dist = (ax, ay, az, bx, by, bz) => Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by) + (az - bz) * (az - bz));

// (GLSL’s smoothstep with its edges reversed, as nodes: WGSL’s is undefined there)
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

// VERT and FRAG, as nodes
function plumeColour(u) {
  const vFade = attribute('aFade', 'float').toVarying('vFade');
  const vSide = attribute('aSide', 'float').toVarying('vSide');
  const vAlong = attribute('aAlong', 'float').toVarying('vAlong');
  const vDist = distance(positionGeometry, u.uCam).toVarying('vDist');
  // 1 down the middle, 0 at the edges (clamped: with multisampling a pixel at
  // the edge can be shaded from just outside it, and pow() below zero is NaN)
  const across = clamp(abs(vSide).oneMinus(), 0, 1);
  const body = across.mul(across).mul(across.mul(2).oneMinus().add(2)); // across² (3 − 2 across)
  const core = pow(across, 7).mul(vAlong.oneMinus());
  // a flicker running back along it (busier for the plasma)
  const flick = sin(vAlong.mul(u.uWobble.mul(30).add(24)).sub(u.uTime.mul(u.uWobble.mul(20).add(34)))).mul(0.18).add(0.82);
  const near = smoothstep(0.45, 1.5, vDist); // gone before it reaches the camera
  return u.uColor.mul(body).add(u.uCore.mul(core)).mul(vFade).mul(vFade).mul(flick).mul(near);
}

// SPARK_VERT and SPARK_FRAG, as nodes: `position` and `life` instance attributes
function sparkMaterial(u, position, life) {
  const material = new PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: false, forceSinglePass: true });
  material.positionNode = position;
  const vLife = life.toVarying('vLife');
  // gl_PointSize, in the drawing buffer’s pixels (three’s sprite multiplies by the DPR again)
  material.sizeNode = clamp(u.uDpr.mul(life.mul(1.6).add(0.9)).mul(positionView.z.negate().reciprocal().mul(5)), 0, u.uDpr.mul(6)).div(screenDPR);
  const d = length(uv().sub(0.5));
  const a = fall(0.5, 0.0, d).mul(vLife).mul(vLife);
  material.colorNode = u.uColor.mul(a);
  material.uniforms = u;
  return material;
}

// sparks: a few motes shed at the nozzle, drifting and dying (in the parent's space)
function sparkCloud(count) {
  const pos = new Float32Array(count * 3);
  const lifeAttr = new Float32Array(count);
  // (instance attributes, under the GLSL’s names, held by a geometry of our own to free)
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.InstancedBufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(lifeAttr, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = sparkMaterial({ uColor: uniform(new THREE.Color()), uDpr: uniform(1) }, instancedBufferAttribute(geo.attributes.position), instancedBufferAttribute(geo.attributes.aLife));
  const points = new THREE.Sprite(mat);
  points.count = count;
  points.frustumCulled = false;
  const motes = Array.from({ length: count }, () => ({ v: [0, 0, 0], age: 1, max: 1 }));
  let next = 0;
  let owed = 0;
  return {
    points,
    update(dt, nozzle, rate, color) {
      mat.uniforms.uColor.value.copy(color);
      owed += rate * dt;
      while (owed >= 1) {
        owed -= 1;
        const i = next;
        next = (next + 1) % count;
        const m = motes[i];
        m.age = 0;
        m.max = 0.25 + Math.random() * 0.35;
        m.v[0] = (Math.random() - 0.5) * 0.5;
        m.v[1] = (Math.random() - 0.3) * 0.4;
        m.v[2] = (Math.random() - 0.5) * 0.5;
        pos[i * 3] = nozzle.x;
        pos[i * 3 + 1] = nozzle.y;
        pos[i * 3 + 2] = nozzle.z;
      }
      let any = false;
      for (let i = 0; i < count; i++) {
        const m = motes[i];
        m.age += dt;
        const k = Math.max(0, 1 - m.age / m.max);
        if (k > 0) any = true;
        pos[i * 3] += m.v[0] * dt;
        pos[i * 3 + 1] += m.v[1] * dt;
        pos[i * 3 + 2] += m.v[2] * dt;
        lifeAttr[i] = k;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
      points.visible = any;
    },
    clear() {
      for (const m of motes) m.age = m.max;
      lifeAttr.fill(0);
      points.visible = false;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

export function createTrail({ width = 0.026, life = 0.5, length = 0.35, wobble = 0, sparks = 0, cap = null } = {}) {
  const pos = new Float32Array(POINTS * 2 * 3);
  const fade = new Float32Array(POINTS * 2);
  const along = new Float32Array(POINTS * 2);
  const side = new Float32Array(POINTS * 2);
  const index = [];
  for (let i = 0; i < POINTS; i++) {
    side[i * 2] = -1;
    side[i * 2 + 1] = 1;
    if (i < POINTS - 1) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aFade', new THREE.BufferAttribute(fade, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geo.setIndex(index);
  const uniforms = {
    uColor: uniform(new THREE.Color()),
    uCore: uniform(new THREE.Color()),
    uCam: uniform(new THREE.Vector3()),
    uTime: uniform(0),
    uWobble: uniform(wobble),
  };
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    forceSinglePass: true, // (added light: one pass draws the same as two)
    fog: false, // (as the ShaderMaterial took none)
  });
  mat.colorNode = plumeColour(uniforms);
  mat.uniforms = uniforms;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  // the sparks ride alongside the plume, not inside it (so they show while it's hidden)
  const cloud = sparks ? sparkCloud(sparks) : null;
  const holder = new THREE.Group();
  holder.add(mesh);
  if (cloud) holder.add(cloud.points);
  const sparkColour = new THREE.Color();
  const colour = new THREE.Color();
  const hot = new THREE.Color();
  const path = []; // newest first: { x, y, z, age, run }
  const spare = []; // samples that have gone, to be used again (nothing made each frame)
  // the path at even steps along it, as drawn
  const evenX = new Float64Array(POINTS);
  const evenY = new Float64Array(POINTS);
  const evenZ = new Float64Array(POINTS);
  const evenAge = new Float64Array(POINTS);
  const evenRun = new Float64Array(POINTS);
  const dir = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const across = new THREE.Vector3();
  const lift = new THREE.Vector3(0, 1, 0);
  let since = 0;
  let level = 0;
  const phase = Math.random() * 6.28;

  return {
    mesh: holder,
    // its colour, and the white-hot core's (both brighter than white, so they bloom a little)
    setColors(color, core = '#ffffff') {
      colour.set(color).multiplyScalar(1.5);
      hot.set(core).multiplyScalar(1.9);
      sparkColour.set(color).lerp(new THREE.Color(core), 0.35).multiplyScalar(2.2);
    },
    // amount: 0 (engines idle) … 1 (flat out); stretch: 1, up to 2 or so boosting
    update(dt, t, nozzle, amount, camera, stretch = 1) {
      level += (amount - level) * Math.min(1, dt * 5);
      const reachOut = cap ? Math.min(cap.length, length * stretch) : length * stretch;
      for (const p of path) p.age += dt;
      while (path.length && path[path.length - 1].age > life) spare.push(path.pop());
      since += dt;
      if (level > 0.02 && since > life / POINTS) {
        since = 0;
        const p = spare.pop() ?? { x: 0, y: 0, z: 0, age: 0, run: 0 };
        p.x = nozzle.x;
        p.y = nozzle.y;
        p.z = nozzle.z;
        p.age = 0;
        p.run = 0;
        path.unshift(p);
        while (path.length > POINTS) spare.push(path.pop());
      } else if (path.length) {
        // the newest point rides with the nozzle between samples
        path[0].x = nozzle.x;
        path[0].y = nozzle.y;
        path[0].z = nozzle.z;
      }
      // sparks only past cruising, more the harder it boosts
      if (cloud) cloud.update(dt, nozzle, Math.max(0, level - 0.55) * 90, sparkColour);
      mesh.visible = path.length > 1 && level > 0.01;
      if (!mesh.visible) return;
      const u = mat.uniforms;
      if (cap) {
        // (as bright as cruising whatever the stretch, and under the cap)
        u.uColor.value.copy(colour).multiplyScalar(level);
        u.uCore.value.copy(hot).multiplyScalar(level);
        const c = u.uColor.value;
        const k = u.uCore.value;
        const peak = 0.2126 * (c.r + k.r) + 0.7152 * (c.g + k.g) + 0.0722 * (c.b + k.b);
        if (peak > cap.peak) {
          c.multiplyScalar(cap.peak / peak);
          k.multiplyScalar(cap.peak / peak);
        }
      } else {
        u.uColor.value.copy(colour).multiplyScalar(level * (0.75 + 0.25 * stretch));
        u.uCore.value.copy(hot).multiplyScalar(level * (0.6 + 0.4 * stretch));
      }
      u.uCam.value.copy(camera);
      u.uTime.value = t;
      const reach = dist(camera.x, camera.y, camera.z, nozzle.x, nozzle.y, nozzle.z); // engine to lens
      // no longer than a flame: the samples past `length` along it go
      let run = 0;
      for (let i = 1; i < path.length; i++) {
        run += dist(path[i].x, path[i].y, path[i].z, path[i - 1].x, path[i - 1].y, path[i - 1].z);
        path[i].run = run;
        if (run > reachOut) {
          while (path.length > i + 1) spare.push(path.pop());
          break;
        }
      }
      path[0].run = 0;
      // drawn at even steps along the path, ending at the flame's length
      // exactly: at the galaxy's speeds a sample lands further back than a
      // flame is long, and drawn sample to sample the plume would be a
      // sample's spacing long, a different length every frame (a flicker)
      const n = path.length;
      const end = Math.min(path[n - 1].run, reachOut);
      let seg = 1;
      for (let i = 0; i < POINTS; i++) {
        const s = (end * i) / (POINTS - 1);
        while (seg < n - 1 && path[seg].run < s) seg++;
        const a = path[seg - 1];
        const b = path[seg];
        const span = b.run - a.run;
        const f = span > 1e-9 ? Math.min(1, Math.max(0, (s - a.run) / span)) : 0;
        evenX[i] = a.x + (b.x - a.x) * f;
        evenY[i] = a.y + (b.y - a.y) * f;
        evenZ[i] = a.z + (b.z - a.z) * f;
        evenAge[i] = a.age + (b.age - a.age) * f;
        evenRun[i] = s;
      }
      for (let i = 0; i < POINTS; i++) {
        const px = evenX[i];
        const py = evenY[i];
        const pz = evenZ[i];
        const j = i + 1 < POINTS ? i + 1 : i - 1; // a neighbour, for the plume's direction
        dir.set(evenX[j] - px, evenY[j] - py, evenZ[j] - pz);
        toCam.set(camera.x - px, camera.y - py, camera.z - pz);
        across.crossVectors(dir, toCam);
        if (across.lengthSq() < 1e-12) across.crossVectors(dir.lengthSq() > 1e-12 ? dir : lift, lift);
        across.normalize();
        // 0 at the nozzle, 1 where it's gone: by age, or by coming too near the lens
        const lens = dist(camera.x, camera.y, camera.z, px, py, pz) / reach;
        const k = Math.min(1, Math.max(evenAge[i] / life, evenRun[i] / reachOut, 1 - Math.min(1, Math.max(0, (lens - 0.2) / 0.3))));
        // a flame's shape: a little narrow right at the nozzle, swelling,
        // then thinning away (faster than it fades)
        const w = width * (0.6 + 0.4 * Math.sin(Math.min(1, k * 5) * Math.PI * 0.5)) * (1 - k) ** 1.6 * (0.5 + 0.5 * level) * (0.8 + 0.2 * stretch);
        // the plasma's ripple: the middle line weaving side to side, more as it goes
        const weave = wobble ? Math.sin(evenAge[i] * 26 + phase) * width * wobble * k : 0;
        const cx = px + across.x * weave;
        const cy = py + across.y * weave;
        const cz = pz + across.z * weave;
        const o = i * 6;
        pos[o] = cx - across.x * w;
        pos[o + 1] = cy - across.y * w;
        pos[o + 2] = cz - across.z * w;
        pos[o + 3] = cx + across.x * w;
        pos[o + 4] = cy + across.y * w;
        pos[o + 5] = cz + across.z * w;
        fade[i * 2] = fade[i * 2 + 1] = 1 - k;
        along[i * 2] = along[i * 2 + 1] = Math.min(1, k);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aFade.needsUpdate = true;
      geo.attributes.aAlong.needsUpdate = true;
    },
    clear() {
      while (path.length) spare.push(path.pop());
      level = 0;
      mesh.visible = false;
      cloud?.clear();
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      cloud?.dispose();
    },
  };
}
