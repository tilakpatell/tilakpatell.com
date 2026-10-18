// ../../towns/rain.js on the node renderer: the same streaks in a box that
// follows the camera and the same splashes, their shaders line for line in
// TSL, the same arguments, draws from Math.random and uniforms (uniform
// nodes under the GLSL’s names, so a town’s `.value` writes still land).
//
// The node renderer draws a point one pixel wide, so a splash is a sprite
// instanced once a splash (three’s PointsNodeMaterial on a Sprite with a
// count), its size the GLSL’s gl_PointSize. The streaks are line segments,
// as before, put where the GLSL put them: in the world, past the model’s
// matrix. The tone map and the output colour space are the renderer’s own,
// as the GLSL’s chunks were; neither material ever took fog.

import * as THREE from "three";
import { LineBasicNodeMaterial, PointsNodeMaterial } from "three/webgpu";
import {
  attribute,
  cameraViewMatrix,
  clamp,
  floor,
  instancedBufferAttribute,
  length,
  normalize,
  positionView,
  screenDPR,
  smoothstep,
  step,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { wrap } from "../../../../lib/three/hookNodes";

// GLSL’s mod (floored, for the negatives too: WGSL’s % is not)
const mod = (a, b) => a.sub(b.mul(floor(a.div(b))));

export function makeRain({
  count = 4000,
  size = [36, 22, 36],
  speed = 14,
  len = 0.6,
  splashes = 220,
  height = () => 0,
} = {}) {
  const group = new THREE.Group();
  group.name = "rain";

  // ── the streaks ──
  const geo = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 2 * 4);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const s = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let e = 0; e < 2; e++) {
      seed.set(s, (i * 2 + e) * 4);
      end[i * 2 + e] = e;
    }
  }
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3),
  );
  geo.setAttribute("seed", new THREE.BufferAttribute(seed, 4));
  geo.setAttribute("end", new THREE.BufferAttribute(end, 1));
  const uniforms = {
    uCam: uniform(new THREE.Vector3()),
    uTime: uniform(0),
    uSize: uniform(new THREE.Vector3(...size)),
    uSpeed: uniform(speed),
    uLen: uniform(len),
    uWind: uniform(new THREE.Vector2(1.6, 0.7)),
    uAmount: uniform(1),
    uColor: uniform(new THREE.Color(0.75, 0.8, 0.9)),
    uOpacity: uniform(0.32),
  };
  const u = uniforms;
  const material = new LineBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const aSeed = attribute("seed", "vec4");
  const aEnd = attribute("end", "float");
  const pace = aSeed.w.mul(0.3).add(0.85);
  const q = vec3(
    aSeed.x.mul(u.uSize.x).add(u.uWind.x.mul(u.uTime).mul(pace)),
    aSeed.y.mul(u.uSize.y).sub(u.uTime.mul(u.uSpeed).mul(pace)),
    aSeed.z.mul(u.uSize.z).add(u.uWind.y.mul(u.uTime).mul(pace)),
  );
  const rel = mod(q.sub(u.uCam).add(u.uSize.mul(0.5)), u.uSize).sub(
    u.uSize.mul(0.5),
  );
  const dir = normalize(vec3(u.uWind.x, u.uSpeed.negate(), u.uWind.y));
  const wp = u.uCam.add(rel).sub(dir.mul(u.uLen).mul(pace).mul(aEnd));
  // (the GLSL’s projectionMatrix * viewMatrix * wp: in the world, whatever the group’s matrix)
  wrap(
    material,
    "setupPositionView",
    () => cameraViewMatrix.mul(vec4(wp, 1)).xyz,
    "middleearth:rain",
  );
  // thinner far off, none past how hard it’s raining
  const fade = smoothstep(
    u.uSize.x.mul(0.28),
    u.uSize.x.mul(0.5),
    length(rel.xz),
  ).oneMinus();
  const vAlpha = varying(
    step(aSeed.w, u.uAmount).mul(fade).mul(aEnd.mul(0.85).add(0.15)),
    "vAlpha",
  );
  material.colorNode = u.uColor;
  material.opacityNode = vAlpha.mul(u.uOpacity);
  material.uniforms = uniforms;
  const streaks = new THREE.LineSegments(geo, material);
  streaks.frustumCulled = false;
  streaks.renderOrder = 3;
  group.add(streaks);

  // ── the splashes: little rings on the ground, each living a moment, then
  // starting again somewhere else near you ──
  const n = Math.max(0, splashes);
  const sPos = new Float32Array(n * 3);
  const born = new Float32Array(n);
  const life = new Float32Array(n);
  // (one sprite a splash: its place, birth and life instance attributes)
  const iPos = new THREE.InstancedBufferAttribute(sPos, 3).setUsage(
    THREE.DynamicDrawUsage,
  );
  const iBorn = new THREE.InstancedBufferAttribute(born, 1).setUsage(
    THREE.DynamicDrawUsage,
  );
  const iLife = new THREE.InstancedBufferAttribute(life, 1).setUsage(
    THREE.DynamicDrawUsage,
  );
  const sUniforms = {
    uTime: uniform(0),
    uAmount: uniforms.uAmount,
    uColor: uniforms.uColor,
    uScale: uniform(300),
  };
  const su = sUniforms;
  const sMat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    sizeAttenuation: false,
  });
  sMat.positionNode = instancedBufferAttribute(iPos);
  const k = clamp(
    su.uTime
      .sub(instancedBufferAttribute(iBorn))
      .div(instancedBufferAttribute(iLife)),
    0,
    1,
  );
  const vK = varying(k, "vK");
  // gl_PointSize, in the canvas’s pixels (three’s sprite multiplies by the DPR again)
  sMat.sizeNode = k
    .mul(0.32)
    .add(0.08)
    .mul(su.uScale)
    .div(positionView.z.negate())
    .div(screenDPR);
  const p = uv().mul(2).sub(1);
  // flattened: rings lying on the ground, seen at a slant
  const r = length(p.mul(vec2(1, 2.6)));
  const ring = smoothstep(0.62, 0.8, r).mul(smoothstep(0.8, 1, r).oneMinus());
  sMat.colorNode = su.uColor;
  sMat.opacityNode = ring.mul(vK.oneMinus()).mul(0.5).mul(su.uAmount);
  sMat.uniforms = sUniforms;
  const splash = new THREE.Sprite(sMat);
  splash.count = n;
  splash.frustumCulled = false;
  splash.renderOrder = 3;
  if (n) group.add(splash);
  for (let i = 0; i < n; i++) born[i] = -Math.random();

  // each frame: follow the camera; `focus` is where the splashes ring out
  // (the walker), `amount` 0…1 how hard it rains
  const update = (camera, t, amount = 1, focus = camera.position) => {
    uniforms.uCam.value.copy(camera.position);
    uniforms.uTime.value = t;
    uniforms.uAmount.value = amount;
    sUniforms.uTime.value = t;
    group.visible = amount > 0.01;
    if (!n || !group.visible) return;
    let moved = false;
    for (let i = 0; i < n; i++) {
      if (t - born[i] < life[i]) continue;
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * 9;
      const x = focus.x + Math.cos(a) * rr;
      const z = focus.z + Math.sin(a) * rr;
      sPos[i * 3] = x;
      sPos[i * 3 + 1] = height(x, z) + 0.03;
      sPos[i * 3 + 2] = z;
      born[i] = t + Math.random() * 0.3;
      life[i] = 0.32 + Math.random() * 0.2;
      moved = true;
    }
    if (moved) {
      iPos.needsUpdate = true;
      iBorn.needsUpdate = true;
      iLife.needsUpdate = true;
    }
  };

  // how bright: the rain catches the light it falls through
  const tint = (r, g, b, opacity) => {
    uniforms.uColor.value.setRGB(r, g, b);
    if (opacity != null) uniforms.uOpacity.value = opacity;
  };

  return { group, update, tint, uniforms };
}
