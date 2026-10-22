// The pines round Hogsmeade: the nature kit’s pines (the shore’s own) on
// the valley’s sides above the yards, thicker up the slopes, none in the
// street or its yards, none on the road down to the station and none on
// the Shack’s hill (it stands alone up there). Pure: where each stands.
//
//   pinesOf({ count, seed }) → [{ model, x, y, z, yaw, scale }]

import { SHACK, VILLAGE } from '../../rules/hogsmeade';
import { EDGE, streetFrame, terrainAt } from './layout';

const MODELS = ['Pine_1', 'Pine_3', 'Pine_5'];
const HILL = [SHACK.at[0] - VILLAGE.at[0], SHACK.at[1] - VILLAGE.at[1]];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pinesOf({ count = 160, seed = 1693 } = {}) {
  const r = rng(seed);
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const a = r() * Math.PI * 2;
    const d = 40 + Math.sqrt(r()) * 300;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const f = streetFrame([x, z]);
    // (clear of the street and a margin round its yards, of the road, of the Shack’s hill)
    if (f.along > EDGE.a0 - 12 && f.along < EDGE.a1 + 12 && f.across > EDGE.c0 - 12 && f.across < EDGE.c1 + 12) continue;
    if (f.along < EDGE.a0 && Math.abs(f.across) < 16) continue;
    if (Math.hypot(x - HILL[0], z - HILL[1]) < SHACK.r * 1.7) continue;
    const y = terrainAt(x, z);
    // (more of them where the land rises: a pinewood on the valley’s sides)
    if (r() > 0.25 + Math.min(1, y / 18) * 0.75) continue;
    out.push({ model: MODELS[Math.floor(r() * MODELS.length)], x, y, z, yaw: r() * Math.PI * 2, scale: 1.5 + r() * 1.1 });
  }
  return out;
}
