import { describe, expect, it } from 'vitest';
import { lanAddresses, parseArgs, receiverPath, replayCalls, streamEnv } from './bf2017-stream.mjs';

describe('the stream sender’s plumbing', () => {
  it('reads its flags, with the desktop’s defaults and the dry run’s', () => {
    expect(parseArgs([])).toMatchObject({ world: 'hoth', minutes: 30, dry: false, angle: 'd3d11', width: 1920, height: 1080, fps: 60, mbps: 25 });
    expect(parseArgs(['--dry', '--seconds', '45', '--size', '1280x720', '--world', 'endor'])).toMatchObject({ dry: true, seconds: 45, width: 1280, height: 720, world: 'endor', angle: 'swiftshader' });
    expect(() => parseArgs(['--size', 'big'])).toThrow();
    expect(() => parseArgs(['--world', '../etc'])).toThrow();
    expect(() => parseArgs(['--nope'])).toThrow();
  });

  it('takes the keys from the environment under either name and says which are missing', () => {
    expect(streamEnv({ SUPABASE_URL: 'u', SUPABASE_ANON_KEY: 'k' })).toEqual({ url: 'u', key: 'k' });
    expect(streamEnv({ VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({ url: 'u', key: 'k' });
    expect(() => streamEnv({ SUPABASE_URL: 'u' })).toThrow(/SUPABASE_ANON_KEY/);
  });

  it('lists the LAN’s addresses, not loopback or IPv6', () => {
    const nets = { lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }], eth: [{ family: 'IPv6', internal: false, address: 'fe80::1' }, { family: 'IPv4', internal: false, address: '192.168.1.20' }] };
    expect(lanAddresses(nets)).toEqual(['192.168.1.20']);
  });

  it('names the receiver’s route', () => {
    expect(receiverPath('abcd')).toBe('/#/stream?id=abcd');
    expect(receiverPath('abcd', 'internet')).toBe('/#/stream?id=abcd&where=internet');
  });

  it('turns the data channel’s input into real key and mouse calls', () => {
    const size = { width: 1920, height: 1080 };
    expect(replayCalls({ t: 'key', down: true, code: 'KeyW' }, size)).toEqual([['keyboard.down', 'KeyW']]);
    expect(replayCalls({ t: 'pointer', kind: 'move', x: 0.5, y: 0.25 }, size)).toEqual([['mouse.move', 960, 270]]);
    expect(replayCalls({ t: 'pointer', kind: 'down', x: 0, y: 1, button: 2 }, size)).toEqual([['mouse.move', 0, 1080], ['mouse.down', { button: 'right' }]]);
    expect(replayCalls({ t: 'pointer', kind: 'wheel', x: 0, y: 0, dy: 120 }, size).at(-1)).toEqual(['mouse.wheel', 0, 120]);
    expect(replayCalls({ t: 'ping', n: 1 }, size)).toEqual([]);
  });
});
