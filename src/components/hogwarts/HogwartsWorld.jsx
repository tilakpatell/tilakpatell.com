import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useMediaQuery, useReducedMotion } from '../../lib/hooks';
import { WorldHost, useWorld } from '../../runtime';
import { Bubble, Hud, Letterbox, Menu, MenuItem, Objective, Prompt, QuestList, Stick, Toast, TouchButton, letterbox } from '../../runtime/hud';
import { wayOut } from '../worlds/worlds';
import hogwartsModule from './module';
import SortingCard from './hud/SortingCard';
import WandCard, { Scarf } from './hud/WandCard';
import WordCard from './hud/WordCard';
import SpellWheel from './hud/SpellWheel';
import { houseColours } from './rules/sorting';
import './hud/match.css';
import MaraudersMap from './hud/MaraudersMap';
import { parseWeek } from './rules/term';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import './hogwarts.css';

// What the shore says: the way in at the boats, and what it says back for
// now (the castle and its rooms are the next lanes': the toast, one
// sentence, the site's own words)
const TOAST_FOR = 4000; // ms
const WAND_FOR = 9000; // ms the wand's card stays after the Sorting
const SORTED_FOR = 11000; // ms the house's card stays
// a line's time on screen: long enough to read slowly
const lineFor = (text) => Math.max(2800, 900 + text.length * 52);

