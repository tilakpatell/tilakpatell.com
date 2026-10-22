import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCardSpots } from './cards';

const hall = () => ({ group: new THREE.Group(), places: [{ id: 'high-table', at: [0, -20] }], spawn: { at: [0, 0, 20], yaw: 0 }, floorAt: () => 0.5, spots: [{ id: 'own', at: [3, 3], r: 1 }], use: (id) => `own:${id}` });

describe('the cards in the room you’re in', () => {
  it('lays the room’s card where its hint says, and takes it once', () => {
    const said = [];
    const cards = createCardSpots({ tell: (type, data) => said.push({ type, ...data }) });
    const room = hall();
    cards.dress(room, 'greatHall', { house: 'gryffindor', found: [] });
    expect(room.spots.map((s) => s.id)).toEqual(['own', 'card:gryffindor']);
    expect(room.group.children).toHaveLength(1);
    expect(room.group.children[0].position.y).toBeCloseTo(1.4, 6);
    // (the room’s own things still work)
    expect(room.use('own')).toBe('own:own');
    room.use('card:gryffindor');
    expect(said.find((e) => e.type === 'pickup')).toEqual({ type: 'pickup', id: 'card', card: 'gryffindor' });
    expect(room.spots.map((s) => s.id)).toEqual(['own']);
    expect(room.group.children).toHaveLength(0);
    cards.dispose();
  });

  it('lays nothing for a card already found, or in a room with none', () => {
    const cards = createCardSpots();
    const room = hall();
    cards.dress(room, 'greatHall', { found: ['gryffindor'] });
    cards.dress(room, 'nowhere');
    expect(room.spots.map((s) => s.id)).toEqual(['own']);
    cards.dispose();
  });
});
