// A broadcast channel for signal.js on Supabase Realtime: one channel a
// stream, every message the event 'signal'. Broadcast needs no table and no
// policy on a public channel; the stream id, drawn by crypto, is what keeps
// strangers off it (a private channel with an RLS policy on
// realtime.messages is the owner’s to add if the mode ships: the decision).
// The client is passed in, made by the caller from the environment’s URL and
// anon key; this file imports no Supabase, so it is tested with a fake.
//
// realtimeChannel(client, id, { onStatus }) → Promise<{ send, onMessage, close }>
//   resolves once subscribed; rejects on CHANNEL_ERROR or TIMED_OUT
import { channelName } from './protocol';

export function realtimeChannel(client, id, { onStatus = () => {} } = {}) {
  const fns = new Set();
  const ch = client.channel(channelName(id), { config: { broadcast: { self: false, ack: false } } });
  ch.on('broadcast', { event: 'signal' }, ({ payload }) => {
    for (const f of fns) f(payload);
  });
  const adapter = {
    send: (payload) => ch.send({ type: 'broadcast', event: 'signal', payload }),
    onMessage(f) {
      fns.add(f);
      return () => fns.delete(f);
    },
    close: () => client.removeChannel(ch),
  };
  return new Promise((resolve, reject) => {
    ch.subscribe((status, err) => {
      onStatus(status);
      if (status === 'SUBSCRIBED') resolve(adapter);
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(err ?? new Error(`realtime ${status}`));
    });
  });
}
