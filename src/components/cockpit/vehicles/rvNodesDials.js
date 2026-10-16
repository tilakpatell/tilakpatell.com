// rv.js on the node renderer: the instruments and the cab’s small pictures
// (the gauges’ face and lamps, the radio, the heater’s panel, the gear
// indicator, the mirrors’ views and the road map), painted on canvases,
// copied line for line. Canvases only: nothing differs on the node renderer.

import { painted, rng } from '../kitNodes';
import { FACE, TAU } from './rvNodesKit';

// ── the instruments ──

// The gauges, on a canvas the shape of the cluster's face: the speedometer
// in the middle (to 85, the eighties' way, with 55 picked out), fuel and
// temperature to the left, oil and volts to the right. `lit`: only what the
// lamps behind the face light up, for its glow.
export const DIALS = {
  speed: { x: 512, y: 176, r: 158, from: 0.75 * Math.PI, sweep: 1.5 * Math.PI },
  fuel: { x: 172, y: 106, r: 64, from: (7 / 6) * Math.PI, sweep: (2 / 3) * Math.PI },
  temp: { x: 172, y: 262, r: 64, from: (7 / 6) * Math.PI, sweep: (2 / 3) * Math.PI },
  oil: { x: 852, y: 106, r: 64, from: (7 / 6) * Math.PI, sweep: (2 / 3) * Math.PI },
  volts: { x: 852, y: 262, r: 64, from: (7 / 6) * Math.PI, sweep: (2 / 3) * Math.PI },
};
const FONT = 'Helvetica, Arial, sans-serif';
export function paintCluster(g, W, H, lit) {
  const ink = lit ? '#ffffff' : '#eee8d8';
  if (lit) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
  } else {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#22201d');
    gr.addColorStop(1, '#0d0c0b');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  const at = (D, f, rr) => {
    const a = D.from + f * D.sweep;
    return [D.x + Math.cos(a) * rr, D.y + Math.sin(a) * rr];
  };
  const tick = (D, f, r0, r1, w, c) => {
    const [x0, y0] = at(D, f, r0);
    const [x1, y1] = at(D, f, r1);
    g.strokeStyle = c;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  };
  const text = (s, x, y, size, c = ink, weight = 'bold') => {
    g.fillStyle = c;
    g.font = `${weight} ${size}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s, x, y);
  };
  for (const D of Object.values(DIALS)) {
    if (!lit) {
      g.fillStyle = '#070707';
      g.beginPath();
      g.arc(D.x, D.y, D.r, 0, TAU);
      g.fill();
      g.strokeStyle = '#3a3733';
      g.lineWidth = 3;
      g.stroke();
    }
  }
  // the speedometer
  const S = DIALS.speed;
  for (let v = 0; v <= 85; v += 5) {
    const major = v % 10 === 0;
    tick(S, v / 85, S.r * (major ? 0.8 : 0.87), S.r * 0.95, major ? 4 : 2, v === 55 ? '#ff7a3c' : ink);
    if (major) {
      const [x, y] = at(S, v / 85, S.r * 0.64);
      text(String(v), x, y, 30, v === 50 || v === 60 ? ink : ink);
    }
  }
  {
    const [x, y] = at(S, 55 / 85, S.r * 0.64);
    text('55', x, y, 26, '#ff7a3c');
  }
  for (let kmh = 20; kmh <= 120; kmh += 20) {
    const f = kmh / 1.609 / 85;
    tick(S, f, S.r * 0.38, S.r * 0.44, 2, '#e8954a');
    const [x, y] = at(S, f, S.r * 0.3);
    text(String(kmh), x, y, 13, '#e8954a');
  }
  text('MPH', S.x, S.y + S.r * 0.3, 18);
  text('km/h', S.x, S.y - S.r * 0.12, 12, '#e8954a', 'normal');
  // the odometer, in its window
  g.fillStyle = lit ? '#000' : '#020202';
  g.fillRect(S.x - 52, S.y + S.r * 0.44, 104, 26);
  const odo = '078412';
  for (let i = 0; i < 6; i++) {
    const last = i === 5;
    if (last) {
      g.fillStyle = lit ? '#bbbbbb' : '#e8e4da';
      g.fillRect(S.x - 52 + i * 17 + 2, S.y + S.r * 0.44 + 2, 15, 22);
    }
    text(odo[i], S.x - 52 + i * 17 + 9.5, S.y + S.r * 0.44 + 13.5, 18, last ? '#111' : ink, 'normal');
  }
  // the small ones
  const small = (D, labels, name, ticks = 5, red = null) => {
    for (let i = 0; i < ticks; i++) {
      const f = i / (ticks - 1);
      tick(D, f, D.r * (i % 2 ? 0.8 : 0.7), D.r * 0.92, i % 2 ? 2 : 3.5, red != null && f >= red ? '#ff5a3a' : ink);
    }
    labels.forEach(([s, f]) => {
      const [x, y] = at(D, f, D.r * 0.52);
      text(s, x, y + 2, 16);
    });
    text(name, D.x, D.y + D.r * 0.42, 13, ink, 'normal');
  };
  small(DIALS.fuel, [
    ['E', 0],
    ['F', 1],
  ], 'FUEL');
  small(DIALS.temp, [
    ['C', 0],
    ['H', 1],
  ], 'TEMP', 5, 0.9);
  small(DIALS.oil, [
    ['0', 0],
    ['80', 1],
  ], 'OIL');
  small(DIALS.volts, [
    ['9', 0],
    ['18', 1],
  ], 'VOLTS');
  // the lamps' windows (the lamps themselves sit over them)
  if (!lit) {
    g.fillStyle = '#050505';
    for (const [x, y] of Object.values(LAMP_AT)) g.fillRect(x - 24, y - 12, 48, 24);
  }
}
// where the warning lamps sit on the face (canvas px)
export const LAMP_AT = { brake: [298, 336], gauges: [726, 336], beam: [512, 302], left: [300, 32], right: [724, 32] };
export const faceLocal = (x, y) => [(x / FACE.px - 0.5) * FACE.w, (0.5 - y / FACE.py) * FACE.h];

// a warning lamp's window: its legend in white on black (the colour comes
// from the lamp)
export function lampMap(kind) {
  return painted(
    96,
    48,
    (g, W, H) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff';
      g.strokeStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (kind === 'brake' || kind === 'gauges') {
        g.font = `bold ${kind === 'brake' ? 19 : 13}px ${FONT}`;
        if (kind === 'brake') g.fillText('BRAKE', W / 2, H / 2 + 1);
        else {
          g.fillText('CHECK', W / 2, H / 2 - 8);
          g.fillText('GAUGES', W / 2, H / 2 + 9);
        }
      } else if (kind === 'beam') {
        // the high beam's lamp: a headlight with its rays
        g.lineWidth = 3;
        g.beginPath();
        g.arc(W / 2 - 4, H / 2, 12, -Math.PI / 2, Math.PI / 2);
        g.closePath();
        g.stroke();
        for (let i = -2; i <= 2; i++) {
          g.beginPath();
          g.moveTo(W / 2 + 12, H / 2 + i * 6);
          g.lineTo(W / 2 + 28, H / 2 + i * 6);
          g.stroke();
        }
      } else {
        // a turn signal's arrow
        const s = kind === 'left' ? -1 : 1;
        g.beginPath();
        g.moveTo(W / 2 + s * 22, H / 2);
        g.lineTo(W / 2 + s * 4, H / 2 - 14);
        g.lineTo(W / 2 + s * 4, H / 2 - 6);
        g.lineTo(W / 2 - s * 20, H / 2 - 6);
        g.lineTo(W / 2 - s * 20, H / 2 + 6);
        g.lineTo(W / 2 + s * 4, H / 2 + 6);
        g.lineTo(W / 2 + s * 4, H / 2 + 14);
        g.closePath();
        g.fill();
      }
    },
    { mips: false },
  );
}

// The radio: an AM/FM cassette deck behind a chrome bezel; `lit`, its dial
// glowing amber.
export function paintRadio(g, W, H, lit) {
  if (lit) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
  } else {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#d8d8d4');
    gr.addColorStop(0.45, '#8c8c88');
    gr.addColorStop(0.55, '#b4b4b0');
    gr.addColorStop(1, '#5c5c58');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#16120e';
    g.fillRect(8, 8, W - 16, H - 16);
  }
  // the dial
  g.fillStyle = lit ? 'rgba(255,170,70,0.55)' : '#0a0806';
  g.fillRect(36, 22, 250, 50);
  g.fillStyle = lit ? '#ffe0b0' : '#d8cfb8';
  g.font = `bold 13px ${FONT}`;
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  ['88', '92', '96', '100', '104', '108'].forEach((s, i) => g.fillText(s, 60 + i * 42, 36));
  ['54', '60', '70', '90', '110', '140', '170'].forEach((s, i) => g.fillText(s, 56 + i * 35, 60));
  g.textAlign = 'left';
  g.font = `bold 10px ${FONT}`;
  g.fillText('FM', 40, 36);
  g.fillText('AM', 40, 60);
  g.fillStyle = '#ff3a20';
  g.fillRect(158, 24, 3, 46);
  if (lit) return;
  // the cassette's door, and the preset buttons' recess
  g.fillStyle = '#050403';
  g.fillRect(316, 28, 160, 34);
  g.strokeStyle = '#9a9a96';
  g.lineWidth = 2;
  g.strokeRect(316, 28, 160, 34);
  g.fillStyle = '#c8c4b8';
  g.font = `bold 10px ${FONT}`;
  g.textAlign = 'center';
  g.fillText('AM/FM STEREO  CASSETTE', 396, 76);
  g.fillStyle = '#0a0806';
  g.fillRect(36, 82, 250, 30);
}

// the heater's controls: three slots for their levers, and their legends
export function paintHvac(g, W, H) {
  g.fillStyle = '#2c2018';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 3;
  g.strokeRect(2, 2, W - 4, H - 4);
  g.font = `bold 11px ${FONT}`;
  g.textBaseline = 'middle';
  const rows = [
    ['FAN', ['OFF', 'LO', '', 'HI']],
    ['TEMP', ['COLD', '', '', 'HOT']],
    ['AIR', ['VENT', 'HEAT', 'DEF', 'A/C']],
  ];
  rows.forEach(([name, ticks], i) => {
    const y = 18 + i * 28;
    g.fillStyle = '#e8dcc4';
    g.textAlign = 'left';
    g.fillText(name, 8, y + 4);
    g.fillStyle = '#060504';
    g.fillRect(58, y, 186, 7);
    g.textAlign = 'center';
    ticks.forEach((s, k) => {
      g.fillStyle = name === 'TEMP' ? (k ? '#ff7a5a' : '#7ab8ff') : '#d8ccb4';
      g.font = `bold 8px ${FONT}`;
      g.fillText(s, 66 + k * 56, y + 16);
    });
    g.font = `bold 11px ${FONT}`;
  });
}

// the gear indicator on top of the column
export function prndlMap() {
  return painted(
    128,
    32,
    (g, W, H) => {
      g.fillStyle = '#0b0a09';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#efe8d8';
      g.font = `bold 20px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      'PRND21'.split('').forEach((c, i) => g.fillText(c, 14 + i * 20, H / 2 + 1));
    },
    { mips: false },
  );
}

