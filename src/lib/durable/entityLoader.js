// The world's durable things round the ship, cell by cell: which cells the
// ship is in and about (entities.js's grid, CELL = 2048 m), asked for from
// Supabase as an envelope each (get_entities_in_bounding_box), remembered,
// refreshed with `since` after STALE_MS, and let go of past the radius; a
// change that arrives by realtime, or by a neighbour's `built` hint
// (refetch(cell)), is folded in the same way. Pure of three.js: the scene
// draws from on(fn)'s events. Without a client (supabase.js's null) it is
// a loader of nothing that still answers.
// Design: docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md (Pillar 2).
//
// What goes wrong on a real visit, and what the loader does about it:
// - the network drops an ask or a place (supabase-js answers status 0, or
//   the call throws): retried after 1, 2 and 4 s, then left until an update
//   past a 4 s rest; one 'error' event a failure, never a loop a frame;
// - the database refuses an ask: an 'error', and the cell rests 1 s before
//   an update asks again;
// - the session expires mid-visit (401): one signIn, one more try;
// - the realtime channel fails (CHANNEL_ERROR, TIMED_OUT, CLOSED): it is
//   made again on the same backoff, and once it is back every held cell is
//   asked for what changed since its newest row, so nothing missed is lost.
// Damage and remove are not retried on the network: a hit sent twice is two
// hits, and a remove's answer is the only way to know it was ours.
//
// createEntityLoader({ client, planetId, radius = 1, inFlight = 4, staleMs, now, realtime = true, timers, signIn })
//   → { update(x, z), on(fn) → off, get(id), all(), place(entity) → Promise<entity | null>,
//       remove(id) → Promise<boolean>, damage(id, amount) → Promise<hp | null>, refetch(cellKey), dispose() }
// events: { type: 'add', entity }, { type: 'change', entity }, { type: 'remove', id },
//   { type: 'error', where: 'fetch' | 'place' | 'remove' | 'damage' | 'realtime', error }

import { CELL, bboxOf, cellsAround, diffCells, entityToRow, rowToEntity } from './entities.js';
import { signIn as signInAgain } from './supabase.js';

export const STALE_MS = 20000;
// the RPC's own limit: a page this full has more behind it
const PAGE = 2000;
// the waits before each retry; after the last, a rest as long before an update may try again
const BACKOFF = [1000, 2000, 4000];
const REST = BACKOFF[BACKOFF.length - 1];
// a refusal is not retried by itself, but not asked again every frame either
const COOL = BACKOFF[0];
const DOWN = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

const offline = (answer) => answer.status === 0;
const expired = (answer) => answer.status === 401;
const keyOf = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
const defaultTimers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) };

