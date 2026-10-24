// The Central Finite Curve's worlds (universes.js's MOONS), alive: each one's
// ground a shader that moves (rmWorldsGlsl.js), lit in the show's flat
// bands, and round it the things that make it that place, moving too:
// fireworks going up over Planet Squanch's party, Bird World's inked clouds
// drifting and its flocks wheeling round it in vees, Gear World's great ring
// gears turning against each other with little cogs in orbit, Charon going
// round Pluto, Snake Planet's serpents slithering round its middle, Nuptia
// 4's two wedding bands turning through each other, and the Immortality
// Field Resort's field shimmering, rings of light running over it.
// planets.js's BUILDERS takes these in, by id, like its own.
//
// RM_WORLDS → { [moon id]: (p, { u, T }) => void }

import * as THREE from 'three';
import { celShade } from './planetShading';
import { orbit, rng } from './kit';
import { RM_NOISE, RM_SURFACES } from './rmWorldsGlsl';

// (the colours are written as the show's, in sRGB: into light to be lit)
const SRGB = 'vec3 rmLin(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }';
const VERT_BASIC = `
varying vec3 vP;
varying vec3 vWN;
varying vec3 vViewN;
varying vec3 vViewPos;
void main() {
  vP = position;
  vWN = normalize(mat3(modelMatrix) * normal);
  vViewN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

// a mesh's material made a world's ground: its colour, glow and roughness
// from `glsl`'s rmSurface, worked out where it's drawn; lit in flat bands.
// `land`: a map of where its land is (white on black, the usual layout),
// read as uRmLand with RM_LAND defined (Cronenberg World's Earth coasts)
function wear(mesh, key, glsl, { p, sun, metal = 0, land = null }) {
  const time = { value: 0 };
  const sunU = { value: sun };
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: metal });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRmTime = time;
    shader.uniforms.uRmSun = sunU;
    if (land) shader.uniforms.uRmLand = { value: land };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRmP;\nvarying vec3 vRmN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRmP = position;\nvRmN = normalize(mat3(modelMatrix) * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uRmTime;\nuniform vec3 uRmSun;\nvarying vec3 vRmP;\nvarying vec3 vRmN;\n${land ? '#define RM_LAND\nuniform sampler2D uRmLand;\n' : ''}${SRGB}\n${RM_NOISE}\n${glsl}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 rmGlow = vec3(0.0);
        float rmRough = 1.0;
        float rmNight = smoothstep(0.08, -0.18, dot(normalize(vRmN), normalize(uRmSun)));
        diffuseColor.rgb = rmLin(rmSurface(normalize(vRmP), uRmTime, rmNight, rmGlow, rmRough));`,
      )
      // (matte: the show's planets have no glossy hot spot)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = max(rmRough, 0.65);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += rmLin(rmGlow);');
  };
  mat.customProgramCacheKey = () => `rmworld-${key}${land ? '-land' : ''}`;
  celShade(mat);
  mesh.material = mat;
  p.tick.push((t) => (time.value = t));
  return mat;
}

// the body itself, worn as its world
const ground = (p, u, { land = null } = {}) => wear(p.body, u.id, RM_SURFACES[u.id], { p, sun: p.sun, land });

// a flat brass-and-ink look for the made things round them (gears, rings)
const metal = (color, { rough = 0.4, metalness = 0.35, emissive = '#000000', glow = 0 } = {}) =>
  celShade(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness, emissive, emissiveIntensity: glow }));

// ── Planet Squanch: fireworks ──

