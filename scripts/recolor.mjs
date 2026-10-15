// A model's colours brought to the films': for each rule, the base-colour
// map of every material whose name matches is scaled, channel by channel in
// linear light, so that its mean comes out the rule's albedo (its stains,
// grain and shading kept, only shifted), blended by `amount`; a material
// with no map has its colour factor set instead. Used by the galaxy's
// surface imports (scripts/sketchfab-surface.mjs, scripts/meshy-galaxy-
// buildings.mjs) with a catalogue entry's `recolor`:
//   [{ material: 'regex source' | '*', to: '#rrggbb' (sRGB albedo), amount: 0…1,
//      band: [lo, hi] (only texels of that saturation move: plaster, not
//            paint; the whole map's mean is aimed at `to`),
//      where: { hue: [lo, hi] (degrees), sat, val, soft } | 'rest' (only the
//            texels of that colour, and their own mean aimed at `to`: a
//            copper dome on a map that's mostly stone; 'rest' is every
//            texel an earlier rule didn't take; sat and val are floors),
//      grey: true (with `where`: its texels greyed first, then aimed at `to`:
//            moss taken off concrete) }]
// Rules with `where` on the same material all apply, in order, each taking
// its texels from what's left; otherwise a material takes its first rule.
// A map shared with a material no rule matches is copied first, so only the
// matched ones change. Deterministic: run on the same source, the same out.
//
//   recolorDoc(doc, rules) → [{ material, from: '#…', to: '#…' }] (what it did)

import sharp from 'sharp';

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const hexOf = (lin) => `#${lin.map((v) => Math.round(Math.max(0, Math.min(1, toSrgb(v))) * 255).toString(16).padStart(2, '0')).join('')}`;
const linOf = (hex) => [1, 3, 5].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255));

const matches = (rule, name) => rule.material === '*' || new RegExp(rule.material, 'i').test(name ?? '');

// the map's pixels as RGBA bytes, and each texel's weight: 1, or (a rule's
// `band`: [lo, hi] of HSV saturation) 1 inside the band, falling to 0 over
// 0.06 outside it, so the plaster moves and a painted door or grey pipes don't
async function source(texture, band) {
  const { data, info } = await sharp(Buffer.from(texture.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const weights = new Float32Array(data.length / 4).fill(1);
  if (band)
    for (let i = 0; i < weights.length; i++) {
      const [r, g, b] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
      const max = Math.max(r, g, b);
      const sat = max ? (max - Math.min(r, g, b)) / max : 0;
      weights[i] = Math.max(0, Math.min(1, (sat - (band[0] - 0.06)) / 0.06, (band[1] + 0.06 - sat) / 0.06));
    }
  return { data, info, weights };
}
// the source scaled by k (linear, per channel, each texel by its weight)
function scaled({ data, weights }, k) {
  const out = Buffer.from(data);
  for (let i = 0; i < weights.length; i++)
    for (let c = 0; c < 3; c++) {
      const kk = 1 + weights[i] * (k[c] - 1);
      out[i * 4 + c] = Math.round(toSrgb(Math.min(1, toLin(data[i * 4 + c] / 255) * kk)) * 255);
    }
  return out;
}
// raw RGBA bytes' mean colour, linear
async function meanRaw(buf, info) {
  const { data, info: ii } = await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } }).removeAlpha().resize(128, 128, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const s = [0, 0, 0];
  for (let i = 0; i < data.length; i += ii.channels) for (let c = 0; c < 3; c++) s[c] += toLin(data[i + c] / 255);
  const n = data.length / ii.channels;
  return s.map((v) => v / n);
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// each texel's hue (degrees), saturation and value, from its sRGB bytes
function hsvOf(data) {
  const n = data.length / 4;
  const h = new Float32Array(n);
  const sv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const [r, g, b] = [data[i * 4] / 255, data[i * 4 + 1] / 255, data[i * 4 + 2] / 255];
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    let hue = 0;
    if (d > 0) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h[i] = (hue * 60 + 360) % 360;
    sv[i * 2] = max ? d / max : 0;
    sv[i * 2 + 1] = max;
  }
  return { h, sv };
}
// a `where` rule's weights over the map, taking only what earlier rules left
function weightsOf(where, hsv, taken) {
  const n = taken.length;
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let x = 1;
    if (where && where !== 'rest') {
      const soft = where.soft ?? 10;
      const [lo, hi] = where.hue ?? [0, 360];
      const hue = hsv.h[i];
      x = Math.max(0, Math.min(1, (hue - (lo - soft)) / soft, (hi + soft - hue) / soft));
      if (where.sat != null) x *= smooth(where.sat, where.sat * 2, hsv.sv[i * 2]);
      if (where.val != null) x *= smooth(where.val, where.val + 0.1, hsv.sv[i * 2 + 1]);
    }
    w[i] = x * (1 - taken[i]);
    taken[i] += w[i];
  }
  return w;
}
// the weighted linear mean of the bytes
function weightedMean(data, w) {
  const s = [0, 0, 0];
  let t = 0;
  for (let i = 0; i < w.length; i++) {
    if (!w[i]) continue;
    for (let c = 0; c < 3; c++) s[c] += w[i] * toLin(data[i * 4 + c] / 255);
    t += w[i];
  }
  return s.map((v) => v / Math.max(t, 1e-9));
}

