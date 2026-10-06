import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { linesFor } from './crews';
import { playClip, playFile } from '../../lib/clips';
import { useMouth } from '../../lib/mouth';
import { preloadVoiced, voicedSrc } from '../../lib/voiced';
import { alarmSound, arrivalSound, boomSound, boostSound, bumpSound, crashSound, drySound, enemyFireSound, fallSound, fireSound, flareSound, flybySound, gunSound, hitSound, impactSound, interdictSound, jumpSound, launchSound, popSound, portalSound, respawnSound, riftSound, shieldSound, speak, switchSound } from './sounds';
import Face from './Faces';

// The ship's comms: what the crew says as you fly, one line at a time with
// the speaker's face and voice (their own recording where the line has one,
// else the line made in their voice where that's been generated (lib/voiced.js),
// else their blips), the face's mouth moving with it,
// over the open part of the map. Reaching a world for the first time this
// visit plays its sound bite and then the crew's exchange about it;
// launching, boosting, bumping into things and reaching the edge get a line
// now and then (not every time); a crash (into a planet too fast), the
// black hole's pull, falling into it (a one-way trip: the page goes on to
// what's beyond it), sitting still a while and flying into the sun get one of their own,
// and so does
// traffic going past and a ship shot down. Hunters coming after you, their
// hits, your shields running low, being shot down, getting away or shooting
// the lot down, the director's set pieces and the first sight of each of
// deep space's wonders all get theirs too. Shots are just sound.
// The page hands events over through `control.current.handle(event)`.

const GAP = { boost: 25000, bump: 12000, edge: 20000, crash: 15000, pulled: 20000, traffic: 18000, kill: 9000, hit: 14000, hunted: 8000, shielded: 15000, deflect: 10000, dry: 8000, closed: 6000 }; // ms before the same kind of line again
const COMMS = { name: 'On the comms', color: '#9fb0d0', voice: null }; // a voice on the radio that isn't the crew's

