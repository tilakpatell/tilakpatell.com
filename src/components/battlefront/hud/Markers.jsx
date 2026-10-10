// The in-world markers (UI/InGame/Hud/InworldMarkers): the objectives with
// their letter and distance, on screen where they are or on the edge the
// way to turn. Positions come in projected (widgets.js markerProjection).
//
//   <Markers markers={[{ id, label, x, y, dist }]} />
export default function Markers({ markers = [] }) {
  return markers.map((m) => (
    <div key={m.id} className="bf-marker bf-glass" style={{ left: m.x, top: m.y }}>
      <b>{m.label}</b>
      {m.dist != null && <span className="bf-num">{Math.round(m.dist)}m</span>}
    </div>
  ));
}
