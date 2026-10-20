// Roy: A Life Well Lived, the Blips and Chitz VR game, in WebGL: a vignette
// for each stage of the life (a backyard with a tire swing, a floodlit
// field, the carpet store's aisles, a hospital room, then the store again or
// the woods), toon-shaded like the show (portal/toon.js: flat colour, one
// step of shadow, a line round the figures, no film grade) on
// lib/stage3d's renderer, with Roy himself built in code: he grows up,
// fills out, greys, loses his hair and stoops as the years go by.
//
// It draws the life it's handed and decides nothing (./rules.js plays it).
// render(life, ms) reads `life.events` once per life object, so the
// component hands it the newest life carrying every step's events since the
// last frame (and the same object again when nothing has stepped).
//
// createRoyScene(canvas, { onLost, calm }) resolves to { render(life, ms),
// resize(w, h), dispose(), lost, info(), tune() }. `calm` (prefers-reduced-motion by
// default) leaves out the camera shake.

import * as THREE from 'three';
import { createStage, disposeTree, hot } from '../../../../lib/stage3d';
import { houseOn } from '../../../../lib/three/house';
import { budget, device } from '../../../../lib/device';
import { prefersReducedMotion as reduced } from '../../../../lib/hooks';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon } from '../../portal/toon';
import { hull } from '../../portal/cast';
import { at, batch, hipRoof, kitMaterials, paint, rng, speckle } from '../kit';
import { makeSky } from '../sky';
import { TUNING, ageOf, beatWindow, inBand } from './rules';
import { sharpen } from '../../../../lib/three/textures';
import { createFeel, feelGroups } from '../../../../lib/three/feel';
import { BLOOMS, PLAIN } from '../look';

const { kid: KID, football: FOOTBALL, carpet: CARPET, cancer: CANCER } = TUNING;
// the show's line round each figure (../../portal/cast.js's hull, a child of
// each part, so a part hidden as he ages takes its line with it), metres:
// about two pixels at 720p from the camera's 4 or 5 m
const ROY_INK = 0.012;
const SWING = 0.62; // how far the tire swings either way at the end of its rope (radians)

const INK = '#1b1424';
// the three carpets (the aisles, the rolls, the swatches), told apart by pattern as well as colour
const CARPETS = [
  { hex: 0xd8443a, css: '#d8443a', dark: '#97261f', light: '#f08a7e', name: 'Red', pattern: 'stripes' },
  { hex: 0xeab43a, css: '#eab43a', dark: '#a8740f', light: '#f8dc8a', name: 'Gold', pattern: 'plain' },
  { hex: 0x2f7fc9, css: '#2f7fc9', dark: '#174a80', light: '#8cc4f2', name: 'Blue', pattern: 'checks' },
];
const SKIN = 0xf2c9a0;
const ROY_HAIR = 0x5c3a20;
const LANE = { field: 2.6, store: 3.4, woods: 3.4 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, v) => {
  const k = clamp((v - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const damp = (dt, rate) => 1 - Math.exp(-dt * rate);
const easeOut = (k) => 1 - (1 - clamp(k, 0, 1)) ** 3;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// ── canvas painting ──

function carpetPattern(g, w, h, c) {
  g.fillStyle = c.css;
  g.fillRect(0, 0, w, h);
  g.fillStyle = c.dark;
  if (c.pattern === 'stripes') {
    for (let x = 0; x < w; x += w / 6) g.fillRect(x, 0, w / 14, h);
  } else if (c.pattern === 'checks') {
    const n = 6;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x + y) % 2 === 0) g.fillRect((x * w) / n, (y * h) / n, w / n, h / n);
  } else {
    const r = rng(11);
    g.globalAlpha = 0.35;
    for (let i = 0; i < 700; i++) g.fillRect(r() * w, r() * h, 2, 2);
    g.fillStyle = c.light;
    for (let i = 0; i < 400; i++) g.fillRect(r() * w, r() * h, 2, 2);
    g.globalAlpha = 1;
  }
}

// the end of a roll: the carpet wound round a card tube
function rollEnd(g, w, h, c) {
  g.fillStyle = c.css;
  g.beginPath();
  g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = c.dark;
  g.lineWidth = w / 40;
  g.beginPath();
  for (let a = 0; a < Math.PI * 12; a += 0.1) {
    const r = w * 0.12 + (a / (Math.PI * 12)) * w * 0.36;
    const x = w / 2 + Math.cos(a) * r;
    const y = h / 2 + Math.sin(a) * r;
    if (a === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.fillStyle = '#d9c6a0';
  g.beginPath();
  g.arc(w / 2, h / 2, w * 0.11, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4a3a28';
  g.beginPath();
  g.arc(w / 2, h / 2, w * 0.07, 0, Math.PI * 2);
  g.fill();
}

// a log's end: rings, and its bark round the edge
function logEnd(g, w, h) {
  g.fillStyle = '#5a3a20';
  g.beginPath();
  g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e2bf86';
  g.beginPath();
  g.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#b98a52';
  g.lineWidth = 3;
  for (let r = w * 0.06; r < w * 0.4; r += w * 0.07) {
    g.beginPath();
    g.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    g.stroke();
  }
}

function bark(g, w, h) {
  g.fillStyle = '#6e4a2a';
  g.fillRect(0, 0, w, h);
  const r = rng(4);
  g.strokeStyle = '#4c311b';
  g.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    const x = r() * w;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.6, x + 2, h);
    g.stroke();
  }
}

function plaid(g, w, h) {
  g.fillStyle = '#b8352a';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(30, 12, 12, 0.55)';
  for (let i = 0; i < 4; i++) {
    g.fillRect(i * (w / 4), 0, w / 10, h);
    g.fillRect(0, i * (h / 4), w, h / 10);
  }
  g.fillStyle = 'rgba(255, 220, 160, 0.35)';
  for (let i = 0; i < 4; i++) {
    g.fillRect(i * (w / 4) + w / 7, 0, 2, h);
    g.fillRect(0, i * (h / 4) + h / 7, w, 2);
  }
}

// lettering for signs, in the site's sans
const font = (px, weight = 900) => `${weight} ${px}px "Archivo Variable", Archivo, system-ui, sans-serif`;

// a cartoon bubble (a rounded box with a tail, or a cloud for a thought), inked
function bubble(g, w, h, { cloud = false, tail = 'left' } = {}) {
  g.lineWidth = w * 0.03;
  g.strokeStyle = INK;
  g.fillStyle = '#ffffff';
  if (cloud) {
    const puffs = [
      [0.3, 0.38, 0.2],
      [0.5, 0.3, 0.22],
      [0.7, 0.38, 0.2],
      [0.76, 0.56, 0.17],
      [0.55, 0.62, 0.2],
      [0.32, 0.6, 0.18],
      [0.22, 0.48, 0.15],
    ];
    for (const pass of ['stroke', 'fill'])
      for (const [x, y, r] of puffs) {
        g.beginPath();
        g.arc(x * w, y * h, r * w, 0, Math.PI * 2);
        g[pass]();
      }
    for (const [x, y, r] of [
      [0.82, 0.82, 0.045],
      [0.9, 0.92, 0.028],
    ]) {
      g.beginPath();
      g.arc(x * w, y * h, r * w, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    return;
  }
  const x0 = w * 0.06;
  const y0 = h * 0.05;
  const bw = w * 0.88;
  const bh = h * 0.72;
  const r = w * 0.12;
  g.beginPath();
  g.moveTo(x0 + r, y0);
  g.arcTo(x0 + bw, y0, x0 + bw, y0 + bh, r);
  g.arcTo(x0 + bw, y0 + bh, x0, y0 + bh, r);
  const tx = tail === 'left' ? 0.32 : 0.62;
  g.lineTo(w * (tx + 0.1), y0 + bh);
  g.lineTo(w * tx, h * 0.96);
  g.lineTo(w * (tx - 0.04), y0 + bh);
  g.arcTo(x0, y0 + bh, x0, y0, r);
  g.arcTo(x0, y0, x0 + bw, y0, r);
  g.closePath();
  g.fill();
  g.stroke();
}

function drawFootball(g, x, y, s, rot = -0.5) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = '#8b4a2b';
  g.strokeStyle = INK;
  g.lineWidth = s * 0.08;
  g.beginPath();
  g.ellipse(0, 0, s, s * 0.6, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.strokeStyle = '#fff';
  g.lineWidth = s * 0.08;
  g.beginPath();
  g.moveTo(-s * 0.4, 0);
  g.lineTo(s * 0.4, 0);
  for (let i = -2; i <= 2; i++) {
    g.moveTo(i * s * 0.15, -s * 0.14);
    g.lineTo(i * s * 0.15, s * 0.14);
  }
  g.stroke();
  g.restore();
}

// what Roy dreams of at the window: the lights, the posts, a ball in the air
function dream(g, w, h) {
  bubble(g, w, h, { cloud: true });
  g.save();
  g.beginPath();
  g.arc(w * 0.5, h * 0.47, w * 0.27, 0, Math.PI * 2);
  g.clip();
  const sky = g.createLinearGradient(0, h * 0.2, 0, h * 0.75);
  sky.addColorStop(0, '#13204a');
  sky.addColorStop(1, '#34508e');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#3f8f3a';
  g.fillRect(0, h * 0.6, w, h);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(w * (0.2 + i * 0.15), h * 0.6);
    g.lineTo(w * (0.05 + i * 0.22), h * 0.8);
    g.stroke();
  }
  g.strokeStyle = '#ffd23a';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(w * 0.62, h * 0.62);
  g.lineTo(w * 0.62, h * 0.5);
  g.moveTo(w * 0.52, h * 0.5);
  g.lineTo(w * 0.72, h * 0.5);
  g.moveTo(w * 0.52, h * 0.5);
  g.lineTo(w * 0.52, h * 0.3);
  g.moveTo(w * 0.72, h * 0.5);
  g.lineTo(w * 0.72, h * 0.3);
  g.stroke();
  for (const [x, y] of [
    [0.3, 0.3],
    [0.4, 0.24],
    [0.78, 0.26],
  ]) {
    g.fillStyle = '#fff6c0';
    g.beginPath();
    g.arc(w * x, h * y, 5, 0, Math.PI * 2);
    g.fill();
  }
  drawFootball(g, w * 0.4, h * 0.42, w * 0.06, -0.6);
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(w * (0.31 - i * 0.02), h * (0.47 + i * 0.03));
    g.lineTo(w * (0.25 - i * 0.02), h * (0.51 + i * 0.03));
    g.stroke();
  }
  g.restore();
}

function pennant(g, w, h) {
  g.fillStyle = '#1f4fa8';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#d8443a';
  g.beginPath();
  g.moveTo(w * 0.08, h * 0.25);
  g.lineTo(w * 0.92, h * 0.5);
  g.lineTo(w * 0.08, h * 0.75);
  g.closePath();
  g.fill();
  g.fillStyle = '#fff';
  g.font = font(h * 0.2);
  g.textBaseline = 'middle';
  g.fillText('NFL', w * 0.18, h * 0.5);
}

function siding(g, w, h) {
  g.fillStyle = '#ecdcab';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#c9b585';
  for (let y = 0; y < h; y += h / 6) g.fillRect(0, y, w, 3);
}

function fieldStripes(g, w, h) {
  g.fillStyle = '#3f8e3a';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#479c40';
  g.fillRect(0, 0, w, h / 2);
  const r = rng(9);
  g.globalAlpha = 0.18;
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() > 0.5 ? '#2f7a2c' : '#5cb24f';
    g.fillRect(r() * w, r() * h, 1, 2);
  }
  g.globalAlpha = 1;
}

function endZone(g, w, h) {
  g.fillStyle = '#1f4fa8';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  for (let x = -h; x < w; x += h / 2) {
    g.beginPath();
    g.moveTo(x, h);
    g.lineTo(x + h / 4, h);
    g.lineTo(x + h / 4 + h, 0);
    g.lineTo(x + h, 0);
    g.fill();
  }
  g.font = font(h * 0.62);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = h * 0.06;
  g.strokeStyle = '#0d2350';
  g.strokeText('HOME', w / 2, h * 0.54);
  g.fillStyle = '#ffffff';
  g.fillText('HOME', w / 2, h * 0.54);
}

function numberAtlas(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.font = font(h * 0.8);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  ['10', '20', '30', '40', '50'].forEach((n, i) => g.fillText(n, (i + 0.5) * (w / 5), h * 0.54));
}

function scoreboard(g, w, h, secs, home) {
  g.fillStyle = '#14161f';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#f2c14e';
  g.lineWidth = 8;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.font = font(h * 0.13, 800);
  g.fillText('HOME', w * 0.2, h * 0.22);
  g.fillText('GUEST', w * 0.8, h * 0.22);
  g.fillText('TIME', w * 0.5, h * 0.22);
  g.fillStyle = '#ffb02e';
  g.font = font(h * 0.34, 900);
  g.fillText(String(home), w * 0.2, h * 0.58);
  g.fillText('0', w * 0.8, h * 0.58);
  g.fillStyle = secs <= 5 ? '#ff5a4a' : '#ffb02e';
  g.fillText(`0:${String(Math.max(0, secs)).padStart(2, '0')}`, w * 0.5, h * 0.58);
  g.fillStyle = '#9aa3b8';
  g.font = font(h * 0.1, 700);
  g.fillText('4TH QTR', w * 0.5, h * 0.86);
}

function jerseyNumber(g, w, h, n, colour = '#ffffff') {
  g.clearRect(0, 0, w, h);
  g.font = font(h * 0.7);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = h * 0.06;
  g.strokeStyle = 'rgba(20,16,26,0.8)';
  g.strokeText(n, w / 2, h * 0.55);
  g.fillStyle = colour;
  g.fillText(n, w / 2, h * 0.55);
}

function tiles(g, w, h, a, b, n = 4) {
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? a : b;
      g.fillRect((x * w) / n, (y * h) / n, w / n, h / n);
    }
  g.strokeStyle = 'rgba(0,0,0,0.08)';
  g.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.moveTo((i * w) / n, 0);
    g.lineTo((i * w) / n, h);
    g.moveTo(0, (i * h) / n);
    g.lineTo(w, (i * h) / n);
    g.stroke();
  }
}

function aisleSign(g, w, h, c, i) {
  g.fillStyle = '#fbf6e8';
  g.fillRect(0, 0, w, h);
  g.fillStyle = c.css;
  g.fillRect(0, 0, w, h * 0.12);
  g.fillRect(0, h * 0.88, w, h * 0.12);
  g.save();
  g.translate(w * 0.06, h * 0.2);
  g.beginPath();
  g.rect(0, 0, h * 0.6, h * 0.6);
  g.clip();
  carpetPattern(g, h * 0.6, h * 0.6, c);
  g.restore();
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.strokeRect(w * 0.06, h * 0.2, h * 0.6, h * 0.6);
  g.fillStyle = INK;
  g.textBaseline = 'middle';
  g.font = font(h * 0.3);
  g.fillText(`Aisle ${i + 1}`, w * 0.06 + h * 0.75, h * 0.38);
  g.font = font(h * 0.2, 700);
  g.fillStyle = c.dark;
  g.fillText(c.name.toUpperCase(), w * 0.06 + h * 0.75, h * 0.66);
}

function storeSign(g, w, h) {
  g.fillStyle = '#7a2a22';
  g.fillRect(0, 0, w, h);
  g.font = font(h * 0.5);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff1c8';
  g.fillText('CARPETS · RUGS · UNDERLAY', w / 2, h * 0.54);
}

function employee(g, w, h) {
  g.fillStyle = '#f5ecd2';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#b48a3c';
  g.lineWidth = 14;
  g.strokeRect(7, 7, w - 14, h - 14);
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.font = font(w * 0.09, 800);
  g.fillText('EMPLOYEE', w / 2, h * 0.15);
  g.fillText('OF THE MONTH', w / 2, h * 0.24);
  g.fillStyle = '#9cc3e0';
  g.fillRect(w * 0.25, h * 0.32, w * 0.5, h * 0.5);
  g.fillStyle = '#f2c9a0';
  g.beginPath();
  g.arc(w / 2, h * 0.52, w * 0.15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#5c3a20';
  g.beginPath();
  g.arc(w / 2, h * 0.47, w * 0.15, Math.PI, 0);
  g.fill();
  g.fillStyle = '#fff';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(w / 2 + s * w * 0.05, h * 0.52, w * 0.04, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = INK;
  for (const s of [-1, 1]) g.fillRect(w / 2 + s * w * 0.05 - 2, h * 0.52 - 2, 4, 4);
  g.font = font(w * 0.1);
  g.fillText('ROY', w / 2, h * 0.92);
}

// the customer's swatch, in a speech bubble
function swatchBubble(g, w, h, c) {
  bubble(g, w, h, { tail: 'left' });
  const s = w * 0.5;
  const x = (w - s) / 2;
  const y = h * 0.13;
  g.save();
  g.beginPath();
  g.rect(x, y, s, s * 0.82);
  g.clip();
  carpetPattern(g, s, s, c);
  g.restore();
  g.lineWidth = w * 0.025;
  g.strokeStyle = INK;
  g.strokeRect(x, y, s, s * 0.82);
}

// what the cabin needs: a fish, berries or firewood
function needBubble(g, w, h, i) {
  bubble(g, w, h, { tail: 'right' });
  const cx = w / 2;
  const cy = h * 0.4;
  g.lineWidth = w * 0.02;
  g.strokeStyle = INK;
  if (i === 0) {
    g.fillStyle = '#5aa0d8';
    g.beginPath();
    g.ellipse(cx - w * 0.04, cy, w * 0.2, h * 0.11, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(cx + w * 0.14, cy);
    g.lineTo(cx + w * 0.3, cy - h * 0.1);
    g.lineTo(cx + w * 0.3, cy + h * 0.1);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.beginPath();
    g.arc(cx - w * 0.15, cy - h * 0.02, w * 0.02, 0, Math.PI * 2);
    g.fill();
  } else if (i === 1) {
    g.fillStyle = '#3f8a34';
    g.beginPath();
    g.ellipse(cx, cy - h * 0.15, w * 0.14, h * 0.05, 0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    for (const [dx, dy] of [
      [-0.1, 0],
      [0.08, -0.02],
      [0, 0.1],
      [-0.12, 0.13],
      [0.13, 0.1],
    ]) {
      g.fillStyle = '#c8243c';
      g.beginPath();
      g.arc(cx + dx * w, cy + dy * h, w * 0.07, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath();
      g.arc(cx + dx * w - w * 0.02, cy + dy * h - h * 0.02, w * 0.015, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    for (const [dx, dy] of [
      [-0.1, 0.08],
      [0.1, 0.08],
      [0, -0.08],
    ]) {
      g.fillStyle = '#8a5a30';
      g.fillRect(cx + dx * w - w * 0.18, cy + dy * h - h * 0.06, w * 0.3, h * 0.12);
      g.strokeRect(cx + dx * w - w * 0.18, cy + dy * h - h * 0.06, w * 0.3, h * 0.12);
      g.fillStyle = '#e2bf86';
      g.beginPath();
      g.ellipse(cx + dx * w + w * 0.12, cy + dy * h, w * 0.04, h * 0.06, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }
}

function nightWindow(g, w, h) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0c1630');
  sky.addColorStop(1, '#2a3f6e');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a2440';
  for (let i = 0; i < 8; i++) g.fillRect(i * (w / 8), h * (0.55 + (i % 3) * 0.08), w / 9, h);
  g.fillStyle = '#ffd77a';
  const r = rng(3);
  for (let i = 0; i < 30; i++) g.fillRect(r() * w, h * (0.62 + r() * 0.35), 3, 4);
  g.fillStyle = '#f4efd8';
  g.beginPath();
  g.arc(w * 0.78, h * 0.2, w * 0.06, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(230, 236, 240, 0.85)';
  for (let y = 0; y < h * 0.38; y += h / 22) g.fillRect(0, y, w, h / 40);
}

function spotTexture(g, w, h) {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.5)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, w, h);
}

function chevrons(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const y = h * (0.15 + i * 0.28);
    g.beginPath();
    g.moveTo(w * 0.1, y + h * 0.16);
    g.lineTo(w * 0.5, y);
    g.lineTo(w * 0.9, y + h * 0.16);
    g.lineTo(w * 0.9, y + h * 0.26);
    g.lineTo(w * 0.5, y + h * 0.1);
    g.lineTo(w * 0.1, y + h * 0.26);
    g.closePath();
    g.fill();
  }
}

// ── shapes ──

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.32, -0.55, -0.12, -0.55, 0.18);
  s.bezierCurveTo(-0.55, 0.45, -0.25, 0.55, 0, 0.32);
  s.bezierCurveTo(0.25, 0.55, 0.55, 0.45, 0.55, 0.18);
  s.bezierCurveTo(0.55, -0.12, 0.15, -0.32, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 16 });
  g.center();
  return g;
}

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.45 : 1;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
  g.center();
  return g;
}

// Things in the world that read as UI (bubbles, the beat ring): drawn over
// the picture, its depth cleared, so nothing in the world hides them.
class OverPass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
  }

  render(renderer, writeBuffer, readBuffer) {
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto;
  }
}

