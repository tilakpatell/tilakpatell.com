// What the crews' ship powers look like (shipPowers.js says what they do;
// the scene's glue, powers.js, says where and when): Artoo's
// torpedoes, hot orange streaks; Rick's death ray, a green beam with light
// crawling down it; the RV's magnet, rings of blue spinning round the point
// it drags the fighters to; Walt's crystal, a spinning blue gem; and its
// bang's shockwave, a shell of blue light swelling out and fading.
// Each is made once and hidden while it isn't wanted, so a ship whose powers
// aren't on draws nothing more than it did. The rest is the scene's already:
// Chewie's bolts and the flashes are the galaxy's fx pools (fx.js), the
// portals crash.js's swirl, Force Focus the post's (post.js).
//
// createPowerFx(parent) → { torpedoes(list), beam(from, to), magnet(at, k),
//   crystal(at, k), shock(at, r), update(dt) → busy, busy, clear(), dispose() }
// torpedoes takes [{ x, y, z, vx, vy, vz }] (at most TORPEDOES of them); the
// others take null to put it away. Points are { x, y, z } in `parent`'s
// space (the map's, where the ship flies).

import * as THREE from 'three';

const TORPEDOES = 4;
const ORANGE = new THREE.Color('#ff7a3a');
const GREEN = new THREE.Color('#8dff5a');
const BLUE = new THREE.Color(0.55, 1.5, 3.4);
const Z = new THREE.Vector3(0, 0, 1);
const SHOCK = 0.55; // seconds a shockwave takes to swell and fade

// a beam or a shell lit by how squarely it faces you: bright down its
// middle, soft at its edges (the death ray), or bright at its rim (the
// shockwave); light crawling down a beam's length
const FACING_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz;
  vN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;
