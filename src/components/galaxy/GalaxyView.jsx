import { useCallback, useEffect, useRef, useState } from 'react';
import { RiShieldLine } from 'react-icons/ri';
import { local, useMediaQuery, useReducedMotion } from '../../lib/hooks';
import { WorldHost, useWorld } from '../../runtime';
import galaxyModule from './module';
import { CONTROLS_KEY, readControls } from '../universe/controls';
import FlightSettings from '../universe/FlightSettings';
import Hangar from '../universe/Hangar';
import { SYSTEMS, goalsOf, lightYears, systemById } from './systems';
import { placesOf } from './places';
import '../universe/universe.css';
import './flight.css';
import '../../lib/bf2017/fonts.css';
import GuideCue from '../guide/GuideCue';
import { letHandedGo } from '../hyperspace3d/timeline';
import { letsJumpGo } from './jumpIn';
import WarHud from './WarHud';
import StarfighterHud from './StarfighterHud';
import LoadingVeil from '../worlds/LoadingVeil';
import BattleEnd from './BattleEnd';
import KeysCard from './KeysCard';
import { FlightHud, GameIcon } from '../../runtime/hud';
import { PowerBar } from '../universe/shared/powerBar';

// The galaxy's 3D view (scene.js, a world module on the world runtime:
// ./module.js) and everything over it:
// the names of what's in the system you're in (buttons: a click flies you
// there), the other systems' names over their stars as the nose comes near
// them (a click jumps you there) and, with the nose on one, the button to
// jump to it, the other pilots' callsigns, the targeting HUD and the stick ring
// (the universe map's own, UniverseMap.jsx's classes, the scene moves them),
// the flight HUD (the HUD kit's FlightHud, the universe map's own: the
// radar, the shields, speed, kills, the target and the crew's powers in the
// cluster, the pickups' effects over it, the overlay), the touch buttons, the flight settings and a line on how to
// fly until you do, the Shipyard's button beside the settings' (its yard is the
// page's: Galaxy.jsx), and the war's battle on here in a line (WarHud.jsx) with
// its end card when it's decided (BattleEnd.jsx).
// While the 3D loads the box says so; without 3D, a note
// that the galaxy needs it, and the panel and the map still work.

export default function GalaxyView({ system, here, handle, holo = null, ship, loadout, build = null, tune = null, net = null, frozen, onEvent, onArrive, onAt, onBoard, onCrash, onMap, oath = null, found = [], course = null, hangar = false, onHangar = null, skillFx = null, powerPicks = null }) {
  const labels = useRef({});
  const stars = useRef({});
  const [aim, setAim] = useState(null); // the star the nose is on
  const tags = useRef(null);
  const stick = useRef(null);
  const buffs = useRef(null); // (the row of effects over it)
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
  const coarse = useMediaQuery('(pointer: coarse)'); // (a touch screen: the powers are round buttons in the thumbs' grid)
  const { host, on, meant, rt, progress } = useWorld(galaxyModule, {
    props: {
      system,
      reduced,
      ship,
      loadout,
      build,
      tune,
      skillFx, // (the skill tree's effects and the powers picked: hangar/skills's, the page's)
      powerPicks,
      controls,
      labels,
      stars,
      stick,
      buffs,
      powers,
      hud,
      net,
      tags,
      frozen,
      course,
      holo, // (the map in 3D: holo/link.js)
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

  // the touch buttons (FlightHud's grid, as the universe map's: the held ones keep the finger till it lifts)
  const buttons = {
    fire: (x) => view.current?.fire?.(x),
    boost: (x) => view.current?.boost?.(x),
    climb: (x) => view.current?.climb?.(x),
    view: () => view.current?.seat?.(),
    weapon: () => view.current?.weapon?.(), // (the next line of the armoury, as the universe map's: a keyboard has R and 1 2 3)
  };
  // the one jump button: the star the nose is on, else the course plotted (a touch screen's: it has no J)
  const jumpTo = aimed ? { className: 'galaxy-jumpbtn', name: aimed.name, accent: aimed.accent, onPress: () => jump(aimed.id) } : courseSys ? { className: 'galaxy-jumpbtn', name: courseSys.name, accent: courseSys.accent, course: true, onPress: () => jump(courseSys.id) } : null;

  return (
    <WorldHost world={{ host }} className="universe-map galaxy-map" data-ship={ship || undefined}>
      {meant ? (
        <>
          <LoadingVeil className="universe-loading" shown={!on} progress={progress.value} step={progress.step} title="Plotting a course to a galaxy far, far away" />
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
          {on && (
            <FlightHud
              flying={Boolean(ship)}
              hudRef={hud}
              stickRef={stick}
              vitalsIcon={<RiShieldLine className="fc-shield-icon" aria-hidden="true" />}
              speedIcon={<GameIcon name="hud:speed" className="fc-speed-icon" />}
              over={<div ref={buffs} className="fc-buffs" aria-hidden="true" />}
              // (the crew's powers: in the cluster, or round buttons in the thumbs' grid on a touch screen)
              powers={!coarse && <PowerBar ship={ship} reduced={reduced} barRef={powers} onPress={onPower} placement="cluster" picks={powerPicks} carry={skillFx?.carry} />}
              thumbs={coarse && <PowerBar ship={ship} reduced={reduced} barRef={powers} onPress={onPower} picks={powerPicks} carry={skillFx?.carry} />}
              overlay={
                <>
                  {oath && <WarHud sys={here} oath={oath} front={warInfo} />}
                  <StarfighterHud front={warInfo} />
                </>
              }
              after={
                <button type="button" className="galaxy-mapbtn" onClick={onMap}>
                  Galaxy map
                </button>
              }
              jump={jumpTo}
              controls={buttons}
            />
          )}
          {ship && on && (
            <>
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
