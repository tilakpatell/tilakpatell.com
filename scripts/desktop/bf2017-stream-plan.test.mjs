import { describe, expect, it } from 'vitest';
import { plan, streamArgs } from './bf2017-stream-plan.mjs';

describe("the stream job (lane R2's sender, from lane W's workflow)", () => {
  it("gives the sender the README's arguments for a world, or for the game", () => {
    expect(streamArgs({})).toEqual({ args: ['--world', 'hoth', '--minutes', '15', '--name', 'desktop-lan'] });
    expect(streamArgs({ STREAM_SOURCE: 'game', STREAM_MINUTES: '20' })).toEqual({ args: ['--source', 'game', '--minutes', '20', '--name', 'desktop-game-lan'] });
    expect(streamArgs({ STREAM_WORLD: 'endor', STREAM_NAME: 'desktop-internet' }).args).toEqual(['--world', 'endor', '--minutes', '15', '--name', 'desktop-internet']);
  });

  it('refuses inputs that are not what they say', () => {
    expect(streamArgs({ STREAM_SOURCE: 'tv' }).error).toMatch(/neither site nor game/);
    expect(streamArgs({ STREAM_WORLD: 'hoth; rm -rf' }).error).toMatch(/not a world/);
    expect(streamArgs({ STREAM_MINUTES: '500' }).error).toMatch(/1 to 110/);
    expect(streamArgs({ STREAM_NAME: '../x' }).error).toMatch(/file stem/);
  });

  it('says plainly that the sender is R2’s and absent until #908 lands', () => {
    const p = plan({}, '/repo', () => false);
    expect(p.ok).toBe(false);
    expect(p.text).toMatch(/lane R2's, in PR #908/);
  });

  it('runs the sender when it is there', () => {
    const p = plan({ STREAM_WORLD: 'endor' }, '/repo', () => true);
    expect(p.ok).toBe(true);
    expect(p.args).toEqual(['--world', 'endor', '--minutes', '15', '--name', 'desktop-lan']);
    expect(p.text).toMatch(/r2\/desktop-lan\.json/);
  });
});
