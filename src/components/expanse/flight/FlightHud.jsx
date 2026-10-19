import { Hud, Menu, MenuItem, PlayersChip, Prompt, Stick, Toast, TouchButton } from '../../../runtime/hud';
import LifeLine from './LifeLine';
import EventLine from './EventLine';
import FlightMap from './FlightMap';

// The flight's HUD, from the kit: the planet's name top left, the one Menu
// top right (the way out, and the planets to fly to next), the toast under
// the top row, and at the foot the speed and the height over the ground,
// written by the page into the refs it holds (numbers through refs, not
// state). On touch, the kit's stick flies it and two buttons work the
// throttle. `map`: { spec, source } for the planet map (./FlightMap). The
// shared world (./shared.js) adds its prompt at the foot, B to build or X by
// one of your own (the button itself on touch), and the other pilots near
// you in the Menu.
//
//   <FlightHud name way planets onPlanet toast numbers touch onStick onThrottle map shared onShared online />
//   shared: { build, unbuild, others, allies } | null; onShared('build' | 'unbuild'); online: { on, onJoin }
export default function FlightHud({ name, way, planets = [], onPlanet, toast, numbers, touch = false, onStick, onThrottle, map = null, shared = null, onShared, online = null }) {
  const take = shared?.unbuild ? <Prompt k="X" verb="Take down" thing="your turret" touch={touch} onClick={() => onShared('unbuild')} /> : null;
  const prompt = shared?.build ? <Prompt k="B" verb="Build turret" touch={touch} onClick={() => onShared('build')} alt={take} /> : take;
  return (
    <Hud
      className="fly-hud"
      touch={touch}
      brand={
        <div className="fly-brand">
          <p className="fly-eyebrow">Planet flight</p>
          <h1 className="fly-title">{name}</h1>
          <EventLine />
        </div>
      }
      tools={
        <Menu className="fly-menu" way={way}>
          {online && <PlayersChip item count={shared?.others ?? 0} allies={shared?.allies ?? 0} on={online.on} onJoin={online.onJoin} noun="pilots" />}
          {planets.map((p) => (
            <MenuItem key={p.id} onClick={() => onPlanet(p.id)}>
              Fly over <b>{p.name}</b>
            </MenuItem>
          ))}
        </Menu>
      }
      foot={
        <>
          {prompt}
          <p className="fly-gauge" aria-hidden="true">
            <span ref={(el) => (numbers.current.speed = el)}>0</span>
            <small>m/s</small>
            <span ref={(el) => (numbers.current.alt = el)}>0</span>
            <small>m up</small>
          </p>
        </>
      }
      thumbs={
        <div className="fly-thumbs">
          <Stick className="fly-stick" label="Fly" onMove={onStick} />
          <div className="fly-throttle">
            <TouchButton size={52} onPress={() => onThrottle(1)} onRelease={() => onThrottle(0)} aria-label="Faster">
              +
            </TouchButton>
            <TouchButton size={52} onPress={() => onThrottle(-1)} onRelease={() => onThrottle(0)} aria-label="Slower">
              −
            </TouchButton>
          </div>
        </div>
      }
    >
      <Toast toast={toast} className="fly-toast" />
      <LifeLine />
      {map && <FlightMap {...map} touch={touch} />}
    </Hud>
  );
}
