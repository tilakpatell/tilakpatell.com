import { describe, expect, it, vi } from 'vitest';
import { STALE_MS, createEntityLoader } from './entityLoader';
import { bboxOf, cellsAround } from './entities';
import { EXPIRED, OFFLINE, fakeClient, fakeTimers, settle } from './fixtures/fakeClient';

// cellsAround as it is, watched: update() must not ask for it every frame
vi.mock('./entities', async (load) => {
  const real = await load();
  return { ...real, cellsAround: vi.fn(real.cellsAround) };
});

// a row as the table sends it
let n = 0;
const row = (x, z, extra = {}) => ({
  id: `e${++n}`, planet_id: 'hoth', entity_type: 'turret', owner: 'o', x, y: 0, z,
  rot_x: 0, rot_y: 0, rot_z: 0, scale: 1, hp: 100, metadata: {}, version: 1, updated_at: `t${n}`, ...extra,
});
const cellOfCall = (call) => `${call.args.min_x / 2048},${call.args.min_z / 2048}`;

function setup(opts = {}) {
  const client = 'client' in opts ? opts.client : fakeClient();
  const clock = { t: 0 };
  const timers = fakeTimers();
  const signIn = vi.fn(async () => 'me');
  const loader = createEntityLoader({ client, planetId: 'hoth', now: () => clock.t, timers, signIn, ...opts });
  const events = [];
  loader.on((e) => events.push(e));
  return { client, clock, loader, events, timers, signIn };
}
const rpcs = (client) => client.calls.filter((c) => c.name === 'get_entities_in_bounding_box');

