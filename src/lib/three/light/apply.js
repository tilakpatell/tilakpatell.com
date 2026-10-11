// The game's light on a 'nodes' world in one call: the sun and its
// cascades (soft, cast from the record's shadow sun, under the record's
// cloud shadows; lane S), contact shadows under the tracked figures, the
// sky's hemisphere, the level's placed lights, the sky drawn and baked into the environment (or the level's probe volumes over it),
// the fog, on ultra the probe grid where it is asked for, and the post
// chain as data for `rt.gfx.post`. Weathers crossfade (lane G's 20 s).
//
// The design put this in src/runtime/look.js; that file is the pointer's
// look controller (createLook), so the light lives here beside its parts
// and a world imports it from lib/three/light.
//
// applyGameLight(scene, renderer, entry, {
//   tier, camera, origin,           the tier; the camera the chain draws; the pack's origin (height fog)
//   lights, clustered,              the level's lights.json (placed.js), none, no pool; clustering as placed.js takes it
//   volumes, loadCube,              the reflection volumes and a loader of their HDR cubes (probes.js)
//   volumetrics,                    the level's volumes.json: its glows and light cones, marched on ultra and high (volumetrics.js)
//   arena, grid,                    { min, max } and true: the probe grid on ultra (off until measured, A3)
//   sky = true, post = true, lut,   the sky and fog; the post chain; the grade as a Data3DTexture
//   filter,                         'pcf' forces three's PCF on the sun (else shadows.js's by tier)
//   picture,                        the record's picture (lane Q6, grade.js's pictureOf; else entry.picture):
//                                   true for its tone map, five Gaussians and HBAO numbers alone, or
//                                   { lut: { url, size }, panorama: { url, horizon }, gradient: { url }, cloudShadow: { url } }
//                                   for its LUT, painted sky, fog gradient and cloud texture too (loaded
//                                   here: the LUT strip through gameLut.js, the rest through the stack's
//                                   KTX2 loader; one that fails to load is left out and named in
//                                   parts.picture.missing). None: nothing here changes.
// }) → Promise<{ update(dt, camera), setWeather(entry, seconds), track(object), untrack(object), shadowTerm, passes, params, parts, dispose }>
//
// sunShadowNode(lit) → the sun's shadow term as a node (the cascades × the
//   clouds, eased by the record's ParticleSunShadowFactor) for a material
//   the lights do not reach: lane X's sprites multiply their colour by it;
//   null where the sun casts none or the factor is 0

import { lerpEntry, readEntry } from './entry.js';
import { cloudShadowNode } from './clouds.js';
import { createContactShadows } from './contact.js';
import { createFog } from './fog.js';
import { createPlacedLights } from './placed.js';
import { passesFor, raysLight } from './post.js';
import { createProbeGrid, createProbes } from './probes.js';
import { filterFor, pcssFilter, readPcss, vsmFallback } from './shadows.js';
import { createSky } from './sky.js';
import { createSun, readShadowRecord } from './sun.js';
import { CONES_LIT, createVolumetrics } from './volumetrics.js';
import { pictureOf } from './grade.js';
import { backendOf, loadThree, registerLights } from './three.js';

export const WEATHER_FADE = 20; // s: lane G's crossfade between two weathers
const ENV_EVERY = 2; // s: the sky's environment re-baked this often while a weather fades

// The picture's textures, loaded; each that fails is named, not thrown
async function loadPicture(pic, renderer, THREE) {
  const out = { lut: null, panorama: null, gradient: null, cloudShadow: null, missing: [] };
  if (!pic) return out;
  let ktx2 = null;
  const load = async (key, url) => {
    try {
      ktx2 ??= await (await import('../gltf.js')).ktx2Loader({ renderer });
      const t = await ktx2.loadAsync(url);
      t.colorSpace = THREE.NoColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = key === 'cloudShadow' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
      out[key] = t;
    } catch {
      out.missing.push(url);
    }
  };
  const jobs = [];
  if (pic.lut)
    jobs.push(
      import('../gameLut.js')
        .then(({ loadLut }) => loadLut(pic.lut.url, pic.lut.size))
        .then((t) => (out.lut = t))
        .catch(() => out.missing.push(pic.lut.url)),
    );
  for (const k of ['panorama', 'gradient', 'cloudShadow']) if (pic[k]) jobs.push(load(k, pic[k].url));
  await Promise.all(jobs);
  return out;
}

