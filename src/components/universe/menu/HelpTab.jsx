import { guideFor } from '../../guide/pages';
import { KeyTable } from '../../guide/KeyTable';
import { openGuide } from '../../../lib/palette';
import { TOUR_MINUTES, openTour } from '../../../lib/tour';
import { useMediaQuery } from '../../../lib/hooks';

// The flight menu's Help tab: the questions (the guide's tips for this page,
// guide/pages.js, so the help is written once), the keys (the guide's, a
// touch screen's own on a touch screen), the site's tour from its three
// starts, and the guide itself, with everything in it.

const STARTS = [
  ['recruiter', 'To hire'],
  ['player', 'To play'],
  ['mixed', 'Both'],
];

export default function HelpTab({ route, onLeave }) {
  const g = guideFor(route);
  const touch = useMediaQuery('(pointer: coarse)');
  const tips = g?.tips ?? [];
  const groups = (touch ? g?.touch : g?.keys) ?? [];
  const leave = (fn) => () => {
    onLeave?.();
    fn();
  };
  return (
    <div className="fm-help">
      <section className="fm-faq" aria-label="Questions">
        <h3 className="fm-h">Questions</h3>
        {tips.map(([q, a], i) => (
          <details key={q} className="fm-q" open={i === 0} style={{ '--r': `${[-1.2, 0.8, -0.5, 1, -0.9, 0.6][i % 6]}deg` }}>
            <summary>{q}</summary>
            <p className="fm-text">{a}</p>
          </details>
        ))}
      </section>
      <div className="fm-help-side">
        <section aria-label="Keys">
          <h3 className="fm-h">{touch ? 'On the screen' : 'Keys'}</h3>
          {groups.map((grp, i) => (
            <div key={grp.label ?? i} className="fm-keys">
              {grp.label && <p className="fm-sub">{grp.label}</p>}
              <KeyTable rows={grp.rows} className="guide-keys fm-keytable" />
            </div>
          ))}
        </section>
        <section aria-label="The tour">
          <h3 className="fm-h">Show me round</h3>
          <div className="fm-tour">
            {STARTS.map(([audience, label]) => (
              <button key={audience} type="button" className="fm-btn fm-tour-pick" onClick={leave(() => openTour({ audience }))}>
                {label}
                <span className="fm-muted">{TOUR_MINUTES[audience]} min</span>
              </button>
            ))}
          </div>
        </section>
        <button type="button" className="fm-btn" onClick={leave(openGuide)}>
          <kbd className="hud-cap">?</kbd> The guide: every control and tip
        </button>
      </div>
    </div>
  );
}
