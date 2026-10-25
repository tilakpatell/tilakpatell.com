import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import RmEarnNote from '../RmEarnNote';
import { PowerBar } from '../../universe/shared/powerBar';
import { Link as RouterLink } from 'react-router-dom';
import { RiArrowDownLine, RiArrowLeftLine, RiArrowUpLine, RiCheckLine, RiCloseLine, RiCrosshair2Line, RiEmotionLaughLine, RiEyeLine, RiGroupLine, RiHeart3Line, RiHome4Line, RiListCheck2, RiFlashlightLine, RiLiveLine, RiPlantLine, RiSafe2Line, RiSearchEyeLine, RiSettings3Line, RiShieldLine, RiShirtLine, RiTimerLine, RiToolsLine, RiTyphoonLine, RiVipCrownLine, RiVipDiamondLine } from 'react-icons/ri';
import { EMOTES, wheelAngle } from '../../../lib/emote';
import { local } from '../../../lib/hooks';
import { Arms, Cluster, Prompt, Reticle, Stick, TouchButton, Vitals, createFlightCluster, reticleState } from '../../../runtime/hud';
import { enemyShare, heartsToHealth } from './vitalsOf';
import { PROMPT as LOOK_PROMPT } from '../../../runtime/look';
import GuideCue from '../../guide/GuideCue';
import Wardrobe from '../wardrobe/Wardrobe';
import DimensionDial from './dimensions/DimensionDial';
import { TOUCH_FOOT } from './dimensions/dialKey';
import { ROOMS } from './dimensions/vindicatorsRules';
import { destinationById } from './dimensions/destinations';
import { METER, meterOf } from './games/meter';
import { listOf } from './planetMode';
import { firstHint } from './portalGun';
import { MEMORIES, MEMORY_COLORS } from './rules';
import { SAY } from './say';
import { setShipVoice, shipVoiceOn, stopSpeaking } from './shipVoice';
import { Title, Toast } from './WorldCards';
import { EPISODES } from '../adventure/episodes';
import EpisodeCard from '../adventure/EpisodeCard';
import { listNext, listTab } from '../adventure/hud';
import StoryList from '../adventure/StoryList';
import { useAdventure } from '../adventure/useAdventure';
import { homeLink } from '../adventure/ways';
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

// the gun in Morty's hand in a duel, on the kit's Arms (no rack: it never runs dry)
const HAND_GUN = { name: 'Rick’s gun', line: 'primary', index: 0, ammo: 0, max: 0, filling: 0 };

// a place's game's meter, its icon by the kind, or the place's own (./games/meter.js)
const METER_ICON = { power: <RiFlashlightLine aria-hidden="true" />, deal: <RiSearchEyeLine aria-hidden="true" />, freeze: <RiEyeLine aria-hidden="true" />, find: <RiTimerLine aria-hidden="true" />, sequence: <RiLiveLine aria-hidden="true" />, climb: <RiPlantLine aria-hidden="true" />, gem: <RiVipDiamondLine aria-hidden="true" />, cog: <RiSettings3Line aria-hidden="true" />, crown: <RiVipCrownLine aria-hidden="true" />, safe: <RiSafe2Line aria-hidden="true" /> };

