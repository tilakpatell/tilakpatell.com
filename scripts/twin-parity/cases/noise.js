// noiseGlsl.js against noiseNodes.js, each function drawn raw on a square
// that fills the view (a slanted slice of 3D, so z moves too): the hashes
// must agree bit for bit, or the cells come out in other shades; the
// noises, the fbms and their gradients must agree to the pixel.
import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { positionLocal, uniform, vec3, vec4 } from 'three/tsl';
import { NOISE } from '../../../src/lib/three/noiseGlsl.js';
import { noiseWith } from '../../../src/lib/three/noiseNodes.js';

const SEED = [17, 3, 41];
// (each: the GLSL's colour, the TSL's from the functions and the point)
const LOOKS = {
  hash13: ['vec3(hash13(floor(p * 6.0)))', (f, p) => vec3(f.hash13(p.mul(6.0).floor()))],
  hash33: ['hash33(floor(p * 6.0) + 0.5)', (f, p) => f.hash33(p.mul(6.0).floor().add(0.5))],
  noise: ['vec3(0.5 + 0.5 * noise(p * 3.0))', (f, p) => vec3(f.noise(p.mul(3.0)).mul(0.5).add(0.5))],
  noised: [
    '0.5 + 0.5 * vec3(noised(p * 3.0).x, noised(p * 3.0).yz * 0.25)',
    (f, p) =>
      vec3(f.noised(p.mul(3.0)).x, f.noised(p.mul(3.0)).yz.mul(0.25))
        .mul(0.5)
        .add(0.5),
  ],
  noised2: [
    '0.5 + 0.5 * vec3(noised2(p * 3.0).x, noised2(p * 3.0).zw * 0.2)',
    (f, p) =>
      vec3(f.noised2(p.mul(3.0)).x, f.noised2(p.mul(3.0)).zw.mul(0.2))
        .mul(0.5)
        .add(0.5),
  ],
  fbm: ['vec3(0.5 + 0.7 * fbm(p * 2.0, 5.5))', (f, p) => vec3(f.fbm(p.mul(2.0), 5.5).mul(0.7).add(0.5))],
  fbmd: [
    '0.5 + 0.5 * vec3(fbmd(p * 2.0, 6.5, 0.5).x, fbmd(p * 2.0, 6.5, 0.5).yz * 0.15)',
    (f, p) =>
      vec3(f.fbmd(p.mul(2.0), 6.5, 0.5).x, f.fbmd(p.mul(2.0), 6.5, 0.5).yz.mul(0.15))
        .mul(0.5)
        .add(0.5),
  ],
};

const square = ({ scene, camera }, material) => {
  scene.background = new THREE.Color(0);
  camera.position.set(0, 0, 2.2);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), material));
};

const classic = (glsl) => (w) =>
  square(
    w,
    new THREE.ShaderMaterial({
      uniforms: { uSeed: { value: new THREE.Vector3(...SEED) } },
      vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vP;\n${NOISE}\nvoid main() { vec3 p = vec3(vP.xy, vP.x * 0.3 + vP.y * 0.7) + 0.37; gl_FragColor = vec4(${glsl}, 1.0); }`,
    }),
  );

const node = (tsl) => (w) => {
  const f = noiseWith(uniform(new THREE.Vector3(...SEED)));
  const p = vec3(positionLocal.xy, positionLocal.x.mul(0.3).add(positionLocal.y.mul(0.7))).add(0.37);
  const m = new MeshBasicNodeMaterial();
  m.colorNode = vec4(tsl(f, p), 1);
  square(w, m);
};

export default Object.fromEntries(Object.entries(LOOKS).map(([k, [glsl, tsl]]) => [`noise:${k}`, { node: node(tsl), classic: classic(glsl) }]));
