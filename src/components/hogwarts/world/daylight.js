// The day’s light on the grounds: rules/clock.js’s light for the hour (and
// the weather’s cloud) put on the scene, the Road’s relight() (its
// module.js) for a clock instead of a ride. The sky takes it, the one light
// that casts is the sun by day and the moon by night (keyLight), the sky
// light’s colour is the haze’s and its ground the grounds’ green, the fog
// is the haze, the house look’s shade follows the light there is, and the
// eye opens a little at dusk as the Road’s does.
//
//   createDaylight({ scene, renderer, house, sky, sun, hemi }) → {
//     set(light),               the scene in that light
//     follow(camera),           the key light kept over the camera (its shadow’s cascades fit there)
//     key,                      the last keyLight (dir, colour, intensity, moon)
//     dispose() }               the renderer’s exposure put back

import * as THREE from 'three';
import { keyLight, shadeOf, skyLight } from '../rules/clock';

const GREEN = new THREE.Color(0x3d4a2c); // (the light up off the lawns and the forest, dimmed)

export function createDaylight({ scene, renderer = null, house = null, sky = null, sun, hemi }) {
  const exposureWas = renderer?.toneMappingExposure ?? null;
  const base = exposureWas ?? 1;
  const dir = new THREE.Vector3(0, 1, 0);
  const shade = new THREE.Color();
  let key = null;
  return {
    get key() {
      return key;
    },
    dir,
    set(l) {
      sky?.set(l);
      key = keyLight(l);
      dir.set(...key.dir).normalize();
      sun.color.setRGB(...key.colour);
      sun.intensity = key.intensity;
      hemi.intensity = skyLight(l);
      hemi.color.setRGB(...l.fog.colour);
      hemi.groundColor.copy(GREEN).multiplyScalar(0.45 + 0.55 * Math.min(1, Math.max(0, (l.sun.el + 0.1) / 0.4)));
      if (renderer) renderer.toneMappingExposure = base * l.exposure;
      if (scene.fog) {
        scene.fog.color.setRGB(...l.fog.colour);
        scene.fog.density = l.fog.density;
      }
      if (house) {
        house.sky({ low: scene.fog?.color ?? new THREE.Color(...l.fog.colour), high: scene.fog?.color ?? new THREE.Color(...l.fog.colour), sunDir: dir });
        house.light({ sun, hemi });
        house.set({ shadow: shade.setRGB(...shadeOf(l, key)) });
      }
    },
    follow(camera) {
      sun.position.copy(camera.position).addScaledVector(dir, 120);
      sun.target.position.copy(camera.position);
      sun.target.updateMatrixWorld();
    },
    dispose() {
      if (renderer && exposureWas != null) renderer.toneMappingExposure = exposureWas;
    },
  };
}