export default function RmHud({
  touch,
  gl,
  hud,
  planet,
  game,
  prog,
  objective,
  card,
  closeCard,
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
  dialItems,
  dialLead,
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
  onHangar = null,
  clusterRef = null,
  chargeRef = null,
  chargeLine = null,
  chaseRef = null,
  chaseLine = null,
  onShipFire = null,
  onWeapon = null,
  powersRef = null,
  onPower = null,
  powerPicks = null,
  carry = null,
}) {
  // Where the top row ends (the taller of the title's column and the map's),
  // measured, for what hangs under it on a phone (./world.css --rm-under):
  // the toast and the cruiser's caption sit just under it however tall the
  // objective or the chips make it, never over them. And where the title's
  // column alone ends (--rm-under-l), for the toast on a wider screen.
  const top = useRef(null);
  // (the game the place Morty's in runs, if any: its meter's name)
  // (in the street, its one meter is the stone's at the park's pond)
  const meter = hud.area === 'street' ? { kind: 'skip', ...METER.skip } : (meterOf(destinationById(hud.area)) ?? { kind: 'power', ...METER.power });
  // a duel: Morty's health and his gun on the HUD kit's cluster (his hearts
  // on the one scale: ./vitalsOf.js), written when the duel changes
  const footRef = useRef(null);
  const [footCluster] = useState(createFlightCluster);
  const health = duel ? heartsToHealth(duel.mortyHp, duel.mortyMax) : null;
  const healthValue = health?.value ?? null;
  const healthLow = health?.low ?? false;
  useLayoutEffect(() => {
    const on = healthValue !== null;
    footCluster.place(footRef.current, { on, vitals: on ? { value: healthValue, max: 100, low: healthLow } : null, arms: on ? HAND_GUN : null });
  }, [footCluster, healthValue, healthLow]);
  useLayoutEffect(() => {
    const row = top.current;
    const stage = row?.parentElement;
    if (!stage) return undefined;
    const fit = () => {
      const from = stage.getBoundingClientRect().top;
      const bottom = Math.max(0, ...Array.from(row.children, (n) => n.getBoundingClientRect().bottom - from));
      stage.style.setProperty('--rm-under', `${Math.round(bottom)}px`);
      const left = row.querySelector('.rm-brand');
      if (left) stage.style.setProperty('--rm-under-l', `${Math.round(left.getBoundingClientRect().bottom - from)}px`);
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(stage);
    for (const n of row.children) ro?.observe(n);
    return () => ro?.disconnect();
  }, []);
  // And the prompt card's height while it's up (nought when it's not), for a
  // place's meter over it on a phone (./world.css --rm-prompt-h): a name on
  // two lines, or the E key's button in a narrow window, makes it taller
  const prompt = useRef(null);
  const prompting = gl === 'on' && Boolean(here);
  useLayoutEffect(() => {
    const card = prompt.current;
    const stage = top.current?.parentElement;
    if (!stage || !card) return undefined;
    const fit = () => stage.style.setProperty('--rm-prompt-h', `${Math.round(card.getBoundingClientRect().height)}px`);
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(card);
    return () => {
      ro?.disconnect();
      stage.style.setProperty('--rm-prompt-h', '0px');
    };
  }, [prompting]);
  // (a planet landed on from the map: back to space, or home to C-137's garage)
  const home = homeLink(planet);
  const back1 = (
    <RouterLink to={back.to} replace={back.replace} className="rm-back">
      <RiArrowLeftLine aria-hidden="true" /> {back.label}
    </RouterLink>
  );
  const way = home ? (
    <div className="rm-ways">
      {back1}
      <RouterLink to={home.to} state={home.state} className="rm-back">
        <RiHome4Line aria-hidden="true" /> {home.label}
      </RouterLink>
    </div>
  ) : (
    back1
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
                <b>{duel.name ?? SAY[duel.who]?.who ?? 'Them'}</b>
                <span className="rm-fight-bar" style={{ '--v': enemyShare(duel.hp, duel.max) / 100 }} aria-hidden="true">
                  <i />
                </span>
                <em>{enemyShare(duel.hp, duel.max)}%</em>
              </div>
              <span className="sr-only">Morty: {health.value} of 100.</span>
              <span className="rm-fight-hint">{touch ? 'The star fires. Keep out of reach.' : 'F fires (RT on a pad). Keep out of reach.'}</span>
              {!touch && <span className="rm-fight-hint">Tab locks on (LT on a pad): Morty turns to face them.</span>}
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
          {onHangar ? (
            <button type="button" className="rm-chip rm-hangar-btn" onClick={onHangar} aria-haspopup="dialog" aria-label="Hangar: the crew’s looks, and the cruiser’s arms, powers, skills and shipyard" aria-keyshortcuts="H">
              <RiToolsLine aria-hidden="true" />
              <span>Hangar</span>
              {!touch && <kbd>H</kbd>}
            </button>
          ) : (
            <button type="button" className="rm-chip" onClick={onWardrobe} aria-haspopup="dialog" aria-label="Wardrobe: how Morty and Rick look">
              <RiShirtLine aria-hidden="true" />
              <span>Wardrobe</span>
              {!touch && <kbd>C</kbd>}
            </button>
          )}
          {!planet && !game && !duel && !hud.flying && <GunChip touch={touch} onOpen={openDial} />}
          <OtherMortys trav={trav} where={planet ? 'here' : 'in the street'} />
        </div>
      </div>
      <Wardrobe open={wardrobe} onClose={closeWardrobe} looks={looks} onLook={setLook} who="morty" />
      {/* (on touch the feet say tap, not the keys: ./dimensions/dialKey.js) */}
      <DimensionDial open={dialing} items={dialItems} lead={dialLead} value={dialValue} onPick={pickDial} onClose={closeDial} foot={touch ? TOUCH_FOOT.gun : undefined} />
      <DimensionDial open={!!trial} items={trialItems} value={null} onPick={pickTrial} onClose={closeTrial} title={`Rick’s rooms · ${(trial?.room ?? 0) + 1} of ${ROOMS.length}`} lead={trial ? ROOMS[trial.room].prompt : null} foot={touch ? TOUCH_FOOT.rooms : '↑ ↓ to choose, Enter to pick, Esc to back out'} label="Rick’s rooms" />

      <Toast toast={toast} />
      {card != null && <EpisodeCard episode={EPISODES[card] ?? null} n={card + 1} onDone={closeCard} />}
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
        <div ref={prompt} className="rm-prompt" data-kind={here.kind}>
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
              <span>
                <kbd>F</kbd> fire
              </span>
              <span>
                <kbd>R</kbd> weapon
              </span>
              <span>Slow down over open ground, then E to land</span>
            </>
          )}
        </p>
      )}

      {/* in a duel: Morty's health and his gun, the same kit's cluster */}
      <Cluster rootRef={footRef} className="rm-cluster" label="Morty">
        <Vitals label="Morty" icon={<RiHeart3Line aria-hidden="true" />} className="rm-cluster-vitals" />
        <Arms className="rm-cluster-arms" />
      </Cluster>
      {/* in the cruiser: its deflectors and its guns, the HUD kit's cluster in the show's ink (the frame loop writes it) */}
      {clusterRef && (
        <Cluster rootRef={clusterRef} className="rm-cluster" label="The cruiser">
          <Vitals label="Deflectors" icon={<RiShieldLine aria-hidden="true" />} className="rm-cluster-vitals" />
          {/* (the chase through the rings: the hits it can still take, and the ring it's on) */}
          {chaseRef && (
            <div ref={chaseRef} className="rm-chase">
              <Vitals label="Hits" icon={<RiCrosshair2Line aria-hidden="true" />} className="rm-cluster-vitals">
                <span ref={chaseLine} className="hud-line" />
              </Vitals>
            </div>
          )}
          <Arms className="rm-cluster-arms" keys={!touch} />
          {onPower && <PowerBar ship="cruiser" reduced={false} barRef={powersRef} onPress={onPower} placement="cluster" picks={powerPicks} carry={carry} />}
        </Cluster>
      )}
      {/* in a place that runs a game (./games/meter.js): its meter, named by the kind (the world's charge and the cells carried; the deal's looks; who's looking; the pick-up's time), the same kit's cluster (the frame loop writes it) */}
      {chargeRef && (
        <Cluster rootRef={chargeRef} className={`rm-cluster rm-meter rm-meter-${meter.kind}`} label={meter.title}>
          <Vitals label={meter.label} icon={METER_ICON[meter.icon ?? meter.kind]} className="rm-cluster-vitals">
            <span ref={chargeLine} className="hud-line" />
          </Vitals>
        </Cluster>
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
                  {/* the cruiser's guns: held, they keep firing; the next line on its own button */}
                  {onShipFire && (
                    <TouchButton
                      className="rm-fire"
                      aria-label="Fire"
                      onPress={(e) => {
                        e.preventDefault();
                        onShipFire(true);
                      }}
                      onRelease={() => onShipFire(false)}
                    >
                      ✦
                    </TouchButton>
                  )}
                  {onWeapon && (
                    <TouchButton
                      className="rm-lock"
                      size={52}
                      aria-label="Next weapon"
                      onPress={(e) => {
                        e.preventDefault();
                        onWeapon();
                      }}
                    >
                      Weapon
                    </TouchButton>
                  )}
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

      {list && <ThingsToDo box={listBox} prog={prog} done={done} onClose={closeList} back={back} planet={planet} here={hud.area} touch={touch} />}
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

// The list (M), in two tabs: the story so far (../adventure/StoryList.jsx),
// and every thing to do, ticked when it's done, with where to go for the rest
// (on a planet, its own and a line for the rest: ./planetMode.js's listOf;
// on touch, the rows that name a key say their buttons); then the cruiser's
// voice, and Free roam (every place on the dial open).
function ThingsToDo({ box, prog, done, onClose, back, planet, here, touch }) {
  const [voice, setVoice] = useState(shipVoiceOn);
  const story = useAdventure();
  // (the Story tab while there's a story to follow, the Checklist once it's over)
  const [tab, setTab] = useState(() => listTab(story.state));
  const over = listTab(story.state) === 'checklist';
  // (the Citadel's scenes made, to tick its step if made before it came up)
  const [citadel] = useState(() => local.get('tp-citadel-done', []));
  const { label, rows, rest } = listOf(planet, done, { touch });
  const home = homeLink(planet);
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
      <div className="switch rm-list-tabs" data-size="menu" role="tablist" aria-label="Things to do">
        {[
          ['story', 'Story'],
          ['checklist', 'Checklist'],
        ].map(([id, name]) => (
          <button key={id} type="button" role="tab" id={`rm-tab-${id}`} aria-selected={tab === id} aria-controls="rm-list-panel" onClick={() => setTab(id)}>
            {name}
          </button>
        ))}
      </div>
      <div className="rm-list-panel" id="rm-list-panel" role="tabpanel" aria-labelledby={`rm-tab-${tab}`}>
        {tab === 'story' ? <StoryList state={story.state} tasks={done} citadel={citadel} /> : <Checklist rows={rows} rest={rest} next={planet ? prog.next : listNext(story.state, prog.next, rows, { here })} />}
      </div>
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
      {!over && (
        <label className="rm-list-switch">
          <input type="checkbox" checked={story.state.freeRoam} onChange={(e) => story.setFreeRoam(e.target.checked)} />
          <span>
            Free roam
            <span className="rm-list-sub">Every place on the dial, open.</span>
          </span>
        </label>
      )}
      <RouterLink to={back.to} replace={back.replace} className="rm-list-back">
        <RiArrowLeftLine aria-hidden="true" /> {back.label}
      </RouterLink>
      {home && (
        <RouterLink to={home.to} state={home.state} className="rm-list-back">
          <RiHome4Line aria-hidden="true" /> {home.label}
        </RouterLink>
      )}
    </div>
  );
}

// the Checklist tab: every thing to do, ticked when it's done, and (on a planet) a line for the rest
function Checklist({ rows, rest, next }) {
  return (
    <>
      <ol>
        {rows.map((t) => (
          <li key={t.id} data-done={t.done || undefined} data-next={next?.id === t.id || undefined}>
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
    </>
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

// The portal gun's chip: it opens the dial. On a phone held upright, where a
// chip's words go (world.css), it keeps its own: the first hint and the guide
// name it.
export function GunChip({ touch, onOpen }) {
  return (
    <button type="button" className="rm-chip rm-chip-gun" onClick={onOpen} aria-haspopup="dialog" aria-label="Portal gun: pick where Rick’s garage portal goes">
      <RiTyphoonLine aria-hidden="true" />
      <span>Portal gun</span>
      {!touch && <kbd>P</kbd>}
    </button>
  );
}

// Others online in the street: how many, or a way to see them (going online
// is the site's own switch, with your callsign, as on the universe map). Its
// icon and name stay on a phone, where a chip's words go.
export function OtherMortys({ trav, where }) {
  if (!trav.available) return null;
  if (!trav.on)
    return (
      <button type="button" className="rm-chip" onClick={trav.join} title={`Go online, and see everyone else ${where} as a Morty from another dimension`} aria-label={`See other Mortys: go online, and see everyone else ${where} as a Morty from another dimension`}>
        <RiGroupLine aria-hidden="true" />
        <span>See other Mortys</span>
      </button>
    );
  return (
    <span className="rm-chip" role="img" title={`Everyone else online ${where} shows as a Morty from another dimension: they can’t touch your things to do, nor you theirs`} aria-label={`${trav.count} ${trav.count === 1 ? 'other Morty' : 'other Mortys'} ${where}`}>
      <RiGroupLine aria-hidden="true" />
      <b>{trav.count}</b>
      <span>{trav.count === 1 ? 'other Morty' : 'other Mortys'} here</span>
    </span>
  );
}