// The side mirrors' glass: the road behind going back to the horizon under
// the evening sky, the RV's own white flank down the inner edge, and the
// small convex mirror below. Painted for the left; the right one is flipped.
export function sideMirrorMap() {
  return painted(128, 256, (g, W, H) => {
    const hz = H * 0.42;
    const vp = [W * 0.58, hz];
    let gr = g.createLinearGradient(0, 0, 0, hz);
    gr.addColorStop(0, '#7f9cc0');
    gr.addColorStop(0.7, '#d9b48e');
    gr.addColorStop(1, '#f0c79a');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, hz);
    g.fillStyle = '#9a7a78';
    g.beginPath();
    g.moveTo(0, hz);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, hz - 3 - Math.abs(Math.sin(x * 0.07)) * 6);
    g.lineTo(W, hz);
    g.fill();
    gr = g.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, '#b48c66');
    gr.addColorStop(1, '#6f5038');
    g.fillStyle = gr;
    g.fillRect(0, hz, W, H - hz);
    // the road, and its centre line
    g.fillStyle = '#4c4844';
    g.beginPath();
    g.moveTo(vp[0] - 2, hz);
    g.lineTo(vp[0] + 2, hz);
    g.lineTo(W * 1.4, H);
    g.lineTo(-W * 0.2, H);
    g.fill();
    g.strokeStyle = '#d9a840';
    g.lineWidth = 2;
    g.setLineDash([10, 18]);
    g.beginPath();
    g.moveTo(vp[0], hz);
    g.lineTo(-W * 0.05, H);
    g.stroke();
    g.setLineDash([]);
    // the RV's flank: white, with its brown and orange stripes
    g.fillStyle = '#e9e2d4';
    g.beginPath();
    g.moveTo(W, 0);
    g.lineTo(W * 0.8, 0);
    g.lineTo(W * 0.74, H);
    g.lineTo(W, H);
    g.fill();
    for (const [y, c, w] of [
      [0.55, '#6a3c22', 9],
      [0.62, '#c86f2c', 6],
    ]) {
      g.strokeStyle = c;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(W * 0.76, H * y);
      g.lineTo(W, H * (y + 0.06));
      g.stroke();
    }
    // the convex spotter
    const y0 = H * 0.76;
    g.fillStyle = '#121212';
    g.fillRect(4, y0 - 4, W - 8, H - y0);
    gr = g.createRadialGradient(W / 2, y0 + 26, 4, W / 2, y0 + 26, W * 0.6);
    gr.addColorStop(0, '#c8a47e');
    gr.addColorStop(0.5, '#a08060');
    gr.addColorStop(1, '#5a4434');
    g.fillStyle = gr;
    g.fillRect(8, y0, W - 16, H - y0 - 8);
    g.fillStyle = '#d6cfc0';
    g.fillRect(W * 0.7, y0, W * 0.3 - 8, H - y0 - 8);
    g.fillStyle = 'rgba(255,255,255,0.2)';
    g.fillRect(8, y0, W - 16, 3);
  });
}

