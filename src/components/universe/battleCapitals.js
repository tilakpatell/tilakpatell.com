// A battle's capital ships (battle.js fights the battle; this lays out its
// lines and fights its big ships): each side's in its line, the flagship in
// the middle and the escorts out to each side by their widths; every battery
// firing turbolasers at the other side's capital ships and point-defence at
// fighters (you too) that come close; a hull hit, a ship breaking up, and
// the set pieces' hold on them (galaxy/warpieces/): an ion cannon's hit,
// a ship wrecked outright, moved or turned. Pure (no three.js), tested in
// Node through battle.js.
//
// Each takes the battle's inner context `k` (battle.js's createBattle makes
// it): { b, rand, between, C, A, S, lines, attacker, defender, pending,
// newId(), youIn(), finish(winner, why, out), decides }.
// layCapitals(k, objectivesOn); fireBatteries(k, cap, dt); hullHit(cap,
// damage, out, spare); ageCapitals(k, dt, out); holdCapitals(k) gives the battle
// disable(id, s), wreck(id), moveCapital(cap, d) and turnCapital(cap, axis, a);
// shiftCapital(cap, d) and turnCapitalBy(cap, axis, a) move one with everything
// on it. With the battle fought as a fleet (k.fleet, battleFleet.js) a battery
// fires where the fleet says.

import { HULLS, SUBSYSTEMS, TURRETS } from './wars';
import { BATTLE, UP, copy, cross, dist2, dot, len, norm, set, v3, widthOf } from './battleKit';

// a point on a capital ship's hull, from its own frame (shares of its length) into the battle's
export const place = (cap, l, o = v3()) => set(o, cap.pos.x + (cap.right.x * l[0] + cap.up.x * l[1] + cap.fwd.x * l[2]) * cap.size, cap.pos.y + (cap.right.y * l[0] + cap.up.y * l[1] + cap.fwd.y * l[2]) * cap.size, cap.pos.z + (cap.right.z * l[0] + cap.up.z * l[1] + cap.fwd.z * l[2]) * cap.size);

// ── the capital ships, in their lines ──
export function layCapitals(k, objectivesOn) {
  const { b, C, A, S, lines, between, defender } = k;
  b.teams.forEach(({ side }, team) => {
    const dir = team === 0 ? 1 : -1; // the way to the other side
    // the ship the defender's objectives are on: its flagship, or (an
    // interdiction) the first Interdictor among its escorts, if it has one
    const inter = objectivesOn === 'interdictor' ? side.capitals.findIndex((c) => c.kind === 'interdictor') : -1;
    const objective = team === defender ? (inter >= 0 ? inter : 0) : -1;
    const line = v3(C.x - A.x * lines * dir, C.y, C.z - A.z * lines * dir);
    let flank = 0;
    // how far out each side of the line is taken, so far (the flagship's half, and a gap)
    const edge = [widthOf(side.capitals[0]) / 2 + 6, widthOf(side.capitals[0]) / 2 + 6];
    side.capitals.forEach((c, i) => {
      const flag = c.role === 'flagship';
      // the flagship in the middle of the line, the escorts out to each side by their widths, a little forward
      let out = 0;
      if (!flag) {
        const s = flank % 2;
        const w = widthOf(c);
        out = (s ? -1 : 1) * (edge[s] + w / 2);
        edge[s] += w + 6;
        flank += 1;
      }
      const fwd = v3(A.x * dir, 0, A.z * dir);
      const cap = {
        id: k.newId(),
        team,
        kind: c.kind,
        role: c.role,
        size: c.size,
        pos: v3(line.x + S.x * out + fwd.x * (flag ? 0 : 12 + 4 * (i % 2)), line.y + (flag ? 0 : i % 2 ? 7 : -6), line.z + S.z * out + fwd.z * (flag ? 0 : 12 + 4 * (i % 2))),
        fwd,
        up: v3(0, 1, 0),
        right: cross(UP, fwd),
        hull: c.hull,
        hullMax: c.hull,
        alive: true,
        dying: 0,
        disabled: 0, // seconds left of an ion cannon's hit
        objective: i === objective,
        tracked: i !== objective, // (the ship with the defender's objectives falls by them, not its hull)
        subs: [],
        spheres: [],
        turrets: [],
        props: [], // (what a plan lays by it, moved with it: battleStages.js)
      };
      cap.spheres = (HULLS[c.kind] ?? [[0, 0.1]]).map(([z, r]) => ({ c: place(cap, [0, 0, z]), r: r * c.size }));
      cap.reach = c.size * 0.55;
      // (`pos`, the same point as `at`: a battery's a target a fighter can strafe, battleTactics.js)
      cap.turrets = (TURRETS[c.kind] ?? []).map((l) => {
        const at = place(cap, l);
        return { num: k.newId(), at, pos: at, r: Math.max(0.35, 0.012 * c.size), turbo: between([0.5, 3.5]), flak: between([0, 0.6]), hp: BATTLE.turretHp, alive: true, cap, battery: true };
      });
      if (i === objective) cap.subs = (SUBSYSTEMS[c.kind] ?? []).map((s, n) => ({ id: s.id, num: 3e6 + n, kind: s.kind, phase: s.phase, pos: place(cap, s.at), r: Math.max(0.6, s.r * c.size), hp: s.hp, hpMax: s.hp, dealt: 0, alive: true, cap }));
      b.capitals.push(cap);
    });
  });
}

