// Bob-omb Ridge's cast. Goombas wander and chase what they can see (a
// Goomba that loses Mario round a wall keeps after him a moment, goes to
// look where it last saw him, and wanders on: lib/ai/perception), and are
// squashed by a stomp. Bob-ombs light their fuse when they see Mario near
// (not through a wall) and chase him as they believe him to be for 4
// seconds before they blow; he can pick one up and throw it. King Bob-omb
// walks at Mario on the summit, turning slowly enough to be got behind;
// picked up from behind and thrown down onto the summit three times, he
// gives up a star. The Chain Chomp lunges at the end of its chain (rearing
// back first, when Mario's been near while it waited); three
// ground pounds sink its post, and free it bounds off to smash the gate
// round a star. Iron balls roll down the mountain path.

import { addDynamic, moveDynamic, raycast, removeDynamic } from '../collide';
import { belief, createSenses, sense } from '../../../../lib/ai/perception';
import { hurt } from '../physics';
import { bounce, boxTris, distTo, fall, fly, toward, walk } from './body';

const tell = (g, type, data) => g.out.push(data ? { type, ...data } : { type });
const turn = (a, target, rate) => {
  let d = target - a.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  a.yaw += Math.max(-rate, Math.min(rate, d));
};
// out of its way: a coin knocked out of it
const dropCoin = (g, a) => g.spawn({ type: 'coin', pop: true, x: a.pos.x, y: a.pos.y + 40, z: a.pos.z, vx: Math.sin(a.yaw) * 4, vz: Math.cos(a.yaw) * 4 });

// ─── Goomba ────────────────────────────────────────────────────────────────
// what a Goomba sees: Mario within 600 units and nothing in the way (a
// wall, a hill), sure of him in a moment; a couple of seconds' intuition
// after losing him, a guess that fades over a few more
const GOOMBA_SENSES = createSenses({ sight: { range: 600, cone: -1, far: 0.3 }, memory: 4, intuition: 2.5 });
const STEP = 1 / 30; // (SM64's 30 steps a second)
const eyes = (p, h) => ({ x: p.x, y: p.y + h, z: p.z });
// what it believes of Mario this step: { x, z, sure } or null
function spot(a, g, range = 600) {
  const m = g.mario.pos;
  a.me ??= { pos: { x: a.pos.x, y: a.pos.y, z: a.pos.z }, dir: null, beliefs: {}, now: 0 };
  a.me.pos.x = a.pos.x;
  a.me.pos.y = a.pos.y;
  a.me.pos.z = a.pos.z;
  const near = distTo(a, m.x, m.z) < range && Math.abs(m.y - a.pos.y) < 300;
  const clear = near && !raycast(g.world, eyes(a.pos, 40), eyes(m, 80));
  sense(GOOMBA_SENSES, a.me, { targets: clear ? [{ id: 'mario', at: { x: m.x, y: m.y, z: m.z }, vel: { x: g.mario.vel?.x ?? 0, y: 0, z: g.mario.vel?.z ?? 0 }, hostile: true }] : [] }, STEP);
  const b = belief(a.me, 'mario');
  if (!b) return null;
  const sure = b.visible || a.me.now - b.seenAt <= GOOMBA_SENSES.intuition;
  return { x: sure ? m.x : b.at.x, z: sure ? m.z : b.at.z, sure, visible: b.visible };
}
const goomba = {
  r: 60,
  h: 90,
  make(a) {
    a.state = 'wander';
  },
  step(a, g) {
    fall(a, g);
    if (!a.alive) return;
    if (a.state === 'flat') {
      if (a.t - a.since > 15) {
        a.alive = false;
        dropCoin(g, a);
      }
      return;
    }
    if (a.state === 'knocked') {
      if (fly(a, g) || a.t - a.since > 40) {
        a.alive = false;
        dropCoin(g, a);
      }
      return;
    }
    const seen = spot(a, g);
    if (a.state === 'wander') {
      if (seen?.visible) a.state = 'chase';
      if (a.t % 90 === 0) a.yaw += 1.7;
      walk(a, g, 4);
    } else if (a.state === 'chase') {
      // after him as it believes him to be; its guess reached, or the memory
      // gone (the belief fades to nothing over the memory span), it wanders on
      if (!seen || (!seen.sure && distTo(a, seen.x, seen.z) < 60)) {
        a.state = 'wander';
        return;
      }
      turn(a, toward(a, seen.x, seen.z), 0.2);
      walk(a, g, 8);
    }
  },
  touch(a, g, how) {
    if (a.state === 'flat' || a.state === 'knocked') return;
    const m = g.mario;
    if (how === 'stomp' || how === 'pound') {
      a.state = 'flat';
      a.since = a.t;
      tell(g, 'stomp', { x: a.pos.x, y: a.pos.y, z: a.pos.z });
      if (how === 'stomp') bounce(m);
      return;
    }
    if (how === 'attack') {
      a.state = 'knocked';
      a.since = a.t;
      a.yaw = m.yaw;
      a.vel = { x: Math.sin(m.yaw) * 30, y: 30, z: Math.cos(m.yaw) * 30 };
      tell(g, 'hit', { x: a.pos.x, y: a.pos.y, z: a.pos.z });
      return;
    }
    hurt(m, 1, a.pos.x, a.pos.z);
  },
};

