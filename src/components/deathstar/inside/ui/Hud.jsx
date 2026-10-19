import { useEffect, useState } from 'react';
import { Letterbox, PlayersChip } from '../../../../runtime/hud';
import { MiniMap } from './Map';
import { bladeName, doubtLine, gunName, promptLine, sectionName, security } from './state';

// What stands over the station while you walk it, and the pause menu. In
// the Empire’s own manner: black glass panels with thin grey rules, small
// capitals in a clean sans, red only for what is wrong (security up, health
// low, a gun venting), and Aurebesh as decoration a screen reader skips.
// Survival bottom left (health, the gun’s heat), what to do top left (the
// objective), where you are top right (the section, its security, the
// map), and what is said and what E does at the bottom in the middle. The
// objective and the map stay up on the start screen too, so the tour’s
// marks are there from the first moment.
//
//   <Hud ui hud say hurt hit touch playing onMap onPause onChoose onSet />
//     the first time you play (until you say you have it, through onSet({ tips: false })), a card
//     of the few keys that matter, for TIPS_FOR seconds
//     ui, hud: the world’s last 'ui' and 'hud' events (Inside.jsx lists their shape)
//     say: { who, text } a subtitle, or null
//     hurt: { angle, key } the last hit on you, an arc on the side it came from (all round when
//       `angle` is null), drawn again for each new key; hit: a count of hits you landed, the
//       reticle’s mark flashing for each
//   <Pause ui touch onResume onSet onQuit onExit />   onSet({ view | sound | subtitles | guide })

const LOW = 30; // health at which the bar goes red
// how the others online show aboard, for the players chip's tooltips
const PLAYERS_LORE = { off: 'Go online, and see everyone else in the room you’re in as a pale trooper, with their name over them', on: 'Everyone else online in the room you’re in, as pale troopers: nothing passes between you but where each of you is' };
const TIPS_FOR = 30; // seconds the first game's tips stay up
// the few keys that matter first, and the touch screen's
const TIPS = [
  ['W A S D', 'walk'],
  ['Mouse', 'look'],
  ['Click', 'fire'],
  ['E', 'use'],
  ['C', 'crouch'],
  ['M', 'map'],
  ['Esc', 'pause'],
];
const TOUCH_TIPS = [
  ['Left pad', 'walk'],
  ['Right side', 'look'],
  ['Buttons', 'fire, use, crouch'],
];

const KEYS = [
  ['W A S D / ← ↑ ↓ →', 'Walk'],
  ['Shift', 'Run'],
  ['Space', 'Jump'],
  ['C', 'Crouch'],
  ['Mouse', 'Look (click the station to hold the pointer)'],
  ['E', 'Use: lifts, consoles, people, coded hatches (doors open as you come near)'],
  ['Click', 'Fire'],
  ['Right-click', 'Aim'],
  ['R', 'Vent the gun'],
  ['V', 'Third or first person'],
  ['H', 'Helmet on or off'],
  ['M / Tab', 'The station’s map'],
  ['1 – 4', 'Choose what to say'],
  ['Esc / P', 'Pause'],
];
const TOUCHES = [
  ['Stick', 'Walk (push it all the way to run)'],
  ['Drag', 'Look'],
  ['Fire', 'Shoot'],
  ['Aim', 'Hold to aim'],
  ['Use', 'Lifts, consoles, people, coded hatches (doors open as you come near)'],
  ['Jump', 'Jump'],
  ['Crouch', 'Crouch, or stand again'],
];

function Bar({ label, value, of = 1, red, readout, segments = 0 }) {
  const k = Math.max(0, Math.min(1, of ? value / of : 0));
  return (
    <div className="ds-meter" data-red={red || undefined}>
      <span className="ds-meter-label">{label}</span>
      <span className="ds-meter-track" data-segments={segments || undefined} style={{ '--k': k, '--n': segments || 1 }}>
        <span className="ds-meter-fill" />
      </span>
      <span className="ds-meter-read">{readout}</span>
    </div>
  );
}

