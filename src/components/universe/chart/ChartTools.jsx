import { RiArrowDownCircleLine, RiFocus3Line, RiFullscreenExitLine } from 'react-icons/ri';
import { CHART_WORDS as W } from '../words';

// The chart's tools, the nav map's and the mini-map's alike: zoom in and out,
// back to the ship, look straight down and show everything, in that order,
// each drawn only when its map gives it something to do. Each says itself in
// the glossary's words, its key in the title. One with nothing to do now (the
// chart on the ship already, or looking straight down) is aria-disabled, not
// disabled: a disabled button drops the focus it has when it's pressed (the
// galaxy map's zoom does the same). The map gives the class each button is
// drawn with (the nav map's .navmap-tool, the mini-map's .chip).
export default function ChartTools({ className, buttonClass, onZoomIn, onZoomOut, onShip = null, atShip = true, onFlat = null, flat = true, onFit = null }) {
  const tools = [
    { id: 'in', act: onZoomIn, label: W.zoomIn, key: '+', face: '+' },
    { id: 'out', act: onZoomOut, label: W.zoomOut, key: '−', face: '−' },
    { id: 'ship', act: onShip, label: W.toShip, key: '0', idle: atShip, face: <RiFocus3Line aria-hidden="true" /> },
    { id: 'flat', act: onFlat, label: W.flat, idle: flat, face: <RiArrowDownCircleLine aria-hidden="true" /> },
    { id: 'fit', act: onFit, label: W.fit, face: <RiFullscreenExitLine aria-hidden="true" /> },
  ];
  return (
    <div className={className} role="group" aria-label={W.tools}>
      {tools
        .filter((t) => t.act)
        .map((t) => (
          <button key={t.id} type="button" className={buttonClass} data-tool={t.id} aria-label={t.label} title={t.key ? `${t.label} (${t.key})` : t.label} aria-disabled={t.idle || undefined} onClick={t.idle ? undefined : () => t.act()}>
            {t.face}
          </button>
        ))}
    </div>
  );
}
