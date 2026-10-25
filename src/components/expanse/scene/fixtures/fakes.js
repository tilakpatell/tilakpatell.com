// Fakes for the Expanse's drawing, for its tests (expanse.test.js,
// expanse.things.test.js): what it made of each sector, and a far layer that
// keeps what it's given.

import * as THREE from 'three';

// fakes for the drawing: what was made, and let go
export function fakes() {
  const made = new Map();
  const make = (sector) => {
    const group = new THREE.Group();
    const s = { group, sector, disposed: false, update() {}, dispose: () => ((s.disposed = true), group.removeFromParent()) };
    made.set(sector.id, s);
    return s;
  };
  return { made, make };
}
// a far layer that keeps what it's given: its slots, the edge, and a list of discs a frame
export function fakeFar() {
  const far = {
    slots: new Map(), // slot → what it holds
    shown: new Set(),
    fades: [],
    sets: [], // every setSlot, in order: [slot, what]
    edges: [],
    discEdges: [],
    frames: [],
    rows: null,
    setSlot(i, slot) {
      far.slots.set(i, slot);
      far.shown.delete(i);
      far.sets.push([i, slot]);
    },
    fadeSlot(i, seconds) {
      far.fades.push([i, seconds]);
      far.shown.add(i);
    },
    showSlots(list) {
      for (const i of list) far.shown.add(i);
    },
    hideSlots(list) {
      for (const i of list) far.shown.delete(i);
    },
    setEdge(e) {
      far.edges.push(e);
    },
    setDiscEdge(e) {
      far.discEdges.push(e);
    },
    discs: {
      begin() {
        far.rows = [];
      },
      push(...row) {
        far.rows.push(row);
      },
      end() {
        far.frames.push(far.rows);
      },
    },
  };
  return far;
}