// Hogwarts' face: the HUD from the kit over the world (module.js), skinned
// as parchment and ink (hogwarts.css). The title, the one Menu (Things to
// do, empty until the term starts; the arrival again; Controls, the site's
// guide; the way out by the view you came from), the one Prompt (at the
// boats, Enter to skip the arrival once it has been seen, Esc out of a
// room; on touch it is the button itself, as the kit has it), a toast, and
// on touch the stick. The wand's card at the foot and its wheel over the
// view (hud/SpellWheel.jsx), its toasts in the one toast, and on touch a
// Cast button and a Spells one, out on the grounds. The arrival (Lane D)
// adds the letterbox, its subtitles, the Sorting's card and the wand's;
// once sorted, the frame takes the house's colours and its scarf hangs in
// the corner.
// On a broom: the Menu's Snitch practice and a match, the match's line
// under the title (the score, or how far the Snitch is), the commentator in
// the kit's Bubble over his box, and on touch Up, Down and Catch.
// The Marauder’s Map (hud/MaraudersMap.jsx) is the minimap, opened on M,
// from the Menu or with a tap of its disc; it reads the world’s night every
// frame through `map()`, never through React.
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
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const reduced = useReducedMotion();
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const portrait = useMediaQuery('(orientation: portrait)');
  // (the address is read once: ?at=hall opens the arrival in the Great Hall)
  const narrow = useMediaQuery('(max-width: 639px)');
  const [props] = useState(() => ({ reduced, at: params.get('at'), week: parseWeek(params) ?? 1 }));
  const [door, setDoor] = useState(null);
  const [toast, setToast] = useState(null);
  const [list, setList] = useState(false);
  const [arrival, setArrival] = useState(null);
  const [caption, setCaption] = useState(null);
  const [word, setWord] = useState(null);
  const [ask, setAsk] = useState(null);
  const [sorted, setSorted] = useState(null);
  const [house, setHouse] = useState(null);
  const [wand, setWand] = useState(null);
  const [wandFull, setWandFull] = useState(false);
  const [room, setRoom] = useState(null);
  const lines = useRef([]);
  const saying = useRef(null);
  const [spell, setSpell] = useState('lumos');
  const [wheel, setWheel] = useState(false);
  const [riding, setRiding] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [said, setSaid] = useState(null);
  const [next, setNext] = useState(1);
  const [objective, setObjective] = useState(null);
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
    else if (e.type === 'menu') menu.current?.querySelector('.hud-btn')?.click();
    else if (e.type === 'toast') setToast({ key: Date.now(), text: e.text });
    else if (e.type === 'arrival') {
      setArrival(e.on ? e : null);
      if (!e.on) setAsk(null);
    } else if (e.type === 'line' && e.text) {
      // (queued: one line read after another)
      const line = { name: e.name, text: e.text, key: `${Date.now()}-${lines.current.length}` };
      if (saying.current) lines.current.push(line);
      else {
        saying.current = line;
        setCaption(line);
      }
    } else if (e.type === 'ask') setAsk(e.q);
    else if (e.type === 'answered') setAsk(null);
    else if (e.type === 'sorted') {
      setAsk(null);
      setSorted(e);
      setHouse(e.house);
      setWand(e.wand);
      setWandFull(true);
    } else if (e.type === 'house') {
      setHouse(e.house);
      setWand(e.wand);
    } else if (e.type === 'room') {
      setRoom(e.id ? e : null);
      setWord(null);
    } else if (e.type === 'word') setWord(e.title ? e : null);
    else if (e.type === 'wheel') setWheel(e.open);
    else if (e.type === 'broom') setRiding(e.riding);
    else if (e.type === 'objective') setObjective(e.text);
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
  // each of the arrival's lines its time, then the next
  useEffect(() => {
    if (!caption) return undefined;
    const t = setTimeout(() => {
      saying.current = lines.current.shift() ?? null;
      setCaption(saying.current);
    }, lineFor(caption.text));
    return () => clearTimeout(t);
  }, [caption]);
  useEffect(() => {
    if (!sorted) return undefined;
    const t = setTimeout(() => setSorted(null), SORTED_FOR);
    return () => clearTimeout(t);
  }, [sorted]);
  useEffect(() => {
    if (!wandFull) return undefined;
    const t = setTimeout(() => setWandFull(false), WAND_FOR);
    return () => clearTimeout(t);
  }, [wandFull]);

  const onRide = Boolean(arrival);
  const foot = onRide ? (
    arrival.skippable ? <Prompt k="Enter" verb="Straight to the castle" touch={touch} onClick={() => api()?.skip()} /> : null
  ) : room ? (
    <Prompt k="Esc" verb="Leave" thing={room.name} touch={touch} onClick={() => api()?.leave()} alt={door ? <Prompt k="E" verb={door.verb ?? 'Go in'} thing={door.label} touch={touch} onClick={() => api()?.go?.()} /> : null} />
  ) : door ? (
    <Prompt k="E" verb="Go in" thing={door.label} touch={touch} onClick={() => api()?.go()} />
  ) : null;

  return (
    <WorldHost world={{ host }} className="hogwarts-stage">
      {status !== 'on' && <p className="hogwarts-loading">The lamps are being lit along the shore…</p>}
      <Letterbox on={letterbox({ holding: onRide && ask == null && !sorted, portrait, reduced })} />
      <Hud
        className="hogwarts-hud"
        touch={touch}
        style={houseColours(house)}
        data-house={house ?? undefined}
        brand={
          // (none on the arrival’s rails: the letterbox is the frame there)
          onRide ? null : (
            <>
              <p className="hogwarts-brand">
                <span className="hogwarts-brand-eyebrow">{room ? 'Hogwarts' : 'The shore of the Black Lake'}</span>
                <span className="hogwarts-brand-name">{room ? room.name : 'Hogwarts'}</span>
              </p>
              {playing ? <Objective ref={line} className="hogwarts-objective" /> : objective && <Objective className="hogwarts-objective" text={objective} />}
            </>
          )
        }
        tools={
          <div ref={menu} className="hp-tools">
            <Menu className="hogwarts-menu" way={wayOut(pathname)} todo={{ onOpen: () => setList(true), done: 0, total: 0 }}>
              {!onRide && (
                <MenuItem onClick={() => map.current?.open()} aria-keyshortcuts="M">
                  The Marauder’s Map
                </MenuItem>
              )}
              {!onRide && <MenuItem onClick={() => api()?.arrive()}>The arrival</MenuItem>}
              {/* (the broom and the classes are the shore's, until the term's lane sends you to them in their rooms) */}
              {!onRide && !room && !riding && <MenuItem onClick={() => api()?.fly()}>Fly</MenuItem>}
              {!onRide && !room && <MenuItem onClick={() => api()?.lesson('flying')}>The flying lesson</MenuItem>}
              {!onRide &&
                !room &&
                LESSON_ITEMS.map(([id, name]) => (
                  <MenuItem key={id} onClick={() => api()?.lesson(id)}>
                    {name}
                  </MenuItem>
                ))}
              {!onRide && !room && <MenuItem onClick={() => api()?.practice()}>Snitch practice</MenuItem>}
              {!onRide && !room && <MenuItem onClick={() => api()?.match(next)}>Quidditch: match {next} of 3</MenuItem>}
            </Menu>
            {house && !wandFull && <WandCard wand={wand} />}
          </div>
        }
        foot={
          onRide || room ? (
            foot
          ) : (
            <>
              <SpellWheel part="card" ref={card} active={spell} touch={touch} />
              {door ? <Prompt k="E" verb={door.verb ?? 'Go in'} thing={door.label} touch={touch} onClick={() => api()?.go()} /> : <span />}
            </>
          )
        }
        thumbs={
          onRide ? null : room ? (
            <Stick className="hogwarts-stick" onMove={(x, y) => api()?.stick(x, y)} label="Walk" />
          ) : riding ? (
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
        <Scarf house={house} />
        <Toast toast={toast} className="hogwarts-toast" />
        {!onRide && <MaraudersMap ref={map} source={night} touch={touch} narrow={narrow} reduced={reduced} />}
        {caption && <Bubble key={caption.key} name={caption.name} line={caption.text} className="hp-said" />}
        {ask != null && <SortingCard q={ask} tall={portrait} onAnswer={(i) => api()?.answer(i)} />}
        {sorted && ask == null && <SortingCard result={sorted} />}
        {wandFull && wand && <WandCard wand={wand} size="full" />}
        {word && <WordCard ask={word} onSay={(text) => api()?.word(text)} onClose={() => setWord(null)} />}
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
        {!onRide && !room && <SpellWheel part="wheel" ref={ring} open={wheel} active={spell} onChoose={choose} touch={touch} />}
        {list && <QuestList className="hogwarts-list" title="Things to do" sub="Nothing yet: the term begins once you’re across the lake." quests={[]} next={null} onClose={() => setList(false)} onGo={() => {}} />}
      </Hud>
    </WorldHost>
  );
}
