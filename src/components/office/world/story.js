// Dunder Mifflin Scranton, the world: a week at the office as Jim, in seven
// jobs. The things to do (the towns' quests), the talk (the towns' talk
// data), and the rules for the three jobs with clocks on them: the chili
// carried without spilling, the stapler in Jell-O before Dwight's back, and
// out of the building in Dwight's fire drill. Pure: no drawing, no React.

import { progress } from '../../middleearth/towns/story';

export const QUESTS = [
  { id: 'phones', name: 'Cover reception', go: 'Erin needs a break. Sit in at reception and put five calls through to the right people.' },
  { id: 'jello', name: 'The stapler', go: 'Get the Jell-O from the kitchen fridge, then set Dwight’s stapler in it while he’s in the men’s room.' },
  { id: 'chili', name: 'Kevin’s famous chili', go: 'Kevin’s chili is waiting at the lift. Carry it to the kitchen without spilling a drop.' },
  { id: 'toss', name: 'Office Olympics', go: 'Paper toss, from your desk to the bin. Play a round.' },
  { id: 'factcheck', name: 'Dwight’s fact check', go: 'Dwight has facts. Tell him which of them are false.' },
  { id: 'hoops', name: 'Office vs. warehouse', go: 'Down the stairwell to the warehouse. Darryl says the office can’t sink three free throws out of five.' },
  { id: 'fire', name: 'Stress relief', needs: ['jello', 'chili'], go: 'Dwight’s fire safety seminar, in the conference room. Then get out by the stairwell before the clock runs out.' },
  { id: 'dundies', name: 'The Dundies', needs: ['phones', 'jello', 'chili', 'toss', 'factcheck', 'hoops', 'fire'], go: 'Michael wants to see you in his office. Bring your speech face.' },
];
// each job's award, in the site's Dundies (Achievements.jsx)
export const SEAL = { phones: 'switchboard', jello: 'jello', chili: 'chili', toss: 'olympics', factcheck: 'falsefact', fire: 'stressrelief', hoops: 'hoops', dundies: 'bestboss' };

export function officeProgress(done) {
  const p = progress(QUESTS, done);
  const q = p.quests.find((x) => x.id === p.next);
  const objective = p.finished ? 'The week’s done. Walk about, say hi, and press E on the things that catch your eye.' : q ? q.go : 'Something’s going on in the office. Have a look round.';
  return { ...p, objective };
}

