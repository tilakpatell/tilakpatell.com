// A hand-written stand-in for the Supabase client, for the loader's tests:
// the calls the loader makes and nothing else, every one logged, and every
// answer held until the test gives it, so a test says exactly when the
// network answers and in what order. No network, no timers.
//
// fakeClient() → { rpc, from, channel, calls, pending, answer(i, reply),
//   answerAll(reply | (call) => reply), realtime(payload), insert, remove, channels }
//   rpc(name, args) → a promise held in `pending` until answer()
//   from('world_entities').insert(row).select().single() → client.insert(row)
//   from('world_entities').delete().eq('id', id).select('id') → client.remove(id)
//   channel(name).on('postgres_changes', filter, fn).subscribe(status => …); realtime(payload) calls fn,
//   channels[i].report(status) calls the status callback
// fakeTimers() → { set, clear, count, tick(ms) }; OFFLINE and EXPIRED, the two failures retried

export function fakeClient() {
  const calls = [];
  const pending = [];
  const channels = [];

  const c = {
    calls,
    pending,
    channels,
    // the scripted answers for writes, replaced by a test as it needs
    insert: (row) => ({ data: { id: 'new-1', owner: 'me', version: 1, updated_at: 't0', rot_x: 0, rot_y: 0, rot_z: 0, scale: 1, hp: 100, metadata: {}, ...row }, error: null }),
    remove: (id) => ({ data: [{ id }], error: null }),

    rpc(name, args) {
      calls.push({ name, args });
      return new Promise((resolve, reject) => pending.push({ name, args, resolve, reject }));
    },

    // gives the i-th held call its answer ({ data, error }) and lets it go
    async answer(i, reply) {
      const [call] = pending.splice(i, 1);
      if (reply instanceof Error) call.reject(reply);
      else call.resolve(reply);
      await settle();
    },

    async answerAll(reply = { data: [], error: null }) {
      const all = pending.splice(0);
      for (const call of all) call.resolve(typeof reply === 'function' ? reply(call) : reply);
      await settle();
    },

    from(table) {
      return {
        insert(row) {
          calls.push({ name: `${table}.insert`, args: row });
          return { select: () => ({ single: async () => c.insert(row) }) };
        },
        delete() {
          return {
            eq(col, id) {
              calls.push({ name: `${table}.delete`, args: { [col]: id } });
              return { select: async () => c.remove(id) };
            },
          };
        },
      };
    },

    channel(name) {
      const ch = { name, handler: null, filter: null, subscribed: false, unsubscribed: false, onStatus: null };
      // what the server says of the channel, as supabase-js passes it to subscribe's callback
      ch.report = (status) => ch.onStatus?.(status);
      channels.push(ch);
      const api = {
        on(type, filter, fn) {
          ch.filter = { type, ...filter };
          ch.handler = fn;
          return api;
        },
        subscribe(fn) {
          ch.subscribed = true;
          ch.onStatus = fn ?? null;
          return api;
        },
        unsubscribe() {
          ch.unsubscribed = true;
          // supabase-js says CLOSED to a channel left on purpose too
          ch.onStatus?.('CLOSED');
        },
      };
      return api;
    },

    // a change as Realtime delivers it to every live channel
    realtime(payload) {
      for (const ch of channels) if (ch.subscribed && !ch.unsubscribed) ch.handler?.(payload);
    },
  };
  return c;
}

// lets every promise chain the answers started run to its end
export const settle = () => new Promise((r) => setTimeout(r, 0));

// the answers supabase-js gives when the network fails (status 0, no code)
// and when the session has expired (401 from PostgREST)
export const OFFLINE = { data: null, error: { message: 'FetchError: fetch failed', details: '', hint: '', code: '' }, status: 0 };
export const EXPIRED = { data: null, error: { message: 'JWT expired', code: 'PGRST301' }, status: 401 };

// timers the test moves by hand: set and clear as the loader calls them,
// tick(ms) runs what falls due in order and lets its promises settle
export function fakeTimers() {
  let t = 0;
  let next = 1;
  const due = new Map(); // id → { at, fn }
  return {
    set(fn, ms) {
      const id = next++;
      due.set(id, { at: t + ms, fn });
      return id;
    },
    clear(id) {
      due.delete(id);
    },
    get count() {
      return due.size;
    },
    async tick(ms) {
      const until = t + ms;
      for (;;) {
        const [id, first] = [...due].filter(([, d]) => d.at <= until).sort((a, b) => a[1].at - b[1].at)[0] ?? [];
        if (!first) break;
        due.delete(id);
        t = first.at;
        first.fn();
        await settle();
      }
      t = until;
      await settle();
    },
  };
}