// ─── Bob-omb ───────────────────────────────────────────────────────────────
const FUSE = 120;
const BLAST = 300;
function explode(a, g) {
  tell(g, 'explode', { x: a.pos.x, y: a.pos.y, z: a.pos.z });
  const m = g.mario;
  if (m.held === a) m.held = null;
  if (Math.hypot(m.pos.x - a.pos.x, m.pos.y - a.pos.y, m.pos.z - a.pos.z) < BLAST) hurt(m, 2, a.pos.x, a.pos.z);
  a.state = 'gone';
  a.since = a.t;
}
const bobomb = {
  r: 60,
  h: 110,
  holdable: true,
  make(a) {
    a.state = 'walk';
  },
  step(a, g) {
    const m = g.mario;
    if (a.state === 'gone') {
      // back where it started, a while later
      if (a.t - a.since > 300) {
        Object.assign(a.pos, a.home);
        a.state = 'walk';
        a.me = null; // (a new Bob-omb: it's seen nothing yet)
      }
      return;
    }
    if (a.state === 'lit' || a.state === 'held' || a.state === 'thrown') {
      a.fuse = (a.fuse ?? 0) + 1;
      if (a.fuse >= FUSE) return explode(a, g);
    }
    if (a.state === 'held') {
      if (m.held !== a) {
        a.state = 'thrown';
        a.vel = { x: 0, y: 0, z: 0 };
        return;
      }
      a.pos.x = m.pos.x + Math.sin(m.yaw) * 40;
      a.pos.y = m.pos.y + 150;
      a.pos.z = m.pos.z + Math.cos(m.yaw) * 40;
      a.yaw = m.yaw;
      return;
    }
    if (a.state === 'thrown') {
      if (fly(a, g)) explode(a, g);
      return;
    }
    fall(a, g);
    if (!a.alive) return;
    // what it believes of Mario, as a Goomba does: it lights only on seeing
    // him (not through the wall he's behind), and lit it goes after him as it
    // believes him to be, to where it last saw him once he's out of sight
    const seen = spot(a, g, 500);
    if (a.state === 'walk') {
      if (seen?.sure) {
        a.state = 'lit';
        a.fuse = 0;
        tell(g, 'fuse');
      }
      if (a.t % 120 === 0) a.yaw += 2.1;
      walk(a, g, 3);
    } else if (a.state === 'lit') {
      // the belief gone (it faded over the memory span), it walks about as
      // it did before it saw him, its fuse still burning (a lit fuse isn't
      // put out: it blows where it is)
      if (!seen) {
        if (a.t % 120 === 0) a.yaw += 2.1;
        walk(a, g, 3);
        return;
      }
      // there, and no Mario: it stands, fuse fizzing
      if (!seen.sure && distTo(a, seen.x, seen.z) < 60) return;
      turn(a, toward(a, seen.x, seen.z), 0.15);
      walk(a, g, 7);
    }
  },
  thrown(a, g) {
    a.state = 'thrown';
    a.fuse = Math.max(a.fuse ?? 0, FUSE - 45);
    void g;
  },
  touch(a, g, how) {
    if (a.state === 'gone' || a.state === 'held' || a.state === 'thrown') return;
    const m = g.mario;
    if (how === 'stomp') bounce(m);
    if (how === 'stomp' || how === 'attack' || how === 'pound') {
      a.state = 'thrown';
      a.vel = { x: Math.sin(m.yaw) * 20, y: 30, z: Math.cos(m.yaw) * 20 };
      a.fuse = Math.max(a.fuse ?? 0, FUSE - 30);
      return;
    }
    if (a.state === 'lit') explode(a, g);
  },
};

