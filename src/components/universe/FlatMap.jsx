import { useRef } from 'react';
import MiniMap from './MiniMap';
import ChartTools from './chart/ChartTools';
import { chartKey, ringStep } from './chart/input';
import { HAND_MARKS } from './chart/marks';
import { miniView } from './chart/place';
import { FRAMES } from './chart/projection';
import { useChartView } from './chart/useChartView';

// The universe map when 3D is off, UniverseMap.jsx's: MiniMap.jsx's whole map
// with the chart's hands on it. A drag moves it, the wheel and a pinch zoom,
// + and − zoom with the focus inside it and 0 goes back to the whole map, and
// its tools are under it. The arrow keys step through the places on the
// chart, Home and End jump to the ends. Apart from MiniMap.jsx, so Home's
// teaser loads none of this.
//
// <FlatMap selected startAt onSelect />: the pick, or else the link's wonder
//   (startAt), pressed; the page's pick is a universe's or a moon's id only,
//   so a wonder picked here is the link's, and the arrows go on from it

// (MiniMap's whole map, the same marks: its view opens on them all)
const OPEN = miniView(HAND_MARKS.filter((m) => m.pickable || m.id === 'chart:sun'));

export default function FlatMap({ selected = null, startAt = null, onSelect }) {
  const box = useRef(null);
  const chart = useChartView(box, { open: OPEN, frame: FRAMES.mini, orbit: false });
  const pick = selected ?? startAt;

  // the chart's keys, the focus anywhere inside it: + and − zoom, 0 shows it all again
  const onKeyDown = (e) => {
    const act = chartKey(e);
    if (!act) return;
    e.preventDefault();
    chart[act]();
  };
  const onListKey = (e, ids) => {
    if (!onSelect || e.altKey || e.ctrlKey || e.metaKey) return;
    const to = ringStep(ids, e.key, pick);
    if (to === undefined) return;
    e.preventDefault();
    onSelect(to);
    e.currentTarget.querySelector(`[data-id="${to}"] .minimap-hit`)?.focus();
  };

  return (
    <MiniMap selected={pick} onSelect={onSelect} view={chart.view} boxRef={box} handlers={chart.handlers} onKeyDown={onKeyDown} onListKey={onListKey}>
      <ChartTools className="minimap-tools" buttonClass="chip" onZoomIn={chart.zoomIn} onZoomOut={chart.zoomOut} onFit={() => chart.setView(OPEN)} fitKey="0" />
    </MiniMap>
  );
}
