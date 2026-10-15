// The Dhurandhar universe: a crimson void, and in the middle of it an island
// of black stone inlaid with gold, floating, with the museum on it. Exhibit
// Zero (the square glasses) stands in the centre, the other exhibits in a
// ring round it, each a lit glass case on a marble pedestal with a brass
// plaque. Two rings of film stills turn slowly round the island (Dhurandhar
// close in, Pushpa 2 further out), and logs of red sandalwood tumble past.
//
// And the list they came from, Dickansh_List.docx, open in Word as tall as
// a building just off the island's far edge (./document.js).
//
// build({ renderer, exhibits, doc }) → { scene, pickables, pages, lineAt(hit), setLineHover(i),
//   exhibitPose(i), docPose(), setHover(i), update(dt, t), ready, dispose }

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeProp } from './props';
import { DOC_SIZE, build as buildDocument } from './document';
import { build as buildFriends } from './friends';
import { barkTexture, glowTexture, heartwoodTexture, islandFloorTexture, plaqueTexture, rng } from './textures';
import { sharpen } from '../../lib/three/textures';

export const RING = 17; // metres from the centre to each exhibit
export const ISLAND = 27;
const STILLS = {
  dhurandhar: Array.from({ length: 13 }, (_, i) => `/dickansh/stills/dhurandhar-${String(i + 1).padStart(2, '0')}.webp`),
  pushpa: Array.from({ length: 15 }, (_, i) => `/dickansh/stills/pushpa-${String(i + 1).padStart(2, '0')}.webp`),
};

const NEBULA_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;
}`;
const NEBULA_FS = /* glsl */ `
varying vec3 vDir;
uniform float time;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), u.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), u.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  float n = fbm(d * 2.4 + vec3(0.0, time * 0.01, 0.0));
  float m = fbm(d * 5.0 + n * 1.5);
  vec3 col = vec3(0.012, 0.004, 0.006);
  col += vec3(0.42, 0.03, 0.04) * smoothstep(0.42, 0.85, n) * 0.9;
  col += vec3(0.9, 0.32, 0.06) * smoothstep(0.62, 0.95, m * n * 1.6) * 0.7;
  col += vec3(0.25, 0.05, 0.18) * smoothstep(0.5, 0.9, fbm(d * 3.1 + 7.0)) * 0.35;
  vec3 q = floor(d * 420.0);
  float st = step(0.9965, hash(q));
  col += vec3(1.0, 0.9, 0.8) * st * (0.5 + 0.5 * sin(time * 1.7 + hash(q) * 60.0));
  gl_FragColor = vec4(col, 1.0);
}`;

const BEAM_VS = /* glsl */ `
varying float vY;
varying vec3 vN;
varying vec3 vView;
void main() {
  vY = uv.y;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const BEAM_FS = /* glsl */ `
varying float vY;
varying vec3 vN;
varying vec3 vView;
uniform vec3 color;
uniform float strength;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), vView)), 1.5);
  float a = (1.0 - rim) * smoothstep(0.0, 0.25, vY) * (1.0 - vY * 0.6) * strength;
  gl_FragColor = vec4(color * a, a);
}`;

function framePlane(w, h, gold) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.15), gold);
  frame.position.z = -0.1;
  g.add(frame);
  return g;
}

const DOC_AT = new THREE.Vector3(0, 9.5, -40);

