// Roy: A Life Well Lived, the Blips and Chitz VR game, as rules. A boy at the
// window, a Friday night, a carpet store, a diagnosis, then work until work
// ends or he reaches 100. No drawing (the scene draws it), so it can be tested
// on its own.
//
// Lanes are 0..2 (Roy starts in 1). A tackler or a roll has `z`, its distance
// in metres ahead of Roy. `stepLife` is pure: it returns a new life, with the
// random state carried in `life.rng`. Input flags are true only on the frame a
// key went down, and apply to the state the player is looking at. A step is at
// most a tenth of a second.
//
// Doing well early earns `grit`: each point lets Roy shrug off one roll in the
// finale instead of dying under it.
//
// On the step a stage ends, `age` still reads that stage's last year (12, 18,
// 44, 45); the next stage's age starts on the following step.

export const MORTY_BEST = 55;
export const OLD_AGE = 100;

export const STAGES = ['kid', 'football', 'carpet', 'cancer', 'finale'];
export const STAGE_INFO = {
  kid: { title: 'Growing up', from: 0, to: 12 },
  football: { title: 'Friday nights', from: 13, to: 18 },
  carpet: { title: 'The carpet store', offgrid: 'Off the grid', from: 19, to: 44 },
  cancer: { title: 'The diagnosis', from: 45, to: 45 },
  finale: { title: 'Back to work', offgrid: 'The woods', from: 46, to: OLD_AGE },
};
export const stageTitle = (life) => (life.route === 'offgrid' && STAGE_INFO[life.stage].offgrid) || STAGE_INFO[life.stage].title;
// each stage's card's line (off the grid, the carpet store's and the
// finale's are the woods'); the diagnosis's is Roy's own, said in his voice
// (./voicelines.js)
const STAGE_LINES = {
  kid: 'A boy at the window, dreaming of the NFL.',
  football: 'Friday night under the lights, and the end zone a long way off.',
  carpet: 'The dream goes on the shelf: a family to provide for, and a job at the carpet store.',
  offgrid: 'No job and no store: a cabin in the woods, and whatever the woods give.',
  cancer: '“I’m not ready to die.”',
  finale: 'Back at the store, where the rolls are stacked high.',
  woods: 'Back in the woods, where the logs are stacked high.',
};
export const stageLine = (life) => (life.stage === 'carpet' && life.route === 'offgrid' ? STAGE_LINES.offgrid : life.stage === 'finale' && life.route === 'offgrid' ? STAGE_LINES.woods : STAGE_LINES[life.stage]);
// the lines Roy says himself
export const ROY_SAYS = [STAGE_LINES.cancer];

// the tire starts at the far end of its swing, so the first throw is no free hit
const KID = Object.freeze({ swing: 2.4, band: 0.28, throws: 5, start: -Math.PI / 2 });
const FOOTBALL = Object.freeze({ spawn: 0.9, ahead: 40, speed: 14, run: 9, goal: 100, stun: 1.5, limit: 16 });
const CARPET = Object.freeze({ customers: 8, patience: 4, gap: 0.6 });
const CANCER = Object.freeze({ beat: 0.75, window: 0.16, need: 12, offbeats: 6, limit: 24 });
const FINALE = Object.freeze({ ahead: 30, from: 46 });
const GRIT = Object.freeze({ hits: 4, sales: 6 });
// the numbers, for the drawing and the HUD (read only)
export const TUNING = Object.freeze({ kid: KID, football: FOOTBALL, carpet: CARPET, cancer: CANCER, finale: FINALE, grit: GRIT });

// a throw now would go through the tire
export const inBand = (phase) => Math.abs(phase) < KID.band;

// the beat a press now would take (k sounds at k * beat seconds), or 0 for none:
// just after a beat (not before the first has sounded), or just before the next
function beatAt(s) {
  const late = s.beatT;
  const early = CANCER.beat - s.beatT;
  return s.elapsed >= 1 && late <= CANCER.window ? s.elapsed : early <= CANCER.window ? s.elapsed + 1 : 0;
}
// what a press would do now in the diagnosis: 'open' (a beat), 'taken' (that
// beat's already had its press: an offbeat) or 'closed' (no beat near: an offbeat)
export function beatWindow(life) {
  if (life.stage !== 'cancer' || life.over) return 'closed';
  const k = beatAt(life.s);
  return k === 0 ? 'closed' : k > life.s.hit ? 'open' : 'taken';
}

