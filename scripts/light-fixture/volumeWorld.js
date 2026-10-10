// Lane V's fixture (scripts/light-fixture.mjs --volume): a hangar the size
// of a bay of Hoth's, six of Hoth's light cones standing on its floor and a
// figure walking through one, under the game's Hoth interior weather, all
// through applyGameLight with a volumes.json and a lights.json of the
// level's shape (src/lib/three/light/volumetrics.js).
//
// The cones are Hoth's own as scripts/bf2017-volumes.mjs reads them: four
// FX_Arctic_LightCone_04 (2 m × 5 m, its emitter's grey) and two _02
// (1.5 m, its blue); three of them have a ceiling spot over their apex
// (Hoth's hangar spot: 65,500 lm, a 90° cone, its blue-white), so they are
// lit by it and the figure's shadow cuts them; the other three glow by
// their emission. One of Hoth's SimpleVolumetrics glows (7.2 m,
// EmissionScale 0.2) hangs by the door.
//
// weathers (`weather`): 'interior' (Hoth's, the default), 'sunny' (Hoth's
// day: no forward scattering, Presence 0) and 'felucia' (Hoth's day with
// Felucia's day's fog record in place of its own: the forward scattering at
// Presence 0.956, the strongest of the game's MP records. Hoth's Blizzard
// has no VisualEnvironment record in the export, only a LUT).
//
// views: 'wide' (from the door), 'edge' (the figure's edge inside a lit
// cone), 'sun' (outside the mouth, toward the sun over the hangar);
// pan(t): from 36 m off the hangar's +X wall to 27 m, looking at the sun
// (Hoth's day: 33° up, toward −X), so the wall's top rises over it (the
// sun flare's occluder curve)

import * as THREE from 'three';
import hoth from '../../src/lib/three/light/fixtures/hoth.ve.json';
import media from '../../src/lib/three/light/fixtures/fog.media.json';

const WEATHERS = {
  interior: hoth.interior,
  sunny: hoth.sunny,
  felucia: { ...hoth.sunny, record: { ...hoth.sunny.record, FogComponentData: [media.felucia.FogComponentData[0]] } },
};

const CONE_04 = { kind: 'cone', quat: [0, 0, 0, 1], scale: [2, 5, 2], color: [0.2438, 0.2462, 0.2237], exponent: 2.113, emission: 1, fade: [17, 20] };
const CONE_02 = { kind: 'cone', quat: [0, 0, 0, 1], scale: [1.5, 1.5, 1.5], color: [0.5873, 1.0699, 1.8233], exponent: 2.113, emission: 1, fade: [17, 20] };
const BOX = { kind: 'box', quat: [0, 0, 0, 1], scale: [7.204, 7.204, 7.204], color: [0.8952, 1.2139, 1.5], exponent: 2, emission: 0.2 };
// Hoth's hangar spot (lights.json's reading of its first spot): 65,500 lm × the colour's peak 60.34 over a 90° cone
const SPOT_CD = (65500 * 60.3398) / (2 * Math.PI * (1 - Math.cos(Math.PI / 4)));
const spotOver = (c) => ({ kind: 'spot', pos: [c.pos[0], c.pos[1] + c.scale[1] + 0.3, c.pos[2]], dir: [0, -1, 0], cone: [(70 * Math.PI) / 180, Math.PI / 2], color: [0.64, 0.7358, 1], candela: SPOT_CD, range: 20 });

const VOLUMES = [
  { ...CONE_04, pos: [-6, 0, -4] },
  { ...CONE_04, pos: [0, 0, -4] },
  { ...CONE_04, pos: [6, 0, -4] },
  { ...CONE_04, pos: [-3, 0, 3] },
  { ...CONE_02, pos: [3, 0, 3] },
  { ...CONE_02, pos: [9, 0, 2] },
  { ...BOX, pos: [-10, 4, 8] },
];
const LIT = [0, 1, 4]; // the cones with a spot over them

