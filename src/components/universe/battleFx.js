// What a battle's made of besides the ships (battleScene.js puts it
// together): the bolts in flight, the fighters' engine glows, the defending
// flagship's shield, the markers over the objectives and the fires where
// one's gone. Each is one or two draws.
//
// createBoltDraw(parent, { count }) → { sync(bolts, colourOf, eye, ahead), dispose() }
// createGlows(parent, { count }) → { begin(), add(pos, colour, size), end(), dispose() }
// createShield(parent) → { show(cap, colour), hit(point), drop(), hide(), update(dt, t), dispose() }
// createMarkers(parent) → { sync(list, now), hide(), dispose() }; list: [{ key, pos, title, sub, hp, colour, under }]
// createFires(parent) → { add(pos, size, { follow, life }), update(dt, t), unfollow(follow), count, clear(), dispose() }
// Everything is in `parent`'s space (the map's).

import * as THREE from 'three';

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
const BOLT_LOOK = {
  laser: { length: 0.6, width: 0.018, bright: 1 },
  flak: { length: 0.3, width: 0.022, bright: 0.8 },
  turbo: { length: 3.2, width: 0.06, bright: 1 },
  torpedo: { length: 0.22, width: 0.09, bright: 1.6 },
};
export function createBoltDraw(parent, { count = 320 } = {}) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1).rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color(1, 1, 1)); // (made now: the shader's built with instance colours or without)
  mesh.frustumCulled = false;
  mesh.count = 0;
  parent.add(mesh);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const d = new THREE.Vector3();
  const c = new THREE.Color();
  return {
    // bolts: battle.js's pool; colourOf(bolt) → [r, g, b]; eye: the camera, in
    // the parent's space (a bolt right by it is dimmed: one passing a few
    // metres off shouldn't fill the screen with its glow); ahead: seconds
    // past the battle's last step (each bolt's carried on that far, so a
    // bolt doesn't stutter along at the battle's 30 steps a second), or,
    // less than nothing, before it: the fighters' time, a step behind
    // (battle.js's `behind`)
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
        const near = eye ? Math.min(1, Math.max(0.12, (Math.hypot(x - eye.x, y - eye.y, z - eye.z) - look.length) / (look.length * 4 + 2))) : 1;
        d.set(b.vx, b.vy, b.vz).normalize();
        q.setFromUnitVectors(Z, d);
        // (drawn a little behind its point, so it trails from where it is)
        p.set(x - d.x * look.length * 0.5, y - d.y * look.length * 0.5, z - d.z * look.length * 0.5);
        s.set(look.width, look.width, look.length);
        mesh.setMatrixAt(n, m.compose(p, q, s));
        const rgb = colourOf(b);
        const k = look.bright * near;
        mesh.setColorAt(n, c.setRGB(rgb[0] * k, rgb[1] * k, rgb[2] * k));
        n += 1;
      }
      mesh.count = n;
      if (n) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}

// ── engine glows: points, soft and round, a size in map units ──
const GLOW_VERT = `
attribute vec3 aColour;
attribute float aSize;
uniform float uScale;
varying vec3 vColour;
void main() {
  vColour = aColour;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uScale / -mv.z, 1.5, 22.0);
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = `
varying vec3 vColour;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float a = exp(-r * r * 4.0);
  gl_FragColor = vec4(vColour * a, 1.0);
}`;
export function createGlows(parent, { count = 96 } = {}) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColour', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  geo.setDrawRange(0, 0);
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
      geo.setDrawRange(0, n);
      if (!n) return;
      for (const a of ['position', 'aColour', 'aSize']) geo.attributes[a].needsUpdate = true;
    },
    dispose() {
      points.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}

// ── the defending flagship's shield: a faint bubble, rippling where it's hit ──
const SHIELD_VERT = `
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vViewW;
void main() {
  vLocal = normalize(position);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewW = cameraPosition - w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const SHIELD_FRAG = `
uniform vec4 uHits[8];
uniform float uOn;
uniform float uT;
uniform vec3 uColour;
varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vViewW;
void main() {
  float edge = 1.0 - abs(dot(normalize(vNormalW), normalize(vViewW)));
  float rim = pow(edge, 3.0) * 0.35;
  // fine bands drifting over it, barely there
  float bands = 0.5 + 0.5 * sin(vLocal.y * 60.0 + vLocal.x * 20.0 + uT * 2.0);
  float glow = rim * (0.6 + 0.4 * bands);
  // each hit: a ring running out from where it landed, fading
  for (int i = 0; i < 8; i++) {
    vec4 h = uHits[i];
    if (h.w <= 0.0 || h.w >= 1.0) continue;
    float d = distance(vLocal, h.xyz);
    float ring = exp(-pow((d - h.w * 0.9) * 9.0, 2.0)) * (1.0 - h.w);
    float spot = exp(-d * d * 60.0) * (1.0 - h.w) * 1.5;
    glow += (ring + spot) * 1.4;
  }
  gl_FragColor = vec4(uColour * glow * uOn, 1.0);
}`;
export function createShield(parent) {
  const geo = new THREE.SphereGeometry(1, 48, 24);
  const hits = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0));
  const mat = new THREE.ShaderMaterial({ vertexShader: SHIELD_VERT, fragmentShader: SHIELD_FRAG, uniforms: { uHits: { value: hits }, uOn: { value: 0 }, uT: { value: 0 }, uColour: { value: new THREE.Color(0.5, 1.1, 2.6) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
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
  const make = () => {
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (canvas) {
      canvas.width = MW;
      canvas.height = MH;
    }
    const tex = canvas ? new THREE.CanvasTexture(canvas) : null;
    if (tex) tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false }));
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
  const fireMat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(3.2, 1.3, 0.35), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
  const smokeMat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0.08, 0.07, 0.07), depthWrite: false, transparent: true, opacity: 0.55 });
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