// ─── King Bob-omb ──────────────────────────────────────────────────────────
// def: { arena: { x, y, z, r } (the summit), star (its index), taunt (what he
// says when Mario reaches him, if not KING_TAUNT) }
const KING_HP = 3;
export const KING_TAUNT = 'You dare climb MY mountain? Try to throw me down, if you can get behind me!';
const onArena = (a) => {
  const ar = a.def.arena;
  return Math.abs(a.pos.y - ar.y) < 60 && Math.hypot(a.pos.x - ar.x, a.pos.z - ar.z) < ar.r;
};
const king = {
  r: 160,
  h: 300,
  holdable: true,
  heavy: true,
  make(a) {
    a.hp = KING_HP;
    a.state = 'wait';
  },
  // only from behind: Mario facing the way the king faces, at his back
  grabbable(a, g) {
    if (a.state !== 'walk') return false;
    const m = g.mario;
    const back = Math.cos(toward(a, m.pos.x, m.pos.z) - a.yaw) < -0.6;
    const same = Math.cos(m.yaw - a.yaw) > Math.cos(0.8);
    return back && same;
  },
  step(a, g) {
    const m = g.mario;
    const ar = a.def.arena;
    if (a.state === 'held') {
      if (m.held !== a) {
        a.state = 'thrown';
        a.vel = { x: 0, y: 0, z: 0 };
        return;
      }
      a.pos.x = m.pos.x + Math.sin(m.yaw) * 60;
      a.pos.y = m.pos.y + 140;
      a.pos.z = m.pos.z + Math.cos(m.yaw) * 60;
      a.yaw = m.yaw;
      return;
    }
    if (a.state === 'thrown') {
      if (!fly(a, g)) {
        if (!a.alive) {
          // off the mountain altogether: back he comes
          a.alive = true;
          a.state = 'return';
          a.since = a.t;
        }
        return;
      }
      if (onArena(a)) {
        a.hp--;
        tell(g, 'hit', { x: a.pos.x, y: a.pos.y, z: a.pos.z, boss: true, hp: a.hp });
        a.state = a.hp <= 0 ? 'defeated' : 'stunned';
      } else a.state = 'return';
      a.since = a.t;
      return;
    }
    if (a.state === 'return') {
      if (a.t - a.since > 40) {
        a.pos.x = ar.x;
        a.pos.y = ar.y;
        a.pos.z = ar.z;
        a.state = 'walk';
      }
      return;
    }
    if (a.state === 'defeated') {
      if (a.t - a.since === 60) {
        a.alive = false;
        g.spawn({ type: 'star', index: a.def.star, x: ar.x, y: ar.y + 30, z: ar.z, appear: true });
        tell(g, 'appear', { index: a.def.star });
      }
      return;
    }
    fall(a, g);
    if (a.state === 'stunned') {
      if (a.t - a.since > 45) a.state = 'walk';
      return;
    }
    if (a.state === 'wait') {
      if (distTo(a, m.pos.x, m.pos.z) < 1400 && Math.abs(m.pos.y - a.pos.y) < 300) {
        a.state = 'walk';
        tell(g, 'dialog', { title: 'King Bob-omb', text: a.def.taunt ?? KING_TAUNT });
      }
      return;
    }
    // walk: at Mario, turning slowly, and not off his summit
    turn(a, toward(a, m.pos.x, m.pos.z), 0.03);
    if (distTo(a, m.pos.x, m.pos.z) > 200) {
      const was = { x: a.pos.x, z: a.pos.z };
      walk(a, g, 4);
      if (Math.hypot(a.pos.x - ar.x, a.pos.z - ar.z) > ar.r - a.r) {
        a.pos.x = was.x;
        a.pos.z = was.z;
      }
    }
  },
  thrown(a) {
    a.state = 'thrown';
  },
  touch(a, g, how) {
    if (a.state !== 'walk') return;
    const m = g.mario;
    if (how === 'stomp') {
      bounce(m, 30);
      return;
    }
    // into his front: knocked away
    if (Math.cos(toward(a, m.pos.x, m.pos.z) - a.yaw) > -0.2) hurt(m, 2, a.pos.x, a.pos.z);
  },
};

