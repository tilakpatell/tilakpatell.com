import { describe, expect, it } from 'vitest';
import { TROOPS } from './foot';
import { CREWS, crewById, linesFor, parseShip } from './crews';
import { ORDER } from './layout';

describe('the crews', () => {
  it('are four ships, each with its own id', () => {
    expect(CREWS.map((c) => c.id)).toEqual(['cruiser', 'xwing', 'falcon', 'rv']);
  });

  it('each have something to say firing Rick’s portal gun, either way, and coming out of it', () => {
    for (const crew of CREWS) {
      for (const sub of ['out', 'home']) expect(linesFor(crew, 'event', 'portalgun', sub), `${crew.id} portalgun ${sub}`).toEqual(expect.arrayContaining([expect.any(Array)]));
      for (const sub of ['rickmorty', 'main']) expect(linesFor(crew, 'event', 'gunThrough', sub), `${crew.id} gunThrough ${sub}`).toEqual(expect.arrayContaining([expect.any(Array)]));
      // (their own people say them, not Rick's)
      const who = new Set([...linesFor(crew, 'event', 'portalgun', 'out'), ...linesFor(crew, 'event', 'gunThrough', 'rickmorty')].map(([w]) => w));
      if (crew.id !== 'cruiser') expect([...who].some((w) => w === 'rick' || w === 'morty')).toBe(false);
    }
  });

  it('each cross the map their own way: the Star Wars ships on the jump to lightspeed, the cruiser through a portal, the RV as Blue Sky', async () => {
    const { JUMP_STYLES, jumpStyle } = await import('../jumps/styles');
    expect(CREWS.map((c) => jumpStyle(c.jump))).toEqual(['portal', 'hyper', 'hyper', 'bluesky']);
    for (const c of CREWS) if (c.jump) expect(JUMP_STYLES).toContain(c.jump);
  });

  it('each say a ram’s kill, and the last of them rammed, as a ram (never a shot)', () => {
    for (const crew of CREWS) {
      for (const when of ['kill', 'cleared']) {
        const exchange = linesFor(crew, 'ram', when);
        expect(exchange?.length, `${crew.id} ${when}`).toBeGreaterThan(0);
        for (const [who, text] of exchange) {
          expect(who === 'comms' || crew.speakers[who], `${crew.id}: ${who}`).toBeTruthy();
          expect(text, `${crew.id} ${when}`).not.toMatch(/\bsho(t|ot)/i);
        }
      }
    }
    expect(linesFor(crewById('xwing'), 'ram', 'nope')).toBeNull();
  });

  it('have something to say everywhere, and only their own crew says it', () => {
    for (const crew of CREWS) {
      const all = [...['launch', 'boost', 'bump', 'edge', 'crash', 'pulled', 'swallowed'].map((e) => linesFor(crew, e)), ...ORDER.map((id) => linesFor(crew, 'arrive', id)), linesFor(crew, 'kill', 'any')];
      for (const exchange of all) {
        expect(exchange?.length, crew.id).toBeGreaterThan(0);
        for (const [who, text] of exchange) {
          expect(who === 'comms' || crew.speakers[who], `${crew.id}: ${who}`).toBeTruthy();
          expect(text.length).toBeGreaterThan(2);
        }
      }
    }
  });

  it('only play clips the site has', async () => {
    const { CLIPS } = await import('../../lib/clips');
    // (the ship powers' lines are a level deeper: by power, then by when, then by why)
    const lines = (o) => (Array.isArray(o) ? (typeof o[0] === 'string' ? [o] : o.flatMap(lines)) : o && typeof o === 'object' ? Object.values(o).flatMap(lines) : []);
    for (const crew of CREWS) {
      const all = Object.values(crew).filter(Array.isArray).flat().concat(...[crew.arrive, crew.traffic, crew.kill, crew.hunted, crew.events, crew.wonders, crew.crashInto].map((o) => Object.values(o ?? {}).flat()), lines(crew.powers));
      for (const line of all) if (line[2]) expect(CLIPS[line[2]], `${crew.id}: ${line[2]}`).toBeTruthy();
    }
  });

  it('have a word for each of their ship’s powers: using it, and for the big one, charged and a big haul', async () => {
    const { POWERS, powersOf } = await import('./shipPowers');
    for (const crew of CREWS) {
      const own = powersOf(crew.id);
      const said = [linesFor(crew, 'power', own.primary, 'use'), ...['use', 'ready', 'big'].map((sub) => linesFor(crew, 'power', own.ultimate, sub))];
      for (const exchange of said) {
        expect(exchange?.length, crew.id).toBeGreaterThan(0);
        for (const [who, text] of exchange) {
          expect(who === 'comms' || crew.speakers[who], `${crew.id}: ${who}`).toBeTruthy();
          expect(text.length).toBeGreaterThan(2);
        }
      }
      // (only its own powers' lines)
      for (const id of Object.keys(crew.powers)) expect(POWERS[id]?.crew, `${crew.id}: ${id}`).toBe(crew.id);
    }
    // the clip-backed lines: each crew's own recording on its use or its big haul
    expect(linesFor(crewById('xwing'), 'power', 'focus', 'use')[0][2]).toBe('useTheForce');
    expect(linesFor(crewById('falcon'), 'power', 'odds', 'use')[0][2]).toBe('neverTellOdds');
    expect(linesFor(crewById('cruiser'), 'power', 'wubba', 'use')[0][2]).toBe('wubba');
    expect(linesFor(crewById('rv'), 'power', 'heisenberg', 'use')[0][2]).toBe('sayMyName');
    // Rick says why a portal won't go: Scarif's shield, a hold on the ship,
    // and nowhere to come out but into something solid
    for (const why of ['shield', 'held', 'solid']) expect(linesFor(crewById('cruiser'), 'power', 'portal', 'refuse', why)?.length, why).toBeGreaterThan(0);
    expect(linesFor(crewById('cruiser'), 'power', 'portal', 'refuse', 'shield')).not.toBe(linesFor(crewById('cruiser'), 'power', 'portal', 'refuse', 'held'));
    // and Jesse, when the magnet's got nothing near enough to hold
    expect(linesFor(crewById('rv'), 'power', 'magnets', 'refuse', 'empty')?.length).toBeGreaterThan(0);
    expect(linesFor(crewById('xwing'), 'power', 'nope', 'use')).toBeNull();
  });

  it('have a word for every kind of traffic that comes past them, and for shooting one down', () => {
    // what flies by each crew (traffic.js): Star Wars for the X-wing and the Falcon, Rick and Morty for the cruiser, both for the RV
    const STAR_WARS = ['tie', 'interceptor', 'xwing', 'slave1'];
    const RICK_AND_MORTY = ['patrol', 'gromflomite', 'meeseeks', 'birdperson'];
    const FLYBY = { cruiser: RICK_AND_MORTY, xwing: STAR_WARS, falcon: STAR_WARS, rv: [...STAR_WARS, ...RICK_AND_MORTY] };
    for (const crew of CREWS) {
      for (const kind of FLYBY[crew.id]) {
        for (const event of ['traffic', 'kill']) {
          const exchange = linesFor(crew, event, kind);
          expect(exchange?.length, `${crew.id} ${event} ${kind}`).toBeGreaterThan(0);
          for (const [who] of exchange) expect(who === 'comms' || crew.speakers[who], `${crew.id}: ${who}`).toBeTruthy();
        }
      }
    }
  });

  it('have a word for being hunted, the director’s events and every wonder out in deep space', async () => {
    const { EVENTS, canHave } = await import('./director');
    const { WONDERS } = await import('./deep');
    const { sideFor } = await import('./sides');
    const said = (exchange, crew, what) => {
      expect(exchange?.length, `${crew.id}: ${what}`).toBeGreaterThan(0);
      for (const [who, text] of exchange) {
        expect(who === 'comms' || crew.speakers[who], `${crew.id}: ${who}`).toBeTruthy();
        expect(text.length).toBeGreaterThan(2);
      }
    };
    for (const crew of CREWS) {
      const side = sideFor(crew.id);
      // hunters after you: every faction of the crew's side (not the pirates in a distress call: that's the event's line)
      for (const [id, f] of Object.entries(side.factions)) if (f.role !== 'pirates') said(linesFor(crew, 'hunted', id), crew, `hunted ${id}`);
      if (Object.values(side.factions).some((f) => f.ace)) said(linesFor(crew, 'hunted', 'ace'), crew, 'hunted ace');
      for (const event of ['hit', 'shields', 'destroyed', 'escaped', 'cleared', 'interdicted']) said(linesFor(crew, event), crew, event);
      for (const into of ['star', 'giant', 'citadel']) said(linesFor(crew, 'crashInto', into), crew, `crashInto ${into}`);
      // the director's events the side can have (the Council's and the bounty hunters' arrivals are their hunted lines), rescuing someone, going out into deep space
      const playedAsOthers = new Set(['hunt', 'council', 'bounty']);
      for (const [id, e] of Object.entries(EVENTS)) if (canHave(side, e) && !playedAsOthers.has(id)) said(linesFor(crew, 'event', id), crew, `event ${id}`);
      said(linesFor(crew, 'event', 'rescued'), crew, 'rescued');
      // (and what comes where you are rather than with your side: an eclipse, wherever there's a sun)
      said(linesFor(crew, 'event', 'eclipse'), crew, 'eclipse');
      for (const id of ['escortPirates', 'escorted', 'escortLost']) if (canHave(side, EVENTS.escort)) said(linesFor(crew, 'event', id), crew, id);
      said(linesFor(crew, 'event', 'deep'), crew, 'deep');
      // the friends who come in a long fight: each of the side's allies
      for (const ally of Object.keys(side.allies)) said(linesFor(crew, 'event', 'wingmen', ally), crew, `wingmen ${ally}`);
      // (each its own, not one line for whoever comes)
      const hellos = Object.keys(side.allies).map((ally) => linesFor(crew, 'event', 'wingmen', ally));
      expect(new Set(hellos).size, `${crew.id} wingmen`).toBe(hellos.length);
      // each side's aces, by name where a side has more than one
      const aces = Object.values(side.factions).flatMap((f) => (f.ace ? [f.ace] : []));
      if (aces.length > 1) expect(new Set(aces.map((k) => linesFor(crew, 'hunted', k) ?? linesFor(crew, 'hunted', 'ace'))).size, `${crew.id} aces`).toBe(aces.length);
      said(linesFor(crew, 'event', 'wingmenGone'), crew, 'wingmenGone');
      said(linesFor(crew, 'event', 'skirmish', side.id), crew, 'skirmish');
      // the nav map's drives: a jump to lightspeed, and super speed
      said(linesFor(crew, 'event', 'hyperspeed'), crew, 'hyperspeed');
      said(linesFor(crew, 'event', 'overdrive'), crew, 'overdrive');
      // a rock hit at super speed (rockHits.js)
      said(linesFor(crew, 'event', 'rock'), crew, 'rock');
      // the fleet war's battles (front.js): every moment of one, each crew its own words
      for (const sub of ['front', 'join', 'gens', 'bridge', 'reactor', 'won', 'lost', 'warWon', 'warLost']) said(crew.events?.battle?.[sub], crew, `battle ${sub}`);
      for (const w of WONDERS) said(linesFor(crew, 'wonder', w.id), crew, `wonder ${w.id}`);
      // the bounty hunters shot down, in flight (Slave I's line is the flyby's; Phoenixperson's and the Cousins' are their own)
      for (const [, f] of Object.entries(side.factions)) if (f.role === 'bounty') for (const [k] of f.kinds) expect(linesFor(crew, 'kill', k), `${crew.id} kill ${k}`).not.toBe(linesFor(crew, 'kill', 'any'));
      // through a rift, a shot into a leviathan, and the side's own leviathan
      said(linesFor(crew, 'event', 'rifted'), crew, 'rifted');
      said(linesFor(crew, 'event', 'leviathanHit'), crew, 'leviathanHit');
      said(linesFor(crew, 'event', 'leviathan', side.leviathan), crew, `leviathan ${side.leviathan}`);
      // a hunter with a spotlight on you (hunterRules.js's 'spotlight' trait)
      if (Object.values(side.kinds).some((k) => k.trait === 'spotlight')) said(linesFor(crew, 'event', 'spotlit'), crew, 'spotlit');
      // the fight with the capital ship (capitalRules.js): every moment of it, each crew its own words
      for (const sub of ['fired', 'shielded', 'dome', 'open', 'bridge', 'dead', 'fled', 'gone', 'wave']) said(linesFor(crew, 'event', 'capital', sub), crew, `capital ${sub}`);
      // your standing (standing.js): every level, a patrol reporting you, and each of the side's aces changing its ways (hunterRules.js's stages), its own line
      const { LEVELS } = await import('./standing');
      for (const level of Object.values(LEVELS).flat().map(([, name]) => name)) said(linesFor(crew, 'event', 'standing', level), crew, `standing ${level}`);
      said(linesFor(crew, 'event', 'spotted'), crew, 'spotted');
      const staged = Object.entries(side.kinds).filter(([, k]) => k.stages).map(([id]) => id);
      expect(staged.length, `${crew.id} staged aces`).toBeGreaterThan(0);
      for (const kind of staged) {
        said(linesFor(crew, 'event', 'stage', kind), crew, `stage ${kind}`);
        expect(crew.events.stage[kind], `${crew.id} stage ${kind}: its own line`).toBeTruthy();
      }
      said(linesFor(crew, 'event', 'stage', 'nonsense'), crew, 'stage any');
      expect(new Set(['fired', 'shielded', 'dome', 'open', 'bridge', 'dead', 'fled', 'gone', 'wave'].map((sub) => linesFor(crew, 'event', 'capital', sub))).size, `${crew.id} capital`).toBe(9);
    }
  });

  it('reads only real ships from storage or a link', () => {
    expect(parseShip('falcon')).toBe('falcon');
    for (const bad of ['FALCON', '__proto__', 'constructor', '', null, undefined, 3]) expect(parseShip(bad)).toBeNull();
    expect(crewById('nope')).toBeNull();
    expect(linesFor(null, 'boost')).toBeNull();
  });
});

