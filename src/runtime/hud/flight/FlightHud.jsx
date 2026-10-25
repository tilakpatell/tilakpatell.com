// The flight HUD's markup, one for both maps (the universe map's
// UniverseMap.jsx and the galaxy's GalaxyView.jsx): the overlay over the 3D,
// the gun line, the lock's brackets, its name, range and what it has left,
// the threats' and the mates' arrows, the lead pip and the way to go. The
// scene's frame loop writes it (flightHud.js, from frame.js's record) through
// `hudRef`; React draws it once. A world tints it by its own classes and
// custom properties; the classes are the map's, as they always were.
//
//   <FlightHud hudRef crosshair />   crosshair: on foot, the kit's Reticle,
//     right after the gun line so it sits under the brackets

import './flight.css'; // (its looks, under :where(.universe-hud): the map tints them)

export function FlightOverlay({ hudRef = null, crosshair = null }) {
  return (
    <div ref={hudRef} className="universe-hud" aria-hidden="true">
      <span className="universe-reticle" />
      {/* on foot, the kit's crosshair in the middle: the shot goes down the camera's ray (footAim.js) */}
      {crosshair}
      <span className="universe-lock">
        <i />
        <i />
        <i />
        <i />
        <b className="universe-lock-name" />
        <b className="universe-lock-dist" />
        <b className="universe-lock-hp" />
      </span>
      <span className="universe-threat" />
      <span className="universe-threat" />
      <span className="universe-threat" />
      <span className="universe-mate">
        <b className="universe-mate-name" />
      </span>
      <span className="universe-mate">
        <b className="universe-mate-name" />
      </span>
      <span className="universe-mate">
        <b className="universe-mate-name" />
      </span>
      <span className="universe-mate">
        <b className="universe-mate-name" />
      </span>
      <span className="universe-lead" />
      <span className="universe-nav">
        <i />
        <b className="universe-nav-name" />
        <b className="universe-nav-dist" />
      </span>
    </div>
  );
}

export default function FlightHud({ hudRef = null, crosshair = null }) {
  return <FlightOverlay hudRef={hudRef} crosshair={crosshair} />;
}
