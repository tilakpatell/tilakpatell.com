// A town's ground in WebGL, from the town's own `height` and `paint`: one
// shaped mesh painted in its vertex colours over a fine detail texture,
// grass tufts where grass grows (instanced, swaying), and puddles that hold
// the sky and the lamps, rippling in the rain.

import * as THREE from 'three';
import { canvasTexture } from '../../../lib/stage3d';
import { fbm, makeCanvas, makeNoise, normalFromField, paintPixels } from '../../../lib/paint';
import { swaying } from '../shire/ground';

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
    const pebble = Math.max(0, fbm(n, u * 40 + 9, v * 40, { period: 40, octaves: 1 }) - 0.72) * 3;
    const h = streak * blades + clumps * (0.75 - blades) + fine * 0.15 + pebble * 0.3;
    field[y * size + x] = h;
    const k = 0.74 + h * 0.46;
    out[0] = 206 * k;
    out[1] = 208 * k;
    out[2] = 192 * k;
  });
  return {
    map: canvasTexture(c, renderer, { repeat: [repeat, repeat] }),
    normalMap: canvasTexture(normalFromField(field, size, size, 2.4), renderer, { repeat: [repeat, repeat], srgb: false }),
  };
}

// The ground: a square `size` across, `seg` squares a side, raised by
// height(x, z) and coloured by paint(x, z, h, out) (out: [r, g, b], 0…1).
export function makeTerrain(renderer, { size, seg = 180, height, paint, blades, roughness = 0.94 }) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
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
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const tex = detailTextures(renderer, { blades });
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness });
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
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
    pos.push(-ca, 0, -sa, ca, 0, sa, tx, h, tz, ca, 0, sa, -ca, 0, -sa, tx, h, tz);
    for (let k = 0; k < 2; k++) col.push(b0.r, b0.g, b0.b, b0.r, b0.g, b0.b, t0.r, t0.g, t0.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

// `count` tufts scattered over a disc of `radius`, where growable(x, z) says,
// in squares of the world so the ones off screen aren't drawn.
export function makeTufts(count, { radius, height, growable, seed = 99, base = 0x2f4a24, tip = 0x7a9a4a, hue = [0.22, 0.06] }, wind) {
  const geo = tuftGeometry(base, tip);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
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

// Puddles: [x, z, rx, rz, turn] each, a flat pool a hair over the mud. They
// hold the sky by the angle you see them at (more at a glance), glint with
// the lamps near them (up to eight: setLights), and ring with rain.
const MAX_LIGHTS = 8;
export function makePuddles(list, height) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uRain: { value: 1 },
      uSky: { value: new THREE.Color(0x3a4658) },
      uDeep: { value: new THREE.Color(0x0e1216) },
      uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4(0, -100, 0, 0)) },
      uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
      // (what the sky's atmosphere writes to any water; unused here)
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uGlints: { value: 1 },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    vertexShader: `
      #include <fog_pars_vertex>
      attribute vec2 local;
      varying vec3 vWorld;
      varying vec2 vLocal;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vLocal = local;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime, uRain;
      uniform vec3 uSky, uDeep;
      uniform vec4 uLightPos[${MAX_LIGHTS}];
      uniform vec3 uLightCol[${MAX_LIGHTS}];
      varying vec3 vWorld;
      varying vec2 vLocal;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        // the edge: soft and a little ragged
        float r = length(vLocal);
        float edge = 1.0 - smoothstep(0.78 - hash(floor(vLocal * 6.0)) * 0.08, 1.0, r);
        if (edge <= 0.01) discard;
        // rings where drops land: cells that each ring out in turn
        vec2 p = vWorld.xz * 2.2;
        vec2 cell = floor(p);
        float wave = 0.0;
        for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
          vec2 c = cell + vec2(float(i), float(j));
          float h = hash(c);
          float t = fract(uTime * (0.8 + h * 0.6) + h * 7.0);
          vec2 at = c + vec2(hash(c + 3.1), hash(c + 7.7));
          float d = length(p - at);
          wave += sin((d - t * 1.2) * 22.0) * (1.0 - t) * (1.0 - smoothstep(0.0, 0.25, abs(d - t * 1.2)));
        }
        vec3 n = normalize(vec3(wave * 0.06 * uRain, 1.0, wave * 0.04 * uRain));
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky * 0.4, 0.12 + 0.55 * fres);
        // the lamps, mirrored: a long streak of each towards you
        vec3 refl = reflect(-view, n);
        for (int i = 0; i < ${MAX_LIGHTS}; i++) {
          vec4 L = uLightPos[i];
          if (L.w <= 0.0) continue;
          vec3 toL = L.xyz - vWorld;
          float dist = length(toL);
          float c = max(dot(refl, toL / dist), 0.0);
          // a sharp image of the lamp, and a softer smear of it in the ripples
          float s = pow(c, 900.0) * 2.5 + pow(c, 90.0) * 0.18;
          col += uLightCol[i] * s * L.w / (1.0 + dist * dist * 0.03);
        }
        gl_FragColor = vec4(col, edge * 0.85);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
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
    g.setAttribute('local', new THREE.BufferAttribute(local, 2));
    g.deleteAttribute('uv');
    discs.push(g);
  }
  const merged = mergeDiscs(discs);
  const mesh = new THREE.Mesh(merged, material);
  mesh.renderOrder = 1;
  mesh.name = 'puddles';
  // lights: [{ position: Vector3, color: Color, power }]
  const setLights = (lights) => {
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const l = lights[i];
      if (l) {
        uniforms.uLightPos.value[i].set(l.position.x, l.position.y, l.position.z, l.power ?? 1);
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
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('local', new THREE.BufferAttribute(local, 2));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}

// a seeded random, so a town's grass is the same every visit
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
