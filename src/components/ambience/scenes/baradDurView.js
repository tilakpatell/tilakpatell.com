// Barad-dûr in the Mordor background (scenes/middleearth.js): the tower
// (./baradDur.js) as one faceted mesh, lit by the Eye between its horns, by
// Mount Doom’s fire low from the left and by the ash sky over the plain’s
// embers; and the Eye itself, sprites painted once (./sauronEye.js) that
// flicker by their scale and opacity and never repaint.
//
// What glows on the stone is its emissive map: a small table painted again
// only when the mode changes, read by the uv the tower is built with (u how
// much of the Eye’s fire falls there, v its height). So by day the haze
// thickens toward the plain and the fire is dim, and by night the stone is
// black with the Eye’s fire on the horns and a few windows burning, all for
// one draw and no shader of its own.
//
// The sprites and the tower draw between the backdrop’s two passes, so the
// near ridges stand in front of its foot (see middleearth.js).

import { buildBaradDur, HEAT_MAX } from './baradDur';
import { paintEye } from './sauronEye';

// where it stands, as shares of the screen: the Eye where the drawn one
// was, clear above the home page’s photo, its foot behind the near ridge
const FOOT = 0.02;
const EYE_AT = 0.78;
// a phone’s text runs edge to edge (ambience.css): the tower slimmer, in
// the margin at the right, its crown in the space beside the short title
const PHONE_EYE_AT = 0.77;
const PHONE_SLIM = 0.62;

// the glow table’s size: heat across, height down
const GW = 16;
const GH = 16;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// The light by mode. Day: an ash-grey haze over the plain, the tower a dark
// mass softened by it. Night: black stone, rimmed with Doom’s fire.
const LIGHT = {
  light: { sky: 0xe0d8cc, ground: 0x8a6c5a, hemi: 1.5, doom: 0xffa070, doomI: 1.3, eye: 0xff9a40, eyeI: 2.2, glow: 0.55 },
  dark: { sky: 0x2c3846, ground: 0x4a1a0c, hemi: 0.42, doom: 0xff5a1e, doomI: 2.4, eye: 0xff8a2a, eyeI: 4.5, glow: 1 },
};

