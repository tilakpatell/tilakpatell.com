// Rivendell's painted canvases (moved out of props.js, whose kit makes
// textures of them and which keeps the falls' shaders): pale elven stone,
// a carved frieze, tracery, leaded glass, the roofs' bronze leaves, rock,
// linen, a sky for polished things to show, a puff of mist, a shaft of
// sun; and the pictures: the Council's floor, the painting in the hall of
// Narsil, Bilbo's map, book, rug and notes, and the Ring's inscription.
// Plain 2D canvases, free of GLSL, so a 'nodes' world (the Road) may paint
// the same; ./build.js re-exports them.

import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, paintPixels, smooth } from '../../../../lib/paint';
import { rng } from '../../shire/build';

const TAU = Math.PI * 2;

// ── painted textures ──

// Pale elven stone, nearly white so a material's colour warms it: a fine
// limestone grain, soft clouding, here and there a faint vein, and the
// joints of big smooth-dressed blocks, barely there. With its relief.
function elfstoneCanvas(S, seed, { rows = 3, across = 2, joint = 1 } = {}) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const row = Math.floor(v * rows);
    const shift = (row * 0.37) % 1;
    const bu = u * across + shift;
    const col = Math.floor(bu);
    const fu = bu - col;
    const fv = v * rows - row;
    const d = Math.min(Math.min(fu, 1 - fu) / across, Math.min(fv, 1 - fv) / rows);
    const j = (1 - smooth(0.001, 0.005, d)) * joint * 0.7;
    const cloud = fbm(n, u * 4, v * 4, { period: 4, octaves: 4 });
    const grain = n(u * 128, v * 128, 128);
    const vein = (1 - smooth(0, 0.025, Math.abs(fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 3 }) - 0.5))) * smooth(0.55, 0.7, n(u * 2 + 3, v * 2, 2));
    const tone = n((col % across) * 3.1 + row * 5.7, 1.3) - 0.5;
    const t = 0.92 + (cloud - 0.5) * 0.12 + (grain - 0.5) * 0.05 - j * 0.12 - vein * 0.06 + tone * 0.035;
    field[py * S + px] = clamp01(0.6 + cloud * 0.2 + grain * 0.12 - j * 0.4);
    out[0] = 255 * Math.min(1, t);
    out[1] = 250 * Math.min(1, t);
    out[2] = 240 * Math.min(1, t * 0.99);
  });
  return { c, field };
}

// A box blur of a height field, in place, wrapping at the edges.
function blurField(f, w, h, r) {
  const tmp = new Float32Array(f.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += f[y * w + ((x + k + w) % w)];
      tmp[y * w + x] = s / (2 * r + 1);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[((y + k + h) % h) * w + x];
      f[y * w + x] = s / (2 * r + 1);
    }
  }
  return f;
}

// White drawing on a black canvas as a height field.
function fieldOf(c) {
  const { width: w, height: h } = c;
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = d[i * 4] / 255;
  return f;
}

// Art Nouveau carving for a frieze, repeating along the band: a vine that
// waves from end to end, a tendril curling off each crest into the hollow,
// and pointed leaves along it. Gives the relief (for a normal map) and a
// pale stone picture shaded darker down in the cuts.
function carvingCanvas(W = 512, H = 128) {
  const draw = makeCanvas(W, H);
  const g = draw.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const waves = 2;
  const yAt = (x) => H / 2 + Math.sin((x / W) * TAU * waves) * H * 0.16;
  const leaf = (x, y, ang, len, wid) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.45, -wid, len, 0);
    g.quadraticCurveTo(len * 0.45, wid, 0, 0);
    g.fill();
    g.restore();
  };
  for (const dx of [-W, 0, W]) {
    g.save();
    g.translate(dx, 0);
    // the stem
    g.lineWidth = 9;
    g.beginPath();
    for (let x = -10; x <= W + 10; x += 4) (x === -10 ? g.moveTo(x, yAt(x)) : g.lineTo(x, yAt(x)));
    g.stroke();
    // the tendrils curl off the crests into the hollows, in spirals
    for (let k = 0; k < waves * 2; k++) {
      const x0 = ((k + 0.5) / (waves * 2)) * W;
      const up = k % 2 === 0 ? 1 : -1;
      const y0 = yAt(x0);
      g.lineWidth = 5;
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const a = t * 4.4;
        const rr = (1 - t * 0.82) * H * 0.2;
        const cx = x0 + W * 0.07;
        const cy = y0 + up * H * 0.2;
        const px = cx - Math.cos(a) * rr;
        const py = cy - up * Math.sin(a + Math.PI / 2) * rr;
        if (i) g.lineTo(px, py);
        else g.moveTo(x0, y0);
      }
      g.stroke();
      g.beginPath();
      g.arc(x0 + W * 0.07, y0 + up * H * 0.2, 4, 0, TAU);
      g.fill();
      // leaves either side of the stem
      for (const [f, side] of [[0.18, -1], [0.32, 1], [0.0, 1]]) {
        const x = x0 + (f - 0.25) * W * 0.5;
        leaf(x, yAt(x), side * -0.75, H * 0.3, H * 0.1);
      }
    }
    g.restore();
  }
  // a fillet at the top and the foot of the band
  g.fillRect(0, 0, W, 8);
  g.fillRect(0, H - 8, W, 8);
  const field = blurField(fieldOf(draw), W, H, 2);
  const c = makeCanvas(W, H);
  const n = makeNoise(31);
  const blurred = blurField(Float32Array.from(field), W, H, 4);
  paintPixels(c, (u, v, out, px, py) => {
    const h = field[py * W + px];
    const cut = clamp01(blurred[py * W + px] * 1.6 - h * 1.2);
    const t = (0.84 + h * 0.14 - cut * 0.3 + (n(u * 64, v * 16, 64) - 0.5) * 0.06) * 255;
    out[0] = t;
    out[1] = t * 0.975;
    out[2] = t * 0.93;
  });
  return { c, field, W, H };
}