// ─── The Chain Chomp, its post and the gate ────────────────────────────────
const CHAIN = 900;
export const CHOMP_TELL = 14; // frames it rears back before it lunges
const post = {
  r: 0,
  h: 0,
  make(a, g) {
    a.hits = 0;
    a.top = 120;
    a.collider = addDynamic(g.world, { id: `post${a.id}`, tris: boxTris(0, 0, 0, 120, a.top, 120), kinds: new Array(12).fill('rough') });
    moveDynamic(a.collider, [1, 0, 0, a.pos.x, 0, 1, 0, a.pos.y, 0, 0, 1, a.pos.z]);
  },
  check(a, g) {
    const m = g.mario;
    if (a.hits >= 3 || m.action !== 'poundland' || m.t > 1 || m.floor?.owner !== a.collider) return;
    a.hits++;
    tell(g, 'post', { hits: a.hits });
    moveDynamic(a.collider, [1, 0, 0, a.pos.x, 0, 1, 0, a.pos.y - a.hits * 35, 0, 0, 1, a.pos.z]);
    if (a.hits === 3) {
      const chomp = g.actors.find((x) => x.type === 'chomp' && x.def.post === a.def.id);
      if (chomp) {
        chomp.state = 'free';
        chomp.since = chomp.t;
        tell(g, 'free');
      }
    }
  },
};
const chomp = {
  r: 150,
  h: 200,
  make(a) {
    a.state = 'idle';
    a.next = 60;
    a.tell = 0;
  },
  step(a, g) {
    const m = g.mario;
    const p = g.actors.find((x) => x.type === 'post' && x.def.id === a.def.post);
    const px = p ? p.pos.x : a.home.x, pz = p ? p.pos.z : a.home.z;
    if (a.state === 'free') {
      // bounding off to the gate, and through it
      const gate = g.actors.find((x) => x.type === 'gate' && x.def.id === a.def.gate);
      if (gate) {
        a.yaw = toward(a, gate.pos.x, gate.pos.z);
        a.pos.x += Math.sin(a.yaw) * 24;
        a.pos.z += Math.cos(a.yaw) * 24;
        if (distTo(a, gate.pos.x, gate.pos.z) < 260) {
          gate.smash(g);
          a.state = 'gone';
          a.since = a.t;
        }
      } else a.state = 'gone';
      fall(a, g);
      return;
    }
    if (a.state === 'gone') {
      a.pos.x += Math.sin(a.yaw) * 24;
      a.pos.z += Math.cos(a.yaw) * 24;
      if (a.t - a.since > 90) a.alive = false;
      return;
    }
    fall(a, g);
    const near = Math.hypot(m.pos.x - px, m.pos.z - pz) < CHAIN + 600;
    if (a.state === 'idle') {
      if (a.grounded && a.t % 20 === 0) a.vel.y = 18;
      // the countdown to a bite; in its last moments, with Mario near, how far
      // it's reared back to go (a.tell, 0 to 1: for the drawing, which shows
      // the bite coming; the bite comes when it always did)
      a.next--;
      a.tell = near && a.next > 0 && a.next < CHOMP_TELL ? 1 - a.next / CHOMP_TELL : 0;
      if (a.next <= 0 && near) {
        a.tell = 0;
        a.state = 'lunge';
        a.since = a.t;
        a.yaw = toward(a, m.pos.x, m.pos.z);
        a.reach = distTo(a, m.pos.x, m.pos.z) + 150;
      }
    } else if (a.state === 'lunge') {
      a.pos.x += Math.sin(a.yaw) * 45;
      a.pos.z += Math.cos(a.yaw) * 45;
      a.reach -= 45;
      if (a.t - a.since > 24 || a.reach <= 0) a.state = 'back';
    } else if (a.state === 'back') {
      a.yaw = toward(a, px, pz);
      a.pos.x += Math.sin(a.yaw) * 10;
      a.pos.z += Math.cos(a.yaw) * 10;
      if (distTo(a, px, pz) < 400) {
        a.state = 'idle';
        a.next = 120;
      }
    }
    // the chain holds it
    const d = Math.hypot(a.pos.x - px, a.pos.z - pz);
    if (d > CHAIN) {
      a.pos.x = px + ((a.pos.x - px) / d) * CHAIN;
      a.pos.z = pz + ((a.pos.z - pz) / d) * CHAIN;
    }
  },
  // its bite hurts; at rest it's only a great iron ball to bump into
  touch(a, g) {
    if (a.state === 'free' || a.state === 'gone') return;
    const m = g.mario;
    if (a.state === 'lunge') {
      hurt(m, 2, a.pos.x, a.pos.z);
      return;
    }
    const dx = m.pos.x - a.pos.x, dz = m.pos.z - a.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const need = a.r + 40;
    if (d < need) {
      m.pos.x = a.pos.x + (dx / d) * need;
      m.pos.z = a.pos.z + (dz / d) * need;
    }
  },
};
// a cage of bars round a star: solid until the Chomp smashes it
const GATE = { w: 520, h: 420, bar: 40 };
const gate = {
  r: 0,
  h: 0,
  make(a, g) {
    const { w, h, bar } = GATE;
    const { x, y, z } = a.pos;
    const tris = [
      ...boxTris(x, y, z - w / 2, w, h, bar),
      ...boxTris(x, y, z + w / 2, w, h, bar),
      ...boxTris(x - w / 2, y, z, bar, h, w),
      ...boxTris(x + w / 2, y, z, bar, h, w),
      ...boxTris(x, y + h, z, w + bar, bar, w + bar),
    ];
    a.collider = addDynamic(g.world, { id: `gate${a.id}`, tris, kinds: new Array(tris.length / 9).fill('default') });
    if (a.def.star != null) g.spawn({ type: 'star', index: a.def.star, x, y, z });
    a.smash = (gg) => {
      removeDynamic(gg.world, a.collider);
      a.alive = false;
      tell(gg, 'smash', { x, y, z });
    };
  },
  check() {},
};

