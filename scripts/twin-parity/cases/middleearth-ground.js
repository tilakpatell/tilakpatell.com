// A town’s ground: ../../../src/components/middleearth/towns/ground.js
// against its twin, nodes/towns/ground.js. Bree’s puddles on a wet night,
// rippling in the rain, holding the sky and three lamps, in fog; the grass
// tufts swaying a little way into the wind’s clock; and the painted ground
// itself under its detail texture.
import * as THREE from "three";
import * as GO from "../../../src/components/middleearth/towns/ground.js";
import * as GN from "../../../src/components/middleearth/nodes/towns/ground.js";

const height = (x, z) => 0.25 * Math.sin(x * 0.4) + 0.15 * Math.cos(z * 0.5);
const PUDDLES = [
  [0, 0, 2.2, 1.4, 0.3],
  [-3, -2.5, 1.4, 1, 1.1],
  [3.2, -1.5, 1.2, 0.8, -0.4],
];

const puddles =
  (G) =>
  ({ scene, camera }) => {
    scene.background.set(0x10141a);
    scene.fog = new THREE.Fog(0x10141a, 4, 18);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20, 40, 40).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x3a3026 }),
    );
    const p = floor.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
    floor.geometry.computeVertexNormals();
    scene.add(floor);
    const pd = G.makePuddles(PUDDLES, height);
    pd.setLights([
      {
        position: new THREE.Vector3(0.5, 2.4, -4),
        color: new THREE.Color(1, 0.7, 0.3),
        power: 2,
      },
      {
        position: new THREE.Vector3(-3, 2, -6),
        color: new THREE.Color(1, 0.55, 0.25),
      },
      {
        position: new THREE.Vector3(4, 3, -5),
        color: new THREE.Color(0.6, 0.7, 1),
        power: 1.5,
      },
    ]);
    pd.update(3.7, 1);
    pd.uniforms.uSky.value.set(0x3a4658);
    scene.add(pd.mesh);
    camera.position.set(0, 1.4, 4.5);
    camera.lookAt(0, 0, -1);
  };
const tufts =
  (G) =>
  ({ scene, camera }) => {
    const wind = { uWind: { value: 2.3 } };
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x4a3a28 }),
    );
    scene.add(ground);
    scene.add(
      G.makeTufts(
        900,
        { radius: 5, height: () => 0, growable: () => true, seed: 41 },
        wind,
      ),
    );
    camera.position.set(0, 1, 2.6);
    camera.lookAt(0, 0.1, 0);
  };
const terrain =
  (G) =>
  ({ scene, camera, renderer }) => {
    const mesh = G.makeTerrain(renderer, {
      size: 30,
      seg: 60,
      height: (x, z) => 0.8 * Math.sin(x * 0.3) * Math.cos(z * 0.25),
      paint: (x, z, h, out) => {
        out[0] = 0.32 + 0.1 * h;
        out[1] = 0.38 + 0.15 * Math.sin(x * 0.2);
        out[2] = 0.2;
      },
      blades: 0.4,
    });
    scene.add(mesh);
    camera.position.set(0, 2.5, 6);
    camera.lookAt(0, 0, 0);
  };

export default {
  "middleearth:ground:puddles": { node: puddles(GN), classic: puddles(GO) },
  "middleearth:ground:tufts": { node: tufts(GN), classic: tufts(GO) },
  "middleearth:ground:terrain": { node: terrain(GN), classic: terrain(GO) },
};
