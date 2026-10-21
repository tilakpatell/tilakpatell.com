import { HOUSES } from '../rules/sorting';
import { inchesSaid } from '../rules/wand';
import './cards.css';

// The wand on the HUD (the design’s §4.5): at the Sorting a card that says
// it as a wandmaker would (“Hawthorn, dragon heartstring, eleven and
// three-quarter inches. Quite springy.”), then a short chip by the menu for
// the rest of the visit: the wood, the core and the length. `wand`:
// wandFor()’s; `size`: 'full' | 'chip'.
export default function WandCard({ wand, size = 'chip' }) {
  if (!wand) return null;
  if (size === 'full')
    return (
      <section className="hp-card hp-wand" aria-live="polite">
        <p className="hp-card-eyebrow">Your wand</p>
        <p className="hp-wand-said">{wand.said}</p>
      </section>
    );
  const whole = Math.floor(wand.inches);
  const part = ['', '¼', '½', '¾'][Math.round((wand.inches - whole) * 4)];
  return (
    <p className="hp-wand-chip" aria-label={`Your wand: ${wand.wood}, ${wand.core}, ${inchesSaid(wand.inches)}`}>
      <span>{wand.wood}</span>
      <span aria-hidden="true"> · </span>
      <span>{wand.core}</span>
      <span aria-hidden="true"> · </span>
      <span>
        {whole}
        {part} in
      </span>
    </p>
  );
}

// The house scarf in the HUD’s corner once sorted: its two colours in
// stripes, knitted (a little uneven at the fringe), hung from the corner.
export function Scarf({ house }) {
  const h = HOUSES[house];
  if (!h) return null;
  return (
    <div className="hp-scarf" data-house={house} role="img" aria-label={`A ${h.name} scarf`}>
      <span className="hp-scarf-knit" />
      <span className="hp-scarf-fringe" />
    </div>
  );
}
