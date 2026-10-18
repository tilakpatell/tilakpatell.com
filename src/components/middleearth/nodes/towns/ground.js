// ../../towns/ground.js on the node renderer: the same ground, tufts and
// puddles from the same arguments, on node materials. The puddles’ shader
// is the GLSL’s line for line in TSL, its uniforms uniform nodes under the
// GLSL’s names (the lamps’ two arrays eight uniforms each, behind a
// { value: [...] } of the same vectors, so setLights and a town’s sky
// write them as before). The tufts’ sway (shire/ground.js’s `swaying`, an
// onBeforeCompile) is copied as a node hook, not imported, since that file
// holds the water’s GLSL; canvasTexture is lib/three/stage3dNodes.js’s.
//
// The puddles’ fog is the scene’s on a node material (fog: true), and the
// tone map and output colour space the renderer’s own, as the chunks were.

import * as THREE from "three";
import {
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import {
  Fn,
  abs,
  attribute,
  cameraPosition,
  cos,
  dot,
  float,
  floor,
  fract,
  length,
  max,
  mix,
  normalize,
  positionGeometry,
  positionWorld,
  pow,
  reflect,
  select,
  sin,
  smoothstep,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { canvasTexture } from "../../../../lib/three/stage3dNodes";
import {
  fbm,
  makeCanvas,
  makeNoise,
  normalFromField,
  paintPixels,
} from "../../../../lib/paint";
import {
  follow,
  instanceMatrixOf,
  onPosition,
} from "../../../../lib/three/hookNodes";

// A tiling detail texture and its relief: mottled earth and grass, with a
// few pebbles and footprints of wet; `blades` streaks it like grass.
function detailTextures(renderer, { blades = 0.3, repeat = 48 } = {}) {
  const size = 256;
  const n = makeNoise(9);
  const field = new Float32Array(size * size);
  const c = makeCanvas(size);
  paintPixels(c, (u, v, out, x, y) => {
    const streak = fbm(n, u * 64, v * 16, { period: 64, octaves: 2 });
    const clumps = fbm(n, u * 8 + 3, v * 8, { period: 8, octaves: 3 });
    const fine = fbm(n, u * 128, v * 128, { period: 128, octaves: 1 });
    const pebble =
      Math.max(
        0,
        fbm(n, u * 40 + 9, v * 40, { period: 40, octaves: 1 }) - 0.72,
      ) * 3;
    const h =
      streak * blades + clumps * (0.75 - blades) + fine * 0.15 + pebble * 0.3;
    field[y * size + x] = h;
    const k = 0.74 + h * 0.46;
    out[0] = 206 * k;
    out[1] = 208 * k;
    out[2] = 192 * k;
  });
  return {
    map: canvasTexture(c, renderer, { repeat: [repeat, repeat] }),
    normalMap: canvasTexture(
      normalFromField(field, size, size, 2.4),
      renderer,
      {
        repeat: [repeat, repeat],
        srgb: false,
      },
    ),
  };
}

// The ground: a square `size` across, `seg` squares a side, raised by
// height(x, z) and coloured by paint(x, z, h, out) (out: [r, g, b], 0…1).
export function makeTerrain(
  renderer,
  { size, seg = 180, height, paint, blades, roughness = 0.94 },
) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(
    -Math.PI / 2,
  );
  const p = geo.attributes.position;
  const colours = new Float32Array(p.count * 3);
  const out = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const h = height(x, z);
    p.setY(i, h);
    paint(x, z, h, out);
    colours.set(out, i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const tex = detailTextures(renderer, { blades });
  const material = new MeshStandardNodeMaterial({
    vertexColors: true,
    map: tex.map,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = "terrain";
  return mesh;
}

// Grass tufts: crossed blades, dark at the root, paler at the tip.
function tuftGeometry(base, tip) {
  const pos = [];
  const col = [];
  const b0 = new THREE.Color(base);
  const t0 = new THREE.Color(tip);
  for (let b = 0; b < 4; b++) {
    const a = (b / 4) * Math.PI + 0.3;
    const ca = Math.cos(a) * 0.05;
    const sa = Math.sin(a) * 0.05;
    const lean = 0.05 * (b - 1.5);
    const h = 0.28 + (b % 2) * 0.1;
    const tx = lean + Math.cos(a + 1.2) * 0.02;
    const tz = lean * 0.5 + Math.sin(a + 1.2) * 0.02;
    pos.push(
      -ca,
      0,
      -sa,
      ca,
      0,
      sa,
      tx,
      h,
      tz,
      ca,
      0,
      sa,
      -ca,
      0,
      -sa,
      tx,
      h,
      tz,
    );
    for (let k = 0; k < 2; k++)
      col.push(b0.r, b0.g, b0.b, b0.r, b0.g, b0.b, t0.r, t0.g, t0.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  return g;
}

// shire/ground.js’s `swaying`, as a hook on the vertex before three
// instances it: the blade’s top pushed about by the clock in uWind, its
// phase from where its tuft stands (the instance’s origin, or the mesh’s)
function swaying(material, uniforms, strength = 0.12) {
  const uWind = follow(uniforms.uWind);
  onPosition(
    material,
    (p, builder) => {
      const im = instanceMatrixOf(builder);
      const root = im ? im.mul(vec4(0, 0, 0, 1)).xyz : vec3(0, 0, 0);
      const bend = positionGeometry.y.mul(positionGeometry.y);
      return vec3(
        p.x.add(
          sin(uWind.mul(1.7).add(root.x.mul(0.35)).add(root.z.mul(0.2)))
            .mul(Number(strength.toFixed(3)))
            .mul(bend),
        ),
        p.y,
        p.z.add(
          cos(uWind.mul(1.3).add(root.z.mul(0.3)))
            .mul(Number((strength * 0.6).toFixed(3)))
            .mul(bend),
        ),
      );
    },
    `sway${strength}`,
    { uWind },
  );
  return material;
}

// `count` tufts scattered over a disc of `radius`, where growable(x, z) says,
// in squares of the world so the ones off screen aren’t drawn.
export function makeTufts(
  count,
  {
    radius,
    height,
    growable,
    seed = 99,
    base = 0x2f4a24,
    tip = 0x7a9a4a,
    hue = [0.22, 0.06],
  },
  wind,
) {
  const geo = tuftGeometry(base, tip);
  const material = new MeshLambertNodeMaterial({ vertexColors: true });
  swaying(material, wind, 0.4);
  const rand = rng(seed);
  const bins = new Map();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  for (let n = 0, tries = 0; n < count && tries < count * 8; tries++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!growable(x, z)) continue;
    const sc = 0.8 + rand() * 0.7;
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    s.set(sc, sc * (0.7 + rand() * 0.6), sc);
    v.set(x, height(x, z) - 0.03, z);
    m.compose(v, q, s);
    tint.setHSL(hue[0] + rand() * hue[1], 0.4, 0.5 + rand() * 0.2);
    const key = `${Math.floor(x / 18)},${Math.floor(z / 18)}`;
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push([m.clone(), tint.clone()]);
    n += 1;
  }
  const g = new THREE.Group();
  for (const list of bins.values()) {
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach(([mm, c], i) => {
      mesh.setMatrixAt(i, mm);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

// the GLSL’s hash
const hash = Fn(
  ([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)),
  "float",
);

// Puddles: [x, z, rx, rz, turn] each, a flat pool a hair over the mud. They
// hold the sky by the angle you see them at (more at a glance), glint with
// the lamps near them (up to eight: setLights), and ring with rain.
const MAX_LIGHTS = 8;
export function makePuddles(list, height) {
  const lightPos = Array.from(
    { length: MAX_LIGHTS },
    () => new THREE.Vector4(0, -100, 0, 0),
  );
  const lightCol = Array.from(
    { length: MAX_LIGHTS },
    () => new THREE.Color(0, 0, 0),
  );
  // (each lamp’s own uniform, reading the same vector the array holds)
  const posNodes = lightPos.map((l) => uniform(l));
  const colNodes = lightCol.map((c) => uniform(c));
  const uniforms = {
    uTime: uniform(0),
    uRain: uniform(1),
    uSky: uniform(new THREE.Color(0x3a4658)),
    uDeep: uniform(new THREE.Color(0x0e1216)),
    uLightPos: { value: lightPos, nodes: posNodes },
    uLightCol: { value: lightCol, nodes: colNodes },
    // (what the sky’s atmosphere writes to any water; unused here)
    uSun: uniform(new THREE.Vector3(0, 1, 0)),
    uSunColor: uniform(new THREE.Color()),
    uGlints: uniform(1),
  };
  const u = uniforms;
  const material = new MeshBasicNodeMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const vWorld = varying(positionWorld, "vWorld");
  const vLocal = varying(attribute("local", "vec2"), "vLocal");
  // the edge: soft and a little ragged
  const r = length(vLocal);
  const edge = smoothstep(
    float(0.78).sub(hash(floor(vLocal.mul(6))).mul(0.08)),
    1,
    r,
  ).oneMinus();
  material.maskNode = edge.greaterThan(0.01);
  material.colorNode = Fn(() => {
    // rings where drops land: cells that each ring out in turn
    const p = vWorld.xz.mul(2.2);
    const cell = floor(p);
    const wave = float(0).toVar();
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const c = cell.add(vec2(i, j));
        const h = hash(c);
        const t = fract(u.uTime.mul(h.mul(0.6).add(0.8)).add(h.mul(7)));
        const at = c.add(vec2(hash(c.add(3.1)), hash(c.add(7.7))));
        const d = length(p.sub(at));
        const tt = t.mul(1.2);
        wave.addAssign(
          sin(d.sub(tt).mul(22))
            .mul(t.oneMinus())
            .mul(smoothstep(0, 0.25, abs(d.sub(tt))).oneMinus()),
        );
      }
    const n = normalize(
      vec3(wave.mul(0.06).mul(u.uRain), 1, wave.mul(0.04).mul(u.uRain)),
    );
    const view = normalize(cameraPosition.sub(vWorld));
    const fres = pow(max(dot(n, view), 0).oneMinus(), 3);
    const col = mix(u.uDeep, u.uSky.mul(0.4), fres.mul(0.55).add(0.12)).toVar();
    // the lamps, mirrored: a long streak of each towards you
    const refl = reflect(view.negate(), n);
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const L = posNodes[i];
      const toL = L.xyz.sub(vWorld);
      const dist = length(toL);
      const c = max(dot(refl, toL.div(dist)), 0);
      // a sharp image of the lamp, and a softer smear of it in the ripples
      const s = pow(c, 900).mul(2.5).add(pow(c, 90).mul(0.18));
      // (the GLSL’s `if (L.w <= 0.0) continue;`)
      col.addAssign(
        select(
          L.w.greaterThan(0),
          colNodes[i].mul(s).mul(L.w).div(dist.mul(dist).mul(0.03).add(1)),
          vec3(0),
        ),
      );
    }
    return col;
  })();
  material.opacityNode = edge.mul(0.85);
  material.uniforms = uniforms;
  // one geometry for all: each puddle a disc, its own `local` coordinates
  const discs = [];
  for (const [x, z, rx, rz, turn] of list) {
    const g = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const local = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      local[i * 2] = lx;
      local[i * 2 + 1] = lz;
      const wx = x + lx * rx * Math.cos(turn) + lz * rz * Math.sin(turn);
      const wz = z - lx * rx * Math.sin(turn) + lz * rz * Math.cos(turn);
      pos.setXYZ(i, wx, height(wx, wz) + 0.035, wz);
    }
    g.setAttribute("local", new THREE.BufferAttribute(local, 2));
    g.deleteAttribute("uv");
    discs.push(g);
  }
  const merged = mergeDiscs(discs);
  const mesh = new THREE.Mesh(merged, material);
  mesh.renderOrder = 1;
  mesh.name = "puddles";
  // lights: [{ position: Vector3, color: Color, power }]
  const setLights = (lights) => {
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const l = lights[i];
      if (l) {
        uniforms.uLightPos.value[i].set(
          l.position.x,
          l.position.y,
          l.position.z,
          l.power ?? 1,
        );
        uniforms.uLightCol.value[i].copy(l.color);
      } else uniforms.uLightPos.value[i].w = 0;
    }
  };
  const update = (t, rain = 1) => {
    uniforms.uTime.value = t;
    uniforms.uRain.value = rain;
  };
  return { mesh, material, uniforms, setLights, update };
}

function mergeDiscs(list) {
  let total = 0;
  let idx = 0;
  for (const g of list) {
    total += g.attributes.position.count;
    idx += g.index.count;
  }
  const pos = new Float32Array(total * 3);
  const local = new Float32Array(total * 2);
  const normal = new Float32Array(total * 3);
  const index = new Uint32Array(idx);
  let o = 0;
  let k = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    local.set(g.attributes.local.array, o * 2);
    normal.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < g.index.count; i++) index[k++] = g.index.array[i] + o;
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("local", new THREE.BufferAttribute(local, 2));
  out.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}

// a seeded random, so a town’s grass is the same every visit
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
