// The lifecycle between a brain's mode and its body: an action, a thing
// with prerequisites, a start, a run, an end, a cut and a failure. A brain
// used to write `me.mode` and a scene mapped it to a clip by hand, with no
// rule for what may interrupt what, no word for done and nothing to do on
// failure; an actor holds one running action per agent and runs them in
// one order, so a reaction (a cut with priority) sits over an action, and
// an action over a mode. Pure, no three.js: `ctx.body` is the animator's
// shape (play, stop, look), passed in by the caller.
//
//   Action: { can?(ctx) → null | why, start?(ctx) → state, step?(state, ctx, dt) → 'running' | 'done' | 'failed',
//             end?(state, ctx, why), priority = 0, cutBy = 'any' | 'higher' | 'none', replaces = false,
//             body?: { base?, clip?, action?, layer?, hold? } | (state, ctx) → that, recover?: id, cooldown = 0 }
//     end's why: 'done' | 'failed' | 'cut' | 'replaced' (or cut()'s own word); called once per start
//   createActor({ actions, id, trace = null, now = () => 0 })
//     → { want(id, ctx) → 'started' | why not, cut(why = 'cut'), step(ctx, dt) → { id, phase, body },
//         current() → id | null, since() → seconds in the running action }
//     actions: { [id]: Action }, read at each want (a scene may set a reaction's row before it wants it);
//     phase: 'idle' | 'running' | 'ending' (the step an action ended in; its body is null by then);
//     trace: { note(agent, t, record) }, `now` its clock; the actor's own clock is the sum of step dts
//     why not: 'unknown' | 'cooling' | can's word | 'uncuttable' | 'busy' | 'error'
//   clipAction(name, { layer = 'full', hold = false, priority = 0 }) → Action, done when ctx.body.play's promise says so
//   goTo(point | () → point | null, { reach = 1, stuck = 2 }) → Action: writes ctx.me.to, reads ctx.me.pos ({ x, z })
//   fromReaction(reaction, { priority = 0, cutBy }) → Action: react.js's `on`, played as a clipAction
//   REACTIONS_PRIORITY: { [event]: priority } (the spec's defaults)

import { cooldown } from './utility';

// A down holds against everything; caught (a watcher's jab) over a flinch;
// a flinch or a scare over a shot or a look; a greeting under them all.
export const REACTIONS_PRIORITY = { down: 9, caught: 5, hit: 2, gunfire: 2, fire: 1, alert: 1, win: 0, greet: 0, say: 0 };

const IDLE = Object.freeze({ id: null, phase: 'idle', body: null });

// Unity's interruption source as a word. A lower priority never cuts: a
// brain wanting its mode every frame would otherwise cut every reaction.
// An equal one replaces when the running one is cut by 'any' or the new
// one `replaces` (a punch chain restarting itself is the same rule).
function cutRule(next, nextId, old, oldId) {
  if (old.cutBy === 'none') return { refuse: 'uncuttable' };
  if (nextId === oldId) return next.replaces ? { why: 'replaced' } : { refuse: 'busy' };
  const a = next.priority ?? 0;
  const b = old.priority ?? 0;
  if (a > b) return { why: 'cut' };
  if (a < b) return { refuse: 'busy' };
  return old.cutBy !== 'higher' || next.replaces ? { why: 'replaced' } : { refuse: 'busy' };
}

