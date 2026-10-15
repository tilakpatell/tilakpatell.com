// atmosphere.js on the node renderer: a planet’s air, the light scattered
// along the view through a sphere of it, drawn on the shell round the
// planet from inside (back faces) by a node material, with the same names,
// arguments and uniforms (uniform nodes under the GLSL’s names; the two
// suns’ arrays as { value: [...] } with a node an element, so frame code
// writing .value[i] still reaches the shader). atmosphereParams, stepsFor
// and skyColoursFor are atmosphere.js’s, copied: importing them would bring
// its ShaderMaterial into a ‘nodes’ world’s closure (FL4 removes the
// original, and these stay).
//
// What differs on the node renderer: ATMO, SHELL_VERT and SHELL_FRAG are
// gone. ATMO’s march is `inscatter`, a TSL Fn a surface twin composes;
// STEPS, a #define there, is a number baked into the graph when it is built
// (a Loop of a constant count), and FLAT a branch taken in JS.
//
// inscatter(u, { steps }) → Fn(ro, rd, tMax) → vec4: the light scattered
//   toward the eye in xyz, how much of what’s behind gets through in w (the
//   GLSL’s `out float trans`). Planet-centred, in radii. `u` holds uAtmo,
//   uAtmoP, uSunset (nodes) and uSunDir, uSunCol (two nodes each, as an
//   array or { nodes } beside their { value })
// atmosphereParams(air) → { uAtmo, uAtmoP, uSunset } from { colour, top,
//   falloff, density, glow, sunset }
// createAtmosphere({ radius, top, colour, density, falloff, sunset, glow,
//   suns, segments, steps, inner, flat, uniforms }) → { mesh, set({ suns, strength }),
//   params, update(center), dispose }: `uniforms`, a body’s own (uniform
//   nodes, or { value } holders, which the shell follows), shares its sun
//   and air with the shell; the rest as atmosphere.js’s
// stepsFor(level, base), skyColoursFor(air, sunElevation) → as atmosphere.js’s

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, Loop, cameraPosition, dot, exp, float, fwidth, length, max, min, mix, normalize, positionWorld, pow, select, smoothstep, sqrt, uniform, vec3, vec4 } from 'three/tsl';
import { follow } from './hookNodes';

// a pair of uniforms as the GLSL’s arrays: a node an element, reading the
// holder’s element each render (so a caller swapping one in is followed too)
const held = (list) => ({ value: list, nodes: list.map((v) => uniform(v)) });
const pairOf = (h) => (Array.isArray(h) ? h : (h.nodes ?? h.value.map((v, i) => uniform(v).onRenderUpdate(() => h.value[i]))));

// ── The march ──
// uAtmoP = (shell radius, falloff, density, forward glow); `steps` along the
// ray (7 unless told: the galaxy’s). Where the ray misses the air, nothing
// scattered and everything through: worked out and then chosen, as WGSL
// will not branch a return.
export function inscatter(u, { steps = 7 } = {}) {
  const [dir0, dir1] = pairOf(u.uSunDir);
  const [col0, col1] = pairOf(u.uSunCol);
  return Fn(([ro, rd, tMax]) => {
    const Ra = u.uAtmoP.x;
    const b = dot(ro, rd);
    const c = dot(ro, ro).sub(Ra.mul(Ra));
    const disc = b.mul(b).sub(c);
    const sq = sqrt(max(disc, 0));
    const t0 = max(0, b.negate().sub(sq));
    const t1 = min(tMax, b.negate().add(sq));
    const dt = t1.sub(t0).div(steps).toVar();
    const sum = vec3(0).toVar();
    const od = float(0).toVar();
    const glow0 = pow(max(dot(rd, dir0), 0), 12).mul(u.uAtmoP.w);
    const glow1 = pow(max(dot(rd, dir1), 0), 12).mul(u.uAtmoP.w);
    Loop(steps, ({ i }) => {
      const p = ro.add(rd.mul(t0.add(dt.mul(float(i).add(0.5)))));
      const l = length(p);
      const h = max(l.sub(1), 0).div(Ra.sub(1));
      const dens = exp(h.negate().mul(u.uAtmoP.y)).mul(smoothstep(0.85, 1, h).oneMinus());
      const n = p.div(l);
      const m0 = dot(n, dir0);
      const m1 = dot(n, dir1);
      const l0 = col0.mul(smoothstep(-0.14, 0.12, m0)).mul(mix(u.uSunset, vec3(1), smoothstep(-0.06, 0.25, m0))).mul(glow0.add(1));
      const l1 = col1.mul(smoothstep(-0.14, 0.12, m1)).mul(mix(u.uSunset, vec3(1), smoothstep(-0.06, 0.25, m1))).mul(glow1.add(1));
      sum.addAssign(l0.add(l1).mul(dens));
      od.addAssign(dens);
    });
    const k = dt.mul(u.uAtmoP.z);
    const trans = exp(od.negate().mul(k).mul(0.9));
    const hit = disc.greaterThan(0).and(t1.greaterThan(t0));
    return select(hit, vec4(sum.mul(k).mul(u.uAtmo), trans), vec4(0, 0, 0, 1));
  }, 'vec4');
}

