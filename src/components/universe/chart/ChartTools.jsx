import { RiArrowDownCircleLine, RiFocus3Line, RiFullscreenExitLine } from 'react-icons/ri';
import { CHART_WORDS as W } from '../words';

// The chart's button row. A button with nothing to do is aria-disabled, not
// disabled, so it keeps the focus (the galaxy's way); one with no handler
// isn't drawn.
export default function ChartTools({ className, buttonClass, label, onZoomIn, onZoomOut, onShip = null, atShip = true, onFlat = null, flat = true, onFit = null }) {
  const tool = (label, key, onClick, glyph, idle = false) => (
    <button
      type="button"
      className={buttonClass}
      aria-label={label}
      title={key ? `${label} (${key})` : label}
      aria-disabled={idle ? 'true' : undefined}
      onClick={() => {
        if (!idle) onClick();
      }}
    >
      {glyph}
    </button>
  );
  return (
    <div className={className} role="group" aria-label={label}>
      {onZoomIn && tool(W.zoomIn, '+', onZoomIn, '+')}
      {onZoomOut && tool(W.zoomOut, '−', onZoomOut, '−')}
      {onShip && tool(W.toShip, '0', onShip, <RiFocus3Line aria-hidden="true" />, atShip)}
      {onFlat && tool(W.flat, null, onFlat, <RiArrowDownCircleLine aria-hidden="true" />, flat)}
      {onFit && tool(W.fit, null, onFit, <RiFullscreenExitLine aria-hidden="true" />)}
    </div>
  );
}
