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
//   cadence, farCache,              lane N3: the far cascades cached on sun.js's cadence (true, or its rows), and
//                                   shadows.js's createFarCache as the last cascade's distant term (none: a lit 1)
//   picture,                        the record's picture (lane Q6, grade.js's pictureOf; else entry.picture):
//                                   true for its tone map, five Gaussians and HBAO numbers alone, or
//                                   { lut: { url, size }, panorama: { url, horizon }, gradient: { url }, cloudShadow: { url } }
//                                   for its LUT, painted sky, fog gradient and cloud texture too (loaded
//                                   here: the LUT strip through gameLut.js, the rest through the stack's
//                                   KTX2 loader; one that fails to load is left out and named in
//                                   parts.picture.missing). None: nothing here changes.
//   onChain,                        (passes) => …: the chain built again when a weather's picture
//                                   lands at a crossfade's end (its LUT and Gaussians), for rt.gfx.post
//   video,                          lib/video.js's resolved values (lane V1): the shadows' quality and
//                                   distance, the contact and cloud shadows, the volumetric quality, the
//                                   lights' pool and the chain's fields, each over the tier's; none, the tier's
// }) → Promise<{ update(dt, camera), setWeather(entry, seconds, { picture }), setVideo(values) → passes, track(object), untrack(object),
//   setParticleLights(list) (effects.js's lights(): after the placed ones, the newest dropped past
//   the pool; placed.js), shadowTerm, passes, params, parts, dispose }>
//
// sunShadowNode(lit) → the sun's shadow term as a node (the cascades × the
//   clouds, eased by the record's ParticleSunShadowFactor) for a material
//   the lights do not reach: lane X's sprites multiply their colour by it;
//   null where the sun casts none or the factor is 0

import { lerpEntry, readEntry } from './entry.js';
import { cloudShadowNode } from './clouds.js';
import { createContactShadows } from './contact.js';
import { createFog } from './fog.js';
import { POINT_FALLBACK, createPlacedLights } from './placed.js';
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

// (the picture's loaders, imported once, when a picture is first asked for)
let lutModule = null;
let gltfModule = null;
const gameLut = () => (lutModule ??= import('../gameLut.js'));
const gltf = () => (gltfModule ??= import('../gltf.js'));