// the rear-view mirror: the coach behind you, dim, and Mr. White's yellow
export function rearMirrorMap() {
  return painted(256, 64, (g, W, H) => {
    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#8a7a62');
    gr.addColorStop(0.3, '#4a3626');
    gr.addColorStop(1, '#2a1e16');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#5c3b22';
    g.fillRect(0, 6, W * 0.32, 18);
    g.fillRect(W * 0.7, 6, W * 0.3, 18);
    gr = g.createRadialGradient(W * 0.2, H * 0.55, 2, W * 0.2, H * 0.55, 40);
    gr.addColorStop(0, 'rgba(240,196,140,0.8)');
    gr.addColorStop(1, 'rgba(240,196,140,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#0c0907';
    g.fillRect(W * 0.44, 18, W * 0.12, H);
    gr = g.createRadialGradient(W * 0.64, H * 0.85, 3, W * 0.64, H * 0.85, 26);
    gr.addColorStop(0, 'rgba(226,196,60,0.95)');
    gr.addColorStop(1, 'rgba(226,196,60,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  });
}

// a road map, folded open on the dash
export function roadMapMap() {
  const r = rng(77);
  return painted(256, 192, (g, W, H) => {
    g.fillStyle = '#ece4cf';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(200,180,120,0.35)';
    for (let i = 0; i < 9; i++) g.fillRect(r() * W, r() * H, 20 + r() * 60, 14 + r() * 40);
    g.strokeStyle = 'rgba(80,140,200,0.7)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, H * 0.3);
    g.bezierCurveTo(W * 0.3, H * 0.5, W * 0.6, H * 0.1, W, H * 0.4);
    g.stroke();
    for (let i = 0; i < 12; i++) {
      g.strokeStyle = r() < 0.3 ? '#c8332a' : 'rgba(60,50,40,0.6)';
      g.lineWidth = r() < 0.3 ? 2.2 : 1;
      g.beginPath();
      g.moveTo(r() * W, r() * H);
      g.lineTo(r() * W, r() * H);
      g.stroke();
    }
    g.fillStyle = 'rgba(40,30,20,0.55)';
    for (let i = 0; i < 30; i++) g.fillRect(r() * W, r() * H, 8 + r() * 18, 2);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(W / 2, 0);
    g.lineTo(W / 2, H);
    g.moveTo(0, H / 2);
    g.lineTo(W, H / 2);
    g.stroke();
  });
}

