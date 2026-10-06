// The Citadel's siege, drawn (siege.js has the rules): a shield over it fed
// by four generators out on its arms' domes, the generators going dark as
// they're knocked out, the shield flickering off when the last one goes,
// and then, when the core goes up, a blast of fire and portal fluid, the
// Citadel gone and its wreckage drifting where it was, until the Ricks
// bring it back through a portal.
//
// It follows siege.js's state every frame (update), so whatever the state
// says is what's drawn: a change seen from close by plays out, one from far
// off (or learnt on arriving) is just so. Everything's made up front, so
// the scene's shaders are compiled before the first frame (scene.js warm)
// and a siege never stalls one.
//
// createCitadelSiege({ parent, model, geo, small }) → { root, update(t, dt,
//   cam, state) → busy, shieldHit(point), genHit(i), dispose() }
// parent: the map (all of it is in map space); model: the Citadel's own
// group (deepspace.js), hidden while it's down; geo: siege.js's
// citadelGeometry; cam: the camera in map space.

import * as THREE from 'three';
import { BLAST_S, GENS, blastShape } from './siege';

const NEAR = 1600; // map units: closer than this a change plays out, and the siege is drawn at all
const GLOW = new THREE.Color('#5dffb0'); // the shield's and the generators' light (portal-fluid green)
const DEBRIS = 240;
const REBUILD = 3.2; // seconds of the rebuilding

const SHIELD_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const SHIELD_FRAG = /* glsl */ `
uniform float uTime;
uniform float uUp;
uniform vec3 uColor;
uniform vec4 uHits[4]; // xyz: where (a direction from the middle), w: its age in seconds (< 0: none)
varying vec3 vN;
varying vec3 vView;
varying vec3 vDir;
float cells(vec3 d) {
  // a lattice of cells over the bubble (three crossed sets of bands)
  vec3 p = d * 9.0;
  vec3 f = abs(fract(p + 0.5 * floor(p.yzx)) - 0.5);
  return smoothstep(0.06, 0.0, min(min(f.x, f.y), f.z));
}
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.4);
  float ripple = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 h = uHits[i];
    if (h.w < 0.0) continue;
    float ang = acos(clamp(dot(vDir, h.xyz), -1.0, 1.0));
    float fade = 1.0 - clamp(h.w / 1.1, 0.0, 1.0);
    ripple += smoothstep(0.1, 0.0, abs(ang - h.w * 1.3)) * fade;
    ripple += smoothstep(0.3, 0.0, ang) * (1.0 - clamp(h.w / 0.35, 0.0, 1.0)) * 1.5;
  }
  float flick = 0.88 + 0.12 * sin(uTime * 6.0 + vDir.y * 18.0 + vDir.x * 7.0);
  float a = (fres * 0.26 + cells(vDir) * 0.07 * (0.3 + fres) + ripple * 0.8) * uUp * flick;
  gl_FragColor = vec4(uColor * a, a);
}`;

