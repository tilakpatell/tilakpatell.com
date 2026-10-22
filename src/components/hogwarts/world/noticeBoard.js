// The notice board (the design’s §4.7): an oak board on two posts under a
// little slate roof, cork on its face and the week’s notices pinned to it,
// each a slip of parchment with what there is to do and where. It reads the
// term’s view (play/school.js), and is repainted only when that changes;
// E by it opens the same list as the Menu’s Things to do. It stands on the
// shore by where you come up from the boats, and in the grounds by the
// castle’s door once they stand.
//
//   noticesFor(view) → { head, notes: [{ title, text, kind }] } (pure: what’s pinned up)
//   createNoticeBoard({ house, tier, renderer, at: [x, y, z], yaw }) → {
//     group, at: [x, z], solids: [{ at, r }], near(x, z) → bool, set(view), dispose() }

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { createRoomKit } from '../rooms/kit';
import { canvasTexture } from '../../../lib/three/canvasTexture';

const BOARD = { w: 1.9, h: 1.25, post: 0.09, foot: 0.85, reach: 2.6 };
const MOST = 6; // notes on the board: more and nobody reads them

// what is pinned up this week: the open quests first (the next one with a
// red pin), then the notices the week brings
export function noticesFor(view) {
  if (!view) return { head: 'Notices', notes: [{ title: 'Welcome', text: 'The term begins once you’re across the lake.', kind: 'note' }] };
  const notes = [];
  if (view.leaving) notes.push({ title: 'The leaving feast', text: view.feasted ? 'The Cup is given. Next year’s list goes up in September.' : 'Tonight in the Great Hall. The Cup will be given.', kind: 'feast' });
  if (view.christmas) notes.push({ title: 'Christmas', text: 'Twelve trees in the Great Hall. Those staying, sign below.', kind: 'note' });
  for (const q of view.list ?? []) {
    if (!q.open || notes.length >= MOST - 1) continue;
    notes.push({ title: q.name, text: q.where, kind: q.id === view.objective?.id ? 'next' : 'quest' });
  }
  if (view.week >= 2 && notes.length < MOST) notes.push({ title: 'Found', text: 'In Mr Filch’s office: a folded parchment. Yours, if you say the words.', kind: 'note' });
  if (!notes.length) notes.push({ title: 'Nothing pinned up', text: 'Everything this term has been done.', kind: 'note' });
  return { head: `Notices · ${view.label}`, notes: notes.slice(0, MOST) };
}

// (a word-wrapped line or lines, at most `lines` of them)
function wrap(g, text, width, lines) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > width && line) {
      out.push(line);
      line = word;
      if (out.length === lines) break;
    } else line = next;
  }
  if (out.length < lines && line) out.push(line);
  return out;
}

const PIN = { next: '#b0161e', quest: '#2b4f9a', feast: '#b8892c', note: '#3c6b37' };

