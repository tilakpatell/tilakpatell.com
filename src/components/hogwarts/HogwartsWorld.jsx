import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMediaQuery, useReducedMotion } from '../../lib/hooks';
import { WorldHost, useWorld } from '../../runtime';
import { Bubble, Hud, Letterbox, Menu, MenuItem, Objective, Prompt, QuestList, Stick, Toast, TouchButton } from '../../runtime/hud';
import { wayOut } from '../worlds/worlds';
import hogwartsModule from './module';
import SpellWheel from './hud/SpellWheel';
import './hud/match.css';
import MaraudersMap from './hud/MaraudersMap';
import PointsChip from './hud/PointsChip';
import Feast from './hud/Feast';
import { useAchievements } from '../Achievements';
import { parseWeek } from './rules/term';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import './hogwarts.css';

// What the shore says: the way in at the boats, and what it says back for
// now (the castle and its rooms are the next lanes': the toast, one
// sentence, the site's own words)
const NOT_YET = 'The boats go when the castle is ready.';
const TOAST_FOR = 4000; // ms

// Hogwarts' face: the HUD from the kit over the world (module.js), skinned
// as parchment and ink (hogwarts.css). The title, the one Menu (Things to
// do, empty until the term starts; Controls, the site's guide; the way out
// by the view you came from), the one Prompt at the boats (on touch it is
// the button itself, as the kit has it), a toast, and on touch the stick.
// The wand's card at the foot and its wheel over the view
// (hud/SpellWheel.jsx), its toasts in the one toast, and on touch a Cast
// button and a Spells one. On a broom: the Menu's Snitch practice and a
// match, the match's line under the title (the score, or how far the
// Snitch is), the commentator in the kit's Bubble over his box, and on
// touch Up, Down and Catch. The Marauder’s Map (hud/MaraudersMap.jsx) is
// the minimap, opened on M, from the Menu or with a tap of its disc; it
// reads the world’s night every frame through `map()`, never through React.
const SAID_FOR = 5000; // ms a commentator's line stays up
// the classes on the Menu, until the term's lane sends you to them in their rooms
const LESSON_ITEMS = [
  ['charms', 'Charms: the feather'],
  ['potions', 'Potions: a Cure for Boils'],
  ['herbology', 'Herbology: the Mandrakes'],
  ['buckbeak', 'Buckbeak'],
  ['duel', 'The duelling club'],
  ['boggart', 'The boggart'],
];
export default function HogwartsWorld() {
  const { pathname, search } = useLocation();
  const reduced = useReducedMotion();
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const narrow = useMediaQuery('(max-width: 639px)');
  const [props] = useState(() => ({ reduced, week: parseWeek(search) ?? 1 }));
  const [door, setDoor] = useState(null);
  const [toast, setToast] = useState(null);
  const [list, setList] = useState(false);
  const [spell, setSpell] = useState('lumos');
  const [wheel, setWheel] = useState(false);
  const [riding, setRiding] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [said, setSaid] = useState(null);
  const [next, setNext] = useState(1);
  const [objective, setObjective] = useState(null);
  // the term's view (play/school.js): the week, the quests, the points; it changes now and then, not every frame
  const [term, setTerm] = useState(null);
  const [cup, setCup] = useState(null);
  const chip = useRef(null);
  const { unlock } = useAchievements();
  const unlockRef = useRef(unlock);
  unlockRef.current = unlock;
  const [choices, setChoices] = useState(null);
  const [ride, setRide] = useState(false);
  const menu = useRef(null);
  const line = useRef(null);
  const bubble = useRef(null);
  const card = useRef(null);
  const ring = useRef(null);
  const map = useRef(null);

  const onEvent = useCallback((e) => {
    if (e.type === 'near') setDoor(e.door);
    else if (e.type === 'go') setToast({ key: Date.now(), text: NOT_YET });
    else if (e.type === 'menu') menu.current?.querySelector('.hud-btn')?.click();
    else if (e.type === 'toast') setToast({ key: Date.now(), text: e.text });
    else if (e.type === 'wheel') setWheel(e.open);
    else if (e.type === 'broom') setRiding(e.riding);
    else if (e.type === 'objective') setObjective(e.text);
    else if (e.type === 'school') {
      setTerm(e);
      chip.current?.readout(e);
    } else if (e.type === 'cup') {
      chip.current?.flash(e.delta);
      chip.current?.readout({ ...e, standings: null });
    } else if (e.type === 'achievement') unlockRef.current?.(e.id);
    else if (e.type === 'choices') setChoices(e.title ? e : null);
    else if (e.type === 'ride') setRide(e.on);
    else if (e.type === 'said') setSaid({ key: Date.now(), name: e.who, line: e.text });
    else if (e.type === 'match') {
      // (the score written straight in, a few times a second; only its coming and going re-renders)
      setPlaying(Boolean(e));
      if (e && line.current) line.current.textContent = e.practice ? `Catch the Snitch · ${e.near} m off` : `${e.home} ${e.us} · ${e.away} ${e.them} · catch the Snitch`;
    } else if (e.type === 'result') setNext((n) => (n % 3) + 1);
    else if (e.type === 'wand') {
      // (the rings are written straight in; only a change of spell re-renders)
      card.current?.readout(e);
      ring.current?.readout(e);
      setSpell(e.active);
    }
  }, []);
  const { host, status, rt } = useWorld(hogwartsModule, { props, onEvent });
  const api = useCallback(() => (rt?.current?.module === hogwartsModule ? rt.current.world : null), [rt]);
  const night = useCallback(() => api()?.map?.() ?? null, [api]);
  // the term as it stands when the world comes on (after that, its 'school' events)
  useEffect(() => {
    if (status !== 'on') return;
    const v = api()?.school?.();
    if (!v) return;
    setTerm(v);
    chip.current?.readout(v);
  }, [status, api]);
  const choose = useCallback((id) => {
    api()?.choose(id);
    setSpell(id);
    if (touch) setWheel(false);
  }, [api, touch]);

  useEffect(() => {
    if (!said) return undefined;
    const t = setTimeout(() => setSaid(null), SAID_FOR);
    return () => clearTimeout(t);
  }, [said]);
  // the commentator's bubble, handed to the world to move over his box
  const onBubble = useCallback(
    (el) => {
      bubble.current = el;
      api()?.bubble?.(el);
    },
    [api],
  );
  const press = useCallback((name, down) => api()?.press(name, down), [api]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), TOAST_FOR);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <WorldHost world={{ host }} className="hogwarts-stage">
      {status !== 'on' && <p className="hogwarts-loading">The lamps are being lit along the shore…</p>}
      <Hud
        className="hogwarts-hud"
        touch={touch}
        brand={
          <>
            <p className="hogwarts-brand">
              <span className="hogwarts-brand-eyebrow">The shore of the Black Lake</span>
              <span className="hogwarts-brand-name">Hogwarts</span>
            </p>
            {playing ? <Objective ref={line} className="hogwarts-objective" /> : (objective ?? term?.objective?.text) && <Objective className="hogwarts-objective" text={objective ?? term.objective.text} />}
          </>
        }
        tools={
          <div ref={menu} className="hogwarts-tools">
            <PointsChip ref={chip} house={term?.house ?? 'gryffindor'} />
            <Menu className="hogwarts-menu" way={wayOut(pathname)} todo={{ onOpen: () => setList(true), done: term?.done ?? 0, total: term?.total ?? 0 }}>
              {term?.leaving && (
                <MenuItem onClick={() => setCup(api()?.feast() ?? null)}>The leaving feast</MenuItem>
              )}
              <MenuItem onClick={() => map.current?.open()} aria-keyshortcuts="M">
                The Marauder’s Map
              </MenuItem>
              {!riding && <MenuItem onClick={() => api()?.fly()}>Fly</MenuItem>}
              <MenuItem onClick={() => api()?.lesson('flying')}>The flying lesson</MenuItem>
              {LESSON_ITEMS.map(([id, name]) => (
                <MenuItem key={id} onClick={() => api()?.lesson(id)}>
                  {name}
                </MenuItem>
              ))}
              <MenuItem onClick={() => api()?.practice()}>Snitch practice</MenuItem>
              <MenuItem onClick={() => api()?.match(next)}>Quidditch: match {next} of 3</MenuItem>
            </Menu>
          </div>
        }
        foot={
          <>
            <SpellWheel part="card" ref={card} active={spell} touch={touch} />
            {door ? <Prompt k="E" verb={door.verb ?? 'Go in'} thing={door.label} touch={touch} onClick={() => api()?.go()} /> : <span />}
          </>
        }
        thumbs={
          riding ? (
            <>
              <Stick className="hogwarts-stick" onMove={(x, y) => api()?.stick(x, y)} label="Fly" />
              {playing && (
                <TouchButton size={76} onPress={() => press('catch', true)} onRelease={() => press('catch', false)} aria-label="Catch the Snitch">
                  Catch
                </TouchButton>
              )}
              <TouchButton size={64} onPress={() => press('rise', true)} onRelease={() => press('rise', false)} aria-label="Up">
                Up
              </TouchButton>
              <TouchButton size={52} onPress={() => press('sink', true)} onRelease={() => press('sink', false)} aria-label="Down">
                Down
              </TouchButton>
            </>
          ) : (
            <>
              <Stick className="hogwarts-stick" onMove={(x, y) => api()?.stick(x, y)} label="Walk" />
              <TouchButton size={76} onPress={() => api()?.press('cast', true)} onRelease={() => api()?.press('cast', false)} aria-label="Cast the spell on the wand">
                Cast
              </TouchButton>
              <TouchButton size={52} onPress={() => setWheel((w) => !w)} aria-label="Spells">
                Spells
              </TouchButton>
            </>
          )
        }
      >
        <Toast toast={toast} className="hogwarts-toast" />
        <MaraudersMap ref={map} source={night} touch={touch} narrow={narrow} reduced={reduced} onOpen={() => unlock('hp-map')} />
        {said && <Bubble key={said.key} ref={onBubble} className="hogwarts-bubble" name={said.name} line={said.line} />}
        {choices && (
          <div className="hogwarts-choices" role="group" aria-label={choices.title}>
            <p className="hogwarts-choices-title">{choices.title}</p>
            {choices.options.map((o) => (
              <button key={o.n} type="button" className="hogwarts-choice" onClick={() => api()?.pick(o.n)}>
                <kbd className="hud-cap">{o.n}</kbd> {o.text}
              </button>
            ))}
          </div>
        )}
        <Letterbox on={ride} />
        <SpellWheel part="wheel" ref={ring} open={wheel} active={spell} onChoose={choose} touch={touch} />
        {list && <QuestList className="hogwarts-list" title="Things to do" sub={term ? `${term.label}: ${term.done} of ${term.total} done.` : 'The term begins once you’re across the lake.'} quests={term?.list ?? []} next={term?.objective?.id ?? null} onClose={() => setList(false)} onGo={() => {}} />}
        {cup && (
          <Feast
            cup={cup}
            onClose={() => setCup(null)}
            onNextYear={() => {
              api()?.nextYear();
              setCup(null);
            }}
          />
        )}
      </Hud>
    </WorldHost>
  );
}