// ── particles: confetti, dust, glows, one instanced mesh each ──

function makeBits(max, geo, mat, { billboard = false, fade = false, floor = null } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const black = new THREE.Color(0, 0, 0);
  for (let i = 0; i < max; i++) {
    mesh.setMatrixAt(i, ZERO);
    mesh.setColorAt(i, black);
  }
  const p = new Float32Array(max * 3);
  const v = new Float32Array(max * 3);
  const r = new Float32Array(max * 3);
  const w = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const span = new Float32Array(max);
  const size = new Float32Array(max);
  const grow = new Float32Array(max);
  const grav = new Float32Array(max);
  const drag = new Float32Array(max);
  const c = new THREE.Color();
  let next = 0;
  let dirty = false;
  const spawn = ({ x = 0, y = 0, z = 0, n = 20, speed = 3, up = 1, spread = 1, colors = [0xffffff], k = 1, size: s0 = 0.1, life: l0 = 1, gravity = 6, drag: d0 = 0.6, growth = 0, vx = 0, vy = 0, vz = 0, box = 0 }) => {
    for (let j = 0; j < n; j++) {
      const i = next;
      next = (next + 1) % max;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 0.65);
      p[i * 3] = x + (Math.random() - 0.5) * box;
      p[i * 3 + 1] = y + (Math.random() - 0.5) * box * 0.3;
      p[i * 3 + 2] = z + (Math.random() - 0.5) * box;
      v[i * 3] = Math.cos(a) * sp * spread + vx;
      v[i * 3 + 1] = up * sp * (0.6 + Math.random() * 0.8) + vy;
      v[i * 3 + 2] = Math.sin(a) * sp * spread + vz;
      for (let q = 0; q < 3; q++) {
        r[i * 3 + q] = Math.random() * 6.3;
        w[i * 3 + q] = (Math.random() - 0.5) * 14;
      }
      span[i] = life[i] = l0 * (0.75 + Math.random() * 0.5);
      size[i] = s0 * (0.7 + Math.random() * 0.6);
      grow[i] = growth;
      grav[i] = gravity;
      drag[i] = d0;
      c.set(colors[Math.floor(Math.random() * colors.length)]).multiplyScalar(k);
      c.toArray(col, i * 3);
      mesh.setColorAt(i, c);
    }
    mesh.instanceColor.needsUpdate = true;
    dirty = true;
  };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const update = (dt, camera) => {
    if (!dirty) return;
    let any = false;
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) {
        mesh.setMatrixAt(i, ZERO);
        continue;
      }
      any = true;
      const k = life[i] / span[i];
      const f = Math.max(0, 1 - drag[i] * dt);
      v[i * 3 + 1] -= grav[i] * dt;
      for (let a = 0; a < 3; a++) {
        v[i * 3 + a] *= f;
        p[i * 3 + a] += v[i * 3 + a] * dt;
        r[i * 3 + a] += w[i * 3 + a] * dt;
      }
      if (floor != null && p[i * 3 + 1] < floor) {
        p[i * 3 + 1] = floor;
        v[i * 3 + 1] = 0;
        v[i * 3] *= 0.5;
        v[i * 3 + 2] *= 0.5;
        w[i * 3] *= 0.5;
        w[i * 3 + 1] *= 0.5;
        w[i * 3 + 2] *= 0.5;
      }
      if (billboard) q.copy(camera.quaternion);
      else q.setFromEuler(e.set(r[i * 3], r[i * 3 + 1], r[i * 3 + 2]));
      const s = size[i] * Math.min(1, k * 3) * (1 + grow[i] * (1 - k));
      m4.compose(pos.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]), q, sc.set(s, s, s));
      mesh.setMatrixAt(i, m4);
      if (fade) {
        c.fromArray(col, i * 3).multiplyScalar(Math.min(1, k * 1.6));
        mesh.setColorAt(i, c);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (fade) mesh.instanceColor.needsUpdate = true;
    dirty = any;
  };
  const clear = () => {
    life.fill(0);
    for (let i = 0; i < max; i++) mesh.setMatrixAt(i, ZERO);
    mesh.instanceMatrix.needsUpdate = true;
    dirty = false;
  };
  return { mesh, spawn, update, clear };
}

// ── poses (for figures from makeFigure below) ──

function rest(f) {
  f.root.scale.set(f.scale, f.scale, f.scale);
  f.body.position.set(0, 0, 0);
  f.body.rotation.set(0, 0, 0);
  f.body.scale.set(1, 1, 1);
  f.hips.rotation.set(0, 0, 0);
  for (const l of [f.legL, f.legR]) {
    l.hip.rotation.set(0, 0, 0);
    l.knee.rotation.set(0, 0, 0);
    l.foot.rotation.set(0, 0, 0);
  }
  f.spine.rotation.set(0, 0, 0);
  f.chest.rotation.set(0, 0, 0);
  f.armL.shoulder.rotation.set(0, 0, 0.1);
  f.armR.shoulder.rotation.set(0, 0, -0.1);
  f.armL.shoulder.position.y = f.armR.shoulder.position.y = 0;
  f.armL.elbow.rotation.set(-0.15, 0, 0);
  f.armR.elbow.rotation.set(-0.15, 0, 0);
  f.neck.rotation.set(0, 0, 0);
  f.head.rotation.set(0, 0, 0);
}

// legs and arms swinging: p is the stride's phase, amt how hard (a run is 1)
function stride(f, p, amt = 1, lean = 0.18) {
  const s = Math.sin(p);
  f.legL.hip.rotation.x = -s * 0.8 * amt;
  f.legR.hip.rotation.x = s * 0.8 * amt;
  f.legL.knee.rotation.x = amt * (0.25 + 1.1 * Math.max(0, Math.sin(p - 1.2)));
  f.legR.knee.rotation.x = amt * (0.25 + 1.1 * Math.max(0, Math.sin(p + Math.PI - 1.2)));
  f.armL.shoulder.rotation.x = s * 0.75 * amt;
  f.armR.shoulder.rotation.x = -s * 0.75 * amt;
  f.armL.elbow.rotation.x = -1.2 * amt - 0.15;
  f.armR.elbow.rotation.x = -1.2 * amt - 0.15;
  f.body.position.y = Math.abs(Math.cos(p)) * 0.06 * amt;
  f.spine.rotation.x = lean * amt;
  f.neck.rotation.x = -lean * 0.6 * amt;
}

function shrugPose(f, k) {
  f.armL.shoulder.position.y = f.armR.shoulder.position.y = 0.05 * k;
  f.armL.shoulder.rotation.set(-0.35 * k, 0, 0.1 + 0.45 * k);
  f.armR.shoulder.rotation.set(-0.35 * k, 0, -0.1 - 0.45 * k);
  f.armL.elbow.rotation.x = -0.15 - 1.3 * k;
  f.armR.elbow.rotation.x = -0.15 - 1.3 * k;
  f.armL.elbow.rotation.z = 0.5 * k;
  f.armR.elbow.rotation.z = -0.5 * k;
  f.head.rotation.z = 0.22 * k;
  f.neck.rotation.x = -0.1 * k;
}

function cheerPose(f, k, t = 0) {
  f.armL.shoulder.rotation.set(0, 0, 0.1 + 2.5 * k + Math.sin(t * 14) * 0.15 * k);
  f.armR.shoulder.rotation.set(0, 0, -0.1 - 2.5 * k - Math.sin(t * 14 + 1) * 0.15 * k);
  f.armL.elbow.rotation.x = f.armR.elbow.rotation.x = -0.2;
  f.neck.rotation.x = -0.25 * k;
  f.body.position.y = Math.abs(Math.sin(t * 9)) * 0.12 * k;
}

// knocked flat on his back (k 0…1), then back up
function knockedPose(f, k, t) {
  f.body.rotation.x = -1.35 * k;
  f.body.position.y = 0.2 * k;
  f.body.position.z = -0.35 * k;
  f.armL.shoulder.rotation.z = 0.1 + 1.2 * k;
  f.armR.shoulder.rotation.z = -0.1 - 1.2 * k;
  f.legL.hip.rotation.x = -0.5 * k;
  f.legR.hip.rotation.x = -0.2 * k;
  f.head.rotation.z = Math.sin(t * 9) * 0.25 * k;
}

// sat up in bed (the bed's back raised): front up, head toward -z
function bedPose(f) {
  f.body.rotation.x = -Math.PI / 2;
  f.spine.rotation.x = 0.55;
  f.neck.rotation.x = -0.15;
  f.armL.shoulder.rotation.set(-0.35, 0, 0.18);
  f.armR.shoulder.rotation.set(-0.35, 0, -0.18);
  f.armL.elbow.rotation.x = f.armR.elbow.rotation.x = -0.7;
}

function sitPose(f, k) {
  f.legL.hip.rotation.x = f.legR.hip.rotation.x = -1.5 * k;
  f.legL.knee.rotation.x = f.legR.knee.rotation.x = 1.5 * k;
  f.body.position.y = -0.42 * k;
  f.spine.rotation.x = 0.1 * k;
  f.armL.shoulder.rotation.x = f.armR.shoulder.rotation.x = -0.5 * k;
  f.armL.elbow.rotation.x = f.armR.elbow.rotation.x = -0.6 * k;
}

function eyes(f, { look = [0, 0], shut = 0 } = {}) {
  for (let i = 0; i < 2; i++) {
    const e = f.eyes[i];
    if (!e) continue;
    e.scale.y = e.userData.sy * (1 - 0.88 * shut);
    const p = f.pupils[i];
    p.visible = f.faceOn && shut < 0.6;
    p.position.x = p.userData.x + look[0] * 0.014;
    p.position.y = p.userData.y + look[1] * 0.012;
  }
}

function mood(f, m) {
  if (!f.mouth) return;
  f.mouth.visible = f.faceOn && m !== 'o';
  f.mouthO.visible = f.faceOn && m === 'o';
  f.mouth.rotation.z = m === 'frown' ? 0 : Math.PI;
  f.mouth.position.y = m === 'frown' ? -0.085 : -0.06;
}

// how a customer, a player or a passer-by looks, from a number
function lookFor(i) {
  const r = rng(i * 7919 + 13);
  const pick = (a) => a[Math.floor(r() * a.length)];
  return {
    skin: pick([0xf2c9a0, 0xe0ac7e, 0xc68a5e, 0x8d5a3b, 0xf6d8bf, 0xb07850]),
    hair: pick([0x2a1d14, 0x6b4226, 0xc8a050, 0x9a3b1c, 0x8c8c8c, 0x1a1410, 0xd8d0c0]),
    shirt: pick([0xe07a5f, 0x81b29a, 0xf2cc8f, 0x6d597a, 0x3d85c6, 0xe76f51, 0x2a9d8f, 0xb56576, 0xffd166]),
    trousers: pick([0x3d405b, 0x4a4e69, 0x6b705c, 0x264653, 0x5e548e, 0x8a7356]),
    shoes: pick([0x2b2118, 0x1d1d22, 0x6b4a2a, 0xf0f0f0]),
    scale: 0.9 + r() * 0.14,
    belly: 1 + r() * 0.2,
    long: r() < 0.4,
    bald: r() < 0.15,
    glasses: r() < 0.3,
    tache: r() < 0.25,
  };
}

