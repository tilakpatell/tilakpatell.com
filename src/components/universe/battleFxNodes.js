// What a battle’s made of besides the ships (battleFx.js) on the node
// renderer: the same bolts, engine glows, shield, markers and fires, from
// the same calls. The bolts, the markers and the fires were three’s own
// materials and are their node twins, the same flags. The engine glows were
// a cloud of points sized by gl_PointSize; the node renderer draws a point
// one pixel wide, so a glow is a sprite instanced once a point (three’s
// PointsNodeMaterial on a Sprite with a count, its attributes instance
// attributes, as nodes/placesDraw.js has it), its size the GLSL’s, line for
// line. The shield’s shader is a MeshBasicNodeMaterial, its loop over the
// hits unrolled. Each shader’s uniforms are nodes under the GLSL’s names on
// `material.uniforms` (the shield’s uHits a uniform array over the same
// eight Vector4s, read every render).
//
// createBoltDraw(parent, { count }) → { sync(bolts, colourOf, eye, ahead), dispose() }
// createGlows(parent, { count }) → { begin(), add(pos, colour, size), end(), dispose() }
// createShield(parent) → { show(cap, colour), hit(point), drop(), hide(), update(dt, t), dispose() }
// createMarkers(parent) → { sync(list, now), hide(), dispose() }; list: [{ key, pos, title, sub, hp, colour, under }]
// createFires(parent) → { add(pos, size, { follow, life }), update(dt, t), unfollow(follow), count, clear(), dispose() }
// Everything is in `parent`’s space (the map’s).

import * as THREE from 'three';
import { MeshBasicNodeMaterial, PointsNodeMaterial, SpriteNodeMaterial } from 'three/webgpu';
import { attribute, cameraPosition, clamp, distance, dot, exp, float, length, modelWorldMatrix, normalLocal, normalize, positionLocal, positionView, positionWorld, pow, screenDPR, select, sin, uniform, uniformArray, uv, vec4 } from 'three/tsl';
import { keyed } from '../../lib/three/hookNodes';

const Z = new THREE.Vector3(0, 0, 1);

// ── how bright a shot reads ──
// A side's colours are its hue; how bright one reads is the battle's, the
// same on every side (the Empire's green was 2.3 times the Rebels' red, so
// it alone fed the glow): luminance, as the bloom's bright pass weighs it
// (Rec. 709, linear). Fighters' lasers, batteries' turbolasers, flak and
// the fighters' engines; a torpedo is its turbo's, at BOLT_LOOK's 1.6.
export const GLOW = Object.freeze({ laser: 3.0, turbo: 3.6, flak: 2.4, engine: 1.5 });
export const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
// rgb's hue at luminance `lum` (black stays black)
export function glowAt(rgb, lum) {
  const l = luminance(rgb);
  if (!(l > 0)) return [0, 0, 0];
  const k = lum / l;
  return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
}

