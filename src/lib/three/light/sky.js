// The sky as a node material: the record's Rayleigh and Mie scattering
// (entry.js's `sky`) lit by the sun, drawn on a sphere round the camera,
// and rendered once into a cube for the environment where a level has no
// outdoor probe. Every number is a uniform, so a weather crossfade moves
// them without a recompile.
//
// The model is single scattering through a flat atmosphere: the in-scatter
// along the view, (βR·phaseR + βM·phaseM)/(βR + βM) · (1 − e^−(βR·sR + βM·sM)),
// over the optical air mass of the view's zenith angle (Kasten and Young),
// lit by the sun through its own air mass, so a low sun reddens what it
// lights. Normalised to the green channel at the zenith and scaled by
// ZENITH_SHARE of the record's LuminanceScale (in the site's units), so the record's numbers
// set the sky's brightness and its colour comes from the coefficients;
// the horizon's long path is compressed by a square root (single
// scattering alone puts it at twelve times the zenith; a real sky's
// extinction and second bounce keep it near three). Below the horizon,
// the ground colour; the record's first cloud layer tints the upper sky by
// the entry's cover. The disc is the record's SunScale (its luminance),
// dimmed by the air between.
//
// The record's painted panorama (lane Q6, `panorama`: grade.js's
// pictureOf(...).panorama with its loaded `texture`): drawn behind the sun's
// disc, over the scattering above the horizon, faded in over
// PANORAMA_FADE so the ground's colour below the horizon stays the model's.
// The painted sky is 0…1 (the bucket's KTX2 is clamped), so it is scaled to
// the model where the two meet: `gain` makes the panorama's horizon row
// (its linear mean, measured on the texture: `horizon`) as bright as the
// model's sky at PANORAMA_MEET, averaged round the horizon (panoramaGain,
// pure, from the same calibrated luminance as the model: the record's
// LuminanceScale through calibrate.js), so the blend shows no band; the
// gain follows a weather's crossfade. The mapping is grade.js's
// panoramaUV, mirrored in the shader. The model's disc stays on top (the
// painted sun is clipped at 1).
//
// createSky(entry, { radius, panorama }) → Promise<{ mesh, uniforms, set(params), update(camera), envTexture(renderer), dispose }>
// skyUniforms(params) → the uniforms' plain values   (pure)
// skyRadiance(dir, values, { disc }) → [r, g, b]   (pure: the shader's sky, for the gain and the tests)
// panoramaGain(params, horizon) → the panorama's scale to the model's horizon   (pure)

import { readEntry } from './entry.js';
import { loadThree } from './three.js';

const ENV_SIZE = 64; // px: a face of the environment's cube
// The zenith's share of the record's LuminanceScale: Frostbite scales a sky
// model whose values sit under one, and a clear zenith with the sun at 33°
// is near 8,000 nits of Hoth's 35,000 (snow under the same sun is 17,600),
// so the sky reads darker than the snow it lights, as it does in the game.
export const ZENITH_SHARE = 0.23;
// the view's height (sin of its elevation) over which the panorama fades in
// over the model: from the horizon to 2.9° up
export const PANORAMA_FADE = [0, 0.05];
// where the two are matched: the fade's middle (1.4°)
export const PANORAMA_MEET = 0.025;
const MEET_TAPS = 32; // azimuths averaged round the horizon

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const airMassAt = (c) => {
  const z = Math.acos(Math.min(1, Math.max(0, c)));
  return 1 / (Math.cos(z) + 0.15 * Math.max(93.885 - (z * 180) / Math.PI, 0.01) ** -1.253);
};
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// The shader's skyColor below, on the CPU (keep the two alike)
export function skyRadiance(dir, v, { disc: withDisc = true } = {}) {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const d = dir.map((x) => x / l);
  const sl = Math.hypot(...v.sunDir) || 1;
  const sd = v.sunDir.map((x) => x / sl);
  const bR = v.betaR;
  const bM = v.betaM;
  const m = airMassAt(d[1]);
  const ext = bR.map((b) => b * v.heightR + bM * v.heightM);
  const fex = ext.map((e) => Math.exp(-e * m));
  const zen = 1 - Math.exp(-(bR[1] * v.heightR + bM * v.heightM));
  const depth = fex.map((f) => Math.sqrt(Math.max(0, (1 - f) / zen)));
  const c = d[0] * sd[0] + d[1] * sd[1] + d[2] * sd[2];
  const phaseR = 0.75 * (1 + c * c);
  const g = v.mieG;
  const phaseM = (1 - g * g) / (1 + g * g - 2 * g * c) ** 1.5;
  const ms = airMassAt(Math.max(sd[1], 0.02));
  const sunT = ext.map((e) => Math.exp(-e * ms) / Math.exp(-e));
  const disc = withDisc ? smoothstep(Math.cos(v.sunSize * 1.5), Math.cos(v.sunSize), c) * v.sunScale : 0;
  const lit = [0, 1, 2].map((i) => ((bR[i] * phaseR + bM * phaseM) / (bR[i] + bM)) * depth[i] * sunT[i] * v.sunColor[i] * v.luminance * ZENITH_SHARE + fex[i] * v.sunColor[i] * disc);
  const cw = v.cover * smoothstep(0, 0.4, d[1]);
  const clouds = lit.map((x, i) => x + (v.cloud[i] * v.luminance * ZENITH_SHARE * (sunT[1] * 0.5 + 0.3) - x) * cw);
  const below = smoothstep(0.02, -0.08, d[1]);
  return clouds.map((x, i) => x + (v.ground[i] * v.luminance * ZENITH_SHARE * 0.25 - x) * below);
}

