import { RiArrowDownCircleLine, RiFocus3Line, RiFullscreenExitLine } from 'react-icons/ri';
import { CHART_WORDS as W } from '../words';

// The chart's buttons: zoom in and out, back to the ship, look straight
// down, show everything. One with nothing to do is aria-disabled, not
// disabled, so it keeps the focus (the galaxy map's way); one with no
// handler isn't drawn. Each says its key in its title.
export default function ChartTools({ className = 'navmap-tools', buttonClass = 'navmap-tool', onZoomIn, onZoomOut, onShip = null, atShip = true, onFlat = null, flat = true, onFit = null, fitted = false }) {
  const tool = (label, key, onClick, idle, face) => (
    <button type="button" className={buttonClass} aria-label={label} title={key ? `${label} (${key})` : label} onClick={idle ? undefined : onClick} aria-disabled={idle || undefined}>
      {face}
    </button>
  );
  return (
    <div className={className} role="group" aria-label={W.tools}>
      {tool(W.zoomIn, '+', onZoomIn, false, '+')}
      {tool(W.zoomOut, '−', onZoomOut, false, '−')}
      {onShip && tool(W.toShip, '0', onShip, atShip, <RiFocus3Line aria-hidden="true" />)}
      {onFlat && tool(W.flat, null, onFlat, flat, <RiArrowDownCircleLine aria-hidden="true" />)}
      {onFit && tool(W.fit, '0', onFit, fitted, <RiFullscreenExitLine aria-hidden="true" />)}
    </div>
  );
}
