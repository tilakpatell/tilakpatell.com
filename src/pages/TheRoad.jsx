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
import DeedCard from '../components/middleearth/road/DeedCard';
import Said from '../components/middleearth/road/Said';
import { nameOf, saidFor } from '../components/middleearth/road/talk';
import { TALES } from '../components/middleearth/road/stages/tales';
import { MAP, bookPageForStage } from '../components/middleearth/redbook/routes';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '../styles/lazy/road.css';

const TITLE_FOR = 7000; // ms a stage’s card stays (its tale to read)
const FIRST_FOR = 10000; // the Road’s own card, which says how to walk it

// The Road through Middle-earth (/middle-earth/road, ?at=moria): one ride
// from Bag End to the Grey Havens on the world runtime, and the HUD over
// it from the kit: the prompt, the ribbon of stages, the title and lore
// cards, the Menu, the resume card and the letterbox; and the Road's own:
// what it waits for you to do (the deed card), what the company says (the
// subtitles, one line at a time) and a word with them (T, or Talk).
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
  const [deed, setDeed] = useState(null);
  const [talk, setTalk] = useState(null);
  const [said, setSaid] = useState(null);
  const lines = useRef([]);
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
    else if (e.type === 'deed') setDeed(e.label ? e : null);
    else if (e.type === 'talk') setTalk(e.who ? e : null);
    else if (e.type === 'line' && e.text) {
      // (queued: a beat's three voices are read one after another)
      lines.current.push({ who: e.who, text: e.text, key: `${e.who}-${Date.now()}-${lines.current.length}` });
      setSaid((was) => was ?? lines.current.shift());
    }
  }, [navigate]);
  const { host, status, rt } = useWorld(roadModule, { props, onEvent });
  const api = useCallback(() => (rt?.current?.module === roadModule ? rt.current.world : null), [rt]);

  useEffect(() => {
    if (!title) return undefined;
    const t = setTimeout(() => setTitle(null), title.first ? FIRST_FOR : TITLE_FOR);
    return () => clearTimeout(t);
  }, [title]);
  // each line its time to read, then the next
  useEffect(() => {
    if (!said) return undefined;
    const t = setTimeout(() => setSaid(lines.current.shift() ?? null), saidFor(said.text));
    return () => clearTimeout(t);
  }, [said]);
  useEffect(() => {
    if (!lore) return undefined;
    lastLore.current = lore;
    const t = setTimeout(() => setLore(null), 12000);
    return () => clearTimeout(t);
  }, [lore]);

  const stage = STAGES.find((st) => st.id === at.stage) ?? STAGES[0];
  const holding = clock.holding;
  const prompt = reduced ? { k: 'Enter', verb: 'Next' } : clock.auto ? { k: 'Shift', verb: 'Run' } : { k: 'W', verb: 'Walk on' };
  const talkPrompt = talk && !deed ? <Prompt k="T" verb="Talk" thing={talk.name} touch={touch} onClick={() => api()?.talk()} /> : null;
  const walkAlt = !reduced && !clock.auto ? <Prompt k="Space" verb="Let the road walk" touch={touch} onClick={() => api()?.setAuto(true)} /> : null;
  const alt = walkAlt || talkPrompt ? (
    <>
      {walkAlt}
      {talkPrompt}
    </>
  ) : null;

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
                <MenuItem onClick={() => navigate(`/middle-earth?page=${bookPageForStage(stage.id)}`)}>The Red Book</MenuItem>
                <MenuItem onClick={() => navigate(MAP)}>Middle-earth’s map</MenuItem>
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
              {talk && !deed && (
                <TouchButton size={52} onPress={() => api()?.talk()} aria-label={`Talk to ${talk.name}`}>
                  Talk
                </TouchButton>
              )}
              <TouchButton size={52} onPress={() => api()?.press('run', true)} onRelease={() => api()?.press('run', false)} aria-label="Run">
                Run
              </TouchButton>
              <TouchButton size={76} onPress={() => api()?.press('walk', true)} onRelease={() => api()?.press('walk', false)} aria-label="Walk">
                Walk
              </TouchButton>
            </div>
          }
        >
          {title && !offer && <TitleCard key={title.key} name={title.name} date={title.date} tale={TALES[title.id]} first={title.first} />}
          {!offer && <DeedCard deed={deed} touch={touch} api={api} />}
          {!offer && said && <Said key={said.key} line={{ name: nameOf(said.who, stage.id), text: said.text }} />}
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
