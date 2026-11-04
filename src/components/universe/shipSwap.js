// The flare of the bloom a ship's own model comes in under, over the
// stand-in that stood in for it (scene.js's setShip): only where the
// stand-in was on screen a while (seen, SEEN_MS or more), and softer than a
// heavy round's kick; none under the cockpit or the intro (`covered`: their
// white waits for the model, lib/shipReady), behind the Hangar or the
// shipyard (`frozen`), or with reduced motion. Pure.
//
// swapFlare({ shown, seenMs, reduced, covered, frozen }) → the flare (0: none)

export const SEEN_MS = 300;
export const SWAP_FLARE = 1.2;

export const swapFlare = ({ shown, seenMs, reduced, covered, frozen }) => (shown && seenMs >= SEEN_MS && !reduced && !covered && !frozen ? SWAP_FLARE : 0);