// ── The atmosphere’s shell: drawn from inside (back faces), so it’s there
// whether you’re out in space (the glow round the limb) or down in it (the
// sky); the ground hides the part behind the planet ──
function shellColour(u, { steps, flat }) {
  const n = Object.fromEntries(['uR', 'uCenter', 'uAtmo', 'uAtmoP', 'uSunset', 'uInner', 'uStrength'].map((k) => [k, follow(u[k])]));
  const march = inscatter({ ...n, uSunDir: u.uSunDir, uSunCol: u.uSunCol }, { steps });
  return Fn(() => {
    const ro = cameraPosition.sub(n.uCenter).div(n.uR);
    const rd = normalize(positionWorld.sub(cameraPosition));
    const b = dot(ro, rd);
    const c = dot(ro, ro).sub(n.uInner.mul(n.uInner));
    const disc = b.mul(b).sub(c);
    const t = b.negate().sub(sqrt(max(disc, 0)));
    const tMax = select(disc.greaterThan(0).and(t.greaterThan(0)), t, 1e4);
    const col = march(ro, rd, tMax).xyz.toVar();
    if (flat) {
      // two flat bands of the air’s own colour: how much air and light the
      // view passes through, against the colour’s own brightness, stepped at
      // an eighth and a half (a band a cartoon would draw), each step a
      // pixel soft (so the limb doesn’t crawl as it turns)
      const W = vec3(0.2126, 0.7152, 0.0722);
      const luma = dot(n.uAtmo, W);
      const a = dot(col, W).div(max(luma, 1e-4));
      const e = max(fwidth(a), 1e-3);
      col.assign(n.uAtmo.mul(smoothstep(e.negate().add(0.12), e.add(0.12), a).mul(0.45).add(smoothstep(e.negate().add(0.5), e.add(0.5), a).mul(0.55))));
    }
    return col.mul(n.uStrength);
  }, 'vec3')();
}

const DEFAULTS = { top: 1.06, falloff: 3.5, density: 2, glow: 0.8, sunset: '#ffa070' };

export function atmosphereParams(air = {}) {
  const a = { ...DEFAULTS, ...air };
  return {
    uAtmo: new THREE.Color(a.colour ?? '#000000'),
    uAtmoP: new THREE.Vector4(a.top, a.falloff, a.density, a.glow),
    uSunset: new THREE.Color(a.sunset),
  };
}

const setColour = (c, v) => (Array.isArray(v) ? c.setRGB(v[0], v[1], v[2]) : c.set(v));

// How many steps an air is marched in at a detail level, against `base`
// (what high marches): fewer on a phone, twice at ultra.
const STEP_SCALE = { low: 0.5, mid: 0.625, high: 1, ultra: 2 };
export const stepsFor = (level, base = 8) => Math.max(3, Math.round(base * (STEP_SCALE[level] ?? 1)));

