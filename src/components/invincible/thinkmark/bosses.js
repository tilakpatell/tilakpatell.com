// Think, Mark!: chapters three and four, a Viltrumite. Omni-Man winds up
// and charges; dodge, then punish him while he recovers; punch him at any
// other time and he blocks and hits back; from the second phase he climbs
// and dives into a shockwave; low enough, he leaves. Thragg is faster, and
// charges twice in a row. Moved from ./rules.js as it was; ./rules.js's
// step calls stepBoss and re-exports bossTell.
import { BOSSES, QUAKE, add, bound, city, clamp, clearChapter, collide, diff, dist, dot, len, lerp, next, norm, perfect, say, scale, strike, sub } from './core';

// ── chapters three and four: a Viltrumite ──
export function stepBoss(g, dt, ev) {
  const b = g.boss;
  const B = BOSSES[b.kind];
  const D = diff(g);
  const m = g.mark;
  b.t += dt;
  b.timer -= dt;
  const toMark = sub(m.p, b.p);
  const range = len(toMark);
  const face = (d) => {
    if (Math.hypot(d[0], d[2]) > 0.01) b.yaw = Math.atan2(d[0], d[2]);
  };
  // phases
  const share = b.hp / b.max;
  if (b.phase === 1 && share < 0.66) {
    b.phase = 2;
    say(ev, b.kind === 'omni' ? 'omni2' : 'thragg2');
    ev.push({ type: 'phase', n: 2 });
  } else if (b.phase === 2 && share < 0.33) {
    b.phase = 3;
    say(ev, b.kind === 'omni' ? 'omni3' : 'thragg3');
    ev.push({ type: 'phase', n: 3 });
  }
  if (!['leave', 'down'].includes(b.state) && share <= B.leaveAt + 1e-9) {
    if (b.kind === 'omni') {
      b.state = 'leave';
      say(ev, 'omniLeave');
      ev.push({ type: 'leave' });
    } else {
      b.state = 'down';
      say(ev, 'thraggDown');
      ev.push({ type: 'down', at: [...b.p] });
    }
    b.t = 0;
    b.said = false;
  }
  const move = (goal, speed, rate = 2.4) => {
    const d = sub(goal, b.p);
    const want = scale(norm(d), Math.min(speed, len(d) * 1.8));
    b.v = add(b.v, sub(want, b.v), Math.min(1, dt * rate));
  };
  const windup = B.windup * D.windup * (b.phase === 3 ? 0.82 : 1);
  switch (b.state) {
    case 'intro':
      move(add(m.p, [0, 6, -B.orbit]), 70, 1.5);
      face(toMark);
      if (b.timer <= 0) next(g, 'circle', 1.4);
      break;
    case 'circle': {
      b.orbit += dt * (0.45 + b.phase * 0.08);
      const goal = add(m.p, [Math.cos(b.orbit) * B.orbit, 4 + Math.sin(b.t * 0.7) * 3, Math.sin(b.orbit) * B.orbit]);
      move(goal, range > 90 ? 90 : B.speed * (1 + (b.phase - 1) * 0.12));
      face(toMark);
      if (b.timer <= 0 && range < 110) {
        b.attacks++;
        // the slam from the second phase (Thragg's from the first), every third attack or so
        if (b.phase >= B.slamAfter && b.attacks % 3 === 0) next(g, 'rise', 1.05);
        else next(g, 'windup', windup);
        ev.push({ type: 'windup', kind: b.state, time: b.timer });
      }
      break;
    }
    case 'windup':
      b.v = scale(b.v, Math.exp(-5 * dt));
      face(toMark);
      if (b.timer <= 0) {
        const lead = add(m.p, m.v, 0.12);
        b.dir = norm(sub(lead, b.p));
        b.from = [...b.p];
        b.go = len(sub(lead, b.p)) + 28;
        next(g, 'charge', 1.3);
        ev.push({ type: 'charge', from: [...b.p], dir: b.dir });
      }
      break;
    case 'charge': {
      const from = b.p;
      b.v = scale(b.dir, B.charge * D.charge * (b.phase === 3 ? 1.08 : 1));
      b.p = add(b.p, b.v, dt);
      face(b.dir);
      // through anything in the way (a Viltrumite doesn't go round buildings)
      const { idx } = city();
      for (const box of idx.at(b.p[0], b.p[2]))
        if (b.p[0] > box.x0 && b.p[0] < box.x1 && b.p[2] > box.z0 && b.p[2] < box.z1 && b.p[1] < box.y1 && b.through !== box) {
          b.through = box;
          ev.push({ type: 'smash', at: [...b.p], dir: b.dir });
        }
      const seg = sub(b.p, from);
      const k = clamp(dot(sub(m.p, from), seg) / Math.max(1e-9, dot(seg, seg)), 0, 1);
      const miss = dist(add(from, seg, k), m.p);
      if (!b.landed && miss < b.r + m.r + 0.5) {
        b.landed = true;
        if (strike(g, ev, { dmg: B.dmg.charge, dir: b.dir, knock: 52, by: 'charge' })) ev.push({ type: 'slugged', at: [...m.p], dir: b.dir });
      } else if (!b.landed && miss < 8 && k > 0 && k < 1) perfect(g, ev, 'charge');
      if (dist(b.p, b.from) > b.go || b.timer <= 0) {
        b.landed = false;
        b.through = null;
        // Thragg comes straight back, once
        if (B.double && !b.doubled) {
          b.doubled = true;
          next(g, 'windup', windup * 0.45);
          ev.push({ type: 'windup', kind: 'windup', time: b.timer });
        } else {
          b.doubled = false;
          next(g, 'recover', B.recover * (b.perfect ? 1.8 : 1));
          ev.push({ type: 'open', perfect: !!b.perfect });
          b.perfect = false;
        }
      }
      return; // (moved already)
    }
    case 'rise':
      move(add(m.p, [0, 30, 0]), 70, 4);
      face(toMark);
      if (b.timer <= 0) {
        b.from = [...b.p];
        b.aim = [...m.p];
        b.dir = norm(sub(b.aim, b.p));
        next(g, 'dive', 1);
        ev.push({ type: 'dive', from: [...b.p], to: [...b.aim] });
      }
      break;
    case 'dive':
      b.v = scale(b.dir, 125);
      face(b.dir);
      if (dist(b.p, b.aim) < 3 || dot(sub(b.aim, b.p), b.dir) < 0 || b.timer <= 0) {
        b.p = [...b.aim];
        b.v = [0, 0, 0];
        g.quake = { p: [...b.aim], t: 0, hit: false };
        ev.push({ type: 'quake', at: [...b.aim] });
        next(g, 'recover', B.recover * 1.15);
      }
      break;
    case 'recover':
      b.v = scale(b.v, Math.exp(-3 * dt));
      if (b.timer <= 0) {
        next(g, 'circle', lerp(1.2, 2.4, g.rand()) / (1 + (b.phase - 1) * 0.25));
        b.hits = 0;
      }
      break;
    case 'stagger':
      b.v = scale(b.v, Math.exp(-2.2 * dt));
      if (b.timer <= 0) {
        next(g, 'circle', 1);
        b.hits = 0;
      }
      break;
    case 'leave':
      // up and away: over the city and gone
      b.v = add(b.v, sub([b.v[0] * 0.2, 120, b.v[2] * 0.2], b.v), Math.min(1, dt * (b.t > 3 ? 1.5 : 0.3)));
      if (b.t > 3.2 && !b.said) {
        b.said = true;
        say(ev, 'omniLeave2');
      }
      if (b.t > 6.5 && g.phase === 'play') clearChapter(g, ev);
      break;
    case 'down':
      b.v[1] -= 20 * dt;
      if (b.t > 3.5 && g.phase === 'play') clearChapter(g, ev);
      break;
    default:
  }
  b.p = add(b.p, b.v, dt);
  if (!['leave', 'down', 'charge', 'dive'].includes(b.state)) collide(b.p, b.v, b.r);
  if (b.state !== 'leave') bound(b.p, b.v, b.r);
  // the shockwave from a dive, spreading
  const q = g.quake;
  if (q) {
    q.t += dt;
    const r = (q.t / QUAKE.time) * QUAKE.r;
    const off = Math.abs(dist(m.p, q.p) - r);
    if (!q.hit && off < QUAKE.band) {
      q.hit = true;
      strike(g, ev, { dmg: B.dmg.slam, dir: add(norm(sub(m.p, q.p)), [0, 0.4, 0]), knock: 34, by: 'quake' });
    } else if (!q.hit && off < QUAKE.band + 5) perfect(g, ev, 'quake');
    if (q.t > QUAKE.time) g.quake = null;
  }
}

// (0..1), and whether he can be hit.
export function bossTell(b) {
  if (!b) return null;
  return { state: b.state, open: b.state === 'recover' || b.state === 'stagger', windup: b.state === 'windup' ? clamp(b.t / (b.t + Math.max(0, b.timer)), 0, 1) : b.state === 'rise' ? clamp(b.t / (b.t + Math.max(0, b.timer)), 0, 1) : 0 };
}

