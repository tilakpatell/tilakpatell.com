import { describe, expect, it } from 'vitest';
import { CHARTED, CHARTED_LIFT } from './index';
import { CHARTED_LOOKS } from './looks';
import { CHARTED_CRAWLS } from './crawls';
import { CHARTED_ARRIVE } from './lines';
import { FILMS, SYSTEMS, gridAt, liftOf, systemById } from '../systems';
import { WAR_SYSTEMS } from '../gcwRules';
import { canLand } from '../surface/sites';

const ids = CHARTED.map((s) => s.id);
// (the owner's rule: nothing of the sequel trilogy, no figure, place or name)
const SEQUEL = /\b(Jakku|Ahch-To|Exegol|Crait|D’Qar|Takodana|Starkiller|Kylo|Snoke|First Order|Hosnian|Kijimi|Pasaana|Canto Bight|Rey|Finn|Poe Dameron|BB-8)\b/;

describe('the charted worlds', () => {
  it('are systems of the galaxy, marked as charted, each once', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(20);
    for (const id of ids) {
      expect(systemById(id), id).toBeTruthy();
      expect(systemById(id).charted, id).toBe(true);
    }
    // (and none of the films' own is marked)
    expect(SYSTEMS.filter((s) => s.charted).map((s) => s.id).sort()).toEqual([...ids].sort());
  });

  it('each has a height off the plane of its own, a planet look, a crawl and a word from every crew', () => {
    expect(Object.keys(CHARTED_LIFT).sort()).toEqual([...ids].sort());
    for (const s of CHARTED) {
      expect(liftOf(s), s.id).toBe(CHARTED_LIFT[s.id]);
      expect(CHARTED_LOOKS[s.body.look], s.id).toBeTruthy();
      if (s.parent) expect(CHARTED_LOOKS[s.parent.look], s.id).toBeTruthy();
      expect(CHARTED_CRAWLS[s.id], s.id).toBeTruthy();
      for (const crew of Object.values(CHARTED_ARRIVE)) expect(crew[s.id], s.id).toBeTruthy();
    }
  });

  it('sit in the square the atlas gives them, or say why not', () => {
    const files = import.meta.glob('./*.js', { query: '?raw', import: 'default', eager: true });
    const text = Object.values(files).join('\n');
    for (const s of CHARTED) {
      if (s.grid) expect(gridAt(s.pos), s.id).toBe(s.grid);
      else expect(text, s.id).toMatch(new RegExp(`id: '${s.id}',[\\s\\S]*?// \\(the atlas puts it at [A-U]-\\d+`));
    }
  });

  it('are flown to and looked at, not fought over or landed on', () => {
    for (const id of ids) {
      expect(WAR_SYSTEMS, id).not.toContain(id);
      expect(canLand(id), id).toBe(false);
      expect(systemById(id).game.status, id).toBe('soon');
    }
  });

  it('keep to the films and the two shows, and to short famous lines', () => {
    for (const s of CHARTED) {
      for (const f of s.films) expect(FILMS[f].game, `${s.id}: ${f}`).toBeFalsy();
      const words = JSON.stringify([s, CHARTED_CRAWLS[s.id], ...Object.values(CHARTED_ARRIVE).map((c) => c[s.id])]);
      expect(words, s.id).not.toMatch(SEQUEL);
      expect(words, s.id).not.toMatch(/'/); // (curly quotes and apostrophes only)
      expect(s.quote.text.split(/\s+/).length, s.id).toBeLessThanOrEqual(15);
    }
  });
});