export function createActor({ actions, id, trace = null, now = () => 0 } = {}) {
  let clock = 0;
  let run = null; // { id, action, state, at, ctx }
  let refused = null; // the last refusal noted, so a brain asking every frame notes it once
  let recovering = false;
  const endedAt = {};

  const note = (record) => {
    if (!trace?.note) return;
    try {
      trace.note(id, now(), record);
    } catch {
      // the trace is a window, never a reason for the actor to stop
    }
  };

  // end the running action once, whatever its end does
  function finish(why, ctx) {
    const r = run;
    run = null;
    endedAt[r.id] = clock;
    try {
      r.action.end?.(r.state, ctx ?? r.ctx, why);
    } catch (e) {
      note({ action: r.id, phase: 'ending', why: 'error', event: 'end', error: String(e?.message ?? e) });
      return;
    }
    note({ action: r.id, phase: 'ending', why, event: 'end' });
  }

  // a failure runs the action's recovery once (a recovery that fails too idles)
  function recover(action, ctx) {
    if (!action.recover || recovering) return;
    recovering = true;
    try {
      want(action.recover, ctx);
    } finally {
      recovering = false;
    }
  }

  function refuse(actionId, why) {
    if (refused?.action !== actionId || refused?.why !== why) {
      refused = { action: actionId, why };
      note({ action: actionId, phase: run ? 'running' : 'idle', why, event: 'refused' });
    }
    return why;
  }

  function want(actionId, ctx = {}) {
    const action = actions?.[actionId];
    if (!action) return refuse(actionId, 'unknown');
    if (cooldown(clock - (endedAt[actionId] ?? -Infinity), action.cooldown ?? 0) < 1) return refuse(actionId, 'cooling');
    let why = null;
    try {
      why = action.can ? action.can(ctx) : null;
    } catch {
      why = 'error';
    }
    if (why != null) return refuse(actionId, why);
    if (run) {
      const rule = cutRule(action, actionId, run.action, run.id);
      if (rule.refuse) return refuse(actionId, rule.refuse);
      finish(rule.why, ctx);
    }
    refused = null;
    let state;
    try {
      state = action.start ? action.start(ctx) : undefined;
    } catch (e) {
      // it never started, but its end still hears it failed (it may have half set up)
      endedAt[actionId] = clock;
      try {
        action.end?.(undefined, ctx, 'failed');
      } catch {
        // already failing: the error below is the one noted
      }
      note({ action: actionId, phase: 'idle', why: 'error', event: 'start', error: String(e?.message ?? e) });
      recover(action, ctx);
      return 'error';
    }
    run = { id: actionId, action, state, at: clock, ctx };
    note({ action: actionId, phase: 'running', event: 'start' });
    return 'started';
  }

  function bodyOf(r, ctx) {
    const b = r.action.body;
    if (typeof b !== 'function') return b ?? null;
    try {
      return b(r.state, ctx) ?? null;
    } catch {
      return null;
    }
  }

  return {
    want,
    cut(why = 'cut') {
      if (run) finish(why, run.ctx);
    },
    step(ctx = {}, dt = 0) {
      // one clean dt for the clock and the action alike: a NaN handed on
      // would make goTo's stillness NaN, and it would never come unstuck
      dt = Number.isFinite(dt) && dt > 0 ? dt : 0;
      clock += dt;
      if (!run) return IDLE;
      const r = run;
      r.ctx = ctx;
      let out = 'running';
      if (r.action.step) {
        try {
          out = r.action.step(r.state, ctx, dt);
        } catch (e) {
          note({ action: r.id, phase: 'running', why: 'error', event: 'step', error: String(e?.message ?? e) });
          out = 'failed';
        }
      }
      if (out === 'done' || out === 'failed') {
        finish(out, ctx);
        if (out === 'failed') recover(r.action, ctx);
        if (run) return { id: run.id, phase: 'running', body: bodyOf(run, ctx) };
        return { id: r.id, phase: 'ending', body: null };
      }
      return { id: r.id, phase: 'running', body: bodyOf(r, ctx) };
    },
    current: () => run?.id ?? null,
    since: () => (run ? clock - run.at : 0),
  };
}

// A one-shot (or a hold) on the animator: the clip is its clock. Its
// promise is read through state, so a step never waits; a body that
// doesn't play (a test, a headless world) is done at once.
export function clipAction(name, { layer = 'full', hold = false, priority = 0 } = {}) {
  return {
    priority,
    start(ctx) {
      const state = { result: null };
      const p = ctx?.body?.play ? ctx.body.play(name, { layer, hold }) : 'done';
      if (p && typeof p.then === 'function') {
        p.then(
          (r) => (state.result = r === 'done' ? 'done' : 'cut'),
          () => (state.result = 'cut'),
        );
      } else state.result = p === 'cut' ? 'cut' : 'done';
      return state;
    },
    step(state) {
      if (state.result == null) return 'running';
      return state.result === 'done' ? 'done' : 'failed';
    },
    end(state, ctx, why) {
      // a clip that played out stays as the animator left it (a down's last frame), and
      // one the animator cut is stopped already; anything else cut it here (cut, replaced, cut()'s own word)
      if (why !== 'done' && why !== 'failed') ctx?.body?.stop?.(layer);
    },
  };
}

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pointOf = (p) => {
  const q = typeof p === 'function' ? p() : p;
  return q && Number.isFinite(q.x) && Number.isFinite(q.z) ? q : null;
};

// Walk to a point (or a target that moves, as a function): done within
// `reach`, failed when it's gone or the agent hasn't moved 5 cm in `stuck` seconds.
export function goTo(point, { reach = 1, stuck = 2 } = {}) {
  return {
    start(ctx) {
      const pos = ctx?.me?.pos;
      return { last: pos ? { x: pos.x, z: pos.z } : null, still: 0, to: null };
    },
    step(state, ctx, dt) {
      const me = ctx?.me;
      const to = pointOf(point);
      if (!me || !to) return 'failed';
      me.to = to;
      state.to = to;
      const pos = me.pos;
      if (!pos) return 'running';
      if (flat(pos, to) <= reach) return 'done';
      if (!state.last || flat(pos, state.last) >= 0.05) {
        state.last = { x: pos.x, z: pos.z };
        state.still = 0;
      } else if ((state.still += dt) >= stuck) return 'failed';
      return 'running';
    },
    end(state, ctx) {
      // stop walking toward it, unless something else has set a new `to` since
      if (ctx?.me && state?.to && ctx.me.to === state.to) ctx.me.to = null;
    },
  };
}

// What react.js's `on` returns, as an action: its clip played, its head on
// its `look` while it lasts. A down (the top priority) is cut by nothing;
// every other reaction only by a higher one, so a brain's mode doesn't cut a wave.
export function fromReaction(reaction, { priority = 0, cutBy } = {}) {
  const clip = clipAction(reaction.clip, { layer: reaction.layer ?? 'full', hold: reaction.hold ?? false, priority });
  const look = reaction.look ?? null;
  return {
    ...clip,
    cutBy: cutBy ?? (priority >= REACTIONS_PRIORITY.down ? 'none' : 'higher'),
    start(ctx) {
      const state = clip.start(ctx);
      if (look) ctx?.body?.look?.(look);
      return state;
    },
    end(state, ctx, why) {
      clip.end(state, ctx, why);
      if (look) ctx?.body?.look?.(null);
    },
  };
}
