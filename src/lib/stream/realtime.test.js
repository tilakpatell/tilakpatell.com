import { describe, expect, it } from 'vitest';
import { realtimeChannel } from './realtime';

function fakeClient(status = 'SUBSCRIBED') {
  const c = { channels: [], removed: [] };
  c.channel = (name, opts) => {
    const ch = { name, opts, handlers: [], sent: [] };
    ch.on = (type, filter, fn) => {
      ch.handlers.push({ type, filter, fn });
      return ch;
    };
    ch.send = async (m) => ch.sent.push(m);
    ch.subscribe = (cb) => {
      cb(status);
      return ch;
    };
    c.channels.push(ch);
    return ch;
  };
  c.removeChannel = async (ch) => c.removed.push(ch);
  return c;
}

describe('the realtime channel', () => {
  it('joins one public broadcast channel a stream and passes signals through', async () => {
    const client = fakeClient();
    const ch = await realtimeChannel(client, 'abcd1234');
    const raw = client.channels[0];
    expect(raw.name).toBe('stream:abcd1234');
    expect(raw.opts.config.broadcast.self).toBe(false);
    const got = [];
    const off = ch.onMessage((m) => got.push(m));
    raw.handlers[0].fn({ payload: { kind: 'hello' } });
    off();
    raw.handlers[0].fn({ payload: { kind: 'late' } });
    expect(got).toEqual([{ kind: 'hello' }]);
    await ch.send({ kind: 'offer' });
    expect(raw.sent).toEqual([{ type: 'broadcast', event: 'signal', payload: { kind: 'offer' } }]);
    await ch.close();
    expect(client.removed).toEqual([raw]);
  });

  it('fails when the channel does, and on a bad id', async () => {
    await expect(realtimeChannel(fakeClient('CHANNEL_ERROR'), 'abcd1234')).rejects.toThrow();
    expect(() => realtimeChannel(fakeClient(), 'no spaces')).toThrow();
  });
});
