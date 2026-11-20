// The cargo pod: when the ship goes down, what's in its hold (less what the
// Falcon's compartments hide) drops where it went, kept until it's flown back
// to and taken aboard. One pod at a time: going down again before it's
// recovered loses the older. Pure: the market's store keeps it (tp-market).
//
// POD_REACH: how close the ship must be to take it aboard (map units)
// dropPod({ crew, room, lots, at, sector, t }) → { pod | null, keep: lots }
// nearPod(pod, ship) → boolean
// recoverInto(pod, hold) → { got (units), pod: what's left, or null }

import { hidden } from './index';

export const POD_REACH = 8;

const units = (lots) => lots.reduce((n, l) => n + l.n, 0);
export function dropPod({ crew, room, lots, at, sector, t = 0 }) {
  const keep = hidden(crew, room, lots);
  const kept = new Map();
  for (const l of keep) kept.set(l, l.n);
  // what's dropped: each lot less what the compartments keep of the same good and origin
  const left = new Map(keep.map((l) => [`${l.good}|${l.from?.sector?.join(',')}|${l.from?.pocket}`, l.n]));
  const dropped = [];
  for (const l of lots ?? []) {
    const key = `${l.good}|${l.from?.sector?.join(',')}|${l.from?.pocket}`;
    const k = Math.min(l.n, left.get(key) ?? 0);
    if (k) left.set(key, left.get(key) - k);
    if (l.n - k > 0) dropped.push({ ...l, n: l.n - k });
  }
  if (!units(dropped) || !Array.isArray(at)) return { pod: null, keep };
  return { pod: { crew, at: [...at], sector: Array.isArray(sector) ? [...sector] : null, t, lots: dropped }, keep };
}

export const nearPod = (pod, ship) => Boolean(pod && ship) && Math.hypot(ship.x - pod.at[0], ship.y - pod.at[1], ship.z - pod.at[2]) <= POD_REACH;

export function recoverInto(pod, hold) {
  if (!pod || !hold) return { got: 0, pod };
  let got = 0;
  const rest = [];
  for (const l of pod.lots) {
    const n = hold.add(l.good, l.n, l.from);
    got += n;
    if (l.n - n > 0) rest.push({ ...l, n: l.n - n });
  }
  return { got, pod: rest.length ? { ...pod, lots: rest } : null };
}
