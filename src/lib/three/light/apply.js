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
//                                   { lut: { url, size }, panorama: { url, horizon, hdr }, gradient: { url }, cloudShadow: { url } }
//                                   for its LUT, painted sky, fog gradient and cloud texture too (loaded
//                                   here: the LUT strip through gameLut.js, the rest through the stack's
//                                   KTX2 loader; one that fails to load is left out and named in
//                                   parts.picture.missing). None: nothing here changes.
//   onChain,                        (passes) => …: the chain built again when a weather's picture
//                                   lands at a crossfade's end (its LUT and Gaussians), for rt.gfx.post
//   inside,                         the interiors' visual environments (inside.js's insideOf: { areas, patches },
//                                   and `lut`, { url, size }, the interior grade's 33³ strip): folded into the
//                                   weather by the view's place each frame, the exposure adapting to it
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
import { createPlacedLights, lampPool } from './placed.js';
import { passesFor, raysLight } from './post.js';
import { createProbeGrid, createProbes, probeFor, roomNits } from './probes.js';
import { filterFor, pcssFilter, readPcss, vsmFallback } from './shadows.js';
import { createSky } from './sky.js';
import { createSun, readShadowRecord } from './sun.js';
import { CONES_LIT, createVolumetrics } from './volumetrics.js';
import { panoramaSource, pictureOf } from './grade.js';
import { backendOf, loadThree, registerLights } from './three.js';
import { patchRecord, skyShare, visibilities } from './inside.js';