// ── bolts: one instanced draw, each a thin glowing rod along its way ──
// (long and thin: a fat one read as a pastel capsule)
const BOLT_LOOK = {
  laser: { length: 0.9, width: 0.013, bright: 1 },
  flak: { length: 0.4, width: 0.016, bright: 0.8 },
  turbo: { length: 4.4, width: 0.05, bright: 1 },
  torpedo: { length: 0.22, width: 0.09, bright: 1.6 },
};
// a bolt's core, a share of its look's width, its colour this far toward
// HOT (a yellow-white, at the colour's own luminance: toward grey, a red
// went pink) at this much its brightness; and its halo round it, this much
// of its colour's grey taken out (a purer hue at a lower peak: post.js's
// shoulder greys a bright one, so a brighter halo read paler, not redder)
const CORE = { width: 0.3, white: 0.5, bright: 1 };
const HOT = [1, 0.82, 0.6];
const HOT_N = HOT.map((v) => v / luminance(HOT));
const HALO = { width: 2.6, length: 1.05, bright: 0.12, pure: 0.6 };
export function createBoltDraw(parent, { count = 320 } = {}) {
  // (two draws: a bolt's hot core, toward white, and the glow of its colour
  // round it, wider and dimmer, as the films draw them; one draw was a
  // tube of flat colour)
  const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1).rotateX(Math.PI / 2);
  const layer = () => {
    const mat = new MeshBasicNodeMaterial({ color: '#ffffff', toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color(1, 1, 1)); // (made now: the shader’s built with instance colours or without)
    mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    parent.add(mesh);
    return mesh;
  };
  const mesh = layer();
  const halo = layer();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const d = new THREE.Vector3();
  const c = new THREE.Color();
  return {
    // bolts: battle.js's pool; colourOf(bolt) → [r, g, b]; eye: the camera, in
    // the parent's space (a bolt right by it is dimmed: one passing a few
    // metres off shouldn't fill the screen with its glow; and one far off,
    // from 80 units to 0.4 of it at 320, so the far fight reads as far, not
    // as confetti of one brightness); ahead: seconds past the battle's last
    // step (each bolt's carried on that far, so a bolt doesn't stutter along
    // at the battle's 30 steps a second), or, less than nothing, before it:
    // the fighters' time, a step behind (battle.js's `behind`)
    sync(bolts, colourOf, eye = null, ahead = 0) {
      let n = 0;
      for (const b of bolts) {
        if (!b.on || n >= count) continue;
        const look = BOLT_LOOK[b.kind] ?? BOLT_LOOK.laser;
        // (drawn behind its step, with the fighters, a bolt is never drawn before it was fired: at its gun)
        const by = ahead >= 0 ? ahead : -Math.min(-ahead, b.age ?? 0);
        const x = b.x + b.vx * by;
        const y = b.y + b.vy * by;
        const z = b.z + b.vz * by;
        const dist = eye ? Math.hypot(x - eye.x, y - eye.y, z - eye.z) : 0;
        const near = eye ? Math.min(1, Math.max(0.12, (dist - look.length) / (look.length * 4 + 2))) : 1;
        const far = eye ? Math.min(1, Math.max(0.4, 1 - (dist - 80) / 400)) : 1;
        d.set(b.vx, b.vy, b.vz).normalize();
        q.setFromUnitVectors(Z, d);
        // (drawn a little behind its point, so it trails from where it is)
        p.set(x - d.x * look.length * 0.5, y - d.y * look.length * 0.5, z - d.z * look.length * 0.5);
        s.set(look.width * CORE.width, look.width * CORE.width, look.length);
        mesh.setMatrixAt(n, m.compose(p, q, s));
        s.set(look.width * HALO.width, look.width * HALO.width, look.length * HALO.length);
        halo.setMatrixAt(n, m.compose(p, q, s));
        const rgb = colourOf(b);
        const k = look.bright * near * far;
        // (the core: the colour toward HOT at the same brightness; the halo: the colour, its grey part taken out, dim)
        const w = luminance(rgb) * CORE.white;
        mesh.setColorAt(n, c.setRGB((rgb[0] * (1 - CORE.white) + HOT_N[0] * w) * k * CORE.bright, (rgb[1] * (1 - CORE.white) + HOT_N[1] * w) * k * CORE.bright, (rgb[2] * (1 - CORE.white) + HOT_N[2] * w) * k * CORE.bright));
        // (and back to the colour's own luminance, so every side's halo reads as bright: GLOW's rule)
        const lum = luminance(rgb);
        const lo = Math.min(rgb[0], rgb[1], rgb[2]) * HALO.pure;
        const kh = k * HALO.bright * (lum > lo ? lum / (lum - lo) : 1);
        halo.setColorAt(n, c.setRGB((rgb[0] - lo) * kh, (rgb[1] - lo) * kh, (rgb[2] - lo) * kh));
        n += 1;
      }
      mesh.count = n;
      halo.count = n;
      if (n) {
        for (const o of [mesh, halo]) {
          o.instanceMatrix.needsUpdate = true;
          o.instanceColor.needsUpdate = true;
        }
      }
    },
    dispose() {
      for (const o of [mesh, halo]) {
        o.removeFromParent();
        o.material.dispose();
        o.dispose();
      }
      geo.dispose();
    },
  };
}

