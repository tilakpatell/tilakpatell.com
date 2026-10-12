import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { REF, crosshairKind, heatCells, heatColour, killLogRows, killMessageOf, markerProjection, markerScale, meterThirds, offerRows, placeWidget, radarPoint, referenceScale, squadListRows } from './widgets.js';

describe('the game’s HUD records, as rules', () => {
  it('scales the HUD by the viewport’s shorter side against the reference’s 1080', () => {
    expect(referenceScale(1920, 1080)).toBe(1);
    expect(referenceScale(1280, 720)).toBeCloseTo(2 / 3, 6);
    expect(referenceScale(1080, 1920)).toBe(1);
  });

  it('puts the radar’s soldiers on its disc: 50 m to the rim, ahead up, the right to the right', () => {
    const me = { at: [10, 0, 10], yaw: 0 };
    const ahead = radarPoint(me, [10, 0, 60], { radius: 100 });
    expect(ahead.x).toBeCloseTo(0, 6);
    expect(ahead.y).toBeCloseTo(-100, 6);
    expect(ahead.inside).toBe(true);
    expect(radarPoint(me, [10, 0, 61], { radius: 100 }).inside).toBe(false);
    // (the export's +X is the player's left at yaw 0: the markers' projection says so too)
    expect(radarPoint(me, [-15, 0, 10], { radius: 100 }).x).toBeCloseTo(50, 6);
    // (the sim's yaw grows to the left: turned a quarter, what was ahead is now on the right)
    const turned = radarPoint({ at: [10, 0, 10], yaw: Math.PI / 2 }, [10, 0, 60], { radius: 100 });
    expect(turned.x).toBeCloseTo(100, 6);
    expect(turned.y).toBeCloseTo(0, 6);
  });

  it('scales an in-world marker from 1 at 10 m to a half at 200 m', () => {
    expect(markerScale(0)).toBe(1);
    expect(markerScale(10)).toBe(1);
    expect(markerScale(105)).toBeCloseTo(0.75, 6);
    expect(markerScale(200)).toBe(0.5);
    expect(markerScale(900)).toBe(0.5);
  });

  it('lights the heat bar’s 32 cells to the heat, in the alarm colour past the warning', () => {
    expect(heatCells(0)).toHaveLength(32);
    expect(heatCells(0).every((c) => c === 'off')).toBe(true);
    expect(heatCells(0.5, 0.75).filter((c) => c === 'on')).toHaveLength(16);
    expect(heatCells(0.5, 0.75).filter((c) => c === 'warn')).toHaveLength(0);
    expect(heatCells(0.8, 0.75).filter((c) => c === 'warn')).toHaveLength(26);
    expect(heatCells(1.4, 0.75).every((c) => c === 'warn')).toBe(true);
  });

  it('keeps the kill log to ten rows shown for five seconds, and the player’s own kill as the message', () => {
    const entries = Array.from({ length: 14 }, (_, i) => ({ id: `k${i}`, t: i, killer: i === 12 ? 'You' : 'A', victim: 'B' }));
    const rows = killLogRows(entries, 13.5);
    expect(rows.map((e) => e.id)).toEqual(['k9', 'k10', 'k11', 'k12', 'k13']);
    expect(killLogRows(entries, 2)).toHaveLength(10);
    expect(killLogRows([{ id: 'old', killer: 'A', victim: 'B' }], 999)).toHaveLength(1);
    expect(killMessageOf(entries, 13.5)?.id).toBe('k12');
    expect(killMessageOf(entries, 18)).toBeNull();
    expect(killMessageOf(entries.filter((e) => e.killer !== 'You'), 13.5)).toBeNull();
  });

  it('gives each class its gun’s crosshair screen', () => {
    expect(crosshairKind('assault')).toBe('rifle');
    expect(crosshairKind('heavy')).toBe('heavy');
    expect(crosshairKind('officer')).toBe('pistol');
    expect(crosshairKind('specialist')).toBe('default');
    expect(crosshairKind(null)).toBe('default');
  });
});

