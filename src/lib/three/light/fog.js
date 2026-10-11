// The fog as a node: the record's curve over distance and its height fog
// (entry.js's `fog`), set as `scene.fogNode`. The curve and the height fog
// switch on and off by uniforms, so a weather without either is the same
// shader and a crossfade compiles nothing.
//
// Distance fog: with a record, its cubic, x t³ + y t² + z t + w over
// t = (d − Start) / (End − Start), clamped to 0…1 (Hoth's day rises to 0.58
// by the far end; its sunset to 0.81); with lane G's derived shape only,
// 1 − e^(−density · d). Height fog: full below HeightFogAltitude, gone
// HeightFogDepth above it, and through it 95% opaque at
// HeightFogVisibilityRange (1 − e^(−3d / range)). The two together: the
// thicker. d is the view depth, as three's own fog takes it.
//
// fogAt(fog, d, y) → 0…1    (pure: the same sum, for the tests and a CPU
//   reading such as a HUD's visibility)
// createFog(entry, { origin, gradient }) → Promise<{ node, uniforms, set(params) }>
//   gradient (lane Q6): the record's SkyGradientTexture { texture, rotation,
//   gain }, the fog's colour by the view's direction (grade.js's gradientUV,
//   mirrored here: the whole sphere as an equirect) times FogColor and the panorama's gain (sky.js's
//   uniform, shared: the gradient is the same painted sky, blurred);
//   without one the colour is FogColor as before
//
// The record's participating media and its forward light scattering (lane
// V, the fidelity design), for the `fog` post pass (`mode: 'volume'`):
//
// What the records hold, read from all 417 VisualEnvironment records in the
// bucket with a FogComponentData (176 of them): DepthFogParticipatingMedia
// and HeightFogParticipatingMedia (Scattering rgb, Albedo, Emissive,
// Absorption, `Exctinction` (sic), Phase, SpecificationMode) are zero in
// every record but one (Bespin S0600, and that one has
// ParticipatingMediaEnable false); ForwardLightScattering (Color, linear
// HDR; PhaseG; Strength; Presence; Extinction; UseSunPosition or
// RotationX/Y) is on in 105 (Hoth's interior at Presence 0.714, its day at
// 0; Felucia's day at 0.956 with a colour of 16.4, 9.9, 3.4). So the pass
// always draws the forward scattering, and marches the media only where a
// record turns them on.
//
// The forward scattering, as read here (the records give the numbers, not
// the formula; said in the PR): the light the fog throws toward the eye
// round the sun, Presence × Strength × Color × the Henyey-Greenstein lobe
// of PhaseG normalised to 1 toward the sun × (1 − e^(−Extinction × f(d))),
// f the distance fog's own amount at the pixel's depth (the cubic or the
// exponential above): a glow round the sun that thickens with the fog.
// The colour is taken as the game's display radiance (Hoth's 1.0 and
// Felucia's 16.4 differ by the scene's exposure, not by the sun's
// illuminance), so it is added as it is.
//
// The media (when enabled), marched along the view up to the pixel or
// MEDIA_REACH: per metre, extinction σt = Exctinction, or Absorption + the
// mean Scattering where Exctinction is 0 (SpecificationMode
// AbsorptionScattering); the height media scaled by the height fog's ramp;
// the in-scattered sun = Scattering × the sun's colour and intensity × the
// HG lobe of Phase (normalised over the sphere) + Emissive; the scene
// behind dimmed by the transmittance. Marched at FOG_SCALE of the
// resolution with FOG_STEPS, brought up over the depth (volumetrics.js's
// upsample).
//
// FOG_STEPS, FOG_SCALE, MEDIA_REACH
// hg(g, cosTheta) → the Henyey-Greenstein phase (pure)
// fogMedia(record) → { depth, height, forward, media, active }   (pure)
// fogVolume(colorNode, { depth, camera, p, tsl, THREE }) → { node, nodes }   (the pass, for passes.js)

import { readEntry, sunDir } from './entry.js';
import { loadThree } from './three.js';
import { upsample } from './volumetrics.js';

export const FOG_STEPS = { ultra: 32, high: 16 };
export const FOG_SCALE = 0.4; // the fog example's resolution scale
export const MEDIA_REACH = 400; // m: how far along the view the media are marched

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function fogAt(fog, d, y = 0) {
  let f;
  if (fog.curve) {
    const t = clamp01((d - fog.start) / Math.max(1e-3, fog.end - fog.start));
    const [a, b, c, w] = fog.curve;
    f = clamp01(((a * t + b) * t + c) * t + w);
  } else f = 1 - Math.exp(-fog.density * d);
  if (fog.height) {
    const h = clamp01((fog.height.altitude + fog.height.depth - y) / fog.height.depth);
    f = Math.max(f, h * (1 - Math.exp((-3 * d) / fog.height.visibility)));
  }
  return f;
}