const SPARK_VERT = `
uniform float uAge;
uniform float uSize;
uniform float uSpread;
varying float vA;
void main() {
  float k = clamp(uAge / 1.7, 0.0, 1.0);
  float go = 1.0 - pow(1.0 - k, 3.0);
  float own = 0.7 + 0.3 * fract(position.x * 91.7 + position.z * 37.1);
  vec3 pos = position * uSpread * go * own - vec3(0.0, 0.35 * uSpread * k * k, 0.0);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uSize * (1.0 - 0.5 * k) * 1100.0 / max(-mv.z, 0.001), 1.0, 22.0);
  vA = step(0.0, uAge) * (1.0 - smoothstep(0.55, 1.0, k));
}`;
const SPARK_FRAG = `
uniform vec3 uColor;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.05, length(c)) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * a, a);
  #include <colorspace_fragment>
}`;
const PARTY = ['#ff5ad1', '#ffe45a', '#5affc8', '#5ab4ff', '#ff8a3a', '#c88aff'];

function fireworks(p, r, { bursts = 5, sparks = 80 } = {}) {
  const rand = rng('squanch-fireworks');
  const dirs = new Float32Array(sparks * 3);
  for (let i = 0; i < sparks; i++) {
    const z = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    dirs.set([Math.cos(a) * s, z, Math.sin(a) * s], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(dirs, 3));
  const up = new THREE.Vector3(0, 1, 0);
  const list = [];
  for (let i = 0; i < bursts; i++) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      uniforms: { uAge: { value: -1 }, uSize: { value: r * 0.022 }, uSpread: { value: r * 0.2 }, uColor: { value: new THREE.Color(PARTY[i % PARTY.length]) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    p.group.add(pts);
    list.push({ pts, mat, at: i * 0.9 + rand() * 0.6 });
  }
  const dir = new THREE.Vector3();
  p.tick.push((t) => {
    for (const b of list) {
      const age = t - b.at;
      if (age > 1.8 || age < -10) {
        // somewhere else over the planet, a moment later, in another colour
        dir.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
        b.pts.position.copy(dir).multiplyScalar(r * (1.05 + rand() * 0.05));
        b.pts.quaternion.setFromUnitVectors(up, dir);
        b.mat.uniforms.uColor.value.set(PARTY[Math.floor(rand() * PARTY.length)]);
        b.at = t + 0.2 + rand() * 1.4;
      }
      b.mat.uniforms.uAge.value = t - b.at;
    }
  });
}

// ── Bird World: its clouds and its flocks ──

const CLOUD_FRAG = `
uniform float uTime;
uniform vec3 uSun;
varying vec3 vP;
varying vec3 vWN;
${SRGB}
${RM_NOISE}
void main() {
  vec3 q = rmTurn(normalize(vP), uTime * 0.018) * 5.5 + vec3(uTime * 0.02, 0.0, -uTime * 0.012);
  float f = rmShape(q) + 0.12 * rmNoise(q * 3.0);
  float ink = rmInk(f, 0.64);
  float a = smoothstep(0.635, 0.645, f);
  float ndl = dot(normalize(vWN), normalize(uSun));
  float lit = ndl > 0.35 ? 1.0 : ndl > 0.0 ? 0.8 : 0.32;
  vec3 col = mix(vec3(1.0) * lit, vec3(0.22, 0.27, 0.38) * lit, ink);
  float alpha = max(a * 0.93, ink * 0.8);
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(rmLin(col), alpha);
  #include <colorspace_fragment>
}`;

function clouds(p, r, small) {
  const time = { value: 0 };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT_BASIC, fragmentShader: CLOUD_FRAG, uniforms: { uTime: time, uSun: { value: p.sun } }, transparent: true, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, small ? 44 : 72, small ? 28 : 48), mat);
  sky.renderOrder = 1;
  p.group.add(sky);
  p.tick.push((t) => (time.value = t));
}

