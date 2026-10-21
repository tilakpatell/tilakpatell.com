import { useEffect, useRef, useState } from 'react';
import { BEACONS, alight, nameBeacon, newChain, stepChain } from './beacons';

// On the side: Gondor calls for aid (./beacons.js's rules). The White
// Mountains as a strip, the seven beacons along it catching one after
// another, then the names to give back in their order. `onDone({ won,
// score })` when all seven are named (score: the slips); `onClose` to go.

const STEP = 0.1; // s a step of the rules
const name = (id) => BEACONS.find((b) => b.id === id)?.name ?? id;

export function BeaconsPanel({ seed, best, onDone, onClose }) {
  const chain = useRef(null);
  if (!chain.current) chain.current = newChain(seed);
  const [, setFrame] = useState(0);
  const [said, setSaid] = useState('Watch the fire run west along the mountains.');
  useEffect(() => {
    const id = setInterval(() => {
      const c = chain.current;
      for (const e of stepChain(c, STEP)) {
        if (e.type === 'light') setSaid(`${name(e.id)} is burning.`);
        else if (e.type === 'ask') setSaid(c.round === BEACONS.length ? 'Now all seven, in the order they caught.' : `Now name them: the first ${c.round}, in the order they caught.`);
      }
      setFrame((f) => f + 1);
    }, STEP * 1000);
    return () => clearInterval(id);
  }, []);
  const c = chain.current;
  const lit = alight(c);
  const give = (id) => {
    const r = nameBeacon(c, id);
    if (r === 'wrong') setSaid('Not that one. Watch again, from Amon Dîn.');
    else if (r === 'round') setSaid(`Yes. And now one more: ${c.round}.`);
    else if (r === 'lit') {
      setSaid('All seven, Amon Dîn to Halifirien, and Rohan has seen them. Gondor calls for aid.');
      onDone?.({ won: true, score: c.slips });
    }
    setFrame((f) => f + 1);
  };
  return (
    <div className="shire-panel minas-game minas-beacons" role="group" aria-label="Gondor calls for aid" data-wrong={c.phase === 'wrong' || undefined}>
      <p className="shire-panel-title">Gondor calls for aid</p>
      <p className="shire-panel-say" aria-live="polite">
        {said}
      </p>
      <div className="minas-beacon-row" aria-hidden="true">
        {BEACONS.map((b, i) => (
          <span key={b.id} className="minas-beacon" data-lit={i < lit || undefined} data-new={c.phase === 'show' && i === lit - 1 ? true : undefined}>
            <i />
            {c.phase === 'show' && i < lit && <b>{b.name}</b>}
          </span>
        ))}
      </div>
      <div className="minas-beacon-names" role="group" aria-label="The beacons, to name in order">
        {c.deck.map((id) => (
          <button key={id} type="button" className="btn btn-ghost btn-sm" disabled={c.phase !== 'ask'} onClick={() => give(id)}>
            {name(id)}
          </button>
        ))}
      </div>
      <p className="shire-panel-stats">
        <span>
          Named <b>{c.phase === 'ask' ? c.said : c.state === 'lit' ? BEACONS.length : 0}</b> of {c.round}
        </span>
        <span>
          Slips <b>{c.slips}</b>
        </span>
        {best && <span>{best}</span>}
      </p>
      <div className="shire-panel-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          {c.state === 'lit' ? 'Back to the court' : 'Leave it'}
        </button>
      </div>
    </div>
  );
}