// mulberry32 on a uint32 (as shire/rules.js `seeded`), but the state is passed in and out
export function rand(state) {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s >>> 0];
}
// the next number for the copy of the life that `stepLife` is working on
function draw(L) {
  const [v, next] = rand(L.rng);
  L.rng = next;
  return v;
}
const drawLane = (L) => Math.floor(draw(L) * 3);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const shift = (lane, input) => clamp(lane + (input.right ? 1 : 0) - (input.left ? 1 : 0), 0, 2);

const START = {
  kid: () => ({ throws: 0, hits: 0, phase: Math.sin(KID.start) }),
  football: () => ({ dist: 0, stun: 0, time: 0, spawn: FOOTBALL.spawn, tacklers: [] }),
  carpet: (L) => ({ served: 0, customer: null, pointer: 1, gap: CARPET.gap, choice: L.choose }),
  cancer: () => ({ beatT: 0, beats: 0, offbeats: 0, elapsed: 0, hit: 0 }),
  finale: () => ({ rolls: [], next: 1.3 }),
};

export function newLife({ seed = 1, offgrid = false, offerChoice = false } = {}) {
  return {
    stage: 'kid',
    age: 0,
    t: 0,
    lane: 1,
    route: offgrid ? 'offgrid' : 'job',
    choose: offerChoice,
    grit: 0,
    over: false,
    cause: null,
    endAge: null,
    stats: { dream: 0, touchdown: false, tackles: 0, sales: 0, beats: 0 },
    rng: seed >>> 0,
    s: START.kid(),
    events: [],
  };
}

export const ageOf = (life) => Math.floor(life.age);
export const beatMorty = (life) => ageOf(life) > MORTY_BEST;

function enter(L, stage) {
  L.stage = stage;
  L.lane = 1;
  L.s = START[stage](L);
  L.events.push('stage');
}
function die(L, cause) {
  L.over = true;
  L.cause = cause;
  L.endAge = ageOf(L);
  L.events.push('death');
}

// ── the stages ──

function stepKid(L, input) {
  const s = L.s;
  if (input.act) {
    s.throws++;
    L.events.push('throw');
    const hit = inBand(s.phase);
    if (hit) {
      s.hits++;
      L.stats.dream = s.hits;
    }
    L.events.push(hit ? 'hit' : 'miss');
  }
  L.age = (12 * s.throws) / KID.throws;
  if (s.throws >= KID.throws) {
    if (s.hits >= GRIT.hits) L.grit++;
    enter(L, 'football');
  } else s.phase = Math.sin(L.t * KID.swing + KID.start);
}

function stepFootball(L, input, dt) {
  const s = L.s;
  L.lane = shift(L.lane, input);
  s.time += dt;
  if (s.stun > 0) s.stun = Math.max(0, s.stun - dt);
  else s.dist += FOOTBALL.run * dt;
  s.tacklers = s.tacklers.filter((k) => {
    const was = k.z;
    k.z -= FOOTBALL.speed * dt;
    if (was > 0 && k.z <= 0 && k.lane === L.lane) {
      s.stun = FOOTBALL.stun;
      L.stats.tackles++;
      L.events.push('tackle');
      return false;
    }
    return k.z > -6;
  });
  s.spawn -= dt;
  if (s.spawn <= 0) {
    s.spawn += FOOTBALL.spawn;
    s.tacklers.push({ lane: drawLane(L), z: FOOTBALL.ahead });
  }
  const scored = s.dist >= FOOTBALL.goal;
  if (scored) {
    s.dist = FOOTBALL.goal;
    L.stats.touchdown = true;
    L.grit++;
    L.events.push('touchdown');
  }
  L.age = 13 + 5 * Math.min(1, s.dist / FOOTBALL.goal);
  if (scored || s.time >= FOOTBALL.limit - 1e-9) {
    L.age = STAGE_INFO.football.to;
    enter(L, 'carpet');
  }
}

