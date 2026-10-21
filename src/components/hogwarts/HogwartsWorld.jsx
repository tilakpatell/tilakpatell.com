import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useMediaQuery, useReducedMotion } from '../../lib/hooks';
import { WorldHost, useWorld } from '../../runtime';
import { Bubble, Hud, Letterbox, Menu, MenuItem, Prompt, QuestList, Stick, Toast, TouchButton, letterbox } from '../../runtime/hud';
import { wayOut } from '../worlds/worlds';
import hogwartsModule from './module';
import SortingCard from './hud/SortingCard';
import WandCard, { Scarf } from './hud/WandCard';
import { houseColours } from './rules/sorting';
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
// on touch the stick. The arrival (Lane D) adds the letterbox, its subtitles, the
// Sorting's card and the wand's; once sorted, the frame takes the house's
// colours and its scarf hangs in the corner.
export default function HogwartsWorld() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const reduced = useReducedMotion();
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const portrait = useMediaQuery('(orientation: portrait)');
  // (the address is read once: ?at=hall opens the arrival in the Great Hall)
  const [props] = useState(() => ({ reduced, at: params.get('at') }));
  const [door, setDoor] = useState(null);
  const [toast, setToast] = useState(null);
  const [list, setList] = useState(false);
  const [arrival, setArrival] = useState(null);
  const [said, setSaid] = useState(null);
  const [ask, setAsk] = useState(null);
  const [sorted, setSorted] = useState(null);
  const [house, setHouse] = useState(null);
  const [wand, setWand] = useState(null);
  const [wandFull, setWandFull] = useState(false);
  const [room, setRoom] = useState(null);
  const lines = useRef([]);
  const saying = useRef(null);
  const menu = useRef(null);

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
        setSaid(line);
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
    } else if (e.type === 'room') setRoom(e.id ? e : null);
  }, []);
  const { host, status, rt } = useWorld(hogwartsModule, { props, onEvent });
  const api = useCallback(() => (rt?.current?.module === hogwartsModule ? rt.current.world : null), [rt]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), TOAST_FOR);
    return () => clearTimeout(t);
  }, [toast]);
  // each line its time, then the next
  useEffect(() => {
    if (!said) return undefined;
    const t = setTimeout(() => {
      saying.current = lines.current.shift() ?? null;
      setSaid(saying.current);
    }, lineFor(said.text));
    return () => clearTimeout(t);
  }, [said]);
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
    <Prompt k="Esc" verb="Leave" thing={room.name} touch={touch} onClick={() => api()?.leave()} alt={door ? <Prompt k="E" verb="Go in" thing={door.label} touch={touch} onClick={() => api()?.go?.()} /> : null} />
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
            <p className="hogwarts-brand">
              <span className="hogwarts-brand-eyebrow">{room ? 'Hogwarts' : 'The shore of the Black Lake'}</span>
              <span className="hogwarts-brand-name">{room ? room.name : 'Hogwarts'}</span>
            </p>
          )
        }
        tools={
          <div ref={menu} className="hp-tools">
            <Menu className="hogwarts-menu" way={wayOut(pathname)} todo={{ onOpen: () => setList(true), done: 0, total: 0 }}>
              {!onRide && <MenuItem onClick={() => api()?.arrive()}>The arrival</MenuItem>}
            </Menu>
            {house && !wandFull && <WandCard wand={wand} />}
          </div>
        }
        foot={foot}
        thumbs={
          onRide ? (
            arrival.skippable ? (
              <TouchButton size={64} onPress={() => api()?.skip()} aria-label="Straight to the castle">
                Skip
              </TouchButton>
            ) : null
          ) : (
            <Stick className="hogwarts-stick" onMove={(x, y) => api()?.stick(x, y)} label="Walk" />
          )
        }
      >
        <Scarf house={house} />
        <Toast toast={toast} className="hogwarts-toast" />
        {said && <Bubble key={said.key} name={said.name} line={said.text} className="hp-said" />}
        {ask != null && <SortingCard q={ask} tall={portrait} onAnswer={(i) => api()?.answer(i)} />}
        {sorted && ask == null && <SortingCard result={sorted} />}
        {wandFull && wand && <WandCard wand={wand} size="full" />}
        {list && <QuestList className="hogwarts-list" title="Things to do" sub="Nothing yet: the term begins once you’re across the lake." quests={[]} next={null} onClose={() => setList(false)} onGo={() => {}} />}
      </Hud>
    </WorldHost>
  );
}