export function createEntityLoader({
  client, planetId, radius = 1, inFlight = 4, staleMs = STALE_MS, now = Date.now, realtime = true,
  timers = defaultTimers, signIn = signInAgain,
}) {
  const cells = new Map(); // key → { entities: Map<id, entity>, fetchedAt, since }
  const flying = new Set();
  const resting = new Map(); // key → timer: a cell not to be asked from an update until it fires
  const waits = new Map(); // timer → resolve, for place's backoff
  const listeners = new Set();
  let wanted = [];
  let lastCx = NaN;
  let lastCz = NaN;
  let gen = 0;
  let channel = null;
  let channelTries = 0;
  let channelTimer = null;
  let missed = false; // the channel was down: what it missed is asked for when it is back
  let signing = null;
  let disposed = false;
  const emit = (e) => listeners.forEach((fn) => fn(e));

  const find = (id) => {
    for (const [key, cell] of cells) if (cell.entities.has(id)) return [key, cell.entities.get(id)];
    return [null, null];
  };

  const fold = (row) => {
    const entity = rowToEntity(row);
    const key = keyOf(entity.x, entity.z);
    const [heldIn, had] = find(entity.id);
    // the trigger bumps version on every update, so a version no newer than
    // the one held is an echo (our own insert, then its realtime INSERT) or
    // a change that arrived out of order
    if (had && entity.version <= had.version) return;
    // moved across a cell line: held once, in the cell it is in now
    if (heldIn && heldIn !== key) cells.get(heldIn).entities.delete(entity.id);
    const cell = cells.get(key);
    if (!cell) {
      // not a cell we hold: nothing to draw it in (and gone from where it was)
      if (had) emit({ type: 'remove', id: entity.id });
      return;
    }
    cell.entities.set(entity.id, entity);
    emit({ type: had ? 'change' : 'add', entity });
  };
  const forget = (id) => {
    for (const cell of cells.values()) if (cell.entities.delete(id)) { emit({ type: 'remove', id }); return; }
  };

  // one call, as supabase-js answers it: a throw is the network failing, and
  // an expired session is signed in again (once, however many calls found
  // it expired together) and the call made once more
  async function call(make) {
    const attempt = async () => {
      try {
        return await make();
      } catch (error) {
        return { data: null, error, status: 0 };
      }
    };
    let answer = await attempt();
    if (expired(answer) && !disposed) {
      signing ??= Promise.resolve(signIn(client)).finally(() => { signing = null; });
      await signing;
      if (!disposed) answer = await attempt();
    }
    return answer;
  }

  const rest = (key, ms, then) => {
    const id = timers.set(() => {
      resting.delete(key);
      then?.();
    }, ms);
    resting.set(key, id);
  };

  async function fetchCell(key, since = null, tries = 0) {
    if (!client || disposed || flying.has(key) || resting.has(key) || flying.size >= inFlight) return;
    const myGen = gen;
    flying.add(key);
    const [cx, cz] = key.split(',').map(Number);
    const { minX, maxX, minZ, maxZ } = bboxOf(cx, cz);
    const answer = await call(() => client.rpc('get_entities_in_bounding_box', { planet_id: planetId, min_x: minX, max_x: maxX, min_z: minZ, max_z: maxZ, since }));
    flying.delete(key);
    if (myGen !== gen || !wanted.includes(key)) return; // dropped meanwhile
    const { data, error } = answer;
    if (error) {
      emit({ type: 'error', where: 'fetch', error });
      if (!offline(answer)) rest(key, COOL);
      else if (tries < BACKOFF.length) rest(key, BACKOFF[tries], () => fetchCell(key, since, tries + 1));
      else rest(key, REST);
      return;
    }
    const cell = cells.get(key) ?? { entities: new Map(), fetchedAt: 0, since: null };
    cells.set(key, cell);
    for (const row of data ?? []) fold(row);
    // rows come oldest first, so the last is where the next ask starts; a
    // full page is asked again on the next update rather than after staleMs
    cell.since = data?.length ? data[data.length - 1].updated_at : cell.since;
    cell.fetchedAt = data?.length >= PAGE ? -Infinity : now();
  }

  function subscribe() {
    if (!client || !realtime || channel || channelTimer !== null || disposed) return;
    const ch = client.channel(`entities:${planetId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'world_entities', filter: `planet_id=eq.${planetId}` }, (payload) => {
      // a DELETE carries the primary key only (no full replica identity)
      if (payload.eventType === 'DELETE') forget(payload.old.id);
      else fold(payload.new);
    });
    channel = ch;
    ch.subscribe((status) => {
      // a channel already let go of (by us, or after it failed) has nothing more to say
      if (ch !== channel || disposed) return;
      if (status === 'SUBSCRIBED') {
        channelTries = 0;
        if (missed) {
          missed = false;
          // every held cell is stale now: asked from its newest row, four at
          // once here and the rest on the updates that follow
          for (const [key, cell] of cells) {
            cell.fetchedAt = -Infinity;
            fetchCell(key, cell.since);
          }
        }
      } else if (DOWN.has(status)) {
        missed = true;
        channel = null;
        ch.unsubscribe();
        emit({ type: 'error', where: 'realtime', error: { message: status } });
        const retry = channelTries < BACKOFF.length;
        const wait = retry ? BACKOFF[channelTries++] : REST;
        if (!retry) channelTries = 0;
        channelTimer = timers.set(() => {
          channelTimer = null;
          if (retry) subscribe();
        }, wait);
      }
    });
  }

  const wait = (ms) => new Promise((resolve) => {
    const id = timers.set(() => { waits.delete(id); resolve(); }, ms);
    waits.set(id, resolve);
  });

  return {
    update(x, z) {
      if (disposed) return;
      // a frame in the same cell as the last allocates nothing: the grid and
      // the diff are only made when the ship crosses a cell line
      const cx = Math.floor(x / CELL);
      const cz = Math.floor(z / CELL);
      if (cx !== lastCx || cz !== lastCz) {
        lastCx = cx;
        lastCz = cz;
        const next = cellsAround(cx, cz, radius);
        const { gone } = diffCells(wanted, next);
        wanted = next;
        for (const key of gone) {
          const cell = cells.get(key);
          if (!cell) continue;
          for (const id of cell.entities.keys()) emit({ type: 'remove', id });
          cells.delete(key);
        }
      }
      const t = now();
      for (let i = 0; i < wanted.length; i++) {
        const key = wanted[i];
        const cell = cells.get(key);
        if (!cell) fetchCell(key);
        else if (t - cell.fetchedAt > staleMs) fetchCell(key, cell.since);
      }
      subscribe();
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get(id) { return find(id)[1]; },
    all() { return [...cells.values()].flatMap((c) => [...c.entities.values()]); },
    refetch(key) { const cell = cells.get(key); if (cell) fetchCell(key, cell.since); },
    async place(entity) {
      if (!client) return null;
      const row = entityToRow({ ...entity, planetId });
      for (let tries = 0; ; tries++) {
        const answer = await call(() => client.from('world_entities').insert(row).select().single());
        if (disposed) return null;
        if (!answer.error) {
          fold(answer.data);
          return rowToEntity(answer.data);
        }
        emit({ type: 'error', where: 'place', error: answer.error });
        // a place the network lost may have landed: the per-owner cap bounds
        // what a retry could double
        if (!offline(answer) || tries >= BACKOFF.length) return null;
        await wait(BACKOFF[tries]);
        if (disposed) return null;
      }
    },
    async remove(id) {
      if (!client) return false;
      // RLS turns a delete of someone else's row into a delete of nothing, not
      // an error: asking for the deleted ids is how the loader can tell
      const { data, error } = await call(() => client.from('world_entities').delete().eq('id', id).select('id'));
      if (error || !data?.length) {
        emit({ type: 'error', where: 'remove', error: error ?? { message: 'nothing removed: not yours, or already gone' } });
        return false;
      }
      forget(id);
      return true;
    },
    async damage(id, amount) {
      if (!client) return null;
      const { data, error } = await call(() => client.rpc('damage_entity', { entity_id: id, amount }));
      if (error) { emit({ type: 'error', where: 'damage', error }); return null; }
      if (data === 0) forget(id);
      return data;
    },
    dispose() {
      disposed = true;
      gen++;
      for (const id of resting.values()) timers.clear(id);
      resting.clear();
      for (const [id, resolve] of waits) { timers.clear(id); resolve(); }
      waits.clear();
      if (channelTimer !== null) timers.clear(channelTimer);
      channelTimer = null;
      const ch = channel;
      channel = null; // first, so the CLOSED it answers with is not taken for a failure
      ch?.unsubscribe();
      cells.clear();
      listeners.clear();
      wanted = [];
    },
  };
}
