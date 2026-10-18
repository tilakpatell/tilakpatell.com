/* global window, document, requestAnimationFrame, KeyboardEvent */
// `--play` for scripts/inv-world-check.mjs: each episode of the Invincible
// world's season played in the browser by moving Mark, the way a player
// would, and never by telling the rules what happened (no `api.feed`): the
// driver steers him through the dev hook (`sim.yaw` and `sim.pitch` are
// where the camera looks, `sim.keys` what's held, `sim.punch` a punch),
// presses E as a key, and for the last step of episode 7 plays Think, Mark!
// through its own browser-check hook (window.__HQ__.thinkmark) and loses it.
// An episode passes when the season kept says it's done (`api.story()`).
//
// The rules' tests feed events to the rules; this is the check that the
// world sends them. Software rendering is slow, so the game's clock runs a
// few times faster (`sim.speedup`, the dev hook's), except where a step is
// judged a frame at a time (a gate's sphere, the portal at speed).

// Put the driver in the page: window.__INV_PLAY__.run(ep) → { done, best, wall, why }
export async function installPlayer(page) {
  await page.evaluate(player);
}

// One episode, start to finish; resolves with what the season kept.
export async function play(page, ep, { budget = 12 * 60 * 1000 } = {}) {
  return page.evaluate(({ ep, budget }) => window.__INV_PLAY__.run(ep, budget), { ep, budget });
}

