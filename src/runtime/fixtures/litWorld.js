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
// rt.fixture: { tier = 'ultra', env = true, post = true, sky = true, placed = true, clustered, only, particles }
//
// `particles` (fidelity lane X): the game's effects from their emitter
// tables over the ring, and the GPU twin's parity (particleProbe.js), read
// by scripts/light-fixture.mjs --particles as `probe.particles`.

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

    const ready = (async () => {
      const { applyGameLight } = await import('../../lib/three/light/apply.js');
      light = await applyGameLight(scene, renderer, ENTRY, { tier: opts.tier, camera, lights: opts.placed ? source : null, clustered: opts.clustered, sky: opts.sky, post: opts.post, lut: gradeLut() });
      probe.light = { clustered: light.parts.placed?.clustered ?? null };
      if (!opts.sky) {
        const [{ PMREMGenerator }, { RoomEnvironment }] = await Promise.all([import('three/webgpu'), import('three/addons/environments/RoomEnvironment.js')]);
        const pmrem = new PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
      }
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
        probe.particles?.dispose();
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