// Flowing tracery cut through a panel (white where the stone is, clear
// between), repeating across: a tall ogee arch from one side to the other,
// a leaf hanging in it with its midrib, whiplash tendrils curling in from
// the feet, and a rail top and foot to join it to the rails.
function traceryCanvas(S = 256) {
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const dx of [-S, 0, S]) {
    g.save();
    g.translate(dx, 0);
    g.lineWidth = 13;
    g.beginPath();
    g.moveTo(0, S);
    g.bezierCurveTo(0, S * 0.42, S * 0.42, S * 0.36, S / 2, S * 0.06);
    g.bezierCurveTo(S * 0.58, S * 0.36, S, S * 0.42, S, S);
    g.stroke();
    // the leaf, hanging from the arch's point
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(S / 2, S * 0.12);
    g.bezierCurveTo(S * 0.66, S * 0.36, S * 0.64, S * 0.62, S / 2, S * 0.8);
    g.bezierCurveTo(S * 0.36, S * 0.62, S * 0.34, S * 0.36, S / 2, S * 0.12);
    g.stroke();
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(S / 2, S * 0.2);
    g.lineTo(S / 2, S * 0.92);
    g.stroke();
    // tendrils from the arch's feet, curling in under the leaf
    for (const s of [-1, 1]) {
      g.lineWidth = 8;
      g.beginPath();
      const x0 = S / 2 + s * S * 0.47;
      g.moveTo(x0, S * 0.66);
      g.bezierCurveTo(S / 2 + s * S * 0.3, S * 0.95, S / 2 + s * S * 0.1, S * 0.98, S / 2 + s * S * 0.12, S * 0.8);
      g.bezierCurveTo(S / 2 + s * S * 0.13, S * 0.7, S / 2 + s * S * 0.24, S * 0.72, S / 2 + s * S * 0.22, S * 0.8);
      g.stroke();
      g.beginPath();
      g.arc(S / 2 + s * S * 0.2, S * 0.8, 6, 0, TAU);
      g.fill();
      // a small curl up in the spandrel
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(S / 2 + s * S * 0.38, S * 0.2);
      g.bezierCurveTo(S / 2 + s * S * 0.44, S * 0.06, S / 2 + s * S * 0.3, S * 0.04, S / 2 + s * S * 0.3, S * 0.13);
      g.stroke();
    }
    g.restore();
  }
  g.fillRect(0, 0, S, 10);
  g.fillRect(0, S - 10, S, 10);
  return c;
}

// Filigree for the head of an arch (cut to the arch's shape by its
// geometry): a stem up the middle, branches that curl out either side
// and back, a ring with a four-petalled flower in it near the top.
function archFillCanvas(S = 256) {
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(S / 2, S);
  g.lineTo(S / 2, S * 0.05);
  g.stroke();
  for (const s of [-1, 1]) {
    for (const [y0, k] of [[0.92, 1], [0.66, 0.8], [0.42, 0.6]]) {
      g.lineWidth = 7 * k + 2;
      g.beginPath();
      g.moveTo(S / 2, S * y0);
      g.bezierCurveTo(S / 2 + s * S * 0.5 * k, S * (y0 - 0.02), S / 2 + s * S * 0.48 * k, S * (y0 - 0.26 * k), S / 2 + s * S * 0.26 * k, S * (y0 - 0.2 * k));
      g.bezierCurveTo(S / 2 + s * S * 0.16 * k, S * (y0 - 0.15 * k), S / 2 + s * S * 0.22 * k, S * (y0 - 0.08 * k), S / 2 + s * S * 0.3 * k, S * (y0 - 0.1 * k));
      g.stroke();
    }
  }
  g.lineWidth = 8;
  g.beginPath();
  g.arc(S / 2, S * 0.2, S * 0.1, 0, TAU);
  g.stroke();
  for (let i = 0; i < 4; i++) {
    g.save();
    g.translate(S / 2, S * 0.2);
    g.rotate((i * Math.PI) / 2 + Math.PI / 4);
    g.beginPath();
    g.ellipse(0, -S * 0.045, S * 0.022, S * 0.045, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  g.lineWidth = 12;
  g.strokeRect(0, 0, S, S);
  return c;
}

// Leaded glass for a tall arched window, mapped over its whole opening:
// pale glass in panes of slightly differing tints, cames of lead between,
// a mullion that parts into two lancets near the top, and a ring in the head.
function glassCanvas(W = 64, H = 128) {
  const c = makeCanvas(W, H);
  const n = makeNoise(9);
  paintPixels(c, (u, v, out) => {
    const k = 0.78 + fbm(n, u * 3, v * 6, { octaves: 3 }) * 0.3 + v * 0.08;
    out[0] = 230 * k;
    out[1] = 226 * k;
    out[2] = 212 * k;
  });
  const g = c.getContext('2d');
  g.strokeStyle = '#1c1a18';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(W / 2, H);
  g.lineTo(W / 2, H * 0.42);
  for (const s of [-1, 1]) {
    g.moveTo(W / 2, H * 0.42);
    g.bezierCurveTo(W / 2 + s * W * 0.02, H * 0.3, W / 2 + s * W * 0.4, H * 0.32, W / 2 + s * W * 0.46, H * 0.4);
  }
  for (const y of [0.62, 0.82]) {
    g.moveTo(0, H * y);
    g.lineTo(W, H * y);
  }
  g.stroke();
  g.beginPath();
  g.arc(W / 2, H * 0.2, W * 0.14, 0, TAU);
  g.stroke();
  g.lineWidth = 3;
  g.strokeRect(0, 0, W, H);
  return c;
}

// Leaf-shaped shingles of bronze gone green: courses of overlapping scales,
// each pointed like a leaf's tip with a faint midrib, the course above
// lying over the top of the one below; verdigris in streaks and blooms,
// darker in the steps. Rows run across u; v runs down the slope.
function roofCanvas(S = 256) {
  const n = makeNoise(41);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  const rows = 8;
  const cols = 8;
  const len = (fu) => 1.45 - 0.45 * Math.pow(Math.abs(fu * 2 - 1), 1.3);
  const hash = (a, b) => n(a * 7.13 + 0.5, b * 3.71 + 0.5);
  paintPixels(c, (u, v, out, px, py) => {
    const row = Math.floor(v * rows);
    const fv = v * rows - row;
    // the scale of the course above, if its tip reaches down to here
    let r0 = row - 1;
    let sh = (((r0 % 2) + 2) % 2) * 0.5;
    let fu = (u * cols + sh) % 1;
    let loc = fv + 1;
    if (loc >= len(fu)) {
      r0 = row;
      sh = (((r0 % 2) + 2) % 2) * 0.5;
      fu = (u * cols + sh) % 1;
      loc = fv;
    }
    const l = len(fu);
    const h = loc / l;
    const id = hash(Math.floor(u * cols + sh) % cols, ((r0 % rows) + rows) % rows);
    const rib = 1 - smooth(0.0, 0.05, Math.abs(fu - 0.5));
    const edge = smooth(0.0, 0.08, Math.min(fu, 1 - fu));
    const height = 0.25 + h * 0.6 + rib * 0.08 * h;
    field[py * S + px] = height * (0.6 + edge * 0.4);
    const patina = fbm(n, u * 6 + 3, v * 6, { period: 6, octaves: 4 });
    const streak = smooth(0.55, 0.8, n(u * 40, v * 3, 40));
    const shade = 0.62 + h * 0.38 + (id - 0.5) * 0.2 - (1 - edge) * 0.25;
    // bronze-green, lighter verdigris in blooms and streaks
    const vg = clamp01(smooth(0.45, 0.75, patina) * 0.8 + streak * 0.35);
    const r = mix(150, 150, vg);
    const gg = mix(160, 205, vg);
    const b = mix(140, 180, vg);
    out[0] = r * shade;
    out[1] = gg * shade;
    out[2] = b * shade;
  });
  return { c, field };
}

// Rock for the cliffs, pale so the vertex colours give its hue: a coarse
// grain, faint bedding lines across, and hairline cracks.
function rockCanvas(S = 256, seed = 5) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 2);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const big = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const grain = n(u * 96, v * 96, 96);
    const bed = Math.sin((v * 7 + fbm(n, u * 2, v * 2 + 5, { period: 2, octaves: 2 }) * 0.8) * TAU) * 0.5 + 0.5;
    const k = cells(u * 5, v * 5, 5);
    const crack = (1 - smooth(0, 0.02, k.f2 - k.f1)) * smooth(0.5, 0.62, fbm(n, u * 3 + 5, v * 3, { period: 3, octaves: 2 })) * 0.2;
    field[py * S + px] = clamp01(0.4 + big * 0.4 + grain * 0.15 - crack * 0.35 + bed * 0.08);
    const t = 0.8 + big * 0.2 + (grain - 0.5) * 0.12 - crack * 0.22 - bed * 0.04;
    out[0] = 240 * t;
    out[1] = 236 * t;
    out[2] = 228 * t;
  });
  return { c, field };
}

