import { useCallback, useEffect, useRef, useState } from 'react';
import { local, useReducedMotion } from '../../lib/hooks';
import { WorldHost, useWorld } from '../../runtime';
import galaxyModule from './module';
import { CONTROLS_KEY, readControls } from '../universe/controls';
import FlightSettings from '../universe/FlightSettings';
import Hangar from '../universe/Hangar';
import { SYSTEMS, goalsOf, lightYears, systemById } from './systems';
import { placesOf } from './places';
import '../universe/universe.css';
import GuideCue from '../guide/GuideCue';
import { letHandedGo } from '../hyperspace3d/timeline';
import { letsJumpGo } from './jumpIn';
import WarHud from './WarHud';
import StarfighterHud from './StarfighterHud';
import LoadingVeil from '../worlds/LoadingVeil';
import BattleEnd from './BattleEnd';
import FlightCluster from './FlightCluster';
import KeysCard from './KeysCard';

// The galaxy's 3D view (scene.js, a world module on the world runtime:
// ./module.js) and everything over it:
// the names of what's in the system you're in (buttons: a click flies you
// there), the other systems' names over their stars as the nose comes near
// them (a click jumps you there) and, with the nose on one, the button to
// jump to it, the other pilots' callsigns, the targeting HUD and the stick ring
// (the universe map's own, UniverseMap.jsx's classes, the scene moves them),
// the flight cluster (FlightCluster.jsx: radar, deflectors, speed, kills,
// target and the crew's powers), the touch buttons, the flight settings and a line on how to
// fly until you do, the Shipyard's button beside the settings' (its yard is the
// page's: Galaxy.jsx), and the war's battle on here in a line (WarHud.jsx) with
// its end card when it's decided (BattleEnd.jsx).
// While the 3D loads the box says so; without 3D, a note
// that the galaxy needs it, and the panel and the map still work.

