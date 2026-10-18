import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Hud, Menu, MenuItem, Prompt, Stick, Toast, TouchButton } from '../../../runtime/hud';
import { wayOut } from '../../worlds/worlds';

// The world's HUD over the city, on the runtime's HUD kit (src/runtime/hud):
// the title (a chip once he's flying), the time of day and one Menu, the
// compass with the objective line and the toasts under it, the gauge and the
// prompt at the foot, the map, and on a phone the thumbs over the gauge.
// ./InvWorld.jsx's frame loop writes the numbers straight into the elements
// `hud` holds (no re-render a frame), and draws the compass and the map on
// their canvases. The keys are the site's guide's (Controls opens it).

const TIME_NAME = { noon: 'Noon', dusk: 'Dusk', night: 'Night' };
const WHO = { cecil: 'Cecil', eve: 'Eve', omni: 'Dad', allen: 'Allen' };
const LORE = {
  off: 'Go online, and see everyone else flying the city as a pale Mark with their name over him',
  on: 'Everyone else online here shows as a pale Mark: nothing passes between you but where each of you is',
};

export default function InvHud({ hud, mapRef, time, cycleTime, chip, trav, found, cards, near, act, toast, radio = null, take = null, touch, onStick, startSound, hold, heroId = 'mark', heroes = [], pickHero = null, power = false }) {
  const heroName = heroes.find((h) => h.id === heroId)?.name ?? 'Mark';
  const set = (key) => (el) => (hud.current[key] = el);
  const { pathname } = useLocation();
  const centre = useRef(null);
  // (on a phone the map sits under the compass and the objective, however
  // tall the objective runs: measured, not a sum)
  useLayoutEffect(() => {
    const el = centre.current;
    const stage = el?.closest('.hud');
    if (!el || !stage) return undefined;
    const fit = () => {
      const top = stage.getBoundingClientRect().top;
      const lows = [hud.current.compass, hud.current.goal].map((n) => (n?.offsetHeight ? n.getBoundingClientRect().bottom - top : 0));
      stage.style.setProperty('--iw-map-top', `${Math.round(Math.max(...lows) + 10)}px`);
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    for (const n of [stage, hud.current.compass, hud.current.goal]) if (n) ro?.observe(n);
    return () => ro?.disconnect();
  }, [hud]);

  return (
    <Hud
      className="iw-hud"
      touch={touch}
      order="thumbs-over"
      brand={
        <div className="iw-brand" ref={set('brand')} data-chip={chip || undefined}>
          <p className="iw-eyebrow">Invincible · the Graysons’ city</p>
          <h2 id="iw-title" className="iw-title">
            Fly, {heroName === 'Mark' ? 'Mark' : heroName}.
          </h2>
        </div>
      }
      tools={
        <div className="iw-tools" ref={set('tools')}>
          {/* the time of day: the one place it's read from */}
          <button type="button" className="iw-btn iw-time" onClick={cycleTime} aria-label={`Time of day: ${TIME_NAME[time]}. Change it.`}>
            {TIME_NAME[time]}
          </button>
          <Menu className="iw-menu" players={{ available: trav.available, on: trav.on, count: trav.count, onJoin: trav.join }} lore={LORE} way={wayOut(pathname)}>
            <MenuItem onClick={cycleTime} keep>
              Time of day: <b>{TIME_NAME[time]}</b>
            </MenuItem>
            <span data-on>
              Title cards found: <b>{found}</b> of {cards}
            </span>
            <a href="#inv-game">
              Think, Mark!
            </a>
            {/* who to fly as (./heroes.js): the earned ones pick, the rest say what they want */}
            {heroes.map((h) =>
              h.can ? (
                <MenuItem key={h.id} onClick={() => pickHero?.(h.id)} keep>
                  Fly as <b>{h.name}</b>
                  {h.id === heroId ? ' · now' : ''}
                </MenuItem>
              ) : (
                <span key={h.id} data-on>
                  {h.name}: {h.lock}
                </span>
              ),
            )}
          </Menu>
        </div>
      }
      foot={
        <>
          <div className="iw-gauge" aria-hidden="true">
            <p className="iw-speed">
              <span ref={set('speed')}>0</span>
              <small>km/h</small>
              <em className="iw-zone" ref={set('zone')}>
                City
              </em>
            </p>
            <div className="iw-bar">
              <i ref={set('bar')} />
            </div>
            <p className="iw-mach" ref={set('mach')}>
              Standing
            </p>
            <p className="iw-alt">
              <span>Height</span> <b ref={set('alt')}>0 m</b>
            </p>
          </div>
          <div className="iw-mid">
            {/* a call on the radio: the key first, as every prompt (R takes it) */}
            {radio && (
              <button type="button" className="iw-radio" onClick={take} aria-live="polite">
                {!touch && <kbd>R</kbd>} <b>{WHO[radio.who] ?? radio.who}</b> {radio.text}
              </button>
            )}
            {near && <Prompt className="iw-prompt" k="E" thing={near.name} touch={touch} onClick={act} />}
          </div>
        </>
      }
      thumbs={
        <>
          <Stick className="iw-stick" onMove={onStick} onStart={startSound} label="Fly" />
          <div className="iw-buttons">
            <TouchButton {...hold('touchUp')}>Up</TouchButton>
            <TouchButton {...hold('touchDown')}>Down</TouchButton>
            <TouchButton className="iw-boost" {...hold('touchBoost')}>
              Boost
            </TouchButton>
            {power && (
              <TouchButton className="iw-power" {...hold('touchPower')}>
                Power
              </TouchButton>
            )}
            <TouchButton className="iw-punch" {...hold('touchPunch')}>
              Punch
            </TouchButton>
          </div>
        </>
      }
    >
      {/* under the top row, centred: the compass, what to do next, and what just happened */}
      <div className="iw-centre" ref={centre}>
        <canvas className="iw-compass" ref={set('compass')} aria-hidden="true" />
        <p className="iw-goal" ref={set('goal')} aria-live="polite" />
        <Toast className="iw-toast" toast={toast} />
      </div>
      <canvas className="iw-map" ref={mapRef} aria-hidden="true" />
    </Hud>
  );
}