// Linen, white and finely woven.
function linenCanvas(S = 128) {
  const n = makeNoise(17);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const weave = (Math.sin(u * S * Math.PI) * Math.sin(v * S * Math.PI)) * 0.5 + 0.5;
    const slub = n(u * 8, v * 64, 8);
    field[py * S + px] = weave * 0.6 + slub * 0.4;
    const t = 0.9 + weave * 0.06 + (slub - 0.5) * 0.08;
    out[0] = 255 * t;
    out[1] = 253 * t;
    out[2] = 248 * t;
  });
  return { c, field };
}

// A late-afternoon sky to see in polished things: pale blue overhead, warm
// gold at the horizon where the sun is going down, brown ground below.
function skyCanvas() {
  const c = makeCanvas(256, 128);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#7f9cc6');
  grd.addColorStop(0.36, '#c8cfd0');
  grd.addColorStop(0.48, '#f4d39c');
  grd.addColorStop(0.5, '#d8a868');
  grd.addColorStop(0.56, '#6e5a40');
  grd.addColorStop(1, '#2a2218');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 128);
  const sun = g.createRadialGradient(64, 58, 0, 64, 58, 46);
  sun.addColorStop(0, 'rgba(255,248,220,1)');
  sun.addColorStop(0.2, 'rgba(255,214,140,0.8)');
  sun.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, 256, 128);
  return c;
}

// A soft round puff, a little lumpy (mist, spray, a halo).
function puffCanvas(S = 64, lumpy = true) {
  const n = makeNoise(23);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const lump = lumpy ? 0.75 + fbm(n, u * 4, v * 4, { octaves: 3 }) * 0.5 : 1;
    const a = clamp01(1 - d) ** 1.6 * lump;
    out[0] = out[1] = out[2] = 255;
    out[3] = 255 * clamp01(a);
  });
  return c;
}

// A shaft of sunlight across a room: soft at its sides, bright where it
// comes in at the window and fading as it goes, with a few motes.
function shaftCanvas() {
  const c = makeCanvas(64, 128);
  const n = makeNoise(29);
  paintPixels(c, (u, v, out) => {
    const side = Math.pow(Math.sin(Math.PI * u), 1.2);
    const along = Math.pow(1 - v, 1.3) * smooth(0, 0.04, v);
    const mote = smooth(0.82, 0.9, n(u * 22, v * 40)) * 0.5;
    const a = side * along * (0.85 + mote);
    out[0] = out[1] = out[2] = 255;
    out[3] = 255 * clamp01(a);
  });
  return c;
}

// ── painted pictures ──

// A closed path through points, filled and (if `line`) outlined.
function poly(g, pts, fill, line = null, lw = 2) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (line) {
    g.strokeStyle = line;
    g.lineWidth = lw;
    g.stroke();
  }
}

// A limb from a to b, wa wide at a and wb at b.
function limb(g, [ax, ay], [bx, by], wa, wb, fill, line = null, lw = 2) {
  const l = Math.hypot(bx - ax, by - ay) || 1;
  const nx = -(by - ay) / l;
  const ny = (bx - ax) / l;
  poly(g, [[ax + nx * wa / 2, ay + ny * wa / 2], [bx + nx * wb / 2, by + ny * wb / 2], [bx - nx * wb / 2, by - ny * wb / 2], [ax - nx * wa / 2, ay - ny * wa / 2]], fill, line, lw);
  g.beginPath();
  g.arc(bx, by, wb / 2, 0, TAU);
  g.fillStyle = fill;
  g.fill();
}