function flocks(p, r, { flights = 5, birds = 7 } = {}) {
  const rand = rng('bird-flocks');
  // a bird: two wings in a shallow vee, its nose −z, its span x
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.45, -1, 0.3, 0.3, 0, 0, 0.1, 0, 0, -0.45, 0, 0, 0.1, 1, 0.3, 0.3], 3));
  g.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#2b2433', side: THREE.DoubleSide }), flights * birds);
  mesh.frustumCulled = false;
  p.group.add(mesh);
  const groups = Array.from({ length: flights }, (_, i) => ({
    turn: new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 1.4 - 0.7, rand() * Math.PI * 2, rand() * 0.6 - 0.3)),
    R: r * (1.07 + rand() * 0.06),
    speed: (0.07 + rand() * 0.05) * (i % 2 ? 1 : -1),
    phase: rand() * Math.PI * 2,
    size: r * (0.04 + rand() * 0.012),
  }));
  const m = new THREE.Matrix4();
  const Y = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const upV = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const side = new THREE.Vector3();
  const back = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const q = new THREE.Quaternion();
  p.tick.push((t) => {
    let n = 0;
    for (const f of groups) {
      const a = f.phase + t * f.speed;
      const dirn = Math.sign(f.speed);
      for (let j = 0; j < birds; j++) {
        const rank = Math.ceil(j / 2);
        const lr = j === 0 ? 0 : j % 2 ? 1 : -1;
        // back along the way it's going, out to the side: a vee
        const aj = a - dirn * rank * (f.size * 1.6) / f.R;
        pos.set(Math.cos(aj), 0, -Math.sin(aj));
        upV.copy(pos);
        fwd.set(-Math.sin(aj), 0, -Math.cos(aj)).multiplyScalar(dirn);
        pos.multiplyScalar(f.R).addScaledVector(Y, lr * rank * f.size * 1.3);
        pos.applyQuaternion(f.turn);
        upV.applyQuaternion(f.turn);
        fwd.applyQuaternion(f.turn);
        side.crossVectors(fwd, upV).normalize();
        back.copy(fwd).negate();
        m.makeBasis(side, upV, back);
        q.setFromRotationMatrix(m);
        const flap = Math.sin(t * 9 + j * 1.7 + f.phase * 3);
        sc.set(f.size, f.size * flap * 1.2, f.size);
        m.compose(pos, q, sc);
        mesh.setMatrixAt(n++, m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}

// ── Gear World: ring gears and cogs ──

// a gear's outline: `teeth` teeth from rOut to rOut + tooth, a hole of rIn
function gearGeometry(rIn, rOut, teeth, tooth, thick) {
  const s = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  const at = (a, rr) => [Math.cos(a) * rr, Math.sin(a) * rr];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [at(a, rOut), at(a + step * 0.3, rOut), at(a + step * 0.4, rOut + tooth), at(a + step * 0.6, rOut + tooth), at(a + step * 0.7, rOut)];
    pts.forEach(([x, y], k) => (i === 0 && k === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 64 });
  g.translate(0, 0, -thick / 2);
  g.rotateX(Math.PI / 2);
  return g;
}

function gears(p, r) {
  const brass = metal('#c99a4c', { rough: 0.45, metalness: 0.45 });
  const copper = metal('#a8683a', { rough: 0.5, metalness: 0.4 });
  const rings = [
    { g: gearGeometry(r * 1.3, r * 1.4, 72, r * 0.06, r * 0.05), mat: brass, tilt: [0.32, 0, 0.1], speed: 0.05 },
    { g: gearGeometry(r * 1.55, r * 1.62, 84, r * 0.05, r * 0.04), mat: copper, tilt: [-0.42, 1.1, -0.15], speed: -0.042 },
  ].map((ring) => {
    const plane = new THREE.Group();
    plane.rotation.set(...ring.tilt);
    const mesh = new THREE.Mesh(ring.g, ring.mat);
    plane.add(mesh);
    p.group.add(plane);
    return { mesh, speed: ring.speed };
  });
  // little cogs in orbit, each turning on its own axle
  const cogGeo = gearGeometry(r * 0.04, r * 0.11, 12, r * 0.035, r * 0.05);
  const cogs = [0, 1, 2].map((i) => {
    const o = orbit(p.group, { radius: r * (2.1 + i * 0.35), tilt: 0.3 - i * 0.25, yaw: i * 2.1, speed: 0.11 - i * 0.025, phase: i * 2 });
    const cog = new THREE.Mesh(cogGeo, i === 1 ? copper : brass);
    cog.rotation.x = 0.6 + i;
    o.holder.add(cog);
    p.orbits.push(o);
    return cog;
  });
  p.tick.push((t) => {
    for (const ring of rings) ring.mesh.rotation.y = t * ring.speed;
    cogs.forEach((c, i) => (c.rotation.y = t * (0.9 + i * 0.3) * (i % 2 ? -1 : 1)));
  });
}

// ── Pluto: Charon ──

const CHARON = `
vec3 rmSurface(vec3 p, float t, float night, inout vec3 glow, inout float rough) {
  float h = rmFbm(p * 3.0 + 2.0);
  vec3 col = mix(vec3(0.66, 0.65, 0.66), vec3(0.5, 0.49, 0.52), step(0.52, h));
  float cap = smoothstep(0.62, 0.66, p.y + 0.06 * rmNoise(p * 6.0));
  col = mix(col, vec3(0.48, 0.24, 0.18), cap);
  float ink = max(rmInk(h, 0.52), rmInk(p.y + 0.06 * rmNoise(p * 6.0), 0.64));
  vec2 c = rmCells(p * 6.0);
  ink = max(ink, rmInk(c.x, 0.2) * step(0.65, c.y));
  rough = 0.9;
  return col * (1.0 - 0.75 * ink);
}`;

function charon(p, r, small) {
  const o = orbit(p.group, { radius: r * 2.5, tilt: 0.22, yaw: 0.5, speed: 0.09, phase: 1.2 });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(r * 0.42, small ? 32 : 48, small ? 20 : 32));
  wear(moon, 'charon', CHARON, { p, sun: p.sun });
  o.holder.add(moon);
  p.orbits.push(o);
}

// ── Snake Planet: its serpents ──

const SERPENT_VERT = `
attribute vec2 sv;
uniform float uTime;
uniform float uR;
uniform float uThick;
uniform float uLen;
uniform float uSpeed;
uniform float uAmp;
uniform float uWaves;
uniform float uPhase;
varying vec2 vSv;
varying vec3 vWN;
varying vec3 vViewN;
varying vec3 vViewPos;
vec3 spine(float s) {
  float phi = uPhase + s * uLen + uTime * uSpeed;
  float lat = uAmp * sin(s * uWaves * 6.2832 - uTime * 2.4);
  return vec3(cos(phi) * cos(lat), sin(lat), -sin(phi) * cos(lat)) * uR;
}
void main() {
  float s = sv.x;
  float th = sv.y;
  vec3 c = spine(s);
  vec3 T = normalize(spine(s + 0.003) - c);
  vec3 N = normalize(c);
  vec3 B = normalize(cross(T, N));
  N = normalize(cross(B, T));
  float body = mix(0.1, 1.0, smoothstep(0.0, 0.5, s));
  float head = 1.0 + 0.4 * smoothstep(0.9, 0.96, s) - 0.85 * smoothstep(0.97, 1.0, s);
  vec3 nrm = N * cos(th) + B * sin(th);
  vec3 pos = c + nrm * uThick * body * head;
  vSv = sv;
  vWN = normalize(mat3(modelMatrix) * nrm);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vViewPos = -mv.xyz;
  vViewN = normalize(normalMatrix * nrm);
  gl_Position = projectionMatrix * mv;
}`;
const SERPENT_FRAG = `
uniform vec3 uSun;
uniform vec3 uBack;
uniform vec3 uMark;
uniform vec3 uBelly;
varying vec2 vSv;
varying vec3 vWN;
varying vec3 vViewN;
varying vec3 vViewPos;
${SRGB}
void main() {
  float s = vSv.x;
  float up = cos(vSv.y);
  float ndl = dot(normalize(vWN), normalize(uSun));
  float lit = ndl > 0.35 ? 1.0 : ndl > 0.0 ? 0.76 : 0.4;
  float dia = abs(fract(s * 70.0) - 0.5) * 2.0 + (1.0 - up) * 1.6;
  vec3 col = mix(uBack, uMark, step(dia, 0.85));
  col = mix(col, uBelly, step(up, 0.05));
  float eye = step(0.952, s) * step(s, 0.968) * step(abs(abs(sin(vSv.y)) - 0.72), 0.16) * step(0.0, up);
  col = mix(col, vec3(1.0, 0.86, 0.2), eye);
  col = mix(col, vec3(0.05), eye * step(abs(fract(s * 300.0) - 0.5), 0.12));
  float ink = 1.0 - smoothstep(0.2, 0.36, abs(dot(normalize(vViewN), normalize(vViewPos))));
  col = mix(col * lit, vec3(0.05, 0.08, 0.04), ink * 0.92);
  gl_FragColor = vec4(rmLin(col), 1.0);
  #include <colorspace_fragment>
}`;

function serpentGeometry(along = 180, round = 10) {
  const sv = [];
  const index = [];
  for (let i = 0; i <= along; i++) for (let j = 0; j <= round; j++) sv.push(i / along, (j / round) * Math.PI * 2);
  for (let i = 0; i < along; i++)
    for (let j = 0; j < round; j++) {
      const a = i * (round + 1) + j;
      const b = a + round + 1;
      index.push(a, a + 1, b, b, a + 1, b + 1); // (wound so its outside faces out)
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(sv.length * 1.5), 3)); // (placed by the shader)
  g.setAttribute('sv', new THREE.Float32BufferAttribute(sv, 2));
  g.setIndex(index);
  return g;
}

function serpents(p, r, small) {
  const geo = serpentGeometry(small ? 120 : 180, small ? 8 : 10);
  const time = { value: 0 };
  const kinds = [
    { tilt: [0.25, 0, 0.12], phase: 0, speed: 0.06, back: '#5fb043', mark: '#1f5a24', belly: '#e8dc7a' },
    { tilt: [-0.5, 2.0, 0.3], phase: 2.6, speed: -0.05, back: '#3a9a86', mark: '#15483f', belly: '#e6e0a0' },
  ];
  for (const k of kinds) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: SERPENT_VERT,
      fragmentShader: SERPENT_FRAG,
      uniforms: {
        uTime: time,
        uR: { value: r * 1.02 },
        uThick: { value: r * 0.075 },
        uLen: { value: Math.sign(k.speed) * 1.9 },
        uSpeed: { value: k.speed },
        uAmp: { value: 0.07 },
        uWaves: { value: 3.5 },
        uPhase: { value: k.phase },
        uSun: { value: p.sun },
        uBack: { value: new THREE.Color(k.back) },
        uMark: { value: new THREE.Color(k.mark) },
        uBelly: { value: new THREE.Color(k.belly) },
      },
    });
    // (the colours are the show's, in sRGB, as the shader takes them)
    for (const c of ['uBack', 'uMark', 'uBelly']) mat.uniforms[c].value.convertLinearToSRGB();
    const snake = new THREE.Mesh(geo, mat);
    snake.frustumCulled = false;
    const plane = new THREE.Group();
    plane.rotation.set(...k.tilt);
    plane.add(snake);
    p.body.add(plane); // (on the ground, turning with it)
  }
  p.tick.push((t) => (time.value = t));
}

