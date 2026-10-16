// rv.js on the node renderer: the cab’s surfaces painted on canvases at
// load (the moulded plastic, the carpet, the velour, the headliner, the
// curtains, the weathered wood, the road’s markings and the ground’s
// large-scale variation), copied line for line. Canvases only: nothing
// differs on the node renderer.

import { painted, rng } from '../kitNodes';
import { LINE_TILE, ROAD_W, TAU } from './rvNodesKit';

// ── painted surfaces ──

// fine noise over what's drawn, the same in each channel (grain, fibres)
function grain(g, W, H, r, amp) {
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 2 * amp;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// soft blots of colour ('r,g,b,a'), for mottling and wear
function blots(g, W, H, r, n, colors, size) {
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = size * (0.3 + r());
    const c = colors[i % colors.length];
    const rgb = c.split(',').slice(0, 3).join(',');
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${c})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

// moulded plastic, the dash's and the trim's: a fine pebbled grain over a
// slightly mottled tan (other colours tint it)
export function mouldedMaps(seed) {
  const r = rng(seed);
  const map = painted(
    512,
    512,
    (g, W, H) => {
      g.fillStyle = '#bc9f78';
      g.fillRect(0, 0, W, H);
      blots(g, W, H, r, 60, ['255,246,226,0.08', '96,70,42,0.07'], 80);
      grain(g, W, H, r, 5);
    },
    { repeat: [1, 1] },
  );
  const bump = painted(
    512,
    512,
    (g, W, H) => {
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 16000; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
        g.beginPath();
        g.arc(r() * W, r() * H, 0.7 + r() * 1.5, 0, TAU);
        g.fill();
      }
    },
    { srgb: false, repeat: [1, 1] },
  );
  return { map, bump };
}

// brown cut-pile carpet, worn paler in places
export function carpetMaps(seed) {
  const r = rng(seed);
  const map = painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#5d4636';
      g.fillRect(0, 0, W, H);
      blots(g, W, H, r, 24, ['28,18,12,0.2', '130,104,80,0.1'], 50);
      grain(g, W, H, r, 24);
    },
    { repeat: [1, 1] },
  );
  const bump = painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      grain(g, W, H, r, 70);
    },
    { srgb: false, repeat: [1, 1] },
  );
  return { map, bump };
}

// rust-brown velour, in puffed channels stitched along their seams
export function velourMaps(seed) {
  const r = rng(seed);
  const N = 7;
  const map = painted(
    512,
    512,
    (g, W, H) => {
      g.fillStyle = '#6f432b';
      g.fillRect(0, 0, W, H);
      const cw = W / N;
      for (let i = 0; i < N; i++) {
        const gr = g.createLinearGradient(i * cw, 0, (i + 1) * cw, 0);
        gr.addColorStop(0, 'rgba(24,12,6,0.55)');
        gr.addColorStop(0.16, 'rgba(255,214,170,0.05)');
        gr.addColorStop(0.5, 'rgba(255,214,170,0.15)');
        gr.addColorStop(0.84, 'rgba(255,214,170,0.05)');
        gr.addColorStop(1, 'rgba(24,12,6,0.55)');
        g.fillStyle = gr;
        g.fillRect(i * cw, 0, cw, H);
      }
      g.fillStyle = 'rgba(214,170,120,0.35)';
      for (let i = 0; i <= N; i++) for (let y = 0; y < H; y += 7) g.fillRect(i * cw - 3, y, 1.2, 3.5);
      grain(g, W, H, r, 8);
    },
    { repeat: [1, 1] },
  );
  const bump = painted(
    512,
    512,
    (g, W, H) => {
      const cw = W / N;
      for (let i = 0; i < N; i++) {
        const gr = g.createLinearGradient(i * cw, 0, (i + 1) * cw, 0);
        gr.addColorStop(0, '#202020');
        gr.addColorStop(0.2, '#9a9a9a');
        gr.addColorStop(0.5, '#c8c8c8');
        gr.addColorStop(0.8, '#9a9a9a');
        gr.addColorStop(1, '#202020');
        g.fillStyle = gr;
        g.fillRect(i * cw, 0, cw, H);
      }
      grain(g, W, H, r, 14);
    },
    { srgb: false, repeat: [1, 1] },
  );
  return { map, bump };
}

