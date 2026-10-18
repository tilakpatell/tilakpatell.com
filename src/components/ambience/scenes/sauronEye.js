// The Eye atop Barad-dûr (./baradDurView.js): “the Eye was rimmed with
// fire, but was itself glazed, yellow as a cat’s, watchful and intent, and
// the black slit of its pupil opened on a pit”. Three sprites painted once
// on canvases when the scene starts: a glow behind the horns, the almond of
// fire (white-hot at the heart, its fibres running out to orange and deep
// red, flames licking from its lids all round) and the slit, which moves on
// its own to follow the pointer. It flickers by the sprites’ scale, turn and
// opacity; nothing is repainted after the start.

const TAU = Math.PI * 2;

// the canvases’ sizes, in texels
const FIRE_W = 256;
const FIRE_H = 160;
// the almond’s half-width and half-height on its canvas
const AX = 64;
const AY = 26;

// the same flames every time
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// the almond: two arcs meeting in points at either side
function almond(g, cx, cy, ax, ay) {
  g.beginPath();
  g.moveTo(cx - ax, cy);
  g.bezierCurveTo(cx - ax * 0.45, cy - ay * 1.32, cx + ax * 0.45, cy - ay * 1.32, cx + ax, cy);
  g.bezierCurveTo(cx + ax * 0.45, cy + ay * 1.32, cx - ax * 0.45, cy + ay * 1.32, cx - ax, cy);
  g.closePath();
}

function paintFire() {
  const [c, g] = canvas(FIRE_W, FIRE_H);
  const cx = FIRE_W / 2;
  const cy = FIRE_H / 2;
  const r = rng(1954);
  // flames licking out from the lids, longest above and below and rising,
  // short at the corners; laid on each other, so they burn brighter where
  // they cross
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 110; i++) {
    const a = r() * TAU;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const bx = cx + ca * AX * 0.92;
    const by = cy + sa * AY * 0.9;
    // out from the rim, leaning up the way flames go
    let dx = ca / AX;
    let dy = sa / AY;
    const dl = Math.hypot(dx, dy);
    dx /= dl;
    dy = dy / dl - 0.18;
    const len = (9 + r() * 24) * (0.5 + 0.6 * Math.abs(sa)) * (dy < 0 ? 1.08 : 0.92);
    const w = 3 + r() * 5;
    const tx = bx + dx * len + (r() - 0.5) * 10;
    const ty = by + dy * len;
    const grad = g.createLinearGradient(bx, by, tx, ty);
    grad.addColorStop(0, 'rgba(255, 196, 92, 0.85)');
    grad.addColorStop(0.45, 'rgba(255, 112, 26, 0.55)');
    grad.addColorStop(1, 'rgba(160, 30, 6, 0)');
    g.fillStyle = grad;
    g.beginPath();
    // a tongue: wide at the rim, bending to a point
    const nx = -dy;
    const ny = dx;
    g.moveTo(bx + nx * w, by + ny * w);
    g.quadraticCurveTo(bx + dx * len * 0.55 + nx * w * 0.9, by + dy * len * 0.55 + ny * w * 0.9, tx, ty);
    g.quadraticCurveTo(bx + dx * len * 0.55 - nx * w * 0.6, by + dy * len * 0.55 - ny * w * 0.6, bx - nx * w, by - ny * w);
    g.closePath();
    g.fill();
  }
  // a soft fire about the almond, under its rim
  g.save();
  g.translate(cx, cy);
  g.scale(1, AY / AX);
  const aura = g.createRadialGradient(0, 0, AX * 0.6, 0, 0, AX * 1.45);
  aura.addColorStop(0, 'rgba(255, 150, 40, 0.75)');
  aura.addColorStop(1, 'rgba(255, 80, 10, 0)');
  g.fillStyle = aura;
  g.fillRect(-AX * 1.5, -AX * 1.5, AX * 3, AX * 3);
  g.restore();

  // the almond: white-hot at the heart, yellow as a cat’s, out to orange
  // and a deep red rim
  g.globalCompositeOperation = 'source-over';
  g.save();
  almond(g, cx, cy, AX, AY);
  g.clip();
  g.translate(cx, cy);
  g.scale(1, AY / AX);
  const iris = g.createRadialGradient(0, 0, 0, 0, 0, AX);
  iris.addColorStop(0, '#fffef4');
  iris.addColorStop(0.3, '#ffefb0');
  iris.addColorStop(0.55, '#ffbe48');
  iris.addColorStop(0.8, '#ff7a1a');
  iris.addColorStop(1, '#b02a10');
  g.fillStyle = iris;
  g.fillRect(-AX, -AX, AX * 2, AX * 2);
  // its fibres, running out from the heart, lighter and darker
  g.lineCap = 'round';
  for (let i = 0; i < 150; i++) {
    const a = (i / 150) * TAU + r() * 0.03;
    const r0 = AX * (0.12 + r() * 0.15);
    const r1 = AX * (0.7 + r() * 0.35);
    g.strokeStyle = i % 3 ? `rgba(255, 244, 200, ${0.12 + r() * 0.14})` : `rgba(140, 26, 4, ${0.18 + r() * 0.18})`;
    g.lineWidth = 0.8 + r() * 1.4;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a + (r() - 0.5) * 0.06) * r1, Math.sin(a + (r() - 0.5) * 0.06) * r1);
    g.stroke();
  }
  g.restore();
  // the lids’ edge, dark against the fire round it
  almond(g, cx, cy, AX, AY);
  g.strokeStyle = 'rgba(110, 18, 4, 0.8)';
  g.lineWidth = 2;
  g.stroke();
  return c;
}

