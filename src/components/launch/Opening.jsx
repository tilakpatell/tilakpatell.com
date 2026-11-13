import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { escapeWay } from './rules';
import { Horizon, Sky } from './parts';
import { useFullPage } from './useLaunch';
import Welcome from './Welcome';
import QuickTour from './QuickTour';
import './launch.css';

// The launch's first two parts in one frame: the welcome, then the quick
// tour, over the same sky. One frame for both, so going from one to the
// other changes only the words: nothing behind them shows between the two
// (the page, or the map's loading screen under it), and the planet's edge
// doesn't rise in again. A modal dialog, portalled outside #root: the page
// behind it is inert while it's up (useLaunch's useFullPage). Esc skips a
// first visit's welcome to the universe and takes a return's main way in;
// on the tour it skips the intro.
//
// <Opening stage="welcome" | "tour" visit ways reduced map onPick tour={{ next, onDone, onSkipIntro, onCard }} />

export default function Opening({ stage, visit, ways, reduced = false, map, onPick, tour }) {
  const frame = useRef(null);
  const onTour = stage === 'tour';
  useFullPage({ onEscape: onTour ? (tour.next === 'arrive' ? tour.onDone : tour.onSkipIntro) : () => onPick(escapeWay(visit, ways)) });
  // (a phone scrolled down the welcome starts the tour at its top)
  useEffect(() => {
    if (frame.current) frame.current.scrollTop = 0;
  }, [stage]);
  return createPortal(
    <div
      ref={frame}
      className={`welcome dark-scope${onTour ? ' launch-tour' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={onTour ? 'launch-tour-title' : 'welcome-title'}
      aria-describedby={onTour ? undefined : 'welcome-text'}
      data-visit={visit}
    >
      <Sky />
      {onTour ? <QuickTour {...tour} map={map} /> : <Welcome visit={visit} ways={ways} reduced={reduced} map={map} onPick={onPick} />}
      <Horizon />
    </div>,
    document.body,
  );
}
