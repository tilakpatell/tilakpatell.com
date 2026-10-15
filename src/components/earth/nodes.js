// Earth's materials as node materials (TSL), so the world draws on the node
// renderer: WebGPU where the browser has it, WebGL 2 everywhere else
// (src/runtime/backend.js). Each is the GLSL it replaced in scene.js, line
// for line, and each factory hands back { material, u }: `u` holds its
// uniforms under the names scene.js has always written every frame
// (u.uSun.value, u.tDay.value…), so the frame code is the same.
//
//   globeMaterial({ blank, flat, sunDir })     the globe: GLOBE_FRAG (day, relief, grain, cloud shadows, glint, night lights, haze)
//   cloudMaterial({ blank, sunDir, uCloud })   the cloud shell: CLOUD_FRAG
//   airMaterial({ sunDir })                    the atmosphere: AIR_FRAG
//   beamMaterial(colour)                       a beacon's beam: BEAM_FRAG
//   trailMaterial()                            a contrail: the trail's inline GLSL
//   skyMaterial(sky)                           the stars, drawn as three's classic renderer drew the background
//   classicOutput(material) → whether it was given it now
//
// The output, as the classic renderer wrote it. With tone mapping on, the
// node renderer draws the frame into a linear buffer and tone maps and
// encodes it once at the end: every material is tone mapped whatever its
// toneMapped says, and the air added over the globe, the clouds over it and
// the beacons over both are tone mapped after they're added, not each one
// on its own. So Earth turns the renderer's output off (scene.js: no tone
// mapping, linear output, so nothing is converted at the end and the canvas
// keeps its multisampling) and every material does what the GLSL's
// #include <tonemapping_fragment> and <colorspace_fragment> did: ACES at
// Earth's exposure where the classic renderer tone mapped it, then sRGB,
// before it's blended. The globe, clouds and air are tone mapped, as their
// GLSL was; the beams and contrails, whose GLSL wasn't, aren't; the stars
// aren't, as three never tone maps an sRGB background; three's own
// materials (the sprites, lines, the plane) are given it by classicOutput
// as their toneMapped says. A GLSL smoothstep with its edges reversed is
// written as oneMinus(smoothstep(b, a, x)), which is the same curve and
// defined on every backend.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Discard, Fn, If, PI, acesFilmicToneMapping, asin, atan, attribute, cameraPosition, clamp, cos, cross, dot, equirectUV, exp, float, fract, length, max, min, mix, normalize, output, positionLocal, positionWorld, pow, sRGBTransferOETF, select, sin, smoothstep, sqrt, texture, uniform, uv, varying, vec2, vec3, vec4 } from 'three/tsl';
import { CLOUD_ALT } from './rules';

export const AIR = 1.085; // the top of the atmosphere
const CLOUDS_UP = CLOUD_ALT;

// smoothstep(a, b, x) with a > b, as GLSL computed it
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

// texture coordinates from the direction (longitude 0 at +z), not the mesh:
// no seam, no pinched poles
const uvOf = (n) => vec2(atan(n.x, n.z).div(2 * Math.PI).add(0.5), asin(clamp(n.y, -1, 1)).div(PI).add(0.5));

const hash = (p) => fract(sin(dot(p, vec3(127.1, 311.7, 74.7))).mul(43758.5453));
const noise = (p) => {
  const i = p.floor().toVar();
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(2).negate().add(3)).toVar();
  const h = (x, y, z) => hash(i.add(vec3(x, y, z)));
  return mix(mix(mix(h(0, 0, 0), h(1, 0, 0), f.x), mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y), mix(mix(h(0, 0, 1), h(1, 0, 1), f.x), mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y), f.z);
};

// the vertex's direction from the centre and its place in the world, as
// GLOBE_VERT passed them on
const direction = () => normalize(varying(normalize(positionLocal), 'vN'));
const world = () => varying(positionWorld, 'vW');

const EXPOSURE = 1.05; // the classic renderer's toneMappingExposure for Earth

// what a fragment wrote on the classic renderer: tone mapped (if it was),
// then encoded as sRGB, before blending
const classicOf = (toneMapped) => {
  const rgb = toneMapped ? acesFilmicToneMapping(output.rgb, float(EXPOSURE)) : output.rgb;
  return vec4(sRGBTransferOETF(rgb), output.a);
};

export function classicOutput(material) {
  if (material.outputNode) return false;
  material.outputNode = classicOf(material.toneMapped !== false);
  return true;
}

const made = (opts, colorNode) => {
  const material = new MeshBasicNodeMaterial(opts);
  material.colorNode = colorNode;
  classicOutput(material);
  return material;
};

