import { POWERS, POWER_ICONS, POWER_KEYS, picksFor, powersOf } from '../universe/shared/hangar';
import { useSkills } from './skills/useSkills';
import { choicesOf, lengthsOf } from './powersTabRules';

// The Hangar's Powers: the two this ship carries (shipPowers.js's cards), on
// G and on X, in every universe the ship flies: what each does, and how it
// comes back (the one on G cools down; the big one on X charges with what you
// shoot down), with the skill tree's on its lengths. Under each, the powers
// it may carry in that slot: its crew's own, and another crew's once the
// skill tree's last Powers row lends that crew's pair (a locked one names
// the node). A pick is kept at once and flies with the ship.

const SLOT_LABEL = { primary: 'Power', ultimate: 'The big one' };

export default function PowersTab({ ship }) {
  const { fx, picks, pick } = useSkills();
  const now = picksFor(ship, picks, fx.carry);
  if (!powersOf(ship) || !now) return null;
  return (
    <div className="hangar-page">
      <ul className="hangar-powers" data-ship={ship}>
        {['primary', 'ultimate'].map((slot) => {
          const id = now[slot];
          const p = POWERS[id];
          const { dur, cool } = lengthsOf(id, fx);
          return (
            <li key={slot} className="hangar-power" data-power={id}>
              <svg className="hangar-power-icon" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {POWER_ICONS[id]}
              </svg>
              <div>
                <h3>
                  <kbd className="hud-cap">{POWER_KEYS[slot].toUpperCase()}</kbd> {SLOT_LABEL[slot]}
                </h3>
                <b>{p.name}</b>
                <p>{p.about}</p>
                <p className="hangar-note">{slot === 'primary' ? `On for ${dur} s, then back after ${cool} s.` : `On for ${dur} s, once your kills have charged it: five of them, or a few minutes’ flying.`}</p>
                <div className="hangar-chips hangar-power-picks" role="group" aria-label={`${SLOT_LABEL[slot]}: what this ship carries`}>
                  {choicesOf(ship, slot, fx.carry).map((c) => (
                    <button key={c.id} type="button" aria-pressed={c.id === id} disabled={c.locked} title={c.locked ? `Opens with ${c.opens}, in Skills` : POWERS[c.id].about} onClick={() => pick(ship, slot, c.own ? null : c.id)}>
                      {POWERS[c.id].name}
                      {c.locked && <span className="hangar-lock"> · {c.opens}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="hangar-note">Another crew’s pair is lent by the last row of the skill tree’s Powers branch.</p>
    </div>
  );
}
