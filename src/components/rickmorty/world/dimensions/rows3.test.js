import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../../Achievements';
import { nearHotspot } from '../rules';
import { DESTINATIONS, destinationById } from './destinations';

// Episode 13's places (./rows3.js): the Blood Dome's fight, and Evil Rick's
// lair, its fight after the pods and the Morty with the eyepatch after that.
const duelOf = (d) => d.people.find((p) => p.ai?.hunt?.duel)?.ai.hunt ?? null;
const GAMES = ['power', 'deal', 'freeze', 'find', 'sequence', 'climb', 'rhythm'];

describe('episode 13’s places', () => {
  it('has two duels, Evil Rick’s and Hemorrhage’s, each its place’s task and its achievement', () => {
    const duels = DESTINATIONS.filter((d) => duelOf(d));
    expect(duels.map((d) => [d.id, d.people.find((p) => p.ai?.hunt?.duel).id])).toEqual([
      ['evilrick', 'evilrick'],
      ['blooddome', 'hemorrhage'],
    ]);
    for (const d of duels) {
      const { duel } = duelOf(d);
      expect(duel.unlock, d.id).toBe(duel.task);
      expect(d.tasks.map((t) => t.id), d.id).toContain(duel.task);
      expect(ACHIEVEMENTS[duel.unlock], d.id).toBeTruthy();
    }
  });

  it('fights Hemorrhage in the Blood Dome’s ring: “A man now” on the win, given one way', () => {
    const d = destinationById('blooddome');
    expect(duelOf(d).duel).toMatchObject({ hp: 7, mortyHp: 3, task: 'blooddome', unlock: 'blooddome' });
    expect([d.acts, d.goal, d.unlock, d.collect, d.escape]).toEqual([{ ring: 'fight' }, 'ring', {}, null, null]);
    for (const key of GAMES) expect(d[key], key).toBe(null);
    expect([...Object.values(d.done), ...Object.values(d.unlock)]).not.toContain('blooddome');
    expect(ACHIEVEMENTS.blooddome.name).toBe('A man now');
  });

  it('sets Evil Rick on Morty once the dome’s three Mortys are free: “Close Rick-counters” on the win, given one way', () => {
    const d = destinationById('evilrick');
    expect(d.collect).toEqual({ task: 'evilrick', spots: ['pod1', 'pod2', 'pod3'], start: true });
    expect(duelOf(d).duel).toMatchObject({ hp: 7, mortyHp: 3, task: 'evilrick', unlock: 'evilrick' });
    expect([d.goal, d.unlock, d.done]).toEqual(['pod1', {}, { evilmorty: 'evilmorty' }]);
    expect(ACHIEVEMENTS.evilrick.name).toBe('Close Rick-counters');
  });

  it('lets a duel’s spots go once it’s won: the pods and Evil Rick’s, and the ring', () => {
    const lair = destinationById('evilrick');
    for (const id of ['pod1', 'pod2', 'pod3', 'evilrick']) {
      const h = lair.hotspots.find((x) => x.id === id);
      expect(nearHotspot('evilrick', h.x, h.z, [])?.id, id).toBe(id);
      expect(nearHotspot('evilrick', h.x, h.z, ['evilrick'])?.id ?? null, id).toBe(null);
    }
    const ring = destinationById('blooddome').hotspots.find((x) => x.id === 'ring');
    expect(nearHotspot('blooddome', ring.x, ring.z, [])?.id).toBe('ring');
    expect(nearHotspot('blooddome', ring.x, ring.z, ['blooddome'])?.id ?? null).toBe(null);
  });

  it('keeps the Morty with the eyepatch’s word till Evil Rick is down, while he sits and watches', () => {
    const d = destinationById('evilrick');
    const spot = d.hotspots.find((h) => h.id === 'evilmorty');
    expect(spot).toMatchObject({ verb: 'Talk', after: 'evilrick', until: 'evilmorty' });
    const him = d.people.find((p) => p.id === 'evilmorty');
    expect([him.until, him.after]).toEqual(['evilmorty', undefined]);
    const at = (done) => nearHotspot('evilrick', spot.x, spot.z, done)?.id ?? null;
    expect([at([]), at(['blooddome']), at(['evilrick']), at(['evilrick', 'evilmorty'])]).toEqual([null, null, 'evilmorty', null]);
    for (const p of DESTINATIONS.flatMap((o) => o.people)) expect(p.ai?.hunt?.duel?.unlock, p.id).not.toBe('evilmorty');
    expect(ACHIEVEMENTS.evilmorty.name).toBe('The one behind him');
  });

  it('says what it always said, word for word', () => {
    const dome = destinationById('blooddome');
    const lair = destinationById('evilrick');
    expect([duelOf(dome).line, duelOf(dome).duel.won, dome.say.ring, dome.caught]).toEqual([
      'Hemorrhage’s gauntlet puts you on the sand. “Not a man yet,” he says, not unkindly, and the Death Stalkers carry you back to the gate.',
      { who: 'Hemorrhage', text: 'He drops to one knee and pulls the helmet off. Underneath, a tired bald man. “Fine,” he says. “You’re a man. Go and tell your sister.”' },
      { who: 'Hemorrhage', text: '“A boy walks into my ring.” The Death Stalkers start to chant. “Then a boy fights.” He comes down off the gate.' },
      'A Death Stalker drags you out of the ring by the collar and dumps you at the gate. “Not a man yet.”',
    ]);
    expect([duelOf(lair).line, duelOf(lair).duel.won, lair.caught]).toEqual([
      'Evil Rick’s fist finds your jaw. “Sit down, Morty. There’s a slot in the dome with your name on it.” You come round by the door.',
      { who: 'Evil Rick', text: 'He goes down by his own console, and his eye flickers. A receiver, behind the ear. He was never the one in charge.' },
      'Evil Rick’s fist finds your jaw. You come round by the door, and he’s back at his console as if you’d never got up.',
    ]);
    expect(['pod1', 'pod2', 'pod3', 'evilmorty'].map((id) => lair.say[id])).toEqual([
      { who: null, text: 'You pull the plug and the Morty slumps out, blinking. “Th-thanks. Which one are you?” Behind you, Evil Rick looks up from the console.' },
      { who: null, text: 'Another plug, another Morty. He hugs you and runs for the door. Evil Rick is standing now.' },
      { who: null, text: 'The third plug. The dome goes dark, and a thousand Mortys sigh at once. Evil Rick says, quietly, “That was mine,” and starts towards you.' },
      { who: 'The Morty with the eyepatch', text: 'He takes the eyepatch off. Behind it, a perfectly good eye. “He was a puppet. They all are.” A yellow portal opens behind him. “Tell your Rick I’m not done.” He steps through, and the chair is empty.' },
    ]);
  });
});