async function player() {
  const { api, sim } = window.__INVWORLD__;
  // (the rules' own numbers, as the page has them: the dev server serves the modules)
  const Q = await import('/src/components/invincible/world/quests.js');
  const M = await import('/src/components/invincible/world/missions.js');
  const O = await import('/src/components/invincible/world/orbit.js');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const len = (v) => Math.hypot(v[0], v[1], v[2]);
  const live = (e) => !['waiting', 'ko', 'down'].includes(e.state);
  const midOf = (e) => [e.p[0], e.p[1] + (e.kind === 'mauler' ? 1.3 : e.kind === 'seismic' ? 0.9 : 0), e.p[2]];
  const chest = () => [sim.h.p[0], sim.h.p[1] + 1, sim.h.p[2]];
  const inSpace = () => sim.h.zone === 'space';
  const step = () => sim.mission?.step ?? -1;
  // (the clock's own invasion is the city's, not the season's: it stays away while the season's played)
  sim.invadeAt = 1e12;
  sim.invaded = true;

  // ── what's held: the keys, as the page's key handler keeps them ──
  const hold = (...ks) => {
    sim.keys.clear();
    for (const k of ks) sim.keys.add(k);
  };
  // a key pressed and let go, as the page sees one (E to talk, R for the radio)
  const press = (code, key) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true }));
  };
  const aim = (at, from = chest()) => {
    const d = sub(at, from);
    sim.yaw = Math.atan2(d[0], d[2]);
    sim.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    sim.dragAt = 1e12; // (the camera's own swing behind him stays off: he's steered)
  };

  // ── every frame, the driver's one job (a function; true once it's done),
  // and a line to the check script's log as the mission moves on ──
  let job = null;
  let seen = '';
  let said = 0;
  const t0 = performance.now();
  const frame = () => {
    const now = sim.mission ? `${sim.mission.id} step ${sim.mission.step}, ${sim.mission.count} counted` : 'no mission';
    const wall = (performance.now() - t0) / 1000;
    if (now !== seen) {
      seen = now;
      console.log(`[play] ${now} (${wall.toFixed(0)} s)`);
    }
    // (and where he is now and then, for reading a run that stalls)
    if (wall - said > 15) {
      said = wall;
      const h = sim.h;
      console.log(`[play]   ${h.zone ?? 'city'} ${h.mode} at [${h.p.map((v) => Math.round(v))}] ${Math.round(len(h.v))} m/s, keys ${[...sim.keys].join('+') || 'none'}; dad ${api.debug.dad().state} at [${api.debug.dad().p.map(Math.round)}]`);
    }
    if (job) {
      try {
        if (job.fn()) {
          const r = job.resolve;
          job = null;
          hold();
          r(true);
        } else if (performance.now() > job.until) {
          const r = job.resolve;
          job = null;
          hold();
          r(false);
        }
      } catch (e) {
        console.error(e);
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const every = (fn, ms = 240000) => new Promise((resolve) => (job = { fn, resolve, until: performance.now() + ms }));
  const until = async (f, ms = 60000) => {
    const end = performance.now() + ms;
    while (!f()) {
      if (performance.now() > end) return false;
      await sleep(100);
    }
    return true;
  };

  // One frame's steering, his feet toward `to`: flat out when it's far, a
  // cruise as it nears, then nothing held so he stops there. `pass`: he
  // flies on through rather than stopping. True once he's within `r`.
  let stuck = null;
  function steer(to, r, o = {}) {
    const h = sim.h;
    const d = sub(to, h.p);
    const dist = len(d);
    aim(to, h.p);
    if (dist <= r) {
      if (!o.pass) hold();
      return true;
    }
    if (h.mode === 'ground' || h.mode === 'perch') {
      hold('up'); // (up off it first)
      return false;
    }
    const v = len(h.v);
    // (held against a wall he can't see round, for over a second: up and over it)
    if (v < 3 && sim.keys.has('fwd') && !inSpace()) {
      stuck ??= performance.now();
      if (performance.now() - stuck > 1200) {
        hold('fwd', 'up');
        return false;
      }
    } else stuck = null;
    const [cruise, brake, margin] = inSpace() ? [500, 600, 4000] : [40, 40, 80];
    const stop = Math.max(0, v * v - cruise * cruise) / (2 * brake);
    if (!o.slow && dist > stop + margin + r) hold('fwd', 'boost');
    else if (o.pass || dist > (inSpace() ? 0 : Math.min(v, cruise) ** 2 / 110) + r * 0.6) hold('fwd');
    else hold();
    return false;
  }
  const go = (to, r, o = {}) => every(() => steer(typeof to === 'function' ? to() : to, r, o) || Boolean(o.done?.()), o.ms);
  // Across the city: the driver doesn't see the towers, so a trip of any
  // length goes over them (the tallest tops out at 360 m): straight up,
  // across at 420 m, then straight down onto the place.
  const OVER = 420;
  async function travel(to, r, o = {}) {
    const h = sim.h;
    if (!inSpace() && Math.hypot(to[0] - h.p[0], to[2] - h.p[2]) > 40) {
      if (h.p[1] < OVER - 20) await go([h.p[0], OVER, h.p[2]], 25, { ...o, pass: true });
      if (o.done?.()) return true;
      await go([to[0], OVER, to[2]], 30, o);
      if (o.done?.()) return true;
    }
    return go(to, r, o);
  }

  // a fight, a frame at a time: at the nearest one standing that `pick`
  // takes, the camera on it, punching once it's near (a lunge does the rest)
  function fight(pick, near = null) {
    const c = chest();
    const foes = sim.foes.foes.filter((e) => live(e) && pick(e) && (!near || len(sub(e.p, near.at)) < near.r));
    if (!foes.length) return false;
    const e = foes.reduce((a, b) => (len(sub(midOf(a), c)) <= len(sub(midOf(b), c)) ? a : b));
    const m = midOf(e);
    if (len(sub(m, c)) < 14) {
      aim(m);
      hold();
      sim.punch = true;
    } else steer([m[0], m[1] - 1, m[2]], 6);
    return true;
  }
  // down onto whatever's under him (C held, looking down)
  const land = () =>
    every(() => {
      if (sim.h.mode === 'ground') return true;
      sim.pitch = -1.2;
      sim.dragAt = 1e12;
      hold('down');
      return false;
    }, 60000);
  // back into the city's air from space, if he's out there
  async function home() {
    if (!inSpace()) return;
    await every(() => {
      if (!inSpace()) return true;
      steer([0, O.SPACE.RE + 3000, 0], 10);
      return false;
    }, 180000);
  }
  const start = (id) => {
    api.mission(id);
    sim.swing = null; // (the title card's swing round him: he's steered)
  };
  // Cecil's episodes are his to give, at the GDA: there first, as a player would be
  const fromCecil = async (id) => {
    const door = M.placeOf('gda').door;
    await travel([door[0], 6, door[2] + 10], 10);
    start(id);
  };

  // ── the season, an episode at a time ──
  const EPISODES = {
    // Dad's ten rings, in order: up to each along the way it faces, then through it
    async ep1() {
      start('ep1');
      for (let i = 0; i < Q.RINGS.length; i++) {
        const R = Q.RINGS[i];
        const before = add(add(R.p, R.n, -22), [0, -1, 0]);
        const after = add(add(R.p, R.n, 30), [0, -1, 0]);
        await go(before, 7, { slow: true, pass: true, done: () => step() < 0 || (sim.mission?.count ?? 0) > i });
        await go(after, 3, { slow: true, pass: true, done: () => step() < 0 || (sim.mission?.count ?? 0) > i });
        if (step() < 0) break;
      }
    },
    // the bank, a slam in front of the getaway truck, the twins down
    async ep2() {
      await fromCecil('ep2');
      await travel([50, 8, 0], 8, { done: () => step() >= 1 });
      await until(() => Boolean(sim.getaway));
      // after it, low, to a point just ahead of it; there, straight down (a
      // slam from 10 m is past the 18 m/s a slam wants), and again if it missed
      let diving = false;
      await every(() => {
        if (step() !== 1) return true;
        const g = sim.getaway;
        if (sim.h.mode === 'ground') {
          diving = false;
          hold('up');
          return false;
        }
        const lead = add(add(g.p, [Math.sin(g.yaw), 0, Math.cos(g.yaw)], 14), [0, 10, 0]);
        if (diving || len(sub(lead, sim.h.p)) < 6) {
          diving = true;
          sim.pitch = -1.55;
          sim.dragAt = 1e12;
          hold('fwd', 'boost');
        } else steer(lead, 6, { pass: true });
        return false;
      }, 300000);
      await every(() => {
        if (step() < 0) return true;
        if (!fight((e) => e.kind === 'mauler')) steer(add(sim.getaway?.p ?? sim.h.p, [0, 3, 0]), 6);
        return false;
      }, 300000);
    },
    // the school: its students caught off the roof (and set down), Doc Seismic beaten
    async ep3() {
      await fromCecil('ep3');
      await travel([-2610, 20, -380], 10, { done: () => step() >= 1 });
      await every(() => {
        if (step() < 0) return true;
        const q = sim.quests.rescue;
        if (q?.source === 'mission' && !q.carried) steer(q.p, 0.6);
        else if (q?.carried) {
          if (sim.h.mode !== 'ground') {
            sim.pitch = -1.2;
            hold('down');
          }
        } else if (!fight((e) => e.kind === 'seismic')) steer([-2610, 18, -385], 4);
        return false;
      }, 600000);
    },
    // up through the top of the sky to the Moon, by Allen; E to talk; three gates home
    async ep4() {
      await fromCecil('ep4');
      const moon = O.BODIES.find((b) => b.id === 'moon');
      const toEarth = moon.c.map((v) => -v / len(moon.c));
      await every(() => {
        if (inSpace()) return true;
        sim.pitch = 1.5;
        sim.dragAt = 1e12;
        if (sim.h.mode === 'ground') hold('up');
        else hold('fwd', 'boost');
        return false;
      }, 240000);
      sim.speedup = 1; // (a gate is a sphere judged a frame at a time)
      // well clear of the air first: a straight line from the top of the sky to the Moon dips back into it
      await go([0, O.SPACE.RE + 40000, 0], 3000, { done: () => len(sim.h.p) - O.SPACE.RE > 35000 || !inSpace() });
      // down on the Moon just under where Allen waits
      const under = add(moon.c, toEarth, moon.r - 50);
      await every(() => {
        if (sim.h.mode === 'perch') return true;
        steer(under, 1);
        return false;
      }, 240000);
      await until(() => sim.talking?.id === 'allen', 20000);
      press('KeyE', 'e');
      await until(() => step() >= 2, 10000);
      const gates = M.missionOf('ep4').steps[2].gates;
      for (let i = 0; i < gates.length; i++) await go(gates[i], 200, { pass: true, done: () => step() < 0 || (sim.mission?.count ?? 0) > i, ms: 180000 });
      await home();
    },
    // two waves at the portal over the river, then through it flat out
    async ep5() {
      await fromCecil('ep5');
      await travel([1000, 150, -420], 25);
      await every(() => {
        if (step() >= 2 || step() < 0) return true;
        if (!fight((e) => e.kind === 'flaxan' || e.kind === 'flaxanElite')) steer([1050, 150, -420], 6);
        return false;
      }, 600000);
      sim.speedup = 1; // (the portal's 22 m, judged a frame at a time)
      for (let tries = 0; tries < 6 && step() === 2; tries++) {
        await go([800, 150, -420], 15);
        await every(() => {
          if (step() !== 2 || sim.h.p[0] > 1350) return true;
          aim([1500, 151, -420], sim.h.p);
          hold('fwd', 'boost');
          return false;
        }, 30000);
      }
    },
    // the hangar held for ninety seconds, then every clone down
    async ep6() {
      await fromCecil('ep6');
      const door = M.placeOf('hangar').door;
      const guard = [door[0], 2, door[2] + 18];
      await travel(guard, 6);
      await every(() => {
        if (step() < 0) return true;
        if (!fight((e) => e.kind === 'mauler', step() === 0 ? { at: door, r: 90 } : null)) steer(guard, 4);
        return false;
      }, 600000);
    },
    // Dad's four points, home, and Think, Mark! (played, and lost: the last step takes either)
    async ep7() {
      // (to Dad first, as a player would be when he asks: over downtown by day)
      const dad = () => api.debug.dad().p;
      await travel(add(dad(), [0, 15, 0]), 20);
      start('ep7');
      const pts = sim.mission.spar;
      for (let i = 0; i < pts.length; i++) {
        // with him all the way (he flies through towers; the episode wants Mark
        // within 200 m): close over his head while he waits at a point, since he
        // moves on to the next only with Mark within 20 m of him (companions.js
        // DAD.sparR), and well above him while he flies
        await every(() => {
          if (step() > i || step() < 0) return true;
          const d = api.debug.dad();
          const flying = len(d.v) > 5;
          if (flying) steer(add(add(d.p, d.v, 1.2), [0, 60, 0]), 15, { pass: true });
          else steer(add(d.p, [0, 6, 0]), 3);
          return false;
        }, 240000);
      }
      const door = M.placeOf('home').door;
      await travel([door[0], 6, door[2]], 2);
      await land();
      await until(() => step() >= 5 || step() < 0, 10000);
      document.getElementById('inv-game')?.scrollIntoView();
      await until(() => Boolean(window.__HQ__?.thinkmark?.view), 120000);
      const tm = window.__HQ__.thinkmark;
      const ch = (await import('/src/components/invincible/thinkmark/rules.js')).CHAPTERS.findIndex((c) => c.id === 'omni');
      await tm.begin(ch);
      tm.setState('hurt'); // (he lets Dad hit him: the quickest way it ends)
      await until(() => ['lost', 'won'].includes(tm.state.phase), 300000);
      await until(() => step() < 0, 5000);
      document.getElementById('inv-world')?.scrollIntoView();
    },
  };

  window.__INV_PLAY__ = {
    async run(ep, budget) {
      const t0 = performance.now();
      await home();
      sim.speedup = 3;
      let why = null;
      try {
        await Promise.race([EPISODES[ep](), sleep(budget).then(() => (why = 'out of time'))]);
      } catch (e) {
        why = String(e);
      }
      job = null;
      hold();
      sim.speedup = 1;
      const story = api.story();
      const left = sim.mission ? { step: sim.mission.step, count: sim.mission.count } : null;
      return { done: story.done.includes(ep), best: story.best[ep] ?? null, wall: (performance.now() - t0) / 1000, why, left };
    },
  };
}