function paint(canvas, { head, notes }) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  // the cork, speckled (the same speckle every time: a seeded walk)
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#9c7449';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(60,36,18,0.35)' : 'rgba(214,170,120,0.3)';
    g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 2 + rnd() * 3);
  }
  // the head, burnt into a strip of oak along the top
  g.fillStyle = '#3d2a1a';
  g.fillRect(0, 0, W, 86);
  g.fillStyle = '#e9d8b0';
  g.font = '700 46px Cinzel, Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(head, W / 2, 46, W - 60);
  // the slips, three to a row, each a little crooked
  const cols = 3;
  const sw = (W - 80) / cols - 20;
  const sh = (H - 120) / 2 - 24;
  notes.forEach((n, i) => {
    const cx = 40 + (i % cols) * (sw + 20) + sw / 2 + 10;
    const cy = 110 + Math.floor(i / cols) * (sh + 24) + sh / 2 + 6;
    g.save();
    g.translate(cx, cy);
    g.rotate((rnd() - 0.5) * 0.09);
    g.fillStyle = 'rgba(30,18,8,0.35)';
    g.fillRect(-sw / 2 + 6, -sh / 2 + 8, sw, sh);
    g.fillStyle = n.kind === 'next' ? '#f1e3bd' : '#e6d6ad';
    g.fillRect(-sw / 2, -sh / 2, sw, sh);
    g.strokeStyle = 'rgba(90,60,30,0.35)';
    g.lineWidth = 2;
    g.strokeRect(-sw / 2 + 8, -sh / 2 + 8, sw - 16, sh - 16);
    g.fillStyle = '#2a1d12';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.font = '700 30px Cinzel, Georgia, serif';
    wrap(g, n.title, sw - 36, 2).forEach((l, k) => g.fillText(l, 0, -sh / 2 + 30 + k * 36, sw - 30));
    g.font = 'italic 26px Georgia, serif';
    wrap(g, n.text, sw - 40, 4).forEach((l, k) => g.fillText(l, 0, -sh / 2 + 112 + k * 32, sw - 34));
    // the pin
    g.fillStyle = PIN[n.kind] ?? PIN.note;
    g.beginPath();
    g.arc(0, -sh / 2 + 14, 9, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

// a gable’s triangle, `half` wide either side and `rise` tall, 4 cm thick
function gable(half, rise) {
  const s = new THREE.Shape();
  s.moveTo(-half, 0);
  s.lineTo(half, 0);
  s.lineTo(0, rise);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false });
}

export function createNoticeBoard({ house = null, tier = 'high', renderer = null, at = [0, 0, 0], yaw = 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'hogwarts:notice-board';
  group.position.set(...at);
  group.rotation.y = yaw;
  const kit = createRoomKit({ tier });
  const { w, h, post, foot } = BOARD;
  // two posts, the board’s frame, a ledge under it and a pitched slate roof over
  // it: two planes meeting at a ridge, their eaves just past the posts
  const ridge = foot + h + 0.42;
  const pitch = 0.42;
  const half = (w / 2 + post + 0.1) / Math.cos(pitch) / 2;
  for (const sx of [-1, 1]) kit.box('darkoak', sx * (w / 2 + post / 2), 0, 0, post, foot + h + 0.04, post);
  kit.box('oak', 0, foot - 0.06, -0.03, w + post * 2, 0.06, 0.12);
  kit.box('oak', 0, foot + h, -0.03, w + post * 2, 0.06, 0.1);
  kit.box('board', 0, foot, -0.06, w, h, 0.04);
  for (const sx of [-1, 1]) kit.box('slate', sx * half * Math.cos(pitch), ridge - half * Math.sin(pitch) - 0.02, -0.02, half * 2, 0.035, 0.46, { rz: sx * -pitch });
  // the gable boards under the roof, front and back, and the ridge
  for (const z of [-0.2, 0.16]) kit.add('oak', gable(w / 2 + post, ridge - foot - h - 0.02), { at: [0, foot + h + 0.02, z] });
  kit.box('darkoak', 0, ridge - 0.04, -0.02, 0.07, 0.07, 0.5);
  kit.build(group);

  // the face: the cork and the slips, painted on a canvas
  const canvas = typeof document === 'undefined' ? null : Object.assign(document.createElement('canvas'), { width: 1024, height: 680 });
  const tex = canvas ? canvasTexture(canvas, renderer, { wrap: false }) : null;
  const faceMat = new MeshStandardNodeMaterial({ map: tex, color: tex ? 0xffffff : 0x9c7449, roughness: 0.92 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, h - 0.04), faceMat);
  face.position.set(0, foot + h / 2, -0.035);
  face.receiveShadow = true;
  group.add(face);
  house?.adopt?.(group);

  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // the posts as the walk’s circles, in the world
  const solids = [-1, 1].map((sx) => ({ at: [at[0] + sx * (w / 2) * c, at[2] - sx * (w / 2) * s], r: 0.25 }));
  // where you stand to read it: in front of its face
  const front = [at[0] + s * 1.1, at[2] + c * 1.1];
  let last = '';
  return {
    group,
    at: [at[0], at[2]],
    solids,
    near: (x, z) => Math.hypot(x - front[0], z - front[1]) <= BOARD.reach,
    set(view) {
      if (!canvas) return;
      const pinned = noticesFor(view);
      const key = JSON.stringify(pinned);
      if (key === last) return;
      last = key;
      paint(canvas, pinned);
      tex.needsUpdate = true;
    },
    dispose() {
      kit.dispose();
      face.geometry.dispose();
      faceMat.dispose();
      tex?.dispose();
      group.removeFromParent();
    },
  };
}
