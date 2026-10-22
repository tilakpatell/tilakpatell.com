// The dementors (the design’s §4.8): past the term’s sixth week, at night,
// when you’re on the shore, three come over the lake toward you. The cold
// comes with them (the house look’s shade drains to grey as they close,
// the shore frosts) and the pull (your walk slows). Without a Patronus you
// faint at the water’s edge and wake in your common room, Madam Pomfrey’s
// toast and her chocolate; with one (Lane E’s Expecto Patronum, once it is
// learnt) they are run off over the water and the night is yours. Pure:
// the shore comes in as a function (metres from the water’s edge, less
// than nothing out on the water), so the same rules stand on Lane A’s
// shore and Lane C’s grounds.
//
//   DEMENTORS: the numbers (how many, how far out they rise, their drift, the cold’s reach…)
//   canCome(week, hour) → whether it’s a dementors’ night at that hour
//   nightOf(day, hour) → which night it is (the small hours belong to the evening before)
//   onShore(shoreAt, x, z) → whether you’re on the shore
//   newDementors() → { phase: 'none' | 'coming' | 'fleeing' | 'gone', list, cold, chill, night, t }
//   step(state, { dt, week, day, hour, player: { x, z }, shoreAt, patronus }) → { state, events }
//     list: [{ x, z, y (over the water), yaw, fade (1 there … 0 gone) }]
//     cold: 0…1, how near the nearest is: the shade’s drain, the frost, the pull
//     events: { type: 'come' }, { type: 'faint', toast, to: 'common' },
//             { type: 'driven', toast } (the Patronus ran them off: the three notes play), { type: 'gone' }
//   pull(cold) → the walk’s share of its pace (1 none … DEMENTORS.pull at the worst)
//   drain(cold) → 0…1, how far the house look’s shade goes to grey
//   NOTES: the world’s three rising notes in D, [Hz, seconds in]

export const DEMENTORS = {
  count: 3,
  week: 7, // (from the seventh week: past the sixth, the Christmas feast’s)
  from: 75, // m out over the water they rise
  spread: 24, // m between them as they come
  pace: 2.1, // m/s, a drift
  hurry: 3.4, // m/s, the last stretch
  height: 2.4, // m over the water
  cold: 38, // m: the cold reaches this far ahead of them
  faint: 2.6, // m: this near and you’re gone
  hold: 5, // s at the worst of the cold and you faint all the same
  shore: 24, // m up from the water’s edge counts as the shore
  bank: 10, // m up from the water’s edge they come, and no further
  lose: 110, // m away and they give up and sink back
  range: 40, // m: the Patronus reaches them within this
  flee: 11, // m/s, run off
  fade: 3.5, // s to be gone once run off
  pull: 0.4, // the walk at the worst of the cold
};

export const NOTES = [
  [293.66, 0], // D
  [369.99, 0.42], // F sharp
  [440, 0.84], // A, held
];

const FAINT = 'You woke in your own bed with chocolate on the pillow and a note from Madam Pomfrey.';
const DRIVEN = 'The dementors fled over the water, and the night is yours.';

export const nightOf = (day, hour) => (hour < 12 ? day - 1 : day);
export const canCome = (week, hour) => week >= DEMENTORS.week && (hour >= 21 || hour < 5);
export const onShore = (shoreAt, x, z) => {
  const d = shoreAt(x, z);
  return d > -3 && d < DEMENTORS.shore;
};

export const newDementors = () => ({ phase: 'none', list: [], cold: 0, chill: 0, night: null, t: 0 });

export const pull = (cold) => 1 - (1 - DEMENTORS.pull) * Math.min(1, Math.max(0, cold));
export const drain = (cold) => Math.min(1, Math.max(0, cold)) ** 0.8;

// the way out over the water from a point: down the shore’s slope (its gradient, by differences)
function outward(shoreAt, x, z) {
  const e = 4;
  const gx = shoreAt(x + e, z) - shoreAt(x - e, z);
  const gz = shoreAt(x, z + e) - shoreAt(x, z - e);
  const l = Math.hypot(gx, gz) || 1;
  return [-gx / l, -gz / l];
}

function rise(player, shoreAt, t) {
  const [ox, oz] = outward(shoreAt, player.x, player.z);
  const list = [];
  for (let i = 0; i < DEMENTORS.count; i++) {
    const side = (i - (DEMENTORS.count - 1) / 2) * DEMENTORS.spread;
    // (the middle one a little further out: they come as a loose arrowhead)
    const out = DEMENTORS.from + (i === 1 ? 14 : 0);
    const x = player.x + ox * out - oz * side;
    const z = player.z + oz * out + ox * side;
    list.push({ x, z, y: DEMENTORS.height, yaw: Math.atan2(-ox, -oz), fade: 0, seed: i * 2.1 + t });
  }
  return list;
}

