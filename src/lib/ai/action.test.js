import { describe, expect, it, vi } from 'vitest';
import { REACTIONS_PRIORITY, clipAction, createActor, fromReaction, goTo } from './action';

// a fake animator: play hands back a promise the test settles
function fakeBody() {
  const plays = [];
  return {
    plays,
    play: vi.fn((name, opts) => new Promise((resolve) => plays.push({ name, opts, resolve }))),
    stop: vi.fn(),
    look: vi.fn(),
  };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createActor', () => {
  it('want starts an action whose can is null, and refuses with the reason when it is not', () => {
    const actor = createActor({ id: 'a', actions: { go: { can: () => null }, shoot: { can: () => 'no target' } } });
    expect(actor.want('shoot', {})).toBe('no target');
    expect(actor.current()).toBeNull();
    expect(actor.want('go', {})).toBe('started');
    expect(actor.current()).toBe('go');
    expect(actor.want('nothing', {})).toBe('unknown');
  });

  it('a higher priority cuts a running action and end hears cut', () => {
    const end = vi.fn();
    const actor = createActor({ id: 'a', actions: { walk: { end }, hit: { priority: 2 } } });
    actor.want('walk', {});
    expect(actor.want('hit', {})).toBe('started');
    expect(end).toHaveBeenCalledTimes(1);
    expect(end.mock.calls[0][2]).toBe('cut');
    expect(actor.current()).toBe('hit');
  });

  it('cutBy none holds against a higher priority', () => {
    const actor = createActor({ id: 'a', actions: { down: { priority: 9, cutBy: 'none' }, hit: { priority: 20 } } });
    actor.want('down', {});
    expect(actor.want('hit', {})).toBe('uncuttable');
    expect(actor.current()).toBe('down');
  });

  it('a lower priority never cuts, whatever cutBy says', () => {
    const actor = createActor({ id: 'a', actions: { hit: { priority: 2 }, walk: {} } });
    actor.want('hit', {});
    expect(actor.want('walk', {})).toBe('busy');
  });

  it('an equal priority replaces only when replaces is true', () => {
    const end = vi.fn();
    const actor = createActor({
      id: 'a',
      actions: { wave: { priority: 1, cutBy: 'higher', end }, nod: { priority: 1 }, punch: { priority: 1, replaces: true } },
    });
    actor.want('wave', {});
    expect(actor.want('nod', {})).toBe('busy');
    expect(actor.want('wave', {})).toBe('busy');
    expect(actor.want('punch', {})).toBe('started');
    expect(end.mock.calls[0][2]).toBe('replaced');
    // a punch chain restarts itself
    expect(actor.want('punch', {})).toBe('started');
  });

  it('a failed step runs recover', () => {
    const end = vi.fn();
    const actor = createActor({ id: 'a', actions: { cover: { step: () => 'failed', end, recover: 'hold' }, hold: {} } });
    actor.want('cover', {});
    const out = actor.step({}, 0.1);
    expect(end.mock.calls[0][2]).toBe('failed');
    expect(actor.current()).toBe('hold');
    expect(out).toMatchObject({ id: 'hold', phase: 'running' });
  });

  it('a done step ends the action and goes idle', () => {
    const end = vi.fn();
    const actor = createActor({ id: 'a', actions: { nod: { step: () => 'done', end } } });
    actor.want('nod', {});
    expect(actor.step({}, 0.1)).toEqual({ id: 'nod', phase: 'ending', body: null });
    expect(end.mock.calls[0][2]).toBe('done');
    expect(actor.step({}, 0.1)).toEqual({ id: null, phase: 'idle', body: null });
  });

  it('a cooldown refuses a restart until it has passed', () => {
    const actor = createActor({ id: 'a', actions: { shout: { cooldown: 1, step: () => 'done' } } });
    expect(actor.want('shout', {})).toBe('started');
    actor.step({}, 0);
    actor.step({}, 0.5);
    expect(actor.want('shout', {})).toBe('cooling');
    actor.step({}, 0.6);
    expect(actor.want('shout', {})).toBe('started');
  });

  it('a throw in start ends the action failed and does not throw out', () => {
    const trace = { note: vi.fn() };
    const actor = createActor({
      id: 'a',
      trace,
      actions: {
        bad: {
          start: () => {
            throw new Error('boom');
          },
        },
      },
    });
    expect(() => actor.want('bad', {})).not.toThrow();
    expect(actor.current()).toBeNull();
    expect(trace.note).toHaveBeenCalledTimes(1);
    expect(trace.note.mock.calls[0][0]).toBe('a');
    expect(trace.note.mock.calls[0][2]).toMatchObject({ action: 'bad', why: 'error' });
  });

  it('a throw in step ends the action failed and does not throw out', () => {
    const end = vi.fn();
    const actor = createActor({
      id: 'a',
      actions: {
        bad: {
          end,
          step: () => {
            throw new Error('boom');
          },
        },
      },
    });
    actor.want('bad', {});
    expect(() => actor.step({}, 0.1)).not.toThrow();
    expect(end.mock.calls[0][2]).toBe('failed');
    expect(actor.current()).toBeNull();
  });

  it('cut ends the running action with its why', () => {
    const end = vi.fn();
    const actor = createActor({ id: 'a', actions: { walk: { end } } });
    actor.want('walk', {});
    actor.cut('stunned');
    expect(end.mock.calls[0][2]).toBe('stunned');
    expect(actor.current()).toBeNull();
  });

  it('step returns the running action’s body', () => {
    const actor = createActor({ id: 'a', actions: { cover: { body: { base: 'crouch' } }, talk: { body: (s, ctx) => ({ action: ctx.say }) } } });
    expect(actor.step({}, 0.1).body).toBeNull();
    actor.want('cover', {});
    expect(actor.step({}, 0.1).body.base).toBe('crouch');
    actor.want('talk', {});
    expect(actor.step({ say: 'talk' }, 0.1).body).toEqual({ action: 'talk' });
  });

  it('since counts seconds in the running action', () => {
    const actor = createActor({ id: 'a', actions: { walk: {} } });
    actor.want('walk', {});
    actor.step({}, 0.25);
    actor.step({}, 0.5);
    expect(actor.since()).toBeCloseTo(0.75);
  });
});

