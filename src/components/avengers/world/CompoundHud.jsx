import { useLocation } from 'react-router-dom';
import { audioContext } from '../../../lib/audio';
// the kit by its parts: its barrel (index.js) brings the Battlefront screens and their data
import '../../../runtime/hud/hud.css';
import Hud from '../../../runtime/hud/Hud.jsx';
import Menu, { MenuItem } from '../../../runtime/hud/Menu';
import Objective from '../../../runtime/hud/Objective';
import Toast from '../../../runtime/hud/Toast';
import Bubble from '../../../runtime/hud/Bubble';
import Stick from '../../../runtime/hud/Stick';
import TouchButton from '../../../runtime/hud/TouchButton';
import { wayOut } from '../../worlds/worlds';
import { PACKS, PHOTO, SETTINGS, SETTINGS_DEFAULTS } from './rules';
import { STONES } from '../../interests/stones';
import GuideCue from '../../guide/GuideCue';
import { clock, stoneFor, stoneLine } from './labels';

// The compound's HUD, on the runtime's HUD kit (src/runtime/hud), in the
// compound's own Stark glass (world.css skins the kit's parts): the title
// and the objective, with the tour's clock under it while one's on; on the
// right the map, the stones, the backpacks and one Menu (the buildings, the
// settings, photo mode, the swing tour, the players, the site's guide and
// the way out); the doors' cards and the hints over the foot, and on a
// phone the thumbs. ./CompoundWorld.jsx's frame loop writes the numbers that
// change every frame straight into the elements it holds the refs of (no
// re-render a frame) and draws the map. The keys are the site's guide's
// (Controls opens it): guide/pages.js.
const LORE = {
  off: 'Go online, and see everyone else walking the compound as a hologram',
  on: 'Everyone else online here shows as a hologram: they can’t touch your games, nor you theirs',
};