// ── Nuptia 4: its wedding bands ──

function bands(p, r) {
  const pair = new THREE.Group();
  pair.rotation.set(0.5, 0, 0.25);
  p.group.add(pair);
  const gold = metal('#f2c14e', { rough: 0.3, metalness: 0.55 });
  const rose = metal('#f0b8c8', { rough: 0.3, metalness: 0.5 });
  const a = new THREE.Mesh(new THREE.TorusGeometry(r * 1.5, r * 0.04, 12, 160), gold);
  const b = new THREE.Mesh(new THREE.TorusGeometry(r * 1.58, r * 0.035, 12, 160), rose);
  a.rotation.x = Math.PI / 2;
  b.rotation.set(Math.PI / 2 + 0.55, 0.3, 0);
  pair.add(a, b);
  // the stone, set on the gold one, catching the light
  const stone = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.12), new THREE.MeshStandardMaterial({ color: '#e8f8ff', emissive: '#bfe8ff', emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.2, flatShading: true }));
  stone.position.set(r * 1.5, 0, 0);
  stone.scale.y = 1.4;
  a.add(stone);
  p.tick.push((t) => {
    a.rotation.z = t * 0.06;
    b.rotation.z = -t * 0.045;
    pair.rotation.y = t * 0.02;
    stone.rotation.z = t * 0.8;
    stone.material.emissiveIntensity = 0.4 + 0.9 * Math.max(0, Math.sin(t * 1.9)) ** 8;
  });
}