describe('clipAction', () => {
  it('clipAction is running until its play resolves done', async () => {
    const body = fakeBody();
    const actor = createActor({ id: 'a', actions: { wave: clipAction('wave', { layer: 'upper' }) } });
    actor.want('wave', { body });
    expect(body.play).toHaveBeenCalledWith('wave', { layer: 'upper', hold: false });
    expect(actor.step({ body }, 0.1).phase).toBe('running');
    body.plays[0].resolve('done');
    await flush();
    expect(actor.step({ body }, 0.1).phase).toBe('ending');
    expect(actor.current()).toBeNull();
    expect(body.stop).not.toHaveBeenCalled();
  });

  it('cut resolves it failed', async () => {
    const body = fakeBody();
    const end = vi.fn();
    const wave = clipAction('wave');
    const actor = createActor({ id: 'a', actions: { wave: { ...wave, recover: 'idle' }, idle: { end } } });
    actor.want('wave', { body });
    body.plays[0].resolve('cut');
    await flush();
    actor.step({ body }, 0.1);
    expect(actor.current()).toBe('idle');
  });

  it('a cut or replaced clip action stops its layer', () => {
    const body = fakeBody();
    const actor = createActor({ id: 'a', actions: { wave: clipAction('wave', { layer: 'upper' }), hit: { priority: 2 } } });
    actor.want('wave', { body });
    actor.want('hit', { body });
    expect(body.stop).toHaveBeenCalledWith('upper');
  });
});

describe('goTo', () => {
  it('goTo is done within reach and failed when stuck', () => {
    const point = { x: 10, z: 0 };
    const me = { pos: { x: 0, z: 0 } };
    const actor = createActor({ id: 'a', actions: { go: goTo(point, { reach: 1, stuck: 2 }) } });
    actor.want('go', { me });
    expect(actor.step({ me }, 1).phase).toBe('running');
    expect(me.to).toBe(point);
    me.pos = { x: 9.5, z: 0 };
    expect(actor.step({ me }, 1).phase).toBe('ending');

    const stuck = { pos: { x: 0, z: 0 } };
    actor.want('go', { me: stuck });
    expect(actor.step({ me: stuck }, 1.5).phase).toBe('running');
    expect(actor.step({ me: stuck }, 1).phase).toBe('ending');
    expect(actor.current()).toBeNull();
  });

  it('a bad dt reaches the action as 0, so goTo’s stillness never goes NaN', () => {
    const seen = [];
    const actor = createActor({ id: 'a', actions: { run: { step: (st, ctx, dt) => (seen.push(dt), 'running') } } });
    actor.want('run', {});
    for (const dt of [NaN, -1, Infinity, undefined, 0.1]) actor.step({}, dt);
    expect(seen).toEqual([0, 0, 0, 0, 0.1]);

    const me = { pos: { x: 0, z: 0 } };
    const go = createActor({ id: 'g', actions: { go: goTo({ x: 10, z: 0 }, { stuck: 2 }) } });
    go.want('go', { me });
    go.step({ me }, NaN);
    go.step({ me }, NaN);
    // still counting: 1.5 s still, then 1 s more is stuck
    expect(go.step({ me }, 1.5).phase).toBe('running');
    expect(go.step({ me }, 1).phase).toBe('ending');
  });

  it('goTo fails when its target is gone', () => {
    const me = { pos: { x: 0, z: 0 } };
    const actor = createActor({ id: 'a', actions: { go: goTo(() => null) } });
    actor.want('go', { me });
    expect(actor.step({ me }, 0.1).phase).toBe('ending');
  });
});

describe('fromReaction', () => {
  it('plays the reaction’s clip, looks at its look, and clears it at the end', async () => {
    const body = fakeBody();
    const you = { x: 1, z: 2 };
    const hit = fromReaction({ clip: 'hit.chest', layer: 'upper', hold: false, look: you }, { priority: REACTIONS_PRIORITY.hit });
    expect(hit.priority).toBe(2);
    expect(hit.cutBy).toBe('higher');
    const actor = createActor({ id: 'a', actions: { hit } });
    actor.want('hit', { body });
    expect(body.play).toHaveBeenCalledWith('hit.chest', { layer: 'upper', hold: false });
    expect(body.look).toHaveBeenLastCalledWith(you);
    body.plays[0].resolve('done');
    await flush();
    actor.step({ body }, 0.1);
    expect(body.look).toHaveBeenLastCalledWith(null);
  });

  it('a down is not cut by anything', () => {
    const down = fromReaction({ clip: 'die', layer: 'full', hold: true, look: null }, { priority: REACTIONS_PRIORITY.down });
    expect(down.cutBy).toBe('none');
  });

  it('has a priority for every reaction', () => {
    expect(REACTIONS_PRIORITY).toEqual({ down: 9, caught: 5, hit: 2, gunfire: 2, fire: 1, alert: 1, win: 0, greet: 0, say: 0 });
  });
});