// The first game's card: the keys that matter, and the diamond to follow
function Tips({ touch, story, onDone }) {
  return (
    <section className="ds-panel ds-tips" aria-label="How to play">
      <p className="ds-kicker">How to play</p>
      <ul>
        {(touch ? TOUCH_TIPS : TIPS).map(([k, v]) => (
          <li key={k}>
            {touch ? <span className="ds-tip-key">{k}</span> : <kbd className="kbd">{k}</kbd>} {v}
          </li>
        ))}
      </ul>
      {story && (
        <p className="ds-tips-way">
          <span className="ds-tips-diamond" aria-hidden="true" /> Follow the diamond to the next objective.
        </p>
      )}
      <button type="button" className="ds-btn ds-btn-ghost" onClick={onDone}>
        Got it
      </button>
    </section>
  );
}

export default function Hud({ ui, hud, say, hurt = null, hit = 0, touch, playing, players = null, onMap, onPause, onChoose, onSet }) {
  // the tips: up from the first moment of a game, for a while, until you say you have them
  const [tipsUp, setTipsUp] = useState(false);
  const wantTips = playing && ui.settings?.tips !== false;
  useEffect(() => {
    if (!wantTips) return undefined;
    setTipsUp(true);
    const t = setTimeout(() => setTipsUp(false), TIPS_FOR * 1000);
    return () => clearTimeout(t);
  }, [wantTips]);
  const station = ui.station ?? 'ds1';
  const sec = security(hud?.alert);
  const doubt = doubtLine(hud?.doubt);
  const line = playing ? promptLine(ui.prompt, { touch }) : null;
  const hp = Math.round(hud?.hp ?? 100);
  const objective =
    ui.mode === 'start'
      ? 'Choose a station and a side, then come aboard.'
      : ui.mode === 'loading'
        ? 'Coming aboard.'
        : ui.objective || (ui.play === 'roam' ? 'Free roam: walk the station as you like.' : '');
  const talk = playing ? ui.talk : null;
  const aboard = playing || ui.mode === 'pause'; // (in a game, walking or not)
  const vitals = playing && hud && (
    <section className="ds-panel ds-vitals" aria-label="Health and gun">
      <Bar label="Health" value={hp} of={hud.hpMax ?? 100} red={hp <= LOW} segments={10} readout={<span className="ds-num">{hp}</span>} />
      {hud.gun && <Bar label={gunName(hud.gun)} value={hud.heat ?? 0} red={hud.venting} readout={hud.venting ? 'Venting' : 'Heat'} />}
      {!hud.gun && hud.blade && (
        <p className="ds-blade" data-colour={hud.blade}>
          <span className="ds-blade-glow" aria-hidden="true" />
          {bladeName(hud.blade)}
        </p>
      )}
    </section>
  );
  return (
    <div className="ds-hud" data-touch={touch || undefined} data-start={ui.mode === 'start' || ui.mode === 'loading' || undefined} data-scene={(playing && ui.scene) || undefined}>
      {playing && ui.scene && <Letterbox />}
      {wantTips && tipsUp && !ui.talk && !ui.map?.open && <Tips touch={touch} story={ui.play === 'story'} onDone={() => onSet?.({ tips: false })} />}
      <div className="ds-top">
        <div className="ds-top-left">
          <section className="ds-panel ds-objective" data-tour="ds-objective" aria-label="Objective">
            <p className="ds-kicker">
              Objective
              {aboard && <span className="ds-tag">{ui.play === 'roam' ? 'Free roam' : 'Story'}</span>}
              <span className="aurebesh ds-aurebesh" aria-hidden="true">
                Orders
              </span>
            </p>
            <p className="ds-objective-text" aria-live="polite">
              {objective}
            </p>
          </section>
          {/* (on a phone the stick has the bottom left, so health and heat come up here) */}
          {touch && vitals}
        </div>
        <div className="ds-where">
          {playing && hud && (
            <section className="ds-panel ds-section" aria-label="Section" data-red={sec.red || undefined}>
              <p className="ds-section-name">{sectionName(station, hud.section) || '—'}</p>
              <p className="ds-security" role="status">
                <span className="ds-security-dot" aria-hidden="true" />
                Security: {sec.label}
              </p>
              {doubt && <Bar label="Disguise" value={doubt.k} red={doubt.red} readout={doubt.label} />}
            </section>
          )}
          <MiniMap station={station} seen={ui.map?.seen ?? []} here={aboard ? hud?.room : null} at={aboard ? hud?.at : null} route={aboard ? hud?.route : null} onOpen={onMap} />
          {/* (the others online in the room you're in, pale troopers: the kit's chip on the station's glass) */}
          {playing && players && <PlayersChip className="ds-panel ds-players" {...players} lore={PLAYERS_LORE} />}
        </div>
        {playing && (
          <button type="button" className="ds-pause-btn" aria-label="Pause" onClick={onPause}>
            <span aria-hidden="true">❚❚</span>
          </button>
        )}
      </div>

      {!touch && vitals}

      {playing && !touch && !talk && (
        <span className="ds-reticle" data-aim={hud?.aim || undefined} aria-hidden="true">
          {hit > 0 && <span key={hit} className="ds-hitmark" />}
        </span>
      )}
      {playing && hurt && <span key={hurt.key} className="ds-hurt" data-all={hurt.angle == null || undefined} style={{ '--a': `${hurt.angle ?? 0}rad` }} aria-hidden="true" />}

      <div className="ds-lines">
        {/* (a line the talk's panel already shows isn't said again under it) */}
        {say && !(talk?.line && talk.line === say.text) && (
          <p className="ds-subtitle" role="status">
            {say.who && <span className="ds-subtitle-who">{say.who}</span>}
            {say.text}
          </p>
        )}
        {line && !talk && (
          <p className="ds-prompt" data-note={!line.key || undefined}>
            {line.key && (
              <>
                <kbd className="kbd">{line.key}</kbd>
                <span className="ds-dash"> — </span>
              </>
            )}
            <span>{line.text}</span>
          </p>
        )}
      </div>

      {talk && (
        <section className="ds-panel ds-talk" aria-label={talk.who ? `Talking to ${talk.who}` : 'Conversation'}>
          {talk.who && <p className="ds-kicker">{talk.who}</p>}
          {talk.line && <p className="ds-talk-line">{talk.line}</p>}
          {talk.choices?.length > 0 && (
            <ol className="ds-talk-choices">
              {talk.choices.map((c, i) => (
                <li key={i}>
                  <button type="button" className="ds-choice" onClick={() => onChoose(i)}>
                    {!touch && <kbd className="kbd">{i + 1}</kbd>}
                    <span>{c}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {hud && playing && hp <= 0 && <div className="ds-down" aria-hidden="true" />}
    </div>
  );
}

function Toggle({ on, onClick, children }) {
  return (
    <button type="button" className="ds-chip" aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

export function Pause({ ui, touch, onResume, onSet, onQuit, onExit }) {
  const [help, setHelp] = useState(false);
  const s = { view: 'third', sound: true, subtitles: true, ...ui.settings };
  return (
    <div className="ds-overlay" role="dialog" aria-modal="true" aria-label="Paused">
      <div className="ds-panel ds-menu">
        <p className="ds-kicker">
          Paused
          <span className="aurebesh ds-aurebesh" aria-hidden="true">
            Standby
          </span>
        </p>
        <button type="button" className="ds-btn" onClick={onResume} autoFocus>
          Resume
        </button>
        <div className="ds-row" role="group" aria-label="View">
          <Toggle on={s.view === 'third'} onClick={() => onSet({ view: 'third' })}>
            Over the shoulder
          </Toggle>
          <Toggle on={s.view === 'first'} onClick={() => onSet({ view: 'first' })}>
            Through the eyes
          </Toggle>
        </div>
        <div className="ds-row">
          <Toggle on={s.sound} onClick={() => onSet({ sound: !s.sound })}>
            Sound {s.sound ? 'on' : 'off'}
          </Toggle>
          <Toggle on={s.subtitles} onClick={() => onSet({ subtitles: !s.subtitles })}>
            Subtitles {s.subtitles ? 'on' : 'off'}
          </Toggle>
          <Toggle on={s.guide !== false} onClick={() => onSet({ guide: s.guide === false })}>
            Guide {s.guide !== false ? 'on' : 'off'}
          </Toggle>
          <Toggle on={help} onClick={() => setHelp((v) => !v)}>
            Controls
          </Toggle>
        </div>
        {help && (
          <dl className="ds-controls">
            {(touch ? TOUCHES : KEYS).map(([k, v]) => (
              <div key={v}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="ds-row ds-row-end">
          <button type="button" className="ds-btn ds-btn-ghost" onClick={onQuit}>
            Quit to the start
          </button>
          {onExit && (
            <button type="button" className="ds-btn ds-btn-ghost" onClick={onExit}>
              Back to the Death Star
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
