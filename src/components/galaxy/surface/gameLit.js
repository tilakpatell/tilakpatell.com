// A world under the game's light, as the surface runs it (the numbers are
// lib/three/gameLight.js's; the site arrives already under them, gameSite):
// the level's probe as what shiny things reflect, outdoors and in a room,
// its grading LUT in the post's last pass, and its weathers, faded into one
// another over 20 s as the site fades its own.
//
//   createGameLit({ light, state, scene, sun, hemi, sky, house, post, … })
//     → null for a world without a record; else { zone(z), weather(state,
//       { fade }), step(dt), outdoorProbe({ id, url }), debug(), dispose() }
//
// One probe alive at a time (probeEnv.js): going in loads the room's and
// lets the outdoor one go, coming out the other way round. The scene's dome
// stays its environment until the first probe arrives, and is what a
// failed load leaves.

import * as THREE from 'three';
import { siteLightFrom, weatherEntry } from '../../../lib/three/gameLight';
import { createProbeEnv } from '../../../lib/three/probeEnv';
import { loadLut } from '../../../lib/three/gameLut';
import { assetUrl } from '../../../lib/assetBase';
import { dirOf } from './sky';

const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
export const FADE_S = 20;

// what the scene has lit, the way the fade reads and writes it
function snapshot({ sun, hemi, scene, sky }) {
  const u = sky.uniforms;
  return {
    sun: sun.intensity,
    sunColor: sun.color.clone(),
    sky: hemi.color.clone(),
    ground: hemi.groundColor.clone(),
    ambient: hemi.intensity,
    fog: scene.fog.color.clone(),
    density: scene.fog.density,
    zenith: u.uZenith.value.clone(),
    horizon: u.uHorizon.value.clone(),
    haze: u.uHaze.value.clone(),
    disc: u.uSunColor.value[0].clone(),
  };
}

// a derived light as the same shape, the scene's own where it says nothing
function targetOf(d, was) {
  const c = (hex, fallback) => (hex ? new THREE.Color(hex) : fallback.clone());
  return {
    sun: d.light.sun ?? was.sun,
    sunColor: c(d.sky.suns[0]?.color, was.sunColor),
    sky: c(d.light.sky, was.sky),
    ground: c(d.light.ground, was.ground),
    ambient: d.light.ambient ?? was.ambient,
    fog: c(d.fog.color, was.fog),
    density: Math.max(was.floor ?? 0, d.fog.density ?? was.density),
    zenith: c(d.sky.zenith, was.zenith),
    horizon: c(d.sky.horizon, was.horizon),
    haze: c(d.sky.hazeColor, was.haze),
    disc: c(d.sky.suns[0]?.color, was.disc),
  };
}