// the slit: black, a little red at its edge, pointed at both ends
function paintPupil() {
  const [c, g] = canvas(48, 128);
  g.save();
  g.translate(24, 64);
  const edge = g.createRadialGradient(0, 0, 2, 0, 0, 22);
  edge.addColorStop(0, 'rgba(70, 8, 2, 0.55)');
  edge.addColorStop(1, 'rgba(70, 8, 2, 0)');
  g.scale(1, 2.8);
  g.fillStyle = edge;
  g.fillRect(-24, -23, 48, 46);
  g.restore();
  g.fillStyle = '#080504';
  g.beginPath();
  g.moveTo(24, 6);
  g.bezierCurveTo(33, 40, 33, 88, 24, 122);
  g.bezierCurveTo(15, 88, 15, 40, 24, 6);
  g.fill();
  return c;
}

// the glow behind the horns
function paintHalo() {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 196, 110, 1)');
  grad.addColorStop(0.12, 'rgba(255, 140, 50, 0.75)');
  grad.addColorStop(0.35, 'rgba(230, 80, 20, 0.28)');
  grad.addColorStop(0.7, 'rgba(170, 40, 10, 0.07)');
  grad.addColorStop(1, 'rgba(170, 40, 10, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export function paintEye(THREE) {
  const textures = [paintHalo(), paintFire(), paintPupil()].map((c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const sprite = (map, order) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false }));
    s.renderOrder = order;
    s.frustumCulled = false;
    return s;
  };
  // the glow under the tower (the horns stand dark against it), the fire
  // and its slit over it
  const halo = sprite(textures[0], -9);
  const fire = sprite(textures[1], -7);
  const pupil = sprite(textures[2], -6);
  const size = { h: 1, slim: 1 };
  let dark = false;
  return {
    sprites: [halo, fire, pupil],
    size(h, slim) {
      size.h = h;
      size.slim = slim;
    },
    // f: the fire’s flicker (about 0.7..1); at: the Eye in scene px;
    // look: where it looks, -1..1
    step(t, f, at, look) {
      const { h, slim } = size;
      const fw = h * 0.165 * slim;
      const fh = h * 0.165 * (FIRE_H / FIRE_W) * (0.9 + 0.1 * slim);
      const breathe = 0.96 + 0.06 * f;
      fire.position.set(at.x, at.y, 0);
      fire.scale.set(fw * breathe, fh * (0.94 + 0.1 * f), 1);
      fire.material.rotation = Math.sin(t * 3.7) * 0.018;
      const hs = h * (dark ? 0.42 : 0.4) * (0.5 + 0.5 * slim) * (0.94 + 0.08 * f);
      halo.position.set(at.x, at.y, 0);
      halo.scale.set(hs, hs, 1);
      halo.material.opacity = (dark ? 0.7 : 0.45) * (0.8 + 0.2 * f);
      // the slit, in the almond (its share of the fire sprite), after the
      // pointer; narrower as the fire flares
      const ax = (fw * AX) / FIRE_W;
      const ay = (fh * AY) / FIRE_H;
      pupil.position.set(at.x + look.x * ax * 0.32, at.y + look.y * ay * 0.22, 0);
      pupil.scale.set(ay * 0.5 * (1.15 - 0.2 * f), ay * 1.85, 1);
    },
    recolor(on) {
      dark = on;
      // added light by night; by day added light would only bleach the
      // ash-grey sky, so it lies over it
      halo.material.blending = on ? THREE.AdditiveBlending : THREE.NormalBlending;
      halo.material.needsUpdate = true;
    },
    dispose() {
      for (const t of textures) t.dispose();
    },
  };
}