export function createAtmosphere({ radius, top = DEFAULTS.top, colour = '#000000', density = DEFAULTS.density, falloff = DEFAULTS.falloff, sunset = DEFAULTS.sunset, glow = DEFAULTS.glow, suns = [], segments = [64, 40], steps = 7, inner = 0.995, flat = false, uniforms = null } = {}) {
  const p = atmosphereParams({ colour, top, falloff, density, glow, sunset });
  const own = {
    uR: uniform(radius),
    uCenter: uniform(new THREE.Vector3()),
    uSunDir: held([new THREE.Vector3(1, 0.3, 0.4).normalize(), new THREE.Vector3(1, 0.3, 0.4).normalize()]),
    uSunCol: held([new THREE.Color(1.25, 1.2, 1.1), new THREE.Color(0, 0, 0)]),
    uAtmo: uniform(p.uAtmo),
    uAtmoP: uniform(p.uAtmoP),
    uSunset: uniform(p.uSunset),
  };
  const u = { ...own, ...(uniforms ?? {}), uInner: uniform(inner), uStrength: uniform(1) };
  const geo = new THREE.SphereGeometry(radius * top, segments[0], segments[1]);
  // (unlit, and neither fogged nor tone mapped here: the GLSL shell was neither)
  const mat = new MeshBasicNodeMaterial({ side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, toneMapped: false });
  mat.colorNode = shellColour(u, { steps, flat });
  mat.uniforms = u; // (the names ShaderMaterial’s had, for a caller that reads them)
  mat.userData.atmosphere = { steps, flat };
  const mesh = new THREE.Mesh(geo, mat);
  const set = ({ suns: list = null, strength = null } = {}) => {
    if (list) {
      for (let i = 0; i < 2; i++) {
        const s = list[i];
        if (s) {
          u.uSunDir.value[i].set(s.dir[0], s.dir[1], s.dir[2]);
          setColour(u.uSunCol.value[i], s.colour);
        } else u.uSunCol.value[i].setRGB(0, 0, 0);
      }
    }
    if (strength !== null) u.uStrength.value = strength;
  };
  if (suns.length) set({ suns });
  return {
    mesh,
    params: p,
    set,
    // where the planet’s middle is, in the world (each frame: it moves with its map)
    update(center) {
      u.uCenter.value.copy(center);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

// ── The sky from the ground, as plain numbers ──
// The same air, marched from a camera standing on the ground: straight up,
// and along the horizon (toward the sun and away, averaged). From down here
// the light on its way in matters: it’s thinned by the air it comes through,
// each colour by how much the air scatters it (the air’s own colour), so a
// blue air’s low sun and its horizon go warm, as the shell from space paints
// with its sunset colour. Not in absolute units: what a landing reads is how
// the colours move from noon (landings/sky.js).
const SCATTER = 20; // the air’s scattering per unit of density and colour, per radius
const linearOf = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
// where a ray from `o` along `d` leaves a sphere of radius `r` about the origin (or -1)
const exitAt = (o, d, r) => {
  const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
  const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - r * r;
  const disc = b * b - c;
  return disc < 0 ? -1 : -b + Math.sqrt(disc);
};
const hitsGround = (o, d) => {
  const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
  const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - 1;
  return b < 0 && b * b - c > 0;
};

export function skyColoursFor(air = {}, sunElevation = 1, { steps = 16 } = {}) {
  const a = { ...DEFAULTS, ...air };
  const beta = linearOf(a.colour ?? '#8fc1ff').map((c) => c * a.density * SCATTER);
  const top = a.top;
  const e = Math.max(-1, Math.min(1, sunElevation));
  const sun = [Math.sqrt(1 - e * e), e, 0];
  const cam = [0, 1.0005, 0];
  const dens = (p) => {
    const h = Math.max(0, Math.hypot(p[0], p[1], p[2]) - 1) / (top - 1);
    const fade = h < 0.85 ? 1 : h >= 1 ? 0 : 1 - ((h - 0.85) / 0.15) ** 2 * (3 - (2 * (h - 0.85)) / 0.15);
    return Math.exp(-h * a.falloff) * fade;
  };
  // how much air the light crosses from `p` to the sun (Infinity: the ground’s in the way)
  const toSun = (p) => {
    if (hitsGround(p, sun)) return Infinity;
    const t1 = exitAt(p, sun, top);
    const n = 6;
    const dt = t1 / n;
    let od = 0;
    for (let i = 0; i < n; i++) {
      const t = dt * (i + 0.5);
      od += dens([p[0] + sun[0] * t, p[1] + sun[1] * t, p[2] + sun[2] * t]) * dt;
    }
    return od;
  };
  const look = (d) => {
    const t1 = exitAt(cam, d, top);
    const dt = t1 / steps;
    const out = [0, 0, 0];
    const view = [0, 0, 0];
    const glow = 1 + a.glow * Math.max(0, d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2]) ** 12;
    for (let i = 0; i < steps; i++) {
      const t = dt * (i + 0.5);
      const p = [cam[0] + d[0] * t, cam[1] + d[1] * t, cam[2] + d[2] * t];
      const rho = dens(p) * dt;
      const od = toSun(p);
      for (let k = 0; k < 3; k++) {
        view[k] += beta[k] * rho * 0.5;
        out[k] += od === Infinity ? 0 : beta[k] * rho * Math.exp(-beta[k] * od - view[k]) * glow;
        view[k] += beta[k] * rho * 0.5;
      }
    }
    return out;
  };
  const h = 0.03; // (the horizon a little above it: the ray along it never leaves the air)
  const toward = look([Math.sqrt(1 - h * h), h, 0]);
  const away = look([-Math.sqrt(1 - h * h), h, 0]);
  const od = toSun(cam);
  return {
    zenith: look([0, 1, 0]),
    horizon: toward.map((v, k) => (v + away[k]) / 2),
    sun: beta.map((b) => (od === Infinity ? 0 : Math.exp(-b * od))),
  };
}
