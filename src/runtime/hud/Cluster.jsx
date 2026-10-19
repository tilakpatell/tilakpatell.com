// The flight cluster: one row of glass blocks along the bottom while you fly
// (the vitals, the arms and the powers, with a world's own blocks around
// them: the galaxy's radar and target), and a strip over it (`over`: the
// galaxy's pickups). Every world that flies a ship has it in the same place,
// in its own skin (cluster.css's tokens). Nothing in it is state: the
// world's frame loop writes it (./cluster.js and the world's own writer).
export default function Cluster({ rootRef = null, className = '', label = 'Flight', over = null, children }) {
  return (
    <div ref={rootRef} className={`hud-cluster ${className}`.trim()} role="group" aria-label={label}>
      <div className="hud-cluster-over">{over}</div>
      <div className="hud-cluster-row">{children}</div>
    </div>
  );
}
