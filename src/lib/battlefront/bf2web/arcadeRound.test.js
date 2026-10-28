import { describe, expect, it } from 'vitest';
import golden from './fixtures/arcadeRound.json';
import { differs, lines } from './fixtures/golden.js';
import { DEATH, ONSLAUGHT, REASON, RESULT, aiTeam, createArcadeRound, onAIDeath, onHumanDeath, onHumanSpawned, tick } from './arcadeRound.js';

// bf2-web's ArcadeRules fields by the driver's names (WebPort/ai/arcade-driver.cpp's SetRule)
const INTENSITY_KEYS = ['killsPerStep', 'minAI', 'maxAI', 'deathPenalty', 'squadNormal', 'squadAtMax', 'timeBetweenWaves'];
const stateOf = (s) => ({
  killsHuman: s.killsHuman, killsAI: s.killsAI, limitHuman: s.limitHuman, limitAI: s.limitAI, humanDeaths: s.humanDeaths, aiDeaths: s.aiDeaths,
  steps: s.steps, wantedAI: s.wantedAI, squad: s.squad, maxReached: s.maxReached, timeBetweenWaves: s.timeBetweenWaves, inUse: s.inUse,
  released: s.released, timerStarted: s.timerStarted, timerRunning: s.timerRunning, timeRemaining: s.timeRemaining, active: s.active,
  result: s.result, reason: s.reason, resultTime: s.resultTime, roundTime: s.roundTime,
});

// The driver's script played through the JavaScript, printing what the driver prints
function replay(script) {
  const out = [];
  const rules = { intensity: {} };
  let round = null;
  let n = 0;
  for (const [verb, ...w] of lines(script)) {
    if (verb === 'rules') {
      for (let i = 0; i < w.length; i += 2) {
        const v = Number(w[i + 1]);
        if (INTENSITY_KEYS.includes(w[i])) rules.intensity[w[i]] = v;
        else rules[w[i]] = v;
      }
    } else if (verb === 'setup') {
      round = createArcadeRound(rules);
      n = 0;
      out.push({ setup: { ok: round ? 1 : 0, state: stateOf(round.state) } });
    } else if (verb === 'tick') {
      for (let i = 0; i < Number(w[0]); i++) {
        n++;
        const before = round.state.result;
        const released = tick(round, Number(w[1]));
        if (released) out.push({ release: { tick: n, n: released, state: stateOf(round.state) } });
        if (round.state.result !== before) out.push({ result: { tick: n, state: stateOf(round.state) } });
      }
    } else if (verb === 'ai' || verb === 'human') {
      const before = round.state.result;
      (verb === 'ai' ? onAIDeath : onHumanDeath)(round, Number(w[0]));
      if (round.state.result !== before) out.push({ result: { tick: n, state: stateOf(round.state) } });
    } else if (verb === 'spawn') onHumanSpawned(round);
    else if (verb === 'state') out.push({ state: { tick: n, state: stateOf(round.state) } });
    else throw new Error(`unknown verb ${verb}`);
  }
  return out;
}

const play = (name) => replay(golden.scenarios[name].script);
const states = (name) => play(name).filter((r) => r.state).map((r) => r.state.state);
const releases = (name) => play(name).filter((r) => r.release).map((r) => r.release);
const results = (name) => play(name).filter((r) => r.result).map((r) => r.result);

describe('the Arcade round, against bf2-web', () => {
  for (const [name, { script, records }] of Object.entries(golden.scenarios)) {
    it(`${name}: every record the native driver wrote, to the float`, () => {
      expect(differs(records, replay(script))).toBeNull();
    });
  }
});

