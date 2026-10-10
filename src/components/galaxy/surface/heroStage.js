// The hero-select stage from the 2017 game's front end, behind the loadout's
// Outfit tab: the Frontend level's Backdrop_01 (its dome and its pill
// lights, the kit catalog/bf2017-frontend.js names), placed as the level
// places them, the picked hero standing in the middle in its idle, under the
// Frontend's VisualEnvironment (VE_FrostEnd, src/data/bf2017/light/
// frontend.json): no sun, its sky's bounce from above and the pill lights'
// glow. On low the loadout keeps its flat backdrop and nothing here runs.
//
// stageFor({ level, hero }) → { kit, light, pose } | null: whether there is a
//   stage for this hero at this level (a figure on the game's skeleton, at
//   mid and over), and the clip it stands in
// STAGE: where the pieces stand, from the level (relative to the dome)
// createHeroStage(canvas, { level, reduced }) → { show(spec), resize(), dispose() } | null

import * as THREE from 'three';
import { KITS } from './catalog/bf2017-frontend';
import FRONTEND from '../../../data/bf2017/light/frontend.json';
import STAGE_DATA from '../../../data/bf2017/stage.json';
import { cutFor, loadWalrusBody, packUrls } from '../../../lib/three/walrus';
import { ktx2Loader, loadGltf } from '../../../lib/three/gltf';
import { pixelRatio } from '../../../lib/device';
import { quiet, releaseContext } from '../../../lib/three/renderer';

// where the pieces stand: src/data/bf2017/stage.json (the level's own
// placings, from the dome's foot; the hero at its middle)
export const STAGE = STAGE_DATA.pieces;
// the clip it stands in: the front end's own (lane A's frontend.idle) when
// the packs carry it, else the hero's idle
export const POSES = ['frontend.idle', 'idle'];

export function stageFor({ level, hero }) {
  if (!level || level === 'low') return null;
  if (!hero?.rig || hero.rig !== 'walrus' || !hero.src?.url) return null;
  return { kit: KITS.frontendstage, light: FRONTEND.weathers[FRONTEND.main], pose: POSES };
}

const rgb = (v, k = 1) => new THREE.Color(v[0] * k, v[1] * k, v[2] * k);

export function createHeroStage(canvas, { level = 'high', reduced = false } = {}) {
  let renderer;
  try {
    renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }));
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const ve = FRONTEND.weathers[FRONTEND.main];
  // (the record's exposure compensation, in stops)
  renderer.toneMappingExposure = 2 ** (ve.tonemap?.compensation ?? 0) * 1.6;
  renderer.setPixelRatio(pixelRatio(2));
  ktx2Loader({ renderer });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05070c');
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 80);
  camera.position.set(0, 1.25, 5.2);
  camera.lookAt(0, 0.95, 0);
  // the VE's bounce: its sky above, its ground below (enlighten's colours,
  // as lane G's gameLit reads them: linear, scaled to the stage's exposure)
  const sky = ve.enlighten?.sky ?? [1, 1, 1];
  const ground = ve.enlighten?.ground ?? [0.05, 0.05, 0.05];
  const peak = Math.max(...sky, 1e-3);
  scene.add(new THREE.HemisphereLight(rgb(sky, 1 / peak), rgb(ground, 1 / peak), 1.4));
  // the pill lights' glow on the hero (their emissive, which lights nothing in
  // three on its own: a hand value, the stage's one)
  const pills = new THREE.PointLight('#cfe4ff', 9, 14, 1.6);
  pills.position.set(STAGE.nowherepilllights_01.at[0], 1.6, 3.2);
  scene.add(pills);
  const stage = new THREE.Group();
  scene.add(stage);
  const turn = new THREE.Group();
  // (the game's figures face along x; the camera looks down -z at them)
  turn.rotation.y = -Math.PI / 2;
  scene.add(turn);

  let alive = true;
  loadGltf(KITS.frontendstage.url, { renderer, fresh: true })
    .then((got) => {
      if (!alive || !got) return;
      for (const [name, p] of Object.entries(STAGE)) {
        const piece = got.scene.getObjectByName(name);
        if (!piece) continue;
        piece.position.fromArray(p.at);
        piece.quaternion.fromArray(p.quat);
        piece.scale.fromArray(p.scale);
        stage.add(piece);
      }
      draw();
    })
    .catch(() => {});

  let figure = null;
  let mixer = null;
  let wanted = null;
  const clear = () => {
    if (figure) turn.remove(figure);
    mixer?.stopAllAction();
    figure = null;
    mixer = null;
  };
  const show = (spec) => {
    const url = spec?.src?.url;
    if (!url || url === wanted) return;
    wanted = url;
    clear();
    const packs = spec.packs ?? packUrls(spec.pack);
    const light = cutFor(url, level === 'ultra' ? 'high' : 'mid');
    loadWalrusBody(light, { packs })
      .catch(() => loadWalrusBody(url, { packs }))
      .then((body) => {
        if (!alive || wanted !== url) return;
        figure = body.model;
        figure.traverse((o) => {
          if (o.isSkinnedMesh) o.frustumCulled = false;
        });
        turn.add(figure);
        mixer = new THREE.AnimationMixer(figure);
        const clip = POSES.map((n) => body.clips[n]).find(Boolean);
        if (clip) mixer.clipAction(clip).play();
        mixer.update(reduced ? 0 : 0.01);
        draw();
      })
      .catch(() => {});
  };

  const resize = () => {
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 240;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw();
  };
  function draw() {
    if (alive) renderer.render(scene, camera);
  }
  // (still under reduced motion: one frame a change; else the idle breathes
  // and the stage turns a little toward the drag)
  let raf = 0;
  let last = performance.now();
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    mixer?.update(dt);
    draw();
  };
  if (!reduced) raf = requestAnimationFrame(tick);
  let drag = null;
  const down = (e) => (drag = e.clientX);
  const move = (e) => {
    if (drag == null) return;
    turn.rotation.y += (e.clientX - drag) * 0.01;
    drag = e.clientX;
    if (reduced) draw();
  };
  const up = () => (drag = null);
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  resize();

  return {
    show,
    resize,
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      clear();
      renderer.dispose();
      releaseContext(renderer);
    },
  };
}