export function globeMaterial({ blank, flat, sunDir }) {
  const u = {
    tDay: texture(blank),
    tNight: texture(blank),
    tClouds: texture(blank),
    tWater: texture(blank),
    tRelief: texture(flat),
    uSun: uniform(sunDir),
    uCloud: uniform(0), // the clouds' drift, a fraction of the way round
    uRelief: uniform(0.55),
    uHasNight: uniform(0),
  };
  const colour = Fn(() => {
    const N = direction().toVar();
    const vW = world();
    const at = uvOf(N).toVar();
    const east = normalize(cross(vec3(0, 1, 0), N).add(vec3(1e-6, 0, 0))).toVar();
    const north = cross(N, east).toVar();
    const water = u.tWater.sample(at).r.toVar();

    // the land's relief: its slopes tilt the light
    const slope = u.tRelief.sample(at).rg.mul(2).sub(1);
    const Nr = normalize(N.sub(u.uRelief.mul(water.oneMinus()).mul(east.mul(slope.x).add(north.mul(slope.y)))));
    const sunUp = dot(N, u.uSun).toVar();
    const lit = max(dot(Nr, u.uSun), 0);

    // close up, a little grain on the land, so it isn't smooth as paint
    const dist = length(cameraPosition.sub(vW)).toVar();
    const grain = noise(N.mul(900)).mul(0.6).add(noise(N.mul(2600)).mul(0.4)).sub(0.5).mul(water.oneMinus()).mul(fall(0.25, 0.03, dist));
    const day = u.tDay.sample(at).rgb.mul(grain.mul(0.22).add(1)).toVar();

    // the clouds' shadows: where the sun's ray from here passes through the cloud shell
    const toward = vec2(dot(u.uSun, east), dot(u.uSun, north)).mul(float(CLOUDS_UP).div(max(sunUp, 0.12)));
    const lat = asin(clamp(N.y, -1, 1));
    const shift = vec2(toward.x.div(max(cos(lat), 0.05).mul(2 * Math.PI)), toward.y.div(PI));
    const shade = u.tClouds.sample(at.add(shift).add(vec2(u.uCloud, 0))).r.toVar();

    const col = day.mul(lit.mul(1.35).add(0.012)).mul(shade.mul(0.5).oneMinus()).toVar();

    // the sun on the sea
    const V = normalize(cameraPosition.sub(vW));
    const H = normalize(u.uSun.add(V));
    const nh = max(dot(N, H), 0);
    const glint = pow(nh, 160).mul(2.4).add(pow(nh, 18).mul(0.12));
    col.addAssign(vec3(1, 0.9, 0.72).mul(glint).mul(water).mul(smoothstep(-0.02, 0.15, sunUp)).mul(shade.mul(0.8).oneMinus()));

    // the lights at night, warm, dimmed where cloud covers them
    const night = smoothstep(-0.2, 0.06, sunUp).oneMinus().toVar();
    const lights = u.tNight.sample(at).rgb;
    col.addAssign(lights.mul(lights).mul(vec3(1.6, 1.2, 0.75)).mul(2.2).mul(night).mul(u.uHasNight).mul(shade.mul(0.6).oneMinus()));
    // and a little moonlight, so the land still shows on the night side
    col.addAssign(day.mul(vec3(0.035, 0.05, 0.085)).mul(night));

    // the air between you and the ground: how much of it the view passes
    // through, lit by day, with a warm edge at dusk
    const ray = normalize(vW.sub(cameraPosition));
    const b = dot(cameraPosition, ray).toVar();
    const c = dot(cameraPosition, cameraPosition).sub(AIR * AIR);
    const enter = max(0, b.negate().sub(sqrt(max(b.mul(b).sub(c), 0))));
    const path = max(dist.sub(enter), 0);
    const haze = exp(path.mul(-1.5)).oneMinus();
    const dusk = smoothstep(-0.25, 0.1, sunUp).mul(smoothstep(0.1, 0.45, sunUp).oneMinus());
    const air = mix(vec3(0.3, 0.55, 1), vec3(1, 0.55, 0.3), dusk.mul(0.6));
    return vec4(mix(col, air.mul(0.8).mul(smoothstep(-0.22, 0.35, sunUp)), haze.mul(0.5)), 1);
  });
  return { material: made({}, colour()), u };
}

