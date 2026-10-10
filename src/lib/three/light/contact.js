// Contact shadows: under each figure near the camera, a CONTACT_SIZE (2 m)
// square darkened where the figure comes within CONTACT_HEIGHT of the
// ground, from a small top-down depth pass blurred in the square's own
// material (three's webgpu_shadow_contact, one pass a figure). The
// cascades cannot resolve a foot on the snow at a few centimetres; this
// grounds it. On ultra and high only.
//
// Each frame the nearest `count` tracked figures within `range` of the
// camera each take a pass: an orthographic camera at the figure's feet
// looking up, drawing only the tracked figures (CONTACT_LAYER) with a
// material whose alpha falls from 1 at the ground to 0 at CONTACT_HEIGHT;
// the square under the figure shows that alpha, blurred over nine taps,
// times DARKNESS. The rest of the tracked figures' squares are hidden.
//
// contactFor(tier) → { on, target, count, range }   (pure)
// createContactShadows(scene, renderer, { tier, size, blur }) → Promise<{ planes, track(object), untrack(object), update(camera), dispose }>

import { loadThree } from './three.js';

export const CONTACT_SIZE = 2; // m: the square under a figure
export const CONTACT_HEIGHT = 1; // m: what is within this of the ground darkens it
export const CONTACT_LAYER = 30; // the layer the passes draw (tracked figures only)
const DARKNESS = 0.6; // the square's darkest, under a foot on the ground
const BLUR = 1.5; // texels: the blur's step
const TIERS = {
  ultra: { on: true, target: 256, count: 16, range: 30 },
  high: { on: true, target: 128, count: 8, range: 20 },
};

export const contactFor = (tier) => TIERS[tier] ?? { on: false, target: 0, count: 0, range: 0 };

export async function createContactShadows(scene, renderer, { tier = 'high', size = CONTACT_SIZE, blur = BLUR } = {}) {
  const set = contactFor(tier);
  const tracked = new Map(); // object → { plane, target }
  const planes = [];
  const off = { planes, track() {}, untrack() {}, update() {}, dispose() {} };
  if (!set.on) return off;
  const { THREE, tsl } = await loadThree();
  const { float, positionView, texture, uv, vec2, vec3, vec4 } = tsl;

  const canDraw = typeof renderer.setRenderTarget === 'function';
  const geometry = new THREE.PlaneGeometry(size, size);
  const camera = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0, CONTACT_HEIGHT);
  camera.rotation.x = Math.PI / 2; // looking up; the image's top is world +Z
  camera.layers.set(CONTACT_LAYER);
  // the pass: alpha 1 at the feet, 0 at CONTACT_HEIGHT
  const depthMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  depthMaterial.colorNode = vec4(0, 0, 0, float(1).sub(positionView.z.negate().div(CONTACT_HEIGHT)).clamp(0, 1));
  const texel = blur / set.target;

  const make = () => {
    const target = canDraw ? new THREE.RenderTarget(set.target, set.target) : null;
    const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    if (target) {
      // (v flipped: the pass sees world +Z at the image's top, the square's v runs to −Z)
      const at = uv().toVar();
      const base = vec2(at.x, at.y.oneMinus());
      let sum = float(0);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) sum = sum.add(texture(target.texture, base.add(vec2(dx * texel, dy * texel))).a);
      material.colorNode = vec3(0);
      material.opacityNode = sum.div(9).mul(DARKNESS);
    } else {
      material.opacity = 0;
    }
    const plane = new THREE.Mesh(geometry, material);
    plane.name = 'contact-shadow';
    plane.rotation.x = -Math.PI / 2;
    plane.renderOrder = 1;
    plane.castShadow = plane.receiveShadow = false;
    return { plane, target };
  };

  const box = new THREE.Box3();
  const layer = (object, on) => object.traverse((o) => (on ? o.layers.enable(CONTACT_LAYER) : o.layers.disable(CONTACT_LAYER)));

  return {
    planes,
    track(object) {
      if (tracked.has(object)) return;
      const c = make();
      tracked.set(object, c);
      planes.push(c.plane);
      scene.add(c.plane);
      layer(object, true);
    },
    untrack(object) {
      const c = tracked.get(object);
      if (!c) return;
      tracked.delete(object);
      planes.splice(planes.indexOf(c.plane), 1);
      c.plane.removeFromParent();
      c.plane.material.dispose();
      c.target?.dispose();
      layer(object, false);
    },
    update(view) {
      if (!view) return;
      const near = [...tracked.entries()]
        .map(([o, c]) => {
          o.updateWorldMatrix(true, true);
          box.setFromObject(o);
          const x = (box.min.x + box.max.x) / 2;
          const z = (box.min.z + box.max.z) / 2;
          return { o, c, x, y: box.min.y, z, d: Math.hypot(x - view.position.x, z - view.position.z) };
        })
        .sort((a, b) => a.d - b.d);
      near.forEach((n, i) => {
        n.c.plane.visible = i < set.count && n.d <= set.range;
        if (!n.c.plane.visible) return;
        n.c.plane.position.set(n.x, n.y + 0.02, n.z);
        n.c.plane.updateMatrixWorld();
      });
      if (!canDraw) return;
      const was = { target: renderer.getRenderTarget?.() ?? null, override: scene.overrideMaterial, background: scene.background, environment: scene.environment, fogNode: scene.fogNode };
      const clear = { color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha() };
      Object.assign(scene, { overrideMaterial: depthMaterial, background: null, environment: null, fogNode: null });
      try {
        renderer.setClearColor(0x000000, 0);
        for (const n of near) {
          if (!n.c.plane.visible) continue;
          camera.position.set(n.x, n.y, n.z);
          camera.updateMatrixWorld();
          renderer.setRenderTarget(n.c.target);
          renderer.clear();
          renderer.render(scene, camera);
        }
      } finally {
        // (the scene and the renderer given back, a throw or not)
        Object.assign(scene, { overrideMaterial: was.override, background: was.background, environment: was.environment, fogNode: was.fogNode });
        renderer.setRenderTarget(was.target);
        renderer.setClearColor(clear.color, clear.alpha);
      }
    },
    dispose() {
      for (const o of [...tracked.keys()]) this.untrack(o);
      geometry.dispose();
      depthMaterial.dispose();
    },
  };
}