export function createGameLit({
  light,
  state = 'clear',
  scene,
  sun,
  hemi,
  sky,
  house = null,
  post = null,
  renderer = null,
  grade = true,
  envShare = { out: 0.4, in: 0.15 },
  fogFloor = 0,
  reframe = () => {},
  probes = null,
  lutLoad = loadLut,
  url = assetUrl,
} = {}) {
  if (!light?.weathers) return null;
  const holder = probes ?? createProbeEnv({ renderer });
  const luts = new Map();
  let disposed = false;
  let inZone = false;
  let probeOn = false; // (the scene's environment is a probe, not the dome)
  let entry = weatherEntry(light, state);
  let d = siteLightFrom(entry);
  let fade = null;
  // the outdoor light as it stands (the scene's lighting(z) zeroes the sun
  // in a room and puts it back from here)
  let outdoor = { ...targetOf(d, { ...snapshot({ sun, hemi, scene, sky }), floor: fogFloor }) };

  const faces = (base) => FACES.map((f) => url(`/${base}.${f}.hdr`));
  // the probe's radiance at the site's (the sky's level, siteLightFrom), at
  // the share of the scene the site gives its environment
  const envIntensity = (share) => share * (d.probeScale ?? 0);

  // (each show and regrade asks again; one that lands after a newer ask is late)
  let shown = 0;
  let graded = 0;
  let override = null; // (the level pack's probe, { id, url })

  async function show() {
    // (out of doors, the level's own reflection volume where you stand, once
    // the pack says which: levelProbes.js; the weather's calibration stays)
    const probe = inZone ? light.indoor : entry?.probe && override ? { ...entry.probe, ...override } : entry?.probe;
    if (!probe?.url) return;
    const share = inZone ? envShare.in : envShare.out;
    const mine = ++shown;
    try {
      const env = await holder.load(faces(probe.url));
      if (!env || disposed || mine !== shown) return;
      scene.environment = env;
      scene.environmentIntensity = envIntensity(share);
      probeOn = true;
    } catch {
      // (the dome's environment stays: a missing probe is a duller shine, not a fault)
    }
  }

  async function regrade() {
    if (!grade || !post?.grading) return;
    const g = inZone ? (light.weathers.interior ?? entry)?.grading : entry?.grading;
    const mine = ++graded;
    if (!g?.lut || !g.lutSize) {
      post.grading(null);
      return;
    }
    if (!luts.has(g.lut)) luts.set(g.lut, lutLoad(url(`/${g.lut}`), g.lutSize).catch(() => null));
    const tex = await luts.get(g.lut);
    if (disposed || mine !== graded) return;
    post.grading(tex ? { lut: tex, size: g.lutSize } : null);
  }

  function put(v) {
    const u = sky.uniforms;
    if (!inZone) {
      sun.intensity = v.sun;
      hemi.color.copy(v.sky);
      hemi.groundColor.copy(v.ground);
      hemi.intensity = v.ambient;
      scene.fog.color.copy(v.fog);
      scene.fog.density = v.density;
    }
    sun.color.copy(v.sunColor);
    u.uZenith.value.copy(v.zenith);
    u.uHorizon.value.copy(v.horizon);
    u.uHaze.value.copy(v.haze);
    u.uSunColor.value[0].copy(v.disc);
    house?.sky({ low: u.uHorizon.value, high: u.uZenith.value });
  }

  // the sun's way, from the derived sky (and the shadow camera's frame with it)
  function aim() {
    const s = d.sky.suns[0];
    if (!s) return;
    sky.uniforms.uSunDir.value[0].copy(dirOf(s.az, s.el));
    reframe();
  }

  show();
  regrade();

  return {
    // into a room (z) or out (null): after the scene's own lighting(z)
    zone(z) {
      inZone = Boolean(z);
      if (!inZone) put(outdoor);
      // (at once: the scene's lighting(z) has just set the dome's share, and
      // the probe's radiance at that would blaze until the next one lands)
      if (probeOn) scene.environmentIntensity = envIntensity(inZone ? envShare.in : envShare.out);
      show();
      regrade();
    },
    // the sky's state (clear, dusk, overcast, storm): the level's weather for
    // it, faded in over `fade` seconds (0: at once)
    weather(next, { fade: secs = FADE_S } = {}) {
      const e = weatherEntry(light, next);
      if (!e || e === entry) return false;
      const from = snapshot({ sun, hemi, scene, sky });
      if (inZone) Object.assign(from, { sun: outdoor.sun, sky: outdoor.sky, ground: outdoor.ground, ambient: outdoor.ambient, fog: outdoor.fog, density: outdoor.density });
      entry = e;
      d = siteLightFrom(entry);
      const to = targetOf(d, { ...from, floor: fogFloor });
      fade = { from, to, t: 0, secs: Math.max(0, secs), turned: false };
      if (!fade.secs) this.step(0);
      return true;
    },
    step(dt) {
      if (!fade) return;
      fade.t += dt;
      const k = fade.secs ? Math.min(1, fade.t / fade.secs) : 1;
      const e = k * k * (3 - 2 * k);
      const { from, to } = fade;
      const v = {
        sun: from.sun + (to.sun - from.sun) * e,
        ambient: from.ambient + (to.ambient - from.ambient) * e,
        density: from.density + (to.density - from.density) * e,
      };
      for (const key of ['sunColor', 'sky', 'ground', 'fog', 'zenith', 'horizon', 'haze', 'disc']) v[key] = from[key].clone().lerp(to[key], e);
      outdoor = v;
      put(v);
      // the sun moves, the probe and the grade change, half way, under the fade
      if (k >= 0.5 && !fade.turned) {
        fade.turned = true;
        aim();
        show();
        regrade();
      }
      if (k >= 1) fade = null;
    },
    // the level's reflection volume you stand in (levelProbes.js): shown out of doors
    outdoorProbe(p) {
      if (override?.url === p?.url) return;
      override = p ? { id: p.id, url: p.url } : null;
      if (!inZone) show();
    },
    debug: () => ({ weather: Object.keys(light.weathers).find((w) => light.weathers[w] === entry) ?? null, zone: inZone, fading: Boolean(fade), probe: inZone ? light.indoor?.id ?? null : override?.id ?? entry?.probe?.id ?? null, sun: +sun.intensity.toFixed(2), exposure: d.exposure }),
    dispose() {
      disposed = true;
      holder.dispose();
      for (const p of luts.values()) p.then((t) => t?.dispose());
      post?.grading?.(null);
    },
  };
}