const nearest = (list, p) => list.reduce((m, d) => Math.min(m, Math.hypot(d.x - p.x, d.z - p.z)), Infinity);

export function step(state, { dt, week, day = 0, hour, player, shoreAt, patronus = false }) {
  const s = { ...state, t: state.t + dt };
  const events = [];
  const night = nightOf(day, hour);
  if (s.phase === 'gone' && s.night !== night) Object.assign(s, { phase: 'none', list: [] });
  const out = canCome(week, hour);

  if (s.phase === 'none') {
    s.cold = Math.max(0, s.cold - dt * 0.5);
    if (out && player && onShore(shoreAt, player.x, player.z)) {
      s.phase = 'coming';
      s.night = night;
      s.list = rise(player, shoreAt, s.t);
      s.chill = 0;
      events.push({ type: 'come' });
    }
    return { state: s, events };
  }

  if (s.phase === 'coming') {
    const far = player ? nearest(s.list, player) : Infinity;
    // (daylight, or you’ve gone far enough: they sink back into the lake)
    if (!out || far > DEMENTORS.lose) {
      s.list = s.list.map((d) => ({ ...d, fade: Math.max(0, d.fade - dt / DEMENTORS.fade) }));
      s.cold = Math.max(0, s.cold - dt * 0.4);
      if (s.list.every((d) => d.fade === 0)) Object.assign(s, { phase: 'none', list: [] });
      return { state: s, events };
    }
    if (patronus && far < DEMENTORS.range) {
      s.phase = 'fleeing';
      events.push({ type: 'driven', toast: DRIVEN });
      return { state: s, events };
    }
    s.list = s.list.map((d, i) => {
      const dx = player.x - d.x;
      const dz = player.z - d.z;
      const l = Math.hypot(dx, dz) || 1;
      // (the last stretch quickens; and they keep to the water’s edge, never far up the bank)
      const v = l < DEMENTORS.cold * 0.5 ? DEMENTORS.hurry : DEMENTORS.pace;
      const sway = Math.sin(s.t * 0.7 + d.seed) * 0.6;
      const k = Math.min(l, v * dt);
      let x = d.x + (dx / l) * k - (dz / l) * sway * dt;
      let z = d.z + (dz / l) * k + (dx / l) * sway * dt;
      if (shoreAt(x, z) > DEMENTORS.bank && shoreAt(x, z) > shoreAt(d.x, d.z)) {
        x = d.x;
        z = d.z;
      }
      return { ...d, x, z, y: DEMENTORS.height + Math.sin(s.t * 1.3 + i) * 0.3, yaw: Math.atan2(dx, dz), fade: Math.min(1, d.fade + dt / 2) };
    });
    const d = nearest(s.list, player);
    s.cold = Math.max(0, Math.min(1, (DEMENTORS.cold - d) / (DEMENTORS.cold - DEMENTORS.faint)));
    s.chill = s.cold > 0.92 ? s.chill + dt : Math.max(0, s.chill - dt);
    if (d < DEMENTORS.faint || s.chill > DEMENTORS.hold) {
      s.phase = 'gone';
      s.list = [];
      s.cold = 0;
      s.chill = 0;
      events.push({ type: 'faint', toast: FAINT, to: 'common' });
    }
    return { state: s, events };
  }

  if (s.phase === 'fleeing') {
    s.list = s.list.map((d) => {
      const dx = d.x - (player?.x ?? d.x);
      const dz = d.z - (player?.z ?? d.z);
      const l = Math.hypot(dx, dz) || 1;
      return { ...d, x: d.x + (dx / l) * DEMENTORS.flee * dt, z: d.z + (dz / l) * DEMENTORS.flee * dt, y: d.y + dt * 1.5, yaw: Math.atan2(dx, dz), fade: Math.max(0, d.fade - dt / DEMENTORS.fade) };
    });
    s.cold = Math.max(0, s.cold - dt * 0.6);
    if (s.list.every((d) => d.fade === 0)) {
      Object.assign(s, { phase: 'gone', list: [], cold: 0 });
      events.push({ type: 'gone' });
    }
    return { state: s, events };
  }

  // gone for the night: the cold lifts
  s.cold = Math.max(0, s.cold - dt * 0.5);
  return { state: s, events };
}
