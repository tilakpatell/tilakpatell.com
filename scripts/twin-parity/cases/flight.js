// The planet flight's own twins (src/components/expanse/flight/nodes.js):
// its sky dome and its city's lit windows, each built once with the GLSL
// original (scene.js's skyDome, ground.js's cityMaterial) and once with its
// twin (the originals kept in ./flightGlsl.js, which the flight no longer
// imports). On the flight's island (scripts/lib/flight-island.mjs): it goes
// with the flight.
import * as THREE from 'three';
import { cityMaterial as cityO, skyDome as skyO } from './flightGlsl.js';
import { cityMaterial as cityN, skyDome as skyN } from '../../../src/components/expanse/flight/nodes.js';

// the dome round the camera, looking a little up from the horizon, so the
// gradient's whole run is in the picture (Hoth's colours, a tint after)
const sky = (make) => ({ scene, camera }) => {
  camera.position.set(0, 0, 0);
  camera.far = 50000;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0.25, -1);
  const dome = make('#cfd9e6', '#5a7fb3');
  scene.add(dome);
  // (occurrenceScene's tint goes through the uniforms' values)
  dome.material.uniforms.uLow.value.lerp(new THREE.Color('#e8c9a0'), 0.3);
};

// three towers on a lot line, instanced as the city's pools are, scaled
// tall as the leaves scale them, lit as the flight lights them (a sun and
// the sky's light), seen near enough for their panes and far enough for
// the far one's glow
const city = (make) => ({ scene, camera }) => {
  camera.position.set(-60, 30, 90);
  camera.far = 2000;
  camera.updateProjectionMatrix();
  camera.lookAt(40, 25, -40);
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x40362c, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
  sun.position.set(-1, 2, 1.5);
  scene.add(sun);
  const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), make('#8a8f99'), 3);
  const m = new THREE.Matrix4();
  const at = [
    [0, 0, 0, 30, 90, 24, 0.2],
    [70, 0, -60, 26, 140, 26, -0.4],
    [180, 0, -260, 40, 110, 30, 0.1],
  ];
  at.forEach(([x, y, z, w, h, d, yaw], i) => {
    m.compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(w, h, d));
    towers.setMatrixAt(i, m);
  });
  scene.add(towers);
};

export default {
  'flight:sky': { node: sky(skyN), classic: sky(skyO) },
  'flight:city': { node: city(cityN), classic: city(cityO) },
};