// ── engine glows: points, soft and round, a size in map units ──
// GLOW_VERT and GLOW_FRAG, as nodes: a glow’s place is `aAt`, its quad
// turned to the camera by the sprite
function glowMaterial() {
  const uniforms = { uScale: uniform(600) };
  const mat = new PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, sizeAttenuation: false });
  mat.positionNode = attribute('aAt', 'vec3');
  const vColour = attribute('aColour', 'vec3').toVarying('vColour');
  // gl_PointSize, in the drawing buffer’s pixels (three’s sprite multiplies by the DPR again)
  mat.sizeNode = clamp(attribute('aSize', 'float').mul(uniforms.uScale).div(positionView.z.negate()), 1.5, 22).div(screenDPR);
  const r = length(uv().sub(0.5)).mul(2);
  mat.maskNode = r.lessThanEqual(1);
  mat.colorNode = vColour.mul(exp(r.mul(r).mul(-4)));
  mat.opacityNode = float(1);
  mat.uniforms = uniforms;
  return mat;
}
export function createGlows(parent, { count = 96 } = {}) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  // (a glow a sprite, instanced: the quad three’s Sprite has, each glow’s
  // own attributes stepped once a sprite)
  const geo = new THREE.InstancedBufferGeometry();
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  geo.setAttribute('aAt', new THREE.InstancedBufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColour', new THREE.InstancedBufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = glowMaterial();
  const points = new THREE.Sprite(mat);
  points.geometry = geo;
  points.frustumCulled = false;
  // (the GLSL’s draw range: none drawn till some are added)
  const shown = (k) => {
    geo.instanceCount = k;
    points.count = k;
    points.visible = k > 0;
  };
  shown(0);
  parent.add(points);
  let n = 0;
  return {
    begin() {
      n = 0;
    },
    add(p, c, s) {
      if (n >= count) return;
      pos[n * 3] = p.x;
      pos[n * 3 + 1] = p.y;
      pos[n * 3 + 2] = p.z;
      col[n * 3] = c[0];
      col[n * 3 + 1] = c[1];
      col[n * 3 + 2] = c[2];
      size[n] = s;
      n += 1;
    },
    // scale: the canvas's height in pixels over the camera's half-height at a unit off (so a size is in map units)
    end(scale = 600) {
      mat.uniforms.uScale.value = scale;
      shown(n);
      if (!n) return;
      for (const a of ['aAt', 'aColour', 'aSize']) geo.attributes[a].needsUpdate = true;
    },
    dispose() {
      points.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}

// ── the defending flagship's shield: a faint bubble, rippling where it's hit ──
// SHIELD_VERT and SHIELD_FRAG, as nodes; `hits` the eight Vector4s the
// shield writes (x, y, z where it landed, on the unit sphere; w how far its
// ring has run, 0 or 1 for none)
function shieldMaterial(hits) {
  const uniforms = { uHits: uniformArray(hits, 'vec4'), uOn: uniform(0), uT: uniform(0), uColour: uniform(new THREE.Color(0.5, 1.1, 2.6)) };
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  const vLocal = normalize(positionLocal).toVarying('vLocal');
  // (the model matrix’s turn alone, as the GLSL’s mat3(modelMatrix), not the normal matrix)
  const vNormalW = normalize(modelWorldMatrix.mul(vec4(normalLocal, 0)).xyz).toVarying('vNormalW');
  const vViewW = cameraPosition.sub(positionWorld).toVarying('vViewW');
  const edge = float(1).sub(dot(normalize(vNormalW), normalize(vViewW)).abs());
  const rim = pow(edge, 3).mul(0.35);
  // fine bands drifting over it, barely there
  const bands = sin(vLocal.y.mul(60).add(vLocal.x.mul(20)).add(uniforms.uT.mul(2))).mul(0.5).add(0.5);
  let glow = rim.mul(bands.mul(0.4).add(0.6));
  // each hit: a ring running out from where it landed, fading (the GLSL’s loop, unrolled)
  for (let i = 0; i < hits.length; i++) {
    const h = uniforms.uHits.element(i);
    const d = distance(vLocal, h.xyz);
    // (squared by a product: the GLSL’s pow(x, 2.0) of a negative is undefined, and was meant as x²)
    const x = d.sub(h.w.mul(0.9)).mul(9);
    const ring = exp(x.mul(x).negate()).mul(h.w.oneMinus());
    const spot = exp(d.mul(d).mul(-60)).mul(h.w.oneMinus()).mul(1.5);
    glow = glow.add(select(h.w.greaterThan(0).and(h.w.lessThan(1)), ring.add(spot).mul(1.4), 0));
  }
  mat.colorNode = uniforms.uColour.mul(glow).mul(uniforms.uOn);
  mat.opacityNode = float(1);
  mat.uniforms = uniforms;
  return mat;
}
export function createShield(parent) {
  const geo = new THREE.SphereGeometry(1, 48, 24);
  const hits = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0));
  const mat = shieldMaterial(hits);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  mesh.renderOrder = 2;
  parent.add(mesh);
  const st = { on: 0, want: 0, flicker: 0, next: 0 };
  const local = new THREE.Vector3();
  return {
    // round `cap` (battle.js's): an ellipsoid its length long, as wide as a Star Destroyer
    show(cap, colour) {
      const fwd = new THREE.Vector3(cap.fwd.x, cap.fwd.y, cap.fwd.z);
      mesh.position.set(cap.pos.x, cap.pos.y, cap.pos.z);
      mesh.quaternion.setFromUnitVectors(Z, fwd);
      mesh.scale.set(cap.size * 0.36, cap.size * 0.22, cap.size * 0.62);
      if (colour) mat.uniforms.uColour.value.setRGB(...colour);
      st.want = 1;
      st.flicker = 0;
      mesh.visible = true;
    },
    // a bolt landed on it at `point` (the map's)
    hit(point) {
      if (!mesh.visible) return;
      local.set(point.x, point.y, point.z);
      mesh.worldToLocal(parent.localToWorld(local)).normalize();
      const h = hits[st.next];
      st.next = (st.next + 1) % hits.length;
      h.set(local.x, local.y, local.z, 0.001);
    },
    // the generators are gone: it flickers and goes out
    drop() {
      st.want = 0;
      st.flicker = 1.2;
    },
    hide() {
      st.want = 0;
      st.on = 0;
      mesh.visible = false;
      for (const h of hits) h.w = 0;
    },
    update(dt, t) {
      if (!mesh.visible) return;
      mat.uniforms.uT.value = t;
      for (const h of hits) if (h.w > 0) h.w = h.w + dt * 1.1 >= 1 ? 0 : h.w + dt * 1.1;
      if (st.flicker > 0) {
        st.flicker -= dt;
        st.on = (Math.sin(t * 60) > 0 ? 1.8 : 0.2) * Math.max(0, st.flicker);
      } else st.on += (st.want - st.on) * Math.min(1, dt * 3);
      mat.uniforms.uOn.value = st.on;
      if (st.want === 0 && st.flicker <= 0 && st.on < 0.01) mesh.visible = false;
    },
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}

// ── the objective markers: a diamond, a name, how much is left and how far ──
// (the card wide enough for 'Destroy: Shield generator' at its full size;
// a longer name is drawn smaller to fit, not cut off at the card's edges)
export const MARK = { w: 320, h: 72, pad: 8, every: 0.25 };
const MW = MARK.w;
const MH = MARK.h;
// the font size that fits a name `room` wide, from its width at `px`
export const fitPx = (width, room, px = 20, min = 12) => Math.max(min, Math.min(px, Math.floor((px * room) / Math.max(width, 1))));
export function createMarkers(parent) {
  const pool = [];
  const used = new Map(); // key → marker
  let made = 0;
  const make = () => {
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (canvas) {
      canvas.width = MW;
      canvas.height = MH;
    }
    const tex = canvas ? new THREE.CanvasTexture(canvas) : null;
    if (tex) tex.colorSpace = THREE.SRGBColorSpace;
    // (each card’s program its own: three’s sprite node reads `center` off
    // the sprite its program was built for, so two cards sharing one would
    // both hang as the first does, one over its point and one under)
    const mat = keyed(new SpriteNodeMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false }), `battle-marker-${(made += 1)}`);
    const sprite = new THREE.Sprite(mat);
    sprite.center.set(0.5, 0.18);
    sprite.scale.set(0.24 * (MW / 256), 0.0675, 1);
    sprite.renderOrder = 10;
    sprite.frustumCulled = false;
    return { sprite, canvas, tex, sig: '' };
  };
  const paint = (mk, o) => {
    const g = mk.canvas?.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, MW, MH);
    g.font = '600 20px "JetBrains Mono", ui-monospace, monospace';
    const px = fitPx(g.measureText(o.title).width, MW - 2 * MARK.pad);
    if (px < 20) g.font = `600 ${px}px "JetBrains Mono", ui-monospace, monospace`;
    g.textAlign = 'center';
    g.fillStyle = o.colour;
    g.shadowColor = 'rgba(0,0,0,0.85)';
    g.shadowBlur = 6;
    g.fillText(o.title, MW / 2, 22);
    g.font = '500 16px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(235,240,255,0.92)';
    g.fillText(o.sub, MW / 2, 42);
    // how much is left
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(MW / 2 - 50, 50, 100, 5);
    g.fillStyle = o.colour;
    g.fillRect(MW / 2 - 50, 50, 100 * Math.max(0, Math.min(1, o.hp)), 5);
    // the diamond, under it all, at the point itself
    g.strokeStyle = o.colour;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(MW / 2, 58);
    g.lineTo(MW / 2 + 6, 64);
    g.lineTo(MW / 2, 70);
    g.lineTo(MW / 2 - 6, 64);
    g.closePath();
    g.stroke();
    mk.tex.needsUpdate = true;
  };
  return {
    // now: seconds, the scene's clock (the distance's repaint is held to
    // MARK.every; without it, every change is painted)
    sync(list, now = null) {
      const seen = new Set();
      for (const o of list) {
        seen.add(o.key);
        let mk = used.get(o.key);
        if (!mk) {
          mk = pool.pop() ?? make();
          mk.sig = '';
          mk.at = -Infinity;
          used.set(o.key, mk);
          parent.add(mk.sprite);
        }
        mk.sprite.position.set(o.pos.x, o.pos.y, o.pos.z);
        mk.sprite.center.set(0.5, o.under ? 1.05 : 0.18);
        // (painted again when what it says changes; only its distance, which
        // moves with every frame you fly, at most four times a second: each
        // paint is a canvas drawn and sent to the graphics card)
        const sig = `${o.title}|${Math.round(o.hp * 50)}|${o.colour}`;
        if (sig !== mk.sig || (o.sub !== mk.sub && (now === null || now - mk.at >= MARK.every))) {
          mk.sig = sig;
          mk.sub = o.sub;
          mk.at = now;
          paint(mk, o);
        }
      }
      for (const [key, mk] of used) {
        if (seen.has(key)) continue;
        mk.sprite.removeFromParent();
        used.delete(key);
        pool.push(mk);
      }
    },
    hide() {
      this.sync([]);
    },
    dispose() {
      this.hide();
      for (const mk of pool) {
        mk.tex?.dispose();
        mk.sprite.material.dispose();
      }
    },
  };
}