// (the beam's facing is taken across it, with the view's share along its
// length taken out: from the chase camera you look nearly down the ray,
// and the plain facing would have it dark all along. Its own vertex
// shader hands on its length's direction for that. It fades in from the
// nose, so the open end of the tube you look into isn't a rim, and in from
// the camera, and both its sides share the light: so close, the whole of
// it would bloom over the picture)
const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying vec3 vA;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz;
  vN = normalMatrix * normal;
  vA = (modelViewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz;
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uLen;
uniform float uK;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying vec3 vA;
void main() {
  vec3 v = normalize(vV);
  vec3 a = normalize(vA);
  vec3 across = v - dot(v, a) * a;
  float l = length(across);
  float facing = l < 1e-4 ? 1.0 : abs(dot(normalize(vN), across / l));
  float core = facing * facing * facing;
  float crawl = 0.7 + 0.3 * sin(vUv.y * uLen * 5.0 - uTime * 42.0);
  vec3 col = uColor * (0.2 + 1.6 * core) * crawl + vec3(1.6, 1.8, 1.5) * pow(facing, 8.0);
  float near = smoothstep(0.4, 3.0, length(vV)) * smoothstep(0.0, 0.5, vUv.y * uLen) * smoothstep(0.0, 0.4, (1.0 - vUv.y) * uLen);
  gl_FragColor = vec4(col * facing * near * 0.5 * uK, 1.0);
}`;
const SHELL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uK;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float r2 = rim * rim;
  gl_FragColor = vec4(uColor * r2 * r2 * 1.5 * uK, 1.0);
}`;

const glow = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const facing = (frag, uniforms, more = {}) => new THREE.ShaderMaterial({ vertexShader: FACING_VERT, fragmentShader: frag, uniforms, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, ...more });

export function createPowerFx(parent) {
  const made = [];
  const keep = (...things) => (made.push(...things), things[0]);
  const hidden = (o, name) => {
    o.name = `power:${name}`; // (for checking from a browser that none is drawn while idle)
    o.visible = false;
    o.frustumCulled = false;
    parent.add(o);
    return o;
  };

  // the torpedoes: a long glow behind a white-hot core, each along its way
  const torpGeo = keep(new THREE.SphereGeometry(1, 10, 6));
  const tail = hidden(new THREE.InstancedMesh(torpGeo, keep(glow(ORANGE.clone().multiplyScalar(3))), TORPEDOES), 'torpedo-tails');
  const head = hidden(new THREE.InstancedMesh(torpGeo, keep(glow(new THREE.Color(6, 4.2, 2.4))), TORPEDOES), 'torpedo-heads');
  for (const m of [tail, head]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
  }

  // the death ray: a beam from the nose to whatever it's into (both its
  // sides drawn: it's an open tube, and from behind the ship you look into
  // its end, which would otherwise be a hole)
  const beamMat = keep(facing(BEAM_FRAG, { uColor: { value: GREEN.clone().multiplyScalar(2.2) }, uTime: { value: 0 }, uLen: { value: 1 }, uK: { value: 0 } }, { vertexShader: BEAM_VERT, side: THREE.DoubleSide }));
  const ray = hidden(new THREE.Mesh(keep(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).rotateX(Math.PI / 2)), beamMat), 'ray');

  // the magnet: three rings round its point, each spinning its own way
  const rings = hidden(new THREE.InstancedMesh(keep(new THREE.TorusGeometry(1, 0.022, 6, 48)), keep(glow(BLUE.clone())), 3), 'magnet');
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const ringAxes = [new THREE.Vector3(1, 0.2, 0).normalize(), new THREE.Vector3(0, 1, 0.3).normalize(), new THREE.Vector3(0.3, 0, 1).normalize()];

  // the crystal: a blue gem, turning over as it flies
  const gem = hidden(new THREE.Mesh(keep(new THREE.IcosahedronGeometry(1, 0)), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 2.6, 3.6), toneMapped: false }))), 'crystal');

  // the bang's shockwave
  const shellMat = keep(facing(SHELL_FRAG, { uColor: { value: BLUE.clone().multiplyScalar(1.4) }, uK: { value: 0 } }));
  // (round enough not to show its facets when it's close and fills the view)
  const shell = hidden(new THREE.Mesh(keep(new THREE.SphereGeometry(1, 48, 32)), shellMat), 'shock');

  let clock = 0;
  let magnetK = 0;
  const shockAt = { age: SHOCK, r: 1 };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const dir = new THREE.Vector3();

  return {
    torpedoes(list) {
      const n = Math.min(list.length, TORPEDOES);
      for (let i = 0; i < n; i++) {
        const t = list[i];
        dir.set(t.vx, t.vy, t.vz);
        if (dir.lengthSq() < 1e-9) dir.set(0, 0, -1);
        q.setFromUnitVectors(Z, dir.normalize());
        const flick = 1 + Math.sin(clock * 47 + i * 2.1) * 0.12;
        tail.setMatrixAt(i, m4.compose(p.set(t.x, t.y, t.z).addScaledVector(dir, -0.22), q, s.set(0.06 * flick, 0.06 * flick, 0.42)));
        head.setMatrixAt(i, m4.compose(p.set(t.x, t.y, t.z), q, s.set(0.032, 0.032, 0.07)));
      }
      tail.count = head.count = n;
      tail.visible = head.visible = n > 0;
      if (n) tail.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = true;
    },

    // (null: off)
    beam(from, to) {
      ray.visible = Boolean(from && to);
      if (!ray.visible) return;
      dir.set(to.x - from.x, to.y - from.y, to.z - from.z);
      const len = Math.max(0.01, dir.length());
      ray.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
      ray.quaternion.setFromUnitVectors(Z, dir.divideScalar(len));
      const w = 0.06 * (1 + Math.sin(clock * 61) * 0.15);
      ray.scale.set(w, w, len);
      beamMat.uniforms.uLen.value = len;
      beamMat.uniforms.uK.value = 1;
    },

    // (k: how strongly it's on, 0…1, for it to come and go; at null: off)
    magnet(at, k = 1) {
      magnetK = at ? k : 0;
      rings.visible = Boolean(at) && k > 0.01;
      if (!rings.visible) return;
      const pulse = 1 + Math.sin(clock * 9) * 0.12;
      for (let i = 0; i < 3; i++) {
        q.setFromAxisAngle(ringAxes[i], clock * (2.2 + i * 1.3) * (i % 2 ? -1 : 1));
        const r = (0.5 + i * 0.22) * pulse * (0.4 + 0.6 * magnetK);
        rings.setMatrixAt(i, m4.compose(p.set(at.x, at.y, at.z), q, s.set(r, r, r)));
      }
      rings.instanceMatrix.needsUpdate = true;
      rings.material.color.copy(BLUE).multiplyScalar(0.65 * magnetK);
    },

    // (`k`, 0…1, how far it's grown: it comes out of the hatch small rather
    // than a bright blue ball over the middle of the picture)
    crystal(at, k = 1) {
      gem.visible = Boolean(at) && k > 0;
      if (!gem.visible) return;
      gem.position.set(at.x, at.y, at.z);
      gem.rotation.set(clock * 5.3, clock * 3.1, clock * 1.7);
      gem.scale.setScalar(0.16 * Math.min(1, k));
    },

    // a shockwave out to `r` from `at`, swelling and fading on its own
    shock(at, r) {
      shell.position.set(at.x, at.y, at.z);
      shockAt.age = 0;
      shockAt.r = r;
      shell.visible = true;
    },

    update(dt) {
      clock += dt;
      beamMat.uniforms.uTime.value = clock;
      if (shell.visible) {
        shockAt.age += dt;
        const k = Math.min(1, shockAt.age / SHOCK);
        shell.scale.setScalar(Math.max(0.01, shockAt.r * (1 - (1 - k) ** 3)));
        shellMat.uniforms.uK.value = (1 - k) ** 2;
        if (k >= 1) shell.visible = false;
      }
      return this.busy;
    },

    get busy() {
      return tail.visible || ray.visible || rings.visible || gem.visible || shell.visible;
    },

    clear() {
      tail.count = head.count = 0;
      for (const o of [tail, head, ray, rings, gem, shell]) o.visible = false;
      magnetK = 0;
    },

    dispose() {
      for (const o of [tail, head, ray, rings, gem, shell]) o.removeFromParent();
      for (const o of [tail, head, rings]) o.dispose();
      for (const thing of made) thing.dispose();
    },
  };
}