describe('the crews on foot', () => {
  it('have a word for each moment out of the ship, said by their own crew', async () => {
    const { PARTY } = await import('./footScene');
    const { sideFor } = await import('./sides');
    for (const crew of CREWS) {
      const all = [
        ...['land', 'out', 'squad', 'hurt', 'down', 'up', 'cleared', 'far', 'nowhere', 'in'].map((id) => linesFor(crew, 'foot', id)),
        // (each troop of the crew's side has its own line, not the catch-all)
        ...Object.keys(sideFor(crew.id).troops).map((kind) => crew.foot.kill[kind]),
        // (a squad of Evil Morty's guard isn't a squad of bugs)
        ...(sideFor(crew.id).troops.mortyguard ? [linesFor(crew, 'foot', 'squad', 'mortyguard') !== linesFor(crew, 'foot', 'squad', 'gromflomite') ? crew.foot.squad.mortyguard : null] : []),
        // (a probe droid that's called a squad in, where the side has one)
        ...(Object.keys(sideFor(crew.id).troops).some((k) => TROOPS[k].calls) ? [crew.foot.called] : []),
        ...PARTY[crew.id].map((p) => linesFor(crew, 'foot', 'swap', p.id)),
        // another pilot's crew down too, and anyone's double from another dimension
        linesFor(crew, 'foot', 'friend'),
        ...Object.values(PARTY)
          .flat()
          .map((p) => linesFor(crew, 'foot', 'alt', p.id)),
      ];
      for (const exchange of all) {
        expect(exchange?.length, crew.id).toBeGreaterThan(0);
        for (const [who, text] of exchange) {
          expect(crew.speakers[who], `${crew.id}: ${who}`).toBeTruthy();
          expect(text.length).toBeGreaterThan(2);
        }
      }
    }
  });

  it('have a word for each character of their side who comes by, and from them', async () => {
    const { sideFor } = await import('./sides');
    const { visitorsOf } = await import('./npcs/index');
    const { BRAINS, tells } = await import('./npcRules');
    for (const crew of CREWS) {
      for (const c of visitorsOf(sideFor(crew.id).id)) {
        // everyone's lines, and each brain's own (an inspector's clean, busted and run; a nemesis's again, half, weak, evade and retreat; a tagalong's panics and chatter; a trickster's paid and angry; a merchant's grudge)
        for (const key of ['seen', 'hello', 'hit', 'leaving', ...(BRAINS[c.brain].lines ?? [])]) {
          const exchange = linesFor(crew, 'npc', c.id, key);
          expect(exchange?.length, `${crew.id} ${c.id} ${key}`).toBeGreaterThan(0);
          for (const [who, text] of exchange) {
            expect(who === 'comms' || crew.speakers[who], `${crew.id} ${c.id} ${key}: ${who}`).toBeTruthy();
            expect(text.length, `${crew.id} ${c.id} ${key}`).toBeGreaterThan(2);
          }
        }
        // a merchant names the part (Comms.jsx fills it in); anyone with word of what's coming has a line for whatever it is
        if (c.brain === 'merchant') expect(linesFor(crew, 'npc', c.id, 'offer')?.some(([, text]) => text.includes('{part}')), `${crew.id} ${c.id} offer`).toBe(true);
        if (tells(c.brain)) {
          expect(linesFor(crew, 'npc', c.id, 'tip', 'nothing-in-particular'), `${crew.id} ${c.id} tip`).toBeTruthy();
          expect(linesFor(crew, 'npc', c.id, 'tip', 'hunt'), `${crew.id} ${c.id} tip hunt`).not.toBe(linesFor(crew, 'npc', c.id, 'tip', 'nothing-in-particular'));
        }
        // (a nemesis greets an old enemy differently)
        if (c.brain === 'nemesis') expect(linesFor(crew, 'npc', c.id, 'again'), `${crew.id} ${c.id} again`).not.toBe(linesFor(crew, 'npc', c.id, 'hello'));
      }
    }
  });
});
