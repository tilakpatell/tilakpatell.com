import { useEffect, useRef, useState } from 'react';
import { IconClassic, IconUniverse } from '../icons';

// Over the universe at the front door, for a visitor the first visit's
// welcome didn't ask (one who prefers less motion, or a later visit that
// wasn't remembered): how would you like to look round? Two ways, side by
// side, each saying what it is. Remembered unless told not to.
const OPTIONS = [
  { id: 'universe', Icon: IconUniverse, title: 'Fly through the universe', text: 'Pilot a ship to my pages and to the worlds I love.' },
  { id: 'home', Icon: IconClassic, title: 'Read the classic site', text: 'The same site as pages: experience, projects and résumé.' },
];

export default function StartChoice({ onPick }) {
  const [remember, setRemember] = useState(true);
  const first = useRef(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), []);
  return (
    <div className="start-choice" role="dialog" aria-modal="true" aria-labelledby="start-title">
      <div className="start-card">
        <h2 id="start-title" className="start-title">
          How would you like to look around?
        </h2>
        <div className="start-options">
          {OPTIONS.map(({ id, Icon, title, text }, n) => (
            <button key={id} ref={n === 0 ? first : undefined} type="button" className="start-option" data-main={n === 0 ? '' : undefined} onClick={() => onPick(id, remember)}>
              <Icon className="start-option-icon" aria-hidden="true" />
              <span className="start-option-title">{title}</span>
              <span className="start-option-text">{text}</span>
            </button>
          ))}
        </div>
        <div className="start-foot">
          <label className="start-remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember my choice
          </label>
          <p className="start-note">The switch at the top of every page changes it.</p>
        </div>
      </div>
    </div>
  );
}