const values = (fog) => ({
  color: fog.color.slice(),
  useCurve: fog.curve ? 1 : 0,
  curve: fog.curve ? fog.curve.slice() : [0, 0, 0, 0],
  start: fog.start,
  end: fog.end,
  density: fog.density,
  useHeight: fog.height ? 1 : 0,
  altitude: fog.height?.altitude ?? 0,
  depth: fog.height?.depth ?? 1,
  visibility: fog.height?.visibility ?? 1,
});

export async function createFog(entry, { origin, gradient = null } = {}) {
  const { THREE, tsl } = await loadThree();
  const { uniform, float, clamp, exp, max, mix, positionView, positionWorld, fog, cameraPosition, normalize, asin, atan, fract, vec2, texture } = tsl;
  const v = values(readEntry(entry, { origin }).fog);
  const u = {
    color: uniform(new THREE.Color(...v.color)),
    useCurve: uniform(v.useCurve),
    curve: uniform(new THREE.Vector4(...v.curve)),
    start: uniform(v.start),
    end: uniform(v.end),
    density: uniform(v.density),
    useHeight: uniform(v.useHeight),
    altitude: uniform(v.altitude),
    depth: uniform(v.depth),
    visibility: uniform(v.visibility),
  };
  const d = positionView.z.negate();
  const t = clamp(d.sub(u.start).div(max(u.end.sub(u.start), 1e-3)), 0, 1);
  const cubic = clamp(u.curve.x.mul(t).add(u.curve.y).mul(t).add(u.curve.z).mul(t).add(u.curve.w), 0, 1);
  const expo = float(1).sub(exp(u.density.mul(d).negate()));
  const distance = mix(expo, cubic, u.useCurve);
  const h = clamp(u.altitude.add(u.depth).sub(positionWorld.y).div(u.depth), 0, 1);
  const height = h.mul(float(1).sub(exp(d.mul(-3).div(u.visibility)))).mul(u.useHeight);
  let color = u.color;
  if (gradient?.texture) {
    const dir = normalize(positionWorld.sub(cameraPosition));
    const up = asin(clamp(dir.y, -1, 1)).div(Math.PI / 2);
    const uv = vec2(fract(float(gradient.rotation ?? 0).sub(atan(dir.x, dir.z).div(Math.PI * 2))), up.mul(-0.5).add(0.5));
    const gain = gradient.gain?.isNode ? gradient.gain : float(gradient.gain ?? 1);
    color = u.color.mul(texture(gradient.texture, uv).level(0).rgb).mul(gain);
  }
  const node = fog(color, max(distance, height));
  return {
    node,
    uniforms: u,
    set(p) {
      const w = values(p.fog);
      u.color.value.setRGB(...w.color);
      u.curve.value.set(...w.curve);
      for (const k of ['useCurve', 'start', 'end', 'density', 'useHeight', 'altitude', 'depth', 'visibility']) u[k].value = w[k];
    },
  };
}

// ── the media ──────────────────────────────────────────────────────────

export function hg(g, c) {
  const d = 1 + g * g - 2 * g * c;
  return (1 - g * g) / (4 * Math.PI * d * Math.sqrt(d));
}

// A field of the record in any of the three shapes it comes in: the
// bucket's (vectors as { x, y, z }), the map extras' (vectors as arrays) and
// lighting.json's `raw` (dotted keys: "DepthFogParticipatingMedia.Scattering.x").
function field(rec, path) {
  let v = rec;
  for (const k of path.split('.')) v = v?.[k];
  if (v !== undefined) return v;
  if (rec?.[`${path}.x`] !== undefined) return { x: rec[`${path}.x`], y: rec[`${path}.y`], z: rec[`${path}.z`] };
  return rec?.[path];
}
const vec = (v, d = [0, 0, 0]) => (Array.isArray(v) ? v.slice(0, 3).map(Number) : v && typeof v === 'object' ? [v.x, v.y, v.z].map(Number) : d.slice());
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);

function mediaOf(rec, key) {
  const scattering = vec(field(rec, `${key}.Scattering`));
  const absorption = num(field(rec, `${key}.Absorption`));
  const ext = num(field(rec, `${key}.Exctinction`));
  return {
    scattering,
    albedo: vec(field(rec, `${key}.Albedo`)),
    emissive: vec(field(rec, `${key}.Emissive`)),
    absorption,
    extinction: ext > 0 ? ext : absorption + (scattering[0] + scattering[1] + scattering[2]) / 3,
    phase: num(field(rec, `${key}.Phase`)),
  };
}

