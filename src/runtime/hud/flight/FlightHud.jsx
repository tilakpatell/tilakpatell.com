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
//     armsKeys powers row over overlay after stickRef jump controls thumbs onThumbsFit />
//   crosshair: on foot, the kit's Reticle, right after the gun line so it sits under the brackets
//   flying: false draws only `overlay` (no ship: nothing of the HUD's own)
//   foot: the cluster says Health, with no radar, speed or target card
//   className: the cluster's own (the map's), beside the kit's `fc`
//   vitalsIcon, speedIcon: the world's glyphs for the shields and the speed line
//   armsKeys: the line picked shows its keys (Arms's `keys`)
//   powers, row: the world's blocks at the cluster's end (its powers' tiles; on foot, abilities)
//   over: what sits over the cluster's row (the galaxy's pickups' chips)
//   overlay, after: the world's own parts after the overlay (a battle's HUD, the Citadel's state)
//   stickRef: the touch stick's ring, first (the scene moves it)
//   jump: { className, name, onPress, accent?, course? } | null: the one jump button, its key first
//     (accent: the star's colour; course: the plotted course's, for a touch screen with no J)
//   controls: { fire, boost, climb, view, weapon | null } | null: the touch buttons, in one grid
//     (.universe-thumbs, after the world's own `thumbs`): each the scene's, a held one called with
//     its value pressed and let go (HeldButton); null draws none
//   onThumbsFit(): the grid's size has changed (the scene measures the open map again)
// It writes the cluster's height (--hud-cluster-h: thumbs.js's clusterHeight) on the map, and the
// thumbs' size (--thumbs-h, --thumbs-w) on the page, for what sits over them.

import { useEffect, useRef } from 'react';
import Arms from '../Arms.jsx';
import Cluster from '../Cluster.jsx';
import Vitals from '../Vitals.jsx';
import HeldButton from './HeldButton.jsx';
import { clusterHeight } from './thumbs.js';
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

const climbIcon = (way) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d={way > 0 ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
// (a button pressed once, on the finger's own event: no long-press menu)
const pressed = (fn) => (e) => (e.preventDefault(), fn());
const noMenu = (e) => e.preventDefault();

export default function FlightHud({ hudRef = null, crosshair = null, flying = true, foot = false, className = '', vitalsIcon = null, speedIcon = null, armsKeys = false, powers = null, row = null, over = null, overlay = null, after = null, stickRef = null, jump = null, controls = null, thumbs = null, onThumbsFit = null }) {
  const clusterEl = useRef(null);
  const thumbsEl = useRef(null);
  const fitted = useRef(onThumbsFit);
  fitted.current = onThumbsFit;
  const touchy = Boolean(controls);
  // the cluster's height on the map (--hud-cluster-h), for what sits over it (the jump button, the prompt, the keys card): it grows
  // when the row wraps in a narrow window, or the strip over it fills. (On a touch screen the row has no box of its own: 0.)
  useEffect(() => {
    const root = clusterEl.current;
    const map = root?.parentElement;
    const row = root?.querySelector('.hud-cluster-row');
    const strip = root?.querySelector('.hud-cluster-over')?.firstElementChild ?? null;
    if (!row || !map || typeof ResizeObserver !== 'function') return undefined;
    const fit = () => map.style.setProperty('--hud-cluster-h', `${clusterHeight(row, strip)}px`);
    const watch = new ResizeObserver(fit);
    watch.observe(row);
    if (strip) watch.observe(strip);
    fit();
    return () => {
      watch.disconnect();
      map.style.removeProperty('--hud-cluster-h');
    };
  }, [flying, foot]);
  // the thumbs' size (--thumbs-h, --thumbs-w) on the page, for what sits over them on a touch screen (the prompt, the jump, the
  // way in, what you've just earned) and the first-flight hint beside them; nothing on a desktop, where the grid has no box
  useEffect(() => {
    const deck = thumbsEl.current;
    const page = deck?.closest('.universe-page') ?? deck?.parentElement;
    if (!deck || !page || typeof ResizeObserver !== 'function') return undefined;
    const fit = () => {
      page.style.setProperty('--thumbs-h', `${deck.offsetHeight}px`);
      page.style.setProperty('--thumbs-w', `${deck.offsetWidth}px`);
      fitted.current?.();
    };
    const watch = new ResizeObserver(fit);
    watch.observe(deck);
    fit();
    return () => {
      watch.disconnect();
      page.style.removeProperty('--thumbs-h');
      page.style.removeProperty('--thumbs-w');
    };
  }, [flying, touchy]);
  // (three places, the same with a ship or without, so the world's overlay, a battle's HUD, is never made again as one comes or goes)
  return (
    <>
      {flying && (
        <>
          <div ref={stickRef} className="universe-stick" aria-hidden="true">
            <span />
          </div>
          {/* the ship's height: a mark on a strip at the left, brighter while it climbs or dives */}
          <div className="universe-alt" aria-hidden="true">
            <span className="universe-alt-mark" />
          </div>
          <Cluster rootRef={clusterEl} className={`fc ${className}`.trim()} label={foot ? 'On foot' : 'Flight'} over={over}>
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
        </>
      )}
      {overlay}
      {flying && (
        <>
          {after}
          {/* the star the nose is on, to jump to (or the course plotted, on a touch screen): J, or this */}
          {jump && (
            <button type="button" className={jump.className} data-course={jump.course ? '' : undefined} style={jump.accent ? { '--star': jump.accent } : undefined} onClick={jump.onPress}>
              <kbd className="hud-cap" aria-hidden="true">
                J
              </kbd>
              <span className="universe-jump-label">Jump to {jump.name}</span>
            </button>
          )}
          {/* the thumbs: every touch button in one grid in the right thumb's corner (thumbs.css lays it out, wider and lower with
              the phone on its side), the left of the screen free to drag the ship about; no box of its own on a desktop */}
          {controls && (
            <div ref={thumbsEl} className="universe-thumbs">
              {thumbs}
              <div className="universe-climbs">
                <HeldButton size={52} className="universe-climb" aria-label={foot ? 'Jump' : 'Nose up'} on={1} off={0} onHold={controls.climb}>
                  {climbIcon(1)}
                </HeldButton>
                {!foot && (
                  <HeldButton size={52} className="universe-climb" aria-label="Nose down" on={-1} off={0} onHold={controls.climb}>
                    {climbIcon(-1)}
                  </HeldButton>
                )}
              </div>
              <button type="button" className="universe-view" onPointerDown={pressed(controls.view)} onContextMenu={noMenu}>
                {foot ? 'Switch' : 'View'}
              </button>
              {controls.weapon && (
                <button type="button" className="universe-weapon" onPointerDown={pressed(controls.weapon)} onContextMenu={noMenu}>
                  Weapon
                </button>
              )}
              <HeldButton className="universe-fire" onHold={controls.fire}>
                Fire
              </HeldButton>
              <HeldButton size={76} className="universe-boost" onHold={controls.boost}>
                {foot ? 'Run' : 'Boost'}
              </HeldButton>
            </div>
          )}
        </>
      )}
    </>
  );
}
