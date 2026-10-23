// The skill tree's guns in the hand that do more than a bolt, on the
// galaxy's worlds (and the planets that walk on its surface engine): what
// each does is lib/arms/behaviours.js's, and this keeps what they need
// between frames and draws them, so the surface's scene grows only by the
// calls.
//
// - The particle beam: each of its shots (ten a second, at the gun's own
//   pace through the scene's fire and its heat) is a beam to the first thing
//   on the line, not a bolt; drawn while they keep coming, muzzle to where
//   it lands, with a glow there.
// - The M60: no floor between its shots (unfloored), and each of a run
//   walks the aim up a little more than the last (climb).
// - The repulsor gauntlet: F held charges it, the palm's light swelling;
//   let go, the blast (step hands back the charge, 0…1, for the scene to
//   fire), drawn as a short, fat burst of light.
//
// createHandArms({ parent, muzzle, size }) → { unfloored(w), climb(w, now, ads),
//   charge(now), charging, step(now, w, held) → the charge let go, or null,
//   beam(from, to), blast(from, to, scale), frame(dt), clear(), dispose() }
// `muzzle()`: where the gun's muzzle is now (a Vector3 in `parent`'s space), or null.
// `size`: a metre in `parent`'s units (1 here; the universe map's planets, its METRE: they
// draw the beam and the blast too, galaxy/shared/fx.js).

import * as THREE from 'three';
import { HAND_FX, chargeOf, climbOf } from '../../../lib/arms/behaviours';

const BEAM_HOLD = 0.16; // seconds the beam stays drawn after its last shot
const BLAST_LIFE = 0.18;
const GREEN = new THREE.Color(0.35, 2.1, 0.6); // (bright enough to bloom, not to wash out the view round it)
const REPULSOR = new THREE.Color(1.6, 2.9, 3.6);
const Z = new THREE.Vector3(0, 0, 1);

const glow = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

export function createHandArms({ parent, muzzle = () => null, size = 1 }) {
  const owned = [];
  const keep = (o) => (owned.push(o), o);
  const rod = keep(new THREE.CylinderGeometry(1, 1, 1, 8, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5)); // (along z, 0 to 1)
  const ball = keep(new THREE.SphereGeometry(1, 14, 10));
  const make = (geo, color, name) => {
    const m = new THREE.Mesh(geo, keep(glow(color)));
    m.visible = false;
    m.frustumCulled = false;
    m.name = name;
    parent.add(m);
    return m;
  };
  const ray = make(rod, GREEN, 'hand-beam');
  const core = make(rod, new THREE.Color(1.5, 2.4, 1.5), 'hand-beam-core');
  const end = make(ball, GREEN, 'hand-beam-end');
  const palm = make(ball, REPULSOR, 'hand-charge');
  const burst = make(rod, REPULSOR, 'hand-blast');

  let clock = 0;
  let beamAt = -Infinity;
  const beamFrom = new THREE.Vector3();
  const beamTo = new THREE.Vector3();
  let chargeAt = null; // when F went down on the gauntlet
  let held = 0; // how long it's been held, for the glow
  let gauntlet = null; // (the gun the charge is for)
  let run = 0; // the M60's shots in this run
  let lastShot = -Infinity;
  let blastAge = BLAST_LIFE;
  const d = new THREE.Vector3();
  const lay = (mesh, from, to, width) => {
    d.subVectors(to, from);
    const len = Math.max(0.01, d.length());
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(Z, d.divideScalar(len));
    mesh.scale.set(width, width, len);
    mesh.visible = true;
  };

  return {
    // no floor between the shots of a beam, a stream or a charge (each keeps its own pace)
    unfloored: (w) => Boolean(w?.beam || w?.stream || w?.charge),
    // radians the aim goes up for a shot of this gun now (a run: shots less than HAND_FX.m60.gap apart)
    climb(w, now, ads) {
      if (!w?.climb) return 0;
      run = now - lastShot <= HAND_FX.m60.gap ? run + 1 : 0;
      lastShot = now;
      return climbOf(w, run, ads);
    },
    // F down (or still down) on the gauntlet: the charge growing from the first
    charge(now) {
      chargeAt ??= now;
    },
    get charging() {
      return chargeAt != null;
    },
    // a frame of the gun in hand: F let go on a charge fires it (its share,
    // handed back); a gun that isn't the gauntlet any more drops it
    step(now, w, down) {
      if (chargeAt == null) return null;
      if (!w?.charge) {
        chargeAt = null;
        return null;
      }
      gauntlet = w;
      held = now - chargeAt;
      if (down) return null;
      const k = chargeOf(held, w);
      chargeAt = null;
      return k;
    },
    beam(from, to) {
      beamAt = clock;
      beamFrom.copy(from);
      beamTo.copy(to);
    },
    blast(from, to, scale = 1) {
      blastAge = 0;
      lay(burst, from, to, 0.08 * scale * size);
    },
    frame(dt) {
      clock += dt;
      // the beam, while its shots keep coming
      const on = clock - beamAt < BEAM_HOLD;
      if (on) {
        const flick = 1 + Math.sin(clock * 70) * 0.18;
        const at = muzzle() ?? beamFrom;
        lay(ray, at, beamTo, 0.05 * flick * size);
        lay(core, at, beamTo, 0.018 * size);
        end.position.copy(beamTo);
        end.scale.setScalar(0.16 * flick * size);
        end.visible = true;
      } else ray.visible = core.visible = end.visible = false;
      // the palm's light, swelling as the charge does
      const at = chargeAt != null ? muzzle() : null;
      palm.visible = Boolean(at);
      if (at) {
        const k = chargeOf(held, gauntlet);
        palm.position.copy(at);
        palm.scale.setScalar((0.025 + 0.06 * k) * (1 + Math.sin(clock * 30) * 0.1 * k) * size);
        palm.material.color.copy(REPULSOR).multiplyScalar(0.3 + 0.6 * k);
      }
      // the blast, gone in a moment
      blastAge += dt;
      burst.visible = blastAge < BLAST_LIFE;
      if (burst.visible) burst.material.color.copy(REPULSOR).multiplyScalar(1.4 * (1 - blastAge / BLAST_LIFE));
    },
    clear() {
      beamAt = -Infinity;
      chargeAt = null;
      blastAge = BLAST_LIFE;
      for (const m of [ray, core, end, palm, burst]) m.visible = false;
    },
    dispose() {
      for (const m of [ray, core, end, palm, burst]) parent.remove(m);
      for (const o of owned) o.dispose();
    },
  };
}
