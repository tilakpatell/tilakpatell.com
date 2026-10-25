/* global window */
// The flight's difficulty in the galaxy, in a browser (controls.js's `difficulty`, universe/difficulty.js's numbers;
// scripts/galaxy-hud-check.mjs runs it as `difficulty`): at 1440x900 an X-wing at Tatooine, flown at Outlaw, and
//   the hunters read it (their difficulty(): its label)
//   the shields, hit a minute ago and out of the respawn's safe time, come back at its rate (12 a second × the ship's
//     regen × the level's), measured over 1.5 s of the scene's own clock
//   with reduced motion (no hunters at all), the page flies with no errors
import { check } from '../galaxy-map-check/lib.mjs';
import { open, settle } from './lib.mjs';

const VIEW = { width: 1440, height: 900 };
const OUTLAW = { difficulty: 'outlaw' };

export async function difficulty() {
  const say = (ok, what) => check(ok, `difficulty: ${what}`);
  {
    const { ctx, page, errors } = await open(VIEW, { controls: OUTLAW });
    try {
      const G = (fn, arg) => page.evaluate(fn, arg);
      const label = await G(() => window.__galaxyDebug.hunters?.difficulty?.()?.label ?? null);
      say(label === 'Outlaw', `the hunters read it (${label})`);
      const shields = () => G(() => ({ shield: window.__galaxyDebug.state.shield, clock: window.__galaxyDebug.state.clock }));
      await G(() => {
        const s = window.__galaxyDebug.state;
        s.safeUntil = 1e12;
        s.shield = 40;
        s.hitAt = s.clock - 60;
      });
      const a = await shields();
      await settle(page, 1500);
      const b = await shields();
      const regen = await G(() => window.__galaxyDebug.state.stats.regen);
      const rate = (b.shield - a.shield) / (b.clock - a.clock);
      const want = 12 * regen * 0.7;
      say(Math.abs(rate - want) <= want * 0.05, `shields at its rate (${rate.toFixed(2)}, ${want.toFixed(2)} wanted)`);
      say(errors.length === 0, `no page errors${errors.length ? ` (${errors.slice(0, 3).join('; ')})` : ''}`);
    } finally {
      await ctx.close().catch(() => {});
    }
  }
  {
    const { ctx, page, errors } = await open(VIEW, { reduced: true, controls: OUTLAW });
    try {
      await settle(page, 1500);
      say(errors.length === 0, `no page errors with reduced motion${errors.length ? ` (${errors.slice(0, 3).join('; ')})` : ''}`);
    } finally {
      await ctx.close().catch(() => {});
    }
  }
}
