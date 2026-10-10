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
// rt.fixture: { tier = 'ultra', env = true, post = true, sky = true, placed = true, clustered, only, materials }
//
// `materials` (lane Q1, scripts/light-fixture.mjs --materials): { mode:
// 'game' | 'glb', list: [{ label, recipe, glb, maps: { detail: url, … } }] }:
// the ring and its things set aside, a cube per recipe wearing the game
// material over the GLB's own (mode 'glb': the GLB's material as it is) and
// a wall under the first recipe, seen from probe.view('row' | 'wall').

import * as THREE from 'three';

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
    const ground = new THREE.Mesh(geo(new THREE.PlaneGeometry(200, 200)), mat({ color: 0x9aa0a8, roughness: 0.55, metalness: 0.05 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const pillar = geo(new THREE.BoxGeometry(1, 5, 1));
    const ball = geo(new THREE.SphereGeometry(0.9, 32, 16));
    const stone = mat({ color: 0xd8d2c8, roughness: 0.7 });
    const chrome = mat({ color: 0xffffff, roughness: 0.08, metalness: 1 });
    for (let i = 0; i < 12; i++) {
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
    scene.add(cube);

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

    let row = null;
    if (opts.materials) {
      for (const o of [...scene.children]) if (o !== ground) o.visible = false;
      row = recipeRow(scene, renderer, opts.materials, opts.tier, made);
      probe.view = (name) => {
        const v = VIEWS[name];
        camera.position.set(...v.from);
        camera.lookAt(...v.at);
      };
      probe.view('row');
      probe.recipes = () => row.then((r) => r.map((c) => ({ label: c.label, features: c.features })));
    }

    const ready = (async () => {
      await row;
      const { applyGameLight } = await import('../../lib/three/light/apply.js');
      light = await applyGameLight(scene, renderer, ENTRY, { tier: opts.tier, camera, lights: opts.placed ? source : null, clustered: opts.clustered, sky: opts.sky, post: opts.post, lut: gradeLut() });
      probe.light = { clustered: light.parts.placed?.clustered ?? null };
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
    for (const [k, url] of Object.entries(entry.maps ?? {})) maps[k] = url ? await ktx2.loadAsync(url) : null;
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

// how many render pipelines the node renderer has built: a recompile adds one
function countPrograms(renderer) {
  const p = renderer?._pipelines;
  if (!p) return null;
  return (p.caches?.size ?? 0) + (p.programs?.vertex?.size ?? 0) + (p.programs?.fragment?.size ?? 0);
}
