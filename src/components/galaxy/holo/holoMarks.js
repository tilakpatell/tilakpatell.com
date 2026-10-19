// The holotable's systems and the war's marks on them (./holoScene.js draws them): each system a bright bead at
// its height over the plane (systems.js liftOf) on a thin pin down to it, a ring on the plane round its foot in
// its holder's colour; a contested one's ring pulsing in the colour of the side pushing there; the one picked
// ringed in white, broken and turning, as Helldivers 2 rings a planet; where you are, a white pulse; and the war's
// attacks and fronts (warMap.js opsOf) as arcs over the plane, a light running along each to where it's going.
//
//   createMarks({ small }) → { group, set(view), animate(t), dispose }
//   set({ war, ops, pick, current, lit, mine }) the war's table (with byId), its ops, the system picked, where you
//     are, the systems lit by the era or the film (a Set, or null for all) and the side you're sworn to

import * as THREE from 'three';
import { SIDES } from '../sides';
import { CORE, SYSTEMS, liftOf, systemById } from '../systems';

export const LIFT_Y = 0.55; // (a system's height over the plane, grid squares a unit of liftOf)
const BEAD = 0.13;
const SMALL_BEAD = 0.075; // (a charted world's)
const GLOW = 1.9; // (how far past white a bead's colour goes: the bloom picks it up)

export const worldOf = (s) => [s.pos[0] - CORE[0], liftOf(s) * LIFT_Y, s.pos[1] - CORE[1]];

const ringGeo = (inner, outer, segs = 48) => new THREE.RingGeometry(inner, outer, segs).rotateX(-Math.PI / 2);

export function createMarks({ small = false } = {}) {
  const group = new THREE.Group();
  const made = [];
  const keep = (...xs) => (made.push(...xs), xs[0]);
  const n = SYSTEMS.length;

  // the beads
  const beadGeo = keep(new THREE.SphereGeometry(1, small ? 10 : 16, small ? 8 : 12));
  const beadMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const beads = new THREE.InstancedMesh(beadGeo, beadMat, n);
  const m = new THREE.Matrix4();
  SYSTEMS.forEach((s, i) => {
    const [x, y, z] = worldOf(s);
    const r = s.charted ? SMALL_BEAD : BEAD;
    beads.setMatrixAt(i, m.makeScale(r, r, r).setPosition(x, y, z));
    beads.setColorAt(i, new THREE.Color(s.accent));
  });
  beads.renderOrder = 6;
  group.add(beads);

  // the pins, from the plane up to each bead
  const pinPos = new Float32Array(n * 6);
  SYSTEMS.forEach((s, i) => {
    const [x, y, z] = worldOf(s);
    pinPos.set([x, 0, z, x, y, z], i * 6);
  });
  const pinGeo = keep(new THREE.BufferGeometry());
  pinGeo.setAttribute('position', new THREE.BufferAttribute(pinPos, 3));
  const pinMat = keep(new THREE.LineBasicMaterial({ color: 0x7fd6ff, transparent: true, opacity: 0.32, depthWrite: false }));
  group.add(new THREE.LineSegments(pinGeo, pinMat));

  // the rings on the plane: one a system, its holder's (or none)
  const holdGeo = keep(ringGeo(0.17, 0.215));
  const holdMats = new Map(); // colour → material
  const holdMat = (hex, opacity) => {
    const key = `${hex}:${opacity}`;
    if (!holdMats.has(key)) holdMats.set(key, keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(1.4), transparent: true, opacity, depthWrite: false, toneMapped: false })));
    return holdMats.get(key);
  };
  const holds = SYSTEMS.map((s) => {
    const ring = new THREE.Mesh(holdGeo, holdMat('#7fd6ff', 0));
    const [x, , z] = worldOf(s);
    ring.position.set(x, 0.006, z);
    ring.visible = false;
    group.add(ring);
    return ring;
  });

  // a contested system's pulse, the pick's broken ring, where you are
  const pulseGeo = keep(ringGeo(0.24, 0.3));
  const pulses = SYSTEMS.map((s) => {
    const mesh = new THREE.Mesh(pulseGeo, keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })));
    const [x, , z] = worldOf(s);
    mesh.position.set(x, 0.008, z);
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  });
  const pickRing = new THREE.Group();
  const arcMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  for (let q = 0; q < 4; q++) {
    const g = keep(new THREE.RingGeometry(0.34, 0.39, 16, 1, (q * Math.PI) / 2 + 0.18, Math.PI / 2 - 0.36).rotateX(-Math.PI / 2));
    pickRing.add(new THREE.Mesh(g, arcMat));
  }
  pickRing.visible = false;
  group.add(pickRing);
  const youGeo = keep(ringGeo(0.3, 0.33, 40));
  const youMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.4, 1.4), transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
  const you = new THREE.Mesh(youGeo, youMat);
  you.visible = false;
  group.add(you);

  // the war's arcs
  const arcs = new THREE.Group();
  group.add(arcs);
  const ARC_VERT = /* glsl */ `
attribute float aT;
varying float vT;
void main() {
  vT = aT;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
  const ARC_FRAG = /* glsl */ `
