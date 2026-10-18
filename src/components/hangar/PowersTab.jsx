import { POWERS, POWER_ICONS, POWER_KEYS, powersOf } from '../universe/shared/hangar';

// The Hangar's Powers: the crew's two (shipPowers.js's cards), on G and on X,
// in every universe the ship flies: what each does, and how it comes back
// (the one on G cools down; the big one on X charges with what you shoot
// down). Other crews' powers are earned in the skill tree.

const SLOT_LABEL = { primary: 'Power', ultimate: 'The big one' };

export default function PowersTab({ ship }) {
  const own = powersOf(ship);
  if (!own) return null;
  return (
    <div className="hangar-page">
      <ul className="hangar-powers" data-ship={ship}>
        {['primary', 'ultimate'].map((slot) => {
          const p = POWERS[own[slot]];
          return (
            <li key={slot} className="hangar-power" data-power={own[slot]}>
              <svg className="hangar-power-icon" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {POWER_ICONS[own[slot]]}
              </svg>
              <div>
                <h3>
                  <kbd className="hud-cap">{POWER_KEYS[slot].toUpperCase()}</kbd> {SLOT_LABEL[slot]}
                </h3>
                <b>{p.name}</b>
                <p>{p.about}</p>
                <p className="hangar-note">{slot === 'primary' ? `On for ${p.dur} s, then back after ${p.cool} s.` : `On for ${p.dur} s, once your kills have charged it: five of them, or a few minutes’ flying.`}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="hangar-note">Other crews’ powers are earned in the skill tree.</p>
    </div>
  );
}
