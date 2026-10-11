// The lit fixture: the nodes fixture (nodesWorld.js) with the game's light
// on it, the smallest world that proves src/lib/three/light on both of the
// node renderer's kinds. A ground, a ring of pillars and spheres, the sun
// with its cascades, 200 point lights round the ring and 8 spots over it,
// the sky baked into the environment, the fog and the tier's post chain,
// all through applyGameLight (src/lib/three/light/apply.js). It keeps the
// 'nodes' promise: node materials only, no GLSL, no composer
// (shading.test.js reads this folder).
//
// scripts/light-fixture.mjs draws it headless on ?gpu=webgpu and
// ?gpu=webgl and reads `probe` for the checks the plan names: the
// environment under ClusteredLighting (A2), the programs before and after a
// light moves (no recompile), the frame time.
//
// rt.fixture: { tier = 'ultra', env = true, post = true, sky = true, placed = true, clustered, only,
//   materials, weather, decals, particles, upscale, hoth, shadows, lightSun, clouds, filter, picture }
//
// `materials` (lane Q1, scripts/light-fixture.mjs --materials): { mode:
// 'game' | 'glb', list: [{ label, recipe, glb, maps: { detail: url, … } }] }:
// the ring and its things set aside, a cube per recipe wearing the game
// material over the GLB's own (mode 'glb': the GLB's material as it is) and
// a wall under the first recipe, seen from probe.view('row' | 'wall').
//
// `particles` (fidelity lane X): the game's effects from their emitter
// tables over the ring, and the GPU twin's parity (particleProbe.js), read
// by scripts/light-fixture.mjs --particles as `probe.particles`.
//
// `weather` (lane Q4, seconds into Hoth's day): three crates at the front
// under the snow contributor of src/lib/three/surface/weather.js, composed
// on a node material here in three lines (lane Q1's composeOverlays takes
// over when both merge): one flat and one tilted that allow weather, one
// flat that does not; probe.setWeather(t) moves the accumulation and
// probe.view('crate') frames them.
//
// `decals` (lane Q4): a decals.json (scripts/lib/bf2017-decals.mjs's shape)
// laid on a wall at the front and the ground before it, drawn through
// src/lib/three/decals/decalScene.js with the wall and the ground as the
// cut's targets; its textures' `files` are fetched from the dev server
// (scripts/light-fixture.mjs --decals). probe.decals() reads its stats,
// probe.view('decals' | 'floor' | 'grazing') frames it.
//
// `hoth` (lane S's calibration shot): the same ground and ring under Hoth
// Sunny's record (src/lib/three/light/fixtures/hoth.ve.json), the ground
// snow, the ring's coloured lamps off, so its mean luminance stands beside
// lane G's calibrated classic Hoth (docs/superpowers/evidence/bf2017-light/).
// `shadows` (lane S's cascades): under Hoth's record, a 400 m strip of snow
// with a figure (a 1.8 m capsule) at 2, 20 and 60 m from the camera, a wall,
// and a post every 10 m out to 200 m for the cascades' far edge;
// `probe.view('near' | 'seam')` frames the figures or the far edge.
// `lightSun` drops the record's shadow sun, so the cascades cast along the
// light (the before of the shadow sun's shot). `clouds` swaps Hoth's
// secondary cloud layer for a test one (CLOUD_TEST: 80 m, coverage 1,
// exponent 1; not Hoth's, whose sunny sky is nearly clear) so the drift
// shows in a frame.
// `picture` (lane Q6, with `hoth`): the record's grade (src/lib/three/light/grade.js:
// its LUT, its five Gaussians, its HBAO numbers, a linear tone map), its
// painted panorama and fog gradient and its cloud-shadow texture, handed
// to applyGameLight as `picture` (the urls from the dev server);
// probe.view('horizon') looks along the ground to where the panorama meets
// the scattering.

import * as THREE from 'three';
import hothWeather from '../../lib/three/surface/fixtures/hoth.weather.json';
import hothVe from '../../lib/three/light/fixtures/hoth.ve.json';

// the snow's albedo under --hoth (fresh snow reflects 0.8 to 0.9; Hoth's
// ice field, worn, a little under)
const SNOW = 0xe4eaf0;
const CLOUD_TEST = { SecondaryCloudShadowSize: 80, SecondaryCloudShadowCoverage: 1, SecondaryCloudShadowExponent: 1 };

const RING = 200; // point lights round the ring
const SPOTS = 8;
const RADIUS = 14; // m