uniform vec3 uColour;
uniform float uTime;
uniform float uProgress;
varying float vT;
void main() {
  // (dashes running from the attacker toward its target, brighter toward the end; a light where it's got to)
  float dash = step(0.45, fract(vT * 14.0 - uTime * 1.2));
  float head = exp(-pow((vT - uProgress) * 22.0, 2.0)) * 2.4;
  float a = (0.25 + 0.55 * dash) * smoothstep(0.0, 0.08, vT) + head;
  gl_FragColor = vec4(uColour * (1.0 + head), min(1.0, a));
}`;
  let arcItems = [];
  const clearArcs = () => {
    for (const a of arcItems) {
      a.geo.dispose();
      a.mat.dispose();
    }
    arcs.clear();
    arcItems = [];
  };

  const beadColour = new THREE.Color();
  return {
    group,
    set({ war, ops = [], pick = null, current = null, lit = null, mine = null }) {
      const byId = war?.byId ?? {};
      SYSTEMS.forEach((s, i) => {
        const row = byId[s.id];
        const dim = lit && !lit.has(s.id);
        beadColour.set(row ? SIDES[row.owner].colour : s.accent).multiplyScalar(dim ? 0.35 : GLOW);
        if (!row && !dim) beadColour.lerp(new THREE.Color(1, 1, 1), 0.25);
        beads.setColorAt(i, beadColour);
        const ring = holds[i];
        ring.visible = Boolean(row) && !dim;
        if (row) ring.material = holdMat(SIDES[row.owner].colour, row.owner === mine ? 0.55 : 0.85);
        const p = pulses[i];
        const by = row?.attack?.by ?? (row?.front || row?.battle ? (ops.find((o) => o.to === s.id)?.by ?? null) : null);
        p.visible = Boolean(row && (row.attack || row.front || row.battle)) && !dim;
        p.userData.fast = Boolean(row?.attack || row?.battle?.fighting);
        if (p.visible) p.material.color.set(by ? SIDES[by].colour : '#ffffff').multiplyScalar(1.6);
      });
      beads.instanceColor.needsUpdate = true;
      const picked = pick ? systemById(pick) : null;
      pickRing.visible = Boolean(picked);
      if (picked) pickRing.position.set(...worldOf(picked).map((v, k) => (k === 1 ? 0.01 : v)));
      const here = current ? systemById(current) : null;
      you.visible = Boolean(here);
      if (here) you.position.set(...worldOf(here).map((v, k) => (k === 1 ? 0.01 : v)));
      // the arcs, made again with the war
      clearArcs();
      for (const op of ops) {
        const a = systemById(op.from);
        const b = systemById(op.to);
        if (!a || !b) continue;
        const pa = new THREE.Vector3(...worldOf(a));
        const pb = new THREE.Vector3(...worldOf(b));
        const lift = 0.35 + pa.distanceTo(pb) * 0.22;
        const mid = pa.clone().add(pb).multiplyScalar(0.5).add(new THREE.Vector3(0, lift, 0));
        const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);
        const pts = curve.getPoints(48);
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        geo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(pts.map((_, k) => k / (pts.length - 1))), 1));
        const mat = new THREE.ShaderMaterial({
          vertexShader: ARC_VERT,
          fragmentShader: ARC_FRAG,
          uniforms: { uColour: { value: new THREE.Color(op.colour).multiplyScalar(1.5) }, uTime: { value: 0 }, uProgress: { value: 0.2 + 0.75 * (op.progress ?? 0) } },
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        });
        const line = new THREE.Line(geo, mat);
        line.renderOrder = 5;
        arcs.add(line);
        arcItems.push({ geo, mat });
      }
    },
    animate(t) {
      for (const p of pulses) {
        if (!p.visible) continue;
        const k = (t * (p.userData.fast ? 1.4 : 0.8)) % 1;
        p.scale.setScalar(1 + k * 0.9);
        p.material.opacity = 0.9 * (1 - k);
      }
      pickRing.rotation.y = t * 0.6;
      const yk = (t * 0.7) % 1;
      you.scale.setScalar(1 + yk * 0.6);
      youMat.opacity = 0.85 * (1 - yk);
      for (const a of arcItems) a.mat.uniforms.uTime.value = t;
    },
    dispose() {
      clearArcs();
      for (const x of made) x.dispose?.();
    },
  };
}
