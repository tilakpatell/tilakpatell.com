// The game's light on a 'nodes' world in one call: the sun and its
// cascades, the sky's hemisphere, the level's placed lights, the sky drawn
// and baked into the environment (or the level's probe volumes over it),
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
// }) → Promise<{ update(dt, camera), setWeather(entry, seconds), passes, params, parts, dispose }>

import { lerpEntry, readEntry } from './entry.js';
import { createFog } from './fog.js';
import { createPlacedLights } from './placed.js';
import { passesFor, raysLight } from './post.js';
import { createProbeGrid, createProbes } from './probes.js';
import { createSky } from './sky.js';
import { createSun } from './sun.js';
import { CONES_LIT, createVolumetrics } from './volumetrics.js';
import { backendOf, loadThree, registerLights } from './three.js';

export const WEATHER_FADE = 20; // s: lane G's crossfade between two weathers
const ENV_EVERY = 2; // s: the sky's environment re-baked this often while a weather fades

export async function applyGameLight(scene, renderer, entry, { tier = 'high', camera = null, origin, lights = null, clustered, volumes = null, loadCube = null, volumetrics = null, arena = null, grid = false, sky: withSky = true, post = true, lut = null } = {}) {
  const { THREE } = await loadThree();
  const backend = backendOf(renderer);
  await registerLights(renderer);
  const was = { shadows: renderer.shadowMap?.enabled, environment: scene.environment, fogNode: scene.fogNode };
  if (renderer.shadowMap) renderer.shadowMap.enabled = tier !== 'low';
  let params = readEntry(entry, { origin });
  const rays = post && tier === 'ultra';

  const sun = await createSun(entry, { tier, rays });
  scene.add(sun.light);
  if (sun.rays) scene.add(sun.rays, sun.rays.target);
  const hemi = new THREE.HemisphereLight(new THREE.Color(...params.ambient.sky), new THREE.Color(...params.ambient.ground), params.ambient.intensity);
  hemi.name = 'sky-light';
  scene.add(hemi);
  const placed = lights ? await createPlacedLights(scene, renderer, { source: lights, scale: params.gameToSite, clustered }) : null;

  // (a renderer that cannot draw, a test's, gets no baked environment)
  const canDraw = typeof renderer.setRenderTarget === 'function';
  const sky = withSky ? await createSky(entry) : null;
  if (sky) scene.add(sky.mesh);
  let env = sky && canDraw ? sky.envTexture(renderer) : null;
  const probes = volumes?.length && loadCube ? await createProbes(scene, volumes, loadCube, { fallback: env }) : null;
  if (!probes && env) scene.environment = env;
  const fog = withSky ? await createFog(entry, { origin }) : null;
  if (fog) scene.fogNode = fog.node;

  let probeGrid = null;
  let gridBake = null;
  if (grid && tier === 'ultra' && arena) {
    probeGrid = await createProbeGrid(scene, renderer, arena);
    if (probeGrid) gridBake = probeGrid.bake();
  }

  // (the volumes draw only through the post chain)
  const vols = post && volumetrics && CONES_LIT[tier] && backend !== 'webgl' ? await createVolumetrics(scene, renderer, { tier, source: volumetrics, lights, scale: params.gameToSite }) : null;
  const passes = post ? passesFor(tier, entry, backend, { scene, camera, light: raysLight(sun), lut, volumetrics: vols }) : [];

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
    parts: { sun, hemi, placed, sky, fog, probes, grid: probeGrid, gridBake, volumetrics: vols },
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
      if (!cam) return;
      sun.update(cam);
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
      sun.dispose();
      hemi.removeFromParent();
      hemi.dispose();
      placed?.dispose();
      vols?.dispose();
      probes?.dispose();
      probeGrid?.dispose();
      sky?.dispose();
      scene.environment = was.environment;
      scene.fogNode = was.fogNode;
      if (renderer.shadowMap) renderer.shadowMap.enabled = was.shadows;
    },
  };
}