export default function CompoundHud({ touch, gl, prog, hud, sim, enter, portal, trav, list, setList, tuning, setTuning, photo, photoMode, changePhoto, onSavePhoto, settings, changeSettings, tourMsg, pack, trick, styleRef, tourRef, map, bubble, bubbleRef, tourBest, styleBest, found, toTour, travel, onStick }) {
  const { pathname } = useLocation();
  const here = hud.near ? prog.places.find((p) => p.id === hud.near) : null;
  const herePortal = hud.portal && !here;
  const won = prog.places.filter((p) => p.done).length;
  const openList = () => {
    setList((v) => !v);
    setTuning(false);
  };
  const openSettings = () => {
    setTuning((v) => !v);
    setList(false);
  };
  // the thumbs: each wakes the sound in the touch's own event (iOS wants it there)
  const press = (fn) => () => {
    audioContext();
    fn(sim.current);
  };
  return (
    <>

      <Hud
        className="cw-hud"
        touch={touch}
        brand={
          <div className="cw-brand">
            <p className="cw-eyebrow">The Avengers compound · Upstate New York</p>
            <h1 id="cw-title" className="cw-title">
              Avengers HQ
            </h1>
            <Objective className="cw-objective" glyph="▲" text={prog.objective} />
            {/* the swing tour's clock, while one's on: the race, by what it's for */}
            <p ref={tourRef} className="cw-chip cw-tour-on" aria-live="off" />
          </div>
        }
        tools={
          <div className="cw-side">
            <canvas ref={map} className="cw-map" width="150" height="150" aria-hidden="true" />
            <p className="cw-chip cw-stones" aria-label={`${prog.stones} of 6 Infinity Stones won back`}>
              {STONES.map((st) => (
                <i key={st.id} className="stone-dot" data-on={prog.have.includes(st.id) || undefined} style={{ '--glow': st.color }} />
              ))}
              <b>{prog.stones}</b> of 6
            </p>
            <p className="cw-chip cw-packs" title="Peter’s backpacks, webbed up round the compound: on the roofs, up the masts, under the bridge. Walk up to one." aria-label={`${found} of ${PACKS.length} backpacks found`}>
              <span aria-hidden="true">🎒</span> <b>{found}</b> of {PACKS.length}
            </p>
            {/* the rest, in one Menu (M, O and P still open theirs straight off) */}
            <Menu className="cw-menu" players={{ available: trav.available, on: trav.on, count: trav.count, onJoin: trav.join }} lore={LORE} way={wayOut(pathname)}>
              <MenuItem onClick={openList} aria-expanded={list}>
                Things to do · {won}/{prog.places.length} {!touch && <kbd>M</kbd>}
              </MenuItem>
              <MenuItem onClick={openSettings} aria-expanded={tuning} aria-controls="cw-settings">
                Settings {!touch && <kbd>O</kbd>}
              </MenuItem>
              <MenuItem onClick={() => photoMode(true)} title="Stop time, put the camera anywhere round him, and save a picture">
                Photo {!touch && <kbd>P</kbd>}
              </MenuItem>
              <MenuItem className="cw-tour" onClick={toTour} title="Rings round the compound, against the clock: through the first red ring to start">
                Swing tour {tourBest != null && <b>{clock(tourBest)}</b>}
              </MenuItem>
              {styleBest > 0 && (
                <span data-on title="The most style banked in one flight: flips, twists and perfect releases, one after another, and a landing">
                  Best style <b>{styleBest.toLocaleString()}</b>
                </span>
              )}
            </Menu>
          </div>
        }
        thumbs={
          <>
            <Stick className="cw-stick" onMove={onStick} onStart={audioContext} reach={46} label="Walk" />
            <TouchButton
              size={76}
              className="cw-jump"
              onPress={press((s) => {
                s.jump = true;
                s.touchWeb = true;
              })}
              onRelease={() => (sim.current.touchWeb = false)}
            >
              {hud.suit ? 'Up' : 'Jump'}
              {!hud.suit && <small>hold: swing</small>}
            </TouchButton>
            <div className="cw-acts">
              <TouchButton
                size={52}
                className="cw-jump cw-zip"
                onPress={press((s) => {
                  if (s.h.mode === 'suit') s.touchDown = true;
                  else s.zip = true;
                })}
                onRelease={() => (sim.current.touchDown = false)}
              >
                {hud.suit ? 'Down' : 'Zip'}
              </TouchButton>
              <TouchButton size={52} className="cw-jump cw-zip" onPress={press((s) => (s.perch = true))}>
                Perch
              </TouchButton>
              <TouchButton
                size={52}
                className="cw-jump cw-zip"
                onPress={press((s) => {
                  if (s.h.mode === 'suit') s.suit = true;
                  else s.trick = true;
                })}
              >
                {hud.suit ? 'Step out' : 'Trick'}
              </TouchButton>
            </div>
          </>
        }
      >
        {bubble && <Bubble ref={bubbleRef} className="cw-bubble" name={bubble.name} line={bubble.line} />}

        {/* at a door: the key first, as the guide writes it ("E Go in") */}
        {here && (
          <div className="cw-door" style={{ '--cw-accent': here.accent }}>
            <p className="cw-door-sub">{here.where}</p>
            <p className="cw-door-name">{here.name}</p>
            <p className="cw-door-stone" style={{ '--glow': stoneFor(here)?.color ?? here.accent }}>
              {stoneFor(here) && <i className="stone-dot" data-on={here.done || undefined} aria-hidden="true" />}
              {stoneLine(here)}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => enter(here.id)}>
              {!touch && <kbd>E</kbd>} {here.act}
            </button>
          </div>
        )}
        {hud.armour && !here && (
          <div className="cw-door" style={{ '--cw-accent': '#ffb347' }}>
            <p className="cw-door-sub">By the workshop’s door</p>
            <p className="cw-door-name">An Iron Man armour</p>
            <p className="cw-door-stone">Tony left one out. It flies: {touch ? 'Up and Down to climb and come down, the stick to fly, Step out to get out' : 'Space up, Shift down, W A S D to fly, E to step out'}.</p>
            <button type="button" className="btn btn-primary" onClick={() => (sim.current.suit = true)}>
              {!touch && <kbd>E</kbd>} Suit up
            </button>
          </div>
        )}
        {herePortal && (
          <div className="cw-door cw-door-portal" style={{ '--cw-accent': '#6cc8ff' }}>
            <p className="cw-door-sub">Over the helipad</p>
            <p className="cw-door-name">The portal</p>
            <p className="cw-door-stone">Titan is on the other side, and Thanos with it.</p>
            <button type="button" className="btn btn-primary" onClick={portal}>
              {!touch && <kbd>E</kbd>} Go through
            </button>
          </div>
        )}

        {/* the first hint: how to move and the one thing that's Spider-Man's; the rest is the guide's */}
        {gl === 'on' && hud.suit && (
          <p className="cw-hint">
            {touch ? 'Hold Up to climb, Down to come down, the stick to fly. Step out gets out of the armour.' : 'Space to climb, Shift to come down, W A S D to fly; it leans into its speed. E steps out of the armour, wherever you are.'}
            <GuideCue touch={touch} />
          </p>
        )}
        {gl === 'on' && !hud.moved && !here && !herePortal && !hud.suit && (
          <p className="cw-hint">
            {touch ? 'Stick to walk; hold Jump in the air to swing.' : 'W A S D to walk, Space to jump; hold Space in the air to swing.'}
            <GuideCue touch={touch} />
          </p>
        )}

        {/* what just happened (the tour), top centre under the top row */}
        <Toast className="cw-tour-msg" toast={tourMsg ? { key: tourMsg, text: tourMsg } : null} />

        {photo && <PhotoBar photo={photo} onChange={changePhoto} onSave={onSavePhoto} onClose={() => photoMode(false)} touch={touch} />}
        {tuning && <Settings id="cw-settings" settings={settings} onChange={changeSettings} onClose={() => setTuning(false)} />}
        {list && (
          <div className="cw-list" role="dialog" aria-label="The buildings on the compound">
            <div className="cw-list-head">
              <p>Things to do</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setList(false)}>
                Close
              </button>
            </div>
            <p className="cw-list-flavour">The buildings on the compound</p>
            <ol>
              {prog.places.map((p, i) => (
                <li key={p.id} data-done={p.done || undefined} data-next={p.id === prog.next || undefined} style={{ '--glow': stoneFor(p)?.color ?? p.accent, '--cw-accent': p.accent }}>
                  <span className="cw-list-n" aria-hidden="true">
                    {p.done ? '✓' : i + 1}
                  </span>
                  <div>
                    <p className="cw-list-name">{p.name}</p>
                    <p className="cw-list-sub">
                      {p.where} · {stoneLine(p)}
                    </p>
                  </div>
                  <div className="cw-list-acts">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => travel(p.id)}>
                      Go there
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => enter(p.id)}>
                      {p.act}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Hud>

      {/* the game's moments, over the HUD as they always were: a backpack found, a trick, the style so far */}
      {pack && (
        <div key={pack.n} className="cw-pack" role="status">
          <p className="cw-pack-n">
            Backpack {pack.n} of {PACKS.length} · {pack.where}
          </p>
          <p className="cw-pack-what">{pack.memento}</p>
          <p className="cw-pack-line">“{pack.line}”</p>
        </div>
      )}
      {trick && (
        <p key={trick.n} className={`cw-trick ${trick.cls}`} aria-live="polite">
          {trick.text}
          {trick.combo > 1 ? <b> ×{trick.combo}</b> : null}
        </p>
      )}
      <p ref={styleRef} className="cw-style" aria-live="off" />
    </>
  );
}

// The settings (rules.js's SETTINGS), from the Settings chip (or O): how the
// view turns, how far back the camera sits, how much a swing helps you
// round, how the camera follows, how much it kicks. Every change is live and
// kept between visits. Not modal: the compound stays playable behind it.
const shown = (r, v) => (r.toggle ? (v ? 'On' : 'Off') : v === 0 ? 'Off' : `${Math.round(v * 100)}%`);
function Settings({ id, settings, onChange, onClose }) {
  return (
    <section id={id} className="cw-list cw-set" role="dialog" aria-label="Settings">
      <div className="cw-list-head">
        <p>Settings</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="cw-set-rows">
        {Object.entries(SETTINGS).map(([k, r]) => {
          const v = settings[k];
          return (
            <label key={k} className="cw-set-row">
              <span className="cw-set-top">
                <span className="cw-list-name">{r.label}</span>
                <output>{shown(r, v)}</output>
              </span>
              {r.toggle ? (
                <input type="checkbox" checked={Boolean(v)} onChange={(e) => onChange({ ...settings, [k]: e.target.checked ? 1 : 0 })} aria-describedby={`${id}-${k}`} />
              ) : (
                <input
                  type="range"
                  min={r.min}
                  max={r.max}
                  step={r.step}
                  value={v}
                  style={{ '--fill': `${((v - r.min) / (r.max - r.min)) * 100}%` }}
                  onChange={(e) => onChange({ ...settings, [k]: Number(e.target.value) })}
                  // (dragged with a mouse or a thumb, it lets go of the arrow keys again)
                  onPointerUp={(e) => e.currentTarget.blur()}
                  aria-describedby={`${id}-${k}`}
                />
              )}
              <span id={`${id}-${k}`} className="cw-list-sub">
                {r.hint}
              </span>
            </label>
          );
        })}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...SETTINGS_DEFAULTS })}>
          Back to how it came
        </button>
      </div>
    </section>
  );
}

