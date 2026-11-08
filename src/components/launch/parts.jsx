import { readyLine } from './rules';

// What the launch's full-page screens draw alike (Welcome.jsx, QuickTour.jsx
// and Arrive.jsx): the sky they sit in, and the line saying how the universe
// is getting on behind them. Their hooks are useLaunch.js's.

// The starfield the crawl opens on, and a planet's edge lit by the sun the
// map has at its middle
export function Sky() {
  return (
    <div className="welcome-sky" aria-hidden="true">
      <div className="ds-stars absolute inset-0" />
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
