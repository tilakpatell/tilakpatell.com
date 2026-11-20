// The portals between the map's sectors, drawn (portals.js has the numbers,
// scene.js the transit): each a Rick portal as the show draws it, the C-137
// page's swirl (rickmorty/swirl.js's portal()) always turned to the camera,
// a wide green haze round it so it's seen from far off, and a slow ring of
// sparks drifting in. Space scenery, so it's all shaders: no model.
//
// createSectorPortals(parent) → { update(t, camera), dispose() }

import * as THREE from 'three';
import { PORTALS } from './portals';
import { SWIRL_GLSL } from '../rickmorty/swirl';

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SWIRL_FRAG = `
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
${SWIRL_GLSL}
void main() {
  vec4 c = portal((vUv * 2.0 - 1.0) * 1.3, uTime, 1.0, uSeed);
  if (c.a < 0.004) discard;
  gl_FragColor = vec4(c.rgb * 1.6, c.a);
  #include <colorspace_fragment>
}`;
// the haze: soft, wide, breathing a little
const HAZE_FRAG = `
uniform float uTime;
varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  float a = (exp(-r * r * 5.0) * 0.55 + exp(-r * r * 18.0) * 0.4) * (0.85 + 0.15 * sin(uTime * 1.7));
  gl_FragColor = vec4(vec3(0.35, 1.0, 0.45) * a, a);
}`;
// the sparks: a ring of flecks spiralling in
const SPARK_FRAG = `
uniform float uTime;
varying vec2 vUv;
float h(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec2 o = vUv * 2.0 - 1.0;
  float r = length(o);
  float a = atan(o.y, o.x);
  float c = 0.0;
  for (int i = 0; i < 14; i++) {
    float f = float(i);
    float k = fract(h(f * 7.1) - uTime * (0.08 + h(f) * 0.06));
    float rr = mix(0.35, 0.98, k);
    float aa = h(f * 3.3) * 6.2832 + uTime * 0.6 + (1.0 - k) * 2.0;
    vec2 p = vec2(cos(aa), sin(aa)) * rr;
    c += exp(-dot(o - p, o - p) * 1600.0) * smoothstep(0.0, 0.3, k) * smoothstep(1.0, 0.8, k);
  }
  c *= smoothstep(1.0, 0.9, r);
  gl_FragColor = vec4(vec3(0.75, 1.0, 0.6) * c, c);
}`;

export function createSectorPortals(parent) {
  const group = new THREE.Group();
  group.name = 'sector-portals';
  parent.add(group);
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const uTime = { value: 0 };
  const premultiplied = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation };
  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
  const plane = own(new THREE.PlaneGeometry(1, 1));
  const faces = [];
  PORTALS.forEach((p, i) => {
    const g = new THREE.Group();
    g.name = `portal-${p.id}`;
    g.position.set(...p.at);
    const layer = (frag, size, order, blend, extra = {}) => {
      const m = new THREE.Mesh(plane, own(new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: { uTime, ...extra }, side: THREE.DoubleSide, ...blend })));
      m.scale.setScalar(size);
      m.renderOrder = order;
      m.frustumCulled = false;
      g.add(m);
      return m;
    };
    const r = p.show ?? p.r; // (the Curve Rift's is drawn far bigger than it takes you: deep.js)
    layer(HAZE_FRAG, r * (p.show ? 3.4 : 7), 1, additive); // (a big one's glow kept close: it sits in the dark, not lights it)
    layer(SWIRL_FRAG, r * 2.4, 3, premultiplied, { uSeed: { value: 2.3 + i * 1.7 } });
    layer(SPARK_FRAG, r * 3.2, 4, additive);
    group.add(g);
    faces.push({ g, lopsided: Boolean(p.show), seed: i * 1.7 });
  });
  const q = new THREE.Quaternion();
  return {
    group,
    update(t, camera) {
      uTime.value = t;
      if (!camera) return;
      // always face the camera: undo the map's turn, then take the camera's
      group.getWorldQuaternion(q).invert().multiply(camera.quaternion);
      for (const { g, lopsided, seed } of faces) {
        g.quaternion.copy(q);
        // (a big one lopsided, as the show draws them, and wobbling a little)
        if (lopsided) g.scale.set(1 + 0.04 * Math.sin(t * 1.1 + seed), 1.24 + 0.06 * Math.sin(t * 1.7 + seed), 1);
      }
    },
    dispose() {
      parent.remove(group);
      for (const x of owned) x.dispose();
    },
  };
}