// the capital ships where a level has them instead (a space level's own,
// galaxy/surface/missions/starfighter.js): `layout[team][i]` = { at, fwd }
// for the side's i-th ship, moved and turned there with everything on it,
// and held there (the fleet's push leaves it be)
export function placeCapitals(k, layout) {
  for (const cap of k.b.capitals) {
    const spot = layout?.[cap.team]?.[k.b.capitals.filter((c) => c.team === cap.team).indexOf(cap)];
    if (!spot) continue;
    shiftCapital(cap, v3(spot.at[0] - cap.pos.x, spot.at[1] - cap.pos.y, spot.at[2] - cap.pos.z));
    const f = norm(v3(...spot.fwd));
    const ax = cross(cap.fwd, f);
    const angle = Math.atan2(len(ax), dot(cap.fwd, f));
    if (angle > 1e-5) turnCapitalBy(cap, len(ax) > 1e-6 ? ax : cap.up, angle);
    cap.held = true;
  }
}

// ── the batteries ──
const aimAt = v3();
const tmp = v3();
export function fireBatteries(k, cap, dt) {
  const { b, rand, between } = k;
  if (!cap.alive || cap.dying > 0 || cap.disabled > 0) return;
  const enemy = 1 - cap.team;
  for (const tu of cap.turrets) {
    if (!tu.alive) continue;
    tu.turbo -= dt;
    tu.flak -= dt;
    if (tu.turbo <= 0) {
      tu.turbo = between([1.2, 2.6]);
      // (fought as a fleet, battleFleet.js: the focus, every shot meant, or the nearest; else one at random)
      const aim = k.fleet?.aim(cap, tu);
      const foes = aim ? null : b.capitals.filter((c) => c.team === enemy && c.alive && c.dying <= 0);
      if (aim || foes.length) {
        const foe = aim ? aim.foe : foes[Math.floor(rand() * foes.length)];
        const sp = foe.spheres[Math.floor(rand() * foe.spheres.length)];
        // somewhere on it, or a near miss
        const miss = !aim?.focus && rand() < 0.4 ? foe.size * 0.25 : 0;
        set(aimAt, sp.c.x + (rand() - 0.5) * (sp.r + miss), sp.c.y + (rand() - 0.5) * (sp.r + miss), sp.c.z + (rand() - 0.5) * (sp.r + miss));
        b.fire(cap.team, tu.at, set(tmp, aimAt.x - tu.at.x, aimAt.y - tu.at.y, aimAt.z - tu.at.z), 'turbo');
      }
    }
    if (tu.flak <= 0) {
      tu.flak = between([0.35, 0.7]);
      // point-defence at the nearest of the other side's fighters (or you) close by
      let near = null;
      let nd = BATTLE.flak * BATTLE.flak;
      for (const f of b.fighters) {
        if (!f.alive || f.team === cap.team) continue;
        const d = dist2(f.pos, tu.at);
        if (d < nd) {
          nd = d;
          near = f;
        }
      }
      // (you, within the difficulty's reach for you: battleDifficulty.js)
      const dy = k.youIn() && b.you.team !== cap.team ? dist2(b.you.pos, tu.at) : Infinity;
      const youNear = dy < nd && (!k.pressure || dy < k.pressure.flak * k.pressure.flak);
      const tp = youNear ? b.you.pos : near?.pos;
      if (tp) {
        const s = 0.1;
        set(tmp, tp.x - tu.at.x, tp.y - tu.at.y, tp.z - tu.at.z);
        const l = len(tmp);
        set(tmp, tmp.x / l + (rand() - 0.5) * s, tmp.y / l + (rand() - 0.5) * s, tmp.z / l + (rand() - 0.5) * s);
        b.fire(cap.team, tu.at, tmp, 'flak');
      }
    }
  }
}