export async function createRoyScene(canvas, { onLost, calm = reduced() } = {}) {
  const fit = budget();
  const tier = device().tier;
  const stage = createStage(canvas, { shadows: true, fov: 50, near: 0.1, far: 520, exposure: 1, bloom: BLOOMS.roy, onLost });
  const { renderer, scene, camera } = stage;
  // (the stage's Neutral keeps the show's flat bright colours bright: ../look.js)
  stage.grade(PLAIN);
  renderer.info.autoReset = false; // counted over the whole frame, every pass
  const mats = kitMaterials(renderer);
  const owned = []; // textures and geometries swapped in and out, freed at the end
  const tex = (w, h, draw, opts = {}) => {
    const t = paint(renderer, w, h, draw, { wrap: false, ...opts });
    owned.push(t);
    return t;
  };
  const tileTex = (w, h, draw, repeat) => tex(w, h, draw, { wrap: true, repeat });

  // ── light: one rig for every stage, so nothing recompiles between them ──
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1.2);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(fit.shadowMap, fit.shadowMap);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);
  const sky = makeSky(320);
  scene.add(sky.dome);
  scene.fog = new THREE.Fog(0xffffff, 300, 500);
  const background = new THREE.Color(0x101010);

  const fx = new THREE.Group();
  fx.name = 'fx';
  scene.add(fx);
  const over = new THREE.Scene();
  const overSun = new THREE.DirectionalLight(0xffffff, 1.5);
  overSun.position.set(2, 4, 5);
  over.add(new THREE.HemisphereLight(0xffffff, 0x8a96a8, 2), overSun);
  stage.composer.insertPass(new OverPass(over, camera), 1);
  const overlay = () => {
    const o = new THREE.Group();
    o.visible = false;
    over.add(o);
    return o;
  };

  // ── shared geometry and effects ──
  const spot = tex(64, 64, spotTexture);
  const G = {
    sph: new THREE.SphereGeometry(1, 18, 12),
    lo: new THREE.SphereGeometry(1, 10, 8),
    cap: new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2),
    helmet: new THREE.SphereGeometry(1, 18, 11, 0, Math.PI * 2, 0, Math.PI * 0.62),
    torso: new THREE.CapsuleGeometry(0.165, 0.28, 6, 14),
    thigh: new THREE.CapsuleGeometry(0.075, 0.3, 4, 10),
    shin: new THREE.CapsuleGeometry(0.06, 0.32, 4, 10),
    upper: new THREE.CapsuleGeometry(0.052, 0.196, 4, 10),
    fore: new THREE.CapsuleGeometry(0.045, 0.18, 4, 10),
    neck: new THREE.CylinderGeometry(0.05, 0.056, 0.1, 10),
    tache: new THREE.CapsuleGeometry(0.017, 0.075, 3, 8),
    mouth: new THREE.TorusGeometry(0.034, 0.0075, 5, 12, Math.PI),
    horseshoe: new THREE.TorusGeometry(1, 0.2, 6, 18, Math.PI),
    rim: new THREE.TorusGeometry(0.044, 0.0065, 5, 16),
    box: new THREE.BoxGeometry(1, 1, 1),
    plane: new THREE.PlaneGeometry(1, 1),
    flat: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
    cone: new THREE.ConeGeometry(1, 1, 12),
    ball: new THREE.SphereGeometry(1, 14, 10),
    tube: new THREE.CylinderGeometry(1, 1, 1, 16, 1, true),
    disc: new THREE.CircleGeometry(1, 24),
    star: starGeometry(),
    heart: heartGeometry(),
    ring: new THREE.RingGeometry(0.82, 1, 48),
    mask: (() => {
      const bars = [-0.035, -0.08].map((y) => new THREE.TorusGeometry(0.15, 0.011, 4, 14, Math.PI).applyMatrix4(at(0, y, 0.02, 0, 1.02, 1.12, 1, Math.PI / 2)));
      const upright = new THREE.BoxGeometry(1, 1, 1).applyMatrix4(at(0, -0.055, 0.185, 0, 0.014, 0.075, 0.014));
      const g = mergeGeometries([...bars, upright]);
      bars.forEach((x) => x.dispose());
      upright.dispose();
      return g;
    })(),
  };
  owned.push(...Object.values(G));
  const shadowMat = new THREE.MeshBasicMaterial({ map: spot, color: 0x0b1410, transparent: true, depthWrite: false, opacity: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
  const blob = (parent, r) => {
    const m = new THREE.Mesh(G.flat, shadowMat);
    m.scale.set(r * 2, 1, r * 2);
    m.renderOrder = 1;
    parent.add(m);
    return m;
  };

  const confetti = makeBits(tier === 'low' ? 160 : 320, new THREE.PlaneGeometry(0.08, 0.13), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), { floor: 0.02 });
  const dust = makeBits(120, G.plane, new THREE.MeshBasicMaterial({ map: spot, transparent: true, depthWrite: false, opacity: 0.8 }), { billboard: true });
  const glow = makeBits(160, G.plane, new THREE.MeshBasicMaterial({ map: spot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), { billboard: true, fade: true });
  fx.add(confetti.mesh, dust.mesh, glow.mesh);
  const CONFETTI = [0xff5a5f, 0xffd23a, 0x4fc3f7, 0x9ccc65, 0xffffff, 0xff8a3d, 0xc77dff];

  // rings that grow and fade, lying flat or facing the camera
  const rings = Array.from({ length: 8 }, () => {
    const m = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.visible = false;
    fx.add(m);
    return { m, t: 0, span: 1, s0: 0.2, s1: 2, flat: true };
  });
  let ringNext = 0;
  const ringAt = (x, y, z, color, { s0 = 0.3, s1 = 2.4, span = 0.6, flat = true, k = 1.5 } = {}) => {
    const r = rings[ringNext];
    ringNext = (ringNext + 1) % rings.length;
    r.m.position.set(x, y, z);
    r.m.material.color.copy(hot(color, k));
    Object.assign(r, { t: 0, span, s0, s1, flat });
    r.m.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0);
    r.m.visible = true;
  };
  const updateRings = (dt) => {
    for (const r of rings) {
      if (!r.m.visible) continue;
      r.t += dt;
      const k = r.t / r.span;
      if (k >= 1) {
        r.m.visible = false;
        continue;
      }
      r.m.scale.setScalar(lerp(r.s0, r.s1, easeOut(k)));
      r.m.material.opacity = 1 - k;
      if (!r.flat) r.m.quaternion.copy(camera.quaternion);
    }
  };

  // ── people, built in code ──
  const eyeWhite = toon(0xffffff);
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x15111c });
  const dark = toon(0x2a1a1a);
  const metal = toon(0xb8c0c8);
  const plain = tex(4, 4, (g) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 4, 4);
  });
  const plaidMap = tileTex(64, 64, plaid, [3, 3]);
  const footballMat = toon(0x8b4a2b);
  const laceMat = toon(0xffffff);

  function football(parent) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(G.ball, footballMat);
    b.scale.set(0.085, 0.085, 0.15);
    b.castShadow = true;
    const lace = new THREE.Mesh(G.box, laceMat);
    lace.scale.set(0.012, 0.012, 0.09);
    lace.position.y = 0.083;
    g.add(b, lace);
    parent?.add(g);
    return g;
  }

  function makeFigure({ face = true, shadows = true, lite = false } = {}) {
    const m = {
      skin: toon(SKIN),
      hair: toon(ROY_HAIR),
      shirt: toon(0xffffff, { map: plain }),
      fore: toon(SKIN, { map: plain }),
      trousers: toon(0x4a5468),
      shin: toon(0x4a5468),
      shoes: toon(0x3a2a20),
      helmet: toon(0x1f4fa8),
      extra: toon(0xa0302c),
    };
    // `big` parts cast shadows; the small ones (hands, faces, hair, trim) don't
    const add = (geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, big = false) => {
      const o = new THREE.Mesh(geo, mat);
      o.position.set(x, y, z);
      o.scale.set(sx, sy, sz);
      o.castShadow = shadows && big;
      parent.add(o);
      return o;
    };
    const group = (parent, x = 0, y = 0, z = 0) => {
      const o = new THREE.Group();
      o.position.set(x, y, z);
      parent.add(o);
      return o;
    };
    const root = new THREE.Group();
    const body = group(root);
    const hips = group(body, 0, 0.91, 0);
    const pelvis = add(G.sph, m.trousers, hips, 0, 0.03, 0, 0.165, 0.11, 0.12, true);
    const leg = (s) => {
      const hip = group(hips, s * 0.095, 0, 0);
      add(G.thigh, m.trousers, hip, 0, -0.215, 0, 1, 1, 1, true);
      const knee = group(hip, 0, -0.43, 0);
      add(G.shin, m.shin, knee, 0, -0.22, 0, 1, 1, 1, true);
      const foot = group(knee, 0, -0.43, 0);
      add(G.lo, m.shoes, foot, 0, -0.005, 0.045, 0.072, 0.052, 0.125);
      return { hip, knee, foot };
    };
    const legL = leg(1);
    const legR = leg(-1);
    const spine = group(hips);
    const torso = add(G.torso, m.shirt, spine, 0, 0.3, 0, 1.08, 1, 0.74, true);
    const chest = group(spine, 0, 0.5, 0);
    const arm = (s) => {
      const shoulder = group(chest, s * 0.2, 0, 0);
      if (!lite) add(G.lo, m.shirt, shoulder, 0, -0.01, 0, 0.07);
      add(G.upper, m.shirt, shoulder, 0, -0.15, 0, 1, 1, 1, true);
      const elbow = group(shoulder, 0, -0.29, 0);
      add(G.fore, m.fore, elbow, 0, -0.13, 0);
      const hand = group(elbow, 0, -0.275, 0);
      add(G.lo, m.skin, hand, 0, -0.015, 0, 0.05, 0.062, 0.045);
      return { shoulder, elbow, hand };
    };
    const armL = arm(1);
    const armR = arm(-1);
    const pads = [1, -1].map((s) => add(G.lo, m.shirt, chest, s * 0.19, 0.02, 0, 0.13, 0.08, 0.14));
    const neck = group(chest, 0, 0.08, 0);
    add(G.neck, m.skin, neck, 0, 0.03, 0);
    const head = group(neck, 0, 0.07, 0);
    const H = 0.15;
    const hc = group(head, 0, H, 0);
    add(G.sph, m.skin, hc, 0, 0, 0, H, H * 1.08, H * 0.98, true);
    const f = { root, body, hips, spine, chest, neck, head, hc, legL, legR, armL, armR, torso, pelvis, pads, m, scale: 1, eyes: [], pupils: [], mouth: null, mouthO: null, parts: {}, face: [], faceOn: true };
    const P = f.parts;
    if (face) {
      for (const s of [1, -1]) {
        const e = add(G.sph, eyeWhite, hc, s * 0.05, 0.028, 0.128, 0.052, 0.056, 0.03);
        e.userData.sy = 0.056;
        const p = add(G.lo, pupilMat, hc, s * 0.046, 0.026, 0.158, 0.014, 0.014, 0.006);
        p.userData.x = s * 0.046;
        p.userData.y = 0.026;
        f.eyes.push(e);
        f.pupils.push(p);
        const brow = add(G.box, m.hair, hc, s * 0.052, 0.098, 0.13, 0.05, 0.012, 0.012);
        brow.rotation.z = s * -0.12;
        f.face.push(e, brow, add(G.lo, m.skin, hc, s * 0.148, 0, 0, 0.018, 0.035, 0.026));
      }
      f.face.push(add(G.lo, m.skin, hc, 0, -0.018, 0.15, 0.028, 0.026, 0.036));
      f.mouth = add(G.mouth, dark, hc, 0, -0.06, 0.135, 1, 1, 0.5);
      f.face.push(f.mouth);
      f.mouth.rotation.z = Math.PI;
      f.mouthO = add(G.sph, dark, hc, 0, -0.07, 0.138, 0.022, 0.028, 0.01);
      f.mouthO.visible = false;
      P.tache = add(G.tache, m.hair, hc, 0, -0.042, 0.146);
      P.tache.rotation.z = Math.PI / 2;
      P.beard = add(G.sph, m.hair, hc, 0, -0.085, 0.06, 0.13, 0.1, 0.1);
      P.glasses = new THREE.Group();
      for (const s of [1, -1]) {
        const r = new THREE.Mesh(G.rim, dark);
        r.position.set(s * 0.05, 0.028, 0.163);
        P.glasses.add(r);
      }
      const bridge = new THREE.Mesh(G.box, dark);
      bridge.scale.set(0.02, 0.006, 0.006);
      bridge.position.set(0, 0.03, 0.165);
      P.glasses.add(bridge);
      hc.add(P.glasses);
    }
    P.hairTop = add(G.cap, m.hair, hc, 0, 0.012, -0.012, H * 1.07, H * 1.02, H * 1.08);
    P.hairTop.rotation.x = -0.34;
    P.fringe = add(G.sph, m.hair, hc, 0.035, 0.112, 0.086, 0.075, 0.035, 0.05);
    P.fringe.rotation.z = 0.35;
    P.tufts = new THREE.Group();
    for (const [x, z, r] of [
      [-0.05, -0.02, 0.5],
      [0.04, -0.06, -0.4],
      [0, 0.03, 0.1],
    ]) {
      const t = new THREE.Mesh(G.cone, m.hair);
      t.scale.set(0.035, 0.08, 0.035);
      t.position.set(x, 0.16, z);
      t.rotation.set(-0.4 + z * 3, 0, r);
      P.tufts.add(t);
    }
    hc.add(P.tufts);
    P.sides = add(G.horseshoe, m.hair, hc, 0, -0.005, 0, H * 1.0, H * 1.0, H * 1.0);
    P.sides.rotation.x = -Math.PI / 2;
    P.back = add(G.sph, m.hair, hc, 0, -0.07, -0.07, 0.13, 0.16, 0.08); // long hair
    P.helmet = new THREE.Group();
    const shell = new THREE.Mesh(G.helmet, m.helmet);
    shell.scale.set(0.182, 0.19, 0.192);
    shell.rotation.x = -0.28;
    shell.castShadow = shadows;
    P.helmet.add(shell);
    if (!lite) {
      const stripe = new THREE.Mesh(G.box, toon(0xffffff));
      stripe.scale.set(0.03, 0.02, 0.3);
      stripe.position.set(0, 0.175, -0.02);
      stripe.rotation.x = -0.15;
      P.helmet.add(stripe);
    }
    P.helmet.add(new THREE.Mesh(G.mask, metal));
    hc.add(P.helmet);
    P.tie = add(G.box, m.extra, chest, 0, -0.17, 0.125, 0.045, 0.28, 0.02);
    P.tag = add(G.box, toon(0xffffff), chest, 0.085, -0.08, 0.122, 0.07, 0.035, 0.012);
    P.number = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, alphaTest: 0.2 }));
    P.number.scale.set(0.24, 0.24, 1);
    P.number.position.set(0, -0.15, -0.13);
    P.number.rotation.y = Math.PI;
    chest.add(P.number);
    P.cane = new THREE.Group();
    const stick = new THREE.Mesh(G.cyl, toon(0x6b4226));
    stick.scale.set(0.014, 0.82, 0.014);
    stick.position.y = -0.41;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 5, 10, Math.PI), stick.material);
    hook.position.set(0.045, 0, 0);
    P.cane.add(stick, hook);
    armR.hand.add(P.cane);
    for (const k of ['tache', 'beard', 'glasses', 'tufts', 'back', 'helmet', 'tie', 'tag', 'number', 'cane']) if (P[k]) P[k].visible = false;
    pads.forEach((p) => (p.visible = false));
    hull({ group: root }, ROY_INK);
    rest(f);
    return f;
  }

  // dress a figure: colours, and which parts it has on
  function wear(f, o) {
    const m = f.m;
    m.skin.color.set(o.skin ?? SKIN);
    m.hair.color.set(o.hair ?? ROY_HAIR);
    m.shirt.color.set(o.shirt ?? 0xffffff);
    m.shirt.map = o.plaid ? plaidMap : plain;
    m.fore.map = o.plaid && o.sleeves ? plaidMap : plain;
    m.fore.color.set(o.sleeves ? (o.plaid ? 0xffffff : o.shirt) : (o.skin ?? SKIN));
    m.trousers.color.set(o.trousers ?? 0x4a5468);
    m.shin.color.set(o.shorts ? (o.skin ?? SKIN) : (o.trousers ?? 0x4a5468));
    m.shoes.color.set(o.shoes ?? 0x3a2a20);
    if (o.helmet != null) m.helmet.color.set(o.helmet);
    if (o.tie != null) m.extra.color.set(o.tie);
    const P = f.parts;
    const vis = (k, on) => P[k] && (P[k].visible = Boolean(on));
    vis('helmet', o.helmet != null);
    const bare = o.helmet != null;
    f.faceOn = !bare;
    for (const x of [...f.face, ...f.pupils]) x.visible = !bare;
    if (f.mouthO) f.mouthO.visible = false;
    vis('hairTop', !bare && !o.bald);
    vis('fringe', !bare && !o.bald);
    vis('sides', !bare);
    vis('tufts', !bare && o.tufts);
    vis('back', !bare && o.long);
    vis('tache', !bare && o.tache);
    vis('beard', !bare && o.beard);
    vis('glasses', !bare && o.glasses);
    vis('tie', o.tie != null);
    vis('tag', o.tag);
    vis('number', o.number);
    vis('cane', o.cane);
    f.pads.forEach((p) => (p.visible = Boolean(o.pads)));
    const belly = o.belly ?? 1;
    f.torso.scale.set(1.08 * belly * (o.pads ? 1.12 : 1), 1, 0.74 * belly);
    f.pelvis.scale.set(0.165 * Math.sqrt(belly), 0.11, 0.12 * belly);
    f.head.scale.setScalar(o.head ?? 1);
    f.scale = o.scale ?? 1;
  }

  // ── Roy ──
  const roy = makeFigure();
  scene.add(roy.root);
  const royShadow = blob(fx, 0.45);
  const royBall = football(roy.armR.hand);
  royBall.position.set(0, -0.07, 0.06);
  royBall.rotation.set(0.4, 0, 0);
  const tuckBall = football(roy.armL.hand);
  tuckBall.position.set(-0.04, 0.02, 0.08);
  tuckBall.rotation.set(-0.3, 0.3, 0);
  const royNumber = tex(128, 128, (g, w, h) => jerseyNumber(g, w, h, '12'));
  roy.parts.number.material.map = royNumber;
  // stars round his head when he's knocked down
  const stars = new THREE.Group();
  const starMat = new THREE.MeshBasicMaterial({ color: hot(0xffe14a, 1.4) });
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(G.star, starMat);
    s.scale.setScalar(0.11);
    stars.add(s);
  }
  stars.visible = false;
  fx.add(stars);

  // Roy's clothes for a stage, and his years: how tall, how broad, how grey
  let dressed = '';
  function dressRoy(life, outfit) {
    const age = ageOf(life);
    const key = `${outfit}|${age}`;
    if (key === dressed) return;
    dressed = key;
    const a = Math.max(6, age);
    const o = { skin: SKIN };
    if (outfit === 'kid') Object.assign(o, { shirt: 0xe8553f, trousers: 0x3f5d9c, shorts: true, shoes: 0xf2f2f2, tufts: true });
    else if (outfit === 'football') Object.assign(o, { shirt: 0x1f4fa8, trousers: 0xf0efe6, shoes: 0x1d1d22, helmet: 0x1f4fa8, pads: true, number: true });
    else if (outfit === 'gown') Object.assign(o, { shirt: 0xa9d6e5, trousers: 0xa9d6e5, shorts: true, shoes: 0xe8e8e8 });
    else if (outfit === 'woods') Object.assign(o, { shirt: 0xffffff, plaid: true, sleeves: true, trousers: 0x3d5a80, shoes: 0x5a3a20 });
    else Object.assign(o, { shirt: 0x9cc3e0, trousers: 0x8a7356, shoes: 0x3a2a20, tie: 0xa0302c, tag: true });
    o.scale = a < 12 ? lerp(0.62, 0.8, (a - 6) / 6) : a < 18 ? lerp(0.8, 0.97, (a - 12) / 6) : 0.97;
    o.head = a < 18 ? lerp(1.24, 1, (a - 6) / 12) : 1;
    o.belly = 1 + 0.24 * smooth(26, 58, a) - 0.08 * smooth(80, 100, a);
    const grey = new THREE.Color(ROY_HAIR).lerp(new THREE.Color(0xa6a6a6), smooth(40, 72, a)).lerp(new THREE.Color(0xeeeeee), smooth(74, 92, a));
    o.hair = grey.getHex();
    o.bald = a >= 62;
    o.tache = a >= 24 && outfit !== 'woods';
    o.beard = a >= 22 && outfit === 'woods';
    o.glasses = a >= 56;
    o.cane = a >= 84 && (outfit === 'job' || outfit === 'woods');
    wear(roy, o);
    // the hair going back from the forehead before it goes
    const recede = smooth(50, 62, a);
    roy.parts.hairTop.rotation.x = -0.34 - recede * 0.4;
    roy.parts.fringe.visible = roy.parts.fringe.visible && a < 54;
    roy.stoop = smooth(60, 100, a) * 0.5;
    roy.creak = smooth(72, 100, a);
  }
  // the years in his walk: a stoop, bent knees, a shorter stride
  const aged = (f) => {
    const s = f.stoop ?? 0;
    f.spine.rotation.x += s;
    f.neck.rotation.x -= s * 0.75;
    f.legL.knee.rotation.x += (f.creak ?? 0) * 0.18;
    f.legR.knee.rotation.x += (f.creak ?? 0) * 0.18;
    f.body.position.y -= (f.creak ?? 0) * 0.02;
  };
  let blinkT = 2;
  let blinkOn = 0;

  // where he sits down at the very end: a stool, or a stump
  const seat = (parent, wood) => {
    const grp = new THREE.Group();
    const top = new THREE.Mesh(G.cyl, wood ? mats.toon(0x7a5232) : mats.toon(0xa8743e));
    top.scale.set(wood ? 0.32 : 0.24, wood ? 0.46 : 0.06, wood ? 0.32 : 0.24);
    top.position.y = wood ? 0.23 : 0.46;
    top.castShadow = true;
    grp.add(top);
    if (!wood)
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Mesh(G.cyl, top.material);
        const a = (i / 3) * Math.PI * 2;
        leg.scale.set(0.025, 0.45, 0.025);
        leg.position.set(Math.cos(a) * 0.16, 0.22, Math.sin(a) * 0.16);
        leg.castShadow = true;
        grp.add(leg);
      }
    grp.visible = false;
    parent.add(grp);
    return grp;
  };
  const peace = (x) => glow.spawn({ x, y: 1.2, z: 0, n: 30, speed: 0.8, up: 1, spread: 0.6, colors: [0xffd23a, 0xfff2c0], k: 2, size: 0.22, life: 2.2, gravity: -1.2, drag: 0.4, box: 0.8 });

  // ══ the vignettes ══
  // Each: { group, light, enter(life), update(dt, life), event(name, life), cam: { pos, look, fov } }
  const V = {};
  const laneX = (lane, w) => (lane - 1) * w;
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // ── growing up: the backyard, a tire on a rope, a boy at the window ──
  V.kid = (() => {
    const g = new THREE.Group();
    g.name = 'kid';
    const ov = overlay();
    const TZ = -8.2; // where the tire hangs
    const b = batch();
    const grass = mats.toon(0xffffff, { map: tileTex(256, 256, (c, w, h) => speckle(c, w, h, { base: '#5fae45', specks: ['#4f9a3c', '#6cbd50', '#57a541', '#78c45a'], n: 2600, size: 2.2, seed: 7 }), [28, 28]) });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140).rotateX(-Math.PI / 2), grass);
    ground.receiveShadow = true;
    g.add(ground);
    // a white picket fence round the yard
    const white = mats.toon(0xf4f1e6);
    const picket = new THREE.BoxGeometry(0.1, 1.05, 0.035);
    const point = new THREE.ConeGeometry(0.075, 0.13, 4);
    const rail = new THREE.BoxGeometry(1, 0.07, 0.05);
    owned.push(picket, point, rail);
    const fence = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ang = Math.atan2(-(z1 - z0), x1 - x0);
      const n = Math.floor(len / 0.24);
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n;
        const x = x0 + (x1 - x0) * k;
        const z = z0 + (z1 - z0) * k;
        b.add(picket, white, at(x, 0.525, z, ang));
        b.add(point, white, at(x, 1.11, z, ang + Math.PI / 4));
      }
      for (const y of [0.32, 0.82]) b.add(rail, white, at((x0 + x1) / 2, y, (z0 + z1) / 2, ang, len, 1, 1));
    };
    fence(-22, -18, 22, -18);
    fence(-22, -18, -22, 8);
    // the tree, its branch out over the yard
    const bark1 = mats.toon(0x7a5232);
    const leaf = [mats.toon(0x4f9a3c), mats.toon(0x3f8a34), mats.toon(0x5fae45)];
    b.add(G.cyl, bark1, at(-4.4, 3, TZ, 0, 0.45, 6, 0.45, 0, 0.05));
    b.add(G.cyl, bark1, at(-1.9, 5.45, TZ, 0, 0.17, 5.2, 0.17, 0, Math.PI / 2 - 0.05));
    b.add(G.cyl, bark1, at(-5.6, 0.25, TZ + 0.5, 0.6, 0.3, 0.8, 0.3, 0, 1.1));
    const blobs = [
      [-4.4, 7.2, -9.6, 2.3],
      [-5.9, 6.4, -10.4, 1.7],
      [-3.0, 6.6, -10.6, 1.6],
      [-4.8, 6.1, -8.1, 1.5],
      [-1.6, 6.3, -9.6, 1.3],
      [-0.2, 6.0, -9.9, 1.0],
      [-6.4, 5.4, -8.6, 1.1],
    ];
    blobs.forEach(([x, y, z, r], i) => b.add(G.sph, leaf[i % 3], at(x, y, z + 1.3, i, r, r * 0.85, r)));
    // the house, at the side of the yard: siding, a window, Roy's room inside
    const sidingMat = mats.toon(0xffffff, { map: tileTex(128, 128, siding, [1, 1]) });
    sidingMat.userData.tile = 1.6;
    const W0 = -7;
    const W1 = 5;
    const wy0 = 1.15;
    const wy1 = 2.35;
    const wz0 = -2.7;
    const wz1 = -0.5;
    b.add(G.box, sidingMat, at(6.65, wy0 / 2, (W0 + W1) / 2, 0, 0.3, wy0, W1 - W0));
    b.add(G.box, sidingMat, at(6.65, (wy1 + 3.4) / 2, (W0 + W1) / 2, 0, 0.3, 3.4 - wy1, W1 - W0));
    b.add(G.box, sidingMat, at(6.65, (wy0 + wy1) / 2, (W0 + wz0) / 2, 0, 0.3, wy1 - wy0, wz0 - W0));
    b.add(G.box, sidingMat, at(6.65, (wy0 + wy1) / 2, (wz1 + W1) / 2, 0, 0.3, wy1 - wy0, W1 - wz1));
    const trim = mats.toon(0xffffff);
    b.add(G.box, trim, at(6.45, wy0 - 0.05, (wz0 + wz1) / 2, 0, 0.32, 0.1, wz1 - wz0 + 0.4));
    b.add(G.box, trim, at(6.5, wy1 + 0.05, (wz0 + wz1) / 2, 0, 0.12, 0.1, wz1 - wz0 + 0.3));
    for (const z of [wz0 - 0.05, wz1 + 0.05, (wz0 + wz1) / 2]) b.add(G.box, trim, at(6.5, (wy0 + wy1) / 2, z, 0, 0.12, wy1 - wy0, z === (wz0 + wz1) / 2 ? 0.05 : 0.1));
    b.add(G.box, mats.toon(0x2f5c8a), at(6.48, (wy0 + wy1) / 2, wz0 - 0.55, 0, 0.06, wy1 - wy0 + 0.1, 0.55));
    b.add(G.box, mats.toon(0x2f5c8a), at(6.48, (wy0 + wy1) / 2, wz1 + 0.55, 0, 0.06, wy1 - wy0 + 0.1, 0.55));
    b.add(hipRoof(8.4, 13, 2.2), mats.toon(0x8e3b2e), at(10.4, 3.4, (W0 + W1) / 2));
    // the room behind the window
    b.add(G.box, mats.toon(0xd9c38f), at(8.2, 0.2, -1.6, 0, 3, 0.4, 4));
    b.add(G.box, mats.toon(0x6f9bc4), at(9.6, 1.7, -1.6, 0, 0.1, 3.4, 4));
    b.add(G.box, mats.toon(0xe8d96a), at(6.85, 1.75, wz0 + 0.2, 0, 0.12, 1.3, 0.35));
    b.add(G.box, mats.toon(0xe8d96a), at(6.85, 1.75, wz1 - 0.2, 0, 0.12, 1.3, 0.35));
    const poster = new THREE.Mesh(G.plane, mats.toon(0xffffff, { map: tex(256, 128, pennant) }));
    poster.scale.set(1.3, 0.65, 1);
    poster.position.set(9.53, 1.95, -1.4);
    poster.rotation.y = -Math.PI / 2;
    g.add(poster);
    // the bushes and beds along the fence and the house
    const bush = [mats.toon(0x3f8a34), mats.toon(0x4f9a3c)];
    for (let i = 0; i < 14; i++) b.add(G.sph, bush[i % 2], at(-19 + i * 2.9, 0.5, -17.1 + (i % 3) * 0.2, 0, 0.9 + (i % 3) * 0.2, 0.75, 0.8));
    const petals = [mats.toon(0xff6f91), mats.toon(0xffd23a), mats.toon(0xffffff), mats.toon(0xc77dff)];
    const r = rng(21);
    for (let i = 0; i < 40; i++) b.add(G.lo, petals[i % 4], at(-18 + r() * 23, 0.18, -16.2 + r() * 0.8, 0, 0.11));
    // the neighbours over the fence
    const roofs = [mats.toon(0x5a6b8c), mats.toon(0x8e3b2e), mats.toon(0x4a6b4a)];
    const walls = [mats.toon(0xf2e2c4), mats.toon(0xcfe0e8), mats.toon(0xf0d0c0)];
    for (let i = 0; i < 5; i++) {
      const x = -26 + i * 13;
      b.add(G.box, walls[i % 3], at(x, 2.2, -30, 0, 8, 4.4, 7));
      b.add(hipRoof(9, 8, 2.6), roofs[i % 3], at(x, 4.4, -30));
      b.add(G.cyl, bark1, at(x + 6.5, 1.5, -24, 0, 0.25, 3, 0.25));
      b.add(G.sph, leaf[i % 3], at(x + 6.5, 4, -24, 0, 2, 1.8, 2));
    }
    b.build(g);
    // the tire on its rope
    const swing = new THREE.Group();
    swing.position.set(0, 5.35, TZ);
    const L = 3.3;
    const rope = new THREE.Mesh(G.cyl, mats.toon(0xd8c08a));
    rope.scale.set(0.028, L, 0.028);
    rope.position.y = -L / 2;
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.15, 10, 24), mats.toon(0x2b2b30));
    tire.position.y = -L - 0.5;
    tire.castShadow = rope.castShadow = true;
    swing.add(rope, tire);
    g.add(swing);
    const tireShadow = blob(g, 0.55);
    // where the tire hangs straight down: lit while a throw would go through
    const target = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    target.rotation.x = -Math.PI / 2;
    target.position.set(0, 0.03, TZ);
    target.scale.setScalar(0.7);
    g.add(target);
    const targetOn = hot(0x9dff5a, 1.6);
    const targetOff = new THREE.Color(0xffffff).multiplyScalar(0.35);
    // the bucket of balls, the balls thrown, the one in the air
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.32, 14), mats.toon(0xc9a066));
    bucket.position.set(0.85, 0.16, 0.35);
    bucket.castShadow = true;
    g.add(bucket);
    const inBucket = Array.from({ length: 4 }, (_, i) => {
      const f = football(g);
      f.position.set(0.85 + Math.cos(i * 1.7) * 0.08, 0.36 + (i > 1 ? 0.06 : 0), 0.35 + Math.sin(i * 1.7) * 0.08);
      f.rotation.set(0.6 + i, i * 1.3, 0.3);
      return f;
    });
    const landed = Array.from({ length: KID.throws }, () => {
      const f = football(g);
      f.visible = false;
      return f;
    });
    const flight = football(g);
    flight.visible = false;
    const fly = { on: false, t: 0, hit: false, from: v3(0, 0, 0), stage: 0, vel: v3(0, 0, 0), landedN: 0 };
    // the boy at the window, and what he's dreaming of
    const thought = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(512, 384, dream), transparent: true, depthWrite: false }));
    thought.scale.set(1.5, 1.12, 1);
    thought.position.set(6.05, 2.85, -2.95);
    ov.add(thought);
    let throwT = 9;
    let jiggle = 0;
    let dreamT = 0;
    const hand = v3(0, 0, 0);
    const tirePos = v3(0, 0, 0);
    const cam = { pos: v3(1.9, 2.3, 4.7), look: v3(-0.35, 1.2, -6), fov: 48, rate: 7 };
    const throwBall = (hit) => {
      throwT = 0;
      roy.armR.hand.getWorldPosition(hand);
      fly.on = true;
      fly.t = 0;
      fly.hit = hit;
      fly.stage = 0;
      fly.from.copy(hand);
      flight.position.copy(hand);
      flight.visible = true;
    };
    return {
      group: g,
      over: ov,
      light: { hemi: [0xd6f0ff, 0x6a9a4a, 1.3], sun: [0xfff3df, 2.4], dir: [-0.55, 0.78, 0.45], at: [0, 0, -5], box: 16, sky: { top: 0x3f9be0, mid: 0x86cbf2, low: 0xd8f3fb, sun: 0xfff6d8, clouds: 1, moons: 0 }, fog: [0xcfeefa, 60, 160] },
      cam,
      enter() {
        fly.on = false;
        flight.visible = false;
        fly.landedN = 0;
        landed.forEach((l) => (l.visible = false));
        throwT = 9;
        dreamT = 0;
      },
      event(e, life) {
        if (e === 'throw') throwBall(life.events.includes('hit'));
      },
      update(dt, life, t) {
        const s = life.s;
        const dreaming = life.t === 0;
        // the swing, the tire's jiggle when a ball goes through
        jiggle *= Math.exp(-dt * 3);
        swing.rotation.z = s.phase * SWING;
        tire.rotation.y = Math.sin(t * 18) * jiggle;
        tire.getWorldPosition(tirePos);
        tireShadow.position.set(tirePos.x, 0.02, tirePos.z);
        const lit = inBand(s.phase) && s.throws < KID.throws && !dreaming;
        target.material.color.copy(lit ? targetOn : targetOff);
        target.scale.setScalar(lit ? 0.78 : 0.7);
        // the ball in the air: out to the tire (through it, on a hit), then down
        if (fly.on) {
          fly.t += dt;
          if (fly.stage === 0) {
            const k = Math.min(1, fly.t / 0.3);
            const aim = fly.hit ? tirePos : v3(0, tirePos.y, TZ);
            const to = v3(lerp(0, aim.x, k * k), aim.y, aim.z);
            flight.position.lerpVectors(fly.from, to, k);
            flight.position.y += Math.sin(k * Math.PI) * 0.9;
            flight.rotation.set(-0.3, 0, t * 20);
            if (k >= 1) {
              fly.stage = 1;
              fly.t = 0;
              const near = Math.abs(tirePos.x) < 0.95;
              if (fly.hit) {
                jiggle = 0.5;
                glow.spawn({ x: tirePos.x, y: tirePos.y, z: tirePos.z, n: 18, speed: 3, colors: [0x9dff5a, 0xfff2a0], k: 2.2, size: 0.25, life: 0.5, gravity: 2 });
                ringAt(tirePos.x, tirePos.y, tirePos.z + 0.1, 0x9dff5a, { flat: false, s0: 0.3, s1: 1.3, span: 0.45 });
                fly.vel.set(0, 1.5, -7);
              } else if (near) {
                fly.vel.set(Math.sign(-tirePos.x || 1) * 3, 2.5, 3);
                jiggle = 0.25;
              } else fly.vel.set((Math.random() - 0.5) * 2, 1.2, -6.5);
            }
          } else {
            fly.vel.y -= 14 * dt;
            flight.position.addScaledVector(fly.vel, dt);
            flight.rotation.x += dt * 8;
            if (flight.position.y < 0.09) {
              flight.position.y = 0.09;
              if (Math.abs(fly.vel.y) > 2) {
                fly.vel.y *= -0.35;
                fly.vel.x *= 0.6;
                fly.vel.z *= 0.6;
              } else {
                fly.on = false;
                flight.visible = false;
                const l = landed[fly.landedN % landed.length];
                fly.landedN += 1;
                l.position.copy(flight.position);
                l.rotation.set(0, Math.random() * 6, Math.PI / 2);
                l.visible = true;
              }
            }
          }
        }
        // the boy: at the window first, then out in the yard with a ball
        throwT += dt;
        rest(roy);
        if (dreaming) {
          dreamT += dt;
          roy.root.position.set(7.35, 0.4, -1.6);
          roy.root.rotation.y = -Math.PI / 2;
          roy.armL.shoulder.rotation.set(-1.25, 0, -0.15);
          roy.armR.shoulder.rotation.set(-1.25, 0, 0.15);
          roy.armL.elbow.rotation.set(-1.25, 0, 0);
          roy.armR.elbow.rotation.set(-1.25, 0, 0);
          roy.spine.rotation.x = 0.2;
          roy.neck.rotation.x = -0.35;
          roy.head.rotation.z = Math.sin(t * 0.8) * 0.08;
          eyes(roy, { look: [0.4, 1], shut: 0.35 });
          mood(roy, 'smile');
          royBall.visible = false;
          thought.visible = true;
          thought.material.opacity = Math.min(1, dreamT * 2);
          thought.position.y = 2.85 + Math.sin(t * 1.6) * 0.05;
        } else {
          thought.visible = false;
          roy.root.position.set(0, 0, 0);
          roy.root.rotation.y = Math.PI;
          const left = KID.throws - s.throws;
          // ready: the ball cocked back by his ear; a throw whips it forward
          const k = clamp(throwT / 0.32, 0, 1);
          const back = throwT < 0.32 ? lerp(2.5, -1.1, easeOut(k * 1.4)) : lerp(-1.1, 2.5, smooth(0.5, 1.1, throwT));
          roy.armR.shoulder.rotation.set(back, 0, -0.25);
          roy.armR.elbow.rotation.x = throwT < 0.32 ? -0.3 : lerp(-0.3, -1.4, smooth(0.5, 1.1, throwT));
          roy.armL.shoulder.rotation.set(-0.9 + k * 0.6, 0, 0.3);
          roy.spine.rotation.y = throwT < 0.4 ? lerp(0.35, -0.3, k) : lerp(-0.3, 0.35, smooth(0.5, 1.1, throwT));
          roy.legL.hip.rotation.x = -0.25;
          roy.legR.hip.rotation.x = 0.2;
          royBall.visible = left > 0 && throwT > 0.6;
          eyes(roy, { look: [0, 0.2] });
          mood(roy, 'smile');
          const inHand = royBall.visible ? 1 : 0;
          inBucket.forEach((f, i) => (f.visible = i < left - inHand));
        }
        aged(roy);
        cam.pos.set(...(dreaming ? [3.5, 1.75, 1.3] : [1.9, 2.3, 4.7]));
        cam.look.set(...(dreaming ? [6.6, 1.75, -1.75] : [-0.35, 1.2, -6]));
        cam.fov = dreaming ? 42 : 48;
      },
    };
  })();

  // ── Friday nights: a floodlit field, three lanes, the other side coming ──
  V.football = (() => {
    const g = new THREE.Group();
    g.name = 'football';
    const field = new THREE.Group();
    g.add(field);
    const b = batch();
    const turf = mats.toon(0xffffff, { map: tileTex(64, 128, fieldStripes, [6, 16]) });
    b.add(new THREE.PlaneGeometry(70, 160).rotateX(-Math.PI / 2), turf, at(0, 0, -60));
    const chalk = mats.toon(0xf4f4f0);
    const line = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    owned.push(line);
    for (let f = 0; f <= 100; f += 5) b.add(line, chalk, at(0, 0.012, -f, 0, 48.8, 1, f === 0 || f === 100 ? 0.4 : 0.15));
    for (const x of [-24.4, 24.4]) b.add(line, chalk, at(x, 0.012, -55, 0, 0.3, 1, 130));
    // the lanes, in dashes, so a step aside reads
    for (let f = 2; f < 100; f += 2.5) for (const x of [-LANE.field / 2, LANE.field / 2]) b.add(line, chalk, at(x, 0.013, -f, 0, 0.1, 1, 1.1));
    for (let f = 1; f < 100; f += 1) for (const x of [-7.5, 7.5]) b.add(line, chalk, at(x, 0.013, -f, 0, 0.5, 1, 0.1));
    // the stands either side, stepped
    const stand = mats.toon(0x6d7486);
    const standEdge = mats.toon(0x4b5164);
    for (const s of [-1, 1])
      for (let i = 0; i < 7; i++) {
        b.add(G.box, i % 2 ? stand : standEdge, at(s * (29 + i * 1.4), 0.35 + i * 0.7, -55, 0, 1.4, 0.7 + i * 1.4, 150));
      }
    // the posts and the board beyond the end zone
    const yellow = mats.toon(0xffd23a);
    b.add(G.cyl, yellow, at(0, 1.6, -111.2, 0, 0.12, 3.2, 0.12));
    b.add(G.cyl, yellow, at(0, 3.1, -110.6, 0, 0.1, 1.3, 0.1, Math.PI / 2));
    b.add(G.cyl, yellow, at(0, 3.1, -110, 0, 0.1, 5.6, 0.1, 0, Math.PI / 2));
    for (const x of [-2.8, 2.8]) b.add(G.cyl, yellow, at(x, 6.1, -110, 0, 0.08, 6, 0.08));
    const tower = mats.toon(0x3a3f4e);
    for (const s of [-1, 1])
      for (const f of [-12, 25, 62, 99, 128]) {
        b.add(G.cyl, tower, at(s * 41, 13, -f, 0, 0.4, 26, 0.4));
        b.add(G.box, tower, at(s * 40.5, 26.5, -f, 0, 1, 2.8, 5.2));
      }
    b.add(G.box, tower, at(0, 8.6, -131, 0, 14.4, 7.4, 1));
    b.add(G.cyl, tower, at(-6, 3, -131.6, 0, 0.5, 6, 0.5));
    b.add(G.cyl, tower, at(6, 3, -131.6, 0, 0.5, 6, 0.5));
    b.build(field, { cast: false });
    // the light banks (glowing) and the cones of light under them
    const lamp = new THREE.MeshBasicMaterial({ color: hot(0xf6f8ff, 2.6) });
    const lampGeo = new THREE.PlaneGeometry(0.75, 0.55);
    owned.push(lampGeo);
    const bank = new THREE.InstancedMesh(lampGeo, lamp, 2 * 5 * 12);
    let bi = 0;
    for (const s of [-1, 1])
      for (const f of [-12, 25, 62, 99, 128])
        for (let r2 = 0; r2 < 3; r2++)
          for (let c = 0; c < 4; c++) {
            bank.setMatrixAt(bi++, at(s * 39.95, 25.6 + r2 * 0.75, -f - 1.5 + c * 1, s > 0 ? -Math.PI / 2 : Math.PI / 2));
          }
    field.add(bank);
    const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdfe8ff).multiplyScalar(0.035), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    for (const s of [-1, 1])
      for (const f of [25, 62, 99]) {
        const beam = new THREE.Mesh(G.cone, beamMat);
        beam.scale.set(9, 26, 9);
        beam.position.set(s * 30, 13, -f);
        beam.rotation.z = s * 0.55;
        field.add(beam);
      }
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(48.8, 10).rotateX(-Math.PI / 2), mats.toon(0xffffff, { map: tex(1024, 256, endZone) }));
    zone.position.set(0, 0.008, -105);
    zone.receiveShadow = true;
    field.add(zone);
    // yard numbers, from an atlas
    const atlas = tex(512, 96, numberAtlas);
    const numMat = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, color: 0xe8e8e2 });
    const nums = [];
    for (let f = 10; f <= 90; f += 10) {
      const n = Math.min(f, 100 - f) / 10 - 1;
      for (const s of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(3.2, 1.6).rotateX(-Math.PI / 2);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, (n + uv.getX(i)) / 5);
        geo.applyMatrix4(at(s * 17, 0.014, -f, s * -Math.PI / 2));
        nums.push(geo);
      }
    }
    const numbers = new THREE.Mesh(mergeGeometries(nums), numMat);
    nums.forEach((n) => n.dispose());
    field.add(numbers);
    // the crowd: two halves bobbing out of step, each fan a few triangles (a body
    // and a head), sat closer together the more the device can afford
    const crowdGeo = (() => {
      const torsoGeo = new THREE.CylinderGeometry(0.19, 0.25, 0.6, 5, 1).translate(0, 0.3, 0).toNonIndexed();
      const headGeo = new THREE.OctahedronGeometry(0.15).translate(0, 0.76, 0);
      const merged = mergeGeometries([torsoGeo, headGeo]);
      torsoGeo.dispose();
      headGeo.dispose();
      return merged;
    })();
    owned.push(crowdGeo);
    const crowdMat = toon(0xffffff);
    const crowds = [0, 1].map(() => new THREE.InstancedMesh(crowdGeo, crowdMat, 1400));
    const seat = { high: 1.1, mid: 1.6, low: 2 }[tier] ?? 1.1;
    const cr = rng(5);
    const counts = [0, 0];
    const cc = new THREE.Color();
    const crowdCols = [0x1f4fa8, 0x1f4fa8, 0xffffff, 0xffd23a, 0xd8443a, 0x2a2a2a, 0xf2c9a0];
    for (const s of [-1, 1])
      for (let i = 0; i < 7; i++)
        for (let f = -20; f < 128; f += seat) {
          const h = cr() < 0.5 ? 0 : 1;
          if (counts[h] >= 1400 || cr() < 0.12) continue;
          crowds[h].setMatrixAt(counts[h], at(s * (29 + i * 1.4) + (cr() - 0.5) * 0.3, 0.7 + i * 1.4, -f - cr() * 0.5, cr() * 6));
          crowds[h].setColorAt(counts[h], cc.set(crowdCols[Math.floor(cr() * crowdCols.length)]));
          counts[h] += 1;
        }
    crowds.forEach((m, i) => {
      m.count = counts[i];
      field.add(m);
    });
    // the clock on the board
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 512;
    boardCanvas.height = 256;
    const boardTex = new THREE.CanvasTexture(boardCanvas);
    sharpen(boardTex);
    boardTex.colorSpace = THREE.SRGBColorSpace;
    owned.push(boardTex);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), new THREE.MeshBasicMaterial({ map: boardTex, color: new THREE.Color(1, 1, 1).multiplyScalar(1.25) }));
    board.position.set(0, 8.6, -130.4);
    field.add(board);
    let boardKey = '';
    const drawBoard = (secs, home) => {
      const k = `${secs}|${home}`;
      if (k === boardKey) return;
      boardKey = k;
      scoreboard(boardCanvas.getContext('2d'), 512, 256, secs, home);
      boardTex.needsUpdate = true;
    };
    // the other side: helmets, red shirts
    const red = lookFor(3);
    const tacklers = Array.from({ length: 7 }, () => {
      const f = makeFigure({ face: false, shadows: false, lite: true });
      wear(f, { skin: red.skin, shirt: 0xc0392b, trousers: 0xf0efe6, shoes: 0x1d1d22, helmet: 0xc0392b, pads: true, scale: 1.02 });
      f.root.visible = false;
      g.add(f.root);
      const warn = new THREE.Mesh(G.flat, new THREE.MeshBasicMaterial({ map: spot, color: hot(0xff3b2f, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      warn.scale.set(2.2, 1, 2.2);
      g.add(warn);
      return { f, warn, shadow: blob(g, 0.45) };
    });
    let royX = 0;
    let celebrate = -1;
    let scored = false;
    const cam = { pos: v3(0, 3.3, 6.6), look: v3(0, 1.1, -14), fov: 52 };
    return {
      group: g,
      over: overlay(),
      light: { hemi: [0x5d77b8, 0x22382a, 0.9], sun: [0xf2f5ff, 2.5], dir: [0.35, 0.85, 0.4], at: [0, 0, -4], box: 18, sky: { top: 0x040818, mid: 0x0c1736, low: 0x26335e, sun: 0x000000, clouds: 0, moons: 0 }, fog: [0x101a36, 70, 190], exposure: 1.05 },
      cam,
      enter(life) {
        royX = laneX(life.lane, LANE.field);
        celebrate = -1;
        scored = false;
        boardKey = '';
      },
      event(e) {
        if (e === 'tackle') {
          dust.spawn({ x: royX, y: 0.6, z: -0.6, n: 16, speed: 2.4, colors: [0xd8e0c8, 0xb8c4a8], size: 0.7, life: 0.8, gravity: -0.4, drag: 2, growth: 1.2, box: 0.6 });
          ringAt(royX, 0.05, 0, 0xffffff, { s0: 0.3, s1: 2.6, span: 0.5 });
        } else if (e === 'touchdown') {
          celebrate = 0;
          scored = true;
          for (const x of [-6, 6, 0])
            confetti.spawn({ x: royX + x, y: 4.5, z: -3, n: 70, speed: 5, up: 1.2, spread: 1, colors: CONFETTI, size: 1.2, life: 3.2, gravity: 2.2, drag: 1.4, box: 3 });
          for (let i = 0; i < 4; i++) glow.spawn({ x: -14 + i * 9, y: 16 + (i % 2) * 4, z: -40, n: 26, speed: 9, up: 0.4, colors: [0xffd23a, 0xff5a5f, 0x4fc3f7, 0x9dff5a], k: 2.4, size: 0.9, life: 1.3, gravity: 3, drag: 1.2 });
        }
      },
      update(dt, life, t) {
        const s = life.s;
        field.position.z = s.dist;
        drawBoard(Math.ceil(Math.max(0, FOOTBALL.limit - s.time)), scored || s.dist >= FOOTBALL.goal ? 6 : 0);
        const want = laneX(life.lane, LANE.field);
        const was = royX;
        royX += (want - royX) * damp(dt, 14);
        // Roy: running, knocked flat, or the touchdown
        rest(roy);
        roy.root.position.set(royX, 0, 0);
        roy.root.rotation.y = Math.PI;
        if (celebrate >= 0) celebrate += dt;
        if (celebrate >= 0) {
          cheerPose(roy, Math.min(1, celebrate * 5), t);
          tuckBall.visible = false;
        } else if (s.stun > 0) {
          const k = s.stun > 1.2 ? smooth(1.5, 1.25, s.stun) : smooth(0, 0.45, s.stun);
          knockedPose(roy, k, t);
          tuckBall.visible = true;
        } else {
          stride(roy, s.dist * 1.35, 1, 0.22);
          roy.armL.shoulder.rotation.x = -0.35;
          roy.armL.elbow.rotation.x = -1.9;
          roy.body.rotation.z = clamp((royX - was) / Math.max(dt, 1e-3), -6, 6) * 0.03;
          tuckBall.visible = true;
        }
        aged(roy);
        stars.visible = s.stun > 0 && celebrate < 0;
        if (stars.visible) {
          roy.hc.getWorldPosition(stars.position);
          stars.position.y += 0.12;
          stars.children.forEach((st, i) => {
            const a = t * 5 + (i * Math.PI * 2) / 3;
            st.position.set(Math.cos(a) * 0.32, Math.sin(t * 7 + i) * 0.05, Math.sin(a) * 0.32);
            st.rotation.set(t * 3, a, 0);
          });
        }
        // the tacklers, by where the rules have them
        tacklers.forEach((tk, i) => {
          const k = s.tacklers[i] && s.tacklers[i].z > -0.8 ? s.tacklers[i] : null;
          tk.f.root.visible = Boolean(k);
          tk.warn.visible = Boolean(k) && k.z > 0;
          tk.shadow.visible = Boolean(k);
          if (!k) return;
          const x = laneX(k.lane, LANE.field);
          rest(tk.f);
          tk.f.root.position.set(x, 0, -k.z);
          tk.f.root.rotation.y = 0;
          stride(tk.f, k.z * 1.1 + i, 1, 0.35 + (k.z < 9 ? 0.25 : 0));
          if (k.z < 9) {
            tk.f.armL.shoulder.rotation.x = tk.f.armR.shoulder.rotation.x = -1.3;
            tk.f.armL.elbow.rotation.x = tk.f.armR.elbow.rotation.x = -0.4;
          }
          const near = smooth(28, 4, k.z);
          tk.warn.position.set(x, 0.03, -k.z + 0.4);
          tk.warn.material.opacity = 0.2 + near * 0.8;
          tk.warn.scale.setScalar(1.6 + near * 0.8);
          tk.shadow.position.set(x, 0.02, -k.z);
        });
        // the crowd on its feet for the touchdown
        const jump = celebrate >= 0 ? 0.35 : 0.06;
        crowds[0].position.y = Math.abs(Math.sin(t * (celebrate >= 0 ? 9 : 3))) * jump;
        crowds[1].position.y = Math.abs(Math.sin(t * (celebrate >= 0 ? 9 : 3) + 1.6)) * jump;
        royShadow.position.set(royX, 0.02, 0);
        cam.pos.set(royX * 0.55, 3.3, 6.6);
        cam.look.set(royX * 0.35, 1.1, -14);
      },
    };
  })();

  // ── the carpet store: three aisles; behind the counter, then in the finale, in the way ──
  V.store = (() => {
    const g = new THREE.Group();
    g.name = 'store';
    const ov = overlay();
    const b = batch();
    const floor = mats.toon(0xffffff, { map: tileTex(256, 256, (c, w, h) => tiles(c, w, h, '#e9e1cf', '#d6cdb8'), [10, 22]) });
    b.add(new THREE.PlaneGeometry(24, 52).rotateX(-Math.PI / 2), floor, at(0, 0, -12));
    const wall = mats.toon(0xf1e3b5);
    const wainscot = mats.toon(0x9a6b45);
    b.add(G.box, wall, at(0, 2.75, -36.2, 0, 24, 5.5, 0.4));
    for (const s of [-1, 1]) {
      b.add(G.box, wall, at(s * 12.2, 2.75, -12, 0, 0.4, 5.5, 52));
      b.add(G.box, wainscot, at(s * 11.95, 0.5, -12, 0, 0.12, 1, 52));
    }
    b.add(G.box, wall, at(0, 2.75, 14.2, 0, 24, 5.5, 0.4));
    b.add(G.box, mats.toon(0xf8f6f0), at(0, 5.6, -12, 0, 24.8, 0.2, 52));
    // the racks, back to back between the aisles, holding each aisle's rolls
    const steel = mats.toon(0x5c6b7a);
    const shelf = mats.toon(0x8a96a3);
    for (const x of [-5.1, -1.7, 1.7, 5.1]) {
      for (let z = -5; z >= -34; z -= 4.14) b.add(G.box, steel, at(x, 1.9, z, 0, 0.14, 3.8, 0.14));
      for (const y of [0.9, 1.7, 2.5, 3.3]) b.add(G.box, shelf, at(x, y, -19.5, 0, 0.9, 0.06, 29.2));
    }
    const body = CARPETS.map((c) => mats.toon(0xffffff, { map: tileTex(128, 128, (g2, w, h) => carpetPattern(g2, w, h, c), [3, 1]) }));
    const ends = CARPETS.map((c) => mats.toon(0xffffff, { map: tex(128, 128, (g2, w, h) => rollEnd(g2, w, h, c)) }));
    const rollSide = new THREE.CylinderGeometry(0.28, 0.28, 1, 16, 1, true);
    const rollCap = new THREE.CircleGeometry(0.28, 16);
    owned.push(rollSide, rollCap);
    const rr = rng(8);
    CARPETS.forEach((c, k) => {
      const cx = laneX(k, LANE.store);
      for (const side of [-1, 1])
        for (const y of [1.21, 2.01, 2.81]) {
          for (let z = -5.3; z > -33.5; z -= 4.14) {
            const len = 3.6 + rr() * 0.3;
            const x = cx + side * 1.32 + (rr() - 0.5) * 0.08;
            const zc = z - len / 2 - 0.1;
            b.add(rollSide, body[k], at(x, y, zc, 0, 1, len, 1, Math.PI / 2));
            b.add(rollCap, ends[k], at(x, y, zc + len / 2 + 0.001, 0));
          }
        }
    });
    // the counter and till, the samples on the wall, a plant
    b.add(G.box, mats.toon(0x8a5a34), at(8.2, 0.55, 1.2, 0, 3.2, 1.1, 1.1));
    b.add(G.box, mats.toon(0xd9b98a), at(8.2, 1.12, 1.2, 0, 3.4, 0.06, 1.3));
    b.add(G.box, mats.toon(0x3a3f4e), at(7.6, 1.35, 1.2, 0.3, 0.6, 0.4, 0.5));
    b.add(G.box, mats.toon(0x9dd4a0), at(7.6, 1.62, 1.08, 0.3, 0.44, 0.2, 0.06));
    CARPETS.forEach((c, k) => {
      for (let i = 0; i < 2; i++) b.add(G.box, body[k], at(-11.9, 1.6 + i * 1.6, -2 - k * 2.4 - i * 1.2, 0, 0.06, 1.2, 1.6));
    });
    b.add(G.box, mats.toon(0x6b4a2a), at(12.0, 1.15, 5.2, 0, 0.08, 2.3, 1.5));
    b.add(G.box, mats.toon(0xbfe3f0), at(11.95, 1.5, 5.2, 0, 0.06, 0.9, 0.9));
    b.add(G.cyl, mats.toon(0xb5651d), at(10.8, 0.35, -3.2, 0, 0.35, 0.7, 0.35));
    for (let i = 0; i < 6; i++) b.add(G.sph, mats.toon(i % 2 ? 0x3f8a34 : 0x4f9a3c), at(10.8 + Math.cos(i) * 0.25, 1 + (i % 3) * 0.25, -3.2 + Math.sin(i) * 0.25, 0, 0.35));
    b.build(g);
    // the lights in the ceiling
    const panel = new THREE.MeshBasicMaterial({ color: hot(0xfffdf4, 1.7) });
    const panelGeo = new THREE.BoxGeometry(0.5, 0.05, 2.4);
    owned.push(panelGeo);
    const panels = new THREE.InstancedMesh(panelGeo, panel, 3 * 9);
    let pi = 0;
    for (let k = 0; k < 3; k++) for (let i = 0; i < 9; i++) panels.setMatrixAt(pi++, at(laneX(k, LANE.store), 5.48, 2 - i * 4.2));
    g.add(panels);
    // signs: the store's, each aisle's (lit for the one Roy's at), the employee of the month
    const sign = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: tex(1024, 128, storeSign) }));
    sign.scale.set(14, 1.75, 1);
    sign.position.set(0, 4.2, -35.95);
    g.add(sign);
    const signs = CARPETS.map((c, k) => {
      const m = new THREE.Mesh(G.box, [0, 0, 0, 0, 1, 1].map((i) => (i ? toon(0xffffff, { map: tex(512, 160, (g2, w, h) => aisleSign(g2, w, h, c, k)) }) : toon(0xf4efe0))));
      m.scale.set(2.5, 0.78, 0.08);
      m.position.set(laneX(k, LANE.store), 4.2, -4.6);
      g.add(m);
      const chain = new THREE.Mesh(G.cyl, metal);
      chain.scale.set(0.015, 0.9, 0.015);
      for (const s of [-1, 1]) {
        const ch = chain.clone();
        ch.position.set(laneX(k, LANE.store) + s * 1, 5.05, -4.6);
        g.add(ch);
      }
      return m;
    });
    const eom = new THREE.Mesh(G.plane, mats.toon(0xffffff, { map: tex(256, 320, employee) }));
    eom.scale.set(1.1, 1.38, 1);
    eom.position.set(11.98, 2.2, -1.2);
    eom.rotation.y = -Math.PI / 2;
    g.add(eom);
    // where Roy is pointing: the floor of that aisle's mouth, lit
    const pick = new THREE.Mesh(G.flat, new THREE.MeshBasicMaterial({ map: spot, color: hot(0x9dff5a, 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pick.scale.set(3.2, 1, 4.2);
    g.add(pick);
    // the customers: one at the counter, one leaving
    const people = [0, 1].map(() => {
      const f = makeFigure();
      f.root.visible = false;
      g.add(f.root);
      const swatch = new THREE.Mesh(G.box, toon(0xffffff, { map: plain }));
      swatch.scale.set(0.3, 0.24, 0.015);
      swatch.position.set(0, -0.08, 0.06);
      f.armR.hand.add(swatch);
      const carry = new THREE.Group();
      const cRoll = new THREE.Mesh(rollSide, body[0]);
      cRoll.scale.set(0.9, 2.2, 0.9);
      cRoll.rotation.x = Math.PI / 2;
      carry.add(cRoll);
      carry.position.set(-0.18, 0.12, 0);
      carry.rotation.y = 0.25;
      f.chest.add(carry);
      carry.visible = false;
      return { f, swatch, carry, shadow: blob(g, 0.4), look: -1 };
    });
    const swatchMaps = CARPETS.map((c) => tex(64, 64, (g2, w, h) => carpetPattern(g2, w, h, c)));
    const bubbleMaps = CARPETS.map((c) => tex(256, 256, (g2, w, h) => swatchBubble(g2, w, h, c)));
    const ask = new THREE.Group();
    const askBubble = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: bubbleMaps[0], transparent: true, depthWrite: false }));
    askBubble.scale.set(1.15, 1.15, 1);
    const barBack = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ color: 0x1b1424 }));
    barBack.scale.set(0.96, 0.13, 1);
    barBack.position.set(0, -0.68, 0.001);
    const bar = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ color: 0x9dff5a }));
    bar.position.set(0, -0.68, 0.002);
    ask.add(askBubble, barBack, bar);
    ov.add(ask);
    // the roll handed over, in the air
    const handed = new THREE.Mesh(rollSide, body[0]);
    handed.scale.set(1, 2, 1);
    handed.visible = false;
    g.add(handed);
    const hand = { t: 9, from: v3(0, 0, 0), to: v3(0, 0, 0) };
    // the finale: rolls tumbling out of the aisles
    const haloMat = new THREE.MeshBasicMaterial({ map: spot, color: hot(0xff3b2f, 1.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const rollGeo = new THREE.CylinderGeometry(0.44, 0.44, 2.4, 18, 1, true);
    const capGeo = new THREE.CircleGeometry(0.44, 18);
    owned.push(rollGeo, capGeo);
    const makeRoll = (k, r = 1) => {
      const grp = new THREE.Group();
      const spin = new THREE.Group();
      grp.add(spin);
      const m = new THREE.Mesh(rollGeo, body[k]);
      m.rotation.z = Math.PI / 2;
      m.castShadow = true;
      spin.add(m);
      for (const s of [-1, 1]) {
        const c = new THREE.Mesh(capGeo, ends[k]);
        c.position.x = s * 1.2;
        c.rotation.y = (s * Math.PI) / 2;
        spin.add(c);
      }
      grp.scale.setScalar(r);
      grp.visible = false;
      g.add(grp);
      const halo = new THREE.Mesh(G.flat, haloMat.clone());
      halo.scale.set(2.8, 1, 1.7);
      halo.visible = false;
      g.add(halo);
      return { grp, spin, k, halo, shadow: blob(g, 0.6 * r) };
    };
    const rolls = Array.from({ length: 18 }, (_, i) => makeRoll(i % 3));
    const rollsByLane = [0, 1, 2].map((k) => rolls.filter((r) => r.k === k));
    const bounced = [0, 1].map((i) => ({ ...makeRoll(i), t: 9, v: v3(0, 0, 0), w: 0 }));
    const bigRoll = CARPETS.map((c, k) => makeRoll(k, 2));
    const warn = new THREE.Mesh(G.flat, new THREE.MeshBasicMaterial({ map: tex(128, 256, chevrons), color: hot(0xff3b2f, 1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    warn.scale.set(1.6, 1, 3.2);
    g.add(warn);
    const stool = seat(g, false);
    let royX = 0;
    let finale = false;
    let shrugT = 9;
    let deathT = -1;
    let deathRoll = null;
    let leaveT = 9;
    let leaveHappy = false;
    const cam = { pos: v3(0.9, 3.7, 8.4), look: v3(0.6, 1.45, -5), fov: 50 };
    const customerSpot = v3(4.9, 0, 2.1);
    const door = v3(12.3, 0, 5.2);
    const rollY = (z) => 0.44 + (z > 26 ? ((z - 26) / 4) ** 2 * 2.4 : Math.abs(Math.sin(z * 0.8)) * 0.1);
    const setRoll = (r, x, z, yOff = 0) => {
      r.grp.visible = true;
      r.grp.position.set(x, rollY(z) * r.grp.scale.x + yOff, -z);
      r.spin.rotation.x = -z / 0.44;
      r.shadow.visible = true;
      r.shadow.position.set(x, 0.02, -z);
    };
    const hideRoll = (r) => {
      r.grp.visible = false;
      r.shadow.visible = false;
      r.halo.visible = false;
    };
    return {
      group: g,
      over: ov,
      light: { hemi: [0xfffaf0, 0x8a7a68, 1.55], sun: [0xfff6e6, 1.25], dir: [0.25, 1, 0.35], at: [0, 0, -4], box: 16, sky: null, bg: 0x2a2018, fog: [0x2a2018, 40, 90] },
      cam,
      enter(life) {
        finale = life.stage === 'finale';
        royX = laneX(finale ? life.lane : life.s.pointer ?? 1, LANE.store);
        shrugT = 9;
        deathT = -1;
        deathRoll = null;
        leaveT = 9;
        stool.visible = false;
        hand.t = 9;
        people.forEach((p) => (p.f.root.visible = false));
        bounced.forEach((r) => {
          r.t = 9;
          r.grp.visible = false;
          r.shadow.visible = false;
        });
        bigRoll.forEach((r) => {
          r.grp.visible = false;
          r.shadow.visible = false;
        });
      },
      event(e, life) {
        const s = life.s;
        if (e === 'sale' || e === 'lost') {
          leaveT = 0;
          leaveHappy = e === 'sale';
          const leaver = people[1];
          leaver.look = s.served - 1;
          const L = lookFor(leaver.look + 100);
          wear(leaver.f, { ...L, sleeves: false });
          leaver.carry.children[0].material = body[s.pointer];
          if (e === 'sale') {
            hand.t = 0;
            hand.from.set(laneX(s.pointer, LANE.store) + 1, 1.3, -5.5);
            hand.to.copy(customerSpot).setY(1.4);
            handed.material = body[s.pointer];
            glow.spawn({ x: 7.6, y: 1.8, z: 1.2, n: 16, speed: 2.5, colors: [0xffd23a, 0xfff2a0], k: 2.2, size: 0.22, life: 0.7, gravity: 3 });
          } else {
            dust.spawn({ x: customerSpot.x, y: 2.3, z: customerSpot.z, n: 8, speed: 1, colors: [0x6a6a6a, 0x8a8a8a], size: 0.5, life: 0.8, gravity: -1, growth: 1 });
          }
        } else if (e === 'shrug') {
          shrugT = 0;
          const r = bounced.find((x) => x.t > 2) ?? bounced[0];
          r.t = 0;
          r.k = life.lane;
          r.spin.children.forEach((m, i) => (m.material = i === 0 ? body[life.lane] : ends[life.lane]));
          r.grp.position.set(royX, 0.9, -0.6);
          r.v.set((royX <= 0 ? 1 : -1) * (2 + Math.random()), 6.5, -2.5);
          r.w = 9;
          ringAt(royX, 0.05, 0, 0xffd23a, { s0: 0.3, s1: 3, span: 0.55 });
          glow.spawn({ x: royX, y: 1.3, z: -0.3, n: 22, speed: 3.5, colors: [0xffd23a, 0xfff2a0], k: 2.2, size: 0.25, life: 0.6, gravity: 2 });
        } else if (e === 'dodge') {
          dust.spawn({ x: royX, y: 0.25, z: 0.5, n: 3, speed: 0.6, colors: [0xe9e1cf], size: 0.35, life: 0.5, gravity: -0.3, growth: 0.8 });
        } else if (e === 'death') {
          deathT = 0;
          deathRoll = life.cause === 'carpet' ? bigRoll[life.lane] : null;
          if (life.cause === 'old') peace(royX);
        }
      },
      update(dt, life, t) {
        const s = life.s;
        finale = life.stage === 'finale';
        rest(roy);
        const lane = finale ? life.lane : (s.pointer ?? 1);
        const want = laneX(lane, LANE.store);
        const was = royX;
        royX += (want - royX) * damp(dt, finale ? 14 : 9);
        const moving = Math.abs(want - royX) > 0.05;
        // the customers, both of them, and the pointer
        const c = !finale && !s.choice ? s.customer : null;
        const p0 = people[0];
        p0.f.root.visible = Boolean(c);
        p0.shadow.visible = Boolean(c);
        ask.visible = Boolean(c);
        pick.visible = !finale && !s.choice;
        pick.position.set(want, 0.02, -3.4);
        signs.forEach((m, k) => {
          const lit = !finale && !s.choice && k === lane;
          m.material[4].emissive.setHex(lit ? 0x3a4a10 : 0x000000);
          m.position.y = 4.2 + (lit ? Math.sin(t * 6) * 0.03 : 0);
        });
        if (c) {
          if (p0.look !== s.served) {
            p0.look = s.served;
            wear(p0.f, { ...lookFor(s.served + 100), sleeves: false });
            p0.swatch.material.map = swatchMaps[c.want];
            askBubble.material.map = bubbleMaps[c.want];
          }
          customerSpot.x = aspect < 0.9 ? 3.3 : 4.9;
          const waited = CARPET.patience - c.patience;
          const k = smooth(0, 0.7, waited);
          rest(p0.f);
          p0.f.root.position.lerpVectors(door, customerSpot, k);
          p0.f.root.rotation.y = k < 1 ? Math.atan2(customerSpot.x - door.x, customerSpot.z - door.z) : lerp(-2.0, -2.35, smooth(1, 2, waited));
          if (k < 1) stride(p0.f, waited * 11, 0.6, 0.05);
          else {
            // holding the swatch up, then tapping a foot
            p0.f.armR.shoulder.rotation.set(-1.45, 0.2, -0.25);
            p0.f.armR.elbow.rotation.x = -0.5;
            if (c.patience < 1.6) {
              p0.f.legL.hip.rotation.x = -0.15;
              p0.f.legL.foot.rotation.x = -Math.abs(Math.sin(t * 12)) * 0.4;
              p0.f.armL.shoulder.rotation.set(-0.6, 0, 0.4);
              p0.f.armL.elbow.rotation.set(-1.8, 0, 0);
            }
          }
          eyes(p0.f, { look: [-0.6, 0] });
          mood(p0.f, c.patience < 1.6 ? 'frown' : 'smile');
          p0.shadow.position.set(p0.f.root.position.x, 0.02, p0.f.root.position.z);
          // the bubble over them: what they want, how long they'll wait
          ask.position.set(p0.f.root.position.x - 0.5, 3.05 + Math.sin(t * 3) * 0.04, p0.f.root.position.z);
          ask.quaternion.copy(camera.quaternion);
          const left = clamp(c.patience / CARPET.patience, 0, 1);
          bar.scale.set(0.92 * left, 0.09, 1);
          bar.position.x = -0.46 * (1 - left);
          bar.material.color.setHex(left > 0.5 ? 0x9dff5a : left > 0.25 ? 0xffd23a : 0xff4a3a);
          ask.position.x += left < 0.25 ? Math.sin(t * 40) * 0.03 : 0;
        }
        // the one leaving: off to the door with the roll, or off in a huff
        const p1 = people[1];
        leaveT += dt;
        p1.f.root.visible = leaveT < 2.2 && !finale;
        p1.shadow.visible = p1.f.root.visible;
        p1.carry.visible = leaveHappy && leaveT > 0.45;
        if (p1.f.root.visible) {
          rest(p1.f);
          const k = smooth(0.35, 2.2, leaveT);
          p1.f.root.position.lerpVectors(customerSpot, door, k);
          p1.f.root.rotation.y = Math.atan2(door.x - customerSpot.x, door.z - customerSpot.z);
          if (leaveT > 0.35) stride(p1.f, leaveT * (leaveHappy ? 10 : 14), leaveHappy ? 0.6 : 0.9, 0.05);
          if (leaveHappy) {
            p1.f.armL.shoulder.rotation.set(-2.6, 0, 0.2);
            p1.f.armL.elbow.rotation.x = -1.2;
          } else {
            p1.f.armL.shoulder.rotation.set(-0.3, 0, 0.6);
            p1.f.armR.shoulder.rotation.set(-0.3, 0, -0.6);
            p1.f.armL.elbow.rotation.x = p1.f.armR.elbow.rotation.x = -1.6;
          }
          eyes(p1.f);
          mood(p1.f, leaveHappy ? 'smile' : 'frown');
          p1.swatch.visible = false;
          p1.shadow.position.set(p1.f.root.position.x, 0.02, p1.f.root.position.z);
        }
        hand.t += dt;
        handed.visible = hand.t < 0.45 && !finale;
        if (handed.visible) {
          const k = hand.t / 0.45;
          handed.position.lerpVectors(hand.from, hand.to, k);
          handed.position.y += Math.sin(k * Math.PI) * 1.2;
          handed.rotation.set(Math.PI / 2, 0, k * 6);
        }
        // the rolls of the finale
        const dead = life.over;
        if (deathT >= 0) deathT += dt;
        for (const k of [0, 1, 2]) {
          const mine = finale ? s.rolls.filter((r) => r.lane === k) : [];
          rollsByLane[k].forEach((r, i) => {
            const it = mine[i];
            if (!it || (dead && it.lane === life.lane)) return hideRoll(r);
            // after the end the rolls roll on (or, at a hundred, roll to a stop), for the look of it
            const z = dead ? it.z - (life.cause === 'old' ? (it.v * (1 - Math.exp(-deathT * 2))) / 2 : it.v * deathT) : it.z;
            if (z < -2.6) return hideRoll(r);
            setRoll(r, laneX(k, LANE.store), z);
            r.halo.visible = z > 0.3 && !dead;
            r.halo.position.set(laneX(k, LANE.store), 0.025, -z + 0.2);
            r.halo.material.opacity = 0.25 + smooth(24, 3, z) * 0.75;
          });
        }
        // a warning on the floor ahead of Roy when one's coming down his aisle
        const next = finale && !dead ? s.rolls.filter((r) => r.lane === life.lane && r.z > 0).sort((a, b2) => a.z - b2.z)[0] : null;
        const danger = next ? smooth(14, 3, next.z) : 0;
        warn.visible = danger > 0.01;
        warn.position.set(royX, 0.025, -2.4);
        warn.material.opacity = danger * (0.6 + 0.4 * Math.sin(t * 16));
        bounced.forEach((r) => {
          r.t += dt;
          r.grp.visible = r.t < 2;
          r.shadow.visible = r.grp.visible;
          if (!r.grp.visible) return;
          r.v.y -= 16 * dt;
          r.grp.position.addScaledVector(r.v, dt);
          if (r.grp.position.y < 0.44) {
            r.grp.position.y = 0.44;
            r.v.y = Math.abs(r.v.y) * 0.3;
            r.v.x *= 0.7;
          }
          r.spin.rotation.x += r.w * dt;
          r.shadow.position.set(r.grp.position.x, 0.02, r.grp.position.z);
        });
        // the big one, at the end
        bigRoll.forEach((r) => {
          if (r !== deathRoll) {
            r.grp.visible = false;
            r.shadow.visible = false;
          }
        });
        let flat = 0;
        if (deathRoll) {
          // down off the top of the rack, onto him, then on toward the door
          const R = 0.44 * 2;
          const fall = Math.min(1, deathT / 0.32);
          const z = 0.2 + Math.max(0, deathT - 0.6) * 4.5;
          deathRoll.grp.visible = z > -9;
          deathRoll.shadow.visible = deathRoll.grp.visible;
          const hop = deathT > 0.32 && deathT < 0.6 ? Math.sin(((deathT - 0.32) / 0.28) * Math.PI) * 0.35 : 0;
          deathRoll.grp.position.set(royX, lerp(6, R, fall * fall) + hop, -z);
          deathRoll.spin.rotation.x = deathT * 3 - z / R;
          deathRoll.shadow.position.set(royX, 0.02, -z);
          deathRoll.shadow.scale.setScalar(1.2 + fall);
          if (fall >= 1 && !deathRoll.hit) {
            deathRoll.hit = true;
            dust.spawn({ x: royX, y: 0.4, z: 0, n: 26, speed: 4, up: 0.4, colors: [0xe9e1cf, 0xcfc4a8], size: 0.9, life: 1.1, gravity: -0.3, drag: 2.2, growth: 1.6, box: 0.8 });
            shake(0.9);
          }
          flat = fall >= 1 ? 1 : 0;
        } else if (bigRoll.some((r) => r.hit)) bigRoll.forEach((r) => (r.hit = false));
        // Roy: behind the counter's end of the aisles, or in the way of the rolls
        roy.root.position.set(royX, 0, finale ? 0 : -2.3);
        if (finale) {
          roy.root.rotation.y = Math.PI;
          shrugT += dt;
          stool.visible = life.over && life.cause === 'old';
          stool.position.set(royX, 0, 0.32);
          if (life.over && life.cause === 'old') sitPose(roy, smooth(0.2, 1.2, deathT));
          else if (shrugT < 0.8) shrugPose(roy, Math.sin(Math.min(1, shrugT / 0.8) * Math.PI));
          else {
            // on his toes, side to side
            roy.legL.hip.rotation.x = -0.1;
            roy.legR.hip.rotation.x = 0.1;
            roy.legL.knee.rotation.x = roy.legR.knee.rotation.x = 0.25;
            roy.body.position.y = -0.03 + Math.abs(Math.sin(t * 6)) * 0.02;
            roy.body.rotation.z = clamp((royX - was) / Math.max(dt, 1e-3), -6, 6) * -0.035;
            roy.armL.shoulder.rotation.z = 0.35;
            roy.armR.shoulder.rotation.z = -0.35;
          }
          eyes(roy, { look: [0, 0.2], shut: life.over && life.cause === 'old' ? smooth(0.6, 1.4, deathT) : 0 });
          mood(roy, danger > 0.6 ? 'o' : 'smile');
        } else {
          // facing the customer when there is one, walking the aisle mouths
          const face = c ? Math.atan2(customerSpot.x - royX, customerSpot.z + 2.3) : 0.2;
          roy.root.rotation.y += (face - roy.root.rotation.y) * damp(dt, 8);
          if (moving) stride(roy, t * 11, 0.55, 0.05);
          eyes(roy, { look: [0.4, 0] });
          mood(roy, 'smile');
        }
        aged(roy);
        if (flat) {
          roy.body.scale.set(1.7, 0.09, 1.7);
          roy.body.rotation.set(0, 0, 0);
          roy.body.position.y = 0.02;
        }
        royShadow.position.set(royX, 0.02, roy.root.position.z);
        royShadow.visible = !flat;
        if (finale) {
          cam.pos.set(royX * 0.45, 2.85, 6.4);
          cam.look.set(royX * 0.25, 1.25, -14);
          cam.fov = 54;
        } else {
          cam.pos.set(0.9, 3.7, 8.4);
          cam.look.set(0.6, 1.45, -5);
          cam.fov = 50;
        }
      },
    };
  })();

  // ── off the grid: a cabin in the woods; the same work, for himself; then logs ──
  V.woods = (() => {
    const g = new THREE.Group();
    g.name = 'woods';
    const ov = overlay();
    const camp = new THREE.Group();
    const hill = new THREE.Group();
    g.add(camp, hill);
    const b = batch();
    const grass = mats.toon(0xffffff, { map: tileTex(256, 256, (c, w, h) => speckle(c, w, h, { base: '#4f8f3a', specks: ['#3f7a2e', '#5c9e45', '#467f33', '#6aa84f'], n: 2600, size: 2.2, seed: 17 }), [26, 26]) });
    b.add(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), grass, at(0, 0, -10));
    const dirt = mats.toon(0x9c8a5e);
    b.add(new THREE.CircleGeometry(5, 28).rotateX(-Math.PI / 2), dirt, at(0, 0.01, -3.2, 0, 1.35, 1, 0.75));
    const trunk = mats.toon(0x6e4a2a);
    const pine = [mats.toon(0x2f6b3a), mats.toon(0x3a7d44), mats.toon(0x285e33)];
    const tree = (bb, x, z, s = 1, y = 0) => {
      bb.add(G.cyl, trunk, at(x, y + 0.8 * s, z, 0, 0.22 * s, 1.6 * s, 0.22 * s));
      for (let i = 0; i < 3; i++) bb.add(G.cone, pine[(((i + Math.round(x)) % 3) + 3) % 3], at(x, y + (1.9 + i * 1.15) * s, z, i, (1.7 - i * 0.42) * s, 2 * s, (1.7 - i * 0.42) * s));
    };
    const tr = rng(31);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 13 + tr() * 7;
      const x = Math.cos(a) * r;
      const z = -6 + Math.sin(a) * r * 0.8;
      if (z > 4) continue;
      tree(b, x, z, 0.9 + tr() * 0.6);
    }
    // the cabin: logs, a roof, a chimney, a lit window
    const log = mats.toon(0xffffff, { map: tileTex(128, 128, bark, [4, 1]) });
    for (let i = 0; i < 9; i++) {
      b.add(G.cyl, log, at(0, 0.18 + i * 0.32, -8.5, 0, 0.17, 6.6, 0.17, 0, Math.PI / 2));
      for (const s of [-1, 1]) b.add(G.cyl, log, at(s * 3.2, 0.18 + i * 0.32, -10.6, 0, 0.17, 4.6, 0.17, Math.PI / 2, 0));
    }
    b.add(G.box, mats.toon(0x5a3a20), at(0, 1.2, -10.6, 0, 6.2, 2.6, 4.1));
    b.add(G.box, mats.toon(0x4a2e1a), at(0, 1.0, -8.32, 0, 1.0, 2.0, 0.08));
    b.add(G.box, mats.toon(0xffd77a, { emissive: new THREE.Color(0x6a4a10) }), at(1.9, 1.6, -8.32, 0, 0.8, 0.7, 0.06));
    b.add(G.box, mats.toon(0xffd77a, { emissive: new THREE.Color(0x6a4a10) }), at(-1.9, 1.6, -8.32, 0, 0.8, 0.7, 0.06));
    b.add(hipRoof(7.6, 5.4, 1.8), mats.toon(0x7a4a2a), at(0, 2.95, -10.6));
    b.add(G.box, mats.toon(0x8a8a8a), at(2.2, 4.1, -11.2, 0, 0.7, 2.2, 0.7));
    // the three spots: the pond, the berry bushes, the woodpile
    b.add(new THREE.CircleGeometry(1.6, 24).rotateX(-Math.PI / 2), mats.toon(0x3d8fd0), at(laneX(0, LANE.woods), 0.03, -4.2, 0, 1, 1, 0.8));
    b.add(new THREE.RingGeometry(1.55, 1.8, 24).rotateX(-Math.PI / 2), mats.toon(0x8a7a6a), at(laneX(0, LANE.woods), 0.035, -4.2, 0, 1, 1, 0.8));
    b.add(G.cyl, trunk, at(laneX(0, LANE.woods) + 1.1, 0.3, -3.3, 0, 0.3, 0.6, 0.3));
    for (let i = 0; i < 4; i++) b.add(G.sph, pine[i % 2], at(laneX(1, LANE.woods) + (i - 1.5) * 0.7, 0.5, -4.4 - (i % 2) * 0.4, 0, 0.6, 0.55, 0.55));
    const berry = mats.toon(0xd0243c);
    for (let i = 0; i < 18; i++) b.add(G.lo, berry, at(laneX(1, LANE.woods) - 1.2 + tr() * 2.4, 0.4 + tr() * 0.55, -3.9 - tr() * 0.9, 0, 0.07));
    b.add(G.cyl, trunk, at(laneX(2, LANE.woods), 0.3, -4, 0, 0.4, 0.6, 0.4));
    for (let i = 0; i < 6; i++) b.add(G.cyl, log, at(laneX(2, LANE.woods) + 1.2 + (i % 3) * 0.35 - 0.3, 0.17 + Math.floor(i / 3) * 0.3, -4.6, 0, 0.16, 1.1, 0.16, Math.PI / 2, 0));
    b.add(G.box, metal, at(laneX(2, LANE.woods) - 0.1, 0.75, -4, 0, 0.04, 0.25, 0.15));
    b.add(G.cyl, mats.toon(0x8a5a30), at(laneX(2, LANE.woods) - 0.1, 0.65, -4, 0, 0.025, 0.6, 0.025, 0, 0.4));
    b.build(camp);
    // the hill for the finale: three tracks between the pines, logs coming down
    const hb = batch();
    const slope = (z) => Math.max(0, -z - 5) * 0.2;
    const hillGeo = new THREE.PlaneGeometry(60, 60, 4, 30).rotateX(-Math.PI / 2);
    const hp = hillGeo.attributes.position;
    for (let i = 0; i < hp.count; i++) hp.setY(i, slope(hp.getZ(i) - 22));
    hillGeo.computeVertexNormals();
    owned.push(hillGeo);
    hb.add(hillGeo, grass, at(0, 0, -22));
    const track = new THREE.PlaneGeometry(2, 44, 1, 22).rotateX(-Math.PI / 2);
    const tp = track.attributes.position;
    for (let i = 0; i < tp.count; i++) tp.setY(i, slope(tp.getZ(i) - 18) + 0.02);
    track.computeVertexNormals();
    owned.push(track);
    const worn = mats.toon(0x9a7c50);
    for (const k of [0, 1, 2]) hb.add(track, worn, at(laneX(k, LANE.woods), 0, -18));
    for (let z = -6; z > -40; z -= 2.6) {
      for (const x of [-LANE.woods * 1.5, LANE.woods * 1.5, -LANE.woods / 2 - 0.05, LANE.woods / 2 + 0.05]) {
        if (Math.abs(x) < 2 && z > -12) continue;
        tree(hb, x + (tr() - 0.5) * 0.4, z + tr(), 0.55 + tr() * 0.25, slope(z));
      }
      for (const s of [-1, 1]) tree(hb, s * (7 + tr() * 6), z + tr(), 0.9 + tr() * 0.6, slope(z));
    }
    for (const [x, z] of [
      [-4, 1],
      [4.5, -1],
      [-6, -2],
    ])
      hb.add(G.cyl, trunk, at(x, 0.25, z, 0, 0.4, 0.5, 0.4));
    hb.build(hill);
    const smokeAt = v3(2.2, 5.4, -11.2);
    // what the cabin needs, over its door
    const needMaps = [0, 1, 2].map((i) => tex(256, 256, (g2, w, h) => needBubble(g2, w, h, i)));
    const ask = new THREE.Group();
    const askBubble = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: needMaps[0], transparent: true, depthWrite: false }));
    askBubble.scale.set(1.7, 1.7, 1);
    const barBack = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ color: 0x1b1424 }));
    barBack.scale.set(1.3, 0.16, 1);
    barBack.position.set(0, -0.98, 0.001);
    const bar = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ color: 0x9dff5a }));
    bar.position.set(0, -0.98, 0.002);
    ask.add(askBubble, barBack, bar);
    ov.add(ask);
    const pick = new THREE.Mesh(G.flat, new THREE.MeshBasicMaterial({ map: spot, color: hot(0x9dff5a, 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pick.scale.set(3, 1, 3);
    camp.add(pick);
    // a fish, berries or a log carried to the cabin
    const items = [
      (() => {
        const m = new THREE.Mesh(G.sph, toon(0x5aa0d8));
        m.scale.set(0.3, 0.14, 0.1);
        return m;
      })(),
      (() => {
        const m = new THREE.Mesh(G.sph, berry);
        m.scale.setScalar(0.18);
        return m;
      })(),
      (() => {
        const m = new THREE.Mesh(G.cyl, log);
        m.scale.set(0.16, 0.9, 0.16);
        return m;
      })(),
    ];
    items.forEach((m) => {
      m.visible = false;
      m.castShadow = true;
      camp.add(m);
    });
    const carry = { t: 9, k: 0, from: v3(0, 0, 0) };
    const door = v3(0, 1.2, -8.2);
    // the logs, and the big one
    const haloMat = new THREE.MeshBasicMaterial({ map: spot, color: hot(0xff3b2f, 1.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const logGeo = new THREE.CylinderGeometry(0.34, 0.34, 2.4, 14, 1, true);
    const logCap = new THREE.CircleGeometry(0.34, 14);
    const endMat = mats.toon(0xffffff, { map: tex(128, 128, logEnd) });
    owned.push(logGeo, logCap);
    const makeLog = (r = 1) => {
      const grp = new THREE.Group();
      const spin = new THREE.Group();
      grp.add(spin);
      const m = new THREE.Mesh(logGeo, log);
      m.rotation.z = Math.PI / 2;
      m.castShadow = true;
      spin.add(m);
      for (const s of [-1, 1]) {
        const c = new THREE.Mesh(logCap, endMat);
        c.position.x = s * 1.2;
        c.rotation.y = (s * Math.PI) / 2;
        spin.add(c);
      }
      grp.scale.setScalar(r);
      grp.visible = false;
      hill.add(grp);
      const halo = new THREE.Mesh(G.flat, haloMat.clone());
      halo.scale.set(2.8, 1, 1.7);
      halo.visible = false;
      hill.add(halo);
      return { grp, spin, halo, shadow: blob(hill, 0.6 * r) };
    };
    const logs = Array.from({ length: 12 }, () => makeLog());
    const bounced = [0, 1].map(() => ({ ...makeLog(), t: 9, v: v3(0, 0, 0) }));
    const bigLog = makeLog(2.6);
    const stump = seat(hill, true);
    const warn = new THREE.Mesh(G.flat, new THREE.MeshBasicMaterial({ map: tex(128, 256, chevrons), color: hot(0xff3b2f, 1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    warn.scale.set(1.6, 1, 3.2);
    hill.add(warn);
    let royX = 0;
    let finale = false;
    let shrugT = 9;
    let deathT = -1;
    let bigHit = false;
    let smokeT = 0;
    const cam = { pos: v3(0.4, 3.5, 6.9), look: v3(0, 1.4, -4.4), fov: 50 };
    const logY = (z) => slope(-z) + 0.34;
    return {
      group: g,
      over: ov,
      light: { hemi: [0xffe9c8, 0x3a5a2a, 1.25], sun: [0xffd9a0, 2.3], dir: [-0.7, 0.55, 0.35], at: [0, 0, -5], box: 18, sky: { top: 0x3d7fd0, mid: 0x9fc9e8, low: 0xffe2b8, sun: 0xfff0c8, clouds: 0.7, moons: 0 }, fog: [0xe8d8b8, 40, 140] },
      cam,
      enter(life) {
        finale = life.stage === 'finale';
        camp.visible = !finale;
        hill.visible = finale;
        royX = laneX(finale ? life.lane : (life.s.pointer ?? 1), LANE.woods);
        shrugT = 9;
        deathT = -1;
        bigHit = false;
        carry.t = 9;
        bigLog.grp.visible = false;
        bigLog.shadow.visible = false;
        stump.visible = false;
        bounced.forEach((r) => {
          r.t = 9;
          r.grp.visible = false;
          r.shadow.visible = false;
        });
      },
      event(e, life) {
        const s = life.s;
        if (e === 'sale') {
          carry.t = 0;
          carry.k = s.pointer;
          carry.from.set(laneX(s.pointer, LANE.woods), 0.8, -3.6);
          glow.spawn({ x: carry.from.x, y: 1, z: carry.from.z, n: 14, speed: 2.5, colors: [0x9dff5a, 0xfff2a0], k: 2.2, size: 0.22, life: 0.6, gravity: 2 });
        } else if (e === 'lost') {
          dust.spawn({ x: 0, y: 3.4, z: -7.6, n: 8, speed: 1, colors: [0x7a7a7a, 0x9a9a9a], size: 0.6, life: 0.9, gravity: -1, growth: 1 });
        } else if (e === 'shrug') {
          shrugT = 0;
          const r = bounced.find((x) => x.t > 2) ?? bounced[0];
          r.t = 0;
          r.grp.position.set(royX, 0.9, -0.6);
          r.v.set((royX <= 0 ? 1 : -1) * (2 + Math.random()), 6.5, -2);
          ringAt(royX, 0.05, 0, 0xffd23a, { s0: 0.3, s1: 3, span: 0.55 });
          glow.spawn({ x: royX, y: 1.3, z: -0.3, n: 22, speed: 3.5, colors: [0xffd23a, 0xfff2a0], k: 2.2, size: 0.25, life: 0.6, gravity: 2 });
        } else if (e === 'death') {
          deathT = 0;
          bigHit = false;
          if (life.cause === 'old') peace(royX);
        }
      },
      update(dt, life, t) {
        const s = life.s;
        if (finale !== (life.stage === 'finale')) this.enter(life);
        rest(roy);
        const lane = finale ? life.lane : (s.pointer ?? 1);
        const want = laneX(lane, LANE.woods);
        const was = royX;
        royX += (want - royX) * damp(dt, finale ? 14 : 9);
        smokeT -= dt;
        if (smokeT <= 0 && !finale) {
          smokeT = 0.35;
          dust.spawn({ x: smokeAt.x, y: smokeAt.y, z: smokeAt.z, n: 1, speed: 0.3, colors: [0xdedede, 0xc8c8c8], size: 0.7, life: 2.4, gravity: -0.9, drag: 0.5, growth: 1.8 });
        }
        if (!finale) {
          const c = !s.choice ? s.customer : null;
          ask.visible = Boolean(c);
          pick.visible = !s.choice;
          pick.position.set(want, 0.04, -3.2);
          if (c) {
            askBubble.material.map = needMaps[c.want];
            ask.position.set(1.4, 4.6 + Math.sin(t * 3) * 0.05, -7.2);
            ask.quaternion.copy(camera.quaternion);
            const left = clamp(c.patience / CARPET.patience, 0, 1);
            bar.scale.set(1.24 * left, 0.11, 1);
            bar.position.x = -0.62 * (1 - left);
            bar.material.color.setHex(left > 0.5 ? 0x9dff5a : left > 0.25 ? 0xffd23a : 0xff4a3a);
            ask.position.x += left < 0.25 ? Math.sin(t * 40) * 0.03 : 0;
          }
          carry.t += dt;
          items.forEach((m, i) => (m.visible = carry.t < 0.6 && i === carry.k));
          if (carry.t < 0.6) {
            const k = carry.t / 0.6;
            const m = items[carry.k];
            m.position.lerpVectors(carry.from, door, k);
            m.position.y += Math.sin(k * Math.PI) * 1.5;
            m.rotation.set(k * 5, k * 3, 0);
            if (carry.t + dt >= 0.6) glow.spawn({ x: door.x, y: door.y, z: door.z, n: 12, speed: 2, colors: [0xffd77a], k: 2, size: 0.2, life: 0.5, gravity: 1 });
          }
          roy.root.position.set(royX, 0, -2.4);
          roy.root.rotation.y += ((Math.abs(want - royX) > 0.05 ? Math.sign(want - royX) * 1.2 : 0.15) - roy.root.rotation.y) * damp(dt, 8);
          if (Math.abs(want - royX) > 0.05) stride(roy, t * 11, 0.55, 0.05);
          eyes(roy, { look: [0, 0.3] });
          mood(roy, 'smile');
          aged(roy);
          royShadow.position.set(royX, 0.03, -2.4);
          royShadow.visible = true;
          cam.pos.set(0.4, 3.5, 6.9);
          cam.look.set(0, 1.4, -4.4);
          cam.fov = 50;
          return;
        }
        // the finale: logs down the hill
        ask.visible = false;
        const dead = life.over;
        if (deathT >= 0) deathT += dt;
        logs.forEach((r, i) => {
          const it = s.rolls[i];
          const z = it ? (dead ? it.z - (life.cause === 'old' ? (it.v * (1 - Math.exp(-deathT * 2))) / 2 : it.v * deathT) : it.z) : 0;
          if (!it || (dead && it.lane === life.lane) || z < -2.6) {
            r.grp.visible = false;
            r.shadow.visible = false;
            r.halo.visible = false;
            return;
          }
          const x = laneX(it.lane, LANE.woods);
          r.halo.visible = z > 0.3 && !dead;
          r.halo.position.set(x, slope(-z) + 0.04, -z + 0.2);
          r.halo.material.opacity = 0.25 + smooth(24, 3, z) * 0.75;
          r.grp.visible = true;
          r.grp.position.set(x, logY(z) + Math.abs(Math.sin(z * 0.9)) * 0.12, -z);
          r.spin.rotation.x = -z / 0.34;
          r.shadow.visible = true;
          r.shadow.position.set(x, slope(-z) + 0.03, -z);
        });
        const next = !dead ? s.rolls.filter((r) => r.lane === life.lane && r.z > 0).sort((a, b2) => a.z - b2.z)[0] : null;
        const danger = next ? smooth(14, 3, next.z) : 0;
        warn.visible = danger > 0.01;
        warn.position.set(royX, 0.04, -2.4);
        warn.material.opacity = danger * (0.6 + 0.4 * Math.sin(t * 16));
        bounced.forEach((r) => {
          r.t += dt;
          r.grp.visible = r.t < 2;
          r.shadow.visible = r.grp.visible;
          if (!r.grp.visible) return;
          r.v.y -= 16 * dt;
          r.grp.position.addScaledVector(r.v, dt);
          if (r.grp.position.y < 0.34) {
            r.grp.position.y = 0.34;
            r.v.y = Math.abs(r.v.y) * 0.3;
            r.v.x *= 0.7;
          }
          r.spin.rotation.x += 9 * dt;
          r.shadow.position.set(r.grp.position.x, 0.03, r.grp.position.z);
        });
        let flat = 0;
        if (dead && life.cause === 'log') {
          const z = 9 - deathT * 15;
          bigLog.grp.visible = z > -8;
          bigLog.shadow.visible = bigLog.grp.visible;
          bigLog.grp.position.set(royX, logY(z) * 2.6 - slope(-z) * 1.6, -z);
          bigLog.spin.rotation.x = -z / (0.34 * 2.6);
          bigLog.shadow.position.set(royX, slope(-z) + 0.03, -z);
          if (z < 0.6 && !bigHit) {
            bigHit = true;
            dust.spawn({ x: royX, y: 0.4, z: 0, n: 26, speed: 4, up: 0.4, colors: [0xb08a5a, 0x8a6a40], size: 0.9, life: 1.1, gravity: -0.3, drag: 2.2, growth: 1.6, box: 0.8 });
            confetti.spawn({ x: royX, y: 0.8, z: 0, n: 30, speed: 4, colors: [0x3f8a34, 0x6e4a2a, 0x5c9e45], size: 1, life: 2, gravity: 4, drag: 1.2 });
            shake(0.9);
          }
          flat = z < 0.4 ? 1 : 0;
        }
        roy.root.position.set(royX, 0, 0);
        roy.root.rotation.y = Math.PI;
        shrugT += dt;
        stump.visible = dead && life.cause === 'old';
        stump.position.set(royX, 0, 0.32);
        if (dead && life.cause === 'old') sitPose(roy, smooth(0.2, 1.2, deathT));
        else if (shrugT < 0.8) shrugPose(roy, Math.sin(Math.min(1, shrugT / 0.8) * Math.PI));
        else {
          roy.legL.knee.rotation.x = roy.legR.knee.rotation.x = 0.25;
          roy.body.position.y = -0.03 + Math.abs(Math.sin(t * 6)) * 0.02;
          roy.body.rotation.z = clamp((royX - was) / Math.max(dt, 1e-3), -6, 6) * -0.035;
          roy.armL.shoulder.rotation.z = 0.35;
          roy.armR.shoulder.rotation.z = -0.35;
        }
        eyes(roy, { look: [0, 0.3], shut: dead && life.cause === 'old' ? smooth(0.6, 1.4, deathT) : 0 });
        mood(roy, danger > 0.6 ? 'o' : 'smile');
        aged(roy);
        if (flat) {
          roy.body.scale.set(1.7, 0.09, 1.7);
          roy.body.rotation.set(0, 0, 0);
          roy.body.position.y = 0.02;
        }
        royShadow.position.set(royX, 0.03, 0);
        royShadow.visible = !flat;
        cam.pos.set(royX * 0.45, 2.9, 6.6);
        cam.look.set(royX * 0.25, 1.9, -14);
        cam.fov = 54;
      },
    };
  })();

  // ── the diagnosis: a hospital bed, a monitor, a beat to keep ──
  V.hospital = (() => {
    const g = new THREE.Group();
    g.name = 'hospital';
    const ov = overlay();
    const b = batch();
    b.add(new THREE.PlaneGeometry(14, 12).rotateX(-Math.PI / 2), mats.toon(0xffffff, { map: tileTex(256, 256, (c, w, h) => tiles(c, w, h, '#dfe7ea', '#cdd8dc'), [5, 5]) }), at(0, 0, -1));
    const wall = mats.toon(0xbfe3d0);
    const stripe = mats.toon(0x7fb8a4);
    b.add(G.box, wall, at(0, 2, -4.2, 0, 14, 4, 0.3));
    b.add(G.box, stripe, at(0, 0.9, -4.02, 0, 14, 0.12, 0.05));
    for (const s of [-1, 1]) {
      b.add(G.box, wall, at(s * 5.2, 2, 0, 0, 0.3, 4, 10));
      b.add(G.box, stripe, at(s * 5.02, 0.9, 0, 0, 0.05, 0.12, 10));
    }
    b.add(G.box, mats.toon(0xf4f6f6), at(0, 4.05, -1, 0, 14, 0.1, 12));
    // the bed: frame, mattress, raised back, pillow, blanket
    const frame = mats.toon(0xc8d0d8);
    b.add(G.box, frame, at(-0.2, 0.45, -1.4, 0, 1.2, 0.12, 2.5));
    for (const [x, z] of [
      [-0.75, -2.6],
      [0.35, -2.6],
      [-0.75, -0.2],
      [0.35, -0.2],
    ])
      b.add(G.cyl, frame, at(x, 0.25, z, 0, 0.04, 0.5, 0.04));
    b.add(G.box, frame, at(-0.2, 0.85, -2.72, 0, 1.25, 0.9, 0.08));
    b.add(G.box, frame, at(-0.2, 0.7, -0.12, 0, 1.25, 0.55, 0.08));
    b.add(G.box, mats.toon(0xf6f6f2), at(-0.2, 0.62, -1.15, 0, 1.1, 0.22, 1.9));
    b.add(G.box, mats.toon(0xf6f6f2), at(-0.2, 0.88, -2.3, 0, 1.1, 0.22, 0.85, 0, 0, -0.55, 0));
    b.add(G.sph, mats.toon(0xffffff), at(-0.2, 1.22, -2.5, 0, 0.42, 0.14, 0.22, -0.55, 0));
    b.add(G.box, mats.toon(0x6fa8dc), at(-0.2, 0.9, -0.8, 0, 1.16, 0.2, 1.3));
    // the monitor on its stand, the drip, a chair, flowers, the window
    b.add(G.cyl, metal, at(-1.55, 0.7, -2.2, 0, 0.04, 1.4, 0.04));
    b.add(G.cyl, metal, at(-1.55, 0.03, -2.2, 0, 0.3, 0.06, 0.3));
    b.add(G.box, mats.toon(0x3a3f4e), at(-1.55, 1.62, -2.2, 0.5, 0.8, 0.56, 0.3));
    b.add(G.cyl, metal, at(1.1, 1.0, -2.4, 0, 0.025, 2, 0.025));
    b.add(G.cyl, metal, at(1.1, 0.03, -2.4, 0, 0.28, 0.05, 0.28));
    b.add(G.box, mats.toon(0xd8f0ff, { transparent: true, opacity: 0.85 }), at(1.1, 1.85, -2.4, 0, 0.22, 0.34, 0.08));
    b.add(G.box, mats.toon(0x8a6a8a), at(2.6, 0.45, -1.6, -0.4, 0.7, 0.1, 0.7));
    b.add(G.box, mats.toon(0x8a6a8a), at(2.75, 0.85, -1.9, -0.4, 0.7, 0.8, 0.1));
    for (const x of [2.3, 2.9]) b.add(G.cyl, metal, at(x, 0.2, -1.6, 0, 0.03, 0.4, 0.03));
    b.add(G.box, mats.toon(0xe6dccf), at(-2.6, 0.45, -3.3, 0, 0.8, 0.9, 0.6));
    b.add(G.cyl, mats.toon(0xbfe0ff, { transparent: true, opacity: 0.7 }), at(-2.6, 1.05, -3.3, 0, 0.1, 0.3, 0.1));
    for (let i = 0; i < 5; i++) b.add(G.sph, mats.toon([0xff6f91, 0xffd23a, 0xffffff][i % 3]), at(-2.6 + Math.cos(i * 1.3) * 0.12, 1.3 + (i % 2) * 0.08, -3.3 + Math.sin(i * 1.3) * 0.12, 0, 0.09));
    b.build(g);
    const win = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: tex(256, 256, nightWindow) }));
    win.scale.set(2.6, 1.9, 1);
    win.position.set(1.8, 2.3, -4.04);
    g.add(win);
    const winFrame = new THREE.Mesh(G.box, mats.toon(0xf4f6f6));
    for (const [x, y, sx, sy] of [
      [1.8, 3.28, 2.8, 0.1],
      [1.8, 1.32, 2.8, 0.14],
      [0.45, 2.3, 0.1, 2],
      [3.15, 2.3, 0.1, 2],
      [1.8, 2.3, 0.06, 2],
    ]) {
      const f = winFrame.clone();
      f.scale.set(sx, sy, 0.1);
      f.position.set(x, y, -4.0);
      g.add(f);
    }
    // a balloon on a string
    const balloon = new THREE.Group();
    const bal = new THREE.Mesh(G.sph, toon(0xff4f6a));
    bal.scale.set(0.3, 0.36, 0.3);
    const str = new THREE.Mesh(G.cyl, toon(0xffffff));
    str.scale.set(0.006, 1.1, 0.006);
    str.position.y = -0.9;
    balloon.add(bal, str);
    balloon.position.set(-2.4, 2.6, -3.1);
    g.add(balloon);
    // the monitor's screen: the trace, drawn each frame
    const ecg = document.createElement('canvas');
    ecg.width = 256;
    ecg.height = 160;
    const ecgTex = new THREE.CanvasTexture(ecg);
    sharpen(ecgTex);
    ecgTex.colorSpace = THREE.SRGBColorSpace;
    owned.push(ecgTex);
    const screen = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: ecgTex, color: new THREE.Color(1, 1, 1).multiplyScalar(1.6) }));
    screen.scale.set(0.68, 0.44, 1);
    screen.position.set(-1.55 + Math.sin(0.5) * 0.16, 1.63, -2.2 + Math.cos(0.5) * 0.16);
    screen.rotation.y = 0.5;
    g.add(screen);
    const trace = new Float32Array(128);
    let head = 0;
    let lastBeatT = 0;
    let since = 9;
    let jolt = 0;
    const drawTrace = (dead) => {
      const x = ecg.getContext('2d');
      x.fillStyle = dead ? '#2a0606' : '#03140c';
      x.fillRect(0, 0, 256, 160);
      x.strokeStyle = 'rgba(80,255,140,0.12)';
      x.lineWidth = 1;
      for (let i = 0; i < 256; i += 16) {
        x.beginPath();
        x.moveTo(i, 0);
        x.lineTo(i, 160);
        x.stroke();
      }
      x.strokeStyle = dead ? '#ff4a3a' : '#5dff8a';
      x.lineWidth = 3;
      x.beginPath();
      for (let i = 0; i < 128; i++) {
        const v = trace[(head + i) % 128];
        const y = 92 - v * 60;
        if (i === 0) x.moveTo(i * 2, y);
        else x.lineTo(i * 2, y);
      }
      x.stroke();
      x.fillStyle = dead ? '#ff4a3a' : '#5dff8a';
      x.font = font(28, 800);
      x.fillText(dead ? '0' : '80', 196, 34);
      x.font = font(13, 700);
      x.fillText('BPM', 200, 52);
      ecgTex.needsUpdate = true;
    };
    // the beat ring: a target, a ring closing on it, a heart; twelve dots fill as the treatment works
    const ring = new THREE.Group();
    ov.add(ring);
    const targetMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const target = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 56), targetMat);
    const closeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
    const closing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.022, 6, 56), closeMat);
    const heart = new THREE.Mesh(G.heart, toon(0xe8344c));
    heart.scale.setScalar(0.52);
    const heartPivot = new THREE.Group();
    heartPivot.add(heart);
    const dotOn = new THREE.MeshBasicMaterial({ color: hot(0x6dff7a, 1.3) });
    const dotOff = new THREE.MeshBasicMaterial({ color: 0x3a4a5a });
    const dots = Array.from({ length: CANCER.need }, (_, i) => {
      const d = new THREE.Mesh(G.lo, dotOff);
      const a = Math.PI / 2 - (i / CANCER.need) * Math.PI * 2;
      d.position.set(Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0);
      d.scale.setScalar(0.055);
      return d;
    });
    let arc = null;
    let arcKey = -1;
    const arcMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    const disc = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ color: 0x0c1830, transparent: true, opacity: 0.55, depthWrite: false }));
    disc.scale.setScalar(1.0);
    disc.position.z = -0.05;
    ring.add(disc, target, closing, heartPivot, ...dots);
    ring.position.set(1.2, 1.95, -2.1);
    ring.scale.setScalar(1);
    let flash = 0;
    let flashCol = 0x9dff5a;
    let deadT = -1;
    const cam = { pos: v3(2.15, 2.2, 2.95), look: v3(-0.2, 1.25, -1.4), fov: 50 };
    return {
      group: g,
      over: ov,
      light: { hemi: [0xeaf6ff, 0x7a8a90, 1.5], sun: [0xdde8ff, 1.15], dir: [0.4, 0.9, 0.6], at: [0, 0, -1.5], box: 8, sky: null, bg: 0x101820, fog: [0x101820, 30, 80] },
      cam,
      enter() {
        trace.fill(0);
        head = 0;
        lastBeatT = 0;
        since = 9;
        deadT = -1;
        flash = 0;
        arcKey = -1;
      },
      event(e) {
        if (e === 'beat') {
          flash = 1;
          flashCol = 0x9dff5a;
          ringAt(ring.position.x, ring.position.y, ring.position.z + 0.05, 0x9dff5a, { flat: false, s0: 0.5, s1: 1.4, span: 0.4 });
          glow.spawn({ x: ring.position.x, y: ring.position.y, z: ring.position.z + 0.1, n: 14, speed: 2.4, colors: [0x9dff5a, 0xffffff], k: 2, size: 0.18, life: 0.5, gravity: 0 });
        } else if (e === 'offbeat') {
          flash = 1;
          flashCol = 0xff3b3b;
          jolt = 1;
          shake(0.35);
        } else if (e === 'death') deadT = 0;
      },
      update(dt, life, t) {
        const s = life.s;
        const dead = life.over;
        if (deadT >= 0) deadT += dt;
        // a beat sounds each time beatT comes round
        if (s.beatT < lastBeatT - 1e-6) since = 0;
        else since += dt;
        lastBeatT = s.beatT;
        jolt *= Math.exp(-dt * 6);
        // the trace: a spike on each beat, a wobble when he misses one, flat at the end
        const e = since;
        let v = 0;
        if (!dead) {
          v = e < 0.03 ? -0.2 : e < 0.07 ? 1 : e < 0.11 ? -0.45 : e < 0.3 ? Math.sin(((e - 0.11) / 0.19) * Math.PI) * 0.22 : 0;
          v += jolt * Math.sin(t * 50) * 0.4;
        }
        const n = Math.max(1, Math.round(dt * 90));
        for (let i = 0; i < n; i++) {
          trace[head] = v;
          head = (head + 1) % 128;
        }
        drawTrace(dead);
        // the ring
        // green only while a press would take a beat (the rules' own window)
        const inWindow = beatWindow(life) === 'open';
        flash *= Math.exp(-dt * 7);
        targetMat.color.copy(hot(dead ? 0x662222 : inWindow ? 0x9dff5a : 0xffffff, inWindow && !dead ? 1.35 : 0.95));
        if (flash > 0.02) targetMat.color.lerp(hot(flashCol, 1.7), flash);
        const k = (CANCER.beat - s.beatT) / CANCER.beat;
        closing.visible = !dead;
        closing.scale.setScalar(1 + 1.5 * k);
        closeMat.opacity = 0.35 + 0.65 * (1 - k);
        const pump = Math.max(0, 1 - since / 0.22);
        heartPivot.scale.setScalar(dead ? 0.8 : 1 + pump * 0.28 + flash * 0.1);
        heartPivot.rotation.z = jolt * Math.sin(t * 40) * 0.2;
        dots.forEach((d, i) => (d.material = i < s.beats ? dotOn : dotOff));
        // the outer arc: the time left to beat it
        const left = Math.max(0, CANCER.limit - s.elapsed);
        if (left !== arcKey) {
          arcKey = left;
          if (arc) {
            ring.remove(arc);
            arc.geometry.dispose();
          }
          arc = left > 0 ? new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.018, 4, 64, (left / CANCER.limit) * Math.PI * 2), arcMat) : null;
          if (arc) {
            arc.rotation.z = Math.PI / 2;
            ring.add(arc);
          }
        }
        ring.quaternion.copy(camera.quaternion);
        const tall = aspect < 0.9;
        ring.position.set(tall ? 0.1 : 1.2, tall ? 2.75 : 1.95, tall ? -1.9 : -2.1);
        ring.position.x += jolt * Math.sin(t * 60) * 0.05;
        ring.visible = deadT < 0.8;
        ring.scale.setScalar(dead ? Math.max(0.01, 1 - deadT / 0.8) : 1);
        if (dead) {
          const k = smooth(0.2, 2, deadT);
          hemi.intensity = lerp(1.5, 0.75, k);
          sun.intensity = lerp(1.15, 0.4, k);
        }
        balloon.position.y = 2.6 + Math.sin(t * 1.2) * 0.06;
        balloon.rotation.z = Math.sin(t * 0.9) * 0.08;
        // Roy, sat up in bed
        rest(roy);
        roy.root.position.set(-0.2, 0.86, -0.3);
        roy.root.rotation.y = 0;
        bedPose(roy);
        roy.legL.hip.rotation.x = roy.legR.hip.rotation.x = 0;
        roy.head.rotation.y = 0.45;
        roy.head.rotation.x = -0.1;
        if (flash > 0.3 && flashCol === 0x9dff5a) {
          roy.armR.shoulder.rotation.x = -0.35 - flash * 0.6;
          roy.armR.elbow.rotation.x = -0.7 - flash * 0.8;
        }
        eyes(roy, { look: [0.5, -0.2], shut: dead ? smooth(0, 0.8, deadT) : 0 });
        mood(roy, dead ? 'frown' : flashCol === 0xff3b3b && flash > 0.2 ? 'o' : 'frown');
        royShadow.visible = false;
        cam.pos.set(2.15, 2.2, 2.95);
        cam.look.set(-0.2, 1.25, -1.4);
      },
    };
  })();

  const VIGNETTES = ['kid', 'football', 'store', 'woods', 'hospital'];
  for (const k of VIGNETTES) {
    V[k].group.visible = false;
    scene.add(V[k].group);
  }
  const keyOf = (life) => {
    if (life.stage === 'kid') return 'kid';
    if (life.stage === 'football') return 'football';
    if (life.stage === 'cancer') return 'hospital';
    return life.route === 'offgrid' ? 'woods' : 'store';
  };
  const outfitOf = (life) => {
    if (life.stage === 'kid') return 'kid';
    if (life.stage === 'football') return 'football';
    if (life.stage === 'cancer') return 'gown';
    return life.route === 'offgrid' ? 'woods' : 'job';
  };

  // compile every stage's shaders now, so switching stages never stalls
  for (const k of VIGNETTES) V[k].group.visible = V[k].over.visible = true;
  // the house look (lib/three/house), as in the rest of C-137: the shade one
  // colour from each stage's sky light, under the Neutral exposure the
  // stages were tuned under; their own fog kept
  const house = houseOn({ renderer, scene, sun, hemi, keepExposure: true, look: { fog: false } });
  await stage.precompile();
  try {
    renderer.compile(over, camera);
  } catch {
    // compiled on first use instead
  }
  for (const k of VIGNETTES) V[k].group.visible = V[k].over.visible = false;

  // ── the camera: eased toward each stage's shot, with a shake for the knocks ──
  // (the site's one shake, lib/three/feel: trauma², with Roy's numbers, its
  // decay of 1.6 a second, 0.28 off-centre and 0.05 of roll at the most;
  // still under `calm`)
  const feel = createFeel({ calm, offset: 0.28 });
  feel.set({ decay: 1.6, roll: 0.05 });
  const shake = (k) => feel.trauma(k);
  let aspect = 16 / 9;
  const fovFor = (base) => {
    if (aspect >= 1.25) return base;
    const h = 2 * Math.atan(Math.tan((base * Math.PI) / 360) * 1.25);
    return Math.min(88, (2 * Math.atan(Math.tan(h / 2) / aspect) * 180) / Math.PI);
  };
  const camAt = v3(0, 0, 0);
  // on a tall screen, the camera steps back along its line (at most a few metres) to keep the lanes in
  const pulled = v3(0, 0, 0);
  const framed = (cam) => {
    if (aspect >= 1.1) return pulled.copy(cam.pos);
    pulled.copy(cam.pos).sub(cam.look);
    const d = pulled.length();
    return pulled.multiplyScalar(1 + (Math.min(d, 8) * (1.1 - aspect) * 0.75) / d).add(cam.look);
  };
  const camLook = v3(0, 0, 0);
  let current = null;
  let seen = null;
  let lastT = 0;
  let lastStage = null;
  let time = 0;
  let lightKey = '';

  const show = (key, life) => {
    if (current) V[current].group.visible = V[current].over.visible = false;
    current = key;
    const v = V[key];
    v.group.visible = v.over.visible = true;
    const L = v.light;
    hemi.color.set(L.hemi[0]);
    hemi.groundColor.set(L.hemi[1]);
    hemi.intensity = L.hemi[2];
    sun.color.set(L.sun[0]);
    sun.intensity = L.sun[1];
    sun.target.position.set(...L.at);
    sun.position.set(L.at[0] + L.dir[0] * 40, L.at[1] + L.dir[1] * 40, L.at[2] + L.dir[2] * 40);
    const sc = sun.shadow.camera;
    Object.assign(sc, { left: -L.box, right: L.box, top: L.box, bottom: -L.box, near: 1, far: 120 });
    sc.updateProjectionMatrix();
    sky.dome.visible = Boolean(L.sky);
    if (L.sky) sky.setLook(L.sky);
    house.follow();
    scene.background = L.sky ? null : background.set(L.bg ?? 0x101010);
    scene.fog.color.set(L.fog[0]);
    scene.fog.near = L.fog[1];
    scene.fog.far = L.fog[2];
    renderer.toneMappingExposure = L.exposure ?? 1;
    lightKey = key;
    confetti.clear();
    dust.clear();
    glow.clear();
    stars.visible = false;
    tuckBall.visible = false;
    royBall.visible = false;
    royShadow.visible = true;
    v.enter(life);
    v.update(0, life, time);
    camAt.copy(framed(v.cam));
    camLook.copy(v.cam.look);
    camera.fov = fovFor(v.cam.fov);
    camera.updateProjectionMatrix();
  };

  const render = (life, ms = 16) => {
    if (stage.lost || stage.disposed || !life) return;
    const dt = Math.min(0.1, Math.max(0, ms / 1000));
    time += dt;
    // a new life, or a new stage: the stage's vignette, from the top
    const key = keyOf(life);
    const fresh = life.t < lastT - 1e-9 || (life.stage !== lastStage && life !== seen);
    if (key !== current || fresh) {
      dressRoy(life, outfitOf(life));
      show(key, life);
    }
    if (life.stage === 'finale' && current === 'woods' && lightKey === 'woods' && life.over && life.cause === 'old') {
      sky.setLook({ top: 0x2b2f6b, mid: 0xc06a7a, low: 0xffc27a, sun: 0xffe0a0, clouds: 0.5 });
      lightKey = 'dusk';
    }
    lastT = life.t;
    lastStage = life.stage;
    dressRoy(life, outfitOf(life));
    const v = V[current];
    // what happened since the last frame (once per life object)
    if (life !== seen) {
      seen = life;
      for (const e of life.events ?? []) {
        v.event(e, life);
        if (e === 'tackle') shake(0.55);
        if (e === 'death' && life.cause !== 'old' && life.cause !== 'cancer') shake(0.3);
      }
    }
    v.update(dt, life, time);
    // a blink now and then
    blinkT -= dt;
    if (blinkT <= 0) {
      blinkOn = 0.14;
      blinkT = 2.5 + Math.random() * 3;
    }
    if (blinkOn > 0) {
      blinkOn -= dt;
      if (roy.eyes[0].scale.y > roy.eyes[0].userData.sy * 0.5) eyes(roy, { shut: 1 });
    }
    // the camera
    const k = damp(dt, v.cam.rate ?? 5);
    camAt.lerp(framed(v.cam), k);
    camLook.lerp(v.cam.look, k);
    camera.position.copy(camAt);
    camera.lookAt(camLook);
    const fov = fovFor(v.cam.fov);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov += (fov - camera.fov) * k;
      camera.updateProjectionMatrix();
    }
    // the shake on top of the shot (the fov is the shot's own: the feel's base follows it)
    feel.setBaseFov(camera.fov);
    feel.update(dt, camera);
    sky.update(time, camera);
    confetti.update(dt, camera);
    dust.update(dt, camera);
    glow.update(dt, camera);
    updateRings(dt);
    renderer.info.reset();
    stage.render(ms);
  };

  const resize = (w, h) => {
    stage.resize(w, h);
    aspect = Math.max(1, w) / Math.max(1, h);
    if (current) {
      camera.fov = fovFor(V[current].cam.fov);
      camera.updateProjectionMatrix();
    }
  };

  const dispose = () => {
    disposeTree(over);
    stage.dispose();
    mats.dispose();
    for (const o of owned) o.dispose?.();
    shadowMat.dispose();
  };

  const info = () => {
    const r = renderer.info.render;
    const m = renderer.info.memory;
    return { stage: current, calls: r.calls, triangles: r.triangles, geometries: m.geometries, textures: m.textures, quality: stage.quality };
  };

  return {
    render,
    resize,
    dispose,
    info,
    // behind ?debug: the stage's bloom and the shake's numbers
    tune: () => stage.tune(feelGroups(feel)),
    get lost() {
      return stage.lost;
    },
  };
}