export const WEATHER_FADE = 20; // s: lane G's crossfade between two weathers
export const VOLUME_TEXTURES = 24; // the sampled textures a stage the chain needs with the volumes in (Hoth's ultra chain asked 22 in its bloom)
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
// The painted sky is the tier's copy (grade.js's panoramaSource): lane W's
// HDR KTX2 (RGBA16F, nothing clamped) on high and ultra, which three's
// KTX2Loader reads as a half-float DataTexture with its own mips (set to
// filter linearly: the loader leaves a raw texture at nearest); one that
// fails to load is named and the UASTC copy loaded in its place.
async function loadPicture(pic, renderer, THREE, have = null, tier = 'high') {
  const out = { lut: null, panorama: null, gradient: null, cloudShadow: null, missing: [], urls: {} };
  if (!pic) return out;
  // (one loader for the three textures, asked for once)
  let ktx2 = null;
  const loader = () => (ktx2 ??= gltf().then((m) => m.ktx2Loader({ renderer })));
  const { withFallback } = await import('../../assetBase.js');
  const load = async (key, url, { hdr = false, fallback = null } = {}) => {
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
      if (hdr) {
        t.magFilter = THREE.LinearFilter;
        t.minFilter = t.mipmaps?.length > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
      }
      t.needsUpdate = true;
      out[key] = t;
    } catch {
      out.missing.push(url);
      if (fallback) await load(key, fallback);
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
  if (pic.panorama) {
    const src = panoramaSource(pic.panorama, tier);
    jobs.push(load('panorama', src.url, { hdr: src.hdr, fallback: src.hdr ? pic.panorama.url : null }));
  }
  for (const k of ['gradient', 'cloudShadow']) if (pic[k]) jobs.push(load(k, pic[k].url));
  await Promise.all(jobs);
  return out;
}

// The interior's grading LUT ({ url, size }, the picture manifest's), or null where it fails
async function loadInsideLut({ url, size }) {
  try {
    const { loadLut } = await gameLut();
    const { withFallback } = await import('../../assetBase.js');
    return await withFallback((u) => loadLut(u, size))(site(url));
  } catch {
    return null;
  }
}

// (what the painted sky was loaded as: the evidence reads it off the dev door)
const formatOf = (t, THREE) => (t ? (t.type === THREE.HalfFloatType ? 'rgba16f' : t.type === THREE.FloatType ? 'rgba32f' : 'uastc') : null);

// (the picture files' urls are the site's paths without the leading slash)
const site = (url) => (/^(\/|[a-z]+:)/i.test(url) ? url : `/${url}`);
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export async function applyGameLight(scene, renderer, entry, { tier = 'high', camera = null, origin, lights = null, clustered, volumes = null, loadCube = null, volumetrics = null, arena = null, grid = false, sky: withSky = true, post = true, lut = null, filter: forced = null, picture = null, onChain = null, cadence = null, farCache = null, video = null, inside = null } = {}) {
  const { THREE, tsl } = await loadThree();
  const backend = backendOf(renderer);
  await registerLights(renderer);
  // (the record's picture, lane Q6: only where asked and only on the node renderer)
  let pic = backend !== 'webgl' ? pictureOf(entry, picture) : null;
  let tex = await loadPicture(pic, renderer, THREE, null, tier);
  const was = { shadows: renderer.shadowMap?.enabled, shadowType: renderer.shadowMap?.type, environment: scene.environment, environmentIntensity: scene.environmentIntensity, fogNode: scene.fogNode };
  // (the video settings, lib/video.js: each reader takes its field over the tier's)
  let vid = video;
  if (renderer.shadowMap) renderer.shadowMap.enabled = vid?.shadows ? vid.shadows !== 'off' : tier !== 'low';

  // The interiors (inside.js): each patch folded into the weather's record by
  // its visibility at the view, the meter's sky cut by what of it the view
  // still has and the room seen in its place (the nits of the game's own
  // capture of the room: the reflection volume holding the view, else the
  // nearest; the game's histogram meters the room it draws, the site's meter
  // reads the game's picture of it), and the exposure adapting to the result
  // at the record's Dark/LightAdaptationTime (the one state the game's
  // renderer smooths: findings 22 §2). With no `inside`, the weather's record
  // as it was.
  let vis = {};
  let skyLeft = 1;
  let room = null; // (the nits of the room the view is in or nearest, its capture's horizon)
  let cur = entry; // (the weather the stack shows, or fades to)
  const litOf = (e) => {
    if (!inside || !e) return e;
    const record = patchRecord(e.record ?? {}, inside.patches, vis);
    const lum = e.record?.SkyComponentData?.[0]?.LuminanceScale;
    return { ...e, record, ...(skyLeft < 1 && lum != null ? { meter: { sky: lum * skyLeft, room: (room ?? 0) * (1 - skyLeft) } } : {}) };
  };
  const readLit = (e) => readEntry(litOf(e), { origin });
  let target = readLit(entry); // (the light at the view, before the exposure adapts to it)
  let adapted = target.gameToSite;
  let params = target;
  let toneNow = litOf(entry)?.record?.TonemapComponentData?.[0] ?? {};
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
  const placed = lights ? await createPlacedLights(scene, renderer, { source: lights, scale: params.gameToSite, clustered, ...lampPool(tier, vid) }) : null;

  // (a renderer that cannot draw, a test's, gets no baked environment)
  const canDraw = typeof renderer.setRenderTarget === 'function';
  const sky = withSky ? await createSky(entry, { panorama: tex.panorama ? { ...pic.panorama, texture: tex.panorama } : null }) : null;
  if (sky) scene.add(sky.mesh);
  let env = sky && canDraw ? sky.envTexture(renderer) : null;
  let envK = params.gameToSite; // (the exposure the sky's environment was baked at)
  const probes = volumes?.length && loadCube ? await createProbes(scene, volumes, loadCube, { fallback: env, renderer: canDraw && backend !== 'webgl' ? renderer : null }) : null;
  if (!probes && env) scene.environment = env;
  // (the interior's grade: its LUT read beside the weather's and mixed by the patch's visibility,
  // as the game's colour-cube builder weighs one cube a VE, findings 02's g_weights)
  const lutVe = inside ? Object.keys(inside.patches).find((ve) => inside.patches[ve].components?.ColorCorrection?.HdrColorGradingLut) : null;
  const lutWeight = tsl?.uniform ? tsl.uniform(0) : null;
  const insideLut = lutVe && inside.lut && backend !== 'webgl' ? await loadInsideLut(inside.lut) : null;
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
  // (the volumes' march and its upsampling read their own targets inline in the passes after them: on a device held to
  // WebGPU's 16 sampled textures a stage, the bloom's and SSGI's pipelines overflow and fail, so the volumes need more)
  const sampled = renderer.backend?.device?.limits?.maxSampledTexturesPerShaderStage ?? Infinity; // (a renderer with no device, a test's: no limit to keep to)
  const vols = post && volumetrics && volTier && CONES_LIT[volTier] && backend !== 'webgl' && sampled >= VOLUME_TEXTURES ? await createVolumetrics(scene, renderer, { tier: volTier, source: volumetrics, lights, scale: params.gameToSite, shadows: (renderer.backend?.device?.limits?.maxSamplersPerShaderStage ?? Infinity) > 16 }) : null;
  let lastEntry = entry;
  const chainFor = (e) => {
    lastEntry = e;
    const out = post ? passesFor(tier, e, backend, { scene, camera, light: raysLight(sun), lut: lut ?? tex.lut, lutInside: insideLut && lutWeight ? { texture: insideLut, weight: lutWeight } : null, volumetrics: vols, grade: pic?.grade ?? null, video: vid }) : [];
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
    // (the sky's fill and environment as far as the view still has the sky: none under the rock, where the
    // room's light is its reflection volume's capture, the environment: probes.js; hand: the game's diffuse
    // there is Enlighten's, whose probes hold no data in the export, findings 60 §5)
    hemi.intensity = p.ambient.intensity * skyLeft;
    const envShare = (skyLeft * p.gameToSite) / Math.max(1e-12, envK);
    if (probes) probes.setScales?.({ probe: p.gameToSite, fallback: envShare });
    else if (env && inside) scene.environmentIntensity = envShare;
    sky?.set(p);
    fog?.set(p);
    placed?.setScale(p.gameToSite);
    vols?.setScale(p.gameToSite);
  };
  show(params);

  // The light at the view: the weather (or the fade between two), each with
  // the interiors folded in, then exposed at the adapted exposure: the sun,
  // the sky and its fill, the lamps all go by one factor (calibrate.js).
  const targetOf = () => (fade ? lerpEntry(fade.from, readLit(fade.toEntry), fade.t) : readLit(cur));
  const exposed = (p, g) => {
    const r = g / p.gameToSite;
    if (!(Math.abs(r - 1) > 1e-6)) return p;
    return { ...p, sun: { ...p.sun, intensity: p.sun.intensity * r }, ambient: { ...p.ambient, intensity: p.ambient.intensity * r }, sky: { ...p.sky, luminance: p.sky.luminance * r, sunScale: p.sky.sunScale * r }, gameToSite: g };
  };
  // (the record's adaptation times: Hoth's day 0.25 s either way; the eye opening up is the dark one)
  // (with no interiors, none: the weather's crossfade is the only change, and it is its own ease)
  const adapt = (dt) => {
    if (!inside) {
      const changed = adapted !== target.gameToSite;
      adapted = target.gameToSite;
      return changed;
    }
    const tone = toneNow;
    const opening = target.gameToSite > adapted;
    const tau = Math.max(1e-3, Number((opening ? tone.DarkAdaptationTime : tone.LightAdaptationTime) ?? 0.25));
    const ev = Math.log2(adapted);
    const to = Math.log2(target.gameToSite);
    const next = Math.abs(to - ev) < 1e-3 ? to : ev + (to - ev) * (1 - Math.exp(-dt / tau));
    const changed = next !== ev;
    adapted = 2 ** next;
    return changed;
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
      // (the interiors at the view: each VE's visibility, the sky the view still has, the exposure as adapted)
      get inside() {
        return inside ? { vis: { ...vis }, sky: skyLeft, gameToSite: adapted, target: target.gameToSite, lut: Boolean(insideLut), lutWeight: lutWeight?.value ?? 0 } : null;
      },
      get grade() {
        return pic?.grade ?? null;
      },
      get picture() {
        return pic ? { lut: Boolean(tex.lut), panorama: Boolean(tex.panorama), gradient: Boolean(tex.gradient), cloudShadow: Boolean(tex.cloudShadow), gain: sky?.uniforms.panoramaGain?.value ?? null, format: formatOf(tex.panorama, THREE), missing: tex.missing, urls: { ...tex.urls } } : null;
      },
    },
    update(dt, cam = camera) {
      let dirty = false;
      if (inside && cam) {
        pos[0] = cam.position.x;
        pos[1] = cam.position.y;
        pos[2] = cam.position.z;
        const next = visibilities(inside.areas, pos);
        if (Object.keys(next).some((ve) => Math.abs(next[ve] - (vis[ve] ?? 0)) > 1e-3) || Object.keys(vis).some((ve) => !(ve in next))) {
          vis = next;
          skyLeft = skyShare(inside.patches, vis);
          if (lutWeight) lutWeight.value = lutVe ? (vis[lutVe] ?? 0) : 0;
          dirty = true;
        }
        // (the room the meter sees under the rock: the volume holding the view, else the nearest)
        const r = skyLeft < 1 && volumes?.length ? roomNits(volumes[probeFor(volumes, pos, { nearest: true }).i]) : null;
        if (r !== room) {
          room = r;
          dirty = true;
        }
      }
      if (fade) {
        fade.t = Math.min(1, fade.t + dt / fade.seconds);
        // (the painted sky's gain eased toward the next panorama's horizon)
        if (fade.horizon) sky?.setHorizon(lerp3(fade.horizon[0], fade.horizon[1], fade.t));
        dirty = true;
      }
      if (dirty) {
        target = targetOf();
        toneNow = litOf(cur)?.record?.TonemapComponentData?.[0] ?? {};
      }
      if (adapt(dt) || dirty) {
        params = exposed(target, adapted);
        show(params);
      }
      if (fade) {
        fade.since += dt;
        if (sky && canDraw && (fade.since >= ENV_EVERY || fade.t >= 1)) {
          fade.since = 0;
          env = sky.envTexture(renderer);
          envK = params.gameToSite;
          probes?.setFallback(env);
          if (!probes && env) scene.environment = env;
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
        probes.update(pos, dt, { nearest: skyLeft < 0.5 });
      }
    },
    // the next weather, eased in over `seconds` (0: at once); with its
    // `picture` (as applyGameLight's), its textures are loaded now, ahead,
    // the painted sky's gain eased across, and at the fade's end the
    // textures swapped and the chain built again once (onChain)
    setWeather(next, seconds = WEATHER_FADE, { picture: nextAsk = null } = {}) {
      // (from what shows now, to the next weather with the interiors folded in as the view moves)
      const from = target;
      cur = next;
      // (the shadow sun turns at once; the cloud layers' numbers stay the first weather's: lane S's Left)
      sun.setShadowSun(readShadowRecord(next).shadowSun);
      const nextPic = pic && backend !== 'webgl' ? pictureOf(next, nextAsk) : null;
      const ask = ++turned;
      const picture = nextPic ? { pic: nextPic, entry: next, ask, ahead: loadPicture(nextPic, renderer, THREE, tex, tier) } : null;
      const fromHorizon = pic?.panorama?.horizon ?? null;
      const horizon = fromHorizon && nextPic?.panorama?.horizon ? [fromHorizon, nextPic.panorama.horizon] : null;
      if (!(seconds > 0)) {
        fade = null;
        // (at once: the exposure too)
        target = readLit(cur);
        adapted = target.gameToSite;
        params = target;
        if (horizon) sky?.setHorizon(horizon[1]);
        show(params);
        if (sky && canDraw) {
          env = sky.envTexture(renderer);
          envK = params.gameToSite;
          probes?.setFallback(env);
          if (!probes && env) scene.environment = env;
          show(params);
        }
        if (picture) finish({ picture });
        return;
      }
      fade = { from, toEntry: next, t: 0, seconds, since: 0, picture, horizon };
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
      scene.environmentIntensity = was.environmentIntensity ?? 1;
      insideLut?.dispose();
      scene.fogNode = was.fogNode;
      if (renderer.shadowMap) Object.assign(renderer.shadowMap, { enabled: was.shadows, type: was.shadowType });
    },
  };
}

export const sunShadowNode = (lit) => lit?.shadowTerm ?? null;