// Age on a painted canvas: hairline crazing, the paint flaked away to the
// plaster in patches, uneven fading.
function ageCanvas(c, { seed = 77, crack = 0.3, flake = 0.66, plaster = [214, 196, 160], fade = 0.12, cell = 48 } = {}) {
  const { width: W, height: H } = c;
  const g = c.getContext('2d');
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const n = makeNoise(seed);
  const ar = H / W;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      // crazing: the creases of a ridged noise, thin and branching
      const rdg = 1 - Math.abs(fbm(n, u * cell + 3, v * cell * ar, { octaves: 2 }) * 2 - 1);
      const cr = smooth(0.93, 0.99, rdg) * crack;
      const fl = smooth(flake, flake + 0.03, fbm(n, u * 5, v * 5 * ar, { octaves: 3 }));
      const fd = 0.86 + n(u * 6 + 9, v * 6 * ar) * 0.24;
      const i = (y * W + x) * 4;
      const t = fade + fl * (1 - fade);
      for (let ch = 0; ch < 3; ch++) d[i + ch] = mix(d[i + ch] * fd * (1 - cr), plaster[ch] * (0.92 + fd * 0.08) * (1 - cr * 0.5), t);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// The Council's floor, 16 m across: pale flags laid in rings, and inlaid in
// them in green-grey stone edged with gold, a ten-pointed star about the
// plinth, an amber leaf between each two of its points, a ring of small
// leaves inside the chairs, and gold rings marking the bands.
function courtCanvas(S = 1024, R = 8) {
  const c = makeCanvas(S);
  const n = makeNoise(51);
  const bands = [0.95, 1.7, 2.6, 3.5, 4.5, 4.95, 6.15, 7.05, 8.4];
  paintPixels(c, (u, v, out) => {
    const x = (u - 0.5) * 2 * R;
    const z = (v - 0.5) * 2 * R;
    const r = Math.hypot(x, z);
    const th = Math.atan2(z, x);
    let b = 0;
    while (b < bands.length - 1 && r > bands[b]) b++;
    const r0 = b ? bands[b - 1] : 0;
    const r1 = bands[b];
    const count = Math.max(1, Math.round((TAU * (r0 + r1)) / 2 / 1.1));
    const f = (((th / TAU + 1) * count + b * 0.37) % count + count) % count;
    const k = Math.floor(f);
    const fa = f - k;
    const dj = Math.min(r - r0, r1 - r, (Math.min(fa, 1 - fa) * TAU * r) / count);
    const joint = 1 - smooth(0.006, 0.035, dj);
    const tone = n(k * 3.7 + b * 11.1, b * 1.9) - 0.5;
    const cloud = fbm(n, u * 24, v * 24, { octaves: 2 }) - 0.5;
    const t = 0.9 + tone * 0.12 + cloud * 0.12 - joint * 0.3;
    const warm = b === 6 ? 0.96 : 1;
    out[0] = 240 * t;
    out[1] = 226 * t * warm;
    out[2] = 196 * t * warm * warm;
  });
  const g = c.getContext('2d');
  const gold = '#d0a650';
  g.save();
  g.translate(S / 2, S / 2);
  g.scale(S / (2 * R), S / (2 * R));
  g.lineJoin = 'round';
  // the star, its points faceted light and dark
  const P = 10;
  const ro = 4.3;
  const ri = 2.0;
  const at = (i, rr) => [Math.cos((i / (2 * P)) * TAU - TAU / 4) * rr, Math.sin((i / (2 * P)) * TAU - TAU / 4) * rr];
  for (let i = 0; i < 2 * P; i += 2) {
    const tip = at(i, ro);
    poly(g, [[0, 0], at(i - 1, ri), tip], '#4c6656');
    poly(g, [[0, 0], tip, at(i + 1, ri)], '#6a8672');
  }
  g.lineWidth = 0.05;
  g.strokeStyle = gold;
  g.beginPath();
  for (let i = 0; i <= 2 * P; i++) {
    const [x, y] = at(i, i % 2 ? ri : ro);
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.stroke();
  g.lineWidth = 0.025;
  for (let i = 0; i < 2 * P; i += 2) {
    g.beginPath();
    g.moveTo(...at(i, 1.25));
    g.lineTo(...at(i, ro));
    g.stroke();
  }
  // a disc of green marble in the middle, ringed in gold
  g.fillStyle = '#3c5a4c';
  g.beginPath();
  g.arc(0, 0, 1.25, 0, TAU);
  g.fill();
  g.lineWidth = 0.07;
  g.strokeStyle = gold;
  g.stroke();
  g.lineWidth = 0.03;
  g.beginPath();
  g.arc(0, 0, 1.05, 0, TAU);
  g.stroke();
  // amber leaves between the points
  for (let i = 1; i < 2 * P; i += 2) {
    const a = (i / (2 * P)) * TAU - TAU / 4;
    g.save();
    g.rotate(a);
    g.beginPath();
    g.moveTo(2.25, 0);
    g.bezierCurveTo(2.9, -0.42, 3.7, -0.3, 4.25, 0);
    g.bezierCurveTo(3.7, 0.3, 2.9, 0.42, 2.25, 0);
    g.fillStyle = '#b8783e';
    g.fill();
    g.lineWidth = 0.04;
    g.strokeStyle = gold;
    g.stroke();
    g.lineWidth = 0.025;
    g.beginPath();
    g.moveTo(2.3, 0);
    g.lineTo(4.15, 0);
    for (let k = 0; k < 4; k++) {
      const x = 2.7 + k * 0.35;
      g.moveTo(x, 0);
      g.lineTo(x + 0.22, -0.2);
      g.moveTo(x, 0);
      g.lineTo(x + 0.22, 0.2);
    }
    g.stroke();
    g.restore();
  }
  // gold rings, and a ring of small leaves between two of them
  g.strokeStyle = gold;
  for (const [rr, w] of [[4.5, 0.06], [4.95, 0.06], [7.05, 0.05], [7.25, 0.025]]) {
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, rr, 0, TAU);
    g.stroke();
  }
  const L = 64;
  for (let i = 0; i < L; i++) {
    g.save();
    g.rotate((i / L) * TAU);
    g.translate(4.72, 0);
    g.rotate(Math.PI / 2 + 0.5);
    g.beginPath();
    g.moveTo(-0.2, 0);
    g.quadraticCurveTo(0, -0.12, 0.2, 0);
    g.quadraticCurveTo(0, 0.12, -0.2, 0);
    g.fillStyle = i % 2 ? '#6a8456' : '#b06a34';
    g.fill();
    g.restore();
  }
  g.restore();
  return c;
}

// The painting in the hall of Narsil, in the manner of an old fresco: the
// last of the Last Alliance on the slopes of Orodruin. Sauron in his black
// armour towers against a sky of fire, reaching down; Isildur kneels by
// his fallen father and lifts the broken sword to cut the Ring from his
// hand. Flat colour in dark reds, ochres and gold, dark outlines, a painted
// border, then crazed and flaking with age.
function muralCanvas() {
  const W = 1024;
  const H = 512;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const r = rng(1234);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // the sky, fire behind the mountain darkening up into smoke
  let grd = g.createRadialGradient(330, 190, 10, 330, 190, 780);
  for (const [t, col] of [[0, '#f8d070'], [0.07, '#f0a040'], [0.2, '#c8582a'], [0.42, '#7a2416'], [0.72, '#3c120c'], [1, '#1e0806']]) grd.addColorStop(t, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(${18 + r() * 24},${6 + r() * 8},6,${0.1 + r() * 0.2})`;
    g.beginPath();
    g.ellipse(r() * W, r() * 280, 60 + r() * 170, 12 + r() * 26, (r() - 0.5) * 0.4, 0, TAU);
    g.fill();
  }
  // brushwork swirling round the fire
  for (let i = 0; i < 70; i++) {
    const a0 = r() * TAU;
    const rr = 60 + r() * 420;
    g.strokeStyle = r() < 0.5 ? `rgba(255,190,90,${0.05 + r() * 0.08})` : `rgba(60,14,8,${0.08 + r() * 0.1})`;
    g.lineWidth = 2 + r() * 5;
    g.beginPath();
    g.arc(330, 190, rr, a0, a0 + 0.3 + r() * 0.6);
    g.stroke();
  }
  // Orodruin
  poly(g, [[0, 410], [140, 330], [250, 210], [290, 166], [312, 160], [346, 161], [370, 170], [430, 236], [540, 330], [660, 405]], '#2e1912');
  poly(g, [[250, 210], [290, 166], [312, 160], [300, 230], [262, 300], [190, 360]], 'rgba(90,40,24,0.55)');
  grd = g.createRadialGradient(328, 158, 0, 328, 158, 110);
  grd.addColorStop(0, 'rgba(255,236,150,0.95)');
  grd.addColorStop(0.22, 'rgba(255,150,46,0.6)');
  grd.addColorStop(1, 'rgba(255,80,20,0)');
  g.fillStyle = grd;
  g.fillRect(200, 40, 260, 240);
  // the fire running down its sides
  g.shadowColor = '#ff6a10';
  g.shadowBlur = 10;
  for (let i = 0; i < 7; i++) {
    const x0 = 300 + r() * 56;
    let x = x0;
    let y = 166;
    g.strokeStyle = i % 2 ? '#ffb848' : '#ff8a2a';
    g.lineWidth = 2 + r() * 2.5;
    g.beginPath();
    g.moveTo(x, y);
    const dir = x0 < 328 ? -1 : 1;
    for (let k = 0; k < 9; k++) {
      x += dir * (8 + r() * 16);
      y += 16 + r() * 14;
      g.lineTo(x + (r() - 0.5) * 10, y);
    }
    g.stroke();
  }
  g.shadowBlur = 0;
  // the plume of smoke from the throat, rolling up and away
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `rgba(${50 + i * 2},${24 + i},${18 + i},${0.55 - i * 0.02})`;
    g.beginPath();
    g.arc(330 + i * 16 + Math.sin(i * 0.9) * 10, 150 - i * 8.5, 14 + i * 3.2, 0, TAU);
    g.fill();
  }
  // the host of the Alliance on the plain: spears, helms and banners
  for (let x = 14; x < 660; x += 4 + r() * 3) {
    const y = 404 - r() * 10 - (x > 400 ? (x - 400) * 0.02 : 0);
    g.strokeStyle = '#1a0c08';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 3, y - 30 - r() * 26);
    g.stroke();
    g.fillStyle = r() < 0.3 ? '#8a6a34' : '#1c0e0a';
    g.beginPath();
    g.arc(x, y + 2, 3, 0, TAU);
    g.fill();
    if (r() < 0.06) poly(g, [[x + 3, y - 54], [x + 18, y - 48], [x + 3, y - 40]], '#b08a3a');
  }
  // the ground: dark rock with fire in its cracks
  grd = g.createLinearGradient(0, 400, 0, H);
  grd.addColorStop(0, '#3a2016');
  grd.addColorStop(1, '#140a06');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, 418);
  for (let x = 0; x <= W; x += 32) g.lineTo(x, 412 + Math.sin(x * 0.03) * 6 + r() * 8 - (x > 560 ? 10 : 0));
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.closePath();
  g.fill();
  g.shadowColor = '#ff6a10';
  g.shadowBlur = 6;
  g.strokeStyle = '#e8762a';
  for (let i = 0; i < 9; i++) {
    let x = r() * W;
    let y = 430 + r() * 70;
    g.lineWidth = 1.2 + r();
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += 10 + r() * 20;
      y += (r() - 0.5) * 12;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.shadowBlur = 0;
  // Elendil, fallen, his sword broken under him
  poly(g, [[470, 474], [560, 464], [600, 470], [598, 484], [520, 488], [472, 488]], '#4e4a46', '#0c0806', 2);
  poly(g, [[540, 470], [600, 462], [612, 470], [596, 478]], '#6e1a12', '#0c0806', 1.5);
  g.fillStyle = '#7a766e';
  g.beginPath();
  g.arc(462, 478, 11, 0, TAU);
  g.fill();
  g.strokeStyle = '#0c0806';
  g.lineWidth = 2;
  g.stroke();
  poly(g, [[452, 470], [440, 458], [458, 466]], '#c8c4b4');
  poly(g, [[470, 470], [482, 456], [474, 470]], '#c8c4b4');
  // Sauron
  const dark = '#18100d';
  const ink = '#070403';
  const rim = '#a84a22';
  const gilt = '#d6a44c';
  // his cloak, billowing out behind him to the right
  g.beginPath();
  g.moveTo(735, 150);
  g.bezierCurveTo(800, 180, 850, 260, 900, 320);
  g.bezierCurveTo(930, 360, 960, 420, 990, 470);
  g.lineTo(940, 466);
  g.bezierCurveTo(910, 450, 880, 470, 850, 462);
  g.bezierCurveTo(820, 455, 800, 470, 780, 466);
  g.lineTo(740, 300);
  g.closePath();
  g.fillStyle = '#1e0c0a';
  g.fill();
  g.strokeStyle = ink;
  g.lineWidth = 3;
  g.stroke();
  g.strokeStyle = '#5a1810';
  g.lineWidth = 2;
  for (const [x0, y0, x1, y1] of [[760, 200, 840, 440], [790, 210, 900, 450], [820, 240, 950, 455]]) {
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2 + 20, (y0 + y1) / 2, x1, y1);
    g.stroke();
  }
  limb(g, [655, 282], [628, 372], 42, 32, dark, ink, 3);
  limb(g, [628, 372], [612, 456], 32, 25, dark, ink, 3);
  limb(g, [725, 282], [752, 372], 42, 32, dark, ink, 3);
  limb(g, [752, 372], [770, 456], 32, 25, dark, ink, 3);
  poly(g, [[592, 450], [634, 450], [642, 476], [574, 478]], dark, ink, 3);
  poly(g, [[752, 450], [792, 450], [812, 478], [746, 476]], dark, ink, 3);
  for (const [x, y, s] of [[618, 368, -1], [740, 368, 1]]) poly(g, [[x, y - 12], [x + s * 4 - 22, y + 2], [x, y + 12]], '#2a1a14', ink, 2);
  poly(g, [[640, 238], [740, 238], [772, 334], [746, 346], [722, 330], [700, 350], [680, 330], [656, 348], [634, 332], [608, 338]], '#211613', ink, 3);
  g.strokeStyle = '#3e2a20';
  g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(648 + i * 17, 246);
    g.lineTo(630 + i * 25, 332);
    g.stroke();
  }
  poly(g, [[646, 252], [734, 252], [764, 146], [616, 146]], dark, ink, 3);
  poly(g, [[640, 246], [740, 246], [742, 258], [638, 258]], '#2c1d16', ink, 2);
  g.strokeStyle = '#3a2820';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(690, 150);
  g.lineTo(690, 246);
  g.moveTo(640, 196);
  g.quadraticCurveTo(690, 214, 740, 196);
  g.stroke();
  // his pauldrons, spiked
  const pauldron = (m) => {
    const X = (x) => (m ? 1380 - x : x);
    poly(g, [[592, 176], [584, 140], [604, 110], [642, 102], [664, 122], [660, 160], [630, 180]].map(([x, y]) => [X(x), y]), '#1e1411', ink, 3);
    for (const [bx, by, tx, ty, cx, cy] of [[596, 120, 572, 82, 614, 110], [618, 108, 610, 66, 636, 104], [642, 104, 650, 70, 658, 116]]) poly(g, [[X(bx), by], [X(tx), ty], [X(cx), cy]], '#24160f', ink, 2);
    g.strokeStyle = rim;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(X(588), 150);
    g.quadraticCurveTo(X(596), 116, X(640), 106);
    g.stroke();
  };
  pauldron(false);
  pauldron(true);
  // the helm and its crown of spikes, the slit of fire in it
  for (let k = -3; k <= 3; k++) poly(g, [[690 + k * 8 - 4, 70 + Math.abs(k) * 2], [690 + k * 12, 22 + Math.abs(k) * 8], [690 + k * 8 + 4, 70 + Math.abs(k) * 2]], '#1c120e', ink, 2);
  poly(g, [[668, 132], [662, 94], [670, 66], [690, 58], [710, 66], [718, 94], [712, 132], [700, 140], [680, 140]], dark, ink, 3);
  g.strokeStyle = '#ff7a2a';
  g.shadowColor = '#ff5010';
  g.shadowBlur = 6;
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(674, 97);
  g.lineTo(686, 99);
  g.moveTo(694, 99);
  g.lineTo(706, 97);
  g.stroke();
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(690, 104);
  g.lineTo(690, 126);
  g.stroke();
  g.shadowBlur = 0;
  // gilt edges on the helm, the crown, the plates
  g.strokeStyle = gilt;
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(668, 128);
  g.lineTo(663, 94);
  g.lineTo(670, 67);
  g.lineTo(690, 59);
  g.moveTo(646, 252);
  g.lineTo(616, 146);
  g.moveTo(640, 238);
  g.lineTo(608, 338);
  g.stroke();
  // the arm raised with the mace
  limb(g, [758, 152], [812, 120], 36, 30, dark, ink, 3);
  limb(g, [812, 120], [842, 78], 30, 26, dark, ink, 3);
  g.strokeStyle = '#120a08';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(836, 88);
  g.lineTo(872, 44);
  g.stroke();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    poly(g, [[874 + Math.cos(a - 0.3) * 14, 40 + Math.sin(a - 0.3) * 14], [874 + Math.cos(a) * 30, 40 + Math.sin(a) * 30], [874 + Math.cos(a + 0.3) * 14, 40 + Math.sin(a + 0.3) * 14]], '#1c120e', ink, 2);
  }
  g.fillStyle = '#1e1410';
  g.beginPath();
  g.arc(874, 40, 17, 0, TAU);
  g.fill();
  g.strokeStyle = ink;
  g.lineWidth = 3;
  g.stroke();
  // the arm reaching down, its open hand, the Ring
  limb(g, [622, 156], [566, 208], 36, 30, dark, ink, 3);
  limb(g, [566, 208], [514, 248], 30, 24, dark, ink, 3);
  poly(g, [[524, 236], [530, 254], [506, 264], [498, 248]], '#2a1a14', ink, 2);
  for (const [a, b, w] of [[[500, 252], [476, 262], 7], [[502, 258], [480, 274], 7], [[506, 262], [490, 284], 6.5], [[512, 262], [506, 286], 6], [[512, 250], [518, 232], 6.5]]) limb(g, a, b, w, w * 0.75, '#22160f', ink, 1.5);
  g.strokeStyle = rim;
  g.lineWidth = 2;
  for (const [a, b] of [[[620, 150], [566, 202]], [[566, 202], [514, 242]], [[652, 286], [626, 370]], [[626, 370], [610, 452]], [[618, 150], [646, 250]]]) {
    g.beginPath();
    g.moveTo(a[0] - 14, a[1] - 4);
    g.lineTo(b[0] - 12, b[1] - 3);
    g.stroke();
  }
  g.strokeStyle = gilt;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(616, 146);
  g.lineTo(764, 146);
  g.moveTo(640, 238);
  g.lineTo(740, 238);
  g.stroke();
  // Isildur, kneeling, his red cloak behind him
  const bronze = '#a07c40';
  poly(g, [[404, 360], [390, 362], [356, 418], [322, 478], [392, 480], [404, 420]], '#7a2016', ink, 2);
  limb(g, [394, 424], [378, 466], 20, 16, '#5a4a36', ink, 2);
  limb(g, [378, 466], [340, 472], 15, 12, '#4a3a2a', ink, 2);
  limb(g, [400, 424], [436, 428], 20, 16, '#5a4a36', ink, 2);
  limb(g, [436, 428], [438, 468], 15, 12, '#4a3a2a', ink, 2);
  poly(g, [[430, 464], [452, 468], [452, 476], [428, 476]], '#3a2a1c', ink, 2);
  poly(g, [[384, 428], [414, 428], [424, 370], [396, 362]], bronze, ink, 2);
  g.strokeStyle = '#d8b060';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(400, 372);
  g.lineTo(404, 426);
  g.stroke();
  g.fillStyle = bronze;
  g.beginPath();
  g.arc(412, 350, 12, 0, TAU);
  g.fill();
  g.strokeStyle = ink;
  g.lineWidth = 2;
  g.stroke();
  poly(g, [[404, 340], [400, 326], [420, 338]], '#d8b060', ink, 1);
  limb(g, [394, 380], [380, 412], 11, 9, bronze, ink, 2);
  limb(g, [418, 372], [438, 340], 12, 10, bronze, ink, 2);
  limb(g, [438, 340], [452, 314], 10, 9, bronze, ink, 2);
  // the broken sword, lifted
  g.strokeStyle = '#3a2414';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(446, 322);
  g.lineTo(458, 306);
  g.stroke();
  g.strokeStyle = '#d8b060';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(446, 298);
  g.lineTo(466, 312);
  g.stroke();
  poly(g, [[454, 302], [462, 308], [480, 282], [476, 284], [474, 278], [470, 282]], '#dcdcd4', ink, 1.5);
  for (const [x, y, a] of [[360, 482, 0.2], [388, 488, -0.3], [414, 484, 0.1]]) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    poly(g, [[-12, -2], [12, -3], [10, 3], [-12, 2]], '#c8c8c0', ink, 1);
    g.restore();
  }
  // the Ring's glare, and its rays
  grd = g.createRadialGradient(484, 268, 0, 484, 268, 70);
  grd.addColorStop(0, 'rgba(255,252,220,1)');
  grd.addColorStop(0.12, 'rgba(255,220,120,0.9)');
  grd.addColorStop(0.4, 'rgba(255,150,50,0.32)');
  grd.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grd;
  g.fillRect(400, 190, 170, 160);
  g.strokeStyle = 'rgba(255,224,140,0.55)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + 0.1;
    const l0 = 12;
    const l1 = 40 + (i % 3) * 22;
    g.beginPath();
    g.moveTo(484 + Math.cos(a) * l0, 268 + Math.sin(a) * l0);
    g.lineTo(484 + Math.cos(a) * l1, 268 + Math.sin(a) * l1);
    g.stroke();
  }
  g.strokeStyle = '#ffd860';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(484, 268, 4, 0, TAU);
  g.stroke();
  // the painted border: dark red, gold lines, a running scroll of leaves
  g.fillStyle = '#4a140e';
  for (const [x, y, w, h] of [[0, 0, W, 22], [0, H - 22, W, 22], [0, 0, 22, H], [W - 22, 0, 22, H]]) g.fillRect(x, y, w, h);
  g.strokeStyle = gilt;
  g.lineWidth = 2;
  g.strokeRect(3, 3, W - 6, H - 6);
  g.strokeRect(20, 20, W - 40, H - 40);
  g.lineWidth = 1.6;
  const scroll = (x, y, a) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.moveTo(-9, 0);
    g.bezierCurveTo(-4, -8, 4, -8, 5, -1);
    g.bezierCurveTo(5, 3, 0, 3, 0, 0);
    g.stroke();
    g.beginPath();
    g.moveTo(5, 0);
    g.quadraticCurveTo(10, 4, 13, 0);
    g.quadraticCurveTo(10, -1, 5, 0);
    g.stroke();
    g.restore();
  };
  for (let x = 30; x < W - 20; x += 26) {
    scroll(x, 11, 0);
    scroll(x, H - 11, Math.PI);
  }
  for (let y = 34; y < H - 20; y += 26) {
    scroll(11, y, -Math.PI / 2);
    scroll(W - 11, y, Math.PI / 2);
  }
  return ageCanvas(c, { seed: 78, crack: 0.3, flake: 0.82, fade: 0.08, cell: 48 });
}

// Bilbo's map, of the Lonely Mountain and the lands about it, in brown ink
// on old parchment: the Mountain with its spurs and the dragon over it,
// the river running from it, the forest, the Grey Mountains, a compass,
// lines of runes and of writing.
function mapCanvas() {
  const W = 512;
  const H = 384;
  const c = makeCanvas(W, H);
  const n = makeNoise(61);
  paintPixels(c, (u, v, out) => {
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const burn = 1 - smooth(0, 0.07, edge + (n(u * 20, v * 20) - 0.5) * 0.03);
    const stain = smooth(0.55, 0.8, fbm(n, u * 4 + 3, v * 3, { octaves: 4 }));
    const t = 0.94 - burn * 0.45 - stain * 0.12 + (n(u * 120, v * 90) - 0.5) * 0.05;
    out[0] = 236 * t;
    out[1] = 214 * t;
    out[2] = 164 * t;
  });
  const g = c.getContext('2d');
  const r = rng(62);
  const ink = '#5a3a1c';
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 2;
  g.strokeRect(16, 16, W - 32, H - 32);
  g.lineWidth = 1;
  g.strokeRect(22, 22, W - 44, H - 44);
  // the Mountain: its peak and six spurs, hatched
  const [mx, my] = [300, 170];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.4;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(mx, my);
    const ex = mx + Math.cos(a) * 70;
    const ey = my + Math.sin(a) * 52;
    g.quadraticCurveTo(mx + Math.cos(a + 0.3) * 40, my + Math.sin(a + 0.3) * 30, ex, ey);
    g.stroke();
    g.lineWidth = 0.8;
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const px = mix(mx, ex, t);
      const py = mix(my, ey, t);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + Math.cos(a + 1.2) * 8, py + Math.sin(a + 1.2) * 8);
      g.stroke();
    }
  }
  // the dragon, in red, over the Mountain
  g.fillStyle = '#a8281c';
  g.beginPath();
  g.moveTo(262, 92);
  g.bezierCurveTo(290, 70, 320, 96, 350, 80);
  g.bezierCurveTo(342, 92, 318, 104, 290, 100);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(300, 88);
  g.lineTo(316, 52);
  g.lineTo(326, 70);
  g.lineTo(336, 50);
  g.lineTo(330, 86);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(350, 80);
  g.lineTo(366, 74);
  g.lineTo(358, 84);
  g.fill();
  // the river, south and away
  g.strokeStyle = ink;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(mx + 10, my + 30);
  for (let i = 1; i < 14; i++) g.lineTo(mx + 10 + Math.sin(i * 0.9) * 14 + i * 6, my + 30 + i * 12);
  g.stroke();
  // the forest: little trees
  for (let i = 0; i < 46; i++) {
    const x = 50 + r() * 150;
    const y = 200 + r() * 130;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y + 6);
    g.lineTo(x, y + 12);
    g.stroke();
    g.beginPath();
    g.arc(x, y + 2, 4, 0, TAU);
    g.stroke();
  }
  // the Grey Mountains along the top
  for (let x = 40; x < 470; x += 14 + r() * 6) {
    g.beginPath();
    g.moveTo(x, 58);
    g.lineTo(x + 7, 42 - r() * 6);
    g.lineTo(x + 14, 58);
    g.stroke();
  }
  // a compass
  g.save();
  g.translate(430, 300);
  for (let k = 0; k < 8; k++) {
    g.rotate(Math.PI / 4);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(3, -6);
    g.lineTo(0, k % 2 ? -16 : -28);
    g.lineTo(-3, -6);
    g.closePath();
    if (k % 2) g.stroke();
    else g.fill();
  }
  g.restore();
  // runes, and lines of writing
  const runes = (x, y, len, size = 7) => {
    g.lineWidth = 1.2;
    for (let i = 0; i < len; i++) {
      const px = x + i * size * 1.3;
      g.beginPath();
      g.moveTo(px, y);
      g.lineTo(px, y - size);
      const k = Math.floor(r() * 4);
      if (k === 0) g.lineTo(px + size * 0.6, y - size * 0.6);
      if (k === 1) {
        g.moveTo(px, y - size * 0.5);
        g.lineTo(px + size * 0.6, y - size);
      }
      if (k === 2) {
        g.moveTo(px, y - size * 0.3);
        g.lineTo(px + size * 0.6, y - size * 0.7);
        g.lineTo(px + size * 0.6, y);
      }
      if (k === 3) {
        g.moveTo(px + size * 0.6, y);
        g.lineTo(px + size * 0.6, y - size);
        g.lineTo(px, y - size * 0.5);
      }
      g.stroke();
    }
  };
  runes(40, 352, 22);
  runes(300, 352, 12);
  const writing = (x, y, w) => {
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(x, y);
    for (let px = x; px < x + w; px += 3) g.lineTo(px, y + Math.sin(px * 1.7) * 1.5 + (r() - 0.5) * 2);
    g.stroke();
  };
  for (let i = 0; i < 4; i++) writing(380, 96 + i * 12, 90 - i * 10);
  for (let i = 0; i < 3; i++) writing(48, 120 + i * 12, 100);
  g.strokeStyle = 'rgba(120,150,190,0.45)';
  runes(230, 260, 8, 9);
  return c;
}

// An open book: two cream pages in a neat hand, a heading on the left
// one, a little drawing of a mountain on the right, the gutter shadowed.
function bookCanvas() {
  const W = 256;
  const H = 160;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, '#d8c8a0');
  grd.addColorStop(0.08, '#f2e8cc');
  grd.addColorStop(0.46, '#ece0c0');
  grd.addColorStop(0.5, '#b8a47c');
  grd.addColorStop(0.54, '#ece0c0');
  grd.addColorStop(0.92, '#f2e8cc');
  grd.addColorStop(1, '#d8c8a0');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  const r = rng(71);
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = 1;
  for (const x0 of [14, 142]) {
    for (let y = 22; y < H - 14; y += 8) {
      if (x0 > 100 && y > 40 && y < 92) continue;
      let x = x0;
      const end = x0 + 98 - (y === 22 && x0 < 100 ? 40 : r() * 10);
      while (x < end) {
        const w = 6 + r() * 16;
        g.beginPath();
        g.moveTo(x, y);
        for (let px = x; px < Math.min(end, x + w); px += 2) g.lineTo(px, y + Math.sin(px * 2.1) * 1.2);
        g.stroke();
        x += w + 3;
      }
    }
  }
  g.lineWidth = 2;
  g.strokeStyle = '#7a2a1a';
  g.beginPath();
  g.moveTo(30, 12);
  g.bezierCurveTo(50, 6, 70, 18, 90, 10);
  g.stroke();
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(160, 88);
  g.lineTo(185, 50);
  g.lineTo(198, 68);
  g.lineTo(210, 56);
  g.lineTo(232, 88);
  g.stroke();
  return c;
}

// A rug: a deep red field, a border of leaves in old gold, a green and
// gold leaf-star in the middle, fringes at the ends.
function rugCanvas() {
  const W = 256;
  const H = 160;
  const c = makeCanvas(W, H);
  const n = makeNoise(81);
  paintPixels(c, (u, v, out) => {
    const k = 0.85 + n(u * 60, v * 40) * 0.2;
    out[0] = 128 * k;
    out[1] = 36 * k;
    out[2] = 26 * k;
  });
  const g = c.getContext('2d');
  g.fillStyle = '#c8a04a';
  g.fillRect(12, 10, W - 24, 6);
  g.fillRect(12, H - 16, W - 24, 6);
  g.fillRect(12, 10, 6, H - 20);
  g.fillRect(W - 18, 10, 6, H - 20);
  g.fillStyle = '#d4b060';
  for (let x = 26; x < W - 26; x += 14) {
    for (const y of [26, H - 26]) {
      g.beginPath();
      g.ellipse(x, y, 5, 2.5, 0.6, 0, TAU);
      g.fill();
    }
  }
  g.save();
  g.translate(W / 2, H / 2);
  for (let k = 0; k < 8; k++) {
    g.rotate(Math.PI / 4);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(10, -20, 0, -42);
    g.quadraticCurveTo(-10, -20, 0, 0);
    g.fillStyle = k % 2 ? '#4a6a44' : '#d4b060';
    g.fill();
  }
  g.restore();
  g.strokeStyle = '#e8dcc0';
  g.lineWidth = 1.5;
  for (let y = 12; y < H - 12; y += 4) {
    for (const [x0, x1] of [[0, 8], [W - 8, W]]) {
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      g.stroke();
    }
  }
  return c;
}

// The Ring's inscription, in a flowing elvish hand (made up, as near as a
// few strokes can be): stems, bows and marks above, in fire on black, to
// light its emissive glow. Wraps once round the band.
function inscriptionCanvas() {
  const W = 512;
  const H = 64;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#ffc060';
  g.fillStyle = '#ffc060';
  g.lineWidth = 2.6;
  g.lineCap = 'round';
  g.shadowColor = '#ff6a10';
  g.shadowBlur = 5;
  const r = rng(66);
  const top = 22;
  const base = 40;
  let x = 8;
  while (x < W - 18) {
    const k = r();
    g.beginPath();
    // a stem, up or down or neither
    const up = k < 0.3;
    const down = k > 0.3 && k < 0.5;
    g.moveTo(x, up ? top - 10 : top);
    g.lineTo(x, down ? base + 10 : base);
    g.stroke();
    // one or two bows, open to either side, or a hooked top
    const kind = r();
    const bows = 1 + (r() < 0.4 ? 1 : 0);
    let w = 6;
    if (kind < 0.55) {
      for (let b = 0; b < bows; b++) {
        g.beginPath();
        g.arc(x + 5 + b * 8, 31, 6, -Math.PI / 2, Math.PI / 2);
        g.stroke();
      }
      w = 6 + bows * 8;
    } else if (kind < 0.8) {
      g.beginPath();
      g.moveTo(x, top);
      g.bezierCurveTo(x + 12, top - 2, x + 12, top + 12, x + 2, top + 10);
      g.stroke();
      w = 12;
    } else {
      g.beginPath();
      g.moveTo(x, base);
      g.bezierCurveTo(x + 10, base + 2, x + 12, top + 6, x + 4, top + 4);
      g.stroke();
      w = 12;
    }
    // a mark above: a dot, a stroke, a curl
    const m = r();
    g.beginPath();
    if (m < 0.25) g.arc(x + w / 2, top - 8, 1.8, 0, TAU);
    else if (m < 0.45) {
      g.moveTo(x + w / 2 - 3, top - 6);
      g.lineTo(x + w / 2 + 3, top - 11);
    } else if (m < 0.6) g.arc(x + w / 2, top - 8, 3.5, Math.PI, TAU);
    g.stroke();
    x += w + 5 + (r() < 0.16 ? 9 : 0);
  }
  return c;
}

// A page of notes, scribbled over.
function notesCanvas() {
  const S = 128;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  g.fillStyle = '#efe4c8';
  g.fillRect(0, 0, S, S);
  const r = rng(91);
  g.strokeStyle = '#4a3420';
  g.lineWidth = 1;
  for (let y = 14; y < S - 8; y += 7) {
    let x = 10;
    const end = S - 10 - r() * 20;
    while (x < end) {
      const w = 5 + r() * 14;
      g.beginPath();
      g.moveTo(x, y);
      for (let px = x; px < Math.min(end, x + w); px += 2) g.lineTo(px, y + Math.sin(px * 2.3) * 1.1);
      g.stroke();
      x += w + 3;
    }
  }
  return c;
}

export { elfstoneCanvas, blurField, fieldOf, carvingCanvas, traceryCanvas, archFillCanvas, glassCanvas, roofCanvas, rockCanvas, linenCanvas, skyCanvas, puffCanvas, shaftCanvas, poly, limb, ageCanvas, courtCanvas, muralCanvas, mapCanvas, bookCanvas, rugCanvas, inscriptionCanvas, notesCanvas };