export async function applyGameLight(scene, renderer, entry, { tier = 'high', camera = null, origin, lights = null, clustered, volumes = null, loadCube = null, volumetrics = null, arena = null, grid = false, sky: withSky = true, post = true, lut = null, filter: forced = null, picture = null } = {}) {
  const { THREE } = await loadThree();
  const backend = backendOf(renderer);
  await registerLights(renderer);
  // (the record's picture, lane Q6: only where asked and only on the node renderer)
  const pic = backend !== 'webgl' ? pictureOf(entry, picture) : null;
  const tex = await loadPicture(pic, renderer, THREE);
  const was = { shadows: renderer.shadowMap?.enabled, shadowType: renderer.shadowMap?.type, environment: scene.environment, fogNode: scene.fogNode };
  if (renderer.shadowMap) renderer.shadowMap.enabled = tier !== 'low';
  let params = readEntry(entry, { origin });
  const rays = post && tier === 'ultra';

  // the sun's soft shadow by tier (shadows.js): PCSS on ultra and high, PCF on mid
  const soft = forced === 'pcf' && tier !== 'low' ? { kind: 'pcf' } : filterFor(tier, readPcss(entry));
  const filter = soft.kind === 'pcss' ? await pcssFilter(soft) : null;
  const clouds = tier !== 'low' ? await cloudShadowNode(entry, null, tex.cloudShadow ? { texture: tex.cloudShadow, offset: pic.cloudShadow.offset, rgbm: pic.cloudShadow.rgbm } : {}) : null;
  const sun = await createSun(entry, { tier, rays, filter, cloud: clouds?.node ?? null });
  // (before the first frame: the cascades clone the light's shadow then)
  if (soft.kind === 'vsm') vsmFallback(renderer, sun.light, soft.samples);
  scene.add(sun.light);
  if (sun.rays) scene.add(sun.rays, sun.rays.target);
  const contact = await createContactShadows(scene, renderer, { tier });
  // the particles' share of the sun's shadow (ParticleSunShadowFactor, 1 on Hoth)
  const particleFactor = Number(entry?.record?.OutdoorLightComponentData?.[0]?.ParticleSunShadowFactor ?? 1);
  let shadowTerm = null;
  if (sun.csm && particleFactor > 0) {
    const { tsl } = await loadThree();
    shadowTerm = tsl.mix(tsl.float(1), tsl.nodeObject(sun.csm).x, particleFactor);
  }
  const hemi = new THREE.HemisphereLight(new THREE.Color(...params.ambient.sky), new THREE.Color(...params.ambient.ground), params.ambient.intensity);
  hemi.name = 'sky-light';
  scene.add(hemi);
  const placed = lights ? await createPlacedLights(scene, renderer, { source: lights, scale: params.gameToSite, clustered }) : null;

  // (a renderer that cannot draw, a test's, gets no baked environment)
  const canDraw = typeof renderer.setRenderTarget === 'function';
  const sky = withSky ? await createSky(entry, { panorama: tex.panorama ? { ...pic.panorama, texture: tex.panorama } : null }) : null;
  if (sky) scene.add(sky.mesh);
  let env = sky && canDraw ? sky.envTexture(renderer) : null;
  const probes = volumes?.length && loadCube ? await createProbes(scene, volumes, loadCube, { fallback: env }) : null;
  if (!probes && env) scene.environment = env;
  const gradient = tex.gradient ? { texture: tex.gradient, rotation: pic.gradient.rotation, gain: sky?.uniforms.panoramaGain ?? 1 } : null;
  const fog = withSky ? await createFog(entry, { origin, gradient }) : null;
  if (fog) scene.fogNode = fog.node;

  let probeGrid = null;
  let gridBake = null;
  if (grid && tier === 'ultra' && arena) {
    probeGrid = await createProbeGrid(scene, renderer, arena);
    if (probeGrid) gridBake = probeGrid.bake();
  }

  // (the volumes draw only through the post chain)
  const vols = post && volumetrics && CONES_LIT[tier] && backend !== 'webgl' ? await createVolumetrics(scene, renderer, { tier, source: volumetrics, lights, scale: params.gameToSite }) : null;
  const passes = post ? passesFor(tier, entry, backend, { scene, camera, light: raysLight(sun), lut: lut ?? tex.lut, volumetrics: vols, grade: pic?.grade ?? null }) : [];
  // (the bloom's threshold from the record's grade: calibrate.js; the
  // record's own Gaussians have none)
  for (const p of passes) if (p.kind === 'bloom' && !p.gaussians) p.threshold = params.grade.bloomThreshold;

  const show = (p) => {
    sun.set(p);
    hemi.color.setRGB(...p.ambient.sky);
    hemi.groundColor.setRGB(...p.ambient.ground);
    hemi.intensity = p.ambient.intensity;
    sky?.set(p);
    fog?.set(p);
    placed?.setScale(p.gameToSite);
    vols?.setScale(p.gameToSite);
  };

  let fade = null; // { from, to, t, seconds, since }
  const pos = [0, 0, 0];
  return {
    passes,
    get params() {
      return params;
    },
    shadowTerm,
    track: (object) => contact.track(object),
    untrack: (object) => contact.untrack(object),
    parts: {
      sun,
      soft,
      clouds,
      contact,
      hemi,
      placed,
      sky,
      fog,
      probes,
      grid: probeGrid,
      gridBake,
      volumetrics: vols,
      grade: pic?.grade ?? null,
      picture: pic ? { lut: Boolean(tex.lut), panorama: Boolean(tex.panorama), gradient: Boolean(tex.gradient), cloudShadow: Boolean(tex.cloudShadow), gain: sky?.uniforms.panoramaGain?.value ?? null, missing: tex.missing } : null,
    },
    update(dt, cam = camera) {
      if (fade) {
        fade.t = Math.min(1, fade.t + dt / fade.seconds);
        params = lerpEntry(fade.from, fade.to, fade.t);
        show(params);
        fade.since += dt;
        if (sky && canDraw && (fade.since >= ENV_EVERY || fade.t >= 1)) {
          fade.since = 0;
          env = sky.envTexture(renderer);
        }
        if (fade.t >= 1) fade = null;
      }
      clouds?.update(dt);
      if (!cam) return;
      sun.update(cam);
      contact.update(cam);
      sky?.update(cam);
      placed?.update(cam);
      vols?.update(cam);
      if (probes) {
        pos[0] = cam.position.x;
        pos[1] = cam.position.y;
        pos[2] = cam.position.z;
        probes.update(pos, dt);
      }
    },
    // the next weather, eased in over `seconds` (0: at once)
    setWeather(next, seconds = WEATHER_FADE) {
      const to = readEntry(next, { origin });
      // (the shadow sun turns at once; the clouds stay the first weather's: lane S's Left)
      sun.setShadowSun(readShadowRecord(next).shadowSun);
      if (!(seconds > 0)) {
        fade = null;
        params = to;
        show(params);
        if (sky && canDraw) env = sky.envTexture(renderer);
        return;
      }
      fade = { from: params, to, t: 0, seconds, since: 0 };
    },
    dispose() {
      contact.dispose();
      clouds?.dispose();
      sun.dispose();
      hemi.removeFromParent();
      hemi.dispose();
      placed?.dispose();
      vols?.dispose();
      probes?.dispose();
      probeGrid?.dispose();
      sky?.dispose();
      for (const k of ['panorama', 'gradient', 'cloudShadow']) tex[k]?.dispose();
      // (a LUT handed in is the caller's; one loaded here is ours)
      tex.lut?.dispose();
      scene.environment = was.environment;
      scene.fogNode = was.fogNode;
      if (renderer.shadowMap) Object.assign(renderer.shadowMap, { enabled: was.shadows, type: was.shadowType });
    },
  };
}

export const sunShadowNode = (lit) => lit?.shadowTerm ?? null;