// bf2-web's gate's own checks (WebPort/tests/arcade-round.mjs), read off the JavaScript
describe('the Arcade round, as bf2-web’s gate reads it', () => {
  it('sets up limit 10, wantedAI 6, a squad of 2 and the countdown unstarted', () => {
    const { setup } = play('spawner')[0];
    expect(setup).toMatchObject({ ok: 1, state: { limitHuman: 10, wantedAI: 6, squad: 2, timeBetweenWaves: 10, timerStarted: false, timeRemaining: 40 } });
  });

  it('releases a squad of 2 a tick until 6 are in use, holds one short and steps on two kills', () => {
    const r = releases('spawner');
    const s = states('spawner');
    expect(r.slice(0, 3).map((x) => `${x.tick}:${x.n}`)).toEqual(['1:2', '2:2', '3:2']);
    expect(s[0].inUse).toBe(6);
    expect(s[1].inUse).toBe(5);
    expect(r.some((x) => x.tick === 6)).toBe(false);
    expect(s[2]).toMatchObject({ steps: 1, wantedAI: 7, inUse: 6 });
    expect(r).toHaveLength(4);
  });

  it('latches the AI at 15 with squads of 4 and no more waves', () => {
    const s = states('max');
    expect(s[0]).toMatchObject({ wantedAI: 15, maxReached: true, squad: 4, timeBetweenWaves: 99999, inUse: 12 });
    expect(s[1].inUse).toBe(15);
    expect(s[2].inUse).toBe(13);
  });

  it('runs the countdown from the first kill, adds 3 s a kill and pauses while the human is dead', () => {
    const s = states('timer');
    expect(s[0]).toMatchObject({ timerStarted: false, timeRemaining: 40 });
    expect(s[1]).toMatchObject({ timerStarted: true, timerRunning: true, timeRemaining: 43 });
    expect(s[2].timeRemaining).toBe(42);
    expect(s[3].timeRemaining).toBe(45);
    expect(s[4].timeRemaining).toBeCloseTo(44.9, 5);
    expect(s[4].timerRunning).toBe(false);
    expect(s[5].timeRemaining).toBe(s[4].timeRemaining);
    expect(s[6].timerRunning).toBe(true);
    expect(s[6].timeRemaining).toBeCloseTo(43.9, 5);
  });

  it('counts a kill and a death with no inflictor for the human team, never an AI suicide or a friend’s kill', () => {
    const s = states('counters');
    expect(s[0]).toMatchObject({ killsHuman: 0, aiDeaths: 2 });
    expect(s[1].killsHuman).toBe(1);
    expect(s[2].killsHuman).toBe(2);
  });

  it('gives the human team the round at 10 kills, and nothing moves after it', () => {
    const r = results('win');
    expect(r).toHaveLength(1);
    expect(r[0].state).toMatchObject({ result: RESULT.team2, reason: REASON.kills, killsHuman: 10 });
    expect(states('win')[1]).toMatchObject({ active: false, killsHuman: 10 });
    expect(releases('win').some((x) => x.tick > 3)).toBe(false);
  });

  it('gives the AI team the round when the countdown runs out at 43 s', () => {
    const r = results('timeout');
    expect(r).toHaveLength(1);
    expect(r[0].state).toMatchObject({ result: RESULT.team1, reason: REASON.time, resultTime: 43 });
  });

  it('never ends on the human’s deaths with unlimited lives, and on the first with one', () => {
    expect(states('unlimited')[0]).toMatchObject({ active: true, result: RESULT.none, humanDeaths: 3, killsAI: 2 });
    expect(results('oneLife')[0].state).toMatchObject({ result: RESULT.team1, reason: REASON.lives });
  });
});

describe('the Arcade round’s defaults', () => {
  it('starts from Onslaught’s menu: 15 AI, 100 kills, 40 s, the human on the dark side', () => {
    const round = createArcadeRound();
    expect(round.rules).toMatchObject({ aiPlayers: ONSLAUGHT.aiPlayers, scoreLimit: 100, timeLimit: 40, humanTeam: 2 });
    expect(aiTeam(round)).toBe(1);
    expect(round.state).toMatchObject({ limitHuman: 100, wantedAI: 6, active: true });
  });

  it('refuses rules it doesn’t cover, as bf2-web’s setup does', () => {
    expect(createArcadeRound({ humanTeam: 3 })).toBeNull();
    expect(createArcadeRound({ mode: 2 })).toBeNull();
    expect(createArcadeRound({ intensity: { minAI: 9, maxAI: 4 } })).toBeNull();
    expect(createArcadeRound({ timeLimit: -1 })).toBeNull();
  });

  it('holds the AI team to the provider’s twenty', () => {
    expect(createArcadeRound({ aiPlayers: 64 }).rules.aiPlayers).toBe(20);
  });

  it('counts a human suicide only when lives are counted', () => {
    const free = createArcadeRound();
    onHumanDeath(free, DEATH.self);
    expect(free.state.killsAI).toBe(0);
    const counted = createArcadeRound({ lives: 3 });
    onHumanDeath(counted, DEATH.self);
    expect(counted.state.killsAI).toBe(1);
  });
});
