// The fighting's light: blaster bolts (Optimus's blue-white, the
// Decepticons' red-violet) streaking along their shots, a flash where one
// hits, a fireball where a robot goes down, sparks off a transformation,
// and energon lying about, turning and glowing until it's picked up. All of
// it pooled and instanced, so a firefight makes nothing new.
//
// createEffects(scene, { tier }) → { bolts(shots), hit(x, y, z, mine), boom(x, y, z, size),
//   spark(x, y, z), pickups(list, t), update(dt, t, camera), dispose }

import * as THREE from 'three';

const MAX_BOLTS = 96;
const MAX_FLASH = 48;

const FLASH_VERT = /* glsl */ `
  attribute vec4 aAt; // x, y, z, size
  attribute vec4 aKind; // age 0…1, kind (0 hit, 1 boom, 2 spark), seed, mine
  varying vec2 vUv;
  varying vec4 vKind;
  void main() {
    vUv = uv;
    vKind = aKind;
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float grow = aKind.y > 0.5 && aKind.y < 1.5 ? 0.4 + aKind.x * 1.4 : 0.6 + aKind.x * 0.8;
    vec3 p = aAt.xyz + (right * (uv.x - 0.5) + up * (uv.y - 0.5)) * aAt.w * grow;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
const FLASH_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vKind;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec2 q = vUv - 0.5;
    float r = length(q) * 2.0;
    float age = vKind.x;
    vec3 col;
    float a;
    if (vKind.y > 0.5 && vKind.y < 1.5) {
      // a fireball: billows that cool from white through orange to smoke
      float b = n(q * 6.0 + vKind.z * 9.0 + age * 2.0) * 0.5 + n(q * 12.0 - age * 3.0) * 0.25;
      float shape = 1.0 - r + b * 0.6 - age * 0.5;
      a = smoothstep(0.0, 0.2, shape) * (1.0 - age);
      float heat = clamp(shape * 1.6 - age, 0.0, 1.0);
      col = mix(vec3(0.15, 0.08, 0.06), mix(vec3(3.0, 0.8, 0.12), vec3(6.0, 4.2, 1.6), heat), smoothstep(0.0, 0.4, heat));
    } else {
      // a flash or a spark: a hot point, fading
      a = smoothstep(1.0, 0.0, r) * (1.0 - age);
      col = (vKind.w > 0.5 ? vec3(1.6, 2.6, 4.0) : vec3(4.0, 0.9, 2.2)) * (0.6 + 1.4 * smoothstep(0.6, 0.0, r));
      if (vKind.y > 1.5) col = vec3(4.0, 2.6, 0.9) * (1.0 - r);
    }
    gl_FragColor = vec4(col * a, a);
  }`;