// `customer.patience` is the seconds left; `served` counts every customer through the door, sold to or not
function stepCarpet(L, input, dt) {
  const s = L.s;
  if (s.choice) {
    if (input.choose === 'job' || input.choose === 'offgrid') {
      L.route = input.choose;
      s.choice = false;
    }
  } else {
    s.pointer = shift(s.pointer, input);
    const c = s.customer;
    if (!c) {
      s.gap -= dt;
      if (s.gap <= 0) s.customer = { want: drawLane(L), patience: CARPET.patience };
    } else {
      c.patience -= dt;
      if (input.act || c.patience <= 0) {
        const sold = input.act && s.pointer === c.want;
        if (sold) L.stats.sales++;
        L.events.push(sold ? 'sale' : 'lost');
        s.served++;
        s.customer = null;
        s.gap = CARPET.gap;
      }
    }
  }
  L.age = 19 + (25 * s.served) / CARPET.customers;
  if (s.served >= CARPET.customers) {
    if (L.stats.sales >= GRIT.sales) L.grit++;
    enter(L, 'cancer');
  }
}

// beat k sounds at k * 0.75 s; `hit` is the last beat taken, so one beat counts once
function stepCancer(L, input, dt) {
  const s = L.s;
  L.age = 45;
  if (input.act) {
    const k = beatAt(s);
    if (k > s.hit) {
      s.hit = k;
      s.beats++;
      L.stats.beats++;
      L.events.push('beat');
    } else {
      s.offbeats++;
      L.events.push('offbeat');
    }
  }
  if (s.beats >= CANCER.need) return enter(L, 'finale');
  if (s.offbeats >= CANCER.offbeats) return die(L, 'cancer');
  s.beatT += dt;
  const passed = Math.floor(s.beatT / CANCER.beat);
  s.beatT -= passed * CANCER.beat;
  s.elapsed += passed;
  if (s.elapsed >= CANCER.limit) die(L, 'cancer');
}

// each roll keeps the speed it was rolled at; one in Roy's lane costs a grit if he has one, else his life
function stepFinale(L, input, dt) {
  const s = L.s;
  L.age = Math.max(L.age, FINALE.from);
  L.lane = shift(L.lane, input);
  s.rolls = s.rolls.filter((r) => {
    const was = r.z;
    r.z -= r.v * dt;
    if (was > 0 && r.z <= 0 && !L.over) {
      if (r.lane !== L.lane) {
        L.age++;
        L.events.push('dodge');
      } else if (L.grit > 0) {
        L.grit--;
        L.events.push('shrug');
        return false;
      } else die(L, L.route === 'job' ? 'carpet' : 'log');
    }
    return r.z > -6;
  });
  if (L.over) return;
  if (L.age >= OLD_AGE) {
    L.age = OLD_AGE;
    return die(L, 'old');
  }
  s.next -= dt;
  if (s.next <= 0) {
    const years = L.age - FINALE.from;
    s.next += Math.max(0.45, 1.3 - years * 0.02);
    s.rolls.push({ lane: drawLane(L), z: FINALE.ahead, v: 10 + years * 0.25 });
  }
}

const STEP = { kid: stepKid, football: stepFootball, carpet: stepCarpet, cancer: stepCancer, finale: stepFinale };

export function stepLife(life, input = {}, dt = 1 / 60) {
  if (life.over) return life.events.length ? { ...life, events: [] } : life;
  const h = clamp(dt, 0, 0.1);
  const L = { ...life, stats: { ...life.stats }, s: structuredClone(life.s), events: [] };
  L.t += h;
  STEP[L.stage](L, input || {}, h);
  return L;
}

// ── how it ended ──

export function epitaph(life) {
  const at = STAGES.indexOf(life.stage);
  const { touchdown, sales } = life.stats;
  const did = ['Dreamed of the NFL'];
  if (touchdown) did.push('scored a touchdown');
  if (at >= 2) did.push(life.route === 'offgrid' ? 'lived off the grid in the woods' : sales <= 2 ? 'sold hardly any carpet' : 'sold carpet');
  if (at >= 4) did.push('beat cancer');
  const age = life.endAge ?? ageOf(life);
  const end = {
    cancer: 'Not ready to die.',
    carpet: 'A roll of carpet came loose.',
    log: 'A log came down.',
    old: `A life well lived, all the way to ${OLD_AGE}.`,
  }[life.cause];
  return `Roy, 0–${age}. ${did.join(', ')}. ${end || 'Still going.'}`;
}
