// GPU-first lane N3 on the lit fixture (litWorld.js): the three distances of
// light where scripts/light-fixture.mjs can shoot and measure them.
//
// - `baked` (true | false, with `hoth`): the ground as a node material with
//   a second uv set, and with `true` the fixture's Enlighten stand-in
//   (./enlighten/, scripts/desktop/bf2017-lightmaps.mjs --dry --size 256) as its diffuse indirect
//   light through light/baked.js, calibrated by lane S's calibrate.js; with
//   `false` the same ground without it (the before).
// - `gridBudget` (true): the budgeted probe grid (light/probes.js), two
//   cascades round the camera, a few probes a frame; probe.n3.grid() its stats.
// - `cadence` (true, with `shadows`): the sun's far cascades on their cadence
//   (light/sun.js), the figures tracked and walked away from the camera;
//   probe.n3.feet() each figure's shadow and an open patch beside it, in
//   canvas pixels, for the script's per-frame check; probe.n3.draws() the
//   cascades' draws.
// It keeps the 'nodes' promise: node materials only.
//
// setupN3({ scene, renderer, camera, light, ground, figures, entry, opts }) → Promise<{ step(dt), probe }>

import meta from './enlighten/fixture.json';

// the fixture's maps, by the names its rows give
const URLS = {
  'irradiance.png': new URL('./enlighten/irradiance.png', import.meta.url).href,
  'dirR.png': new URL('./enlighten/dirR.png', import.meta.url).href,
  'dirG.png': new URL('./enlighten/dirG.png', import.meta.url).href,
  'dirB.png': new URL('./enlighten/dirB.png', import.meta.url).href,
  'sky.png': new URL('./enlighten/sky.png', import.meta.url).href,
};
const WALK = 30; // m/s: the figures' run out of the near cascades (the stress case: a speeder's pace, so 90 frames cross a cascade's edge)

// A PNG's 8-bit pixels, as the file has them (no premultiplying, no colour conversion)
async function pixels(url) {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  return { data: g.getImageData(0, 0, bmp.width, bmp.height).data, w: bmp.width, h: bmp.height };
}

// a fixture map as a texture: the irradiance decoded to half floats in the
// record's units (fixture.json's sqrt encoding × peak), the rest as they are
async function loadMap(THREE, name, key) {
  const { data, w, h } = await pixels(URLS[name]);
  let tex;
  if (key === 'irradiance') {
    const out = new Uint16Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      for (let c = 0; c < 3; c++) out[i * 4 + c] = THREE.DataUtils.toHalfFloat((data[i * 4 + c] / 255) ** 2 * meta.peak);
      out[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
    }
    tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  } else tex = new THREE.DataTexture(new Uint8Array(data), w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export async function setupN3({ scene, renderer, camera, light, ground, figures, entry, opts }) {
  const three = await (await import('../../lib/three/light/three.js')).loadThree();
  const { THREE } = three;
  const steps = [];
  const probe = {};
  const made = [];

  if (opts.baked != null) {
    // the ground as a node material (the same colour, roughness and metal) with a second uv set
    const was = ground.material;
    const m = new THREE.MeshStandardNodeMaterial({ color: was.color, roughness: was.roughness, metalness: was.metalness });
    made.push(m);
    ground.geometry.setAttribute('uv1', ground.geometry.attributes.uv.clone());
    ground.material = m;
    let baked = null;
    if (opts.baked) {
      const [{ chartOf, createBaked, withBaked }, { calibrate }] = await Promise.all([import('../../lib/three/light/baked.js'), import('../../lib/three/light/calibrate.js')]);
      baked = await createBaked(renderer, meta.rows, { loadTexture: (name, key) => loadMap(THREE, name, key), calibrate: calibrate(entry.record) });
      if (baked) withBaked(m, baked, { chart: chartOf(meta.rows[0], 'ground'), three });
    }
    probe.baked = () => (baked ? { set: baked.set, scale: baked.scale, directional: baked.directional, peak: meta.peak } : null);
    made.push({ dispose: () => baked?.dispose() });
  }

  if (opts.gridBudget) {
    const { createProbeGrid, PROBE_GRID } = await import('../../lib/three/light/probes.js');
    const grid = await createProbeGrid(scene, renderer, null, PROBE_GRID, { budget: {}, far: 200 });
    steps.push((dt) => grid.update(camera, dt));
    probe.grid = () => grid.stats();
    made.push(grid);
  }

  if (opts.cadence) {
    const sun = light.parts.sun;
    for (const f of figures) light.track(f);
    let walking = false;
    probe.walk = (on) => (walking = on);
    probe.draws = () => sun.csm?.draws.slice() ?? null;
    steps.push((dt) => {
      if (walking) for (const f of figures) f.position.z -= WALK * dt;
    });
    // each figure's shadow (its middle cast to the snow along the shadow sun)
    // and a patch of open snow beside it, in canvas pixels
    const v = new THREE.Vector3();
    probe.feet = (w, h) =>
      figures.map((f) => {
        const d = sun.shadowDir;
        const s = new THREE.Vector3(f.position.x, f.position.y, f.position.z).addScaledVector(d, -f.position.y / d.y);
        s.y = 0.01;
        const side = new THREE.Vector3(-d.z, 0, d.x).normalize();
        const open = s.clone().addScaledVector(side, 2.5);
        const px = (p) => {
          v.copy(p).project(camera);
          return [Math.round((v.x * 0.5 + 0.5) * w), Math.round((-v.y * 0.5 + 0.5) * h), v.z < 1];
        };
        return { z: f.position.z, shadow: px(s), open: px(open) };
      });
  }

  return {
    probe,
    step(dt) {
      for (const s of steps) s(dt);
    },
    dispose() {
      for (const m of made) m.dispose();
    },
  };
}