// several `where` rules on one map: each texel scaled by its rules' factors,
// weighted, each rule's own mean found again a few times over
async function recolorWhere(tex, factor, rules) {
  const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const hsv = hsvOf(data);
  const taken = new Float32Array(data.length / 4);
  const ws = rules.map((r) => weightsOf(r.where, hsv, taken));
  // (a `grey` rule's texels first lose their colour, keeping their light and
  // shade, so moss comes out stone and not a tinted moss)
  rules.forEach((r, j) => {
    if (!r.grey) return;
    for (let i = 0; i < ws[j].length; i++) {
      if (!ws[j][i]) continue;
      const lin = [0, 1, 2].map((c) => toLin(data[i * 4 + c] / 255));
      const l = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
      for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(toSrgb(lin[c] + (l - lin[c]) * ws[j][i]) * 255);
    }
  });
  const goals = rules.map((r, j) => {
    const m = weightedMean(data, ws[j]).map((v, c) => v * factor[c]);
    const to = linOf(r.to);
    return { first: m, goal: m.map((v, c) => v + (to[c] - v) * (r.amount ?? 1)) };
  });
  const ks = rules.map(() => [1, 1, 1]);
  const lut = new Float32Array(256).map((_, v) => toLin(v / 255));
  let out = Buffer.from(data);
  for (let pass = 0; pass < 6; pass++) {
    let close = true;
    rules.forEach((_, j) => {
      const m = weightedMean(out, ws[j]).map((v, c) => v * factor[c]);
      if (!m.every((v, c) => Math.abs(v - goals[j].goal[c]) <= 0.003)) close = false;
      ks[j] = ks[j].map((v, c) => (v * goals[j].goal[c]) / Math.max(m[c], 1e-4));
    });
    if (close && pass) break;
    out = Buffer.from(data);
    for (let i = 0; i < ws[0].length; i++)
      for (let c = 0; c < 3; c++) {
        let k = 1;
        for (let j = 0; j < rules.length; j++) k += ws[j][i] * (ks[j][c] - 1);
        out[i * 4 + c] = Math.round(toSrgb(Math.min(1, lut[data[i * 4 + c]] * k)) * 255);
      }
  }
  tex.setImage(await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()).setMimeType('image/png');
  return goals.map((g, j) => ({ from: hexOf(g.first), to: hexOf(g.goal), where: rules[j].where }));
}

export async function recolorDoc(doc, rules = []) {
  const done = [];
  if (!rules?.length) return done;
  const root = doc.getRoot();
  for (const mat of root.listMaterials()) {
    const mine = rules.filter((r) => matches(r, mat.getName()));
    const rule = mine[0];
    if (!rule) continue;
    const to = linOf(rule.to);
    const amount = rule.amount ?? 1;
    const factor = mat.getBaseColorFactor();
    let tex = mat.getBaseColorTexture();
    if (!tex) {
      // (no map: the colour factor is the colour)
      const from = factor.slice(0, 3);
      mat.setBaseColorFactor([...from.map((v, c) => v + (to[c] - v) * amount), factor[3]]);
      done.push({ material: mat.getName(), from: hexOf(from), to: rule.to });
      continue;
    }
    // (a map another material keeps as it is: a copy of its own to change)
    const users = root.listMaterials().filter((m) => m.getBaseColorTexture() === tex);
    if (users.some((m) => m !== mat && !rules.some((r) => matches(r, m.getName())))) {
      const copy = doc.createTexture(`${tex.getName()}-recolored`).setImage(tex.getImage()).setMimeType(tex.getMimeType());
      mat.setBaseColorTexture(copy);
      tex = copy;
    } else if (users.indexOf(mat) > 0) continue; // (a shared map changed once, for the first of its materials)
    if (mine.some((r) => r.where)) {
      for (const d of await recolorWhere(tex, factor, mine)) done.push({ material: `${mat.getName()} ${JSON.stringify(d.where ?? 'all')}`, from: d.from, to: d.to });
      continue;
    }
    // what the eye sees is the map times the factor: aim that at `to`, k
    // found again a few times over (the brightest texels clip short of it)
    const src = await source(tex, rule.band);
    const first = (await meanRaw(src.data, src.info)).map((v, c) => v * factor[c]);
    const goal = first.map((v, c) => v + (to[c] - v) * amount);
    let k = [1, 1, 1];
    let buf = src.data;
    for (let pass = 0; pass < 6; pass++) {
      const mean = (await meanRaw(buf, src.info)).map((v, c) => v * factor[c]);
      if (mean.every((v, c) => Math.abs(v - goal[c]) <= 0.003)) break;
      k = k.map((v, c) => (v * goal[c]) / Math.max(mean[c], 1e-4));
      buf = scaled(src, k);
    }
    tex.setImage(await sharp(buf, { raw: { width: src.info.width, height: src.info.height, channels: 4 } }).png().toBuffer()).setMimeType('image/png');
    done.push({ material: mat.getName(), from: hexOf(first), to: hexOf(goal) });
  }
  return done;
}