function ringLights() {
  const out = [];
  for (let i = 0; i < RING; i++) {
    const a = (i / RING) * Math.PI * 2;
    const hue = i / RING;
    const c = new THREE.Color().setHSL(hue, 0.8, 0.55);
    out.push({ kind: 'point', pos: [Math.cos(a) * RADIUS, 0.6 + (i % 3) * 0.7, Math.sin(a) * RADIUS], color: [c.r, c.g, c.b], candela: 6, range: 4 });
  }
  for (let i = 0; i < SPOTS; i++) {
    const a = (i / SPOTS) * Math.PI * 2;
    out.push({ kind: 'spot', pos: [Math.cos(a) * 6, 6, Math.sin(a) * 6], dir: [0, -1, 0], cone: [Math.PI / 8, Math.PI / 4], color: [1, 0.85, 0.6], candela: 400, range: 14 });
  }
  return out;
}

// A grading LUT as the game stores one (T_CC_*, 32³): a cool grade, the
// blues lifted and the reds held, so the pass shows (lane G brings the real
// ones)
function gradeLut(n = 32) {
  const data = new Uint8Array(n * n * n * 4);
  for (let b = 0, i = 0; b < n; b++) {
    for (let g = 0; g < n; g++) {
      for (let r = 0; r < n; r++, i += 4) {
        data[i] = Math.round((r / (n - 1)) * 0.94 * 255);
        data[i + 1] = Math.round((g / (n - 1)) * 255);
        data[i + 2] = Math.round(Math.min(1, (b / (n - 1)) * 1.06 + 0.02) * 255);
        data[i + 3] = 255;
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, n, n, n);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// a Hoth-ish clear day, in lane G's derived shape plus the record's fields
export const ENTRY = {
  sky: { suns: [{ az: 210, el: 24, color: [1, 0.93, 0.82] }], zenith: [0.22, 0.4, 0.75], horizon: [0.75, 0.8, 0.88] },
  light: { sun: 3, sky: [0.5, 0.6, 0.75], ground: [0.35, 0.33, 0.32], ambient: 0.35 },
  fog: { color: [0.72, 0.78, 0.86], density: 0.004 },
  exposure: 1,
  record: {
    Fog: { HeightFogBase: 0, HeightFogFalloff: 0.05 },
    DynamicAO: { HbaoRadius: 0.6, HbaoPowerExponent: 1.5 },
    Tonemap: { BloomScale: 1 },
  },
};

export default {
  id: 'fixture-lit',
  shading: 'nodes',
  mb: 0,
  create(rt) {
    const opts = { tier: 'ultra', env: true, post: true, sky: true, placed: true, ...(rt.fixture ?? {}) };
    if (opts.shadows || opts.clouds || opts.lightSun || opts.picture) opts.hoth = true;
    if (opts.hoth) opts.placed = false;
    let entry = opts.hoth ? hothVe.sunny : ENTRY;
    if (opts.clouds) {
      const outdoor = { ...entry.record.OutdoorLightComponentData[0], ...CLOUD_TEST };
      entry = { ...entry, record: { ...entry.record, OutdoorLightComponentData: [outdoor] } };
    }
    if (opts.lightSun) {
      const rest = { ...entry.record.OutdoorLightComponentData[0] };
      delete rest.ShadowSunRotationX;
      delete rest.ShadowSunRotationY;
      entry = { ...entry, record: { ...entry.record, OutdoorLightComponentData: [rest] } };
    }
    const renderer = rt.gfx.renderer;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0d12);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 800);
    camera.position.set(0, 7, 24);
    camera.lookAt(0, 1, 0);
    // (closer for the particles: a flake is 3 to 5 cm)
    if (opts.particles) {
      camera.position.set(0, 2.2, 7);
      camera.lookAt(0, 2.4, 0);
    }
    const camVel = new THREE.Vector3();

    const made = [];
    const mat = (o) => {
      const m = new THREE.MeshStandardMaterial(o);
      made.push(m);
      return m;
    };
    const geo = (g) => {
      made.push(g);
      return g;
    };
    // (lane S's shadows fixture stands on a long strip, its figures, wall, posts and boards down it)
    const ground = new THREE.Mesh(geo(opts.shadows ? new THREE.PlaneGeometry(60, 400) : new THREE.PlaneGeometry(200, 200)), mat({ color: opts.hoth ? SNOW : 0x9aa0a8, roughness: opts.hoth ? 0.8 : 0.55, metalness: 0.05 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const views = {};
    const figures = [];
    if (opts.shadows) {
      ground.position.z = -190;
      const cloth = mat({ color: 0x8a7a66, roughness: 0.8 });
      const figure = geo(new THREE.CapsuleGeometry(0.3, 1.2, 4, 12));
      for (const d of [2, 20, 60]) {
        const f = new THREE.Mesh(figure, cloth);
        f.position.set(0.6, 0.9, -d);
        f.castShadow = f.receiveShadow = true;
        scene.add(f);
        figures.push(f);
      }
      const wall = new THREE.Mesh(geo(new THREE.BoxGeometry(7, 3, 0.4)), mat({ color: 0xc8ccd2, roughness: 0.8 }));
      wall.position.set(-4.5, 1.5, -26);
      wall.castShadow = wall.receiveShadow = true;
      scene.add(wall);
      const post = geo(new THREE.BoxGeometry(0.5, 4, 0.5));
      const dark = mat({ color: 0x55585e, roughness: 0.8 });
      for (let z = 10; z <= 200; z += 10) {
        const p = new THREE.Mesh(post, dark);
        p.position.set(-9, 2, -z);
        p.castShadow = p.receiveShadow = true;
        scene.add(p);
      }
      // the penumbra: a board 1 m and one 10 m over the snow, each seen
      // from beside its shadow (the record's shadow sun stands at 82°, so
      // each shadow lies nearly under its board)
      const board = geo(new THREE.BoxGeometry(2, 0.1, 2));
      for (const [x, h] of [[8, 1], [16, 10]]) {
        const b = new THREE.Mesh(board, dark);
        b.position.set(x, h, -8);
        b.castShadow = true;
        scene.add(b);
      }
      // the 2 m figure's feet, close (contact shadows); the strip from high
      // over it (the cloud shadows)
      views.contact = { pos: [1.6, 0.9, -0.2], at: [0.6, 0, -2] };
      views.clouds = { pos: [0, 70, -40], at: [0, 0, -110] };
      views.pen1 = { pos: [8, 0.7, -4.5], at: [8, 0, -8] };
      views.pen10 = { pos: [16, 2.5, -4], at: [16, 0, -8] };
      // the feet at 2 m in the frame's foot, the 60 m figure under the horizon
      views.near = { pos: [0, 1.6, 0], at: [0, 0, -6] };
      // from above and behind: the post row's shadows out past the cascades' far edge
      views.seam = { pos: [6, 26, 10], at: [-6, 0, -110] };
      camera.position.set(...views.near.pos);
      camera.lookAt(...views.near.at);
    }
    // (lane Q6) along the snow toward the record's sun's side, the horizon
    // at the frame's middle: where the painted sky meets the scattering
    views.horizon = { pos: [0, 1.7, 30], at: [-30, 1.7, 60] };
    // (and from high over the ring: the record's cloud texture on the snow)
    views.cloudTex = { pos: [0, 90, 60], at: [0, 0, -40] };
    const pillar = geo(new THREE.BoxGeometry(1, 5, 1));
    const ball = geo(new THREE.SphereGeometry(0.9, 32, 16));
    const stone = mat({ color: 0xd8d2c8, roughness: 0.7 });
    const chrome = mat({ color: 0xffffff, roughness: 0.08, metalness: 1 });
    for (let i = 0; i < (opts.shadows ? 0 : 12); i++) {
      const a = (i / 12) * Math.PI * 2;
      const p = new THREE.Mesh(pillar, stone);
      p.position.set(Math.cos(a) * 10, 2.5, Math.sin(a) * 10);
      p.castShadow = p.receiveShadow = true;
      const b = new THREE.Mesh(ball, i % 2 ? chrome : stone);
      b.position.set(Math.cos(a + 0.26) * 5, 0.9, Math.sin(a + 0.26) * 5);
      b.castShadow = b.receiveShadow = true;
      scene.add(p, b);
    }
    const cube = new THREE.Mesh(geo(new THREE.BoxGeometry(2, 2, 2)), mat({ color: 0x4488ff, roughness: 0.3 }));
    cube.position.y = 1.6;
    cube.castShadow = cube.receiveShadow = true;
    if (!opts.shadows) scene.add(cube);

    let post = null;
    let envTex = null;
    let light = null;
    let grid = null;
    let snow = null;
    let decals = null;
    // the ring as a level's lights.json, so the pools are filled the way a
    // level's are: the cells round the camera, the best by screen area
    const source = { cells: {} };
    for (const l of ringLights()) (source.cells[`${Math.floor(l.pos[0] / 128)},${Math.floor(l.pos[2] / 128)}`] ??= []).push(l);
    const first = Object.values(source.cells).find((c) => c.length)[0];
    const home = first.pos.slice();
    const probe = {
      backend: rt.gfx.backend,
      light: null,
      passes: [],
      programs: () => countPrograms(renderer),
      csm: () => light?.parts.sun.csm ?? null,
      // the weather's clock run on by `seconds` (the clouds drift)
      advance(seconds) {
        light?.update(seconds, camera);
      },
      // the contact shadows shown or hidden (their before)
      contact(on) {
        for (const p of light?.parts.contact.planes ?? []) p.material.visible = on;
      },
      // (lane Q6) the post chain on or off without rebuilding it: the sky's
      // horizon measured under the same output transform either way
      setPost(on) {
        opts.post = on;
      },
      // the environment on or off, for A2's two shots
      setEnv(on) {
        scene.environment = on ? envTex : null;
        scene.environmentIntensity = 0.5;
      },
      // one placed light moved and recoloured in place
      nudge(t) {
        Object.assign(first, { pos: [home[0] + Math.cos(t) * 2, home[1], home[2] + Math.sin(t) * 2], color: [1, 0.2, 0.1] });
        light?.update(0, camera);
      },
      // A3: an arena-sized probe grid (Hoth's 1,536 m), made and baked; the
      // caller waits on the GPU and times it
      // (lane Q4) the weather's accumulation at t seconds
      setWeather(t) {
        return snow?.setTime(t) ?? null;
      },
      // (jitter: metres the camera is raised, for the grazing pair; lane S's
      // `shadows` framings are in `views`, the camera moved and the light
      // told; lane Q1's `materials` framings in VIEWS; then Q4's)
      view(name, jitter = 0) {
        const v = views[name];
        if (v) {
          camera.position.set(...v.pos);
          camera.lookAt(...v.at);
          camera.updateMatrixWorld();
          light?.update(0, camera);
          return true;
        }
        const q1 = opts.materials ? VIEWS[name] : null;
        if (q1) {
          camera.position.set(...q1.from);
          camera.lookAt(...q1.at);
          return true;
        }
        if (name === 'crate') camera.position.set(0.2, 2.1, 20), camera.lookAt(0.2, 0.7, 16);
        else if (name === 'decals') camera.position.set(0, 3.6, 15.2), camera.lookAt(0, 1.4, 24.5);
        else if (name === 'floor') camera.position.set(0, 13, 17.5), camera.lookAt(0, 0, 22.5);
        else if (name === 'grazing') camera.position.set(-8.6, 0.9 + jitter, 23.4), camera.lookAt(5, 1.4, 25.6);
        else camera.position.set(0, 7, 24), camera.lookAt(0, 1, 0);
      },
      showDecals(on) {
        decals?.setVisible(on);
      },
      decals() {
        if (!decals) return null;
        const s = decals.stats();
        return { ...s, count: opts.decals.count, kinds: opts.decals.kinds };
      },
      async bakeGrid() {
        const { createProbeGrid, PROBE_GRID } = await import('../../lib/three/light/probes.js');
        grid ??= await createProbeGrid(scene, renderer, { min: [-768, -5, -768], max: [768, 60, 768] }, PROBE_GRID);
        return grid.bake();
      },
    };

    let row = null;
    if (opts.materials) {
      for (const o of [...scene.children]) if (o !== ground) o.visible = false;
      row = recipeRow(scene, renderer, opts.materials, opts.tier, made);
      probe.view('row');
      probe.recipes = () => row.then((r) => r.map((c) => ({ label: c.label, features: c.features })));
    }

    const ready = (async () => {
      await row;
      const { applyGameLight } = await import('../../lib/three/light/apply.js');
      // (Hoth's own LUT comes with `picture`: the cool test grade only without it)
      light = await applyGameLight(scene, renderer, entry, { tier: opts.tier, camera, lights: opts.placed ? source : null, clustered: opts.clustered, sky: opts.sky, post: opts.post, lut: opts.picture ? null : gradeLut(), filter: opts.filter, picture: opts.picture ?? null });
      probe.light = { clustered: light.parts.placed?.clustered ?? null };
      probe.grade = light.parts.grade ?? null;
      // (lane S's shadow figures: the contact pass follows them)
      for (const f of figures) light.track?.(f);
      if (!opts.sky) {
        const [{ PMREMGenerator }, { RoomEnvironment }] = await Promise.all([import('three/webgpu'), import('three/addons/environments/RoomEnvironment.js')]);
        const pmrem = new PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
      }
      if (opts.weather != null) snow = await weatherCrates(scene, made, opts.weather);
      if (opts.decals) decals = await decalWall(scene, made, renderer, ground, opts.decals, opts.tier);
      if (opts.particles) {
        const { createParticleProbe } = await import('./particleProbe.js');
        probe.particles = await createParticleProbe({ scene, renderer, camera, light, tier: opts.tier });
        probe.particles.warm(6);
        // a pan for the streaks: the camera moved sideways at `speed` m/s
        probe.pan = (speed) => {
          camVel.set(speed, 0, 0);
        };
      }
      envTex = scene.environment;
      probe.setEnv(opts.env);
      light.update(0, camera);
      if (light.passes.length) {
        // (`only`: the passes kept, for finding which one breaks)
        let passes = opts.only ? light.passes.filter((p) => opts.only.includes(p.kind)) : light.passes;
        // (`upscale`, fidelity lane U: { kind, scale }, the picture drawn under the screen and brought up)
        if (opts.upscale) passes = (await import('../../lib/three/light/post.js')).upscaled(passes, opts.upscale);
        post = rt.gfx.post(passes);
        probe.passes = passes.map((p) => p.kind);
        await post.ready;
      }
      await rt.gfx.compile(scene, camera);
    })();

    return {
      ready,
      probe,
      resize(w, h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      },
      step(dt) {
        cube.rotation.y += dt;
        if (camVel.x) camera.position.addScaledVector(camVel, dt);
        probe.particles?.step(dt);
        light?.update(dt, camera);
      },
      draw({ renderer: r }) {
        if (post && opts.post) post.render();
        else r.render(scene, camera);
      },
      wants: () => true,
      dispose() {
        post?.dispose();
        grid?.dispose();
        light?.dispose();
        decals?.dispose();
        probe.particles?.dispose();
        if (!opts.sky) envTex?.dispose();
        for (const m of made) m.dispose();
      },
    };
  },
};

// ---- lane Q1's recipe cubes and wall

// (both from the sun's side: ENTRY's sun is at az 210°, toward −z)
const VIEWS = {
  row: { from: [0, 1.9, -7], at: [0, 0.6, 0] },
  // the wall at 2 m, a little off square so the grain catches the sun
  wall: { from: [0.4, 1.3, 4], at: [0, 1.2, 6] },
};
// ENTRY's sun (az 210°, el 24°) as a direction toward it, for the
// translucency and the hair's lobes
const SUN = { direction: [Math.sin((210 * Math.PI) / 180) * Math.cos((24 * Math.PI) / 180), Math.sin((24 * Math.PI) / 180), Math.cos((210 * Math.PI) / 180) * Math.cos((24 * Math.PI) / 180)], color: [1, 0.93, 0.82] };
const CUBE = 1.1; // m
const SPACING = 1.6; // m
const WALL = [4, 2.5]; // m

// the GLB's material whose shader the recipe names (the export's extras),
// else its first
function glbMaterial(gltf, recipe) {
  let first = null;
  let match = null;
  gltf.scene.traverse((o) => {
    for (const m of o.isMesh ? [o.material].flat() : []) {
      first ??= m;
      if (!match && recipe.shader && m.userData?.shader === recipe.shader) match = m;
    }
  });
  return match ?? first ?? new THREE.MeshStandardMaterial({ color: 0x808080 });
}

async function recipeRow(scene, renderer, { mode = 'game', list = [] }, tier, made) {
  const [{ gltfLoader, ktx2Loader }, { loadSurfaceMaterial }] = await Promise.all([import('../../lib/three/gltf.js'), import('../../lib/three/surface/hair.js')]);
  const ktx2 = await ktx2Loader({ renderer });
  const make = await loadSurfaceMaterial();
  const box = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  made.push(box);
  const out = [];
  const x0 = -((list.length - 1) * SPACING) / 2;
  for (const [i, entry] of list.entries()) {
    const gltf = entry.glb ? await gltfLoader().loadAsync(entry.glb) : null;
    const glb = gltf ? glbMaterial(gltf, entry.recipe) : new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.6 });
    const maps = { glb };
    for (const [k, url] of Object.entries(entry.maps ?? {})) maps[k] = Array.isArray(url) ? await Promise.all(url.map((u) => ktx2.loadAsync(u))) : url ? await ktx2.loadAsync(url) : null;
    const material = mode === 'glb' ? glb : make(entry.recipe, maps, { tier, sun: SUN });
    made.push(material);
    const cube = new THREE.Mesh(box, material);
    cube.position.set(x0 + i * SPACING, CUBE / 2 + 0.05, 0);
    cube.rotation.y = Math.PI / 6;
    cube.castShadow = cube.receiveShadow = true;
    scene.add(cube);
    if (i === 0) {
      const plane = new THREE.PlaneGeometry(...WALL);
      made.push(plane);
      // (its UVs a unit a metre, as a panel set's wall repeats its sheet)
      const uvs = plane.attributes.uv;
      for (let k = 0; k < uvs.count; k++) uvs.setXY(k, uvs.getX(k) * WALL[0], uvs.getY(k) * WALL[1]);
      const wall = new THREE.Mesh(plane, material);
      // (facing −z, the sun's side)
      wall.position.set(0, WALL[1] / 2, 6);
      wall.rotation.y = Math.PI;
      wall.receiveShadow = true;
      scene.add(wall);
    }
    out.push({ label: entry.label, features: material.userData?.game?.features ?? [] });
  }
  return out;
}

// Lane Q4's crates: the snow contributor over a plain node material, the
// running channels its base. One flat and one tilted 50° (a normal's y of
// 0.64: part way up the band) that allow weather (ESB_TopDirt), one flat
// that does not
async function weatherCrates(scene, made, seconds) {
  const [{ loadThree }, { overlaysFor }] = await Promise.all([import('../../lib/three/light/three.js'), import('../../lib/three/surface/weather.js')]);
  const { THREE: N, tsl } = await loadThree();
  const [snow] = overlaysFor(hothWeather, 'snow', { tsl });
  snow.setTime(seconds);
  const box = new N.BoxGeometry(1.4, 1.2, 1.4);
  made.push(box);
  const crate = (weather, at, tilt) => {
    const base = { color: tsl.vec3(0.32, 0.22, 0.13), roughness: tsl.float(0.72), metalness: tsl.float(0), normal: tsl.normalView };
    const parts = snow({ uv: tsl.uv(), worldNormal: tsl.normalWorld, worldPosition: tsl.positionWorld, skyVisibility: 1, ...base, params: { weather }, maps: {} });
    const m = new N.MeshStandardNodeMaterial();
    for (const c of ['color', 'roughness', 'metalness', 'normal']) m[`${c}Node`] = parts[c] ?? base[c];
    made.push(m);
    const mesh = new N.Mesh(box, m);
    mesh.position.set(at, 0.6, 16);
    mesh.rotation.z = tilt;
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  };
  crate({ top: true }, -1.8, 0);
  crate({ top: true }, 0.2, (50 * Math.PI) / 180);
  crate({ use: false }, 2.2, 0);
  return snow;
}

// Lane Q4's wall: 12 × 5 m behind the ring, its face at z = 25.8 turned
// toward the sun (so the ground before it is lit); the decals cut from it
// and from the ground, cell by cell
async function decalWall(scene, made, renderer, ground, pack, tier) {
  const [{ createDecals }, { ktx2Loader }, { backendOf }] = await Promise.all([import('../../lib/three/decals/decalScene.js'), import('../../lib/three/gltf.js'), import('../../lib/three/light/three.js')]);
  const geo = new THREE.BoxGeometry(12, 5, 0.4);
  const mat = new THREE.MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.85 });
  made.push(geo, mat);
  const wall = new THREE.Mesh(geo, mat);
  wall.position.set(0, 2.5, 26);
  wall.castShadow = wall.receiveShadow = true;
  scene.add(wall);
  scene.updateMatrixWorld(true);
  const targets = [wall, ground].map((m) => ({ geometry: m.geometry, matrix: m.matrixWorld.clone() }));
  const ktx = await ktx2Loader({ renderer });
  const decals = createDecals({ scene, pack, tier, backend: backendOf(renderer), loader: (name, file) => ktx.loadAsync(`/${file}`) });
  await Promise.all(Object.keys(pack.cells).map((k) => decals.cell(...k.split(',').map(Number), targets)));
  return decals;
}

// how many render pipelines the node renderer has built: a recompile adds one
function countPrograms(renderer) {
  const p = renderer?._pipelines;
  if (!p) return null;
  return (p.caches?.size ?? 0) + (p.programs?.vertex?.size ?? 0) + (p.programs?.fragment?.size ?? 0);
}
