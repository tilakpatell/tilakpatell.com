import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorldHost, useWorld } from '../../runtime';
import universeModule from './module';
import { local, useMediaQuery, useReducedMotion } from '../../lib/hooks';
import { CONTROLS_KEY, readControls } from './controls';
import { useEconomy } from './EconomyProvider';
import FlightSettings from './FlightSettings';
import Hangar from './Hangar';
import { UNIVERSES } from './universes';
import { ORDER, keyStep } from './layout';
import MiniMap from './MiniMap';
import GuideCue from '../guide/GuideCue';
import { askBrief } from '../tour/brief';
import LoadingVeil from '../worlds/LoadingVeil';
import { RiShieldLine } from 'react-icons/ri';
import PowerBar from './PowerBar';
import { Abilities, FlightHud, Prompt, Reticle } from '../../runtime/hud';
import { PROMPT as LOOK_PROMPT } from '../../runtime/look';

// The map: the 3D scene (scene.js and planets.js, a world module on the
// world runtime: ./module.js, mounted with useWorld) with the
// planets' names as buttons over it. React renders the names once; the
// scene moves them as it draws. The names are one focus group: the arrow
// keys step through the universes, Home and End jump to the ends. With a
// ship picked there's a ring that shows the drag-to-steer stick, a gauge of
// how high it flies, its shields (while there's trouble about), the
// targeting HUD (the gun line, the lock on a hunter with the lead to shoot
// at and, for the tough ones, what they have left, arrows at the edge for
// the ones coming at you that you can't see, and the way to wherever you're
// going; the scene places them), Boost, Fire (held, it keeps firing), View
// (the cockpit or behind the ship) and nose-up and nose-down buttons on touch
// screens, the flight settings (FlightSettings.jsx, kept between visits),
// the way into the Shipyard (Hangar.jsx, the button; the yard is the
// page's) and a line on how to fly until you do. While the
// 3D loads the box says so (3D first: never the flat map in the meantime);
// if 3D is off, fails or is lost, the flat MiniMap takes the box. Online,
// the other pilots' callsigns ride over their ships (the scene moves them).
// The map button (and M) opens the nav map (the page's: NavMap.jsx); `drive`
// is the one picked there, how the ship goes anywhere it's sent, and
// `charting` says the nav map's open (the director holds off meanwhile).

// the crew member's two abilities on foot (footAbilities.js), the scene writing their names
const FOOT_ABILITIES = [
  { slot: 'power', key: 'G' },
  { slot: 'second', key: 'V' },
];

