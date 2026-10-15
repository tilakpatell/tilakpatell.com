import { shape } from '../../../lib/bf2017/ui/shapes.js';
import { markerScale } from './widgets.js';

// The in-world objective markers (UI/InGame/Hud/InworldMarkers/Multiplayer/
// CapturePointMarker on the InworldMarkerDisplayScreen): a 64-unit hexagon
// (MultiplayerObjectivePie's Hexagon_Default_Inside at 0.8) with the
// objective's letter in it (ObjectiveNameWidget, Univers 620 Bold), the
// capture progress as a ring round it (HexagonProgressBarPie: the
// 6-unit Hexagon_Pie_Progressbar fill, radial from the top), the distance
// 35 units above it (DistanceTextWidget, Univers 520 Medium 18 px, palette
// 54, "{n}m"), the whole scaled by distance (markerScale: 1 at 10 m to 0.5
// at 200 m). Off screen it sits on the edge the way to turn, with the
// arrow (ObjectiveArrowRotationWidget). Positions come in projected
// (widgets.js markerProjection).
//
//   <Markers markers={[{ id, label, x, y, dist, meter, onScreen, edgeAngle }]} />
const HEX = shape('Hexagon_Default_Inside');
export default function Markers({ markers = [] }) {
  return markers.map((m) => {
    const meter = Math.min(1, Math.abs(m.meter ?? 0));
    return (
      <div key={m.id} className="bf-marker" style={{ left: m.x, top: m.y, '--bf-marker-scale': markerScale(m.dist ?? 0) }} data-off={m.onScreen === false ? '' : undefined}>
        {m.dist != null && <span className="bf-marker-dist">{Math.round(m.dist)}m</span>}
        <svg className="bf-marker-hex" viewBox={HEX.viewBox} aria-hidden="true">
          <path d={HEX.paths[0].d} fill="currentColor" opacity="0.8" />
          {/* (the pie: the hexagon's edge swept round to the meter, 6 units wide) */}
          {meter > 0 && <path d={HEX.paths[0].d} fill="none" stroke="currentColor" strokeWidth="6" opacity="0.75" pathLength="1" strokeDasharray={`${meter} 1`} />}
        </svg>
        <b className="bf-marker-letter">{m.label}</b>
        {m.onScreen === false && m.edgeAngle != null && <i className="bf-marker-arrow" style={{ transform: `rotate(${m.edgeAngle}rad)` }} aria-hidden="true" />}
      </div>
    );
  });
}
