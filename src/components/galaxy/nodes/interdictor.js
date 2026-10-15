// The Imperial Interdictor (../interdictor.js) on the node renderer: the
// same set piece, the cruiser dropping in, its flash and its gravity well,
// with the same arguments, the same returned object and the same timing.
// The well’s shell is its shader line for line in TSL on a
// MeshBasicNodeMaterial with the GLSL’s uniforms on `material.uniforms`
// (nodes, under the same names, so the frame’s `.value` writes reach it);
// the flash is a SpriteNodeMaterial. The well is not tone mapped (the GLSL
// had no tone-mapping chunk) and takes no fog (a ShaderMaterial never did).
//
// createInterdictor(parent, { models, small }) → { arrive(place) → true | false, leave(), hide(),
//   update(dt, t) → busy, here, at, solids (interdiction.js's interdictorSolids), dispose() }
// `place` is interdiction.js's interdictorPlace(): { at, heading, drift }.
// Everything's in `parent`'s space (the system's).

import * as THREE from 'three';
import { MeshBasicNodeMaterial, SpriteNodeMaterial } from 'three/webgpu';
import { Fn, abs, asin, atan, clamp, dot, float, normalViewGeometry, normalize, positionLocal, positionViewDirection, pow, sin, uniform } from 'three/tsl';
import { INTERDICTION, interdictorSolids } from '../interdiction';
import { JUMP, jumpSmear } from '../../universe/capitalRules';
import { sharpen } from '../../../lib/three/textures';

const LINGER = 240; // seconds at most it stays, fighters or no

// the well: a shell seen from inside or out, brightest at its rim, with the
// field's bands drawn slowly across it (interdictor.js's WELL_FRAG, line for line)
function wellMaterial() {
  const u = { uTime: uniform(0), uAmount: uniform(0), uColor: uniform(new THREE.Color(0.55, 0.32, 1.25)) };
  const shell = Fn(() => {
    const rim = pow(abs(dot(normalize(normalViewGeometry), positionViewDirection)).oneMinus(), 2.6);
    const lat = asin(clamp(positionLocal.y, -1, 1));
    const lon = atan(positionLocal.z, positionLocal.x);
    const bands = sin(lat.mul(16).add(u.uTime.mul(1.4))).mul(sin(lon.mul(5).sub(u.uTime.mul(0.6)))).mul(0.5).add(0.5);
    const a = rim.mul(0.85).add(bands.mul(0.07)).mul(u.uAmount);
    return u.uColor.mul(a);
  }, 'vec3');
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
  mat.colorNode = shell();
  mat.opacityNode = float(1);
  mat.uniforms = u;
  return mat;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createInterdictor(parent, { models, small = false } = {}) {
  const made = [];
  const keep = (x) => (made.push(x), x);
  const size = INTERDICTION.size;

  // the cruiser, in its slot the first time it's wanted
  let slot = null;
  const flash = new THREE.Sprite(keep(new SpriteNodeMaterial({ map: keep(glowTexture()), color: new THREE.Color(2.2, 2.6, 5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  flash.visible = false;
  parent.add(flash);
  const piece = { state: null, age: 0, heading: 0, at: new THREE.Vector3(), drift: new THREE.Vector3() };

  // the well
  const wellMat = keep(wellMaterial());
  const well = new THREE.Mesh(keep(new THREE.SphereGeometry(1, small ? 32 : 48, small ? 20 : 30)), wellMat);
  well.scale.setScalar(INTERDICTION.well);
  well.visible = false;
  well.frustumCulled = false;
  well.renderOrder = -4;
  parent.add(well);
  let wellWant = 0;

  const hide = () => {
    piece.state = null;
    if (slot) slot.holder.visible = false;
    flash.visible = false;
    wellWant = 0;
  };

  return {
    // it drops in: across your bow, broadside on (false if one's here already)
    arrive(place) {
      if (piece.state) return false;
      if (!slot) {
        slot = models.slot('interdictor', size);
        parent.add(slot.holder);
      }
      piece.at.set(place.at[0], place.at[1], place.at[2]);
      piece.heading = place.heading;
      piece.drift.set(place.drift[0], place.drift[1], place.drift[2]);
      piece.state = 'in';
      piece.age = 0;
      slot.holder.visible = true;
      flash.visible = true;
      flash.position.copy(piece.at);
      well.position.copy(piece.at);
      well.visible = true;
      wellWant = 1;
      return true;
    },
    // and it jumps away (its fighters gone, or it's had its go)
    leave() {
      if (piece.state !== 'here' && piece.state !== 'in') return;
      piece.state = 'out';
      piece.age = 0;
      flash.visible = true;
      flash.position.copy(piece.at);
      wellWant = 0;
    },
    // gone at once (a new system)
    hide,
    get here() {
      return piece.state === 'here' || piece.state === 'in';
    },
    get at() {
      return piece.state ? [piece.at.x, piece.at.y, piece.at.z] : null;
    },
    get solids() {
      return interdictorSolids(piece.state, this.at);
    },

    update(dt, t) {
      let busy = false;
      if (piece.state) {
        busy = true;
        piece.age += dt;
        const g = slot.holder;
        piece.at.addScaledVector(piece.drift, dt);
        g.position.copy(piece.at);
        g.rotation.set(0, piece.heading + Math.PI, 0); // (its nose is +z; forward() is −z at heading 0)
        // smeared along its line of flight while it comes out of hyperspace
        // (or goes in): the nose runs in from behind and stops where the ship
        // stops, and on the way out streaks off ahead with the stern after it
        // (capitalRules.js's jumpSmear, the universe map's Star Destroyers' too)
        const { stretch, shift } = jumpSmear(piece.state, piece.age / JUMP, size);
        if (piece.state === 'in' && piece.age >= JUMP) piece.state = 'here';
        else if (piece.state === 'here' && piece.age > LINGER) this.leave();
        else if (piece.state === 'out' && piece.age >= JUMP) hide();
        g.scale.set(1, 1, stretch);
        g.translateZ(shift);
        well.position.copy(piece.at);
        if (flash.visible) {
          const a = piece.state === 'in' || piece.state === 'out' ? piece.age : JUMP + 1;
          const k = a < 0.15 ? a / 0.15 : Math.exp(-(a - 0.15) * 4);
          flash.scale.setScalar(size * (0.6 + k));
          flash.material.opacity = k;
          if (a > 1.2) flash.visible = false;
        }
      }
      if (well.visible) {
        busy = true;
        const u = wellMat.uniforms;
        u.uAmount.value += (wellWant - u.uAmount.value) * Math.min(1, dt * 1.6);
        u.uTime.value = t % 1000;
        if (wellWant === 0 && u.uAmount.value < 0.003) {
          u.uAmount.value = 0;
          well.visible = false;
        }
      }
      return busy;
    },

    dispose() {
      hide();
      if (slot) models.drop(slot);
      flash.removeFromParent();
      well.removeFromParent();
      for (const x of made) x.dispose();
    },
  };
}