// ── the calls at reception: who does each caller want? ──
const CALLS = [
  { say: 'Hi! I’m after the salesman who’s also a volunteer sheriff’s deputy. And owns a beet farm?', right: 'dwight', wrong: ['stanley', 'andy', 'creed'] },
  { say: 'Bob Vance, Vance Refrigeration. Put me through to my wife, would you?', right: 'phyllis', wrong: ['angela', 'kelly', 'meredith'] },
  { say: 'This is the vet’s office. It’s about one of the cats. Again. Which one? All of them, really.', right: 'angela', wrong: ['oscar', 'phyllis', 'toby'] },
  { say: 'Cornell alumni office, about the a cappella reunion. He told us to ask for “the Nard Dog”?', right: 'andy', wrong: ['ryan', 'kevin', 'darryl'] },
  { say: 'Hello, I’d like to make a complaint. To HR. About the regional manager. Again.', right: 'toby', wrong: ['michael', 'oscar', 'creed'] },
];
const PEOPLE = { dwight: 'Dwight', stanley: 'Stanley', andy: 'Andy', creed: 'Creed', phyllis: 'Phyllis', angela: 'Angela', kelly: 'Kelly', meredith: 'Meredith', oscar: 'Oscar', toby: 'Toby', ryan: 'Ryan', kevin: 'Kevin', darryl: 'Darryl', michael: 'Michael' };
// what happens when it goes to the wrong desk
const MISSED = {
  stanley: 'Stanley picks up, listens, and puts the phone down without a word. It rings again.',
  andy: '“Andy Bernard, Nard Dog!” A pause. “That’s… not me. I’ll transfer you back.” It rings again.',
  creed: 'Creed answers. “Creed Bratton. Who? Never heard of him. Or her.” He hangs up. It rings again.',
  angela: 'Angela listens and says “No.” Click. It rings again.',
  kelly: 'Kelly picks up and starts telling the caller about Ryan. Twenty minutes later, it rings again.',
  meredith: 'It rings and rings at Meredith’s desk. She’s not at it. It comes back to you.',
  oscar: '“Actually, I think you want someone else.” Oscar puts it back through to you.',
  phyllis: 'Phyllis says she’ll pass it on, and doesn’t. It rings again.',
  toby: 'Toby answers, very quietly. The caller hangs up. It rings again.',
  ryan: '“Ryan Howard, founder, WUPHF.com.” The caller hangs up. It rings again.',
  kevin: '“Kevin. Who this?” It rings again.',
  darryl: '“Warehouse.” Darryl hangs up. It rings again.',
  michael: 'Michael answers on the first ring. “Michael Scott, World’s Best Boss.” The caller hangs up. Michael looks hurt.',
};
// the options for each call, in a mixed order (fixed, so it's the same each time)
const order = (c, k) => {
  const all = [c.right, ...c.wrong];
  const turn = (k * 3 + 1) % all.length;
  return [...all.slice(turn), ...all.slice(0, turn)];
};
function phonesConvo() {
  const nodes = {
    start: { who: 'erin', say: 'Thank you thank you thank you. Just put them through to whoever they want. The transfer button is the one with the arrow. I think.', next: 'c0' },
  };
  CALLS.forEach((c, k) => {
    nodes[`c${k}`] = { who: 'caller', say: c.say, choices: order(c, k).map((id) => ({ text: `Put it through to ${PEOPLE[id]}`, to: id === c.right ? (k === CALLS.length - 1 ? 'done' : `ok${k}`) : `miss${k}-${id}` })) };
    if (k < CALLS.length - 1) nodes[`ok${k}`] = { who: 'jim', say: ['Transferring you now.', 'Putting you through.', 'One moment, please.', 'Connecting you.'][k % 4], next: `c${k + 1}` };
    for (const id of c.wrong) nodes[`miss${k}-${id}`] = { who: 'narrator', say: MISSED[id], next: `c${k}` };
  });
  nodes.done = { who: 'erin', say: 'I’m back! Did anything happen? You look like you did the phones really well. Like, really well.', end: 'won' };
  return { start: 'start', nodes };
}

// ── the Dundies, in Michael's office ──
const DUNDIES = {
  start: 'a',
  nodes: {
    a: { who: 'michael', say: 'Jim! Come in, come in. Close the door. No, leave it open. It’s more dramatic.', next: 'b' },
    b: { who: 'michael', say: 'You have been doing things this week. Things. The phones. Kevin’s chili, intact. A fire drill I would like to say was not my idea, and was not.', next: 'c' },
    c: {
      who: 'michael',
      say: 'Which is why I am holding an emergency Dundies. A Dundie for one. Any last words before you win?',
      choices: [
        { text: '“Is this about the stapler?”', to: 'stapler' },
        { text: '“That’s what she said.”', to: 'twss' },
        { text: '“Shouldn’t everyone get one?”', to: 'everyone' },
      ],
    },
    stapler: { who: 'michael', say: 'What stapler? I know nothing about a stapler. Dwight is still in the kitchen trying to eat it out, by the way.', next: 'award' },
    twss: { who: 'michael', say: 'That’s what she… no. No. That’s MY line, Jim. You can’t just… okay, that was good.', next: 'award' },
    everyone: { who: 'michael', say: 'Everyone does get one! But today, this one is just for you.', next: 'award' },
    award: { who: 'michael', say: 'And so, by the power vested in me by Dunder Mifflin and by me: the “Best Week in the Office” Dundie goes to… Jim Halpert!', next: 'thanks' },
    thanks: { who: 'michael', say: 'Thank you. No, you say thank you. We’ll practise.', end: 'won' },
  },
};

