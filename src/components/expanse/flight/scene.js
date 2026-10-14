// The flight's scene, apart from the ground: a sky dome in the planet's
// colours, a sun and the sky's light, the ship as a code-built wedge, and the
// chase camera behind it. Everything is drawn relative to the floating
// origin (rt.origin): the module hands `place` the ship in world metres and
// the origin's `at`, so nothing the renderer sees is ever far from 0.
//
//   createFlightScene({ spec, palette }) → { scene, camera, sun, hemi, ship
//     (the Object3D), place(ship, at, dt), resize(w, h), dispose() }

import * as THREE from 'three';
import { forwardOf } from './flightRules';
import { createLandmarks } from './landmarkScene';
import { withLife } from './lifeScene';
import { withOccurrences } from './occurrenceScene';
import { skyDome } from './nodes';

const SKY_R = 40000; // m: inside the camera's far plane, round the camera
export const FOG = { near: 1500, far: 21000 }; // m: the far ground melts into the sky before the last leaves end


// the ship: a wedge of a hull, swept wings, a canopy and two engines, about
// 12 m nose to tail, its nose down −z (forwardOf's yaw 0)
function shipModel(c) {
  const g = new THREE.Group();
  const mat = (hex, extra = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, metalness: 0.1, flatShading: true, ...extra });
  const hull = new THREE.Mesh(new THREE.ConeGeometry(1.4, 12, 4), mat(c.hull));
  hull.rotation.x = -Math.PI / 2;
  hull.rotation.y = Math.PI / 4;
  hull.scale.set(1, 1, 0.55);
  g.add(hull);
  const wing = new THREE.BufferGeometry();
  // a swept triangle, flat, from the hull's middle back
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -1.5, 7, 0, 4.5, 0, 0, 5, 0, 0, -1.5, 0, 0, 5, -7, 0, 4.5], 3));
  wing.computeVertexNormals();
  const wings = new THREE.Mesh(wing, mat(c.wing, { side: THREE.DoubleSide }));
  wings.position.y = -0.2;
  g.add(wings);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), mat(c.canopy, { roughness: 0.2 }));
  canopy.scale.set(0.9, 0.6, 1.8);
  canopy.position.set(0, 0.6, -0.5);
  g.add(canopy);
  for (const x of [-1.3, 1.3]) {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 2.4, 8), mat(c.wing));
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, 0, 4.6);
    g.add(engine);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 12), new THREE.MeshBasicMaterial({ color: c.glow }));
    glow.position.set(x, 0, 5.81);
    g.add(glow);
  }
  return g;
}

export function createFlightScene({ spec, palette, house = null }) {
  const p = spec.palette;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 1, SKY_R * 1.2);
  const sky = skyDome(p.skyLow ?? p.low, p.skyHigh ?? palette[3]);
  scene.add(sky);
  // (a planet may have its own haze: Coruscant's dusk closes in sooner)
  scene.fog = new THREE.Fog(new THREE.Color(p.skyLow ?? p.low), spec.fog?.near ?? FOG.near, spec.fog?.far ?? FOG.far);
  const hemi = new THREE.HemisphereLight(new THREE.Color(p.skyHigh ?? palette[3]).lerp(new THREE.Color('#ffffff'), 0.4), new THREE.Color(p.rock), 1.7);
  // (the sky's light strong enough that a mountain's face turned from the sun
  // still shows its rock: at 1.1 the Misty Mountains' shade was near black)
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(new THREE.Color(palette[5]).lerp(new THREE.Color('#ffffff'), 0.6), 2.2);
  // low and to one side: long light across the ridges
  const sunDir = new THREE.Vector3(0.55, 0.45, -0.7).normalize();
  sun.position.copy(sunDir).multiplyScalar(1000);
  scene.add(sun, sun.target);
  const ship = shipModel({ hull: palette[1], wing: palette[2], canopy: palette[4], glow: palette[6] });
  scene.add(ship);
  // (the POIs' buildings, streamed in round the ship: ./landmarkScene.js)
  const landmarks = createLandmarks(scene, { spec, house });

  const eye = new THREE.Vector3();
  const look = new THREE.Vector3();
  let primed = false;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  // (the planet's life rides on the view: lifeScene.js; what happens round it: occurrenceScene.js)
  return withOccurrences(spec, withLife(spec, {
    scene,
    camera,
    sun,
    hemi,
    ship,
    sunDir,
    // the ship at (world − at), the camera chasing it, the sky and the sun
    // round the camera
    place(s, at, dt = 0) {
      const x = s.x - at[0], y = s.y - at[1], z = s.z - at[2];
      ship.position.set(x, y, z);
      euler.set(s.pitch, s.yaw, -s.roll);
      ship.quaternion.setFromEuler(euler);
      const [fx, fy, fz] = forwardOf(s);
      const want = new THREE.Vector3(x - fx * 26, y - fy * 26 + 7, z - fz * 26);
      // (the camera lags a little, so a turn is felt; snapped on the first frame and after a jump)
      const k = primed && dt > 0 ? 1 - Math.exp(-dt * 6) : 1;
      if (!primed || eye.distanceTo(want) > 400) eye.copy(want);
      else eye.lerp(want, k);
      primed = true;
      camera.position.copy(eye);
      look.set(x + fx * 40, y + fy * 40 + 2, z + fz * 40);
      camera.lookAt(look);
      sky.position.copy(camera.position);
      sun.target.position.copy(ship.position);
      sun.position.copy(ship.position).addScaledVector(sunDir, 1000);
      landmarks.update(s, at, dt);
    },
    // the origin moved: what's kept between frames moves with it
    shift([dx, , dz]) {
      eye.x -= dx;
      eye.z -= dz;
    },
    resize(w, h) {
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    dispose() {
      landmarks.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m?.dispose();
      });
    },
  }));
}
