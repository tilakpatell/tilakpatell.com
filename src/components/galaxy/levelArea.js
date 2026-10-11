// An area of its own for a space level that isn't fought in space (Kamino's
// Starfighter Assault, low over Tipoca City in the storm): a dome of the
// level's own sky round the battle, its sea under the city's stilts, and the
// storm's fog over everything in it while you're inside. The galaxy round it
// (the planet, the stars, the system's places) is shut out by the dome; from
// outside it's a ball of storm off the planet. Drawn by spaceLevel.js with
// the level's pack, laid where battles.js's layStarfighter puts the battle
// (`areaSpot`: well off the planet, away from its sun).
//
// Its light is the game's: the world's light record (src/data/bf2017/light/,
// lane G's, read by lib/three/gameLight.js) gives the storm's sun, its sky's
// colour, its fog, its wind, its reflection probe and its grade; `look` is
// what the scene takes from it while you're inside (areaLook.js), `flash`
// how much a lightning strike lights it now (areaWeather.js, from the
// level's own lamps, beacons, strikes and clouds: its area.json).
//
//   createLevelArea(scene, { at, radius, sea, sky, fog, light, weather, frame }) →
//     { group, look, flash, inside(position), update(camera, t, dt), dispose() }
//   (all in the battle's units: `at` the dome's middle, `radius` its size,
//   `sea` the water's height; `sky`: { url, gain } the level's panorama,
//   horizon to zenith round the dome; `fog`: { color, density, sea, deep,
//   dim }, the storm's colour (the record's, `dim` times, where it has one)
//   and how thick it is; `light`: the world's light record; `weather`: the
//   url of its area.json; `frame`: the level's metres → the battle's units)
//   A space level's area (Fondor's shipyard, the droid battleship over
//   Ryloth: fought where no system of the galaxy's is) has no `sea` and no
//   `fog` (null), and its `sky` is `full`: the level's star field round the
//   whole dome, not horizon to zenith.

import * as THREE from 'three';
import { siteLightFrom, weatherEntry } from '../../lib/three/gameLight';
import { dirOf } from './surface/sky';
import { createAreaWeather } from './areaWeather';

const DOME_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// (the panorama round the dome, horizon at its foot; below the horizon and
// at it, the storm's fog, so the sea runs into the sky with no seam)
const DOME_FRAG = `
uniform sampler2D uSky;
uniform float uGain, uHas, uFlash, uFull;
uniform vec3 uFog;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float u = atan(d.x, d.z) / 6.2831853 + 0.5;
  float v = uFull > 0.5 ? el / 3.1415927 + 0.5 : clamp(el / 1.5707963, 0.0, 1.0);
  vec3 sky = uHas > 0.5 ? texture2D(uSky, vec2(u, v)).rgb * uGain : uFog;
  vec3 c = uFull > 0.5 ? sky : mix(uFog, sky, smoothstep(0.0, 0.22, v));
  // (lightning lights the clouds from inside)
  c *= 1.0 + uFlash * 2.5;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const SEA_VERT = `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// (a dark, wind-torn sea: two layers of moving ripples for its normal, the
// storm's sky in it at a glance, the fog over it with distance)
const SEA_FRAG = `
uniform float uTime, uScale, uDensity, uFlash;
uniform vec3 uDeep, uSea, uFog;
varying vec3 vWorld;
float h(vec2 p) {
  return sin(p.x * 1.7 + uTime * 1.1) * sin(p.y * 1.3 - uTime * 0.8) + 0.5 * sin(p.x * 3.9 - p.y * 2.7 + uTime * 1.9);
}
void main() {
  vec2 p = vWorld.xz * uScale;
  float e = 0.05;
  vec3 n = normalize(vec3(h(p) - h(p + vec2(e, 0.0)), 6.0 * e, h(p) - h(p + vec2(0.0, e))));
  vec3 toEye = cameraPosition - vWorld;
  float dist = length(toEye);
  vec3 V = toEye / dist;
  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
  vec3 c = mix(uDeep, uSea * (1.0 + uFlash * 3.0), 0.35 + 0.65 * fres);
  float f = 1.0 - exp(-pow(uDensity * dist, 2.0));
  gl_FragColor = vec4(mix(c, uFog, clamp(f, 0.0, 1.0)), 1.0);
  #include <colorspace_fragment>
}`;

// what the scene takes from the world's light record while you're inside
// (areaLook.js): the storm's sun, the sky's fill, the probe and the grade
// (the stored, linear [r, g, b] the records carry, as three's linear colour)
const linear = (c) => (Array.isArray(c) ? new THREE.Color().setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace) : null);

