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
// rt.fixture: { tier = 'ultra', env = true, post = true, sky = true, placed = true, clustered, only, hoth, shadows, lightSun, clouds, filter }
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

import * as THREE from 'three';
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
    if (opts.shadows || opts.clouds || opts.lightSun) opts.hoth = true;
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
      // a named framing (`shadows`): the camera moved, the light told
      view(name) {
        const v = views[name];
        if (!v) return false;
        camera.position.set(...v.pos);
        camera.lookAt(...v.at);
        camera.updateMatrixWorld();
        light?.update(0, camera);
        return true;
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
      async bakeGrid() {
        const { createProbeGrid, PROBE_GRID } = await import('../../lib/three/light/probes.js');
        grid ??= await createProbeGrid(scene, renderer, { min: [-768, -5, -768], max: [768, 60, 768] }, PROBE_GRID);
        return grid.bake();
      },
    };

    const ready = (async () => {
      const { applyGameLight } = await import('../../lib/three/light/apply.js');
      light = await applyGameLight(scene, renderer, entry, { tier: opts.tier, camera, lights: opts.placed ? source : null, clustered: opts.clustered, sky: opts.sky, post: opts.post, lut: gradeLut(), filter: opts.filter });
      probe.light = { clustered: light.parts.placed?.clustered ?? null };
      for (const f of figures) light.track(f);
      if (!opts.sky) {
        const [{ PMREMGenerator }, { RoomEnvironment }] = await Promise.all([import('three/webgpu'), import('three/addons/environments/RoomEnvironment.js')]);
        const pmrem = new PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
      }
      envTex = scene.environment;
      probe.setEnv(opts.env);
      light.update(0, camera);
      if (light.passes.length) {
        // (`only`: the passes kept, for finding which one breaks)
        const passes = opts.only ? light.passes.filter((p) => opts.only.includes(p.kind)) : light.passes;
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
        if (!opts.sky) envTex?.dispose();
        for (const m of made) m.dispose();
      },
    };
  },
};

// how many render pipelines the node renderer has built: a recompile adds one
function countPrograms(renderer) {
  const p = renderer?._pipelines;
  if (!p) return null;
  return (p.caches?.size ?? 0) + (p.programs?.vertex?.size ?? 0) + (p.programs?.fragment?.size ?? 0);
}