// ── fires where an objective's gone: a flickering glow and a plume of smoke ──
function softTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
export function createFires(parent) {
  const tex = softTexture();
  const fireMat = new SpriteNodeMaterial({ map: tex, color: new THREE.Color(3.2, 1.3, 0.35), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
  const smokeMat = new SpriteNodeMaterial({ map: tex, color: new THREE.Color(0.08, 0.07, 0.07), depthWrite: false, transparent: true, opacity: 0.55 });
  const fires = [];
  let made = 0;
  const drop = (f) => {
    f.fire.removeFromParent();
    for (const s of f.smoke) s.removeFromParent();
  };
  return {
    // `follow`: something in `parent` it burns on (a ship's holder, a piece
    // flung off), `pos` in that thing's own frame, so it goes where it goes;
    // `life`: seconds it burns, dying down over its last two
    add(pos, size = 1, { follow = null, life = Infinity } = {}) {
      const fire = new THREE.Sprite(fireMat);
      const smoke = [0, 1, 2].map(() => new THREE.Sprite(smokeMat));
      fire.position.set(pos.x, pos.y, pos.z);
      parent.add(fire, ...smoke);
      const f = { fire, smoke, at: new THREE.Vector3(pos.x, pos.y, pos.z), local: follow ? new THREE.Vector3(pos.x, pos.y, pos.z) : null, follow, size, life, seed: made++ * 1.7 };
      fires.push(f);
      return f;
    },
    update(dt, t) {
      for (let n = fires.length - 1; n >= 0; n--) {
        const f = fires[n];
        f.life -= dt;
        if (f.life <= 0) {
          drop(f);
          fires.splice(n, 1);
          continue;
        }
        if (f.follow) {
          f.follow.updateMatrix();
          f.at.copy(f.local).applyMatrix4(f.follow.matrix);
          f.fire.position.copy(f.at);
        }
        const fade = Math.min(1, f.life / 2);
        const flick = 0.8 + 0.2 * Math.sin(t * 17 + f.seed) * Math.sin(t * 7.3 + f.seed * 2);
        f.fire.scale.setScalar(f.size * 1.4 * flick * fade);
        f.smoke.forEach((s, i) => {
          // each puff rising off it and swelling, then round again
          const k = (t * 0.25 + i / 3 + f.seed) % 1;
          s.position.set(f.at.x + Math.sin(f.seed + i) * f.size * 0.3, f.at.y + k * f.size * 4, f.at.z + Math.cos(f.seed + i) * f.size * 0.3);
          s.scale.setScalar(f.size * (1 + k * 3) * fade);
        });
      }
    },
    // the fires burning on `follow` (a ship gone: they go with it)
    unfollow(follow) {
      for (let n = fires.length - 1; n >= 0; n--)
        if (fires[n].follow === follow) {
          drop(fires[n]);
          fires.splice(n, 1);
        }
    },
    get count() {
      return fires.length;
    },
    clear() {
      for (const f of fires) drop(f);
      fires.length = 0;
    },
    dispose() {
      this.clear();
      fireMat.dispose();
      smokeMat.dispose();
      tex?.dispose();
    },
  };
}
