// The navgrid's A* (nav.js's findPath, its search alone): from cell s to
// cell goal on eight neighbours, no corner cut, an octile heuristic, at
// most `max` cells expanded. Two of it behind one interface (lane X2:
// docs/stack/webassembly.md): the JavaScript below, always there, and the
// Rust port (wasm/navsearch, built by wasm-pack) once it has come up; both
// give the same cells for the same grid, ties and rounding included
// (navSearch.test.js runs every case through both), so a seeded battle is
// the same battle on either. The search is the Battlefront's biggest
// single CPU entry (the evidence's profile, docs/superpowers/evidence/
// bf2017-picture/x2/README.md).
//
//   searchJs(nav, s, goal, blocked, max) → [cell, …] from s to goal | null
//   search(nav, s, goal, blocked, max): whichever is in use
//   setSearch(impl | null): the port's loader puts it in (null: the JavaScript again)
//   searchIn() → 'wasm' | 'js'
// nav: buildNav's (cols, rows, cell, walk, solid); blocked: a Set of cells or null.

const SQRT2 = Math.SQRT2;

const open = (nav, i, blocked) => nav.walk[i] === 1 && !nav.solid[i] && !(blocked && blocked.has(i));

function heap(f) {
  const a = [];
  return {
    get size() {
      return a.length;
    },
    push(i) {
      a.push(i);
      let k = a.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (f[a[p]] <= f[a[k]]) break;
        [a[p], a[k]] = [a[k], a[p]];
        k = p;
      }
    },
    pop() {
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1;
          const r = l + 1;
          let m = k;
          if (l < a.length && f[a[l]] < f[a[m]]) m = l;
          if (r < a.length && f[a[r]] < f[a[m]]) m = r;
          if (m === k) break;
          [a[m], a[k]] = [a[k], a[m]];
          k = m;
        }
      }
      return top;
    },
  };
}

function scratchOf(nav) {
  const n = nav.cols * nav.rows;
  nav.scratch ??= { g: new Float32Array(n), f: new Float32Array(n), from: new Int32Array(n), seen: new Uint32Array(n), shut: new Uint32Array(n), gen: 0 };
  nav.scratch.gen++;
  return nav.scratch;
}

export function searchJs(nav, s, goal, blocked, max) {
  const S = scratchOf(nav);
  const { g, f, from: came, seen, shut, gen } = S;
  const cols = nav.cols;
  const gc = goal % cols;
  const gr = Math.floor(goal / cols);
  const h = (i) => {
    const dx = Math.abs((i % cols) - gc);
    const dz = Math.abs(Math.floor(i / cols) - gr);
    return (Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz)) * nav.cell;
  };
  const q = heap(f);
  g[s] = 0;
  f[s] = h(s);
  came[s] = -1;
  seen[s] = gen;
  q.push(s);
  let expanded = 0;
  let found = false;
  while (q.size) {
    const cur = q.pop();
    if (shut[cur] === gen) continue;
    shut[cur] = gen;
    if (cur === goal) {
      found = true;
      break;
    }
    if (++expanded > max) return null;
    const c = cur % cols;
    const r = Math.floor(cur / cols);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= nav.rows) continue;
        const ni = rr * cols + cc;
        if (!open(nav, ni, blocked) || shut[ni] === gen) continue;
        // no corner cutting: a diagonal needs both sides open
        if (dr && dc && (!open(nav, r * cols + cc, blocked) || !open(nav, rr * cols + c, blocked))) continue;
        const ng = g[cur] + (dr && dc ? nav.cell * SQRT2 : nav.cell);
        if (seen[ni] === gen && ng >= g[ni]) continue;
        seen[ni] = gen;
        g[ni] = ng;
        f[ni] = ng + h(ni);
        came[ni] = cur;
        q.push(ni);
      }
  }
  if (!found) return null;
  const cells = [];
  for (let i = goal; i !== -1; i = came[i]) cells.push(i);
  return cells.reverse();
}

let impl = null;

export const search = (nav, s, goal, blocked, max) => (impl ? impl(nav, s, goal, blocked, max) : searchJs(nav, s, goal, blocked, max));

export function setSearch(next) {
  impl = next;
}

export const searchIn = () => (impl ? 'wasm' : 'js');
