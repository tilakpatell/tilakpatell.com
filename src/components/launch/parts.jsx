import { readyLine } from './rules';

// What the launch's full-page screens draw alike (Opening.jsx and
// Arrive.jsx): the sky they sit in, the planet's edge, and the line saying
// how the universe is getting on behind them. Their hooks are useLaunch.js's.

// The starfield the crawl opens on, behind everything
export function Sky() {
  return (
    <div className="welcome-sky" aria-hidden="true">
      <div className="ds-stars absolute inset-0" />
    </div>
  );
}

// A planet's edge lit by the sun the map has at its middle: off to the
// right on a wide window, at the foot (in the flow, after everything) on a
// phone or a tall one (launch.css). Last in its frame.
export function Horizon() {
  return (
    <div className="welcome-horizon" aria-hidden="true">
      <div className="welcome-sun" />
    </div>
  );
}

// "Getting the universe ready · 42%", a hairline bar under it; nothing with
// no map coming (the classic site's welcome)
export function ReadyLine({ map }) {
  const line = readyLine(map);
  if (!line) return null;
  const k = map.state === 'ready' ? 1 : Math.min(1, Math.max(0, map.value || 0));
  return (
    <p className="launch-ready" data-ready={map.state === 'ready' ? '' : undefined}>
      <span className="launch-ready-bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${k})` }} />
      </span>
      <span className="launch-ready-text">{line}</span>
    </p>
  );
}
