// The Game Boy's screen, as a last pass: the island is drawn small (a few
// hundred pixels across, scaled up without smoothing), and every pixel is
// turned into one of four shades by its brightness, with a 4 × 4 Bayer
// pattern breaking the steps between shades into checks and lines (ordered
// dithering, as on the handheld's own screen shots). Edges where something
// stands in front of something further off (from the depth buffer) are
// drawn in the darkest shade, as the sprites were outlined.
//
// The four shades come from a palette: the original DMG's pea-soup greens,
// the Pocket's greys, or the Light's backlit teal.

import * as THREE from 'three';

// darkest first
export const PALETTES = {
  dmg: { name: 'DMG', shades: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  pocket: { name: 'Pocket', shades: ['#1e1f1a', '#4d533c', '#8b956d', '#c4cfa1'] },
  light: { name: 'Light', shades: ['#08292e', '#1d6b6a', '#5eb5a0', '#c9f6df'] },
};
export const PALETTE_ORDER = ['dmg', 'pocket', 'light'];

// What a surface should give out (linear) to come out as exactly shade k (0
// to 3) after this pass: for the Game Boy's own screen, which is already in
// four shades and shouldn't be dithered again.
export const shadeValue = (k) => Math.pow(k / 3, 2.2);

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform vec3 uPal[4];
uniform float uNear;
uniform float uFar;
uniform float uLift;
uniform float uContrast;
uniform float uOutline;
uniform float uFade; // 1: the screen fades to the lightest shade (a warp, coming ashore)
varying vec2 vUv;

float bayer(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int k = i.x + i.y * 4;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[k] + 0.5) / 16.0;
}

float dist(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return d >= 1.0 ? 1e5 : -perspectiveDepthToViewZ(d, uNear, uFar);
}

void main() {
  vec2 px = 1.0 / uRes;
  vec3 c = texture2D(tColor, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float v = pow(clamp(l, 0.0, 1.0), 1.0 / 2.2);
  v = clamp((v - 0.5) * uContrast + 0.5 + uLift, 0.0, 1.0);
  v = mix(v, 1.0, uFade);
  float q = clamp(floor(v * 3.0 + bayer(gl_FragCoord.xy) + 0.001), 0.0, 3.0);

  // an outline where this pixel is in front of a neighbour well behind it
  float d = dist(vUv);
  float far = max(max(dist(vUv + vec2(px.x, 0.0)), dist(vUv - vec2(px.x, 0.0))), max(dist(vUv + vec2(0.0, px.y)), dist(vUv - vec2(0.0, px.y))));
  if (uOutline > 0.5 && d < 1e4 && far - d > 0.35 + d * 0.045) q = 0.0;

  int k = int(q);
  vec3 col = k == 0 ? uPal[0] : k == 1 ? uPal[1] : k == 2 ? uPal[2] : uPal[3];
  gl_FragColor = vec4(col, 1.0);
}`;

// A pass that draws `target` (colour and depth) to the canvas in four shades.
export function createDither(camera) {
  const pal = [0, 1, 2, 3].map(() => new THREE.Vector3());
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uPal: { value: pal },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uLift: { value: 0 },
      uContrast: { value: 1.08 },
      uOutline: { value: 1 },
      uFade: { value: 0 },
    },
  });
  // one triangle over the whole screen
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(geo, material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const setPalette = (id) => {
    const shades = (PALETTES[id] ?? PALETTES.dmg).shades;
    const c = new THREE.Color();
    // straight onto the canvas, as written: the hex values are what's shown
    shades.forEach((hex, i) => {
      c.setStyle(hex, THREE.SRGBColorSpace);
      const s = c.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
      pal[i].set(s.r, s.g, s.b);
    });
  };
  setPalette('dmg');

  return {
    material,
    // its own scene and camera (the quad), for compiling before the first frame
    scene,
    camera: ortho,
    setPalette,
    set fade(v) {
      material.uniforms.uFade.value = v;
    },
    render(renderer, target) {
      const u = material.uniforms;
      u.tColor.value = target.texture;
      u.tDepth.value = target.depthTexture;
      u.uRes.value.set(target.width, target.height);
      u.uNear.value = camera.near;
      u.uFar.value = camera.far;
      renderer.setRenderTarget(null);
      renderer.render(scene, ortho);
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
