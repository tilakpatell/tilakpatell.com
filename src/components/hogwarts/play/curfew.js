// The curfew, composed (Lane F, rules/curfew.js): every frame after the
// world’s 21:00, where you are on the Map’s frame against where Filch, his
// cat, the prefects and Snape are on theirs (play/night.js’s people), with
// the cloak, a lit wand and a run counted. What happens goes to the page
// and the term through `tell`: the eye opening as someone half sees you,
// Peeves’s line, Filch hurrying to a noise, and caught: the toast, twenty
// points off (a 'points' event, so the chip and the hourglasses have it)
// and 'caught' for the night’s quest, with `onCaught` sending you back.
//
//   createCurfew({ tell, onCaught }) → { step(dt, { hour, player, figures, house }), state(), seen }
//     player: { x, z, inside, cloak, lit, running } on the Map’s frame (inside: the room you’re in, or null)

import { newCurfew, step as stepCurfew } from '../rules/curfew';

const HEARD = 'Somewhere close, a shuffle quickens: Filch has heard something.';
const LED = 8; // s you’re in someone’s charge after being caught (the room you’re sent to loads in that time)

export function createCurfew({ tell = () => {}, onCaught = () => {} } = {}) {
  let state = newCurfew();
  let shown = 0; // the eye as the page last had it (0 shut … 1 wide), stepped so it isn’t told every frame
  let led = 0; // s of being walked back to bed: nobody catches you twice on the way

  return {
    step(dt, { hour, player, figures, house }) {
      if (led > 0) {
        led = Math.max(0, led - dt);
        return;
      }
      const r = stepCurfew(state, { hour, dt, player, figures, house });
      state = r.state;
      for (const e of r.events) {
        if (e.type === 'peeves') tell('line', { name: 'Peeves', text: e.line });
        else if (e.type === 'heard') tell('toast', { text: HEARD });
        else if (e.type === 'points') tell('points', { type: 'points', house: e.house, delta: e.delta, why: e.why });
        else if (e.type === 'caught') {
          tell('toast', { text: e.toast });
          tell('caught', { by: e.by });
          led = LED;
          onCaught(e);
        }
      }
      // (the eye: how near to caught, in quarters, and who it is that has half a look)
      const eye = Math.round(state.alert * 4) / 4;
      if (eye !== shown) {
        shown = eye;
        tell('watched', { k: eye, by: eye > 0 ? state.by : null });
      }
    },
    state: () => ({ alert: Math.round(state.alert * 100) / 100, by: state.by, hunt: Boolean(state.hunt), caught: state.caught }),
    // Filch’s place with his hurry in it, for the figures (rules/curfew.js’s filchAt)
    get filch() {
      return state.filch;
    },
  };
}
