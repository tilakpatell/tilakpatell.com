// The compound, the world: what his swinging looks like. The web from his
// hand to where it stuck (shot out in a blink, and loose for a moment after
// he lets go), a splash of web on whatever it stuck to, and, while he's in
// the air, a mark on the anchor a web shot now would catch, so you can see
// where the next swing will come from; and a mark on the perch a point
// launch (Q) would take him to. The swinging itself is in ./rules.js.
//
// createSwing(scene, { calm }) → { update(h, hand, aim, dt, perch),
// webbed(at), zipped(to), dispose }

import * as THREE from 'three';
import { canvasTexture } from '../hq/kit/shapes';

const Y = new THREE.Vector3(0, 1, 0);

// a splash of web: strands out from the middle, and rings of it across them
const splashTexture = () =>
  canvasTexture(256, 256, (x, w) => {
    const c = w / 2;
    x.clearRect(0, 0, w, w);
    x.strokeStyle = 'rgba(255,255,255,0.95)';
    x.lineCap = 'round';
    const spokes = 11;
    const ends = [];
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + Math.sin(i * 7.3) * 0.18;
      const r = c * (0.78 + 0.18 * Math.sin(i * 3.1));
      ends.push([a, r]);
      x.lineWidth = 3.2;
      x.beginPath();
      x.moveTo(c, c);
      x.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      x.stroke();
    }
    // the rings sag a little between the strands
    for (const k of [0.22, 0.42, 0.62]) {
      x.lineWidth = 2;
      x.beginPath();
      ends.forEach(([a, r], i) => {
        const [a2, r2] = ends[(i + 1) % spokes];
        const p0 = [c + Math.cos(a) * r * k, c + Math.sin(a) * r * k];
        const p1 = [c + Math.cos(a2) * r2 * k, c + Math.sin(a2) * r2 * k];
        const am = (a + (a2 < a ? a2 + Math.PI * 2 : a2)) / 2;
        const sag = ((r + r2) / 2) * k * 0.86;
        if (i === 0) x.moveTo(...p0);
        x.quadraticCurveTo(c + Math.cos(am) * sag, c + Math.sin(am) * sag, ...p1);
      });
      x.stroke();
    }
    const g = x.createRadialGradient(c, c, 0, c, c, c * 0.25);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
  });

// the mark on the perch a point launch goes to: a chevron over it
const perchTexture = () =>
  canvasTexture(128, 128, (x, w) => {
    const c = w / 2;
    x.clearRect(0, 0, w, w);
    x.strokeStyle = 'rgba(255,255,255,1)';
    x.lineWidth = 11;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    for (const y of [0.3, 0.62]) {
      x.beginPath();
      x.moveTo(c - c * 0.42, c * y + c * 0.26);
      x.lineTo(c, c * y);
      x.lineTo(c + c * 0.42, c * y + c * 0.26);
      x.stroke();
    }
  });

// the mark on the next anchor: a ring with four ticks
const markTexture = () =>
  canvasTexture(128, 128, (x, w) => {
    const c = w / 2;
    x.clearRect(0, 0, w, w);
    x.strokeStyle = 'rgba(255,255,255,1)';
    x.lineWidth = 7;
    x.beginPath();
    x.arc(c, c, c * 0.52, 0, Math.PI * 2);
    x.stroke();
    x.lineWidth = 9;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      x.beginPath();
      x.moveTo(c + Math.cos(a) * c * 0.66, c + Math.sin(a) * c * 0.66);
      x.lineTo(c + Math.cos(a) * c * 0.92, c + Math.sin(a) * c * 0.92);
      x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,1)';
    x.beginPath();
    x.arc(c, c, c * 0.12, 0, Math.PI * 2);
    x.fill();
  });

