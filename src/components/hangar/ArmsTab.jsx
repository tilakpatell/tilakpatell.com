import { useMemo } from 'react';
import { STOCK_LOADOUT } from '../universe/shared/hangar';
import { LINE_SLOT, handGuns, shipLines } from './armsTabRules';
import { cardOf, crewOf, gunOf } from './crewTabRules';
import { useCrewStyle } from './useCrewStyle';

// The Hangar's Arms: what the ship fights with and what the crew carry.
// The ship's three lines as they're fitted (fired with F, changed with R or
// 1 2 3), each with what it does, and the way to the shipyard's slot that
// changes it (ship guns are bought and fitted there, and only there). Then
// each of the crew's gun in the hand on the galaxy's worlds and the planets
// (a Jedi's is his blade, the Crew's; Artoo carries nothing), picked here and
// kept in the crew's style (tp-crew).

const LINE_LABEL = { primary: 'Primary', secondary: 'Secondary', ordnance: 'Ordnance' };
const per = (n) => (n >= 10 ? Math.round(n) : n.toFixed(1));

export default function ArmsTab({ ship, loadout, onShipyard }) {
  const lines = useMemo(() => shipLines(ship, loadout ?? STOCK_LOADOUT), [ship, loadout]);
  const [crew, setStyle] = useCrewStyle();
  return (
    <div className="hangar-page">
      <section aria-label="The ship’s guns">
        <h3>The ship’s guns</h3>
        <ul className="hangar-lines">
          {lines.map((l, i) => (
            <li key={l.line} data-line={l.line}>
              <span className="hangar-line-key">
                <kbd className="hud-cap">{i + 1}</kbd> {LINE_LABEL[l.line]}
              </span>
              <b className="hangar-line-name">{l.name}</b>
              <span className="hangar-line-does">
                {l.damage} a hit{l.shots > 1 ? ` × ${l.shots}` : ''} · {per(l.rate)} a second{l.rack ? ` · a rack of ${l.rack.ammo}, one back every ${l.rack.reload} s` : ''}
              </span>
              <button type="button" onClick={() => onShipyard(LINE_SLOT[l.line])}>
                Change in the Shipyard
              </button>
            </li>
          ))}
        </ul>
      </section>
      {crewOf(ship).map((who) => {
        const guns = handGuns(who);
        const name = cardOf(who).name;
        const picked = gunOf(who, crew[who]);
        return (
          <section key={who} aria-label={`${name}’s gun`}>
            <h3>{name}’s gun</h3>
            {guns.length ? (
              <div className="hangar-chips" role="group" aria-label={`${name}’s gun`}>
                {guns.map((g) => (
                  <button key={g.id} type="button" aria-pressed={picked === g.id} title={`${g.about} ${g.damage} a hit, ${per(g.rate)} a second, ${g.range} m.`} onClick={() => setStyle(who, { gun: g.id })}>
                    {g.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="hangar-note">{who === 'artoo' ? 'Artoo carries nothing but a shock prod, and opinions.' : 'His blade: its colour and hilt are the Crew’s.'}</p>
            )}
          </section>
        );
      })}
      <p className="hangar-note">The guns in the hand are worn on the galaxy’s worlds and the planets you land on.</p>
    </div>
  );
}
