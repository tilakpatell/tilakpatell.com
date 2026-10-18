import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDocumentTitle, useMediaQuery, useReducedMotion } from '../lib/hooks';
import { WorldHost, useWorld } from '../runtime';
import { Hud, Letterbox, Menu, MenuItem, Prompt, TouchButton, letterbox } from '../runtime/hud';
import { wayOut } from '../components/worlds/worlds';
import roadModule from '../components/middleearth/road/module';
import { STAGES } from '../components/middleearth/road/stages/index';
import Ribbon from '../components/middleearth/road/Ribbon';
import { markAt } from '../components/middleearth/road/line';
import TitleCard from '../components/middleearth/road/TitleCard';
import LoreCard from '../components/middleearth/road/LoreCard';
import ResumeCard from '../components/middleearth/road/ResumeCard';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '../styles/lazy/road.css';

const TITLE_FOR = 4000; // ms a stage’s card stays
const FIRST_FOR = 7000; // the Road’s own card, which says how to walk it

// The Road through Middle-earth (/middle-earth/road, ?at=moria): one ride
// from Bag End to the Grey Havens on the world runtime, and the HUD over
// it from the kit: the prompt, the ribbon of stages, the title and lore
// cards, the Menu, the resume card and the letterbox.
export default function TheRoad() {
  useDocumentTitle('The Road · Middle-earth');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const portrait = useMediaQuery('(orientation: portrait)');
  // (the address is read once: the world keeps the ride after that)
  const [props] = useState(() => ({ at: params.get('at'), reduced }));
  const [title, setTitle] = useState(null);
  const [lore, setLore] = useState(null);
  const [offer, setOffer] = useState(null);
  const [clock, setClock] = useState({ auto: !reduced, mode: 'idle', holding: false });
  const [at, setAt] = useState({ s: 0, stage: STAGES[0].id });
  const [bars, setBars] = useState(true);
  const mark = useRef(null);
  const menu = useRef(null);
  const lastLore = useRef(null);

  const onEvent = useCallback((e) => {
    if (e.type === 'stage') setTitle({ key: `${e.id}-${Date.now()}`, ...e });
    else if (e.type === 'mode') setClock({ auto: e.auto, mode: e.mode, holding: e.holding });
    else if (e.type === 'resume') setOffer(e);
    else if (e.type === 'progress') {
      // (the mark through its element; React only hears a new stage)
      mark.current?.style.setProperty('--at', String(markAt(STAGES, e.s)));
      setAt((was) => (was.stage === e.stage ? was : { s: e.s, stage: e.stage }));
    } else if (e.type === 'lore') setLore(lastLore.current);
    else if (e.type === 'menu') menu.current?.querySelector('.hud-btn')?.click();
    else if (e.type === 'end') navigate('/middle-earth');
  }, [navigate]);
  const { host, status, rt } = useWorld(roadModule, { props, onEvent });
  const api = useCallback(() => (rt?.current?.module === roadModule ? rt.current.world : null), [rt]);

  useEffect(() => {
    if (!title) return undefined;
    const t = setTimeout(() => setTitle(null), title.first ? FIRST_FOR : TITLE_FOR);
    return () => clearTimeout(t);
  }, [title]);
  useEffect(() => {
    if (!lore) return undefined;
    lastLore.current = lore;
    const t = setTimeout(() => setLore(null), 12000);
    return () => clearTimeout(t);
  }, [lore]);

  const stage = STAGES.find((st) => st.id === at.stage) ?? STAGES[0];
  const holding = clock.holding;
  const prompt = reduced ? { k: 'Enter', verb: 'Next' } : clock.auto ? { k: 'Shift', verb: 'Run' } : { k: 'W', verb: 'Walk on' };
  const alt = !reduced && !clock.auto ? <Prompt k="Space" verb="Let the road walk" touch={touch} onClick={() => api()?.setAuto(true)} /> : null;

  return (
    <div className="pt-[var(--nav-h)]">
      <WorldHost world={{ host }} className="road-stage" data-holding={holding || undefined}>
        {status !== 'on' && <p className="road-loading">The Road goes ever on…</p>}
        <Letterbox on={letterbox({ holding, portrait, reduced, off: !bars })} />
        <Hud
          className="road-hud"
          touch={touch}
          brand={
            <p className="road-brand">
              <span className="road-brand-eyebrow">The Road</span>
              <span className="road-brand-name">{stage.name}</span>
            </p>
          }
          tools={
            <div ref={menu}>
              <Menu className="road-menu" way={wayOut(pathname)}>
                {!reduced && (
                  <MenuItem keep aria-pressed={clock.auto} onClick={() => api()?.setAuto(!clock.auto)}>
                    Let the road walk itself · {clock.auto ? 'on' : 'off'}
                  </MenuItem>
                )}
                {!reduced && (
                  <MenuItem keep aria-pressed={bars} onClick={() => setBars((v) => !v)}>
                    Letterbox · {bars ? 'on' : 'off'}
                  </MenuItem>
                )}
                <MenuItem onClick={() => navigate('/middle-earth')}>The map</MenuItem>
                <MenuItem onClick={() => api()?.restart()}>Start again</MenuItem>
                <MenuItem onClick={() => api()?.skipToEnd()}>Skip to the end</MenuItem>
              </Menu>
            </div>
          }
          foot={
            <div className="road-foot">
              {!touch && <Prompt k={prompt.k} verb={prompt.verb} onClick={() => (reduced ? null : api()?.setAuto(!clock.auto))} alt={alt} />}
              <Ribbon stages={STAGES} s={at.s} names={touch || portrait ? 'current' : 'all'} markRef={mark} onJump={(id) => api()?.goTo(id)} />
            </div>
          }
          thumbs={
            <div className="road-thumbs">
              <TouchButton size={52} onPress={() => api()?.press('run', true)} onRelease={() => api()?.press('run', false)} aria-label="Run">
                Run
              </TouchButton>
              <TouchButton size={76} onPress={() => api()?.press('walk', true)} onRelease={() => api()?.press('walk', false)} aria-label="Walk">
                Walk
              </TouchButton>
            </div>
          }
        >
          {title && !offer && <TitleCard key={title.key} name={title.name} date={title.date} first={title.first} />}
          {lore && <LoreCard card={lore} />}
          {offer && (
            <ResumeCard
              stage={offer.name}
              onCarryOn={() => {
                setOffer(null);
                api()?.carryOn();
              }}
              onRestart={() => {
                setOffer(null);
                api()?.restart();
              }}
            />
          )}
        </Hud>
      </WorldHost>
    </div>
  );
}