describe('the game’s widgets, placed and filled', () => {
  it('anchors a bottom-right widget to the viewport’s bottom right, scaled by the shorter side', () => {
    const s = 720 / REF[1];
    const box = placeWidget({ anchor: [1, 1], size: [256, 128], offset: [-40, -20] }, { w: 1280, h: 720 });
    expect(box.w).toBeCloseTo(256 * s, 6);
    expect(box.h).toBeCloseTo(128 * s, 6);
    expect(box.x).toBeCloseTo(1280 - 256 * s - 40 * s, 6);
    expect(box.y).toBeCloseTo(720 - 128 * s - 20 * s, 6);
    const top = placeWidget({ anchor: [0.5, 0], size: [600, 160], offset: [0, 55] }, { w: 1920, h: 1080 });
    expect(top).toEqual({ x: 660, y: 55, w: 600, h: 160 });
  });

  it('fills a capture meter by thirds', () => {
    expect(meterThirds(0)).toEqual([0, 0, 0]);
    expect(meterThirds(0.5)).toEqual([1, 1, 0]);
    expect(meterThirds(1)).toEqual([1, 1, 1]);
  });

  it('turns the heat red past the weapon’s warning', () => {
    const colours = { normal: '#fff', warning: '#f00' };
    expect(heatColour(0.5, 0.75, colours)).toBe('#fff');
    expect(heatColour(0.9, 0.75, colours)).toBe('#f00');
  });

  it('orders the deploy offers classes, then reinforcements, then heroes, and marks what can be had', () => {
    const rows = offerRows(
      [
        { kind: 'hero', id: 'vader', cost: 6000 },
        { kind: 'class', id: 'd-orig-heavy', cost: 0 },
        { kind: 'reinforcement', id: 'deathtrooper', cost: 2000 },
        { kind: 'class', id: 'd-orig-assault', cost: 0 },
        { kind: 'hero', id: 'boba', cost: 4000, available: false },
      ],
      3000,
    );
    expect(rows.map((r) => r.id)).toEqual(['d-orig-heavy', 'd-orig-assault', 'deathtrooper', 'vader', 'boba']);
    expect(rows.map((r) => r.affordable)).toEqual([true, true, true, false, false]);
  });

  it('projects a marker to the screen, or to its edge with the way to turn', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, 10);
    camera.updateMatrixWorld();
    const ahead = markerProjection([0, 0, 10], camera, { w: 1600, h: 900 });
    expect(ahead.onScreen).toBe(true);
    expect(ahead.x).toBeCloseTo(800, 3);
    expect(ahead.y).toBeCloseTo(450, 3);
    const behind = markerProjection([0, 0, -10], camera, { w: 1600, h: 900 });
    expect(behind.onScreen).toBe(false);
    expect(Number.isFinite(behind.edgeAngle)).toBe(true);
    // (looking down +Z, the camera's right is −X: a thing behind and to the right goes on the right edge)
    expect(markerProjection([-5, 0, -10], camera, { w: 1600, h: 900 }).x).toBeGreaterThan(800);
    expect(markerProjection([5, 0, -10], camera, { w: 1600, h: 900 }).x).toBeLessThan(800);
  });

  it('colours the squad list as the game’s cell does: grey when down, orange alive, the icon dark brown', () => {
    const squad = {
      letter: 'A',
      members: [
        { id: 'p0', name: 'You', cls: 'heavy', alive: true, local: true, order: null },
        { id: 'b1', name: 'Trooper 1', cls: 'assault', alive: true, local: false, order: 'B' },
        { id: 'b2', name: 'Trooper 2', cls: 'officer', alive: false, local: false, order: null },
      ],
    };
    const rows = squadListRows(squad);
    expect(rows.map((r) => r.id)).toEqual(['p0', 'b1', 'b2']);
    expect(rows[0]).toMatchObject({ local: true, nameColour: 'rgb(242 174 10)', iconColour: 'rgb(94 65 1)', showName: true, turn: false });
    expect(rows[0].icon).toMatch(/Class_Troopers_Heavy_01\.svg$/);
    expect(rows[1]).toMatchObject({ nameColour: 'rgb(242 174 10)', iconColour: 'rgb(94 65 1)', letter: 'B', turn: true, dead: false });
    expect(rows[2]).toMatchObject({ nameColour: 'rgb(120 130 135)', dead: true, letter: null });
    expect(squadListRows(squad, { option: 'NoOutline' }).every((r) => !r.showName)).toBe(true);
    expect(squadListRows(squad, { option: 'Off' })).toEqual([]);
    expect(squadListRows(null)).toEqual([]);
  });

  it('keeps the squad list to the game’s four rows: the player and three', () => {
    const members = Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, name: `T${i}`, cls: 'assault', alive: true, local: i === 0, order: null }));
    expect(squadListRows({ letter: 'A', members })).toHaveLength(4);
  });
});

describe('the spawn screen’s names', () => {
  it('writes each offer as the game’s screen does, in capitals, from its strings or by hand', async () => {
    const { offerNameOf } = await import('./widgets.js');
    const { loadRulebook } = await import('../../../lib/battlefront/rulebook.js');
    const rb = loadRulebook();
    expect(offerNameOf(rb, { kind: 'class', id: 'd-orig-assault', cls: 'assault' })).toBe('ASSAULT');
    expect(offerNameOf(rb, { kind: 'hero', id: 'darthvader' })).toBe('DARTH VADER');
    expect(offerNameOf(rb, { kind: 'hero', id: 'bobafett' })).toBe('BOBA FETT');
    expect(offerNameOf(rb, { kind: 'hero', id: 'bossk' })).toBe('BOSSK');
    expect(offerNameOf(rb, { kind: 'reinforcement', id: 'ISBAgent' })).toBe('ISB AGENT');
    expect(offerNameOf(rb, { kind: 'reinforcement', id: 'DeathTrooper' })).toBe('DEATH TROOPER');
    expect(offerNameOf(rb, { kind: 'reinforcement', id: 'SomethingNew' })).toBe('SOMETHING NEW');
  });
});
