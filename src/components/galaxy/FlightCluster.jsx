import { RiShieldLine } from 'react-icons/ri';
import PowerBar from '../universe/PowerBar';
import { Arms, Cluster, GameIcon, Vitals } from '../../runtime/hud';
import './flight.css';

// The flight cluster, along the bottom while you fly: the HUD kit's
// (runtime/hud's Cluster, Vitals, Arms and Powers, as every world that
// flies a ship has it), with the galaxy's own blocks in it: the radar; the
// ship's speed and kills under the deflectors; the target (its name, how far,
// its hull); and the pickups' effects over the row. The scene writes it all
// (cluster.js, and the radar's canvas: radar.js, radarDraw.js); nothing
// here is state. The speed line wears the game's starfighter HUD's
// speed-bar icon (lib/bf2017/icons.js's `hud:speed`); the deflectors keep
// the site's shield, the game having no icon of that meaning. On a touch
// screen the ship's block is the deflectors alone (their icon, the number
// and the bar), beside the radar: the rest has no room there. The group is
// labelled and the glass blocks hidden one by one, so the power buttons
// stay reachable to a screen reader and a keyboard.
export default function FlightCluster({ rootRef, ship, reduced, powersRef, onPower, radarRef, buffsRef, picks = null, carry = null }) {
  return (
    <Cluster rootRef={rootRef} className="fc" label="Flight" over={<div ref={buffsRef} className="fc-buffs" aria-hidden="true" />}>
      <canvas ref={radarRef} className="fc-radar" width="264" height="264" aria-hidden="true" />
      <Vitals className="fc-ship" label="Deflectors" icon={<RiShieldLine className="fc-shield-icon" aria-hidden="true" />}>
        <div className="hud-line fc-sub">
          <span className="fc-speed-lead">
            <GameIcon name="hud:speed" className="fc-speed-icon" />
            <b className="fc-speed-n">SPD 0</b>
          </span>
          <span className="hud-label">
            Kills <b className="fc-kills-n">0</b>
          </span>
        </div>
        <span className="hud-bar fc-speed">
          <span />
        </span>
      </Vitals>
      {/* (its keys are on the keys card, keyRows.js: the row has no room for them beside the radar and the target) */}
      <Arms />
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
      <PowerBar ship={ship} reduced={reduced} barRef={powersRef} onPress={onPower} placement="cluster" picks={picks} carry={carry} />
    </Cluster>
  );
}