// Photo mode's bar: the lens and the distance (the drag turns the camera,
// the wheel brings it in), a picture saved, and the way back.
function PhotoBar({ photo, onChange, onSave, onClose, touch }) {
  const row = (label, k, [min, max], step, shown) => (
    <label className="cw-photo-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={photo[k]} style={{ '--fill': `${((photo[k] - min) / (max - min)) * 100}%` }} onChange={(e) => onChange({ [k]: Number(e.target.value) })} onPointerUp={(e) => e.currentTarget.blur()} />
      <output>{shown}</output>
    </label>
  );
  return (
    <section className="cw-photo cw-set" role="dialog" aria-label="Photo mode">
      <p className="cw-photo-title">Photo mode</p>
      <p className="cw-photo-hint">{touch ? 'Drag to move the camera round him.' : 'Drag to move the camera round him, scroll to bring it in, [ and ] for the lens.'}</p>
      {row('Lens', 'fov', PHOTO.fov, 1, `${Math.round(photo.fov)}°`)}
      {row('Distance', 'dist', PHOTO.dist, 0.1, `${photo.dist.toFixed(1)} m`)}
      <div className="cw-photo-acts">
        <button type="button" className="btn btn-primary btn-sm" onClick={onSave}>
          Save the picture
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Back {!touch && <kbd>P</kbd>}
        </button>
      </div>
    </section>
  );
}
