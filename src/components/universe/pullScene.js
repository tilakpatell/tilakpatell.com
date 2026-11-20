// What pulls the ship each frame, drawn: the Maw's gravity (maw.js) and the
// two great portals' pulls (pull.js: the Maelstrom's tractor beam, the Curve
// Rift's grab). The scene hands it the stepped ship and takes back where
// it's been pulled to; this draws the beam (a pale cone from the gate to the
// ship, pulsing) and squashes the ship in the Rift's grab, and says so in
// the HUD's note. Into the gate, it's the gate's own way through (the
// scene's 'portal', the page's jump into /galaxy); into the Rift, the Rick
// portal's crossing (the scene's cross, then portalThrough).
//
// createPulls(parent, { model() (the ship's: its pivot squashed), note(text), emit(event), through(portalId), reduced })
//   → { step(ship, { boost, dt, now, off }) → ship (and drawn), k (the Maw's pull, 0 … 1), maw (its pullAt there, held or not),
//       state (pull.js's), dispose() }
//   off: nothing pulls (held at a pose, on foot, mid-jump, crossing)

import * as THREE from 'three';
import { pullAt } from './maw';
import { PULLS, PULL_WORDS, freshPull, pullStep, squashOf } from './pull';

const UP = new THREE.Vector3(0, 1, 0);

export function createPulls(parent, { model = () => null, note = () => {}, emit = () => {}, through = () => {}, reduced = false } = {}) {
  let st = freshPull();
  let k = 0;
  let maw = null; // (maw.js's pullAt where the ship is: { k, v }, or null)
  // the beam: a cone, narrow at the ship and wide at the gate, open, added light
  // (unit high, its top, +y, at the ship: a twentieth as wide there as at the gate)
  const geo = new THREE.CylinderGeometry(0.05, 1, 1, 24, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: '#8fd0ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(geo, mat);
  beam.name = 'tractor-beam';
  beam.visible = false;
  beam.frustumCulled = false;
  parent.add(beam);
  let base = null; // (the ship's own scale, kept while it's squashed)
  let last = null;

  const step = (ship, { boost = false, dt = 1 / 60, now = 0, off = false } = {}) => {
    // the Maw's gravity: drawn in, and carried round with its disk
    const g = ship ? pullAt(ship.x, ship.y, ship.z) : null;
    maw = g;
    if (!ship || off) {
      k = 0;
      draw(model());
      return ship;
    }
    k = g?.k ?? 0;
    let s = g ? { ...ship, x: ship.x + g.v[0] * dt, y: ship.y + g.v[1] * dt, z: ship.z + g.v[2] * dt } : ship;
    const r = pullStep(st, s, { boost, dt, now });
    st = r.st;
    s = r.ship;
    for (const e of r.events) {
      const words = PULL_WORDS[e.id]?.[e.type];
      if (words) note(words);
      if (e.type !== 'through') emit({ type: 'event', id: e.id === 'starwars' ? 'beam' : 'rift', sub: e.type });
      else if (e.id === 'starwars') emit({ type: 'portal', id: 'starwars' }); // (the gate's way through: the page's jump)
      else through(e.id);
    }
    // (once through, free again: the far side's its own)
    if (st.phase === 'through') st = { ...freshPull(), restUntil: now + 3 };
    last = s;
    draw(model());
    return s;
  };

  function draw(ship) {
    const p = PULLS.find((q) => q.id === st.id);
    const caught = st.phase !== 'free' && p && last;
    // the beam, from the gate to the ship
    beam.visible = Boolean(caught && p.kind === 'beam');
    if (beam.visible) {
      const a = new THREE.Vector3(...p.at);
      const b = new THREE.Vector3(last.x, last.y, last.z);
      const d = b.clone().sub(a);
      const l = d.length();
      beam.position.copy(a).addScaledVector(d, 0.5);
      beam.quaternion.setFromUnitVectors(UP, d.normalize());
      beam.scale.set(p.gate, l, p.gate); // (as wide as the gate's mouth at the gate)
      const pulse = reduced ? 1 : 0.8 + 0.2 * Math.sin(st.t * 9);
      mat.opacity = 0.06 * st.k * pulse; // (barely there, as the films' are: felt in the haul more than seen)
    }
    // the ship, squashed and stretched in the Rift's grab
    const pivot = ship?.pivot;
    if (!pivot) return;
    const [across, along] = reduced ? [1, 1] : squashOf(st);
    if (across === 1 && along === 1) {
      if (base !== null) pivot.scale.setScalar(base);
      base = null;
      return;
    }
    base ??= pivot.scale.x;
    pivot.scale.set(base * across, base * across, base * along);
  }

  return {
    step,
    get k() {
      return k;
    },
    get maw() {
      return maw;
    },
    get state() {
      return st;
    },
    dispose() {
      beam.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