// the headliner: pale perforated vinyl
export function linerMaps(seed) {
  const r = rng(seed);
  const dots = (g, W, H, c) => {
    g.fillStyle = c;
    for (let y = 4; y < H; y += 8) for (let x = (y % 16 ? 0 : 4) + 2; x < W; x += 8) g.fillRect(x, y, 1.6, 1.6);
  };
  const map = painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#d8cbb0';
      g.fillRect(0, 0, W, H);
      blots(g, W, H, r, 14, ['150,128,96,0.08'], 60);
      dots(g, W, H, 'rgba(90,74,54,0.28)');
      grain(g, W, H, r, 4);
    },
    { repeat: [1, 1] },
  );
  const bump = painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#909090';
      g.fillRect(0, 0, W, H);
      dots(g, W, H, '#303030');
    },
    { srgb: false, repeat: [1, 1] },
  );
  return { map, bump };
}

// an eighties curtain: mustard and brown stripes, hanging in folds
export function curtainMaps(seed) {
  const r = rng(seed);
  const map = painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#b8873f';
      g.fillRect(0, 0, W, H);
      const bands = [
        [0.08, '#6d3f22'],
        [0.03, '#e9d3a3'],
        [0.15, '#b8873f'],
        [0.05, '#8f5228'],
        [0.03, '#e9d3a3'],
        [0.16, '#c99b4c'],
      ];
      let x = 0;
      while (x < W) for (const [w, c] of bands) {
        g.fillStyle = c;
        g.fillRect(x, 0, w * W + 1, H);
        x += w * W;
      }
      for (let i = 0; i < 4; i++) {
        const gr = g.createLinearGradient((i * W) / 4, 0, ((i + 1) * W) / 4, 0);
        gr.addColorStop(0, 'rgba(30,16,6,0.35)');
        gr.addColorStop(0.5, 'rgba(255,240,210,0.12)');
        gr.addColorStop(1, 'rgba(30,16,6,0.35)');
        g.fillStyle = gr;
        g.fillRect((i * W) / 4, 0, W / 4, H);
      }
      grain(g, W, H, r, 6);
    },
    { repeat: [1, 1] },
  );
  const bump = painted(
    256,
    256,
    (g, W, H) => {
      for (let i = 0; i < 4; i++) {
        const gr = g.createLinearGradient((i * W) / 4, 0, ((i + 1) * W) / 4, 0);
        gr.addColorStop(0, '#303030');
        gr.addColorStop(0.5, '#d0d0d0');
        gr.addColorStop(1, '#303030');
        g.fillStyle = gr;
        g.fillRect((i * W) / 4, 0, W / 4, H);
      }
    },
    { srgb: false, repeat: [1, 1] },
  );
  return { map, bump };
}

// sun-greyed wood, for the power poles and the fence posts
export function weatheredMap(seed) {
  const r = rng(seed);
  return painted(
    128,
    512,
    (g, W, H) => {
      g.fillStyle = '#75624f';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 90; i++) {
        const x = r() * W;
        g.strokeStyle = r() < 0.5 ? `rgba(40,30,22,${0.2 + r() * 0.3})` : `rgba(190,176,156,${0.1 + r() * 0.15})`;
        g.lineWidth = 0.6 + r() * 1.6;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 8, H * 0.33, x + (r() - 0.5) * 8, H * 0.66, x + (r() - 0.5) * 4, H);
        g.stroke();
      }
      grain(g, W, H, r, 10);
    },
    { repeat: [1, 1] },
  );
}