export function createSwing(scene, { calm = false } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  // the web: a thin line, stretched from his hand to the anchor
  // (lit, so it's shaded down one side and reads against a white wall as well as the sky)
  const webMat = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.45, metalness: 0, emissive: 0x9aa6b8, emissiveIntensity: 0.25, transparent: true, opacity: 1, depthWrite: false });
  // thicker at his hand, finer out at the anchor; in segments, so it can bend
  const webGeo = new THREE.CylinderGeometry(0.026, 0.042, 1, 8, 28, true).translate(0, 0.5, 0);
  // it bends as a rope does, in its own frame (x and z across it, in
  // metres; y along it, 0 at his hand to 1 at the far end): `uSag` hangs
  // it (most in the middle, none at the ends), and a ripple runs out along
  // it, `uWave` big, the way `uWaveDir` points
  const bend = { uSag: { value: new THREE.Vector2() }, uWave: { value: 0 }, uWaveDir: { value: new THREE.Vector2(1, 0) }, uRun: { value: 0 } };
  webMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, bend);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec2 uSag;\nuniform float uWave;\nuniform vec2 uWaveDir;\nuniform float uRun;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        float t = position.y;
        float bow = sin(3.14159265 * t);
        transformed.xz += uSag * bow;
        // the ripple: out from his hand, dying away toward the anchor
        transformed.xz += uWaveDir * sin(t * 22.0 - uRun) * bow * (1.0 - 0.6 * t) * uWave;
      }`,
    );
  };
  webMat.customProgramCacheKey = () => 'web-rope';
  const web = new THREE.Mesh(webGeo, webMat);
  web.visible = false;
  web.frustumCulled = false;
  web.renderOrder = 3;
  group.add(web);

  // a web zip's web: out ahead in a blink, and gone (straight: its own
  // material, without the bend)
  const zipMat = webMat.clone();
  zipMat.onBeforeCompile = () => {};
  zipMat.customProgramCacheKey = () => 'web-zip';
  const zipWeb = new THREE.Mesh(webGeo, zipMat);
  zipWeb.visible = false;
  zipWeb.frustumCulled = false;
  zipWeb.renderOrder = 3;
  group.add(zipWeb);
  const Z = { t: 1, to: new THREE.Vector3(), d: new THREE.Vector3() };

  // where webs have stuck: a few splashes, fading after a while
  const splashTex = splashTexture();
  const splashes = Array.from({ length: 8 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: splashTex, transparent: true, depthWrite: false, opacity: 0, fog: true }));
    s.visible = false;
    s.scale.setScalar(1.1);
    s.userData.age = 99;
    group.add(s);
    return s;
  });
  let nextSplash = 0;

  // the next anchor's mark, the same size on screen however far away it is
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTexture(), color: 0xff4b3e, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, opacity: 0, fog: false }));
  mark.renderOrder = 20;
  mark.scale.setScalar(0.042);
  group.add(mark);

  // the perch's mark: cyan, over the top of it, the same size on screen too
  const perchMark = new THREE.Sprite(new THREE.SpriteMaterial({ map: perchTexture(), color: 0x8fe9ff, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, opacity: 0, fog: false }));
  perchMark.renderOrder = 20;
  perchMark.scale.setScalar(0.04);
  group.add(perchMark);

  const W = { since: 9, run: 0, down: new THREE.Vector3(), inv: new THREE.Quaternion(), shot: 1, out: 0, at: new THREE.Vector3(), hand: new THREE.Vector3(), tip: new THREE.Vector3(), d: new THREE.Vector3(), seen: 0, markAt: new THREE.Vector3(), markK: 0, perchAt: new THREE.Vector3(), perchK: 0 };

  return {
    group,
    // a web just stuck at `at`
    webbed(at) {
      W.shot = 0;
      W.since = 0;
      // the ripple of this web, across it some way or other
      const a = Math.random() * Math.PI * 2;
      bend.uWaveDir.value.set(Math.cos(a), Math.sin(a));
      W.at.set(at[0], at[1], at[2]);
      const s = splashes[nextSplash];
      nextSplash = (nextSplash + 1) % splashes.length;
      s.position.copy(W.at);
      s.material.rotation = Math.random() * Math.PI * 2;
      s.userData.age = 0;
      s.visible = true;
    },
    // a web zip out to `to`
    zipped(to) {
      Z.t = 0;
      Z.to.set(to[0], to[1], to[2]);
    },
    // each frame: the hero (rules' state), his web hand (world), where a web
    // shot now would catch (rules' aimWeb), or null, and the perch a point
    // launch would go to (rules' findPerch), or null
    update(h, hand, aim, dt, perch = null) {
      // the web: out from his hand in a blink, held while he swings, and slack
      // and gone a moment after he lets it go
      W.hand.copy(hand);
      W.since += dt;
      if (h.web) {
        W.at.set(h.web.at[0], h.web.at[1], h.web.at[2]);
        W.shot = Math.min(1, W.shot + dt / (calm ? 0.02 : 0.07));
        W.out = 1;
      } else W.out = Math.max(0, W.out - dt * 3.2);
      web.visible = W.out > 0;
      if (web.visible) {
        const k = h.web ? 1 - (1 - W.shot) ** 2 : 1;
        W.tip.copy(W.hand).lerp(W.at, k);
        // let go: the loose end drops away from his hand
        if (!h.web) W.hand.y -= (1 - W.out) * 2.5;
        W.d.subVectors(h.web ? W.tip : W.at, W.hand);
        const len = W.d.length();
        web.position.copy(W.hand);
        if (len > 1e-3) web.quaternion.setFromUnitVectors(Y, W.d.multiplyScalar(1 / len));
        web.scale.set(1, Math.max(0.01, len), 1);
        webMat.opacity = W.out;
        // straight while it's taut, all but a little; a ripple out along it as
        // it's shot; and slack, hanging, once he's let go of it
        W.down.set(0, -1, 0).applyQuaternion(W.inv.copy(web.quaternion).invert());
        const sag = h.web ? Math.min(0.25, len * 0.006) : (1 - W.out) * Math.min(5, len * 0.18) + 0.1;
        bend.uSag.value.set(W.down.x, W.down.z).multiplyScalar(sag);
        bend.uWave.value = calm ? 0 : h.web ? 0.3 * Math.exp(-W.since * 6) : 0.12 * (1 - W.out);
        W.run += dt * 38;
        bend.uRun.value = W.run;
      }
      // the zip's web: shot out over a tenth of a second, then gone in a fifth
      Z.t += dt;
      zipWeb.visible = Z.t < 0.32;
      if (zipWeb.visible) {
        const out = Math.min(1, Z.t / 0.1);
        Z.d.subVectors(Z.to, hand).multiplyScalar(out);
        const l = Z.d.length();
        zipWeb.position.copy(hand);
        if (l > 1e-3) zipWeb.quaternion.setFromUnitVectors(Y, Z.d.multiplyScalar(1 / l));
        zipWeb.scale.set(0.8, Math.max(0.01, l), 0.8);
        zipWeb.material.opacity = 1 - Math.max(0, (Z.t - 0.12) / 0.2);
      }
      for (const s of splashes) {
        if (!s.visible) continue;
        s.userData.age += dt;
        const a = s.userData.age;
        s.material.opacity = Math.min(1, a * 12) * (1 - Math.max(0, (a - 4) / 2));
        s.scale.setScalar(0.6 + Math.min(1, a * 10) * 0.6);
        if (a > 6) s.visible = false;
      }
      // the mark: on the next anchor while he's in the air and not on a web
      const want = aim && !h.web && (h.mode === 'air' || h.mode === 'swing') ? 1 : 0;
      if (aim) W.markAt.set(aim.at[0], aim.at[1], aim.at[2]);
      W.markK += (want - W.markK) * Math.min(1, dt * 10);
      mark.visible = W.markK > 0.02;
      if (mark.visible) {
        mark.position.copy(W.markAt);
        mark.material.opacity = 0.9 * W.markK;
        mark.material.rotation += dt * 1.2;
        mark.scale.setScalar(0.034 + 0.008 * W.markK);
      }
      // the perch's mark: while there's one to launch to, and he isn't on his way to one
      const wantPerch = perch && h.mode !== 'zipto' ? 1 : 0;
      if (perch) W.perchAt.set(perch.x, perch.y + 1.1, perch.z);
      W.perchK += (wantPerch - W.perchK) * Math.min(1, dt * 10);
      perchMark.visible = W.perchK > 0.02;
      if (perchMark.visible) {
        perchMark.position.copy(W.perchAt);
        perchMark.position.y += Math.sin(performance.now() / 260) * 0.18;
        perchMark.material.opacity = 0.85 * W.perchK;
        perchMark.scale.setScalar(0.034 + 0.006 * W.perchK);
      }
    },
    dispose() {
      webGeo.dispose();
      webMat.dispose();
      zipMat.dispose();
      splashTex.dispose();
      for (const s of splashes) s.material.dispose();
      mark.material.map.dispose();
      mark.material.dispose();
      perchMark.material.map.dispose();
      perchMark.material.dispose();
      scene.remove(group);
    },
  };
}
