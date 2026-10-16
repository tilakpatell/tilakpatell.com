// Planet surfaces for the 3D Death Star page, painted at start on canvases.
// Each texel is a point on the sphere, and the noise is sampled there in 3D,
// so the maps have no seam at the date line and no pinching at the poles.
// A planet comes as colour, relief (a normal map), roughness (oceans shine,
// land doesn't) and, where it has weather, a separate layer of clouds.
import { heightToNormal, rng } from '../../lib/texture';

function noise3(seed) {
  const rand = rng(seed);
  const perm = new Uint16Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = Float32Array.from({ length: 256 }, () => rand());
  const at = (x, y, z) => val[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const u = s(x - xi);
    const v = s(y - yi);
    const w = s(z - zi);
    const l = (a, b, k) => a + (b - a) * k;
    return l(
      l(l(at(xi, yi, zi), at(xi + 1, yi, zi), u), l(at(xi, yi + 1, zi), at(xi + 1, yi + 1, zi), u), v),
      l(l(at(xi, yi, zi + 1), at(xi + 1, yi, zi + 1), u), l(at(xi, yi + 1, zi + 1), at(xi + 1, yi + 1, zi + 1), u), v),
      w,
    );
  };
}

const fbm = (n, x, y, z, octaves = 5) => {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * n(x * f, y * f, z * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum / (1 - 0.5 ** octaves);
};

const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (stops, t) => {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return stops[stops.length - 1][1];
};
const R = (list) => list.map(([t, c]) => [t, hex(c)]);

// sea: below this height is water; ice: the latitude the caps start at
const LOOKS = {
  alderaan: {
    seed: 21, scale: 1.6, sea: 0.5, ice: 0.8, clouds: 0.56, cloudSeed: 5,
    water: R([[0, '#071f44'], [0.75, '#15457f'], [1, '#2f78b8']]),
    land: R([[0, '#c9c08a'], [0.08, '#4f8a3f'], [0.45, '#2f6a33'], [0.7, '#7a6c48'], [0.88, '#9a948a'], [1, '#e8ecef']]),
  },
  yavin: {
    seed: 33, scale: 2.2, sea: 0.34, ice: 0.94, clouds: 0.52, cloudSeed: 8,
    water: R([[0, '#0d3340'], [1, '#2a6b74']]),
    land: R([[0, '#3f6b33'], [0.25, '#2c5a26'], [0.55, '#1e461c'], [0.8, '#4d5e34'], [1, '#77805a']]),
  },
  endor: {
    seed: 47, scale: 2.4, sea: 0.3, ice: 0.9, clouds: 0.58, cloudSeed: 13,
    water: R([[0, '#10303a'], [1, '#2f6070']]),
    land: R([[0, '#3c6430'], [0.3, '#264a20'], [0.62, '#1b3818'], [0.82, '#5c6448'], [1, '#9aa08c']]),
  },
  tatooine: {
    seed: 58, scale: 1.4, sea: -1, ice: 2, clouds: 0, cloudSeed: 0, dunes: true,
    land: R([[0, '#f3dfb4'], [0.3, '#e4bf83'], [0.55, '#cf9d5d'], [0.78, '#a8723f'], [1, '#6e4524']]),
  },
  hoth: {
    seed: 64, scale: 1.8, sea: -1, ice: 2, clouds: 0.62, cloudSeed: 17, frozen: true,
    land: R([[0, '#f6f9fc'], [0.45, '#dfe9f2'], [0.7, '#b9cbdb'], [0.86, '#7d8e9f'], [1, '#4b5663']]),
  },
};

export function paintPlanet(id, { w = 1024, h = 512 } = {}) {
  const L = LOOKS[id] ?? LOOKS.alderaan;
  const n = noise3(L.seed);
  const warp = noise3(L.seed + 1);
  const color = document.createElement('canvas');
  color.width = w;
  color.height = h;
  const cx = color.getContext('2d');
  const img = cx.createImageData(w, h);
  const height = new Uint8ClampedArray(w * h * 4);
  const rough = document.createElement('canvas');
  rough.width = w;
  rough.height = h;
  const rx = rough.getContext('2d');
  const rimg = rx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - (y + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat);
    const sy = Math.sin(lat);
    for (let x = 0; x < w; x++) {
      const lon = ((x + 0.5) / w) * Math.PI * 2;
      const px = cl * Math.cos(lon) * L.scale;
      const pz = cl * Math.sin(lon) * L.scale;
      const py = sy * L.scale;
      // a little domain warping, so coasts and ridges wander
      const wx = fbm(warp, px + 3.1, py, pz, 3) - 0.5;
      const e = fbm(n, px + wx * 0.9, py + wx * 0.6, pz - wx * 0.9, 6);
      let c;
      let hgt;
      let r;
      if (L.dunes) {
        // long dune bands across the latitudes, rocky mesas where it's high
        const band = Math.sin((sy * 18 + e * 7) * Math.PI) * 0.5 + 0.5;
        const t = Math.min(1, e * 0.85 + band * 0.18);
        c = ramp(L.land, t);
        hgt = t;
        r = 0.92;
      } else if (L.frozen) {
        // ice sheets with blue crevasses, dark rock poking through the high ground
        const ridge = 1 - Math.abs(fbm(n, px * 2.2, py * 2.2, pz * 2.2, 4) * 2 - 1);
        const t = Math.min(1, e * 0.7 + ridge ** 6 * 0.45);
        c = ramp(L.land, t);
        hgt = t;
        r = t > 0.85 ? 0.85 : 0.45;
      } else if (e < L.sea) {
        c = ramp(L.water, e / L.sea);
        hgt = L.sea;
        r = 0.22;
      } else {
        const t = (e - L.sea) / (1 - L.sea);
        c = ramp(L.land, Math.min(1, t * 1.25));
        hgt = e;
        r = 0.88;
      }
      // the polar caps, ragged at the edge
      const capAt = L.ice + (fbm(n, px * 3, py * 3, pz * 3, 3) - 0.5) * 0.12;
      if (Math.abs(sy) > capAt) {
        const k = Math.min(1, (Math.abs(sy) - capAt) * 14);
        c = mix(c, [236, 242, 247], k);
        r = 0.55;
      }
      const i = (y * w + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
      height[i] = height[i + 1] = height[i + 2] = hgt * 255;
      height[i + 3] = 255;
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = r * 255;
      rimg.data[i + 3] = 255;
    }
  }
  cx.putImageData(img, 0, 0);
  rx.putImageData(rimg, 0, 0);
  const normal = document.createElement('canvas');
  normal.width = w;
  normal.height = h;
  const nx = normal.getContext('2d');
  const nimg = nx.createImageData(w, h);
  nimg.data.set(heightToNormal(height, w, h, L.dunes ? 2.2 : 3.2));
  nx.putImageData(nimg, 0, 0);
  return { color, normal, rough, clouds: L.clouds ? paintClouds(L, Math.max(256, w / 2), Math.max(128, h / 2)) : null };
}

// Weather: white where the noise is high, soft at the edges, in streaks
// that run along the latitudes.
function paintClouds(L, w, h) {
  const n = noise3(L.cloudSeed + 100);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x2 = c.getContext('2d');
  const img = x2.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - (y + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat);
    const sy = Math.sin(lat);
    for (let x = 0; x < w; x++) {
      const lon = ((x + 0.5) / w) * Math.PI * 2;
      const v = fbm(n, cl * Math.cos(lon) * 2.4, sy * 6, cl * Math.sin(lon) * 2.4, 5);
      const a = Math.max(0, Math.min(1, (v - L.clouds) * 5));
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 235;
    }
  }
  x2.putImageData(img, 0, 0);
  return c;
}

