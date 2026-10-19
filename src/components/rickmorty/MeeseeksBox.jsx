import { useEffect, useRef, useState } from 'react';
import { useAchievements } from '../Achievements';
import { useTheme } from '../../theme/ThemeProvider';
import { audioContext } from '../../lib/audio';
import { prefersReducedMotion } from '../../lib/hooks';
import { sayVoiced } from '../../lib/voiced';
import { MeeseeksFace } from './Faces';
import { MEESEEKS, aloud } from './toys';

// A Meeseeks box: press the button, a Mr. Meeseeks appears (in his own
// voice), give him a task and he does it (to this page) and is gone. Give him
// one he can't do and he summons help, and the help summons help.

const { hello: HELLO, stress: STRESS, done: DONE, letGo: LET_GO } = MEESEEKS;
// a Meeseeks' line in his voice, where it's been made (lib/voiced.js)
const voice = (line) => sayVoiced('meeseeks', aloud(line));
const cue = (name) => import('../games/gameAudio').then((m) => m[name]?.());
const effect = (name) => import('../../lib/sfx').then((m) => m[name]?.());
const clip = (id) => import('../../lib/clips').then((m) => m.playClip(id));

// `onUsed`: called once, the first time a Meeseeks has done its task (C-137
// ticks its task then; letting them go isn't a task done)
export default function MeeseeksBox({ onUsed }) {
  const { unlock } = useAchievements();
  const { pin } = useTheme();
  const [crew, setCrew] = useState([]); // Meeseeks out of the box
  const [line, setLine] = useState('Press the button. One wish each.');
  const [done, setDone] = useState(0);
  const timers = useRef([]);
  const canDo = useRef(null); // his "Can do!" playing, so he says he's done once it's over
  const gone = useRef(false);
  const used = useRef(false);
  useEffect(() => {
    const pending = timers.current; // (the one list, added to as it goes)
    gone.current = false;
    return () => {
      gone.current = true;
      pending.forEach(clearTimeout);
    };
  }, []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const summon = () => {
    audioContext();
    cue('portalHop');
    unlock('meeseeks');
    if (!crew.length) clip('meeseeks');
    setCrew((c) => (c.length ? c : [{ id: Date.now() }]));
    setLine((l) => (crew.length ? l : 'What can I do for you?'));
  };

  // the task's done: he's gone
  const poof = (text, did = true) => {
    cue('splat');
    setLine(text);
    setCrew([]);
    setDone((n) => n + 1);
    if (did && !used.current) {
      used.current = true;
      onUsed?.();
    }
  };
  // a task he can do, done, and said so once his "Can do!" is over
  const doneSaying = (text) => {
    poof(text);
    Promise.resolve(canDo.current)
      .then((h) => h?.ended)
      .then(() => !gone.current && voice(text));
  };
  // all of them, said by them (the tasks they can do have a clip of their own)
  const letGo = () => {
    poof(LET_GO, false);
    voice(LET_GO);
  };

  const tasks = [
    {
      id: 'green',
      label: 'Turn the site portal green',
      run: () => {
        pin('portal');
        unlock('wubba');
        poof(DONE.green);
      },
    },
    {
      id: 'top',
      label: 'Take me back to the top',
      run: () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        later(() => doneSaying(DONE.top), 400);
      },
    },
    {
      id: 'shake',
      label: 'Shake things up',
      run: () => {
        const root = document.documentElement;
        if (!prefersReducedMotion()) {
          root.classList.remove('meeseeks-shake');
          void root.offsetWidth;
          root.classList.add('meeseeks-shake');
          later(() => root.classList.remove('meeseeks-shake'), 900);
        }
        effect('drum');
        later(() => doneSaying(DONE.shake), 700);
      },
    },
    {
      id: 'golf',
      label: 'Take two strokes off my golf game',
      run: () => {
        // the impossible task: they multiply
        effect('alarm');
        const n = Math.min(7, crew.length + 1);
        setCrew((c) => (c.length >= 7 ? c : [...c, { id: Date.now() + Math.random() }]));
        const said = STRESS[Math.min(STRESS.length - 1, n - 1)];
        setLine(said);
        voice(said);
      },
    },
  ];

  // a task he can do: "Ooh, yeah! Can do!", then he does it (turning the
  // site green has the portal theme's own line, so he lets that speak)
  const can = (t) => {
    if (t.id === 'top' || t.id === 'shake') canDo.current = clip('canDo');
    t.run();
  };

  const many = crew.length > 1;
  return (
    <div className="rm-box card">
      <div className="rm-box-stage" data-crowd={many || undefined}>
        <div className="rm-box-crew" aria-live="polite">
          {crew.map((m, i) => (
            <figure key={m.id} className="rm-meeseeks" style={{ '--i': i }} data-stressed={many || undefined}>
              <MeeseeksFace className="rm-meeseeks-face" />
              <span className="rm-meeseeks-body" />
            </figure>
          ))}
        </div>
        <button type="button" className="rm-box-btn" onClick={summon} aria-label="Press the Meeseeks box button">
          <span className="rm-box-top" />
          <span className="rm-box-face">
            <span className="rm-box-knob" />
          </span>
        </button>
      </div>
      <div className="rm-box-talk">
        <p className="rm-box-line" role="status">
          {crew.length ? (many ? line : HELLO) : line}
        </p>
        {crew.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(many ? tasks.filter((t) => t.id === 'golf') : tasks).map((t) => (
              <button key={t.id} type="button" className="btn btn-ghost btn-sm" onClick={() => (many ? t.run() : can(t))}>
                {many ? 'Keep trying' : t.label}
              </button>
            ))}
            {many && (
              <button type="button" className="btn btn-primary btn-sm" onClick={letGo}>
                Let it go
              </button>
            )}
          </div>
        )}
        <p className="mt-4 text-xs text-muted">{done ? `${done} wish${done === 1 ? '' : 'es'} granted. Meeseeks don’t usually exist this long.` : 'Meeseeks don’t usually exist this long.'}</p>
      </div>
    </div>
  );
}
