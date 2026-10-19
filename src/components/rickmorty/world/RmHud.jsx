import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import RmEarnNote from '../RmEarnNote';
import { Link as RouterLink } from 'react-router-dom';
import { RiArrowDownLine, RiArrowLeftLine, RiArrowUpLine, RiCheckLine, RiCloseLine, RiEmotionLaughLine, RiListCheck2, RiShirtLine, RiTyphoonLine } from 'react-icons/ri';
import { EMOTES, wheelAngle } from '../../../lib/emote';
import { Prompt, Reticle, Stick, TouchButton, reticleState } from '../../../runtime/hud';
import { PROMPT as LOOK_PROMPT } from '../../../runtime/look';
import GuideCue from '../../guide/GuideCue';
import Wardrobe from '../wardrobe/Wardrobe';
import { DIAL } from './dimensions/destinations';
import DimensionDial from './dimensions/DimensionDial';
import { ROOMS } from './dimensions/vindicatorsRules';
import { listOf } from './planetMode';
import { firstHint } from './portalGun';
import { MEMORIES, MEMORY_COLORS } from './rules';
import { SAY } from './say';
import { setShipVoice, shipVoiceOn, stopSpeaking } from './shipVoice';
import { Title, Toast } from './WorldCards';
import '../adventure/adventure.css';

// Dimension C-137's HUD, over the stage (./RmWorld.jsx keeps the canvas, the
// fades and the loading veil, and everything the HUD reads and does): the
// title and what to do on the left, the map and the chips on the right, the
// toasts and captions, the prompt, Total Rickall's crosshair and cards, the
// hints, the thumbs on touch (the way back under the title there, at the
// foot on a keyboard), and the list.
// Moved out of RmWorld.jsx as it was, so that file has room to breathe.
// The stick and the held buttons are the HUD kit's (src/runtime/hud), in
// C-137's own look; the spacing is the kit's tokens (./world.css).

const EMOTE_NAME = { wave: 'Wave', cheer: 'Cheer', dance: 'Dance', taunt: 'Taunt', sit: 'Sit' };

