// An area of its own for a space level (../levelArea.js) on the node
// renderer: the same dome of the level’s sky, the same storm-dark sea and
// the same fog while you’re inside, its shaders line for line as node
// materials (the dome’s and the sea’s uniforms nodes under the GLSL’s
// names, on each `material.uniforms`, so `uSky.value = texture` and the
// rest are written as before). The storm in it is ./areaWeather.js, the
// twin; the look it takes from the world’s light record is the same sum.
// The GLSL’s colorspace_fragment is the node renderer’s own output step.
//
//   createLevelArea(scene, { at, radius, sea, sky, fog, light, weather, frame }) →
//     { group, look, flash, inside(position), update(camera, t, dt), dispose() }
//   lookOf(light, { fill, probe }) → what the scene takes while you’re inside
//   (the arguments ../levelArea.js’s: all in the battle’s units)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { asin, atan, cameraPosition, clamp, dot, exp, float, max, mix, normalize, positionLocal, positionWorld, pow, select, sin, smoothstep, texture, uniform, vec2, vec3 } from 'three/tsl';
import { siteLightFrom, weatherEntry } from '../../../lib/three/gameLight';
import { dirOf } from '../surface/skyDome';
import { createAreaWeather } from './areaWeather';
import { withFallback } from '../../../lib/assetBase.js';

// (the sky’s panorama before it has loaded: uHas keeps it out of the sum)
const blank = () => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
};

// DOME_FRAG: the panorama round the dome, horizon at its foot; below the
// horizon and at it, the storm’s fog, so the sea runs into the sky with no seam
function domeMaterial(u) {
  const material = new MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: false });
  const vDir = normalize(positionLocal).toVarying('vDir');
  const d = normalize(vDir);
  const el = asin(clamp(d.y, -1, 1));
  const uu = atan(d.x, d.z).div(6.2831853).add(0.5);
  const full = u.uFull.greaterThan(0.5);
  const v = select(full, el.div(3.1415927).add(0.5), clamp(el.div(1.5707963), 0, 1));
  const sky = select(u.uHas.greaterThan(0.5), u.uSky.sample(vec2(uu, v)).rgb.mul(u.uGain), u.uFog);
  const c = select(full, sky, mix(u.uFog, sky, smoothstep(0, 0.22, v)));
  // (lightning lights the clouds from inside)
  material.colorNode = c.mul(u.uFlash.mul(2.5).add(1));
  return material;
}

// SEA_FRAG: a dark, wind-torn sea: two layers of moving ripples for its
// normal, the storm’s sky in it at a glance, the fog over it with distance
function seaMaterial(u) {
  const material = new MeshBasicNodeMaterial({ fog: false });
  const vWorld = positionWorld.toVarying('vWorld');
  const h = (p) => sin(p.x.mul(1.7).add(u.uTime.mul(1.1))).mul(sin(p.y.mul(1.3).sub(u.uTime.mul(0.8)))).add(sin(p.x.mul(3.9).sub(p.y.mul(2.7)).add(u.uTime.mul(1.9))).mul(0.5));
  const p = vWorld.xz.mul(u.uScale);
  const e = 0.05;
  const h0 = h(p);
  const n = normalize(vec3(h0.sub(h(p.add(vec2(e, 0)))), float(6 * e), h0.sub(h(p.add(vec2(0, e))))));
  const toEye = cameraPosition.sub(vWorld);
  const dist = toEye.length();
  const V = toEye.div(dist);
  const fres = pow(max(dot(n, V), 0).oneMinus(), 4);
  const c = mix(u.uDeep, u.uSea.mul(u.uFlash.mul(3).add(1)), fres.mul(0.65).add(0.35));
  const f = exp(pow(u.uDensity.mul(dist), 2).negate()).oneMinus();
  material.colorNode = mix(c, u.uFog, clamp(f, 0, 1));
  return material;
}

// what the scene takes from the world’s light record while you’re inside
// (areaLook.js): the storm’s sun, the sky’s fill, the probe and the grade
// (the stored, linear [r, g, b] the records carry, as three’s linear colour)
const linear = (c) => (Array.isArray(c) ? new THREE.Color().setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace) : null);

// what the scene takes from the level’s own light record while you’re
// inside (areaLook.js): the sun’s way from the record, the sun’s, the sky’s
// and the ground’s colours from the area’s `fill` (the records’ stored
// values), the reflection probe of another record where the level’s own sees
// nothing (`probe`), the grade the record has (none, for a space level), the
// wind, and the fog’s density from the record’s own curve
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
    // (the probe’s faces are the game’s radiance: this brings them to the site’s, as the surface takes them)
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
  // (the record’s fog density, a metre’s, in the battle’s units, where it gives one)
  if (fog && look?.fogDensity) fog = { ...fog, density: look.fogDensity * metres };

  const placeholder = blank();
  const domeUniforms = { uSky: texture(placeholder), uGain: uniform(sky?.gain ?? 1), uHas: uniform(0), uFog: uniform(fogColor), uFlash: uniform(0), uFull: uniform(sky?.full ? 1 : 0) };
  const domeM = domeMaterial(domeUniforms);
  domeM.uniforms = domeUniforms;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), domeM);
  dome.name = 'level-area-sky';
  dome.frustumCulled = false;
  group.add(dome);
  let loaded = null;
  if (sky?.url)
    new THREE.TextureLoader().load(sky.url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      loaded = t;
      domeUniforms.uSky.value = t;
      domeUniforms.uHas.value = 1;
    });

  const seaUniforms = { uFlash: uniform(0), uTime: uniform(0), uScale: uniform(0.9), uDensity: uniform(fog?.density ?? 0), uDeep: uniform(new THREE.Color(fog?.deep ?? '#16262e')), uSea: uniform(new THREE.Color(fog?.sea ?? '#3e525c')), uFog: uniform(fogColor) };
  let water = null;
  if (sea !== null) {
    const seaM = seaMaterial(seaUniforms);
    seaM.uniforms = seaUniforms;
    water = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.995, 96).rotateX(-Math.PI / 2), seaM);
    water.name = 'level-area-sea';
    water.position.y = sea - at[1];
    group.add(water);
  }

  // the storm’s fog over what’s in it (the level’s pack, the battle’s ships), while you’re inside (none in space)
  const storm = fog ? new THREE.FogExp2(fogColor, fog.density) : null;
  let held = undefined; // (the scene’s own fog, kept while ours is on)
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

  // the level’s lamps, beacons, lightning, backlit clouds and rain (its area.json)
  let rained = null;
  let gone = false;
  // (through the asset base: a level pack’s files but its level.json are published, lane D2)
  if (weather && frame)
    withFallback((u) => fetch(u))(weather)
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
      loaded?.dispose();
      placeholder.dispose();
    },
  };
  return area;
}