// ── hit, and breaking up ──
// damage to a capital's hull (the ship with the defender's objectives takes
// none: it falls by them); `spare`: the AI's fire with the galaxy's director
// deciding the battle, which wears a hull down but never sinks it (a capital
// ship goes when the director says, the same for every pilot)
export function hullHit(cap, dmg, out, spare = false) {
  if (!cap.tracked || !cap.alive || cap.dying > 0) return;
  const d = dmg * (cap.disabled > 0 ? BATTLE.ionHull : 1);
  if (spare) {
    cap.hull = Math.max(Math.min(cap.hull, 1), cap.hull - d);
    return;
  }
  cap.hull -= d;
  if (cap.hull <= 0) {
    cap.hull = 0;
    cap.dying = cap.role === 'flagship' ? BATTLE.dying : 2.5;
    out.push({ type: 'impact', at: copy(v3(), cap.pos), size: cap.size * 0.3, shield: false });
  }
}
export function ageCapitals(k, dt, out) {
  const { b, attacker, defender } = k;
  for (const cap of b.capitals) {
    if (!cap.alive || cap.dying <= 0) continue;
    cap.dying -= dt;
    if (cap.dying > 0) continue;
    cap.dying = 0;
    cap.alive = false;
    out.push({ type: 'capital', id: cap.id, kind: cap.kind, team: cap.team, at: copy(v3(), cap.pos) });
    if (k.decides === false) continue; // (the director's battle ends when the director says)
    if (cap.objective && cap.role !== 'flagship') k.finish(attacker, cap.kind, out);
    else if (cap.role === 'flagship') k.finish(cap.team === defender ? attacker : defender, 'flagship', out);
  }
}

// ── the set pieces' hold: an ion cannon's hit, a ship wrecked, moved or turned ──
const points = (cap) => [cap.pos, ...cap.spheres.map((sp) => sp.c), ...cap.turrets.map((tu) => tu.at), ...cap.subs.map((sb) => sb.pos), ...cap.props.map((o) => o.pos)];
const rotate = (o, ax, c, sn) => {
  // Rodrigues: about the unit axis `ax`
  const d = dot(ax, o);
  const cx = ax.y * o.z - ax.z * o.y;
  const cy = ax.z * o.x - ax.x * o.z;
  const cz = ax.x * o.y - ax.y * o.x;
  return set(o, o.x * c + cx * sn + ax.x * d * (1 - c), o.y * c + cy * sn + ax.y * d * (1 - c), o.z * c + cz * sn + ax.z * d * (1 - c));
};
// a capital ship moved by `d`, and turned about `axis` by `angle`, with
// everything on it (battleFleet.js's push; holdCapitals' for the set pieces)
export function shiftCapital(cap, d) {
  for (const p of points(cap)) set(p, p.x + d.x, p.y + d.y, p.z + d.z);
  cap.moved = true;
}
export function turnCapitalBy(cap, axis, angle) {
  cap.moved = true;
  const ax = norm(copy(v3(), axis));
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  for (const dir of [cap.fwd, cap.up, cap.right]) norm(rotate(dir, ax, c, sn));
  const o = cap.pos;
  for (const p of points(cap).slice(1)) {
    set(tmp, p.x - o.x, p.y - o.y, p.z - o.z);
    rotate(tmp, ax, c, sn);
    set(p, o.x + tmp.x, o.y + tmp.y, o.z + tmp.z);
  }
}

export function holdCapitals(k) {
  const { b, pending } = k;
  // a capital ship gone (the second Death Star's superlaser, a reactor blown from inside)
  b.wreck = (id) => {
    const cap = b.capitals.find((c) => c.id === id);
    if (!cap || !cap.alive || cap.dying > 0) return;
    cap.hull = 0;
    cap.dying = cap.role === 'flagship' ? BATTLE.dying : 2.5;
    pending.push({ type: 'impact', at: copy(v3(), cap.pos), size: cap.size * 0.3, shield: false });
  };
  b.disable = (id, seconds) => {
    const cap = b.capitals.find((c) => c.id === id);
    if (!cap || !cap.alive) return;
    cap.disabled = Math.max(cap.disabled, seconds);
    pending.push({ type: 'disabled', id, at: copy(v3(), cap.pos), size: cap.size });
  };
  // (a ship a set piece moves is its own from then on: the fleet's push leaves it be, `held`)
  b.moveCapital = (cap, d) => {
    shiftCapital(cap, d);
    cap.held = true;
  };
  b.turnCapital = (cap, axis, angle) => {
    turnCapitalBy(cap, axis, angle);
    cap.held = true;
  };
}