// the clouds, a little way up: white by day, dark at night, softer at the rim
export function cloudMaterial({ blank, sunDir, uCloud }) {
  const u = { tClouds: texture(blank), uSun: uniform(sunDir), uCloud };
  const colour = Fn(() => {
    const N = direction().toVar();
    const vW = world();
    const a = smoothstep(0.08, 0.85, u.tClouds.sample(uvOf(N).add(vec2(u.uCloud, 0))).r).toVar();
    const sunUp = dot(N, u.uSun).toVar();
    const V = normalize(cameraPosition.sub(vW));
    const light = smoothstep(-0.12, 0.25, sunUp).mul(max(sunUp, 0).mul(0.6).add(0.55)).add(0.008);
    const dusk = smoothstep(-0.15, 0.05, sunUp).mul(smoothstep(0.05, 0.35, sunUp).oneMinus());
    const col = mix(vec3(1), vec3(1, 0.68, 0.45), dusk.mul(0.7)).mul(light).toVar();
    const facing = dot(N, V).toVar();
    // from far off, their edges against space thin out
    a.mulAssign(mix(1, 0.75, pow(max(facing, 0).oneMinus(), 3)));
    // seen from underneath, in their own shade
    col.mulAssign(mix(1, 0.62, fall(0, -0.2, facing)));
    return vec4(col, a.mul(0.94));
  });
  return { material: made({ transparent: true, depthWrite: false, side: THREE.DoubleSide }, colour()), u };
}

// The atmosphere: for each view ray that misses the planet, how much air it
// passes through, as a sphere's inside drawn behind everything
export function airMaterial({ sunDir }) {
  const u = { uSun: uniform(sunDir) };
  // where a ray from o along d meets a sphere of radius r: (in, out), or (1e9, -1e9) if it doesn't
  const hit = (o, d, r) => {
    const b = dot(o, d).toVar();
    const h = b.mul(b).sub(dot(o, o).sub(r * r)).toVar();
    const s = sqrt(max(h, 0));
    return select(h.lessThan(0), vec2(1e9, -1e9), vec2(b.negate().sub(s), b.negate().add(s)));
  };
  const colour = Fn(() => {
    const o = cameraPosition;
    const d = normalize(world().sub(o)).toVar();
    const a = hit(o, d, AIR).toVar();
    const t0 = max(a.x, 0).toVar();
    const g = hit(o, d, 1).toVar();
    const t1 = select(g.x.greaterThan(0), min(a.y, g.x), a.y).toVar();
    const path = max(t1.sub(t0), 0).toVar();
    If(path.lessThanEqual(0), () => {
      Discard();
    });
    // the middle of the path: how high, and how sunlit
    const m = o.add(d.mul(t0.add(t1).mul(0.5))).toVar();
    const up = dot(normalize(m), u.uSun).toVar();
    const h = clamp(length(m).sub(1).div(AIR - 1), 0, 1);
    const thick = exp(path.mul(-7)).oneMinus().mul(h.mul(0.55).oneMinus()).toVar();
    const day = smoothstep(-0.28, 0.2, up).toVar();
    const dusk = smoothstep(-0.3, 0, up).mul(smoothstep(0, 0.3, up).oneMinus());
    const col = mix(vec3(0.2, 0.45, 1), vec3(1, 0.5, 0.25), dusk.mul(0.75)).mul(thick).mul(day.mul(0.95).add(dusk.mul(0.4))).toVar();
    // looking towards the sun through the air: a brighter glow round it
    const toSun = max(dot(d, u.uSun), 0);
    col.addAssign(vec3(1, 0.85, 0.6).mul(pow(toSun, 24)).mul(thick).mul(day).mul(0.9));
    // from orbit it's a rim, and a softer one than it is a sky from inside
    col.mulAssign(mix(1, 0.55, smoothstep(1.12, 2.2, length(o))));
    return vec4(col, 1);
  });
  return { material: made({ side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }, colour()), u };
}

// The stars (the universe map's Milky Way), as the inside of a sphere kept
// round the camera. Not scene.background: the classic renderer draws an
// sRGB background without tone mapping, the node renderer with it, and the
// sky came out a third as bright. Here it's drawn as it always was.
export function skyMaterial(sky) {
  const u = { tSky: texture(sky), uIntensity: uniform(0.32) };
  const material = made({ side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false, fog: false }, vec4(u.tSky.sample(equirectUV(normalize(positionLocal))).rgb.mul(u.uIntensity), 1));
  return { material, u };
}

// a beacon at a place: a beam straight up, brightest at its foot
export function beamMaterial(colour) {
  const u = { uColor: uniform(new THREE.Color(colour)), uOpacity: uniform(1) };
  const vH = varying(uv().y, 'vH');
  const a = vH.oneMinus().mul(vH.oneMinus()).mul(u.uOpacity);
  const material = made({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }, vec4(u.uColor.mul(a), a));
  return { material, u };
}

// a contrail, fading behind the engine (aFade: 1 at the engine, 0 at its end)
export function trailMaterial() {
  const u = { uLight: uniform(1) };
  const vF = varying(attribute('aFade', 'float'), 'vF');
  const material = made({ transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }, vec4(vec3(u.uLight), vF.mul(vF).mul(vF).mul(0.5)));
  return { material, u };
}
