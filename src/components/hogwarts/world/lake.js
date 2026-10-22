// The Black Lake: one sheet of water at the loch’s level over its whole
// length, in the house’s light (the Road’s water.js read for a still loch:
// a peaty dark body, the sky coming back off it by Fresnel, the shallows
// paler and lit through to the stones, a wind’s ripple moving over it, a
// glint of the sun or the moon). Its sky is the sky’s own function
// (sky.js’s colourAt, along the reflected ray), so the water and the dome
// never disagree, stars and moon and all. On high it mirrors what stands
// over it (its own mirror, a half-size picture of the castle, the hills
// and the far ground, nothing else: those are on REFLECTED’s layer), broken
// by the ripple. How deep it stands is read off the ground map’s heights,
// so the strand fades the water out with no seam.
//
// The giant squid: once every few minutes one arm rises out of the water
// somewhere you could see it from the shore, curls and sinks back, a ring
// of ripples where it went (squidAt: pure, by the clock).
//
//   REFLECTED: the layer the reflection draws
//   createLake({ camera, sky, groundMap, tier, reflection }) → { mesh, target, squid, set(light, { wind, rain }),
//     reflect(renderer, scene, camera) (the mirror drawn: before the frame’s chain), update(dt), dispose }
//   squidAt(t) → { up: 0…1, spot: [x, z], turn, cycle } | null (t seconds of the world)
//   SQUID_SPOTS, SQUID_EVERY

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshLambertNodeMaterial } from 'three/webgpu';
import { Fn, cameraPosition, dot, float, length, max, mix, normalize, positionWorld, pow, reflect, screenUV, smoothstep, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { noiseWith } from '../../../lib/three/noiseNodes';
import { HALF, LAKE } from './terrain';

export const REFLECTED = 2;
export const SQUID_EVERY = 170; // s between the arm’s risings
const SQUID_UP = 16; // s it is out of the water
// where it rises: out from the boathouse under the castle, off the end rock,
// in the middle of the long water, up the arm toward the station
export const SQUID_SPOTS = [
  [-40, 150],
  [-150, 168],
  [60, 280],
  [-260, 300],
  [470, 60],
];

export function squidAt(t) {
  const cycle = Math.floor(t / SQUID_EVERY);
  const into = t - cycle * SQUID_EVERY - (SQUID_EVERY - SQUID_UP - 20);
  if (into < 0 || into > SQUID_UP) return null;
  const spot = SQUID_SPOTS[(cycle * 3 + 1) % SQUID_SPOTS.length];
  const k = into / SQUID_UP;
  // (up over three seconds, held curling, down over four)
  const up = Math.min(1, into / 3, (SQUID_UP - into) / 4);
  return { up: up * up * (3 - 2 * up), k, spot, turn: cycle * 2.4, cycle };
}

// The lake’s mirror: the camera turned over the water’s plane, what is on
// REFLECTED’s layer drawn from there into a picture half the screen’s size,
// the near side of the water cut away by an oblique near plane (Lengyel’s,
// as three’s reflector has it), read back on the water by where it is on
// the screen. Its own picture and its own texture node, set once: three’s
// reflector node swaps its node’s texture as it draws, and on the world
// runtime’s chain the water went on sampling the empty picture it started with.
function createMirror({ scale = 0.5 } = {}) {
  const target = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
  const map = texture(target.texture);
  const uv = screenUV.flipX();
  const cam = new THREE.PerspectiveCamera();
  cam.layers.set(REFLECTED);
  const size = new THREE.Vector2();
  const eye = new THREE.Vector3();
  const look = new THREE.Vector3();
  const rot = new THREE.Matrix4();
  const plane = new THREE.Plane();
  const clip = new THREE.Vector4();
  const q = new THREE.Vector4();
  const row = new THREE.Vector4();
  const inv = new THREE.Matrix4();
  const N = new THREE.Vector3(0, 1, 0);
  const ON_WATER = new THREE.Vector3(0, LAKE, 0);
  return {
    map,
    uv,
    draw(renderer, scene, camera) {
      renderer.getDrawingBufferSize(size);
      const w = Math.max(1, Math.round(size.x * scale));
      const h = Math.max(1, Math.round(size.y * scale));
      if (target.width !== w || target.height !== h) target.setSize(w, h);
      camera.updateMatrixWorld();
      // the eye and where it looks, turned over the plane y = LAKE
      eye.setFromMatrixPosition(camera.matrixWorld);
      if (eye.y <= LAKE) return;
      rot.extractRotation(camera.matrixWorld);
      look.set(0, 0, -1).applyMatrix4(rot).add(eye);
      cam.position.set(eye.x, 2 * LAKE - eye.y, eye.z);
      cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(N);
      cam.lookAt(look.x, 2 * LAKE - look.y, look.z);
      cam.near = camera.near;
      cam.far = camera.far;
      // (the main camera’s depth and coordinates, so the renderer never makes this projection again over ours)
      cam.coordinateSystem = camera.coordinateSystem;
      cam._reversedDepth = camera.reversedDepth;
      cam.updateMatrixWorld();
      cam.projectionMatrix.copy(camera.projectionMatrix);
      // the near plane laid along the water, so nothing under it is drawn:
      // the third row made the fourth’s at the near plane’s depth plus the
      // water’s plane, scaled so the frustum’s far corner stays on the far
      // plane (Lengyel’s, for any depth: a reversed buffer’s near is 1)
      plane.setFromNormalAndCoplanarPoint(N, ON_WATER).applyMatrix4(cam.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const e = cam.projectionMatrix.elements;
      const reversed = camera.reversedDepth === true;
      const nearZ = reversed ? 1 : camera.coordinateSystem === THREE.WebGPUCoordinateSystem ? 0 : -1;
      const farZ = reversed ? 0 : 1;
      inv.copy(cam.projectionMatrix).invert();
      q.set(Math.sign(clip.x), Math.sign(clip.y), farZ, 1).applyMatrix4(inv);
      row.set(e[3], e[7], e[11], e[15]);
      const a = ((farZ - nearZ) * row.dot(q)) / clip.dot(q);
      e[2] = nearZ * row.x + a * clip.x;
      e[6] = nearZ * row.y + a * clip.y;
      e[10] = nearZ * row.z + a * clip.z;
      e[14] = nearZ * row.w + a * clip.w;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      const was = renderer.getRenderTarget();
      const mrt = renderer.getMRT?.() ?? null;
      const clear = renderer.autoClear;
      renderer.setMRT?.(null);
      renderer.setRenderTarget(target);
      renderer.autoClear = true;
      renderer.render(scene, cam);
      renderer.setRenderTarget(was);
      renderer.setMRT?.(mrt);
      renderer.autoClear = clear;
    },
    dispose() {
      target.dispose();
    },
  };
}

const DEEP = new THREE.Color(0.012, 0.02, 0.018);
const BODY = new THREE.Color(0.035, 0.05, 0.035);
const SHALLOW = new THREE.Color(0.12, 0.13, 0.09);

export function createLake({ camera = null, sky = null, groundMap = null, tier = 'high', reflection = tier === 'high' || tier === 'ultra' } = {}) {
  // the sheet: over the loch’s length, 16 m a vertex (flat: the waves are in its normal)
  const x0 = -1400;
  const x1 = 700;
  const z0 = -600;
  const z1 = 700;
  const geometry = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.round((x1 - x0) / 16), Math.round((z1 - z0) / 16));
  geometry.rotateX(-Math.PI / 2);
  geometry.translate((x0 + x1) / 2, LAKE, (z0 + z1) / 2);

  const u = {
    uTime: uniform(0),
    uWind: uniform(new THREE.Vector2(0.7, 0.4)),
    uRough: uniform(0.35),
    uLight: uniform(1),
    uSun: uniform(new THREE.Vector3(0, 1, 0)),
    uSunCol: uniform(new THREE.Color(1, 0.9, 0.8)),
    uGlint: uniform(1),
    uSeed: uniform(new THREE.Vector3(5.3, 1.7, 9.1)),
  };
  const { noise } = noiseWith(u.uSeed, { octaves: 2 });
  const mirror = reflection ? createMirror() : null;

  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const colour = Fn(() => {
    const p = positionWorld.xz;
    const t = u.uTime;
    // the ripple: two drifting noises on the wind, their slopes the normal’s tilt
    const q1 = p.mul(0.09).add(u.uWind.mul(t.mul(0.05)));
    const q2 = p.mul(0.31).sub(u.uWind.mul(t.mul(0.12))).add(vec2(13, 7));
    const e = 0.4;
    const h = (q) => noise(vec3(q, t.mul(0.06)), u.uSeed);
    const a0 = h(q1);
    const a1 = h(q2);
    const sx = h(q1.add(vec2(e, 0))).sub(a0).add(h(q2.add(vec2(e, 0))).sub(a1).mul(0.6));
    const sz = h(q1.add(vec2(0, e))).sub(a0).add(h(q2.add(vec2(0, e))).sub(a1).mul(0.6));
    const toEye = cameraPosition.sub(positionWorld);
    const dist = length(toEye);
    // (calmer far off: the ripple would only sparkle in the pixels, and a far loch is a mirror)
    const rough = u.uRough.mul(float(1).sub(smoothstep(60, 600, dist).mul(0.75)));
    const n = normalize(vec3(sx.mul(rough).negate(), 1, sz.mul(rough).negate()));
    const view = normalize(toEye);
    const fres = pow(max(dot(n, view), 0).oneMinus(), 5).mul(0.92).add(0.06);
    const r = reflect(view.negate(), n);
    const skyCol = sky ? sky.colourAt(vec3(r.x, max(r.y, 0.02), r.z)) : mix(vec3(0.4, 0.45, 0.5), vec3(0.2, 0.35, 0.6), r.y);
    let above = skyCol;
    if (mirror) {
      // (the mirror’s picture, shifted by the ripple: the castle’s lights break into streaks down the water)
      const m = mirror.map.sample(mirror.uv.add(vec2(sx.mul(0.4), sz).mul(rough).mul(0.05)));
      // (a peaty loch gives back four fifths of what stands over it, its colour a little drained)
      const back = mix(vec3(dot(m.rgb, vec3(0.2126, 0.7152, 0.0722))), m.rgb, 0.8).mul(0.8);
      above = mix(skyCol, back, m.a.max(0).min(1));
    }
    // how deep it stands, from the ground map (none known past the ground: deep)
    const inside = p.x.greaterThan(-HALF).and(p.x.lessThan(HALF)).and(p.y.greaterThan(-HALF)).and(p.y.lessThan(HALF));
    const ground = groundMap ? groundMap.groundHeight(p) : float(-20);
    const depth = inside.select(float(LAKE).sub(ground), float(20));
    const body = mix(vec3(SHALLOW.r, SHALLOW.g, SHALLOW.b), mix(vec3(BODY.r, BODY.g, BODY.b), vec3(DEEP.r, DEEP.g, DEEP.b), smoothstep(3, 14, depth)), smoothstep(0.15, 2.2, depth)).mul(u.uLight);
    const glint = u.uSunCol.mul(pow(max(dot(r, u.uSun), 0), 300).mul(u.uGlint).mul(6));
    const c = mix(body, above, fres).add(glint).toVar();
    // a thin pale line where it laps the strand
    const lap = smoothstep(0.25, 0.0, depth).mul(smoothstep(0.1, 0.6, a1.mul(0.5).add(0.5)));
    c.assign(mix(c, vec3(0.6, 0.62, 0.6).mul(u.uLight), lap.mul(0.35)));
    const alpha = smoothstep(0.0, 0.35, depth).mul(mix(0.86, 0.98, fres));
    return vec4(c, alpha);
  });
  material.colorNode = colour();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'hogwarts:lake';
  mesh.renderOrder = 1;
  const target = null;

  // the squid’s arm: a tapered tube along a curl, rising and sinking at its spot, and its ring of ripples
  const squid = new THREE.Group();
  squid.name = 'hogwarts:squid';
  squid.visible = false;
  const armMat = new MeshLambertNodeMaterial({ color: 0x2c2430 });
  const curl = (k) => {
    // (the arm’s line at curl k: straight up out of the water, its last third curling over)
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const s = i / 10;
      const bend = Math.max(0, s - 0.45) * (1.6 + k * 1.4);
      pts.push(new THREE.Vector3(Math.sin(bend) * 2.2 * s, s * 7.5 - Math.max(0, s - 0.6) * k * 2.2, 0));
    }
    return new THREE.CatmullRomCurve3(pts);
  };
  const taper = (g) => {
    // (the tube from thick at the water to a point at the tip, read along its length)
    const pos = g.attributes.position;
    const segs = g.parameters.tubularSegments;
    const radial = g.parameters.radialSegments + 1;
    const path = g.parameters.path;
    const centre = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      path.getPointAt(i / segs, centre);
      const k = 1 - (i / segs) * 0.92;
      for (let j = 0; j < radial; j++) {
        const v = i * radial + j;
        pos.setXYZ(v, centre.x + (pos.getX(v) - centre.x) * k, centre.y + (pos.getY(v) - centre.y) * k, centre.z + (pos.getZ(v) - centre.z) * k);
      }
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  };
  const arm = new THREE.Mesh(taper(new THREE.TubeGeometry(curl(0.5), 28, 0.75, 10, false)), armMat);
  squid.add(arm);
  const ringMat = new MeshBasicNodeMaterial({ color: 0xaab4b8, transparent: true, opacity: 0, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.2, 40).rotateX(-Math.PI / 2), ringMat);
  ring.position.y = 0.05;
  squid.add(ring);
  let t = 0;
  let lastCycle = -1;

  return {
    mesh,
    target,
    mirror,
    squid,
    set(light, { wind = 0.3, rain = 0 } = {}) {
      const { az, el, colour: c } = light.sun;
      const up = Math.max(0, Math.sin(el));
      u.uSun.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      u.uSunCol.value.setRGB(c[0], c[1], c[2]);
      // (the moon’s path on the water at night, where the sun’s glint was)
      if (el < 0 && light.moon?.el > 0) {
        u.uSun.value.set(Math.sin(light.moon.az) * Math.cos(light.moon.el), Math.sin(light.moon.el), Math.cos(light.moon.az) * Math.cos(light.moon.el));
        u.uSunCol.value.setRGB(0.5, 0.56, 0.7).multiplyScalar(light.moon.phase);
      }
      u.uGlint.value = (1 - (light.cloud ?? 0) * 0.85) * (el > 0 ? Math.min(1, up * 4) : 0.6);
      u.uLight.value = Math.min(1.2, 0.3 + (light.ambient ?? 0.3) * 1.1 + up * 0.6);
      u.uRough.value = 0.22 + wind * 0.5 + rain * 0.3;
    },
    // the mirror’s picture for this frame, drawn before the frame’s chain (the module’s draw calls it)
    reflect(renderer, scene, cam = camera) {
      if (!mirror || !renderer || !cam || !mesh.visible) return;
      mirror.draw(renderer, scene, cam);
    },
    update(dt) {
      t += dt;
      u.uTime.value = t;
      const s = squidAt(t);
      squid.visible = Boolean(s);
      if (!s) return;
      if (s.cycle !== lastCycle) {
        lastCycle = s.cycle;
        squid.position.set(s.spot[0], LAKE, s.spot[1]);
        squid.rotation.y = s.turn;
      }
      // (out of the water by how far up it is, a slow curl and a sway while it’s held)
      arm.position.y = -7.8 * (1 - s.up);
      arm.rotation.z = Math.sin(t * 0.9) * 0.12;
      arm.rotation.x = Math.sin(t * 0.7 + 1) * 0.08;
      const r = 1 + s.k * 14;
      ring.scale.setScalar(r);
      ringMat.opacity = 0.45 * (1 - s.k) * Math.min(1, s.k * 8);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      arm.geometry.dispose();
      armMat.dispose();
      ring.geometry.dispose();
      ringMat.dispose();
      mirror?.dispose?.();
    },
  };
}