// what the scene takes from the level's own light record while you're
// inside (areaLook.js): the sun's way from the record, the sun's, the sky's
// and the ground's colours from the area's `fill` (the records' stored
// values), the reflection probe of another record where the level's own sees
// nothing (`probe`), the grade the record has (none, for a space level), the
// wind, and the fog's density from the record's own curve
export function lookOf(light, { fill = null, probe = null } = {}) {
  const entry = weatherEntry(light, 'stormy');
  const d = siteLightFrom(entry);
  if (!d) return null;
  const sun = d.sky.suns[0];
  const shine = probe ? weatherEntry(probe, 'stormy') : entry;
  const shineD = probe ? siteLightFrom(shine) : d;
  return {
    sun: { dir: sun ? dirOf(sun.az, sun.el).toArray() : [0, 1, 0], color: linear(fill?.sun) ?? new THREE.Color(sun?.color ?? '#ffffff') },
    sky: linear(fill?.sky) ?? new THREE.Color(d.sky.horizon ?? '#8899aa'),
    ground: linear(fill?.ground) ?? new THREE.Color(d.light.ground ?? '#333333'),
    probe: shine?.probe?.url ?? null,
    // (the probe's faces are the game's radiance: this brings them to the site's, as the surface takes them)
    probeScale: shineD?.probeScale ?? 0,
    lut: d.grading.lut ? { url: d.grading.lut, size: d.grading.lutSize } : null,
    wind: d.wind,
    fogDensity: d.fog.density ?? null,
  };
}

export function createLevelArea(scene, { at, radius, sea = null, sky = null, fog = null, light = null, fill = null, probe = null, weather = null, frame = null, metres = 1 }) {
  const group = new THREE.Group();
  group.name = 'level-area';
  group.position.set(...at);
  scene.add(group);
  const look = light ? lookOf(light, { fill, probe }) : null;
  // (space: no fog, the dark of the star field under everything)
  const fogColor = new THREE.Color(fog?.color ?? '#000000');
  // (the record's fog density, a metre's, in the battle's units, where it gives one)
  if (fog && look?.fogDensity) fog = { ...fog, density: look.fogDensity * metres };

  const domeUniforms = { uSky: { value: null }, uGain: { value: sky?.gain ?? 1 }, uHas: { value: 0 }, uFog: { value: fogColor }, uFlash: { value: 0 }, uFull: { value: sky?.full ? 1 : 0 } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, uniforms: domeUniforms, side: THREE.DoubleSide, fog: false }));
  dome.name = 'level-area-sky';
  dome.frustumCulled = false;
  group.add(dome);
  let texture = null;
  if (sky?.url)
    new THREE.TextureLoader().load(sky.url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      texture = t;
      domeUniforms.uSky.value = t;
      domeUniforms.uHas.value = 1;
    });

  const seaUniforms = { uFlash: { value: 0 }, uTime: { value: 0 }, uScale: { value: 0.9 }, uDensity: { value: fog?.density ?? 0 }, uDeep: { value: new THREE.Color(fog?.deep ?? '#16262e') }, uSea: { value: new THREE.Color(fog?.sea ?? '#3e525c') }, uFog: { value: fogColor } };
  const water = sea === null ? null : new THREE.Mesh(new THREE.CircleGeometry(radius * 0.995, 96).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, uniforms: seaUniforms, fog: false }));
  if (water) {
    water.name = 'level-area-sea';
    water.position.y = sea - at[1];
    group.add(water);
  }

  // the storm's fog over what's in it (the level's pack, the battle's ships), while you're inside (none in space)
  const storm = fog ? new THREE.FogExp2(fogColor, fog.density) : null;
  let held = undefined; // (the scene's own fog, kept while ours is on)
  const inside = (p) => Boolean(p) && Math.hypot(p.x - at[0], p.y - at[1], p.z - at[2]) < radius * 0.98;
  const setFog = (on) => {
    if (!storm) return;
    if (on && held === undefined) {
      held = scene.fog ?? null;
      scene.fog = storm;
    } else if (!on && held !== undefined) {
      scene.fog = held;
      held = undefined;
    }
  };

  // the level's lamps, beacons, lightning, backlit clouds and rain (its area.json)
  let rained = null;
  let gone = false;
  if (weather && frame)
    fetch(weather)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || gone) return;
        rained = createAreaWeather(group, { data, frame, at, sea, wind: look?.wind, space: sea === null });
      })
      .catch(() => {});

  const area = {
    group,
    look,
    flash: 0,
    get strikeAt() {
      return rained?.strikeAt ?? null;
    },
    weather: () => rained,
    inside,
    update(camera, t = 0, dt = 1 / 60) {
      seaUniforms.uTime.value = t;
      rained?.update(dt, t, camera);
      area.flash = rained?.flash ?? 0;
      domeUniforms.uFlash.value = area.flash;
      seaUniforms.uFlash.value = area.flash;
      setFog(inside(camera?.position));
    },
    dispose() {
      gone = true;
      rained?.dispose();
      setFog(false);
      scene.remove(group);
      dome.geometry.dispose();
      dome.material.dispose();
      water?.geometry.dispose();
      water?.material.dispose();
      texture?.dispose();
    },
  };
  return area;
}