export default function Comms({ crew, reduced, control }) {
  const [line, setLine] = useState(null); // { who, text, n }
  const queue = useRef([]);
  const busy = useRef(false);
  const said = useRef(new Set()); // what's been said this visit
  const lastAt = useRef({});
  const lastSound = useRef({});
  const timer = useRef(0);
  const alive = useRef(true);
  const n = useRef(0);
  const box = useRef(null);

  useEffect(() => {
    alive.current = true;
    preloadVoiced();
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  // a new crew starts fresh
  useEffect(() => {
    queue.current = [];
    said.current = new Set();
    lastAt.current = {};
    clearTimeout(timer.current);
    busy.current = false;
    setLine(null);
  }, [crew]);

  const wait = (ms) =>
    new Promise((r) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(r, ms);
    });

  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    while (queue.current.length && alive.current) {
      const [who, text, clip] = queue.current.shift();
      const speaker = who === 'comms' ? COMMS : crew?.speakers[who];
      if (!speaker) continue;
      n.current += 1;
      setLine({ who, text, n: n.current });
      const least = clip ? 1200 + text.length * 32 : 1500 + text.length * 42; // time to read it
      const started = performance.now();
      // their own voice: the recording, or the line made in their voice
      let h = clip ? await playClip(clip, { voice: true }) : null;
      if (!h && speaker.voice) {
        const src = await voicedSrc(who, text);
        if (src && alive.current) h = await playFile(src, { voice: true });
      }
      if (h) {
        // the line stays up while it plays
        await Promise.race([h.ended, new Promise((r) => setTimeout(r, Math.max(7000, h.length * 1000 + 500)))]);
        await wait(Math.max(300, least - (performance.now() - started)));
      } else await wait(Math.max(speaker.voice ? speak(speaker.voice, text) : 0, least));
    }
    if (alive.current) {
      await wait(400);
      if (!queue.current.length && alive.current) setLine(null);
    }
    busy.current = false;
    if (queue.current.length && alive.current) run();
  };

  const say = (exchange, { urgent = false } = {}) => {
    if (!exchange?.length) return;
    if (urgent) queue.current = [...exchange];
    else if (busy.current) return; // something's already being said
    else queue.current = [...exchange];
    run();
  };

  const often = (kind, now) => {
    if (now - (lastAt.current[kind] ?? -Infinity) < GAP[kind]) return false;
    lastAt.current[kind] = now;
    return true;
  };
  const soundOnce = (kind, ms, now) => {
    if (now - (lastSound.current[kind] ?? -Infinity) < ms) return false;
    lastSound.current[kind] = now;
    return true;
  };

  useImperativeHandle(
    control,
    () => ({
      async handle(e) {
        const now = performance.now();
        if (e.type === 'arrive') {
          const key = `arrive:${e.id}`;
          if (said.current.has(key)) return;
          said.current.add(key);
          await arrivalSound(e.id);
          if (alive.current) say(linesFor(crew, 'arrive', e.id), { urgent: true });
        } else if (e.type === 'launch') {
          if (said.current.has('launch')) return;
          said.current.add('launch');
          say(linesFor(crew, 'launch'));
        } else if (e.type === 'boost') {
          if (soundOnce('boost', 1200, now)) boostSound(crew?.id, e.first);
          if (e.first || often('boost', now)) say(linesFor(crew, 'boost'));
        } else if (e.type === 'bump') {
          if (soundOnce('bump', 500, now)) bumpSound();
          if (e.hard && often('bump', now)) say(linesFor(crew, 'bump'), { urgent: true });
        } else if (e.type === 'pulled') {
          // the black hole has hold of you (and you can still get out)
          if (often('pulled', now)) say(linesFor(crew, 'pulled'), { urgent: true });
        } else if (e.type === 'crash' && e.swallowed) {
          // into the black hole: the long way down, and the crew's last
          // words on the way
          fallSound();
          say(linesFor(crew, 'swallowed'), { urgent: true });
        } else if (e.type === 'crash') {
          crashSound();
          if (e.id === 'sun' && !said.current.has('sun')) {
            // straight into the sun: once a visit
            said.current.add('sun');
            say([['comms', 'Oh shit, mother—', 'ohShit']], { urgent: true });
          } else if (e.kind) say(linesFor(crew, 'crashInto', e.kind), { urgent: true }); // (a wonder: its own lines, every time)
          else if (often('crash', now)) say(linesFor(crew, 'crash'), { urgent: true });
        } else if (e.type === 'respawn') {
          respawnSound(crew?.id);
        } else if (e.type === 'traffic') {
          // something going past: the first of each kind always gets a line
          flybySound(e.kind);
          const key = `traffic:${e.kind}`;
          if (!said.current.has(key) || often('traffic', now)) {
            said.current.add(key);
            say(linesFor(crew, 'traffic', e.kind));
          }
        } else if (e.type === 'kill') {
          popSound();
          if (often('kill', now)) say(linesFor(crew, 'kill', e.kind), { urgent: true });
        } else if (e.type === 'edge') {
          if (often('edge', now)) say(linesFor(crew, 'edge'));
        } else if (e.type === 'idle') {
          if (said.current.has('idle')) return;
          said.current.add('idle');
          say(linesFor(crew, 'idle'));
        } else if (e.type === 'fire') {
          // on foot, the gun in hand (yours, or your crewmate's further off); in the ship, its guns
          if (e.gun) {
            if (soundOnce(e.soft ? 'mateFire' : 'fire', 90, now)) gunSound(e.gun, { soft: e.soft });
          } else if (e.weapon === 'heavy') launchSound(crew?.id);
          else if (soundOnce('fire', 150, now)) fireSound(crew?.id);
        } else if (e.type === 'impact') {
          if (soundOnce('impact', 70, now)) impactSound(e.near);
        } else if (e.type === 'weapon') {
          switchSound();
        } else if (e.type === 'dry') {
          if (soundOnce('dry', 300, now)) drySound();
          if (often('dry', now)) say(linesFor(crew, 'siege', 'dry'));
        } else if (e.type === 'boom') {
          if (soundOnce('boom', 120, now)) boomSound(e.big);
        } else if (e.type === 'siege') {
          // the Citadel's siege (siege.js), as it goes
          if (e.what === 'shielded') {
            if (soundOnce('shield', 200, now)) shieldSound();
            if (often('shielded', now)) say(linesFor(crew, 'siege', 'shielded'));
          } else if (e.what === 'deflected') {
            if (soundOnce('shield', 200, now)) shieldSound();
            if (often('deflect', now)) say(linesFor(crew, 'siege', 'deflect'), { urgent: true });
          } else if (e.what === 'gen') {
            if (e.near) boomSound(true);
            say(linesFor(crew, 'siege', e.left === 0 ? 'shield' : 'gen'), { urgent: true });
          } else if (e.what === 'down') {
            if (e.near) crashSound();
            say(linesFor(crew, 'siege', 'down'), { urgent: true });
          } else if (e.what === 'rebuilt') {
            if (e.near) portalSound();
            say(linesFor(crew, 'siege', 'rebuilt'));
          } else if (e.what === 'closed') {
            if (often('closed', now)) say(linesFor(crew, 'siege', 'closed'), { urgent: true });
          }
        } else if (e.type === 'interdicted') {
          interdictSound();
          say(linesFor(crew, 'interdicted'), { urgent: true });
        } else if (e.type === 'hunted') {
          // a pack after you: Vader gets his own line, the first time
          if (e.faction === 'council') portalSound();
          const ace = e.ace && !said.current.has('ace');
          if (ace) said.current.add('ace');
          if (ace || often('hunted', now)) say(linesFor(crew, 'hunted', ace ? 'ace' : e.faction), { urgent: true });
        } else if (e.type === 'shot') {
          if (soundOnce('shot', 90, now)) enemyFireSound();
        } else if (e.type === 'laser') {
          if (soundOnce('hit', 120, now)) hitSound();
          if (often('hit', now)) say(linesFor(crew, 'hit'));
        } else if (e.type === 'shields') {
          alarmSound();
          say(linesFor(crew, 'shields'), { urgent: true });
        } else if (e.type === 'destroyed') {
          crashSound();
          say(linesFor(crew, 'destroyed'), { urgent: true });
        } else if (e.type === 'escaped' || e.type === 'cleared') {
          say(linesFor(crew, e.type), { urgent: true });
        } else if (e.type === 'event') {
          if (e.id === 'destroyer') jumpSound();
          else if (e.id === 'flare') flareSound();
          else if (e.id === 'rift') riftSound();
          if (e.id === 'leave') jumpSound(true);
          else say(linesFor(crew, 'event', e.id, e.sub), { urgent: e.id !== 'convoy' && e.id !== 'comet' });
        } else if (e.type === 'foot') {
          // on foot: down onto a planet and out, the squads, and back in
          if (e.id === 'kill') {
            popSound();
            if (often('kill', now)) say(linesFor(crew, 'foot', 'kill', e.kind), { urgent: true });
          } else if (e.id === 'hurt') {
            if (soundOnce('hit', 120, now)) hitSound();
            if (often('hit', now)) say(linesFor(crew, 'foot', 'hurt'));
          } else if (e.id === 'swap') say(linesFor(crew, 'foot', 'swap', e.who), { urgent: true });
          else if (e.id === 'far' || e.id === 'nowhere') {
            if (often('edge', now)) say(linesFor(crew, 'foot', e.id));
          } else if (e.id !== 'off') say(linesFor(crew, 'foot', e.id, e.who), { urgent: e.id === 'squad' || e.id === 'down' || e.id === 'alt' });
        } else if (e.type === 'wonder') {
          const key = `wonder:${e.id}`;
          if (said.current.has(key)) return;
          said.current.add(key);
          say(linesFor(crew, 'wonder', e.id), { urgent: true });
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [crew],
  );

  const speaker = line && (line.who === 'comms' ? COMMS : crew?.speakers[line.who]);
  useMouth(box, Boolean(speaker) && line.who !== 'comms', reduced);
  return (
    <div ref={box} className="universe-comms" aria-live="polite" data-motion={reduced ? undefined : ''}>
      {speaker && (
        <p key={line.n} className="universe-line" style={{ '--who': speaker.color }}>
          {line.who !== 'comms' && <Face who={line.who} className="universe-face" />}
          <span>
            <span className="universe-who">{speaker.name}</span>
            <span className="universe-said">{line.text}</span>
          </span>
        </p>
      )}
    </div>
  );
}