export const CONVOS = { phones: phonesConvo(), dundies: DUNDIES };
export const SPEAKERS = { erin: 'Erin', caller: 'On line one', jim: 'You', narrator: '', michael: 'Michael' };
export const CALL_COUNT = CALLS.length;
// which call a talk is on (for the HUD)
export const callOf = (at) => {
  const m = /^(?:c|ok|miss)(\d+)/.exec(at ?? '');
  return m ? Number(m[1]) : at === 'done' ? CALLS.length : 0;
};

// ── Kevin's chili: carried, it slops about ──
// The pot sloshes with how sharply Jim speeds up, slows down or turns, and
// with running; it settles when he's steady. Over the brim and it's on the
// carpet.
export const CHILI = { brim: 1, settle: 0.55, push: 0.08, turn: 0.06, run: 0.9 };
export const newChili = () => ({ slosh: 0, vx: 0, vz: 0, face: null, spilt: false });
export function stepChili(c, h, dt) {
  if (c.spilt || dt <= 0) return c;
  const ax = (h.vx - c.vx) / dt;
  const az = (h.vz - c.vz) / dt;
  const jolt = Math.hypot(ax, az);
  let dTurn = c.face == null ? 0 : h.face - c.face;
  dTurn = Math.abs(Math.atan2(Math.sin(dTurn), Math.cos(dTurn))) / dt;
  const add = Math.max(0, jolt - 2.5) * CHILI.push * dt + Math.max(0, dTurn - 2) * CHILI.turn * dt + (h.running ? CHILI.run * dt : 0);
  const slosh = Math.max(0, c.slosh + add - CHILI.settle * dt * (h.speed < 0.2 ? 1.6 : 1) * 0.5);
  return { slosh, vx: h.vx, vz: h.vz, face: h.face, spilt: slosh >= CHILI.brim };
}

// ── the stapler in Jell-O ──
// Dwight goes to the men's room when he sees you with the Jell-O; he's back
// in `away` seconds, then he takes `walk` to come back to his desk.
export const JELLO = { away: 32, walk: 7 };

// ── free throws in the warehouse ──
// A power meter swings; stop it in the sweet spot. Five shots, three to win.
export const HOOPS = { shots: 5, need: 3, sweet: 0.62, swish: 0.05, rim: 0.12, speed: 1.35, flight: 0.95 };
export const newHoops = () => ({ shots: 0, made: 0, t: 0, ball: null, over: false });
// the meter, 0..1, at time t (a ping-pong that speeds up a little each shot)
export const meterAt = (h) => {
  const k = (h.t * HOOPS.speed * (1 + h.shots * 0.08)) % 2;
  return k < 1 ? k : 2 - k;
};
// a shot at the meter's power: 'swish', 'rim' (in off the rim) or a miss ('short' / 'long')
export function shoot(h) {
  if (h.over || h.ball) return null;
  const p = meterAt(h);
  const off = p - HOOPS.sweet;
  const kind = Math.abs(off) <= HOOPS.swish ? 'swish' : Math.abs(off) <= HOOPS.rim ? 'rim' : off < 0 ? 'short' : 'long';
  h.ball = { t: 0, kind, power: p };
  return kind;
}
// the ball's flight; returns 'in' or 'out' when it lands
export function stepHoops(h, dt) {
  h.t += dt;
  if (!h.ball) return null;
  h.ball.t += dt;
  if (h.ball.t < HOOPS.flight) return null;
  const made = h.ball.kind === 'swish' || h.ball.kind === 'rim';
  h.shots += 1;
  if (made) h.made += 1;
  h.ball = null;
  if (h.made >= HOOPS.need || h.shots - h.made > HOOPS.shots - HOOPS.need) h.over = true;
  return made ? 'in' : 'out';
}

// ── Dwight's fire drill ──
// From the conference room to the stairwell before the clock runs out.
export const FIRE = { time: 38 };
export const fireLeft = (t) => Math.max(0, Math.ceil(FIRE.time - t));