export default function GalaxyView({ system, here, handle, ship, loadout, build = null, tune = null, net = null, frozen, onEvent, onArrive, onAt, onBoard, onCrash, onMap, oath = null, found = [], course = null, hangar = false, onHangar = null }) {
  const labels = useRef({});
  const stars = useRef({});
  const [aim, setAim] = useState(null); // the star the nose is on
  const tags = useRef(null);
  const stick = useRef(null);
  const cluster = useRef(null); // (the flight cluster: deflectors, speed, kills, the target; the scene writes it)
  const radar = useRef(null); // (its radar's canvas)
  const buffs = useRef(null); // (and the row of effects over it)
  const powers = useRef(null); // (the crew's ship powers' bar, inside it: the scene writes that too)
  const hud = useRef(null);
  const [flown, setFlown] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false); // (the keys card, over the first flight and again from its chip)
  const [controls, setControlsState] = useState(() => readControls(local.get(CONTROLS_KEY)));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setControls = (c) => {
    const next = readControls(c);
    setControlsState(next);
    local.set(CONTROLS_KEY, next);
  };
  // (the flight settings and the Shipyard's door are in the same corner: one at a time, the yard opened by its key as well as by its button)
  const openSettings = useCallback(
    (on) => {
      setSettingsOpen(on);
      if (on) onHangar?.(false);
    },
    [onHangar],
  );
  useEffect(() => {
    if (hangar) setSettingsOpen(false);
  }, [hangar]);
  const events = useRef(onEvent);
  events.current = onEvent;
  const reduced = useReducedMotion();
  const { host, on, meant, rt, progress } = useWorld(galaxyModule, {
    props: {
      system,
      reduced,
      ship,
      loadout,
      build,
      tune,
      controls,
      labels,
      stars,
      stick,
      cluster,
      radar,
      buffs,
      powers,
      hud,
      net,
      tags,
      frozen,
      course,
      allegiance: oath,
      onArrive,
      onAt,
      onBoard,
      onCrash,
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
  // (the war's battle here as the scene has it, for the line over the galaxy and its end card)
  const warInfo = useCallback(() => (rt?.current?.module === galaxyModule ? (rt.current.world.scene?.warInfo?.() ?? null) : null), [rt]);
  useEffect(() => setFlown(false), [ship]);

  // The cluster's height on the map (--fc-h), for what sits over it (the jump button, the keys card): it grows when the row wraps in a
  // narrow window. Layout, not a HUD number: the browser tells it when it changes. (On a touch screen the row has no box of its own: 0.)
  useEffect(() => {
    const root = cluster.current;
    const map = root?.parentElement;
    if (!root || !map || typeof ResizeObserver !== 'function') return undefined;
    const row = root.querySelector('.fc-row');
    const fit = () => {
      const h = row.offsetHeight + (buffs.current?.offsetHeight ? buffs.current.offsetHeight + 6 : 0);
      map.style.setProperty('--fc-h', `${h}px`);
    };
    const watch = new ResizeObserver(fit);
    watch.observe(row);
    if (buffs.current) watch.observe(buffs.current);
    fit();
    return () => {
      watch.disconnect();
      map.style.removeProperty('--fc-h');
    };
  }, [ship, on]);

  // The universe map's jump in holds its tunnel for the galaxy
  // (hyperspace3d/timeline.js's handJump): let go once the galaxy has drawn,
  // or as soon as it won't, or while it's frozen (./jumpIn.js says when; the
  // runtime read as it is now, since this page's first status can be an
  // earlier world's failure), and when this page goes (a tick later:
  // React's second run of an effect in development comes straight back).
  useEffect(() => {
    const making = rt?.loading === galaxyModule || rt?.current?.module === galaxyModule;
    if (letsJumpGo({ drawn: on, meant, frozen, making })) letHandedGo();
  }, [on, meant, frozen, rt]);
  const up = useRef(false);
  useEffect(() => {
    up.current = true;
    return () => {
      up.current = false;
      setTimeout(() => {
        if (!up.current) letHandedGo();
      }, 0);
    };
  }, []);

  useEffect(() => {
    if (!handle) return;
    handle.current = {
      live: on,
      jump: (id) => view.current?.jump?.(id) ?? false,
      goTo: (id) => view.current?.goTo?.(id) ?? false,
      flyTo: (id) => view.current?.flyTo?.(id) ?? false, // (another pilot here: the roster's “Fly to”)
      starfighter: (id, o) => view.current?.starfighter?.(id, o) ?? false, // (a space level's Starfighter Assault here: ?battle=starfighter)
      escape: () => view.current?.escape?.() ?? false,
      dive: () => view.current?.dive?.() ?? false,
      host: () => host.current,
    };
  }, [handle, on]); // eslint-disable-line react-hooks/exhaustive-deps

  // the names of what's here, in the system the scene's in (`here`; `system`
  // is the one wanted, which a jump is on its way to)
  const hereSys = systemById(here) ?? systemById('tatooine');
  // (and the places to find out in the open: by what they are till found, then by name)
  const goals = [...goalsOf(hereSys), ...placesOf(hereSys).map((p) => ({ id: p.id, kind: 'place', name: found.includes(p.id) ? p.name : p.hint }))];
  const others = SYSTEMS.filter((s) => s !== hereSys);
  const aimed = aim && aim !== hereSys.id ? systemById(aim) : null;
  // (the course plotted on the map, if it's not where you are: a touch screen has no J for it, so a button, while no star's under the nose)
  const courseSys = course && course !== hereSys.id ? systemById(course) : null;
  const jump = (id) => view.current?.jump?.(id);
  const onPower = (slot) => view.current?.power?.(slot);
  // (the card is open over the first flight, and from its chip after; the chip shuts it either way)
  const showKeys = !flown || keysOpen;
  const closeKeys = useCallback(() => (setFlown(true), setKeysOpen(false)), []);
  const toggleKeys = () => (showKeys ? closeKeys() : setKeysOpen(true));

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
          <LoadingVeil className="universe-loading" shown={!on} progress={progress.value} step={progress.step} title="Plotting a course to a galaxy far, far away" />
          {on && oath && <WarHud sys={here} oath={oath} front={warInfo} />}
          {on && <StarfighterHud front={warInfo} />}
          {on && oath && <BattleEnd front={warInfo} />}
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
              <FlightCluster rootRef={cluster} ship={ship} reduced={reduced} powersRef={powers} onPower={onPower} radarRef={radar} buffsRef={buffs} />
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
              {!aimed && courseSys && (
                <button type="button" className="galaxy-jumpbtn" data-course="" onClick={() => jump(courseSys.id)} style={{ '--star': courseSys.accent }}>
                  Jump to {courseSys.name}
                </button>
              )}
              <FlightSettings controls={controls} onChange={setControls} open={settingsOpen} onOpen={openSettings} />
              {onHangar && <Hangar open={hangar} onOpen={onHangar} />}
              <button type="button" className="galaxy-keysbtn" onClick={toggleKeys} aria-expanded={showKeys}>
                Keys
              </button>
              <KeysCard open={showKeys} onClose={closeKeys} />
              {!flown && (
                <p className="universe-hint galaxy-hint">
                  <span className="universe-hint-keys">
                    <kbd>W</kbd> <kbd>S</kbd> throttle, <kbd>A</kbd> <kbd>D</kbd> roll, arrows to steer, <kbd>Space</kbd> boost, hold <kbd>F</kbd> to fire, <kbd>G</kbd> your crew’s power and <kbd>X</kbd> the big one once it’s charged, <kbd>V</kbd> cockpit. The named stars are other systems: put the nose on one and <kbd>J</kbd> to jump, or <kbd>M</kbd> for the galaxy map
                    <GuideCue />
                  </span>
                  <span className="universe-hint-touch">Drag to fly, hold Boost and Fire, tap your crew’s power; point at a star and tap Jump to go to lightspeed<GuideCue touch /></span>
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