// The road's markings over the tarmac, and the dirt along its edges: the
// overlay is the road and a metre and a bit each side, 24 m of it (two of
// the centre line's dashes), mostly see-through.
export const MARK_W = ROAD_W + 2.6;
export function markingsMap(seed) {
  const r = rng(seed);
  return painted(
    256,
    1024,
    (g, W, H) => {
      const px = W / MARK_W;
      const py = H / LINE_TILE;
      const edge = 1.3 * px; // where the tarmac starts
      g.clearRect(0, 0, W, H);
      // dirt washed onto the edges
      for (const side of [0, 1]) {
        const gr = g.createLinearGradient(side ? W : 0, 0, side ? W - edge - 0.7 * px : edge + 0.7 * px, 0);
        gr.addColorStop(0, 'rgba(158,122,86,1)');
        gr.addColorStop(0.55, 'rgba(150,116,82,0.85)');
        gr.addColorStop(1, 'rgba(140,108,76,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 900; i++) {
          const d = Math.pow(r(), 2.2) * (edge + 0.9 * px);
          const x = side ? W - d : d;
          g.fillStyle = `rgba(${120 + r() * 60},${90 + r() * 45},${60 + r() * 35},${0.25 + r() * 0.4})`;
          g.beginPath();
          g.arc(x, r() * H, 0.6 + r() * 2.2, 0, TAU);
          g.fill();
        }
      }
      // white edge lines, faded and broken
      for (const x of [edge + 0.3 * px, W - edge - 0.42 * px]) {
        for (let y = 0; y < H; y += 3) {
          const worn = Math.sin(y * 0.05 + x) * 0.5 + 0.5;
          g.fillStyle = `rgba(232,226,210,${0.38 + worn * 0.3 - r() * 0.2})`;
          g.fillRect(x, y, 0.12 * px, 3);
        }
      }
      // the centre: a faded yellow dash, three metres in every twelve
      const cx = edge + (ROAD_W / 2) * px;
      for (const y0 of [2, 14]) {
        for (let y = y0 * py; y < (y0 + 3) * py; y += 2) {
          g.fillStyle = `rgba(226,178,64,${0.62 + r() * 0.25})`;
          g.fillRect(cx - 0.06 * px, y, 0.12 * px, 2);
        }
        // worn through in spots
        for (let i = 0; i < 6; i++) {
          g.fillStyle = 'rgba(70,66,62,0.6)';
          g.fillRect(cx - 0.07 * px + r() * 2, (y0 + r() * 3) * py, 2 + r() * 2, 2 + r() * 6);
        }
      }
      // tar snakes: crack sealant squiggling along and across
      g.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        let x = edge + r() * ROAD_W * px;
        let y = r() * H;
        const along = r() < 0.6;
        g.strokeStyle = `rgba(14,13,12,${0.55 + r() * 0.3})`;
        g.lineWidth = 1.2 + r() * 1.8;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 10; k++) {
          x += along ? (r() - 0.5) * 6 : 6 + r() * 6;
          y += along ? 8 + r() * 14 : (r() - 0.5) * 10;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    },
    { repeat: [1, 1] },
  );
}

// a broad, soft variation in the ground's tone, so its tiling doesn't show
export function macroMap(seed) {
  const r = rng(seed);
  return painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      for (let pass = 0; pass < 2; pass++)
        for (let i = 0; i < 70; i++) {
          const x = r() * W;
          const y = r() * H;
          const rad = (pass ? 12 : 40) * (0.4 + r());
          const c = r() < 0.5 ? '255,255,255' : '0,0,0';
          for (const [ox, oy] of [
            [0, 0],
            [W, 0],
            [-W, 0],
            [0, H],
            [0, -H],
          ]) {
            const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
            gr.addColorStop(0, `rgba(${c},${0.18 + r() * 0.12})`);
            gr.addColorStop(1, `rgba(${c},0)`);
            g.fillStyle = gr;
            g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
          }
        }
    },
    { srgb: false, repeat: [1, 1] },
  );
}