export default {
  id: 'fixture-volume',
  shading: 'nodes',
  mb: 0,
  create(rt) {
    const opts = { tier: 'ultra', post: true, ...(rt.fixture ?? {}) };
    const renderer = rt.gfx.renderer;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070a);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
    const made = [];
    const mat = (o) => (made.push(new THREE.MeshStandardMaterial(o)), made.at(-1));
    const geo = (g) => (made.push(g), g);

    // the hangar: a floor, three walls and a roof, open toward +Z
    const concrete = mat({ color: 0x8a8f96, roughness: 0.8 });
    const add = (g, m, x, y, z) => {
      const o = new THREE.Mesh(geo(g), m);
      o.position.set(x, y, z);
      o.castShadow = o.receiveShadow = true;
      scene.add(o);
      return o;
    };
    add(new THREE.BoxGeometry(40, 0.2, 30), concrete, 0, -0.1, 0);
    add(new THREE.BoxGeometry(40, 0.4, 30), concrete, 0, 8.2, 0);
    add(new THREE.BoxGeometry(0.4, 8, 30), concrete, -20, 4, 0);
    add(new THREE.BoxGeometry(0.4, 8, 30), concrete, 20, 4, 0);
    add(new THREE.BoxGeometry(40, 8, 0.4), concrete, 0, 4, -15);
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(1.2, 2.4, 1.2), mat({ color: 0x5b6470, roughness: 0.5 }), -12 + i * 7, 1.2, -9);
    // the figure: a trooper's height
    const figure = add(new THREE.CapsuleGeometry(0.3, 1.2, 6, 12), mat({ color: 0xe8e8e8, roughness: 0.4 }), -1, 0.9, -4);

    const source = { cells: { '0,0': [], '-1,0': [], '0,-1': [], '-1,-1': [] } };
    for (const v of VOLUMES) source.cells[`${Math.floor(v.pos[0] / 128)},${Math.floor(v.pos[2] / 128)}`].push(v);
    const lights = { cells: { '0,0': [], '-1,0': [], '0,-1': [], '-1,-1': [] } };
    for (const i of LIT) {
      const s = spotOver(VOLUMES[i]);
      lights.cells[`${Math.floor(s.pos[0] / 128)},${Math.floor(s.pos[2] / 128)}`].push(s);
    }

    const views = {
      wide: () => {
        camera.position.set(2, 3.2, 16);
        camera.lookAt(0, 2.2, -3);
      },
      sun: () => {
        camera.position.set(0, 2, 30);
        const d = sunAt();
        camera.lookAt(camera.position.x + d[0] * 100, 2 + Math.max(0.2, d[1]) * 100, camera.position.z + d[2] * 100);
      },
      edge: () => {
        camera.position.set(-1.2, 1.6, 2.2);
        camera.lookAt(figure.position.x, 1.6, figure.position.z);
      },
    };
    const entry = WEATHERS[opts.weather ?? 'interior'];
    let sunAt = () => [0, 0.5, -1];
    views[opts.view ?? 'wide']();

    let post = null;
    let light = null;
    let env = null;
    let walk = 0;
    const place = (t) => {
      figure.position.x = -1 + Math.sin(t) * 0.6;
    };
    const probe = {
      backend: rt.gfx.backend,
      light: null,
      passes: [],
      programs: () => {
        const p = renderer?._pipelines;
        return p ? (p.caches?.size ?? 0) + (p.programs?.vertex?.size ?? 0) + (p.programs?.fragment?.size ?? 0) : null;
      },
      setEnv(on) {
        scene.environment = on ? env : null;
      },
      // the figure walks through its cone: the volumes recompile nothing
      nudge(t) {
        place(t);
        light?.update(0, camera);
      },
      view(name) {
        views[name]();
        camera.updateMatrixWorld();
        light?.update(0, camera);
      },
      lit: () => light?.parts.volumetrics?.lit ?? 0,
      pan(t) {
        const d = sunAt();
        camera.position.set(36 - 9 * t, 1.5, 0);
        camera.lookAt(camera.position.x + d[0] * 100, 1.5 + d[1] * 100, d[2] * 100);
        camera.updateMatrixWorld();
        light?.update(0, camera);
      },
    };

    const ready = (async () => {
      const [{ applyGameLight }, { PMREMGenerator }, { RoomEnvironment }] = await Promise.all([import('../../src/lib/three/light/apply.js'), import('three/webgpu'), import('three/addons/environments/RoomEnvironment.js')]);
      light = await applyGameLight(scene, renderer, entry, { tier: opts.tier, camera, lights, volumetrics: opts.volume === false ? null : source, sky: entry !== hoth.interior, post: opts.post });
      sunAt = () => light.params.sun.dir;
      views[opts.view ?? 'wide']();
      probe.light = { clustered: light.parts.placed?.clustered ?? null };
      const pmrem = new PMREMGenerator(renderer);
      if (entry === hoth.interior) {
        env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = env;
        scene.environmentIntensity = 0.15;
      } else env = scene.environment;
      pmrem.dispose();
      camera.updateMatrixWorld();
      light.update(0, camera);
      if (light.passes.length) {
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
        walk += dt;
        place(walk);
        light?.update(dt, camera);
      },
      draw({ renderer: r }) {
        if (post && opts.post) post.render();
        else r.render(scene, camera);
      },
      wants: () => true,
      dispose() {
        post?.dispose();
        light?.dispose();
        if (entry === hoth.interior) env?.dispose();
        for (const m of made) m.dispose();
      },
    };
  },
};
