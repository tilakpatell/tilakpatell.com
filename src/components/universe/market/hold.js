// A ship's hold as lots: { good, n, from: { sector: [sx, sy, sz], pocket } },
// each lot keeping where its goods came from, so a specialty hauled far sells
// for more (prices.js's haul). Pure: the store keeps the lots, this works on them.
//
// readHold(raw) → lots (junk dropped, whole counts, known goods only)
// holdOps(lots, room) → { lots, used, room, free, count(good), add(good, n,
//   from) → added, remove(good, n) → the lots taken (oldest first), has(goods),
//   take(goods), goods() → [{ id, name, n }] } (add, remove and take change `lots`)

import { GOODS } from './goods';

const whole = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const readFrom = (f) => ({
  sector: Array.isArray(f?.sector) && f.sector.length === 3 && f.sector.every(Number.isFinite) ? f.sector.map((v) => Math.round(v)) : [0, 0, 0],
  pocket: typeof f?.pocket === 'string' ? f.pocket : null,
});

export const readHold = (raw) =>
  (Array.isArray(raw) ? raw : []).filter((l) => l && typeof l === 'object' && Object.hasOwn(GOODS, l.good) && whole(l.n) > 0).map((l) => ({ good: l.good, n: whole(l.n), from: readFrom(l.from) }));

export function holdOps(lots, room) {
  const cap = whole(room);
  const used = () => lots.reduce((n, l) => n + l.n, 0);
  const count = (good) => lots.reduce((n, l) => n + (l.good === good ? l.n : 0), 0);
  const remove = (good, n) => {
    let want = whole(n);
    const out = [];
    for (let i = 0; i < lots.length && want > 0; i++) {
      const l = lots[i];
      if (l.good !== good) continue;
      const k = Math.min(l.n, want);
      out.push({ good, n: k, from: l.from });
      l.n -= k;
      want -= k;
    }
    for (let i = lots.length - 1; i >= 0; i--) if (lots[i].n <= 0) lots.splice(i, 1);
    return out;
  };
  const has = (goods) => Boolean(goods) && typeof goods === 'object' && Object.entries(goods).every(([id, n]) => count(id) >= whole(n));
  return {
    lots,
    get used() {
      return used();
    },
    room: cap,
    get free() {
      return Math.max(0, cap - used());
    },
    count,
    add(good, n, from) {
      if (!Object.hasOwn(GOODS, good)) return 0;
      const k = Math.min(whole(n), Math.max(0, cap - used()));
      if (!k) return 0;
      const f = readFrom(from);
      const last = lots.at(-1);
      if (last && last.good === good && last.from.pocket === f.pocket && last.from.sector.every((v, i) => v === f.sector[i])) last.n += k;
      else lots.push({ good, n: k, from: f });
      return k;
    },
    remove,
    has,
    take(goods) {
      if (!has(goods)) return false;
      for (const [id, n] of Object.entries(goods)) remove(id, n);
      return true;
    },
    goods() {
      const byGood = new Map();
      for (const l of lots) byGood.set(l.good, (byGood.get(l.good) ?? 0) + l.n);
      return [...byGood].map(([id, n]) => ({ id, name: GOODS[id].name, n }));
    },
  };
}