export function createEffects(scene, { tier = 'high' } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  // bolts: stretched glowing capsules along each shot's flight
  const boltGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 6, 1);
  boltGeo.rotateX(Math.PI / 2);
  const boltMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const bolts = new THREE.InstancedMesh(boltGeo, boltMat, MAX_BOLTS);
  bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bolts.frustumCulled = false;
  const mine = new THREE.Color(1.6, 2.8, 5.0);
  const theirs = new THREE.Color(4.5, 0.6, 2.4);
  for (let i = 0; i < MAX_BOLTS; i++) bolts.setColorAt(i, mine);
  group.add(bolts);

  // flashes, fireballs and sparks: billboards in one draw
  const quad = new THREE.PlaneGeometry(1, 1);
  const flashGeo = new THREE.InstancedBufferGeometry();
  flashGeo.index = quad.index;
  flashGeo.setAttribute('position', quad.attributes.position);
  flashGeo.setAttribute('uv', quad.attributes.uv);
  const at = new Float32Array(MAX_FLASH * 4);
  const kind = new Float32Array(MAX_FLASH * 4);
  const atAttr = new THREE.InstancedBufferAttribute(at, 4).setUsage(THREE.DynamicDrawUsage);
  const kindAttr = new THREE.InstancedBufferAttribute(kind, 4).setUsage(THREE.DynamicDrawUsage);
  flashGeo.setAttribute('aAt', atAttr);
  flashGeo.setAttribute('aKind', kindAttr);
  flashGeo.instanceCount = MAX_FLASH;
  const flashMat = new THREE.ShaderMaterial({ vertexShader: FLASH_VERT, fragmentShader: FLASH_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const flashes = new THREE.Mesh(flashGeo, flashMat);
  flashes.frustumCulled = false;
  flashes.renderOrder = 4;
  group.add(flashes);
  const live = Array.from({ length: MAX_FLASH }, () => ({ t: 1, life: 1, kind: 0 }));
  let next = 0;
  const add = (x, y, z, size, k, life, mineFlag = 0) => {
    const i = next;
    next = (next + 1) % MAX_FLASH;
    at.set([x, y, z, size], i * 4);
    live[i] = { t: 0, life, kind: k, seed: Math.random(), mine: mineFlag };
  };

  // energon: crystals (or the relic) turning where they lie, with a glow under them
  const crystalGeo = new THREE.OctahedronGeometry(1, 0);
  crystalGeo.scale(0.9, 1.6, 0.9);
  const crystalMat = new THREE.MeshStandardMaterial({ color: '#5fe4ff', emissive: new THREE.Color('#3fd2ff'), emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
  const crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, 64);
  crystals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  crystals.frustumCulled = false;
  group.add(crystals);
  const crystalLight = tier === 'low' ? null : new THREE.PointLight('#3fd2ff', 0, 30, 2);
  if (crystalLight) group.add(crystalLight);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);

  return {
    // every shot in flight, a bolt each
    bolts(shots) {
      // (a ram's hit is a shot nobody sees)
      const seen = shots.filter((sh) => !sh.ram);
      const n = Math.min(MAX_BOLTS, seen.length);
      for (let i = 0; i < n; i++) {
        const sh = seen[i];
        dir.set(sh.vx, sh.vy, sh.vz);
        const speed = dir.length() || 1;
        dir.divideScalar(speed);
        q.setFromUnitVectors(Z, dir);
        p.set(sh.x, sh.y, sh.z).addScaledVector(dir, -2);
        s.set(1, 1, 5.5);
        bolts.setMatrixAt(i, m.compose(p, q, s));
        bolts.setColorAt(i, sh.from === 'player' ? mine : theirs);
      }
      bolts.count = n;
      bolts.instanceMatrix.needsUpdate = true;
      if (bolts.instanceColor) bolts.instanceColor.needsUpdate = true;
    },
    hit(x, y, z, isMine = true) {
      add(x, y, z, 3.5, 0, 0.25, isMine ? 1 : 0);
    },
    boom(x, y, z, size = 9) {
      add(x, y + size * 0.4, z, size * 1.8, 1, 1.4);
      add(x, y + size * 0.3, z, size * 2.6, 0, 0.35, 0);
    },
    spark(x, y, z) {
      add(x, y, z, 1.6, 2, 0.4);
    },
    // the energon's colour where you are (Kaon's is dark energon, violet)
    energon(hex = '#3fd2ff') {
      const c = new THREE.Color(hex);
      crystalMat.color.copy(c).lerp(new THREE.Color('#ffffff'), 0.25);
      crystalMat.emissive.copy(c);
      crystalLight?.color.copy(c);
    },
    // the pickups still lying about, turning
    pickups(list, t) {
      let n = 0;
      let near = null;
      for (const k of list) {
        if (k.taken || n >= 64) continue;
        const relic = k.kind === 'relic';
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t * 1.6 + n);
        p.set(k.x, (k.y ?? 0) + 2.2 + Math.sin(t * 2 + n) * 0.35, k.z);
        s.setScalar(relic ? 1.2 : 1);
        crystals.setMatrixAt(n++, m.compose(p, q, s));
        near = near ?? k;
      }
      crystals.count = n;
      crystals.instanceMatrix.needsUpdate = true;
      if (crystalLight && near) {
        crystalLight.position.set(near.x, (near.y ?? 0) + 3, near.z);
        crystalLight.intensity = 60;
      }
    },
    update(dt) {
      for (let i = 0; i < MAX_FLASH; i++) {
        const f = live[i];
        f.t = Math.min(f.life, f.t + dt);
        kind.set([f.t / f.life, f.kind, f.seed ?? 0, f.mine ?? 0], i * 4);
        if (f.t >= f.life) at[i * 4 + 3] = 0;
      }
      atAttr.needsUpdate = true;
      kindAttr.needsUpdate = true;
    },
    dispose() {
      scene.remove(group);
      boltGeo.dispose();
      boltMat.dispose();
      quad.dispose();
      flashGeo.dispose();
      flashMat.dispose();
      crystalGeo.dispose();
      crystalMat.dispose();
    },
  };
}