// ─── Iron balls ────────────────────────────────────────────────────────────
// def: { path: [[x, y, z]…] top to bottom, every (frames), speed }
const ballspawner = {
  r: 0,
  h: 0,
  check(a, g) {
    if ((a.t - 1) % (a.def.every ?? 180) === 0) {
      const [x, y, z] = a.def.path[0];
      g.spawn({ type: 'ironball', path: a.def.path, speed: a.def.speed ?? 20, x, y, z });
    }
  },
  step() {},
};
const ironball = {
  r: 130,
  h: 260,
  make(a) {
    a.leg = 0;
  },
  step(a) {
    const path = a.def.path;
    let left = a.def.speed;
    while (left > 0 && a.leg < path.length - 1) {
      const [bx, by, bz] = path[a.leg + 1];
      const dx = bx - a.pos.x, dy = by - a.pos.y, dz = bz - a.pos.z;
      const d = Math.hypot(dx, dy, dz);
      if (d <= left) {
        a.pos.x = bx;
        a.pos.y = by;
        a.pos.z = bz;
        a.leg++;
        left -= d;
      } else {
        a.pos.x += (dx / d) * left;
        a.pos.y += (dy / d) * left;
        a.pos.z += (dz / d) * left;
        a.yaw = Math.atan2(dx, dz);
        left = 0;
      }
    }
    a.roll = (a.roll ?? 0) + a.def.speed / a.r;
    if (a.leg >= path.length - 1) a.alive = false;
  },
  touch(a, g) {
    hurt(g.mario, 2, a.pos.x, a.pos.z);
  },
};

export const FOES = { goomba, bobomb, king, post, chomp, gate, ballspawner, ironball };