// ── The Resort: its immortality field ──

const FIELD_FRAG = `
uniform float uTime;
varying vec3 vP;
varying vec3 vViewN;
varying vec3 vViewPos;
${SRGB}
${RM_NOISE}
void main() {
  vec3 n = normalize(vP);
  float fres = pow(1.0 - abs(dot(normalize(vViewN), normalize(vViewPos))), 2.4);
  vec2 c = rmCells(n * 9.0);
  float web = smoothstep(0.4, 0.5, c.x);
  vec3 P = normalize(vec3(0.3, 0.8, 0.5));
  float ang = acos(clamp(dot(n, P), -1.0, 1.0));
  float k = fract(uTime * 0.11) * 3.14159;
  float ring = smoothstep(0.09, 0.0, abs(ang - k)) * (1.0 - smoothstep(2.6, 3.1, k));
  float k2 = fract(uTime * 0.11 + 0.5) * 3.14159;
  ring = max(ring, smoothstep(0.07, 0.0, abs(ang - k2)) * 0.6 * (1.0 - smoothstep(2.6, 3.1, k2)));
  float a = fres * 0.42 + web * 0.12 * (0.4 + fres) * (0.75 + 0.25 * sin(uTime * 1.3 + c.y * 9.0)) + ring * 0.55 * (0.35 + fres);
  vec3 col = mix(vec3(0.55, 1.0, 0.95), vec3(1.0, 0.93, 0.62), ring);
  gl_FragColor = vec4(rmLin(col) * a, a);
  #include <colorspace_fragment>
}`;