// The gas giants the moons orbit: bands along the latitudes, torn at their
// edges into eddies by warped noise, with a few oval storms. Yavin is warm
// cream and rust; Endor's giant is blue-grey.
const GIANTS = {
  yavin: { seed: 71, colors: R([[0, '#f1dcb6'], [0.22, '#d9a46a'], [0.4, '#b9733f'], [0.58, '#ecc995'], [0.75, '#9a5a2f'], [0.9, '#d8b07d'], [1, '#f4e2c0']]) },
  endor: { seed: 83, colors: R([[0, '#dde9ee'], [0.25, '#9fbcc6'], [0.45, '#6f949f'], [0.62, '#b9d0d7'], [0.8, '#557985'], [1, '#c9dce1']]) },
};

export function paintGiant(id, { w = 1024, h = 512 } = {}) {
  const G = GIANTS[id] ?? GIANTS.yavin;
  const n = noise3(G.seed);
  const warp = noise3(G.seed + 7);
  const rand = rng(G.seed);
  const storms = Array.from({ length: 5 }, () => ({ lat: (rand() - 0.5) * 1.6, lon: rand() * Math.PI * 2, rx: 0.18 + rand() * 0.22, ry: 0.05 + rand() * 0.05, dark: rand() < 0.5 }));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  const img = x.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - (y + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat);
    const sy = Math.sin(lat);
    for (let xx = 0; xx < w; xx++) {
      const lon = ((xx + 0.5) / w) * Math.PI * 2;
      const px = cl * Math.cos(lon);
      const pz = cl * Math.sin(lon);
      // eddies: the latitude is pushed about by noise, more at band edges
      const turb = fbm(warp, px * 3, sy * 9, pz * 3, 5) - 0.5;
      const fine = fbm(n, px * 9, sy * 30, pz * 9, 4) - 0.5;
      let t = sy * 0.5 + 0.5 + turb * 0.09 + fine * 0.025;
      t = (t * 4.2) % 1;
      let col = ramp(G.colors, t);
      for (const s of storms) {
        let dl = lon - s.lon;
        dl = Math.atan2(Math.sin(dl), Math.cos(dl));
        const d = (dl / s.rx) ** 2 + ((lat - s.lat) / s.ry) ** 2;
        if (d < 1) col = mix(col, s.dark ? [120, 66, 40] : [246, 232, 210], (1 - d) * 0.65);
      }
      const shade = 0.92 + fine * 0.3;
      const i = (y * w + xx) * 4;
      img.data[i] = col[0] * shade;
      img.data[i + 1] = col[1] * shade;
      img.data[i + 2] = col[2] * shade;
      img.data[i + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
