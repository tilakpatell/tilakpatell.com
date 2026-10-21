// What the visitor does on the Road: the deeds at the beats that carry one
// (deeds.js's rules) and a word with whoever walks beside them (talk.js).
// The walk stops at a deed's beat; the beat plays up to the deed's moment
// (`deed.at`, seconds into it) and waits there while the page shows what
// to press; done, the deed's own lines and clip are said and the beat
// plays on. It keeps their state, tells the page, and has the cast speak;
// the rules are the pure files'.
//
//   createDoing({ stages, beatsOf, lines, tell, say, clip, reduced }) → {
//     gate(s) → the s of the next deed undone at or ahead of s, or null (the clock's ctx.gate)
//     holdAfter(s) → the seconds the beat on s holds once its deed is done (the clock's)
//     waits(stage) → { beatId: seconds } of the deeds undone there (scenes.at's)
//     jumped(s): the deeds behind s done (unplayed), those at or ahead undone again
//     step(dt, input, { s, stage, since, present, auto }): the deed on the mark,
//       played once its beat has reached its moment (`since`: the beats', last frame)
//     choosing() → whether a word is to be chosen now (the digit keys pick it, not a stage)
//     stance() → the clip the company takes this frame for a deed with a `stance` (keep
//       still: 'crouch'), while the visitor holds it and through its beat's hold once
//       done, or null
//     talk(stage, present): the next of the company's lines, said
//     press(name, down) (act, left, right: the touch buttons), pick(i) }
//
// Events to the page: 'deed' { key, label, verb, keys, choices, progress, wrong } while one
// waits for the visitor (null once done), 'talk' { who, name } (null when there's no one).

import { sOf } from './line';
import { keysOf, newDeed, stepDeed, verbOf } from './deeds';
import { nameOf, nextLine } from './talk';

const ON = 1e-9; // s: on a mark is at it
const STEP = 0.04; // a hold's or a rhythm's progress the page is told again after

export function createDoing({ stages, beatsOf, lines = {}, tell, say, clip = () => {}, reduced = false }) {
  const marks = stages
    .flatMap((st) => (beatsOf[st.id] ?? []).filter((b) => b.deed).map((b) => ({ key: `${st.id}:${b.id}`, stage: st.id, beat: b, s: sOf(stages, st.id, b.at) })))
    .sort((a, b) => a.s - b.s);
  const states = new Map(); // key → deeds.js's state
  const touch = { act: false, acted: false, left: false, right: false, pick: null };
  const said = new Set();
  let told = null; // the deed the page has, and how far
  let stanceNow = null; // the company's stance this frame
  let stanced = null; // the deed done whose stance they keep through its beat
  let talkTold;
  const done = (m) => Boolean(states.get(m.key)?.done);
  const on = (s) => marks.find((m) => Math.abs(m.s - s) < ON && !done(m)) ?? null;

  const show = (m, st) => {
    if (!m) {
      if (told) tell('deed', null);
      told = null;
      return;
    }
    const d = m.beat.deed;
    const progress = Math.round(st.progress / STEP) * STEP;
    if (told?.key === m.key && told.progress === progress && told.wrong === st.wrong) return;
    told = { key: m.key, progress, wrong: st.wrong };
    tell('deed', { key: m.key, label: d.label, verb: verbOf(d, reduced), keys: keysOf(d, reduced), choices: d.verb === 'choose' ? d.choices.map((c) => c.label) : null, progress, wrong: st.wrong });
  };
  // done: what follows it, said and played
  const after = (d) => {
    for (const id of d.lines ?? []) if (lines[id]) say(lines[id].who, lines[id].text);
    if (d.clip) clip(d.clip);
  };

  return {
    gate: (s) => marks.find((m) => m.s >= s - ON && !done(m))?.s ?? null,
    holdAfter(s) {
      const m = marks.find((x) => Math.abs(x.s - s) < ON);
      return m ? Math.max(0, (m.beat.hold ?? 0) - (m.beat.deed.at ?? 0)) : 0;
    },
    waits(stage) {
      const out = {};
      for (const m of marks) if (m.stage === stage && !done(m)) out[m.beat.id] = m.beat.deed.at ?? 0;
      return out;
    },
    jumped(s) {
      for (const m of marks) {
        if (m.s < s - ON) states.set(m.key, { ...newDeed(), progress: 1, done: true, by: 'jump' });
        else states.delete(m.key);
      }
      show(null);
    },
    step(dt, input, { s, stage, since = {}, present = [], auto = false }) {
      const m = on(s);
      // (the beat at the deed's moment: until then it plays, and there's nothing to press)
      const ready = m && (since[m.beat.id] ?? -1) >= (m.beat.deed.at ?? 0) - 1e-6;
      if (ready) {
        const was = states.get(m.key) ?? newDeed();
        const into = { act: Boolean(input.act || touch.acted), acting: Boolean(input.acting || touch.act), left: Boolean(input.left || touch.left), right: Boolean(input.right || touch.right), pick: input.pick ?? touch.pick };
        const st = stepDeed(was, m.beat.deed, into, { dt, auto, reduced });
        // (a wrong word: who knows better says so)
        if (st.wrong != null && st.wrong !== was.wrong) {
          const c = m.beat.deed.choices[st.wrong];
          if (c?.line) say(c.line.who, c.line.text);
        }
        states.set(m.key, st);
        if (st.done) after(m.beat.deed);
        show(st.done ? null : m, st);
        if (st.done && m.beat.deed.stance) stanced = m;
      } else show(null);
      // (keep still: the company down with the visitor while it's held, and till the danger's past)
      const holding = ready && !states.get(m.key)?.done && (states.get(m.key)?.progress ?? 0) > 0;
      const kept = stanced && since[stanced.beat.id] != null && since[stanced.beat.id] < (stanced.beat.hold ?? 0);
      if (!kept) stanced = null;
      stanceNow = holding ? (m.beat.deed.stance ?? null) : kept ? stanced.beat.deed.stance : null;
      touch.acted = false;
      touch.left = false;
      touch.right = false;
      touch.pick = null;
      // (the talk's prompt: who'd answer, if anyone walks with you and no deed waits)
      const next = m ? null : nextLine(stage, present, said);
      const who = next?.who ?? null;
      if (who !== talkTold) {
        talkTold = who;
        tell('talk', who ? { who, name: nameOf(who, stage) } : null);
      }
    },
    choosing() {
      const m = told ? marks.find((x) => x.key === told.key) : null;
      return m?.beat.deed.verb === 'choose';
    },
    stance: () => stanceNow,
    talk(stage, present) {
      const next = nextLine(stage, present, said);
      if (!next) return null;
      said.add(next.id);
      say(next.who, next.text);
      return next;
    },
    press(name, down) {
      if (name === 'act') {
        if (down && !touch.act) touch.acted = true;
        touch.act = Boolean(down);
      } else if ((name === 'left' || name === 'right') && down) touch[name] = true;
    },
    pick(i) {
      touch.pick = i;
    },
  };
}
