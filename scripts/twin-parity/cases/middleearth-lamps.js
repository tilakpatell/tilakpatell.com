// A town's lamps by night: Bree's pool of point lights (16 m, decay 1.7)
// on a palisade and a lane in the house look (lib/three/house.js against
// lib/three/houseNodes.js), under a dim sky, the lamp's glass glowing.
import * as THREE from 'three';
import * as HO from '../../../src/lib/three/house.js';
import * as HN from '../../../src/lib/three/houseNodes.js';

const lamps =
  (twin, { house = true, standard = true, far = 0 } = {}) =>
  ({ scene, camera, sun }) => {
    scene.clear();
    scene.background = new THREE.Color(0x0c1018);
    const hemi = new THREE.HemisphereLight(0x8494ae, 0x2c2c26, 0.8);
    sun.intensity = 0.75;
    sun.color.set(0xa4aec0);
    scene.add(hemi, sun);
    const M = (o) => (standard ? new THREE.MeshStandardMaterial({ roughness: 0.85, ...o }) : new THREE.MeshLambertMaterial(o));
    const wall = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 0.3), M({ color: 0x6a5038 }));
    wall.position.set(0, 1.5, -2);
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), M({ color: 0x3a3428 }));
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), M({ color: 0xf2c27a, emissive: new THREE.Color(0xff9438).multiplyScalar(3.2), emissiveIntensity: 0.05 }));
    glass.position.set(0.5, 2.2, -1.4);
    scene.add(wall, lane, glass);
    // (Bree's fog, the lamps `far` metres off down the lane)
    if (far) {
      scene.fog = new THREE.Fog(0x3c4450, 14, 115);
      lane.scale.set(1, 1, 8);
    }
    const warm = new THREE.Color(0xffa860);
    for (const [x, k] of [
      [0.5, 9],
      [-2.8, 8],
    ]) {
      const l = new THREE.PointLight(warm, 0, 16, 1.7);
      l.position.set(x, 2.2, -1.4);
      l.intensity = k;
      scene.add(l);
    }
    if (house) {
      const h = (twin ? HN : HO).createHouse();
      h.adopt(scene);
      h.light({ sun, hemi });
    }
    camera.position.set(0, 2.2, 5 + far);
    camera.lookAt(0, 1.2, -1);
  };

export default {
  'middleearth:lamps:house': { node: lamps(true), classic: lamps(false) },
  'middleearth:lamps:plain': { node: lamps(true, { house: false }), classic: lamps(false, { house: false }) },
  'middleearth:lamps:lambert': { node: lamps(true, { standard: false }), classic: lamps(false, { standard: false }) },
  'middleearth:lamps:fog': { node: lamps(true, { far: 30 }), classic: lamps(false, { far: 30 }) },
  'middleearth:lamps:fog:plain': { node: lamps(true, { far: 30, house: false }), classic: lamps(false, { far: 30, house: false }) },
};
