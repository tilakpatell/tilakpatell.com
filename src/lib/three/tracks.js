// Wheel tracks, Bruno Simon's way (folio-2025's Tracks.js; research note
// Part 1 §2): each track is a ring of its last `count` contact points in a
// one-row float texture (x, z, and whether the wheel touched), pushed no
// oftener than every 1/30 s and 0.2 m; a ribbon is extruded through them in
// the vertex shader, and every ribbon is drawn, additive, by a camera
// looking straight down, into one target over `size` metres round the
// focus. The ground (land.js), the grass (grass.js's `tracks`) and the
// leaves read it through `tracksAt(xz)`: the grass lies flat under the
// wheels (its G times 1 − r) for nothing on the main pass.
//
//   createTracks({ size = 40, texels = 512, count = 128 }) → { target,
//     uniforms: { uTracks, uTracksCentre, uTracksSize }, glsl: TRACKS_GLSL,
//     track(width, channel 'r' | 'g' | 'b' | 'a') → { push(x, z, touching,
//     now), mesh, texture, count }, render(renderer, focus: { x, z }),
//     dispose() }
//   trackLayout(points [x, z, …], width) → positions (pure: the ribbon the
//     shader draws, for the test)
//   TRACKS_GLSL: vec4 tracksAt(vec2 xz) (0 outside the target)
//   TRACK_VS, TRACK_FS: the ribbon's shaders

import * as THREE from 'three';

export const TRACKS_GLSL = /* glsl */ `
uniform sampler2D uTracks;
uniform vec2 uTracksCentre;
uniform float uTracksSize;
vec4 tracksAt(vec2 xz) {
  // (the camera looks down with −z up the picture)
  vec2 uv = vec2((xz.x - uTracksCentre.x) / uTracksSize + 0.5, 0.5 - (xz.y - uTracksCentre.y) / uTracksSize);
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  return texture2D(uTracks, uv);
}
`;

// a vertex per side per point: aPoint the point's index, position.x the side
export const TRACK_VS = /* glsl */ `
uniform sampler2D uPoints;
uniform float uCount;
uniform float uWidth;
attribute float aPoint;
varying float vAlpha;
varying float vSide;
vec4 trackPoint(float i) { return texture2D(uPoints, vec2((clamp(i, 0.0, uCount - 1.0) + 0.5) / uCount, 0.5)); }
void main() {
  vec4 p = trackPoint(aPoint);
  vec4 a = trackPoint(aPoint - 1.0);
  vec4 b = trackPoint(aPoint + 1.0);
  vec2 d = b.xy - a.xy;
  d = length(d) > 1e-5 ? normalize(d) : vec2(1.0, 0.0);
  vec2 across = vec2(-d.y, d.x);
  vec2 xz = p.xy + across * position.x * uWidth * 0.5;
  // his fades: none for a point not touching, and off toward the old end
  vAlpha = p.z * p.w * (1.0 - smoothstep(0.6, 1.0, aPoint / (uCount - 1.0)));
  vSide = position.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(xz.x, 0.0, xz.y, 1.0);
}
`;

const TRACK_FS = /* glsl */ `
uniform vec4 uChannel;
varying float vAlpha;
varying float vSide;
void main() {
  // soft at the ribbon's edges
  float edge = 1.0 - smoothstep(0.6, 1.0, abs(vSide));
  gl_FragColor = uChannel * vAlpha * edge;
}
`;

export function trackLayout(points, width) {
  const n = points.length / 2;
  const out = new Float32Array(n * 6);
  const at = (i) => [points[Math.min(n - 1, Math.max(0, i)) * 2], points[Math.min(n - 1, Math.max(0, i)) * 2 + 1]];
  for (let i = 0; i < n; i++) {
    const [ax, az] = at(i - 1);
    const [bx, bz] = at(i + 1);
    let dx = bx - ax;
    let dz = bz - az;
    const l = Math.hypot(dx, dz);
    [dx, dz] = l > 1e-5 ? [dx / l, dz / l] : [1, 0];
    const [x, z] = at(i);
    for (const [k, s] of [[0, 1], [1, -1]]) {
      out[i * 6 + k * 3] = x - dz * s * width * 0.5;
      out[i * 6 + k * 3 + 1] = 0;
      out[i * 6 + k * 3 + 2] = z + dx * s * width * 0.5;
    }
  }
  return out;
}