const BURST_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAge; // 0…1
varying vec3 vN;
varying vec3 vView;
varying vec3 vDir;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.5);
  float a = (0.35 + rim * 0.9) * (1.0 - uAge) * (1.0 - uAge);
  gl_FragColor = vec4(uColor * a, a);
}`;

const radial = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const easeOutBack = (t) => {
  const c = 1.4;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

export function createCitadelSiege({ parent, model, geo, small = false }) {
  const made = [];
  const keep = (x) => (made.push(x), x);
  const root = new THREE.Group();
  root.name = 'citadel-siege';
  parent.add(root);
  const center = new THREE.Vector3(...geo.center);
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };

  // ── the shield ──
  const hits = Array.from({ length: 4 }, () => new THREE.Vector4(0, 1, 0, -1));
  const shieldMat = keep(
    new THREE.ShaderMaterial({
      vertexShader: SHIELD_VERT,
      fragmentShader: SHIELD_FRAG,
      uniforms: { uTime: { value: 0 }, uUp: { value: 1 }, uColor: { value: GLOW.clone().multiplyScalar(1.1) }, uHits: { value: hits } },
      ...additive,
      forceSinglePass: true,
    }),
  );
  const shield = new THREE.Mesh(keep(new THREE.SphereGeometry(1, small ? 48 : 72, small ? 24 : 36)), shieldMat);
  shield.position.copy(center);
  shield.scale.setScalar(geo.shield);
  shield.renderOrder = 3;
  root.add(shield);
  let nextHit = 0;

  // ── the generators: a pylon, its glowing core and a ring round it, and a
  // conduit of light from it into the shield ──
  const pylonGeo = keep(new THREE.CylinderGeometry(0.22, 0.42, 2.6, 10).translate(0, -0.9, 0));
  const orbGeo = keep(new THREE.IcosahedronGeometry(0.55, 2));
  const ringGeo = keep(new THREE.TorusGeometry(0.9, 0.06, 8, 48));
  const beamGeo = keep(new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true).translate(0, 0.5, 0));
  const metal = keep(new THREE.MeshStandardMaterial({ color: '#7a6440', metalness: 0.75, roughness: 0.4 }));
  const burnt = keep(new THREE.MeshStandardMaterial({ color: '#2a2622', metalness: 0.15, roughness: 0.9, envMapIntensity: 0.3, emissive: '#ff5a1e', emissiveIntensity: 0.22 }));
  const orbMat = keep(new THREE.MeshBasicMaterial({ color: GLOW.clone().multiplyScalar(3), toneMapped: false }));
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: GLOW.clone().multiplyScalar(2.2), ...additive, side: THREE.DoubleSide }));
  const beamMat = keep(new THREE.MeshBasicMaterial({ color: GLOW.clone().multiplyScalar(1.4), ...additive, opacity: 0.5 }));
  const emberMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a2a').multiplyScalar(3), toneMapped: false }));
  const up = new THREE.Vector3(0, 1, 0);
  const gens = geo.gens.map((at) => {
    const g = new THREE.Group();
    g.position.set(...at);
    g.scale.setScalar(geo.gen);
    const pylon = new THREE.Mesh(pylonGeo, metal);
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.y = 0.55;
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.55;
    const ember = new THREE.Mesh(orbGeo, emberMat);
    ember.position.y = 0.4;
    ember.scale.setScalar(0.35);
    ember.visible = false;
    g.add(pylon, orb, ring, ember);
    root.add(g);
    // the conduit: from the generator's core into the shield's middle (it stops at the bubble)
    const beam = new THREE.Mesh(beamGeo, beamMat);
    const from = new THREE.Vector3(...at).add(new THREE.Vector3(0, 0.55 * geo.gen, 0));
    const to = center.clone().sub(from);
    const len = Math.max(0, to.length() - geo.shield * 0.98);
    beam.position.copy(from);
    beam.quaternion.setFromUnitVectors(up, to.normalize());
    beam.scale.set(geo.gen * 0.6, len, geo.gen * 0.6);
    root.add(beam);
    return { g, pylon, orb, ring, ember, beam, down: false, flash: 0, spin: Math.random() * 6 };
  });

  // ── the blast: a flash, fire and portal fluid swelling out, a shock ring ──
  const tex = keep(radial());
  const flash = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(2.4, 2.1, 1.6), ...additive })));
  flash.position.copy(center);
  flash.visible = false;
  const fireMat = keep(new THREE.ShaderMaterial({ vertexShader: SHIELD_VERT, fragmentShader: BURST_FRAG, uniforms: { uColor: { value: new THREE.Color(4, 1.6, 0.5) }, uAge: { value: 0 } }, ...additive }));
  const fluidMat = keep(new THREE.ShaderMaterial({ vertexShader: SHIELD_VERT, fragmentShader: BURST_FRAG, uniforms: { uColor: { value: GLOW.clone().multiplyScalar(2.4) }, uAge: { value: 0 } }, ...additive }));
  const ballGeo = keep(new THREE.SphereGeometry(1, 40, 20));
  const fire = new THREE.Mesh(ballGeo, fireMat);
  const fluid = new THREE.Mesh(ballGeo, fluidMat);
  fire.position.copy(center);
  fluid.position.copy(center);
  fire.visible = fluid.visible = false;
  const shockMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.6), ...additive, side: THREE.DoubleSide }));
  const shock = new THREE.Mesh(keep(new THREE.RingGeometry(0.94, 1, 128)), shockMat);
  shock.rotation.x = -Math.PI / 2;
  shock.position.copy(center);
  shock.visible = false;
  root.add(flash, fire, fluid, shock);

  // ── the wreckage: tumbling chunks of bronze hull, glowing hot at first ──
  const debrisMat = keep(new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.25, roughness: 0.85, envMapIntensity: 0.35, emissive: '#ff5a1a', emissiveIntensity: 0, flatShading: true }));
  const debris = new THREE.InstancedMesh(keep(new THREE.DodecahedronGeometry(1, 0)), debrisMat, DEBRIS);
  debris.frustumCulled = false; // (they spread far out from where they start)
  // the Citadel's own bronze, olive and soot, chunk by chunk
  const HULL = ['#4a3f2c', '#3a4230', '#2c2825', '#54462e', '#1f1d1b'].map((c) => new THREE.Color(c));
  for (let i = 0; i < DEBRIS; i++) debris.setColorAt(i, HULL[i % HULL.length]);
  debris.visible = false;
  root.add(debris);
  const chunks = Array.from({ length: DEBRIS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), angle: 0, spin: 0, size: 1 }));
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s3 = new THREE.Vector3();
  const scatter = () => {
    for (const c of chunks) {
      c.v.randomDirection();
      c.p.copy(center).addScaledVector(c.v, Math.random() * geo.core * 0.85);
      c.v.multiplyScalar(4 + Math.random() * 16);
      c.axis.randomDirection();
      c.angle = Math.random() * 6;
      c.spin = 0.3 + Math.random() * 1.8;
      c.size = (Math.random() ** 3 * 3.4 + 0.35) * (geo.core / 45);
    }
  };
  const placeDebris = (dt, k) => {
    const drag = Math.exp(-dt * 0.25);
    for (let i = 0; i < DEBRIS; i++) {
      const c = chunks[i];
      c.v.multiplyScalar(drag);
      c.p.addScaledVector(c.v, dt);
      c.angle += c.spin * dt;
      q.setFromAxisAngle(c.axis, c.angle);
      m4.compose(c.p, q, s3.setScalar(c.size * k));
      debris.setMatrixAt(i, m4);
    }
    debris.instanceMatrix.needsUpdate = true;
  };

  // ── the rebuilding: a portal opens where it was, and the Citadel comes back through it ──
  const portalMat = keep(new THREE.MeshBasicMaterial({ map: tex, color: GLOW.clone().multiplyScalar(3), ...additive, side: THREE.DoubleSide }));
  const portal = new THREE.Mesh(keep(new THREE.CircleGeometry(1, 64)), portalMat);
  portal.position.copy(center);
  portal.visible = false;
  root.add(portal);

  // what's drawn: 'up' (whole), 'blast' (going up), 'down' (wreckage), 'rebuild'
  let phase = 'up';
  let age = 0;
  let shieldUp = 1;
  const gensFlash = new Array(GENS).fill(0);
  const resetGen = (gn) => {
    gn.down = false;
    gn.pylon.material = metal;
    gn.orb.visible = gn.ring.visible = gn.beam.visible = true;
    gn.ember.visible = false;
  };
  const knockOut = (gn) => {
    gn.down = true;
    gn.pylon.material = burnt;
    gn.orb.visible = gn.ring.visible = gn.beam.visible = false;
    gn.ember.visible = true;
  };
  const setModel = (k) => {
    if (!model) return;
    model.visible = k > 0.001;
    model.scale.setScalar(Math.max(0.001, k));
  };
  const hideBlast = () => {
    flash.visible = fire.visible = fluid.visible = shock.visible = false;
  };

  return {
    root,
    // a shot met the shield at `point` (map space): a ripple from there
    shieldHit(point) {
      const h = hits[nextHit];
      nextHit = (nextHit + 1) % hits.length;
      s3.copy(point).sub(center).normalize();
      h.set(s3.x, s3.y, s3.z, 0);
    },
    // a generator took a hit: its light flares
    genHit(i) {
      if (gensFlash[i] !== undefined) gensFlash[i] = 1;
    },
    // → whether anything's still moving (so the page keeps drawing)
    update(t, dt, cam, st) {
      const near = cam.distanceTo(center) < NEAR;
      root.visible = near || phase === 'blast' || phase === 'rebuild';
      // ── follow the state ──
      if (st.down && (phase === 'up' || phase === 'rebuild')) {
        phase = near ? 'blast' : 'down';
        age = 0;
        scatter();
        for (const gn of gens) knockOut(gn);
        if (phase === 'down') setModel(0);
      } else if (!st.down && (phase === 'down' || phase === 'blast')) {
        hideBlast();
        phase = near ? 'rebuild' : 'up';
        age = 0;
        for (const gn of gens) resetGen(gn);
        if (phase === 'up') {
          setModel(1);
          debris.visible = false;
          portal.visible = false;
        }
      }
      if (!root.visible) return phase === 'blast' || phase === 'rebuild';
      age += dt;
      shieldMat.uniforms.uTime.value = t;
      // the generators, as the state has them
      for (let i = 0; i < GENS; i++) {
        const gn = gens[i];
        if (st.gens[i] && !gn.down) knockOut(gn);
        else if (!st.gens[i] && gn.down && phase === 'up') resetGen(gn);
        gn.spin += dt * (gn.down ? 0 : 1.6);
        gn.ring.rotation.set(Math.PI / 2 + Math.sin(gn.spin) * 0.3, gn.spin, 0);
        gensFlash[i] = Math.max(0, gensFlash[i] - dt * 3);
        if (!gn.down) gn.orb.scale.setScalar(1 + gensFlash[i] * 0.6 + Math.sin(t * 5 + i) * 0.06);
        else gn.ember.scale.setScalar(0.3 + Math.random() * 0.12);
      }
      // the shield: up while a generator runs, flickering out as the last goes
      const want = st.shield && phase === 'up' ? 1 : 0;
      shieldUp += (want - shieldUp) * Math.min(1, dt * (want ? 1.2 : 2.5));
      const dying = !want && shieldUp > 0.02 ? (Math.sin(t * 40) > 0 ? 1 : 0.25) : 1;
      shieldMat.uniforms.uUp.value = shieldUp * dying;
      shield.visible = shieldUp > 0.01;
      for (const h of hits) if (h.w >= 0) h.w = h.w > 1.2 ? -1 : h.w + dt;
      // ── the blast ──
      if (phase === 'blast') {
        // (its sizes are siege.js's blastShape: kept to the Citadel's own scale, tested there)
        const b = blastShape(age, geo.core);
        const k = age / BLAST_S;
        flash.visible = b.flashAlpha > 0;
        flash.scale.setScalar(b.flash);
        flash.material.opacity = b.flashAlpha;
        fire.visible = fluid.visible = !b.done;
        fire.scale.setScalar(b.fire);
        fireMat.uniforms.uAge.value = Math.min(1, age / 2.4);
        fluid.scale.setScalar(b.fluid);
        fluidMat.uniforms.uAge.value = Math.min(1, age / 3.2);
        shock.visible = !b.done;
        shock.scale.setScalar(b.shock);
        shockMat.opacity = b.shockAlpha;
        if (age > 0.12) setModel(0); // (gone at the flash's peak)
        debris.visible = true;
        debrisMat.emissiveIntensity = Math.max(0.3, 2.4 * (1 - k));
        placeDebris(dt, 1);
        if (b.done) {
          hideBlast();
          phase = 'down';
          age = 0;
        }
        return true;
      }
      if (phase === 'down') {
        debris.visible = true;
        debrisMat.emissiveIntensity += (0.04 - debrisMat.emissiveIntensity) * Math.min(1, dt * 0.9); // (cooling)
        placeDebris(dt, 1);
        return true; // (the wreckage tumbles)
      }
      if (phase === 'rebuild') {
        const k = Math.min(1, age / REBUILD);
        portal.visible = true;
        portal.lookAt(root.localToWorld(s3.copy(cam))); // (lookAt is in world space; cam is the map's)
        const open = k < 0.25 ? k / 0.25 : k > 0.8 ? (1 - k) / 0.2 : 1;
        portal.scale.setScalar(geo.core * 1.7 * open);
        portal.rotation.z += dt * 2;
        portalMat.opacity = open;
        setModel(k < 0.2 ? 0 : easeOutBack(Math.min(1, (k - 0.2) / 0.7)));
        debris.visible = k < 0.6;
        if (debris.visible) placeDebris(dt, 1 - k / 0.6);
        if (k >= 1) {
          phase = 'up';
          portal.visible = false;
          debris.visible = false;
          setModel(1);
        }
        return true;
      }
      return shield.visible || gensFlash.some((f) => f > 0);
    },
    dispose() {
      debris.dispose();
      for (const x of made) x.dispose();
      root.removeFromParent();
    },
  };
}
