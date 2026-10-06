import { useCallback, useEffect, useRef, useState } from 'react';
import { local, useReducedMotion } from '../../lib/hooks';
import { WorldHost, useWorld } from '../../runtime';
import galaxyModule from './module';
import { CONTROLS_KEY, readControls } from '../universe/controls';
import FlightSettings from '../universe/FlightSettings';
import { SYSTEMS, goalsOf, lightYears, systemById } from './systems';
import '../universe/universe.css';
import GuideCue from '../guide/GuideCue';

// The galaxy's 3D view (scene.js, a world module on the world runtime:
// ./module.js) and everything over it:
// the names of what's in the system you're in (buttons: a click flies you
// there), the other systems' names over their stars as the nose comes near
// them (a click jumps you there) and, with the nose on one, the button to
// jump to it, the other pilots' callsigns, the targeting HUD and the stick ring
// (the universe map's own, UniverseMap.jsx's classes, the scene moves them),
// your shields, the touch buttons, the flight settings and a line on how to
// fly until you do. While the 3D loads the box says so; without 3D, a note
// that the galaxy needs it, and the panel and the map still work.

export default function GalaxyView({ system, here, handle, ship, loadout, build = null, net = null, frozen, onEvent, onArrive, onAt, onBoard, onMap }) {
  const labels = useRef({});
  const stars = useRef({});
  const [aim, setAim] = useState(null); // the star the nose is on
  const tags = useRef(null);
  const stick = useRef(null);
  const shield = useRef(null);
  const hud = useRef(null);
  const [flown, setFlown] = useState(false);
  const [controls, setControlsState] = useState(() => readControls(local.get(CONTROLS_KEY)));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setControls = (c) => {
    const next = readControls(c);
    setControlsState(next);
    local.set(CONTROLS_KEY, next);
  };
  const openSettings = useCallback((on) => setSettingsOpen(on), []);
  const events = useRef(onEvent);
  events.current = onEvent;
  const reduced = useReducedMotion();
  const { host, on, meant, rt } = useWorld(galaxyModule, {
    props: {
      system,
      reduced,
      ship,
      loadout,
      build,
      controls,
      labels,
      stars,
      stick,
      shield,
      hud,
      net,
      tags,
      frozen,
      onArrive,
      onAt,
      onBoard,
    },
    onEvent: (e) => {
      if (e.type === 'launch') setFlown(true);
      if (e.type === 'aim') {
        setAim(e.id);
        return;
      }
      events.current?.(e);
    },
  });
  // the scene itself, while it's the world on the runtime: its own calls (jump, goTo, fire…)
  const view = { get current() { return rt?.current?.module === galaxyModule ? rt.current.world.scene : null; } };
  useEffect(() => setFlown(false), [ship]);

  useEffect(() => {
    if (!handle) return;
    handle.current = {
      live: on,
      jump: (id) => view.current?.jump?.(id) ?? false,
      goTo: (id) => view.current?.goTo?.(id) ?? false,
      escape: () => view.current?.escape?.() ?? false,
      dive: () => view.current?.dive?.() ?? false,
      host: () => host.current,
    };
  }, [handle, on]); // eslint-disable-line react-hooks/exhaustive-deps

  // the names of what's here, in the system the scene's in (`here`; `system`
  // is the one wanted, which a jump is on its way to)
  const hereSys = systemById(here) ?? systemById('tatooine');
  const goals = goalsOf(hereSys);
  const others = SYSTEMS.filter((s) => s !== hereSys);
  const aimed = aim && aim !== hereSys.id ? systemById(aim) : null;
  const jump = (id) => view.current?.jump?.(id);

  const hold = (down) => (e) => (e.preventDefault(), view.current?.boost?.(down));
  const trigger = (down) => (e) => (e.preventDefault(), view.current?.fire?.(down));
  const climb = (way) => (e) => (e.preventDefault(), view.current?.climb?.(way));
  const climbButton = (way, label) => (
    <button type="button" className="universe-climb" aria-label={label} onPointerDown={climb(way)} onPointerUp={climb(0)} onPointerCancel={climb(0)} onPointerLeave={climb(0)} onContextMenu={(e) => e.preventDefault()}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d={way > 0 ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  return (
    <WorldHost world={{ host }} className="universe-map galaxy-map" data-ship={ship || undefined}>
      {meant ? (
        <>
          {!on && (
            <p className="universe-loading" role="status">
              Plotting a course to a galaxy far, far away…
            </p>
          )}
          <ul className="universe-labels galaxy-labels" aria-label="In this system">
            {goals.map((g) => (
              <li key={g.id}>
                <button
                  ref={(el) => {
                    if (el) labels.current[g.id] = el;
                    else delete labels.current[g.id];
                  }}
                  type="button"
                  className="universe-label galaxy-label"
                  data-kind={g.kind}
                  onClick={() => view.current?.goTo?.(g.id)}
                  title={`Fly to ${g.name}`}
                >
                  {g.name}
                </button>
              </li>
            ))}
          </ul>
          {ship && on && (
            <ul className="galaxy-stars" aria-label="Other systems' stars">
              {others.map((o) => (
                <li key={o.id}>
                  <button
                    ref={(el) => {
                      if (el) stars.current[o.id] = el;
                      else delete stars.current[o.id];
                    }}
                    type="button"
                    className="galaxy-star"
                    style={{ '--star': o.accent }}
                    onClick={() => jump(o.id)}
                    title={`Jump to ${o.name}`}
                  >
                    <span className="galaxy-star-name">{o.name}</span>
                    <span className="galaxy-star-more">
                      {lightYears(hereSys, o).toLocaleString('en-US')} ly · <kbd>J</kbd> to jump
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div ref={tags} className="universe-tags" aria-hidden="true" />
          {ship && on && (
            <>
              <div ref={stick} className="universe-stick" aria-hidden="true">
                <span />
              </div>
              <div ref={shield} className="universe-shield" aria-hidden="true">
                <span className="universe-shield-label">Deflectors</span>
                <span className="universe-shield-bar">
                  <span />
                </span>
              </div>
              <div ref={hud} className="universe-hud" aria-hidden="true">
                <span className="universe-reticle" />
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
                <span className="universe-lead" />
                <span className="universe-nav">
                  <i />
                  <b className="universe-nav-name" />
                  <b className="universe-nav-dist" />
                </span>
              </div>
              <div className="universe-climbs">
                {climbButton(1, 'Nose up')}
                {climbButton(-1, 'Nose down')}
              </div>
              <button type="button" className="universe-view" onPointerDown={(e) => (e.preventDefault(), view.current?.seat?.())} onContextMenu={(e) => e.preventDefault()}>
                View
              </button>
              <button type="button" className="universe-fire" onPointerDown={trigger(true)} onPointerUp={trigger(false)} onPointerCancel={trigger(false)} onPointerLeave={trigger(false)} onLostPointerCapture={trigger(false)} onContextMenu={(e) => e.preventDefault()}>
                Fire
              </button>
              <button type="button" className="universe-boost" onPointerDown={hold(true)} onPointerUp={hold(false)} onPointerCancel={hold(false)} onPointerLeave={hold(false)} onContextMenu={(e) => e.preventDefault()}>
                Boost
              </button>
              <button type="button" className="galaxy-mapbtn" onClick={onMap}>
                Galaxy map
              </button>
              {aimed && (
                <button type="button" className="galaxy-jumpbtn" onClick={() => jump(aimed.id)} style={{ '--star': aimed.accent }}>
                  <span className="galaxy-jumpbtn-k" aria-hidden="true">
                    J
                  </span>
                  Jump to {aimed.name}
                </button>
              )}
              <FlightSettings controls={controls} onChange={setControls} open={settingsOpen} onOpen={openSettings} />
              {!flown && (
                <p className="universe-hint">
                  <span className="universe-hint-keys">
                    <kbd>W</kbd> <kbd>S</kbd> throttle, <kbd>A</kbd> <kbd>D</kbd> roll, arrows to steer, <kbd>Space</kbd> boost, hold <kbd>F</kbd> to fire, <kbd>V</kbd> cockpit. The named stars are other systems: put the nose on one and <kbd>J</kbd> to jump, or <kbd>M</kbd> for the galaxy map
                    <GuideCue />
                  </span>
                  <span className="universe-hint-touch">Drag to fly, hold Boost and Fire; point at a star and tap Jump to go to lightspeed<GuideCue touch /></span>
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <div className="universe-flat galaxy-flat">
          <p>The galaxy is drawn in 3D, and 3D is off here. The galaxy map still works: plot a course from the panel, and read about every system on the way.</p>
        </div>
      )}
    </WorldHost>
  );
}