const CHANNELS = { r: [1, 0, 0, 0], g: [0, 1, 0, 0], b: [0, 0, 1, 0], a: [0, 0, 0, 1] };
const EVERY = 1 / 30;
const APART = 0.2;

export function createTracks({ size = 40, texels = 512, count = 128 } = {}) {
  const target = new THREE.WebGLRenderTarget(texels, texels, { type: THREE.HalfFloatType, depthBuffer: false });
  target.texture.minFilter = target.texture.magFilter = THREE.LinearFilter;
  target.texture.generateMipmaps = false;
  const uniforms = {
    uTracks: { value: target.texture },
    uTracksCentre: { value: new THREE.Vector2() },
    uTracksSize: { value: size },
  };
  const scene = new THREE.Scene();
  const half = size / 2;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 100);
  camera.up.set(0, 0, -1);
  const tracks = [];
  const texel = size / texels;

  // a ribbon of `count` points: two vertices each, a quad between each pair
  const ribbon = () => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 2 * 3);
    const idx = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      pos[i * 6] = 1;
      pos[i * 6 + 3] = -1;
      idx[i * 2] = idx[i * 2 + 1] = i;
    }
    const index = [];
    for (let i = 0; i + 1 < count; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPoint', new THREE.BufferAttribute(idx, 1));
    g.setIndex(index);
    return g;
  };

  return {
    target,
    uniforms,
    glsl: TRACKS_GLSL,
    track(width, channel = 'r') {
      const data = new Float32Array(count * 4);
      const texture = new THREE.DataTexture(data, count, 1, THREE.RGBAFormat, THREE.FloatType);
      texture.minFilter = texture.magFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      const material = new THREE.ShaderMaterial({
        uniforms: { uPoints: { value: texture }, uCount: { value: count }, uWidth: { value: width }, uChannel: { value: new THREE.Vector4(...CHANNELS[channel]) } },
        vertexShader: TRACK_VS,
        fragmentShader: TRACK_FS,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      });
      const mesh = new THREE.Mesh(ribbon(), material);
      mesh.frustumCulled = false;
      scene.add(mesh);
      let last = null;
      const t = {
        mesh,
        texture,
        count: 0,
        // a contact point (world metres, scene frame), its time in seconds
        push(x, z, touching, now) {
          if (last && (now - last.t < EVERY || Math.hypot(x - last.x, z - last.z) < APART)) return false;
          last = { x, z, t: now };
          data.copyWithin(4, 0, (count - 1) * 4);
          data[0] = x;
          data[1] = z;
          data[2] = touching ? 1 : 0;
          data[3] = 1;
          t.count = Math.min(count, t.count + 1);
          texture.needsUpdate = true;
          return true;
        },
        // after a floating-origin shift: every point moved by −shift
        shift(sx, sz) {
          for (let i = 0; i < count; i++) {
            data[i * 4] -= sx;
            data[i * 4 + 1] -= sz;
          }
          if (last) {
            last.x -= sx;
            last.z -= sz;
          }
          texture.needsUpdate = true;
        },
      };
      tracks.push(t);
      return t;
    },
    // all the ribbons into the target, round the focus snapped to a texel
    // (so the picture never swims as it follows)
    render(renderer, focus) {
      const cx = Math.round(focus.x / texel) * texel;
      const cz = Math.round(focus.z / texel) * texel;
      uniforms.uTracksCentre.value.set(cx, cz);
      camera.position.set(cx, 50, cz);
      camera.lookAt(cx, 0, cz);
      camera.updateMatrixWorld();
      const before = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      const colour = renderer.getClearColor(new THREE.Color());
      const alpha = renderer.getClearAlpha();
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setClearColor(colour, alpha);
      renderer.setRenderTarget(before);
    },
    dispose() {
      for (const t of tracks) {
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        t.texture.dispose();
      }
      target.dispose();
    },
  };
}
