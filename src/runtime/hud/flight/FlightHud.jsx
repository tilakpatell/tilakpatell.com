// The flight HUD's markup, one for both maps (the universe map's
// UniverseMap.jsx and the galaxy's GalaxyView.jsx), every part on both: the
// altitude strip; the cluster along the bottom (the HUD kit's Cluster, with
// the radar, the shields and under them the speed and the kills, the line
// picked, the target's card, and the world's powers and row); the wanted
// strip; and the overlay over the 3D (the gun line, the lock's brackets, its
// name, range and what it has left, the threats' and the mates' arrows, the
// lead pip and the way to go). The scene's frame loop writes it all
// (flightHud.js, from frame.js's record) through `hudRef`, finding the parts
// beside the overlay; React draws it once. A world tints it by its own
// classes and custom properties.
//
//   <FlightHud hudRef crosshair flying foot className vitalsIcon speedIcon
//     armsKeys powers row over overlay after clusterRef />
//   crosshair: on foot, the kit's Reticle, right after the gun line so it sits under the brackets
//   flying: false draws only `overlay` (no ship: nothing of the HUD's own)
//   foot: the cluster says Health, with no radar, speed or target card
//   className: the cluster's own (the map's), beside the kit's `fc`
//   vitalsIcon, speedIcon: the world's glyphs for the shields and the speed line
//   armsKeys: the line picked shows its keys (Arms's `keys`)
//   powers, row: the world's blocks at the cluster's end (its powers' tiles; on foot, abilities)
//   over: what sits over the cluster's row (the galaxy's pickups' chips)
//   overlay, after: the world's own parts after the overlay (a battle's HUD, the Citadel's state)
//   clusterRef: the cluster's element, for the world's own writes (the chips)

import Arms from '../Arms.jsx';
import Cluster from '../Cluster.jsx';
import Vitals from '../Vitals.jsx';
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

export default function FlightHud({ hudRef = null, crosshair = null, flying = true, foot = false, className = '', vitalsIcon = null, speedIcon = null, armsKeys = false, powers = null, row = null, over = null, overlay = null, after = null, clusterRef = null }) {
  if (!flying) return <>{overlay}</>;
  return (
    <>
      {/* the ship's height: a mark on a strip at the left, brighter while it climbs or dives */}
      <div className="universe-alt" aria-hidden="true">
        <span className="universe-alt-mark" />
      </div>
      <Cluster rootRef={clusterRef} className={`fc ${className}`.trim()} label={foot ? 'On foot' : 'Flight'} over={over}>
        {!foot && <canvas className="fc-radar" width="264" height="264" aria-hidden="true" />}
        <Vitals className="fc-ship" label={foot ? 'Health' : 'Shields'} icon={vitalsIcon}>
          {!foot && (
            <>
              <div className="hud-line fc-sub">
                <span className="fc-speed-lead">
                  {speedIcon}
                  <b className="fc-speed-n">SPD 0</b>
                </span>
                <span className="hud-label">
                  Kills <b className="fc-kills-n">0</b>
                </span>
              </div>
              <span className="hud-bar fc-speed">
                <span />
              </span>
            </>
          )}
        </Vitals>
        {/* (its keys are on the keys card on the galaxy: the row has no room for them beside the radar and the target) */}
        <Arms keys={armsKeys} />
        {!foot && (
          <div className="hud-glass fc-target" aria-hidden="true">
            <span className="hud-label">Target</span>
            <b className="fc-target-name" />
            <span className="hud-line">
              <b className="fc-target-dist" />
              <span className="hud-keys">
                <kbd className="hud-cap">T</kbd> next <kbd className="hud-cap">Q</kbd> back
              </span>
            </span>
            <span className="hud-bar fc-target-hp">
              <span />
            </span>
            <span className="fc-none">
              No target · <kbd className="hud-cap">T</kbd>
            </span>
          </div>
        )}
        {powers}
        {row}
      </Cluster>
      {/* the law: stars, the word for what it's doing, the bounty on you */}
      <div className="universe-wanted" aria-hidden="true">
        <span className="universe-wanted-stars">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <b className="universe-wanted-word" />
        <b className="universe-wanted-bounty" />
      </div>
      <FlightOverlay hudRef={hudRef} crosshair={crosshair} />
      {overlay}
      {after}
    </>
  );
}
