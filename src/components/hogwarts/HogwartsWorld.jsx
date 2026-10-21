import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMediaQuery, useReducedMotion } from '../../lib/hooks';
import { WorldHost, useWorld } from '../../runtime';
import { Hud, Menu, Prompt, QuestList, Stick, Toast } from '../../runtime/hud';
import { wayOut } from '../worlds/worlds';
import hogwartsModule from './module';
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
export default function HogwartsWorld() {
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [props] = useState(() => ({ reduced }));
  const [door, setDoor] = useState(null);
  const [toast, setToast] = useState(null);
  const [list, setList] = useState(false);
  const menu = useRef(null);

  const onEvent = useCallback((e) => {
    if (e.type === 'near') setDoor(e.door);
    else if (e.type === 'go') setToast({ key: Date.now(), text: NOT_YET });
    else if (e.type === 'menu') menu.current?.querySelector('.hud-btn')?.click();
  }, []);
  const { host, status, rt } = useWorld(hogwartsModule, { props, onEvent });
  const api = useCallback(() => (rt?.current?.module === hogwartsModule ? rt.current.world : null), [rt]);

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
          <p className="hogwarts-brand">
            <span className="hogwarts-brand-eyebrow">The shore of the Black Lake</span>
            <span className="hogwarts-brand-name">Hogwarts</span>
          </p>
        }
        tools={
          <div ref={menu}>
            <Menu className="hogwarts-menu" way={wayOut(pathname)} todo={{ onOpen: () => setList(true), done: 0, total: 0 }} />
          </div>
        }
        foot={door ? <Prompt k="E" verb="Go in" thing={door.label} touch={touch} onClick={() => api()?.go()} /> : null}
        thumbs={<Stick className="hogwarts-stick" onMove={(x, y) => api()?.stick(x, y)} label="Walk" />}
      >
        <Toast toast={toast} className="hogwarts-toast" />
        {list && <QuestList className="hogwarts-list" title="Things to do" sub="Nothing yet: the term begins once you’re across the lake." quests={[]} next={null} onClose={() => setList(false)} onGo={() => {}} />}
      </Hud>
    </WorldHost>
  );
}