function field(p, r, small) {
  const time = { value: 0 };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT_BASIC, fragmentShader: FIELD_FRAG, uniforms: { uTime: time }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, small ? 44 : 72, small ? 28 : 48), mat);
  dome.renderOrder = 3;
  p.group.add(dome);
  p.tick.push((t) => (time.value = t));
}

// ── The worlds ──

export const RM_WORLDS = {
  gazorpazorp(p, { u }) {
    ground(p, u);
  },
  squanch(p, { u, T }) {
    ground(p, u);
    fireworks(p, u.size, T.small ? { bursts: 3, sparks: 50 } : undefined);
  },
  birdworld(p, { u, T }) {
    ground(p, u);
    clouds(p, u.size, T.small);
    flocks(p, u.size, T.small ? { flights: 3, birds: 5 } : undefined);
  },
  gearworld(p, { u }) {
    ground(p, u);
    p.body.material.metalness = 0.25;
    gears(p, u.size);
  },
  pluto(p, { u, T }) {
    ground(p, u);
    charon(p, u.size, T.small);
  },
  snakeplanet(p, { u, T }) {
    ground(p, u);
    serpents(p, u.size, T.small);
  },
  nuptia(p, { u }) {
    ground(p, u);
    bands(p, u.size);
  },
  resort(p, { u, T }) {
    ground(p, u);
    field(p, u.size, T.small);
  },
  // (their grounds are all they need: the flesh breathes, the villages burn;
  // Cronenberg World's on the real Earth's coasts, C-137's own: scripts/planets/cronenberg.mjs)
  cronenberg(p, { u, T }) {
    ground(p, u, { land: T['cronenberg-land'] ?? null });
  },
  purge(p, { u }) {
    ground(p, u);
  },
};