export function panoramaGain(p, horizon) {
  if (!horizon) return 1;
  const v = skyUniforms(p);
  const y = PANORAMA_MEET;
  const r = Math.sqrt(1 - y * y);
  let s = 0;
  for (let i = 0; i < MEET_TAPS; i++) {
    const a = (i / MEET_TAPS) * Math.PI * 2;
    s += lum(skyRadiance([r * Math.sin(a), y, r * Math.cos(a)], v, { disc: false }));
  }
  return s / MEET_TAPS / Math.max(1e-6, lum(horizon));
}

export function skyUniforms(p) {
  return {
    sunDir: p.sun.dir.slice(),
    sunColor: p.sun.color.slice(),
    betaR: p.sky.rayleigh.slice(),
    betaM: p.sky.mie,
    mieG: p.sky.mieG,
    heightR: p.sky.heightR,
    heightM: p.sky.heightM,
    luminance: p.sky.luminance,
    sunSize: p.sky.sunSize,
    sunScale: p.sky.sunScale,
    cloud: p.sky.cloud.slice(),
    cover: p.sky.cover,
    ground: p.sky.ground.slice(),
  };
}

export async function createSky(entry, { radius = 1000, panorama = null } = {}) {
  const { THREE, tsl } = await loadThree();
  const { Fn, uniform, vec2, vec3, float, positionLocal, normalize, dot, exp, pow, acos, asin, atan, clamp, smoothstep, mix, max, cos, fract, texture } = tsl;
  const p0 = readEntry(entry);
  const v = skyUniforms(p0);
  const u = {
    sunDir: uniform(new THREE.Vector3(...v.sunDir)),
    sunColor: uniform(new THREE.Color(...v.sunColor)),
    betaR: uniform(new THREE.Vector3(...v.betaR)),
    betaM: uniform(v.betaM),
    mieG: uniform(v.mieG),
    heightR: uniform(v.heightR),
    heightM: uniform(v.heightM),
    luminance: uniform(v.luminance),
    sunSize: uniform(v.sunSize),
    sunScale: uniform(v.sunScale),
    cloud: uniform(new THREE.Color(...v.cloud)),
    cover: uniform(v.cover),
    ground: uniform(new THREE.Color(...v.ground)),
    panoramaGain: uniform(panorama?.texture ? panoramaGain(p0, panorama.horizon) : 1),
  };
  // the optical air mass toward a direction's zenith cosine (Kasten–Young)
  const airMass = (c) => {
    const z = acos(clamp(c, 0, 1));
    return float(1).div(cos(z).add(float(0.15).mul(pow(float(93.885).sub(z.mul(180 / Math.PI)).max(0.01), -1.253))));
  };
  // the painted sky at a direction (grade.js's panoramaUV), at its first
  // level: the azimuth's wrap would pick the smallest mip along the seam
  let painted = null;
  if (panorama?.texture) {
    const [minX, minY, maxX, maxY] = panorama.uv ?? [0, 0, 1, 1];
    const rotation = uniform(panorama.rotation ?? 0);
    painted = (dir) => {
      const az = atan(dir.x, dir.z).div(Math.PI * 2);
      const up = asin(clamp(dir.y, 0, 1)).div(Math.PI / 2);
      const uv = vec2(fract(rotation.sub(az)).mul(maxX - minX).add(minX), up.oneMinus().mul(maxY - minY).add(minY));
      return texture(panorama.texture, uv).level(0).rgb.mul(u.panoramaGain);
    };
  }
  const skyColor = Fn(([dir]) => {
    const betaR = u.betaR;
    const betaM = vec3(u.betaM);
    const m = airMass(dir.y);
    const fex = exp(betaR.mul(u.heightR).add(betaM.mul(u.heightM)).mul(m).negate());
    const zen = float(1).sub(exp(betaR.y.mul(u.heightR).add(u.betaM.mul(u.heightM)).negate()));
    const depth = pow(vec3(1).sub(fex).div(zen), 0.5);
    const c = dot(dir, u.sunDir);
    const phaseR = c.mul(c).add(1).mul(0.75);
    const g = u.mieG;
    const phaseM = g.mul(g).oneMinus().div(pow(g.mul(c).mul(-2).add(g.mul(g)).add(1), 1.5));
    const scatter = betaR.mul(phaseR).add(betaM.mul(phaseM)).div(betaR.add(betaM));
    // the sunlight through its own air mass, against a sun at the zenith
    const ms = airMass(max(u.sunDir.y, 0.02));
    const ext = betaR.mul(u.heightR).add(betaM.mul(u.heightM));
    const sunT = exp(ext.mul(ms).negate()).div(exp(ext.negate()));
    const sky = scatter.mul(depth).mul(sunT).mul(u.sunColor).mul(u.luminance).mul(ZENITH_SHARE);
    const disc = smoothstep(cos(u.sunSize.mul(1.5)), cos(u.sunSize), c).mul(u.sunScale);
    const sunDisc = fex.mul(u.sunColor).mul(disc);
    const lit = sky.add(sunDisc);
    let clouds = mix(lit, u.cloud.mul(u.luminance).mul(ZENITH_SHARE).mul(sunT.y.mul(0.5).add(0.3)), u.cover.mul(smoothstep(0, 0.4, dir.y)));
    if (painted) clouds = mix(clouds, painted(dir).add(sunDisc), smoothstep(PANORAMA_FADE[0], PANORAMA_FADE[1], dir.y));
    const below = smoothstep(0.02, -0.08, dir.y);
    return mix(clouds, u.ground.mul(u.luminance).mul(ZENITH_SHARE).mul(0.25), below);
  });
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  material.colorNode = skyColor(normalize(positionLocal));
  const geometry = new THREE.SphereGeometry(1, 48, 24);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sky';
  mesh.scale.setScalar(radius);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;

  let cube = null;
  const set = (p) => {
    const w = skyUniforms(p);
    u.sunDir.value.set(...w.sunDir).normalize();
    u.sunColor.value.setRGB(...w.sunColor);
    u.betaR.value.set(...w.betaR);
    for (const k of ['betaM', 'mieG', 'heightR', 'heightM', 'luminance', 'sunSize', 'sunScale', 'cover']) u[k].value = w[k];
    u.cloud.value.setRGB(...w.cloud);
    u.ground.value.setRGB(...w.ground);
    if (panorama?.texture) u.panoramaGain.value = panoramaGain(p, panorama.horizon);
  };
  return {
    mesh,
    material,
    uniforms: u,
    set,
    // the sphere stays round the camera, inside its far plane
    update(camera) {
      if (!camera) return;
      mesh.position.copy(camera.position);
      mesh.scale.setScalar(Math.min(radius, camera.far * 0.9));
    },
    // the sky drawn into a cube for scene.environment (PMREMNode filters
    // it); the same texture again after a weather change, re-filtered
    envTexture(renderer) {
      if (!cube) {
        const target = new THREE.CubeRenderTarget(ENV_SIZE, { type: THREE.HalfFloatType });
        const camera = new THREE.CubeCamera(0.1, 10, target);
        const scene = new THREE.Scene();
        const copy = new THREE.Mesh(geometry, material);
        copy.scale.setScalar(5);
        scene.add(copy, camera);
        cube = { target, camera, scene };
      }
      cube.camera.update(renderer, cube.scene);
      cube.target.texture.needsPMREMUpdate = true;
      return cube.target.texture;
    },
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
      cube?.target.dispose();
    },
  };
}