// The picture's textures, loaded; each that fails is named, not thrown. A
// url already in `have` (the weather before's, a texture two weathers share)
// is that texture again, not a second load. Each goes through the asset base
// (published by hash: src/data/galaxyAssets.json), the site's copy its fallback.
async function loadPicture(pic, renderer, THREE, have = null) {
  const out = { lut: null, panorama: null, gradient: null, cloudShadow: null, missing: [], urls: {} };
  if (!pic) return out;
  // (one loader for the three textures, asked for once)
  let ktx2 = null;
  const loader = () => (ktx2 ??= gltf().then((m) => m.ktx2Loader({ renderer })));
  const { withFallback } = await import('../../assetBase.js');
  const load = async (key, url) => {
    out.urls[key] = url;
    if (have?.urls?.[key] === url && have[key]) {
      out[key] = have[key];
      return;
    }
    try {
      const k = await loader();
      const t = await withFallback((u) => k.loadAsync(u))(site(url));
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
  if (pic.lut && have?.urls?.lut === pic.lut.url && have.lut) {
    out.urls.lut = pic.lut.url;
    out.lut = have.lut;
  } else if (pic.lut) {
    out.urls.lut = pic.lut.url;
    jobs.push(
      gameLut()
        .then(({ loadLut }) => withFallback((u) => loadLut(u, pic.lut.size))(site(pic.lut.url)))
        .then((t) => (out.lut = t))
        .catch(() => out.missing.push(pic.lut.url)),
    );
  }
  for (const k of ['panorama', 'gradient', 'cloudShadow']) if (pic[k]) jobs.push(load(k, pic[k].url));
  await Promise.all(jobs);
  return out;
}

// (the picture files' urls are the site's paths without the leading slash)
const site = (url) => (/^(\/|[a-z]+:)/i.test(url) ? url : `/${url}`);
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export async function applyGameLight(scene, renderer, entry, { tier = 'high', camera = null, origin, lights = null, clustered, volumes = null, loadCube = null, volumetrics = null, arena = null, grid = false, sky: withSky = true, post = true, lut = null, filter: forced = null, picture = null, onChain = null, cadence = null, farCache = null, video = null } = {}) {
  const { THREE } = await loadThree();
  const backend = backendOf(renderer);
  await registerLights(renderer);
  // (the record's picture, lane Q6: only where asked and only on the node renderer)
  let pic = backend !== 'webgl' ? pictureOf(entry, picture) : null;
  let tex = await loadPicture(pic, renderer, THREE);
  const was = { shadows: renderer.shadowMap?.enabled, shadowType: renderer.shadowMap?.type, environment: scene.environment, fogNode: scene.fogNode };
  // (the video settings, lib/video.js: each reader takes its field over the tier's)
  let vid = video;
  if (renderer.shadowMap) renderer.shadowMap.enabled = vid?.shadows ? vid.shadows !== 'off' : tier !== 'low';
  let params = readEntry(entry, { origin });
  const rays = post && tier === 'ultra';

  // the sun's soft shadow by tier (shadows.js): PCSS on ultra and high, PCF on mid
  const soft = forced === 'pcf' && tier !== 'low' ? { kind: 'pcf' } : filterFor(tier, readPcss(entry), { video: vid });
  const filter = soft.kind === 'pcss' ? await pcssFilter(soft) : null;
  const cloudsOn = vid?.cloudShadows ? vid.cloudShadows === 'on' : tier !== 'low';
  const clouds = cloudsOn ? await cloudShadowNode(entry, null, tex.cloudShadow ? { texture: tex.cloudShadow, offset: pic.cloudShadow.offset, rgbm: pic.cloudShadow.rgbm } : {}) : null;
  const sun = await createSun(entry, { tier, rays, filter, cloud: clouds?.node ?? null, cadence, farShadow: farCache?.node ?? null, video: vid });
  // (the far cache's march follows the sun's shadow direction, the one vector)
  if (farCache?.uniforms) farCache.uniforms.sun.value = sun.shadowDir;
  // (before the first frame: the cascades clone the light's shadow then)
  if (soft.kind === 'vsm') vsmFallback(renderer, sun.light, soft.samples);
  scene.add(sun.light);
  if (sun.rays) scene.add(sun.rays, sun.rays.target);
  const contact = await createContactShadows(scene, renderer, { tier, video: vid });
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
  const placed = lights ? await createPlacedLights(scene, renderer, { source: lights, scale: params.gameToSite, clustered, ...(vid?.localLights === 'nearest' ? { points: POINT_FALLBACK } : {}) }) : null;

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
  // (the video's volumetric quality: low marches as high did, high as ultra; off none)
  const volTier = vid?.volumetric ? { off: null, low: 'high', high: 'ultra' }[vid.volumetric] ?? tier : tier;
  const vols = post && volumetrics && volTier && CONES_LIT[volTier] && backend !== 'webgl' ? await createVolumetrics(scene, renderer, { tier: volTier, source: volumetrics, lights, scale: params.gameToSite }) : null;
  let lastEntry = entry;
  const chainFor = (e) => {
    lastEntry = e;
    const out = post ? passesFor(tier, e, backend, { scene, camera, light: raysLight(sun), lut: lut ?? tex.lut, volumetrics: vols, grade: pic?.grade ?? null, video: vid }) : [];
    // (the bloom's threshold from the record's grade: calibrate.js; the
    // record's own Gaussians have none)
    for (const p of out) if (p.kind === 'bloom' && !p.gaussians) p.threshold = params.grade.bloomThreshold;
    return out;
  };
  let passes = chainFor(entry);

  // The next weather's picture, at a crossfade's end: its painted sky, fog
  // gradient and cloud texture in place of the first's (no new shader), and
  // the chain built again once for its LUT and Gaussians (onChain hands it
  // to whoever draws it). Textures neither weather shares are let go.
  const turnPicture = (nextPic, got, e) => {
    const was = tex;
    if (got.panorama) sky?.setPanorama({ texture: got.panorama, rotation: nextPic.panorama?.rotation, horizon: nextPic.panorama?.horizon });
    if (got.gradient) fog?.setGradient({ texture: got.gradient, rotation: nextPic.gradient?.rotation });
    if (got.cloudShadow) clouds?.setTexture?.(got.cloudShadow);
    // (a texture the shader could not take, the first weather having none, stays unloaded)
    for (const k of ['panorama', 'gradient', 'cloudShadow']) if (!got[k] && was[k]) got[k] = was[k];
    pic = nextPic;
    tex = got;
    for (const k of ['panorama', 'gradient', 'cloudShadow', 'lut']) if (was[k] && was[k] !== tex[k] && !(k === 'lut' && was[k] === lut)) was[k].dispose();
    if (post) {
      passes = chainFor(e);
      onChain?.(passes);
    }
  };

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

  let fade = null; // { from, to, t, seconds, since, picture }
  let turned = 0; // (each weather asked; a picture that lands after a newer ask is late)
  const pos = [0, 0, 0];
  let sparks = null; // (the particles' lights for the next update: setParticleLights)
  const finish = (f) => {
    if (!f.picture) return;
    const mine = f.picture.ask;
    f.picture.ahead.then((got) => {
      if (mine !== turned) {
        for (const k of ['panorama', 'gradient', 'cloudShadow', 'lut']) if (got[k] && got[k] !== tex[k] && got[k] !== lut) got[k].dispose();
        return;
      }
      turnPicture(f.picture.pic, got, f.picture.entry);
    });
  };
  return {
    // the video settings changed while the world is up (lane V1): the chain
    // built again for the live fields; the rest (the cascades, the contact
    // and cloud shadows, the lights' pool) are set at mount and take a reload
    setVideo(values) {
      vid = values ?? null;
      if (!post) return passes;
      passes = chainFor(lastEntry);
      onChain?.(passes);
      return passes;
    },
    get passes() {
      return passes;
    },
    get params() {
      return params;
    },
    shadowTerm,
    track: (object) => (sun.track(object), contact.track(object)),
    setParticleLights(list) {
      sparks = list;
    },
    untrack: (object) => (sun.untrack(object), contact.untrack(object)),
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
      get grade() {
        return pic?.grade ?? null;
      },
      get picture() {
        return pic ? { lut: Boolean(tex.lut), panorama: Boolean(tex.panorama), gradient: Boolean(tex.gradient), cloudShadow: Boolean(tex.cloudShadow), gain: sky?.uniforms.panoramaGain?.value ?? null, missing: tex.missing, urls: { ...tex.urls } } : null;
      },
    },
    update(dt, cam = camera) {
      if (fade) {
        fade.t = Math.min(1, fade.t + dt / fade.seconds);
        params = lerpEntry(fade.from, fade.to, fade.t);
        // (the painted sky's gain eased toward the next panorama's horizon)
        if (fade.horizon) sky?.setHorizon(lerp3(fade.horizon[0], fade.horizon[1], fade.t));
        show(params);
        fade.since += dt;
        if (sky && canDraw && (fade.since >= ENV_EVERY || fade.t >= 1)) {
          fade.since = 0;
          env = sky.envTexture(renderer);
        }
        if (fade.t >= 1) {
          finish(fade);
          fade = null;
        }
      }
      clouds?.update(dt);
      if (!cam) return;
      sun.update(cam);
      contact.update(cam);
      sky?.update(cam);
      placed?.update(cam, sparks);
      vols?.update(cam);
      if (probes) {
        pos[0] = cam.position.x;
        pos[1] = cam.position.y;
        pos[2] = cam.position.z;
        probes.update(pos, dt);
      }
    },
    // the next weather, eased in over `seconds` (0: at once); with its
    // `picture` (as applyGameLight's), its textures are loaded now, ahead,
    // the painted sky's gain eased across, and at the fade's end the
    // textures swapped and the chain built again once (onChain)
    setWeather(next, seconds = WEATHER_FADE, { picture: nextAsk = null } = {}) {
      const to = readEntry(next, { origin });
      // (the shadow sun turns at once; the cloud layers' numbers stay the first weather's: lane S's Left)
      sun.setShadowSun(readShadowRecord(next).shadowSun);
      const nextPic = pic && backend !== 'webgl' ? pictureOf(next, nextAsk) : null;
      const ask = ++turned;
      const picture = nextPic ? { pic: nextPic, entry: next, ask, ahead: loadPicture(nextPic, renderer, THREE, tex) } : null;
      const from = pic?.panorama?.horizon ?? null;
      const horizon = from && nextPic?.panorama?.horizon ? [from, nextPic.panorama.horizon] : null;
      if (!(seconds > 0)) {
        fade = null;
        params = to;
        if (horizon) sky?.setHorizon(horizon[1]);
        show(params);
        if (sky && canDraw) env = sky.envTexture(renderer);
        if (picture) finish({ picture });
        return;
      }
      fade = { from: params, to, t: 0, seconds, since: 0, picture, horizon };
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