export default function UniverseMap({ selected, onSelect, onOpen, handle, frozen, ship, loadout, build = null, tune = null, canFit = false, hangar = false, onHangar, net = null, onEvent, onLand, onCrash, drive = 'super', charting = false, onMap, startAt = null, universe = null, skillFx = null, powerPicks = null }) {
  const labels = useRef({});
  const tags = useRef(null);
  const stick = useRef(null);
  const abilitiesEl = useRef(null); // the crew member's abilities on foot, as a touch screen's buttons (in the cluster on a desktop)
  const powers = useRef(null); // the crew's two powers' tiles in it (PowerBar.jsx; the scene writes them: powers.js)
  const touch = useMediaQuery('(pointer: coarse)');
  const { economy } = useEconomy({ ask: false }); // (the wallet a bounty's paid off from)
  const hud = useRef(null);
  const siegeEl = useRef(null); // the Citadel's siege (siege.js)
  const prompt = useRef(null);
  const enterBtn = useRef(null); // into the world you're down on (landings/wayin.js): the scene shows it
  const [flown, setFlown] = useState(false);
  // out of the ship on a planet (the controls change), and where you could land
  const [onFoot, setOnFoot] = useState(false);
  const [looking, setLooking] = useState(null); // the look on foot: its mode, and whether the pointer's locked (scene.js's 'look')
  const [reticle, setReticle] = useState(null); // the crosshair on foot (runtime/hud's reticleState, scene.js's 'reticle')
  const [landable, setLandable] = useState(null);
  const [phoneNear, setPhoneNear] = useState(false); // at the phone out past the belt (phone.js): a touch button to pick it up
  const [footHint, setFootHint] = useState(false);
  // the place's name as you come down on a planet (landings.js)
  const [arrive, setArrive] = useState(null);
  const [controls, setControlsState] = useState(() => readControls(local.get(CONTROLS_KEY)));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aim, setAim] = useState(null); // (the star the nose is on: the scene's word, aim.js; { id, name })
  const setControls = (c) => {
    const next = readControls(c);
    setControlsState(next);
    local.set(CONTROLS_KEY, next);
  };
  // (the settings and the hangar sit in the same place: one at a time)
  const openSettings = useCallback(
    (on) => {
      setSettingsOpen(on);
      if (on) onHangar?.(false);
    },
    [onHangar],
  );
  const openHangar = useCallback(
    (on) => {
      onHangar?.(on);
      if (on) setSettingsOpen(false);
    },
    [onHangar],
  );
  const events = useRef(onEvent);
  events.current = onEvent;
  const reduced = useReducedMotion();
  const { host, on, meant, rt, progress } = useWorld(universeModule, {
    near: '0px', // (made once its box is in view, as useScene had it)
    props: {
      universe, // (the Expanse's seed: a pocket universe's, or the shared one; read once, the map is keyed on it)
      reduced,
      selected,
      ship,
      loadout,
      build,
      tune,
      skillFx, // (the skill tree's effects and the powers picked: hangar/skills's, the page's)
      powerPicks,
      controls,
      labels,
      stick,
      abilities: abilitiesEl,
      powers,
      wallet: economy,
      hud,
      siege: siegeEl,
      net,
      tags,
      prompt,
      enter: enterBtn,
      frozen: frozen || hangar, // (the Shipyard over it: nothing moves, nothing's drawn)
      drive,
      charting,
      startAt,
      onPick: onSelect,
      onOpen,
      onLand,
      onCrash,
    },
    // (a pocket universe is a map of its own: made afresh for its seed, never
    // the last one's adopted, which a remount for a new key would have had;
    // and made again when reduced motion is turned on or off, which the
    // scene reads once, as useScene made it again)
    rebuild: `${universe ?? 'shared'}|${reduced ? 'still' : 'moving'}`,
    // (what the scene says comes out through the runtime's events: useWorld's, not a prop)
    onEvent: (e) => {
      if (e.type === 'launch') setFlown(true);
      if (e.type === 'aim') setAim(e.id ? { id: e.id, name: e.name } : null);
      if (e.type === 'landable') setLandable(e.id);
      if (e.type === 'look') setLooking(e);
      if (e.type === 'reticle') setReticle(e.state);
      if (e.type === 'phone' && e.what !== 'open') setPhoneNear(e.what === 'near');
      if (e.type === 'foot' && e.id === 'arrive') setArrive({ title: e.title, sub: e.sub, at: Date.now() });
      if (e.type === 'foot' && e.id === 'out') {
        setOnFoot(true);
        setFootHint(true);
      }
      if (e.type === 'foot' && (e.id === 'off' || e.id === 'in')) {
        setOnFoot(false);
        setArrive(null);
      }
      events.current?.(e);
    },
  });
  // the scene itself, while it's the world on the runtime: its own calls (dive, travel, fire…)
  const view = useMemo(
    () => ({
      get current() {
        return rt?.current?.module === universeModule ? rt.current.world.scene : null;
      },
    }),
    [rt],
  );

  useEffect(() => {
    setFlown(false);
    setOnFoot(false);
  }, [ship]);
  // the first flight's basics (components/tour), as the ship's under you
  useEffect(() => {
    if (ship && on) askBrief('/universe/fly');
  }, [ship, on]);
  useEffect(() => {
    if (!arrive) return undefined;
    const t = setTimeout(() => setArrive(null), 6500);
    return () => clearTimeout(t);
  }, [arrive]);
  // the keys on foot, for a while after stepping out
  useEffect(() => {
    if (!footHint) return undefined;
    const t = setTimeout(() => setFootHint(false), 16000);
    return () => clearTimeout(t);
  }, [footHint]);

  // what the page needs from the map: whether it's drawing, the dive in,
  // Escape and the whole map while flying, and a Rick portal's far side
  // under its jump's flash
  useEffect(() => {
    if (!handle) return;
    handle.current = {
      live: on,
      dive: (id) => view.current?.dive?.(id) ?? 0,
      escape: () => view.current?.escape?.() ?? false,
      whole: () => view.current?.whole?.() ?? false,
      travel: (id, d) => view.current?.travel?.(id, d) ?? false,
      where: () => view.current?.where?.() ?? null,
      crossNow: () => view.current?.crossNow?.(),
    };
  }, [handle, on, view]);

  const focusable = selected ?? ORDER[0];
  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const to = keyStep(e.key, selected);
    if (to === undefined) return;
    e.preventDefault();
    onSelect(to);
    labels.current[to]?.focus();
  };

  // the touch buttons (FlightHud's grid: the held ones keep the finger till it lifts, so a thumb that drifts off doesn't let go)
  const buttons = {
    fire: (x) => view.current?.fire?.(x),
    boost: (x) => view.current?.boost?.(x),
    climb: (x) => view.current?.climb?.(x),
    view: onFoot ? () => view.current?.swap?.() : () => view.current?.seat?.(),
    weapon: onFoot ? null : () => view.current?.weapon?.(),
  };
  const refit = () => view.current?.refit?.(); // (the grid's size changed: the scene measures the open map again)

  return (
    <WorldHost world={{ host }} className="universe-map" data-ship={ship || undefined} data-foot={onFoot || undefined}>
      {meant ? (
        <>
          {/* (until the map is drawing: everything sent to the graphics chip first, so it flies smoothly from its first frame) */}
          <LoadingVeil className="universe-loading" shown={!on} progress={progress.value} step={progress.step} title="Charting the universe" />
          <ul className="universe-labels" aria-label="Universes" onKeyDown={onKeyDown}>
            {UNIVERSES.map((u) => (
              <li key={u.id}>
                <button
                  ref={(el) => {
                    labels.current[u.id] = el;
                  }}
                  type="button"
                  className="universe-label"
                  data-station={u.kind === 'core' || undefined}
                  // (a station's big sign says a second line the button doesn't: read it too)
                  aria-description={u.sign?.[1]}
                  style={{ '--swatch': u.swatch }}
                  aria-pressed={selected === u.id}
                  tabIndex={u.id === focusable ? 0 : -1}
                  onClick={() => onSelect(u.id)}
                  onPointerEnter={() => view.current?.hover?.(u.id)}
                  onPointerLeave={() => view.current?.hover?.(null)}
                  onFocus={() => view.current?.hover?.(u.id)}
                  onBlur={() => view.current?.hover?.(null)}
                >
                  {u.label}
                </button>
              </li>
            ))}
          </ul>
          <div ref={tags} className="universe-tags" aria-hidden="true" />
          {/* the corner's tools: the flight settings, the Hangar's door and
              the nav map (no box of its own on a desktop, where each keeps
              its place; on a phone, flying, a row along the top) */}
          <div className="universe-tools">
            {ship && on && !onFoot && <FlightSettings controls={controls} onChange={setControls} open={settingsOpen} onOpen={openSettings} />}
            {ship && on && !onFoot && canFit && <Hangar open={hangar} onOpen={openHangar} />}
            {on && onMap && (
              <button type="button" className="universe-navmap-btn" data-ship={ship ? '' : undefined} onClick={onMap} aria-label="Nav map" title="Nav map (M)" aria-keyshortcuts="M">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
                  <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z" fill="currentColor" />
                </svg>
              </button>
            )}
          </div>
          {ship && on && (
            <>
              {/* the flight HUD, the galaxy's own (the HUD kit's FlightHud): the stick's ring, the altitude, the cluster bottom
                  centre (the radar, the shields, the speed and the kills, the line picked, the target; health on foot), the law's
                  strip and the overlay, with the Citadel's siege, the prompt and the way in after it; the jump button; and the
                  thumbs' grid (the world's own buttons first: the powers or abilities, the portal gun, the way out, the phone) */}
              <FlightHud
                hudRef={hud}
                crosshair={<Reticle className="universe-foot-reticle" state={onFoot ? reticle : null} />}
                stickRef={stick}
                className="universe-cluster"
                foot={onFoot}
                vitalsIcon={<RiShieldLine aria-hidden="true" />}
                armsKeys
                // (a touch screen's powers and abilities are round buttons in the thumbs' grid)
                powers={!onFoot && !touch && <PowerBar ship={ship} reduced={reduced} barRef={powers} onPress={(slot) => view.current?.power?.(slot)} placement="cluster" picks={powerPicks} carry={skillFx?.carry} />}
                // (on foot: your crew member's two abilities, G and V; the scene writes their names and cooldowns)
                row={onFoot && !touch && <Abilities slots={FOOT_ABILITIES} />}
                overlay={
                  <div ref={siegeEl} className="universe-siege" role="status">
                    <b>The Citadel</b>
                    <span className="universe-siege-state" />
                  </div>
                }
                after={
                  <>
                    <p ref={prompt} className="universe-prompt" aria-live="polite" />
                    {/* (hidden until the crew are down on a planet with a world: the scene says when, and what it's called) */}
                    <button ref={enterBtn} type="button" className="universe-wayin" hidden onClick={() => view.current?.enter?.()}>
                      <span className="universe-wayin-label" />
                      <kbd className="universe-wayin-key" aria-hidden="true">
                        Enter
                      </kbd>
                    </button>
                  </>
                }
                jump={!onFoot && aim ? { className: 'universe-jump', name: aim.name ?? 'it', onPress: () => view.current?.travel?.(aim.id, 'hyper') } : null}
                controls={buttons}
                onThumbsFit={refit}
                thumbs={
                  <>
                    {!onFoot && touch && <PowerBar ship={ship} reduced={reduced} barRef={powers} onPress={(slot) => view.current?.power?.(slot)} picks={powerPicks} carry={skillFx?.carry} />}
                    {onFoot && touch && <Abilities slots={FOOT_ABILITIES} rootRef={abilitiesEl} onPress={(slot, down) => view.current?.ability?.(slot, down)} />}
                    {/* Rick's portal gun, in any ship: a portal ahead, to his dimension or home (gunPortal.js) */}
                    {!onFoot && (
                      <button type="button" className="universe-portalgun" onPointerDown={(e) => (e.preventDefault(), view.current?.portalGun?.())} onContextMenu={(e) => e.preventDefault()} title="Rick’s portal gun: a portal ahead, to his dimension (or home)">
                        <i className="universe-portalgun-swirl" aria-hidden="true" />
                        <span className="universe-portalgun-label">Portal</span>
                        <kbd aria-hidden="true">P</kbd>
                      </button>
                    )}
                    {onFoot && (
                      <button type="button" className="universe-out" onPointerDown={(e) => (e.preventDefault(), view.current?.out?.())} onContextMenu={(e) => e.preventDefault()}>
                        Board
                      </button>
                    )}
                    {!onFoot && !landable && phoneNear && (
                      <button type="button" className="universe-out" onClick={() => events.current?.({ type: 'phone', what: 'open' })}>
                        Phone
                      </button>
                    )}
                  </>
                }
              />
              {arrive && (
                <div className="universe-arrive" key={arrive.at} role="status">
                  <p className="universe-arrive-title">{arrive.title}</p>
                  {arrive.sub && <p className="universe-arrive-sub">{arrive.sub}</p>}
                </div>
              )}
              {onFoot && looking?.mode === 'lock' && !looking.locked && <Prompt k="" verb={LOOK_PROMPT} className="universe-look" onClick={() => view.current?.lookLock?.()} />}
              {onFoot && footHint && (
                <p className="universe-hint">
                  <span className="universe-hint-keys">
                    {/* the four that matter on foot; the guide has the rest */}
                    <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> walk, <kbd>F</kbd> fire, <kbd>G</kbd> <kbd>V</kbd> your abilities (<kbd>G</kbd> at the ship, back in), <kbd>Enter</kbd> into the world
                    <GuideCue />
                  </span>
                  <span className="universe-hint-touch">Drag to walk, Fire to shoot, the two round buttons your abilities, Board to get back in, Enter to go into the world<GuideCue touch /></span>
                </p>
              )}
              {!flown && !onFoot && (
                <p className="universe-hint universe-hint-fly">
                  <span className="universe-hint-keys">
                    {/* the five keys that matter in the first minute; the guide has the rest */}
                    <kbd>W</kbd> <kbd>S</kbd> throttle, arrows steer, <kbd>Space</kbd> boost, <kbd>F</kbd> fire, fly down into a planet’s air to go into its world
                    <GuideCue />
                  </span>
                  {/* (a phone held upright is told it flies better on its side: the page can't turn it) */}
                  <span className="universe-hint-touch">
                    Drag to fly<span className="universe-hint-more"> · hold Fire and Boost · fly down into a planet’s air to go in</span>
                    <span className="universe-hint-turn"> · Turn the phone on its side for more room</span>
                    <GuideCue touch />
                  </span>
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <div className="universe-flat">
          <MiniMap selected={selected} onSelect={onSelect} />
        </div>
      )}
    </WorldHost>
  );
}