// The glow table, linear colours: across, the stone’s heat from the Eye
// (to HEAT_MAX), then a window; down, the height, for the haze.
function paintGlow(THREE, data, dark) {
  for (let j = 0; j < GH; j++) {
    const h = (j + 0.5) / GH;
    for (let i = 0; i < GW; i++) {
      const u = (i + 0.5) / GW;
      let r;
      let g;
      let b;
      if (u > 0.85) {
        // a window slit, burning by night, all but dark by day
        [r, g, b] = dark ? [1.25, 0.42, 0.08] : [0.2, 0.06, 0.015];
      } else {
        const t = Math.pow(clamp01(u / HEAT_MAX), 1.8);
        [r, g, b] = dark ? [1.7 * t, 0.5 * t, 0.09 * t] : [0.95 * t, 0.3 * t, 0.06 * t];
      }
      // the haze: by day ash, thick at the plain and thin by the crown;
      // by night a red smoke off the plain’s fires about its foot
      const low = 1 - h;
      if (dark) {
        r += 0.05 * low ** 3 + 0.006;
        g += 0.013 * low ** 3 + 0.007;
        b += 0.004 * low ** 3 + 0.009;
      } else {
        const k = 0.07 + 0.5 * low ** 2;
        r += 0.44 * k;
        g += 0.41 * k;
        b += 0.38 * k;
      }
      const o = (j * GW + i) * 4;
      data[o] = THREE.DataUtils.toHalfFloat(r);
      data[o + 1] = THREE.DataUtils.toHalfFloat(g);
      data[o + 2] = THREE.DataUtils.toHalfFloat(b);
      data[o + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }
}

export function baradDurView(k) {
  const { THREE } = k;
  // the whole tower on a strong computer, about half its spikes and ribs
  // on anything else
  const t0 = performance.now();
  const { geometry, eyeAt } = buildBaradDur(THREE, { detail: k.tier === 'high' ? 1 : 0.5 });
  const buildMs = performance.now() - t0;

  const glowData = new Uint16Array(GW * GH * 4);
  const glow = new THREE.DataTexture(glowData, GW, GH, THREE.RGBAFormat, THREE.HalfFloatType);
  glow.magFilter = THREE.LinearFilter;
  glow.minFilter = THREE.LinearFilter;
  glow.colorSpace = THREE.LinearSRGBColorSpace;
  const stone = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.6,
    metalness: 0.3,
    emissive: 0xffffff,
    emissiveMap: glow,
    // drawn in order with the backdrop’s passes, not before them all
    transparent: true,
  });
  const tower = new THREE.Mesh(geometry, stone);
  tower.renderOrder = -8;
  const group = new THREE.Group();
  group.add(tower);
  k.scene.add(group);

  // the sky above and the embers below, Doom’s fire from the left and a
  // little behind (a rim on the faces that see it), the Eye’s own light
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
  const doom = new THREE.DirectionalLight(0xffffff, 1);
  doom.position.set(-1, 0.28, -0.85);
  const eyeLight = new THREE.PointLight(0xffffff, 1, 1, 1);
  k.scene.add(hemi, doom, doom.target, eyeLight);

  const eye = paintEye(THREE);
  for (const s of eye.sprites) k.scene.add(s);

  const at = { x: 0, y: 0, h: 1 };
  const eyeWorld = new THREE.Vector3();
  let mode = LIGHT.light;
  let shown = true;

  const view = {
    buildMs,
    // where the Eye is, in scene px (the beam is cast from it)
    eye: { x: 0, y: 0 },
    place(w, h) {
      const phone = w < 768;
      const slim = phone ? PHONE_SLIM : 1;
      const height = (h * ((phone ? PHONE_EYE_AT : EYE_AT) - FOOT)) / eyeAt.y;
      at.h = height;
      at.x = phone ? w / 2 - 40 : w * 0.37;
      at.y = -h / 2 + h * FOOT;
      group.scale.set(height * slim, height, height * slim);
      group.position.set(at.x, at.y, 0);
      // the Eye’s light reaches the crown and the top tiers
      eyeLight.distance = height * 0.42;
      eye.size(height, slim);
    },
    // look: where the Eye looks, -1..1; px: the pointer’s share across
    step(dt, t, look, px) {
      if (!shown) return;
      // a slow turn after the pointer, and a barely-there turn of its own,
      // so the light moves across its faces
      const yaw = px * 0.22 + Math.sin(t * 0.05) * 0.07;
      group.rotation.set(0, yaw, 0);
      group.updateMatrixWorld();
      eyeWorld.copy(eyeAt).applyMatrix4(group.matrixWorld);
      view.eye.x = eyeWorld.x;
      view.eye.y = eyeWorld.y;
      eyeLight.position.set(eyeWorld.x, eyeWorld.y, eyeWorld.z + at.h * 0.02);
      // the fire’s flicker, the same beat in the light and the sprites
      const f = 0.82 + 0.1 * Math.sin(t * 7.3) + 0.06 * Math.sin(t * 13.1 + 1.3) + 0.04 * Math.sin(t * 2.1);
      eyeLight.intensity = mode.eyeI * f;
      stone.emissiveIntensity = mode.glow * (0.9 + 0.1 * f);
      eye.step(t, f, view.eye, look);
    },
    recolor(dark) {
      mode = dark ? LIGHT.dark : LIGHT.light;
      hemi.color.setHex(mode.sky);
      hemi.groundColor.setHex(mode.ground);
      hemi.intensity = mode.hemi;
      doom.color.setHex(mode.doom);
      doom.intensity = mode.doomI;
      eyeLight.color.setHex(mode.eye);
      paintGlow(THREE, glowData, dark);
      glow.needsUpdate = true;
      eye.recolor(dark);
    },
    set visible(on) {
      shown = on;
      group.visible = on;
      hemi.visible = doom.visible = eyeLight.visible = on;
      for (const s of eye.sprites) s.visible = on;
    },
    // what it adds to a frame
    get info() {
      return { triangles: geometry.attributes.position.count / 3, draws: 1 + eye.sprites.length };
    },
    dispose() {
      glow.dispose();
      eye.dispose();
    },
  };
  return view;
}