describe('the entity loader', () => {
  it('asks for the ship’s own cell first, one envelope a cell, four at once', () => {
    const { client, loader } = setup();
    loader.update(100, 100);
    expect(client.pending).toHaveLength(4);
    const [first] = client.pending;
    const { minX, maxX, minZ, maxZ } = bboxOf(0, 0);
    expect(first.args).toEqual({ planet_id: 'hoth', min_x: minX, max_x: maxX, min_z: minZ, max_z: maxZ, since: null });
    expect(STALE_MS).toBe(20000);
  });

  it('adds each row once, and asks the next cells on the next update', async () => {
    const { client, loader, events } = setup();
    loader.update(0, 0);
    const a = row(10, 10);
    const b = row(20, 20);
    await client.answer(0, { data: [a, b], error: null });
    await client.answerAll();
    expect(events.map((e) => [e.type, e.entity.id])).toEqual([['add', a.id], ['add', b.id]]);
    loader.update(0, 0);
    expect(client.pending).toHaveLength(4);
    const asked = rpcs(client).map(cellOfCall);
    expect(new Set(asked).size).toBe(8); // no cell asked twice
    await client.answerAll();
    loader.update(0, 0);
    expect(new Set(rpcs(client).map(cellOfCall)).size).toBe(9);
    expect(loader.all().map((e) => e.id)).toEqual([a.id, b.id]);
    expect(loader.get(a.id).x).toBe(10);
  });

  it('asks a held cell again after STALE_MS, for what changed since its newest row', async () => {
    const { client, clock, loader } = setup();
    loader.update(0, 0);
    const last = row(5, 5);
    await client.answer(0, { data: [row(1, 1), last], error: null });
    await client.answerAll();
    loader.update(0, 0);
    await client.answerAll();
    loader.update(0, 0);
    await client.answerAll();
    const before = rpcs(client).length;
    clock.t = STALE_MS - 1;
    loader.update(0, 0);
    expect(rpcs(client).length).toBe(before);
    clock.t = STALE_MS + 1;
    loader.update(0, 0);
    expect(client.pending[0].args).toMatchObject({ min_x: 0, min_z: 0, since: last.updated_at });
  });

  it('asks a full page again on the next update, not after STALE_MS', async () => {
    const { client, loader } = setup({ radius: 0 });
    loader.update(0, 0);
    const page = Array.from({ length: 2000 }, (_, i) => row(i % 2000, 1));
    await client.answer(0, { data: page, error: null });
    loader.update(0, 0);
    expect(client.pending[0].args.since).toBe(page[1999].updated_at);
  });

  it('lets go of the cells left behind and asks for the new ones afresh', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    const a = row(100, 100);
    await client.answer(0, { data: [a], error: null });
    loader.update(2 * 2048 + 1, 0);
    expect(events.at(-1)).toEqual({ type: 'remove', id: a.id });
    expect(cellOfCall(client.pending[0])).toBe('2,0');
    await client.answerAll();
    loader.update(0, 0); // back: asked from nothing, not from a remembered map
    expect(client.pending[0].args).toMatchObject({ min_x: 0, min_z: 0, since: null });
    await client.answer(0, { data: [a], error: null });
    expect(events.at(-1)).toMatchObject({ type: 'add', entity: { id: a.id } });
  });

  it('drops an answer for a cell left while it was asked', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    loader.update(5 * 2048, 0);
    await client.answer(0, { data: [row(1, 1)], error: null });
    expect(events).toEqual([]);
  });

  it('on a refused ask, says so once and asks again on an update a second later, not every frame', async () => {
    const { client, loader, events, timers } = setup({ radius: 0 });
    loader.update(0, 0);
    const refused = { message: 'envelope too large or inverted', code: '23514' };
    await client.answer(0, { data: null, error: refused, status: 400 });
    expect(events).toEqual([{ type: 'error', where: 'fetch', error: refused }]);
    loader.update(0, 0);
    expect(client.pending).toHaveLength(0); // cooling: a refusal is not asked again each frame
    await timers.tick(1000);
    expect(client.pending).toHaveLength(0); // nor by itself: a refusal is not the network's
    loader.update(0, 0);
    expect(client.pending).toHaveLength(1);
  });

  it('retries a network failure after 1, 2 and 4 seconds, then waits for an update', async () => {
    const { client, loader, events, timers } = setup({ radius: 0 });
    loader.update(0, 0);
    await client.answer(0, OFFLINE);
    for (const ms of [1000, 2000, 4000]) {
      loader.update(0, 0);
      expect(client.pending).toHaveLength(0); // the retry is the timer's, not the frame's
      await timers.tick(ms - 1);
      expect(client.pending).toHaveLength(0);
      await timers.tick(1);
      expect(client.pending).toHaveLength(1);
      await client.answer(0, OFFLINE);
    }
    expect(events.filter((e) => e.type === 'error')).toHaveLength(4); // one a failure
    await timers.tick(60000);
    expect(client.pending).toHaveLength(0); // given up
    loader.update(0, 0);
    expect(client.pending).toHaveLength(1); // until the next update
    await client.answer(0, { data: [row(1, 1)], error: null });
    expect(events.at(-1)).toMatchObject({ type: 'add' });
  });

  it('treats a thrown call as the network failing, and frees its slot', async () => {
    const { client, loader, events, timers } = setup({ radius: 0 });
    loader.update(0, 0);
    await client.answer(0, new Error('network down'));
    expect(events).toMatchObject([{ type: 'error', where: 'fetch' }]);
    await timers.tick(1000);
    expect(client.pending).toHaveLength(1);
  });

  it('signs in again once when the session has expired, and asks once more', async () => {
    const { client, loader, events, signIn } = setup({ radius: 0 });
    loader.update(0, 0);
    await client.answer(0, EXPIRED);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledWith(client);
    expect(client.pending).toHaveLength(1);
    const a = row(1, 1);
    await client.answer(0, { data: [a], error: null });
    expect(events).toEqual([{ type: 'add', entity: expect.objectContaining({ id: a.id }) }]);
  });

  it('says so when the session is still refused after signing in again', async () => {
    const { client, loader, events, signIn } = setup({ radius: 0 });
    loader.update(0, 0);
    await client.answer(0, EXPIRED);
    await client.answer(0, EXPIRED);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(client.pending).toHaveLength(0);
    expect(events).toEqual([{ type: 'error', where: 'fetch', error: EXPIRED.error }]);
  });

  it('asks for the grid round the ship only when the ship changes cell', () => {
    const { loader } = setup();
    cellsAround.mockClear();
    for (let i = 0; i < 100; i++) loader.update(10 + i, 20 + i); // a hundred frames in one cell
    expect(cellsAround).toHaveBeenCalledTimes(1);
    loader.update(2048 + 5, 20);
    expect(cellsAround).toHaveBeenCalledTimes(2);
  });

  it('folds realtime changes into the cells it holds and ignores the rest', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    await client.answerAll();
    expect(client.channels[0].filter).toMatchObject({ type: 'postgres_changes', table: 'world_entities', filter: 'planet_id=eq.hoth' });
    const a = row(50, 50);
    client.realtime({ eventType: 'INSERT', new: a });
    expect(events.at(-1)).toMatchObject({ type: 'add', entity: { id: a.id } });
    client.realtime({ eventType: 'UPDATE', new: { ...a, hp: 40, version: 2 } });
    expect(events.at(-1)).toMatchObject({ type: 'change', entity: { id: a.id, hp: 40 } });
    client.realtime({ eventType: 'UPDATE', new: { ...a, hp: 90, version: 1 } }); // older than held: ignored
    expect(loader.get(a.id).hp).toBe(40);
    const count = events.length;
    client.realtime({ eventType: 'UPDATE', new: row(9000, 9000) }); // a cell not held
    client.realtime({ eventType: 'INSERT', new: row(-10, 0) });
    expect(events.length).toBe(count);
    client.realtime({ eventType: 'DELETE', old: { id: a.id } });
    expect(events.at(-1)).toEqual({ type: 'remove', id: a.id });
    expect(loader.get(a.id)).toBeNull();
  });

  it('moves an entity between cells without drawing it twice', async () => {
    const { client, loader, events } = setup({ radius: 1 });
    loader.update(0, 0);
    await client.answerAll();
    loader.update(0, 0);
    await client.answerAll();
    loader.update(0, 0);
    await client.answerAll();
    const a = row(10, 10);
    client.realtime({ eventType: 'INSERT', new: a });
    client.realtime({ eventType: 'UPDATE', new: { ...a, x: 2100, version: 2 } }); // into the held cell 1,0
    expect(loader.all().filter((e) => e.id === a.id)).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: 'change', entity: { id: a.id, x: 2100 } });
    client.realtime({ eventType: 'UPDATE', new: { ...a, x: 99999, version: 3 } }); // out of every held cell
    expect(events.at(-1)).toEqual({ type: 'remove', id: a.id });
    expect(loader.get(a.id)).toBeNull();
  });

  it('refetches a held cell when told, from its newest row', async () => {
    const { client, loader } = setup({ radius: 0 });
    loader.update(0, 0);
    const a = row(1, 1);
    await client.answer(0, { data: [a], error: null });
    loader.refetch('0,0');
    expect(client.pending[0].args.since).toBe(a.updated_at);
    loader.refetch('7,7'); // not held: nothing to refresh
    expect(client.pending).toHaveLength(1);
  });

  it('places through the table and draws the row the database kept', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    await client.answerAll();
    const placed = await loader.place({ type: 'turret', x: 30, y: 2, z: 40, rot: [0, 1, 0] });
    const insert = client.calls.find((c) => c.name === 'world_entities.insert');
    expect(insert.args).toEqual({ planet_id: 'hoth', entity_type: 'turret', x: 30, y: 2, z: 40, rot_x: 0, rot_y: 1, rot_z: 0 });
    expect(placed).toMatchObject({ id: 'new-1', owner: 'me', planetId: 'hoth', x: 30 });
    expect(events.at(-1)).toMatchObject({ type: 'add', entity: { id: 'new-1' } });
  });

  it('retries a place the network lost, after 1 s, then 2 s', async () => {
    const { client, loader, events, timers } = setup({ radius: 0 });
    loader.update(0, 0);
    await client.answerAll();
    const answers = [OFFLINE, OFFLINE];
    client.insert = (row) => answers.shift() ?? { data: { id: 'p1', owner: 'me', version: 1, updated_at: 't', ...row }, error: null };
    const placing = loader.place({ type: 'beacon', x: 5, y: 0, z: 5 });
    await settle();
    expect(events).toMatchObject([{ type: 'error', where: 'place' }]);
    await timers.tick(1000);
    expect(events.filter((e) => e.type === 'error')).toHaveLength(2);
    await timers.tick(2000);
    expect(await placing).toMatchObject({ id: 'p1' });
    expect(client.calls.filter((c) => c.name === 'world_entities.insert')).toHaveLength(3);
    expect(events.at(-1)).toMatchObject({ type: 'add', entity: { id: 'p1' } });
  });

  it('gives a lost place up after three retries', async () => {
    const { client, loader, events, timers } = setup({ radius: 0 });
    client.insert = () => OFFLINE;
    const placing = loader.place({ type: 'beacon', x: 5, y: 0, z: 5 });
    await settle(); // the first try fails and sets its wait
    await timers.tick(1000);
    await timers.tick(2000);
    await timers.tick(4000);
    expect(await placing).toBeNull();
    expect(events.filter((e) => e.type === 'error')).toHaveLength(4);
    expect(timers.count).toBe(0);
  });

  it('signs in again once when a place finds the session expired', async () => {
    const { client, loader, signIn } = setup({ radius: 0 });
    const answers = [EXPIRED];
    client.insert = (row) => answers.shift() ?? { data: { id: 'p2', owner: 'me', version: 1, updated_at: 't', ...row }, error: null };
    expect(await loader.place({ type: 'beacon', x: 5, y: 0, z: 5 })).toMatchObject({ id: 'p2' });
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('draws nothing when the database refuses a place', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    await client.answerAll();
    const refused = { message: 'inside a point of interest', code: '23514' };
    client.insert = () => ({ data: null, error: refused });
    expect(await loader.place({ type: 'turret', x: 1200, y: 0, z: -800 })).toBeNull();
    expect(events).toEqual([{ type: 'error', where: 'place', error: refused }]);
    expect(loader.all()).toEqual([]);
  });

  it('removes its own, and says so when the row was not removable', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    const a = row(1, 1);
    const b = row(2, 2);
    await client.answer(0, { data: [a, b], error: null });
    expect(await loader.remove(a.id)).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'remove', id: a.id });
    client.remove = () => ({ data: [], error: null }); // RLS: someone else's row deletes nothing
    expect(await loader.remove(b.id)).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: 'error', where: 'remove' });
    expect(loader.get(b.id)).not.toBeNull();
  });

  it('removes what damage brings to nothing, and keeps what it does not', async () => {
    const { client, loader, events } = setup({ radius: 0 });
    loader.update(0, 0);
    const a = row(1, 1);
    const b = row(2, 2);
    await client.answer(0, { data: [a, b], error: null });
    const hit = loader.damage(a.id, 30);
    expect(client.pending[0].args).toEqual({ entity_id: a.id, amount: 30 });
    await client.answer(0, { data: 0, error: null });
    expect(await hit).toBe(0);
    expect(events.at(-1)).toEqual({ type: 'remove', id: a.id });
    const graze = loader.damage(b.id, 5);
    await client.answer(0, { data: 95, error: null });
    expect(await graze).toBe(95);
    expect(loader.get(b.id)).not.toBeNull();
    const refused = loader.damage(b.id, 5);
    await client.answer(0, { data: null, error: { message: 'too many hits' } });
    expect(await refused).toBeNull();
    expect(events.at(-1)).toMatchObject({ type: 'error', where: 'damage' });
  });

  it('without a client, answers everything with nothing and says nothing', async () => {
    const { loader, events } = setup({ client: null });
    loader.update(0, 0);
    loader.refetch('0,0');
    expect(await loader.place({ type: 'turret', x: 0, y: 0, z: 0 })).toBeNull();
    expect(await loader.remove('x')).toBe(false);
    expect(await loader.damage('x', 5)).toBeNull();
    expect(loader.get('x')).toBeNull();
    expect(loader.all()).toEqual([]);
    loader.dispose();
    await settle();
    expect(events).toEqual([]);
  });

  it('without realtime, opens no channel', () => {
    const { client, loader } = setup({ realtime: false });
    loader.update(0, 0);
    expect(client.channels).toEqual([]);
  });

  it('resubscribes a channel that fails, and asks every held cell for what it missed', async () => {
    const { client, loader, events, timers } = setup({ radius: 0 });
    loader.update(0, 0);
    const a = row(1, 1);
    await client.answer(0, { data: [a], error: null });
    client.channels[0].report('SUBSCRIBED');
    client.channels[0].report('CHANNEL_ERROR');
    expect(events.at(-1)).toMatchObject({ type: 'error', where: 'realtime' });
    expect(client.channels[0].unsubscribed).toBe(true);
    loader.update(0, 0);
    expect(client.channels).toHaveLength(1); // the retry is the timer's, not the frame's
    await timers.tick(1000);
    expect(client.channels).toHaveLength(2);
    client.channels[1].report('CLOSED');
    await timers.tick(2000);
    expect(client.channels).toHaveLength(3);
    expect(client.pending).toHaveLength(0);
    client.channels[2].report('SUBSCRIBED');
    expect(client.pending).toHaveLength(1);
    expect(client.pending[0].args).toMatchObject({ min_x: 0, min_z: 0, since: a.updated_at });
  });

  it('after three failed resubscriptions, waits, then subscribes again on an update', async () => {
    const { client, loader, timers } = setup({ radius: 0 });
    loader.update(0, 0);
    client.channels[0].report('TIMED_OUT');
    for (const ms of [1000, 2000, 4000]) {
      await timers.tick(ms);
      client.channels.at(-1).report('CHANNEL_ERROR');
    }
    expect(client.channels).toHaveLength(4);
    loader.update(0, 0);
    expect(client.channels).toHaveLength(4); // not every frame
    await timers.tick(4000);
    expect(client.channels).toHaveLength(4); // nor by itself
    loader.update(0, 0);
    expect(client.channels).toHaveLength(5);
  });

  it('on dispose, leaves the channel and hears no late answer', async () => {
    const { client, loader, events, timers } = setup({ radius: 0 });
    loader.update(0, 0);
    expect(client.channels).toHaveLength(1);
    loader.update(0, 0);
    expect(client.channels).toHaveLength(1); // one channel a loader
    loader.dispose();
    expect(client.channels[0].unsubscribed).toBe(true);
    expect(client.channels).toHaveLength(1); // leaving on purpose is not a failure to retry
    expect(timers.count).toBe(0);
    await client.answer(0, { data: [row(1, 1)], error: null });
    client.realtime({ eventType: 'INSERT', new: row(2, 2) });
    expect(events).toEqual([]);
    expect(loader.all()).toEqual([]);
  });
});