export function build({ renderer, exhibits, doc, tribute }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a0405, 0.0045);
  const r = rng(99);
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);

  const nebula = new THREE.Mesh(keep(new THREE.SphereGeometry(800, 48, 24)), keep(new THREE.ShaderMaterial({ vertexShader: NEBULA_VS, fragmentShader: NEBULA_FS, side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { time: { value: 0 } } })));
  nebula.frustumCulled = false;
  scene.add(nebula);

  scene.add(new THREE.HemisphereLight(0xff8a6a, 0x200608, 0.38));
  const key = new THREE.DirectionalLight(0xffc89a, 1.15);
  key.position.set(30, 50, 24);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
  key.shadow.normalBias = 0.04;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff3020, 1.2);
  rim.position.set(-40, -10, -30);
  scene.add(rim);

  // the island
  const gold = keep(new THREE.MeshStandardMaterial({ color: 0xe6b04a, metalness: 1, roughness: 0.2 }));
  const floorTex = keep(islandFloorTexture());
  floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const top = new THREE.Mesh(keep(new THREE.CylinderGeometry(ISLAND, ISLAND, 0.6, 128)), [keep(new THREE.MeshStandardMaterial({ color: 0x1a0c0a, roughness: 0.5 })), keep(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.18, metalness: 0.2 })), gold]);
  top.position.y = -0.3;
  top.receiveShadow = true;
  scene.add(top);
  const lip = new THREE.Mesh(keep(new THREE.TorusGeometry(ISLAND, 0.22, 12, 160)), gold);
  lip.rotation.x = Math.PI / 2;
  scene.add(lip);
  const glowRing = new THREE.Mesh(keep(new THREE.TorusGeometry(ISLAND + 0.6, 0.08, 8, 200)), keep(new THREE.MeshBasicMaterial({ color: 0xff7a20, toneMapped: false })));
  glowRing.rotation.x = Math.PI / 2;
  glowRing.position.y = -0.5;
  scene.add(glowRing);
  // the rock under it, rough, tapering to a point far below
  const rockGeo = keep(new THREE.ConeGeometry(ISLAND, 34, 96, 24, true));
  const pos = rockGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = (v.y + 17) / 34; // 1 at the top
    const n = Math.sin(v.x * 0.7 + v.y * 0.3) * Math.cos(v.z * 0.6 - v.y * 0.4) + Math.sin(v.y * 1.7 + v.x) * 0.4;
    const s = 1 + n * 0.09 * (1 - t * 0.6);
    v.x *= s;
    v.z *= s;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  rockGeo.computeVertexNormals();
  const rock = new THREE.Mesh(rockGeo, keep(new THREE.MeshStandardMaterial({ color: 0x3a1410, roughness: 0.95, flatShading: true, side: THREE.DoubleSide })));
  rock.rotation.x = Math.PI;
  rock.position.y = -17.6;
  scene.add(rock);

  // the exhibits
  const marble = keep(new THREE.MeshStandardMaterial({ color: 0xf1ece4, roughness: 0.28 }));
  const glass = keep(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 2.5, depthWrite: false, side: THREE.DoubleSide }));
  const ringGlow = keep(new THREE.MeshBasicMaterial({ color: 0xc87a30, toneMapped: false, transparent: true, opacity: 0.5 }));
  const beamGeo = keep(new THREE.CylinderGeometry(0.5, 1.6, 7, 32, 1, true));
  const pickables = [];
  const poses = [];
  const spinners = [];
  const rings = [];
  const steams = [];
  const glowTex = keep(glowTexture());
  const plaqueGeo = keep(new THREE.PlaneGeometry(1.7, 0.85));

  const makeExhibit = async (ex, i) => {
    const center = i === 0;
    const s = center ? 1.9 : 1;
    const g = new THREE.Group();
    let dir;
    if (center) {
      dir = new THREE.Vector3(0, 0, 1);
    } else {
      const a = ((i - 1) / (exhibits.length - 1)) * Math.PI * 2 + Math.PI / 2;
      dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      g.position.copy(dir).multiplyScalar(RING);
    }
    g.rotation.y = Math.atan2(dir.x, dir.z);
    // pedestal
    const ph = 1.15 * s;
    const ped = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.85 * s, 0.95 * s, ph, 48)), marble);
    ped.position.y = ph / 2;
    ped.castShadow = ped.receiveShadow = true;
    g.add(ped);
    for (const y of [0.06 * s, ph - 0.04 * s]) {
      const band = new THREE.Mesh(keep(new THREE.TorusGeometry(0.9 * s, 0.05 * s, 8, 64)), gold);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      g.add(band);
    }
    // the prop, turning slowly in its case
    const prop = await makeProp(ex.prop, ex);
    prop.scale.setScalar(center ? 2.1 : 1.05);
    prop.position.y = ph + 0.02;
    g.add(prop);
    spinners[i] = prop; // (by exhibit, whichever finishes first)
    if (prop.userData.steam || ex.prop === 'cereal') steams.push({ parent: g, y: ph + 0.4 * s, sprites: [] });
    // the glass case, gold-edged
    const cw = 1.5 * s;
    const chh = 1.3 * s;
    const caseMesh = new THREE.Mesh(keep(new THREE.BoxGeometry(cw, chh, cw)), glass);
    caseMesh.position.y = ph + chh / 2;
    caseMesh.renderOrder = 2;
    g.add(caseMesh);
    const e = 0.035 * s;
    const bars = [];
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) bars.push(new THREE.BoxGeometry(e, chh, e).translate((x * cw) / 2, ph + chh / 2, (z * cw) / 2));
    for (const y of [ph, ph + chh]) {
      for (const z of [-1, 1]) bars.push(new THREE.BoxGeometry(cw, e, e).translate(0, y, (z * cw) / 2));
      for (const x of [-1, 1]) bars.push(new THREE.BoxGeometry(e, e, cw).translate((x * cw) / 2, y, 0));
    }
    const edges = new THREE.Mesh(keep(mergeGeometries(bars)), gold);
    bars.forEach((b) => b.dispose());
    g.add(edges);
    // the plaque, on a brass lectern in front
    const tex = keep(await plaqueTexture({ wing: ex.wing, title: ex.title, number: center ? 'Exhibit Zero' : `Exhibit ${String(i).padStart(2, '0')}` }));
    const lectern = new THREE.Mesh(keep(new RoundedBoxGeometry(1.9, 1.0, 0.08, 2, 0.03)), gold);
    const plaque = new THREE.Mesh(plaqueGeo, keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.3, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 })));
    const stand = new THREE.Group();
    stand.add(lectern);
    plaque.position.z = 0.045;
    stand.add(plaque);
    const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.08, 0.95, 12)), gold);
    post.position.set(0, -0.6, -0.1);
    stand.add(post);
    stand.position.set(0, 1.05, 1.15 * s + 0.9);
    stand.rotation.x = -0.55;
    g.add(stand);
    // light from above: a soft beam, and a glowing ring on the floor
    const beam = new THREE.Mesh(beamGeo, keep(new THREE.ShaderMaterial({ vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { color: { value: new THREE.Color(0xffc070) }, strength: { value: center ? 0.26 : 0.16 } } })));
    beam.scale.setScalar(s);
    beam.position.y = ph + 3.5 * s;
    g.add(beam);
    const ring = new THREE.Mesh(keep(new THREE.RingGeometry(1.25 * s, 1.36 * s, 64)), ringGlow.clone());
    keep(ring.material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);
    rings[i] = ring;
    g.traverse((o) => {
      if (o.isMesh) o.userData.exhibit = i;
    });
    pickables.push(g);
    const world = g.position.clone();
    poses[i] = center
      ? { target: new THREE.Vector3(0, ph + 1.1, 0), camera: new THREE.Vector3(0, ph + 2.6, 8.5) }
      : { target: world.clone().setY(1.7), camera: world.clone().addScaledVector(dir, 5.6).setY(3.1) };
    scene.add(g);
  };

  const center = new THREE.PointLight(0xffc070, 14, 26, 1.6);
  center.position.set(0, 7, 0);
  scene.add(center);

  // the stills, framed in gold, in two rings round the island
  const loader = new THREE.TextureLoader();
  const frames = keep(new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.3, emissive: 0x3a1a00 }));
  const stillGeo = keep(new THREE.PlaneGeometry(9, 9 * (9 / 16)));
  const stillRing = (list, radius, y, tilt) => {
    const ring = new THREE.Group();
    list.forEach((src, i) => {
      const tex = keep(loader.load(src));
      sharpen(tex, { color: true });
      const a = (i / list.length) * Math.PI * 2;
      const holder = framePlane(9, 9 * (9 / 16), frames);
      holder.children[0].geometry = keep(holder.children[0].geometry);
      const pic = new THREE.Mesh(stillGeo, keep(new THREE.MeshBasicMaterial({ map: tex, color: 0xd8d8d8, fog: false })));
      holder.add(pic);
      holder.position.set(Math.cos(a) * radius, y + Math.sin(a * 3) * 2.5, Math.sin(a) * radius);
      holder.lookAt(0, holder.position.y * 0.6, 0);
      ring.add(holder);
    });
    ring.rotation.x = tilt;
    scene.add(ring);
    return ring;
  };
  const ringD = stillRing(STILLS.dhurandhar, 52, 12, 0.05);
  const ringP = stillRing(STILLS.pushpa, 74, 2, -0.08);

  // red sandalwood logs, tumbling round the island
  const LOGS = 46;
  const barkTex = keep(barkTexture());
  const heartTex = keep(heartwoodTexture());
  const logs = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.42, 0.46, 4.2, 18, 1)), [keep(new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.9 })), keep(new THREE.MeshStandardMaterial({ map: heartTex, roughness: 0.6, emissive: 0x300000 })), keep(new THREE.MeshStandardMaterial({ map: heartTex, roughness: 0.6, emissive: 0x300000 }))], LOGS);
  const logState = Array.from({ length: LOGS }, () => ({ a: r() * Math.PI * 2, rad: 33 + r() * 14, y: -8 + r() * 26, spin: new THREE.Euler(r() * 6, r() * 6, r() * 6), rate: (r() - 0.5) * 0.6, speed: 0.02 + r() * 0.03, s: 0.7 + r() * 0.6 }));
  logs.castShadow = true;
  scene.add(logs);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const lp = new THREE.Vector3();

  // gold dust over the island
  const DUST = 500;
  const dustGeo = keep(new THREE.BufferGeometry());
  const dp = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    const a = r() * Math.PI * 2;
    const rad = Math.sqrt(r()) * 40;
    dp.set([Math.cos(a) * rad, r() * 18, Math.sin(a) * rad], i * 3);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, keep(new THREE.PointsMaterial({ size: 0.14, map: glowTex, color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  scene.add(dust);

  // the list, open in Word, facing the island from past its far edge
  const sheet = buildDocument({ doc });
  sheet.group.position.copy(DOC_AT);
  scene.add(sheet.group);
  const docGlow = new THREE.PointLight(0xffd8a0, 9, 40, 1.4);
  docGlow.position.set(0, DOC_AT.y, DOC_AT.z + 10);
  scene.add(docGlow);

  // and the last stop, high over the middle: why any of it is here (./friends.js)
  const friends = buildFriends({ tribute });
  scene.add(friends.group);

  const ready = Promise.all([sheet.ready, ...exhibits.map((ex, i) => makeExhibit(ex, i))]).then(() => {
    for (const st of steams)
      for (let k = 0; k < 6; k++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
        keep(s.material);
        s.position.set(0, st.y, 0);
        s.userData.phase = k / 6;
        st.parent.add(s);
        st.sprites.push(s);
      }
  });

  let hover = -1;
  return {
    scene,
    pickables,
    ready,
    exhibitPose: (i) => poses[i] ?? poses[0],
    pages: sheet.pages,
    lineAt: (hit) => sheet.lineAt(hit),
    setLineHover: (i) => sheet.setHover(i),
    markExhibit: (x) => sheet.mark(x),
    friends: () => friends.pickables,
    friendsPose: () => friends.pose(),
    setPhotos: (list) => friends.setPhotos(list),
    // in front of the pages, far enough back to read all three
    docPose: () => ({ target: DOC_AT.clone(), camera: DOC_AT.clone().add(new THREE.Vector3(0, 0.4, DOC_SIZE.h * 1.22)) }),
    setHover(i) {
      hover = i;
    },
    update(dt, t) {
      nebula.material.uniforms.time.value = t;
      friends.update(dt, t);
      ringD.rotation.y += dt * 0.018;
      ringP.rotation.y -= dt * 0.012;
      spinners.forEach((p, i) => {
        p.rotation.y += dt * (i === 0 ? 0.35 : 0.25);
        p.position.y += Math.sin(t * 1.4 + i) * 0.0008;
      });
      rings.forEach((ring, i) => {
        const on = i === hover;
        ring.material.opacity += ((on ? 1 : 0.55 + Math.sin(t * 2 + i) * 0.12) - ring.material.opacity) * Math.min(1, dt * 8);
        ring.scale.setScalar(1 + (on ? 0.06 : 0));
      });
      for (let i = 0; i < LOGS; i++) {
        const L = logState[i];
        L.a += L.speed * dt;
        L.spin.x += L.rate * dt;
        L.spin.z += L.rate * 0.7 * dt;
        lp.set(Math.cos(L.a) * L.rad, L.y + Math.sin(t * 0.3 + i) * 0.6, Math.sin(L.a) * L.rad);
        q.setFromEuler(L.spin);
        sc.setScalar(L.s);
        logs.setMatrixAt(i, m4.compose(lp, q, sc));
      }
      logs.instanceMatrix.needsUpdate = true;
      for (const st of steams)
        for (const s of st.sprites) {
          const ph = (t * 0.35 + s.userData.phase) % 1;
          s.position.set(Math.sin(ph * 6 + s.userData.phase * 9) * 0.12, st.y + ph * 1.1, 0);
          s.scale.setScalar(0.15 + ph * 0.45);
          s.material.opacity = 0.28 * Math.sin(ph * Math.PI);
        }
      dust.rotation.y += dt * 0.01;
    },
    dispose() {
      for (const d of disposables) d.dispose?.();
      sheet.dispose();
      friends.dispose();
      scene.traverse((o) => {
        if (o.isMesh && spinners.some((p) => p === o || p.getObjectById(o.id))) {
          o.geometry.dispose();
          for (const m of [o.material].flat()) {
            m.map?.dispose();
            m.dispose();
          }
        }
      });
    },
  };
}
