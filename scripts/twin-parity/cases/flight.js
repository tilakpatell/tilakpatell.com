// The planet flight's own twins (src/components/expanse/flight/nodes.js):
// its sky dome and its city's lit windows, each built once with the GLSL
// original (scene.js's skyDome, ground.js's cityMaterial) and once with its
// twin (the originals kept in glsl.js, which the flight no longer
// imports); and the two drawn as the flight draws them, straight to the
// canvas, the house's fog and the dome as the classic renderer showed them
// (drawn.js). On the flight's island (scripts/lib/flight-island.mjs): it
// goes with the flight.
import * as THREE from 'three';
import { cityMaterial as cityO, skyDome as skyO } from '../../../src/components/expanse/flight/glsl.js';
import { cityMaterial as cityN, skyDome as skyN } from '../../../src/components/expanse/flight/nodes.js';
import { drawnAsClassic } from '../../../src/components/expanse/flight/drawn.js';
import * as HO from '../../../src/lib/three/house.js';
import * as HN from '../../../src/lib/three/houseNodes.js';

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

// three towers on a lot line and a needle, instanced as the city’s pools are, scaled
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
  // and a round needle (ground.js's, at a pool's uniform scale): smooth
  // normals, whose sides pick their window axis by the normal's x
  const needle = new THREE.InstancedMesh(new THREE.CylinderGeometry(9 * 0.65, 9, 88, 12).translate(0, 44, 0), make('#8a8f99'), 1);
  needle.setMatrixAt(0, m.compose(new THREE.Vector3(10, 0, 45), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.3), new THREE.Vector3(1.2, 1.2, 1.2)));
  scene.add(needle);
};

// the flight as it is drawn: straight to the canvas under the house's tone
// mapping (Neutral, at its exposure of 1.4), not through a post chain, so
// the classic side tone maps and encodes each fragment and fogs it after,
// and leaves the dome as it is; a plain out to the horizon in the house's
// look and its fog, a block on it, the dome over them (Hoth's colours).
// The node side's fog and dome go through ../src/components/expanse/flight/drawn.js
const drawn = (make, H, classic) => ({ scene, camera, sun, renderer }) => {
  camera.position.set(0, 300, 0);
  camera.far = 50000;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 230, -2000);
  scene.fog = new THREE.Fog(0xe8eef6, 1500, 21000);
  scene.add(make('#cfd9e6', '#5a7fb3'));
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#eef2f8', roughness: 0.94 })));
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(300, 200, 300).translate(250, 100, -3000), new THREE.MeshLambertMaterial({ color: '#7a6a5a' })));
  const house = H.createHouse({ fog: true });
  house.light({ sun, hemi: scene.children.find((o) => o.isHemisphereLight) });
  house.sky({ low: new THREE.Color('#cfd9e6'), high: new THREE.Color('#5a7fb3'), sunDir: sun.position.clone().normalize() });
  (classic ? house : drawnAsClassic(house)).adopt(scene);
  return {
    // (the house's tone mapping for this case's draws only: the renderers are every case's)
    render() {
      const was = [renderer.toneMapping, renderer.toneMappingExposure];
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 1.4;
      renderer.render(scene, camera);
      [renderer.toneMapping, renderer.toneMappingExposure] = was;
    },
  };
};

export default {
  'flight:sky': { node: sky(skyN), classic: sky(skyO) },
  'flight:city': { node: city(cityN), classic: city(cityO) },
  'flight:drawn': { node: drawn(skyN, HN, false), classic: drawn(skyO, HO, true) },
};
