import { Powers } from '../../runtime/hud';
import { POWERS, POWER_KEYS, picksFor } from './shipPowers';
import { POWER_ICONS as ICONS } from './powerIcons';
import './powers.css';

// The ship's two powers (shipPowers.js) on the HUD: the kit's Powers
// (runtime/hud/Powers.jsx: a tile each with its icon, its short name and
// its key, and a ring that runs down while it's on and fills as it cools
// down or the big one charges), handed each crew's cards and the mark this
// file draws for each. The scene writes the phase, the ring and the seconds
// as they change (powers.js's place); a tap or a click uses it, as G
// and X do. In the flight cluster (`placement`, on a desktop) a word under
// each says where it stands, and why a press was refused. Nothing with
// motion reduced (there's nothing to use them on then) or without a ship.
// The pair is the crew's own, or the ones picked for it in the Hangar
// (`picks`, by crew; another crew's only with the skill tree's `carry`).

const SLOTS = ['primary', 'ultimate'];

export default function PowerBar({ ship, reduced, barRef, onPress, placement = null, picks = null, carry = null }) {
  const own = picksFor(ship, picks, carry);
  if (reduced || !own) return null;
  const slots = SLOTS.map((slot) => {
    const p = POWERS[own[slot]];
    return { slot, id: own[slot], name: p.name, short: p.short, about: p.about, key: POWER_KEYS[slot].toUpperCase(), icon: ICONS[own[slot]] };
  });
  return <Powers slots={slots} barRef={barRef} onPress={onPress} placement={placement} data={{ ship }} />;
}
