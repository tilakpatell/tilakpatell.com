import { RiShieldLine } from 'react-icons/ri';
import PowerBar from '../universe/PowerBar';
import { GameIcon } from '../../runtime/hud';
import './flight.css';

// The flight cluster, along the bottom while you fly (the scene writes its
// numbers: cluster.js, and the radar's canvas: radar.js, radarDraw.js): the
// radar; the ship (deflectors, speed, kills); the target (its name, how
// far, its hull); and the crew's two powers (PowerBar.jsx), with the
// pickups' effects over it. Nothing here is state: the scene writes it all.
// The speed line wears the game's starfighter HUD's speed-bar icon
// (lib/bf2017/icons.js's `hud:speed`); the deflectors keep the site's
// shield, the game having no icon of that meaning.
// On a touch screen the ship's block is the deflectors alone (their icon, the
// number and the bar), beside the radar: the rest has no room there. The group is labelled and the glass blocks hidden one by one, so the
// power buttons stay reachable to a screen reader and a keyboard.
export default function FlightCluster({ rootRef, ship, reduced, powersRef, onPower, radarRef, buffsRef }) {
  return (
    <div ref={rootRef} className="fc" role="group" aria-label="Flight">
      <div ref={buffsRef} className="fc-buffs" aria-hidden="true" />
      <div className="fc-row">
        <canvas ref={radarRef} className="fc-radar" width="264" height="264" aria-hidden="true" />
        <div className="fc-glass fc-ship" aria-hidden="true">
          <div className="fc-line">
            <RiShieldLine className="fc-shield-icon" aria-hidden="true" />
            <span className="fc-label">Deflectors</span>
            <b className="fc-shield-n">100%</b>
          </div>
          <span className="fc-bar fc-shield">
            <span />
          </span>
          <div className="fc-line fc-sub">
            <GameIcon name="hud:speed" className="fc-speed-icon" />
            <b className="fc-speed-n">SPD 0</b>
            <span className="fc-label">
              Kills <b className="fc-kills-n">0</b>
            </span>
          </div>
          <span className="fc-bar fc-speed">
            <span />
          </span>
        </div>
        <div className="fc-glass fc-target" aria-hidden="true">
          <span className="fc-label">Target</span>
          <b className="fc-target-name" />
          <span className="fc-line">
            <b className="fc-target-dist" />
            <span className="fc-keys">
              <kbd className="hud-cap">T</kbd> next <kbd className="hud-cap">Q</kbd> back
            </span>
          </span>
          <span className="fc-bar fc-target-hp">
            <span />
          </span>
          <span className="fc-none">
            No target · <kbd className="hud-cap">T</kbd>
          </span>
        </div>
        <PowerBar ship={ship} reduced={reduced} barRef={powersRef} onPress={onPower} placement="cluster" />
      </div>
    </div>
  );
}