// record: a VE record (with FogComponentData), its fog component, or
// lighting.json's fog row (with `raw`)
export function fogMedia(record) {
  const rec = record?.FogComponentData?.[0] ?? record?.raw ?? record ?? {};
  const depth = mediaOf(rec, 'DepthFogParticipatingMedia');
  const height = mediaOf(rec, 'HeightFogParticipatingMedia');
  const any = (m) => m.extinction > 0 || m.emissive.some((c) => c > 0);
  const media = rec.ParticipatingMediaEnable !== false && (any(depth) || any(height));
  const presence = num(rec.ForwardLightScatteringPresence);
  const strength = num(rec.ForwardLightScatteringStrength);
  const forward = {
    enabled: rec.ForwardLightScatteringEnabled !== false && presence > 0 && strength > 0,
    color: vec(field(rec, 'ForwardLightScatteringColor'), [1, 1, 1]),
    g: num(rec.ForwardLightScatteringPhaseG, 0.8),
    strength,
    presence,
    extinction: num(rec.ForwardLightScatteringExtinction, 1),
    // (the direction of the glow: the sun's, unless the record says its own)
    dir: rec.ForwardLightScatteringUseSunPosition === false ? sunDir(num(rec.ForwardLightScatteringRotationX), num(rec.ForwardLightScatteringRotationY, 60)) : null,
  };
  return { depth, height, forward, media, active: media || forward.enabled };
}

// The pass: the scene's colour with the forward glow added and, where the
// record turns them on, the media marched through. `p` is post.js's `fog`
// pass: { media, fog, sun: { dir, color, intensity }, steps }.
export function fogVolume(colorNode, { depth, camera, p, tsl, THREE }) {
  const { Fn, uniform, vec3, vec4, float, clamp, exp, getViewPosition, screenUV, screenCoordinate, interleavedGradientNoise, Loop, rtt } = tsl;
  const projInv = uniform(camera.projectionMatrixInverse);
  const camWorld = uniform(camera.matrixWorld);
  const camPos = uniform(camera.position);
  const m = p.media;
  const f = p.fog ?? { start: 0, end: 1000, density: 0.001 };
  const sun = vec3(...(m.forward.dir ?? p.sun.dir)).normalize();
  const sunLight = vec3(...p.sun.color).mul(p.sun.intensity ?? 1);
  const toWorld = (uv) => {
    const view = getViewPosition(uv, depth.sample(uv).r, projInv);
    return camWorld.mul(vec4(view, 1)).xyz;
  };
  const hgNode = (g, c) => {
    const d = float(1 + g * g).sub(c.mul(2 * g));
    return float((1 - g * g) / (4 * Math.PI)).div(d.mul(d.sqrt()));
  };
  // the distance fog's amount at d, as the node does it (createFog)
  const amount = (d) => {
    if (f.curve) {
      const t = clamp(d.sub(f.start).div(Math.max(1e-3, f.end - f.start)), 0, 1);
      const [a, b, c, w] = f.curve;
      return clamp(t.mul(a).add(b).mul(t).add(c).mul(t).add(w), 0, 1);
    }
    return float(1).sub(exp(d.mul(-(f.density ?? 0.001))));
  };
  const nodes = [];
  let out = colorNode;
  if (m.media) {
    const steps = p.steps ?? FOG_STEPS.high;
    const h = f.height ?? { altitude: 0, depth: 1 };
    const march = Fn(() => {
      const end = toWorld(screenUV);
      const ray = end.sub(camPos);
      const dist = ray.length().min(MEDIA_REACH);
      const dir = ray.normalize();
      const ds = dist.div(steps);
      const phase = hgNode(m.depth.phase, dir.dot(sun)).toVar();
      const pos = camPos.add(dir.mul(ds.mul(interleavedGradientNoise(screenCoordinate.xy)))).toVar();
      const trans = float(1).toVar();
      const light = vec3(0).toVar();
      Loop(steps, () => {
        const ramp = clamp(float(h.altitude + h.depth).sub(pos.y).div(h.depth), 0, 1);
        const sigT = float(m.depth.extinction).add(ramp.mul(m.height.extinction));
        const sigS = vec3(...m.depth.scattering).add(vec3(...m.height.scattering).mul(ramp));
        const emit = vec3(...m.depth.emissive).add(vec3(...m.height.emissive).mul(ramp));
        const step = sigS.mul(sunLight).mul(phase).add(emit);
        light.addAssign(step.mul(trans).mul(ds));
        trans.mulAssign(exp(sigT.negate().mul(ds)));
        pos.addAssign(dir.mul(ds));
      });
      return vec4(light, trans);
    });
    const low = rtt(march(), null, null, { type: THREE.HalfFloatType, resolutionScale: FOG_SCALE });
    nodes.push(low);
    const up = upsample(tsl, low, depth, projInv, FOG_SCALE);
    out = vec4(out.rgb.mul(up.a).add(up.rgb), out.a);
  }
  if (m.forward.enabled) {
    const fw = m.forward;
    const glow = Fn(() => {
      const ray = toWorld(screenUV).sub(camPos);
      const lobe = hgNode(fw.g, ray.normalize().dot(sun)).div(hg(fw.g, 1));
      const thick = float(1).sub(exp(amount(ray.length()).mul(-fw.extinction)));
      return vec3(...fw.color).mul(fw.presence * fw.strength).mul(lobe).mul(thick);
    })();
    out = vec4(out.rgb.add(glow), out.a);
  }
  return { node: out, nodes };
}