export default function RmHud({
  touch,
  gl,
  hud,
  planet,
  game,
  prog,
  objective,
  duel,
  clock,
  placeName,
  list,
  done,
  trav,
  wardrobe,
  looks,
  dialing,
  dialValue,
  trial,
  trialItems,
  toast,
  shipLine,
  memory,
  here,
  back,
  wheelUi,
  touchWheel,
  mapSize,
  brand,
  map,
  chip,
  listBox,
  recall,
  onStickStart,
  stopRickall,
  onToggleList,
  onWardrobe,
  closeWardrobe,
  setLook,
  openDial,
  pickDial,
  closeDial,
  pickTrial,
  closeTrial,
  act,
  tellRickall,
  shootRickall,
  startRickall,
  onPickEmote,
  onCloseWheel,
  onToggleWheel,
  onStick,
  looking,
  onLookLock,
  onJump,
  onLift,
  onFire,
  locked = false,
  onLock,
  closeList,
  earned = null,
}) {
  // Where the top row ends (the taller of the title's column and the map's),
  // measured, for what hangs under it on a phone (./world.css --rm-under):
  // the toast and the cruiser's caption sit just under it however tall the
  // objective or the chips make it, never over them.
  const top = useRef(null);
  useLayoutEffect(() => {
    const row = top.current;
    const stage = row?.parentElement;
    if (!stage) return undefined;
    const fit = () => {
      const from = stage.getBoundingClientRect().top;
      const bottom = Math.max(0, ...Array.from(row.children, (n) => n.getBoundingClientRect().bottom - from));
      stage.style.setProperty('--rm-under', `${Math.round(bottom)}px`);
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(stage);
    for (const n of row.children) ro?.observe(n);
    return () => ro?.disconnect();
  }, []);
  const way = (
    <RouterLink to={back.to} replace={back.replace} className="rm-back">
      <RiArrowLeftLine aria-hidden="true" /> {back.label}
    </RouterLink>
  );
  return (
    <>
      <RmEarnNote note={earned} />
      <div ref={top} className="rm-hud rm-hud-top">
        <div ref={brand} className="rm-brand">
          <Title name={planet?.name} />
          {game ? (
            <p className="rm-objective rm-rickall-status" aria-live="polite">
              <span className="rm-swirl rm-swirl-sm" aria-hidden="true" />
              <span>{game.phase === 'hatching' ? 'The egg’s hatching…' : game.phase === 'over' ? 'Total Rickall' : `Total Rickall: ${game.left} ${game.left === 1 ? 'parasite' : 'parasites'} left`}</span>
              {game.phase === 'on' && (
                <b className="rm-rickall-clock" aria-hidden="true">
                  {Math.floor(game.secs / 60)}:{String(game.secs % 60).padStart(2, '0')}
                </b>
              )}
            </p>
          ) : (
            <p className="rm-objective" aria-live="polite">
              <span className="rm-swirl rm-swirl-sm" aria-hidden="true" />
              <span>
                {objective.to ? (
                  <RouterLink to={objective.to} className="rm-objective-link">
                    {objective.text}
                  </RouterLink>
                ) : (
                  objective.text
                )}
              </span>
            </p>
          )}
          {duel && (
            <div className="rm-fight" aria-live="polite">
              <div className="rm-fight-row">
                <b>{SAY[duel.who]?.who ?? 'Them'}</b>
                <span className="rm-fight-hearts" aria-label={`${duel.hp} of ${duel.max}`}>
                  {Array.from({ length: duel.max }, (_, i) => (
                    <span key={i} data-off={i >= duel.hp || undefined}>
                      ♥
                    </span>
                  ))}
                </span>
              </div>
              <div className="rm-fight-row">
                <b>Morty</b>
                <span className="rm-fight-hearts" aria-label={`${duel.mortyHp} of ${duel.mortyMax}`}>
                  {Array.from({ length: duel.mortyMax }, (_, i) => (
                    <span key={i} data-off={i >= duel.mortyHp || undefined}>
                      ♥
                    </span>
                  ))}
                </span>
              </div>
              <span className="rm-fight-hint">F fires. Keep out of reach.</span>
            </div>
          )}
          {clock != null && (
            <div className="rm-clock" data-late={clock <= 10 || undefined} aria-live="polite">
              Back through the portal: {clock} s
            </div>
          )}
          {hud.flying && (
            <p className="rm-flightstats" aria-live="off">
              <span>
                Height <b>{hud.alt}</b> m
              </span>
              <span>
                Speed <b>{hud.kmh}</b> km/h
              </span>
            </p>
          )}
          {/* (on touch the stick has the way back's corner: it's under what to do instead) */}
          {touch && way}
        </div>
        <div className="rm-side">
          <figure className="rm-map">
            <canvas ref={map} width={mapSize[0]} height={mapSize[1]} aria-hidden="true" />
            <figcaption>{placeName}</figcaption>
          </figure>
          {game && (
            <button type="button" className="rm-chip rm-chip-stop" onClick={stopRickall} aria-label="Stop the game">
              <RiCloseLine aria-hidden="true" />
              <span>Stop the game</span>
              {!touch && <kbd>Esc</kbd>}
            </button>
          )}
          <button ref={chip} type="button" className="rm-chip" onClick={onToggleList} aria-expanded={list} aria-controls="rm-list" aria-label={`Things to do, ${prog.count} of ${prog.total} done`}>
            <RiListCheck2 aria-hidden="true" />
            <span>Things to do</span>
            <b>
              {prog.count}/{prog.total}
            </b>
            {!touch && <kbd>M</kbd>}
          </button>
          <button type="button" className="rm-chip" onClick={onWardrobe} aria-haspopup="dialog" aria-label="Wardrobe: how Morty and Rick look">
            <RiShirtLine aria-hidden="true" />
            <span>Wardrobe</span>
            {!touch && <kbd>C</kbd>}
          </button>
          {!planet && !game && !duel && !hud.flying && (
            <button type="button" className="rm-chip" onClick={openDial} aria-haspopup="dialog" aria-label="Portal gun: pick where Rick’s garage portal goes">
              <RiTyphoonLine aria-hidden="true" />
              <span>Portal gun</span>
              {!touch && <kbd>P</kbd>}
            </button>
          )}
          <OtherMortys trav={trav} where={planet ? 'here' : 'in the street'} />
        </div>
      </div>
      <Wardrobe open={wardrobe} onClose={closeWardrobe} looks={looks} onLook={setLook} who="morty" />
      <DimensionDial open={dialing} items={DIAL} value={dialValue} onPick={pickDial} onClose={closeDial} />
      <DimensionDial open={!!trial} items={trialItems} value={null} onPick={pickTrial} onClose={closeTrial} title={`Rick’s rooms · ${(trial?.room ?? 0) + 1} of ${ROOMS.length}`} lead={trial ? ROOMS[trial.room].prompt : null} foot="↑ ↓ to choose, Enter to pick, Esc to back out" label="Rick’s rooms" />

      <Toast toast={toast} />
      {shipLine && hud.area === 'street' && (
        <p className="rm-shipline" role="status" key={shipLine.at}>
          <span className="rm-shipline-eyes" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>
            <b>The ship</b> {shipLine.text}
          </span>
        </p>
      )}
      {memory && hud.area === 'mindblowers' && (
        <div className="rm-memory" role="status" key={memory.at} style={{ '--vial': MEMORY_COLORS[memory.color] }}>
          <p className="rm-memory-head">
            <span className="rm-memory-vial" aria-hidden="true" />
            Memory {memory.i + 1} of {MEMORIES.length}
          </p>
          <p className="rm-memory-text">{memory.caption}</p>
          <p className="rm-memory-hint">{touch ? 'Tap for the next one; walk away to stop.' : 'E for the next one; walk away to stop.'}</p>
        </div>
      )}

      {gl === 'on' && here && (
        <div className="rm-prompt" data-kind={here.kind}>
          <p className="rm-prompt-name">{here.name}</p>
          {!touch && (
            <button type="button" className="rm-btn" onClick={act}>
              <kbd className="key-first">E</kbd> {here.verb}
            </button>
          )}
        </div>
      )}

      {/* Total Rickall: the crosshair, whoever's in it, what's remembered of them, how it ended */}
      {gl === 'on' && <Reticle className="rm-reticle" state={reticleState(null, { gun: game?.phase === 'on', lock: game?.aim })} />}
      {/* the look's prompt (runtime/look.js), while the pointer isn't locked and nothing else is asked */}
      {gl === 'on' && !touch && looking?.mode === 'lock' && !looking.locked && !here && !(game?.phase === 'on' && game.aim) && <Prompt k="" verb={LOOK_PROMPT} className="rm-look" onClick={onLookLock} />}
      {gl === 'on' && game?.told && (
        <div ref={recall} className="rm-recall" role="status" key={game.told.n}>
          <p className="rm-recall-head">
            What you remember of <b>{game.told.name}</b>
          </p>
          <p className="rm-recall-text">{game.told.text}</p>
        </div>
      )}
      {gl === 'on' && game?.phase === 'on' && game.aim && (
        <div className="rm-prompt" data-kind="aim">
          <p className="rm-prompt-name">{game.aim.name}</p>
          {!touch && (
            <div className="rm-prompt-acts">
              <button type="button" className="rm-btn rm-btn-ghost" onClick={tellRickall}>
                <kbd className="key-first">E</kbd> Remember
              </button>
              <button type="button" className="rm-btn rm-btn-shoot" onClick={shootRickall}>
                <kbd className="key-first">F</kbd> Shoot
              </button>
            </div>
          )}
        </div>
      )}
      {gl === 'on' && game?.phase === 'on' && !game.aim && (
        <p className="rm-hint">
          {touch
            ? 'Turn till someone’s in the crosshair, then Remember, or Shoot. A parasite only ever leaves good memories.'
            : 'Turn till someone’s in the crosshair: E for what you remember of them, F or a click to shoot. A parasite only ever leaves good memories.'}
        </p>
      )}
      {gl === 'on' && game?.end && <Ending end={game.end} onAgain={() => startRickall()} onLeave={stopRickall} />}
      {gl === 'on' && (wheelUi || touchWheel) && !hud.flying && (
        <EmoteWheel
          hover={wheelUi?.hover ?? null}
          touch={touch}
          onPick={onPickEmote}
          onClose={onCloseWheel}
        />
      )}

      {gl === 'on' && !here && !game && !hud.flying && !hud.moved && (
        <p className="rm-hint">{firstHint({ touch, planet: !!planet })}<GuideCue touch={touch} /></p>
      )}
      {gl === 'on' && hud.flying && !here && (
        <p className="rm-hint rm-keys">
          {touch ? (
            'The stick flies; hold the arrows to climb and drop. Slow down over open ground to land.'
          ) : hud.landing ? (
            'Setting down…'
          ) : (
            <>
              <span>
                <kbd>W</kbd>
                <kbd>S</kbd> speed
              </span>
              <span>
                <kbd>A</kbd>
                <kbd>D</kbd> steer
              </span>
              <span>
                <kbd>Space</kbd> up
              </span>
              <span>
                <kbd>Shift</kbd> down
              </span>
              <span>Slow down over open ground, then E to land</span>
            </>
          )}
        </p>
      )}

      <div className="rm-hud rm-hud-bottom">
        {touch ? (
          <>
            <Stick className="rm-stick" onMove={onStick} onStart={onStickStart} reach={46} />
            <div className="rm-pad">
              {!hud.flying && (
                <div className="rm-lift">
                  <TouchButton aria-label="Jump" onPress={onJump}>
                    <RiArrowUpLine aria-hidden="true" />
                  </TouchButton>
                  {!game && (
                    <button type="button" className="rm-emote-btn" aria-label="Emote" aria-haspopup="menu" aria-expanded={touchWheel} onClick={onToggleWheel} onContextMenu={(e) => e.preventDefault()}>
                      <RiEmotionLaughLine aria-hidden="true" />
                    </button>
                  )}
                  {duel && (
                    <TouchButton
                      className="rm-fire"
                      aria-label="Fire"
                      onPress={(e) => {
                        e.preventDefault();
                        onFire();
                      }}
                    >
                      ✦
                    </TouchButton>
                  )}
                  {/* the lock-on, in a fight (Tab on a keyboard): the sights kept on who they're on */}
                  {(duel || game) && (
                    <TouchButton
                      className="rm-lock"
                      size={52}
                      aria-label="Lock on"
                      aria-pressed={locked}
                      data-on={locked || undefined}
                      onPress={(e) => {
                        e.preventDefault();
                        onLock?.();
                      }}
                    >
                      Lock
                    </TouchButton>
                  )}
                </div>
              )}
              {hud.flying && (
                <div className="rm-lift">
                  <TouchButton aria-label="Climb" onPress={() => onLift(1)} onRelease={() => onLift(0)}>
                    <RiArrowUpLine aria-hidden="true" />
                  </TouchButton>
                  <TouchButton aria-label="Drop" onPress={() => onLift(-1)} onRelease={() => onLift(0)}>
                    <RiArrowDownLine aria-hidden="true" />
                  </TouchButton>
                </div>
              )}
              {game ? (
                <>
                  <button type="button" className="rm-act rm-act-alt" data-idle={!game.aim || undefined} onClick={tellRickall}>
                    Remember
                  </button>
                  <button type="button" className="rm-act rm-act-shoot" data-idle={!game.aim || undefined} onClick={shootRickall}>
                    Shoot
                  </button>
                </>
              ) : (
                <button type="button" className="rm-act" data-idle={!here || undefined} onClick={act}>
                  {here ? here.verb : hud.flying ? 'Land' : 'Use'}
                </button>
              )}
            </div>
          </>
        ) : (
          way
        )}
      </div>

      {list && <ThingsToDo box={listBox} prog={prog} done={done} onClose={closeList} back={back} planet={planet} />}
    </>
  );
}

// The emote wheel: the five round the middle of the view, the one the
// mouse is over lit (B held: let go to strike it), each a button to click
// or tap, with its number key; Esc or the middle puts it away.
function EmoteWheel({ hover, touch, onPick, onClose }) {
  return (
    <div className="rm-wheel" role="menu" aria-label="Emotes">
      <button type="button" className="rm-wheel-mid" onClick={onClose} aria-label="Put the emotes away">
        {touch ? 'Pick one' : 'Let go of B over one'}
      </button>
      {EMOTES.map((id, i) => (
        <button key={id} type="button" role="menuitem" className="rm-wheel-item" data-on={hover === id || undefined} style={{ '--x': `${(Math.sin(wheelAngle(i)) * 118).toFixed(1)}px`, '--y': `${(-Math.cos(wheelAngle(i)) * 118).toFixed(1)}px` }} onClick={() => onPick(id)}>
          <span>{EMOTE_NAME[id]}</span>
          {!touch && <kbd>{i + 1}</kbd>}
        </button>
      ))}
    </div>
  );
}

// The list (M): every thing to do, ticked when it's done, with where to go for the rest (on a
// planet, its own and a line for the rest: ./planetMode.js's listOf); and the cruiser's voice.
function ThingsToDo({ box, prog, done, onClose, back, planet }) {
  const [voice, setVoice] = useState(shipVoiceOn);
  const { label, rows, rest } = listOf(planet, done);
  return (
    <div ref={box} className="rm-list" id="rm-list" role="region" aria-label={label}>
      <div className="rm-list-head">
        <p>
          Things to do <b>{prog.count}</b>/{prog.total}
        </p>
        <button type="button" className="rm-icon-btn" onClick={onClose} aria-label="Close the list">
          <RiCloseLine aria-hidden="true" />
        </button>
      </div>
      <ol>
        {rows.map((t) => (
          <li key={t.id} data-done={t.done || undefined} data-next={prog.next?.id === t.id || undefined}>
            <span className="rm-tick" aria-hidden="true">
              {t.done && <RiCheckLine />}
            </span>
            <div>
              <p className="rm-list-name">
                {t.name}
                {t.done && <span className="sr-only"> (done)</span>}
              </p>
              {!t.done && <p className="rm-list-sub">{t.hint}</p>}
            </div>
          </li>
        ))}
      </ol>
      {rest && <p className="rm-list-rest">{rest}</p>}
      <label className="rm-list-switch">
        <input
          type="checkbox"
          checked={voice}
          onChange={(e) => {
            setShipVoice(e.target.checked);
            setVoice(e.target.checked);
            if (!e.target.checked) stopSpeaking();
          }}
        />
        <span>The ship’s voice</span>
      </label>
      <RouterLink to={back.to} replace={back.replace} className="rm-list-back">
        <RiArrowLeftLine aria-hidden="true" /> {back.label}
      </RouterLink>
    </div>
  );
}

// How Total Rickall ended, on a card over the room: again, or leave it there
// (the focus on again, so Enter plays again)
function Ending({ end, onAgain, onLeave }) {
  const again = useRef(null);
  useEffect(() => {
    again.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="rm-ending" data-kind={end.kind} role="dialog" aria-labelledby="rm-ending-title" aria-describedby="rm-ending-line">
      <p className="rm-ending-where">Total Rickall</p>
      <h3 id="rm-ending-title" className="rm-ending-title">
        {end.title}
      </h3>
      <p id="rm-ending-line" className="rm-ending-line">
        {end.line}
      </p>
      <div className="rm-ending-acts">
        <button ref={again} type="button" className="rm-btn" onClick={onAgain}>
          Play again
        </button>
        <button type="button" className="rm-btn rm-btn-ghost" onClick={onLeave}>
          Leave it there
        </button>
      </div>
    </div>
  );
}

// Others online in the street: how many, or a way to see them (going online
// is the site's own switch, with your callsign, as on the universe map).
function OtherMortys({ trav, where }) {
  if (!trav.available) return null;
  if (!trav.on)
    return (
      <button type="button" className="rm-chip" onClick={trav.join} title={`Go online, and see everyone else ${where} as a Morty from another dimension`}>
        <span>See other Mortys</span>
      </button>
    );
  return (
    <span className="rm-chip" title={`Everyone else online ${where} shows as a Morty from another dimension: they can’t touch your things to do, nor you theirs`}>
      <b>{trav.count}</b>
      <span>{trav.count === 1 ? 'other Morty' : 'other Mortys'} here</span>
    </span>
  );
}
