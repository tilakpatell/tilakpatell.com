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
// the entry's cover. The sun is the game's (the owner's bf2-re study,
// findings 02: the sky program's disc): a Henyey–Greenstein lobe about the
// sun's direction with g = 1 − SunSize, (1 − g²)² / (4π (1 + g² − 2 g c)^1.5)
// clamped to 1, in SunColor × SunScale (the record's 120,000 nits on Hoth,
// at the site's exposure: entry.js's sunScale), added to the dome, the
// painted or the modelled, with no air between (`sunLobe`, pure).
//
// The record's painted panorama (lane Q6, `panorama`: grade.js's
// pictureOf(...).panorama with its loaded `texture`): drawn behind the sun's
// disc, over the scattering above the horizon, faded in over
// PANORAMA_FADE so the ground's colour below the horizon stays the model's.
// The painting is scaled by the record's LuminanceScale at the site's
// exposure (`gain`: panoramaGain, pure, the same calibrated luminance as the
// model's, through calibrate.js), as the game's sky shader scales it; the
// gain follows a weather's crossfade. The bucket's UASTC copy is 0…1 (its
// sun and bright cloud clipped at white); lane W's HDR copy keeps them
// (apply.js picks it by tier). The mapping is grade.js's panoramaUV,
// mirrored in the shader. The sun's lobe is added over either.
//
// createSky(entry, { radius, panorama }) → Promise<{ mesh, uniforms, set(params), setHorizon(h), setPanorama({ texture, rotation, horizon }), update(camera), envTexture(renderer), dispose }>
// skyUniforms(params) → the uniforms' plain values   (pure)
// skyRadiance(dir, values, { disc }) → [r, g, b]   (pure: the shader's sky, for the gain and the tests)
// sunLobe(c, sunSize) → the sun's share at the cosine c to its direction, 0…1   (pure: the game's HG disc)
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

// The game's sun (findings 02): a Henyey–Greenstein lobe with g = 1 − SunSize,
// (1 − g²)² over 4π (1 + g² − 2 g c)^1.5, clamped to 1, so the disc is flat
// at SunScale out to where the lobe falls under 1 (Hoth's SunSize 0.004:
// about 1°) and a halo past it (12 % at 2°, under 1 % at 5°). The study's
// listing writes the denominator's product as g·c; read as the HG phase's
// 2 g c, since with g·c the lobe never reaches 1 and the game draws a disc.
export function sunLobe(c, sunSize) {
  const g = 1 - sunSize;
  const d = Math.max(0, 1 + g * g - 2 * g * c);
  return Math.min(1, (1 - g * g) ** 2 / (4 * Math.PI * d ** 1.5));
}

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
  const disc = withDisc ? sunLobe(c, v.sunSize) * v.sunScale : 0;
  const lit = [0, 1, 2].map((i) => ((bR[i] * phaseR + bM * phaseM) / (bR[i] + bM)) * depth[i] * sunT[i] * v.sunColor[i] * v.luminance * ZENITH_SHARE + v.sunColor[i] * disc);
  const cw = v.cover * smoothstep(0, 0.4, d[1]);
  const clouds = lit.map((x, i) => x + (v.cloud[i] * v.luminance * ZENITH_SHARE * (sunT[1] * 0.5 + 0.3) - x) * cw);
  const below = smoothstep(0.02, -0.08, d[1]);
  return clouds.map((x, i) => x + (v.ground[i] * v.luminance * ZENITH_SHARE * 0.25 - x) * below);
}

// The game's sky shader (the owner's bf2-re study, findings 02: the
// panoramic sky program) draws the painting as the sky and multiplies it by
// one number, the record's LuminanceScale, pre-exposed like every light; it
// fits nothing to an analytic model. So the gain is the calibrated luminance
// (readEntry's `sky.luminance`, LuminanceScale at the site's exposure). The
// painting's horizon row is still taken (`horizon`: a sky with none has no
// painting, gain 1); `meetGain` keeps the old fit, the panorama's foot scaled
// to the model's sky where they meet, for the worlds whose LDR copies lost
// their level and need a fit until lane W's HDR skies are read.
export function panoramaGain(p, horizon) {
  if (!horizon) return 1;
  return p.sky.luminance;
}

export function meetGain(p, horizon) {
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
  // (the panorama's horizon row the gain is measured against: a weather's
  // crossfade eases it toward the next panorama's, setPanorama swaps both)
  let horizon = panorama?.horizon ?? null;
  let paintNode = null;
  let paintRotation = null;
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
    paintRotation = rotation;
    // (the base node, made now: each sample is a clone that reads its value,
    // so setPanorama's texture reaches the shader however it was built)
    paintNode = texture(panorama.texture);
    painted = (dir) => {
      const az = atan(dir.x, dir.z).div(Math.PI * 2);
      const up = asin(clamp(dir.y, 0, 1)).div(Math.PI / 2);
      const uv = vec2(fract(rotation.sub(az)).mul(maxX - minX).add(minX), up.oneMinus().mul(maxY - minY).add(minY));
      return paintNode.sample(uv).level(0).rgb.mul(u.panoramaGain);
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
    // the game's sun: the HG lobe (sunLobe above, kept alike), flat at SunScale, no air between
    const gs = float(1).sub(u.sunSize);
    const gg = gs.mul(gs);
    const lobe = gg.oneMinus().mul(gg.oneMinus()).div(pow(max(gg.add(1).sub(gs.mul(c).mul(2)), 0), 1.5).mul(4 * Math.PI)).min(1);
    const sunDisc = u.sunColor.mul(lobe.mul(u.sunScale));
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
    if (horizon) u.panoramaGain.value = panoramaGain(p, horizon);
  };
  return {
    mesh,
    material,
    uniforms: u,
    set,
    // the horizon row the gain is measured against, for a crossfade to ease
    // (takes hold at the next set)
    setHorizon(h) {
      if (paintNode && h) horizon = h;
    },
    // the next weather's painted sky in place of this one's, no new shader:
    // false where the sky was built without a panorama (the branch is not in it)
    setPanorama(next) {
      if (!paintNode || !next?.texture) return false;
      paintNode.value = next.texture;
      if (next.rotation !== undefined) paintRotation.value = next.rotation;
      if (next.horizon) horizon = next.horizon;
      return true;
    },
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
