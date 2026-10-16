import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateModule, validateWorld } from '../../../runtime/module';
import { WORLD_MB, worldAt } from '../../worlds/worlds';
import { byPath } from '../../universe/universes';
import { placeName } from '../../universe/online/where';
import { guideFor } from '../../guide/pages';
import { keyTokens } from '../../guide/keys';
import { briefKeyFor } from '../../tour/brief';
import { ACHIEVEMENTS } from '../../Achievements';
import { SAVE } from './rules/save';
import { objectiveOf } from './rules/game';
import inside, { KEYS } from './module';

const PATH = '/deathstar/inside';

// The scene needs WebGL, which Node hasn’t: a stand-in records what the
// module asks of it (the scene’s own drawing is checked in Chromium).
const { made } = vi.hoisted(() => ({ made: [] }));
vi.mock('./scene/index.js', () => ({
  createScene: vi.fn((renderer, opts) => {
    const s = { renderer, opts, scene: { name: 'station' }, camera: { name: 'eye' }, ready: Promise.resolve(), sync: vi.fn(), hear: vi.fn(), resize: vi.fn(), render: vi.fn(), dispose: vi.fn() };
    made.push(s);
    return s;
  }),
}));

function fakeRenderer() {
  return { render: vi.fn(), getPixelRatio: () => 1, info: { autoReset: true, reset: vi.fn(), render: { calls: 12, triangles: 3456 } } };
}

function fakeRt({ tier = 'high', post = true, stored } = {}) {
  const emitted = [];
  const store = new Map(stored ? [[SAVE, stored]] : []);
  const renderer = fakeRenderer();
  const chain = { render: vi.fn(), setSize: vi.fn(), dispose: vi.fn(), composer: { setPixelRatio: vi.fn() } };
  return {
    emitted,
    store,
    renderer,
    chain,
    gfx: { renderer, ...(post ? { post: vi.fn(() => chain) } : {}) },
    input: { bind: vi.fn(), unbind: vi.fn() },
    events: { emit: (type, data) => emitted.push({ type, ...data }) },
    saves: { register: vi.fn(), get: (k, fb = null) => (store.has(k) ? store.get(k) : fb), set: (k, v) => store.set(k, structuredClone(v)) },
    quality: { tier },
  };
}

// one frame’s input: the codes held, and the ones pressed since the last frame
function snap({ held = [], pressed = [] } = {}) {
  const keys = new Set(held);
  return { keys, pressed: new Set(pressed), pad: null, tapped: {}, action: (name) => (KEYS[name] ?? []).some((code) => keys.has(code)) };
}

const last = (rt, type) => rt.emitted.filter((e) => e.type === type).at(-1);

// frames of 1/60 s for `seconds`, each with the same keys held
function frames(world, seconds, held = []) {
  for (let i = 0; i < Math.round(seconds * 60); i++) world.step(1 / 60, snap({ held }));
}

async function make(props = {}, opts = {}) {
  const rt = fakeRt(opts);
  const world = await inside.create(rt, props);
  return { rt, world, scene: made.at(-1) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('aboard the Death Star, the world module', () => {
  // (on the node renderer since lane P1: every shader it reaches a TSL twin, shading.test holds its closure to it)
  it('is a nodes world that downloads what the phone gate says it does', () => {
    expect(inside).toMatchObject({ id: 'deathstar-inside', shading: 'nodes', mb: 6 });
    expect(inside.mb).toBe(WORLD_MB[PATH]);
    expect(inside.label).toBe('Aboard the Death Star');
    expect(validateModule(inside).id).toBe('deathstar-inside');
  });

  it('binds the controls the guide and the HUD list', () => {
    expect(KEYS).toMatchObject({
      forward: ['KeyW', 'ArrowUp'],
      back: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      run: ['ShiftLeft', 'ShiftRight'],
      jump: ['Space'],
      crouch: ['KeyC'],
      use: ['KeyE'],
      reload: ['KeyR'],
      view: ['KeyV'],
      helmet: ['KeyH'],
      roar: ['KeyG'],
      map: ['KeyM', 'Tab'],
      pause: ['Escape', 'KeyP'],
      talk1: ['Digit1'],
      talk2: ['Digit2'],
      talk3: ['Digit3'],
      talk4: ['Digit4'],
    });
  });

  it('makes a world the runtime can draw and put away', async () => {
    const { rt, world, scene } = await make({ side: 'imperial' });
    expect(validateWorld(world)).toBe(world);
    world.step(1 / 60, snap());
    world.draw({ dt: 1 / 60, now: 0, renderer: rt.renderer });
    world.dispose();
    expect(rt.input.unbind).toHaveBeenCalled();
    expect(scene.dispose).toHaveBeenCalled();
    expect(rt.chain.dispose).toHaveBeenCalled();
  });

  it('answers every call the page makes', async () => {
    const { world } = await make();
    for (const name of ['start', 'pause', 'set', 'quit', 'map', 'choose', 'look', 'stick', 'press']) expect(world[name], name).toBeTypeOf('function');
  });
});

describe('aboard the Death Star, coming aboard', () => {
  it('starts at once from an address that names a side, and says so at its first step', async () => {
    const { rt, world, scene } = await make({ station: 'ds1', side: 'imperial', mode: 'roam' });
    expect(scene.opts).toMatchObject({ station: 'ds1' });
    world.step(1 / 60, snap());
    expect(last(rt, 'ui')).toMatchObject({ mode: 'play', station: 'ds1', side: 'imperial', hero: 'stormtrooper', play: 'roam', talk: null, map: { open: false } });
    expect(last(rt, 'hud')).toMatchObject({ hp: 100, gun: 'e11', alert: 'calm', section: 'bay327', room: 'bay327' });
    expect(rt.input.bind).toHaveBeenLastCalledWith(KEYS);
  });

  it('shows the start screen when the address names no side, with no game yet to begin from', async () => {
    const { rt, world } = await make();
    world.step(1 / 60, snap());
    expect(last(rt, 'ui')).toMatchObject({ mode: 'start', station: null, side: null, saved: { ds1: { rebel: false, imperial: false } } });
  });

  it('begins at the spot or the room the address names', async () => {
    const spot = await make({ side: 'imperial', at: 'lift1' });
    spot.world.step(1 / 60, snap());
    expect(last(spot.rt, 'hud').room).toBe('lobby1');
    const room = await make({ side: 'rebel', at: 'ctl327' });
    room.world.step(1 / 60, snap());
    expect(last(room.rt, 'hud').room).toBe('ctl327');
  });

  it('starts the game the start screen asks for, and says you came aboard', async () => {
    const { rt, world } = await make();
    world.start({ station: 'ds1', side: 'rebel', hero: 'han', mode: 'story', fresh: true });
    world.step(1 / 60, snap());
    // the story plays its own hero: the first Death Star’s Rebel story is Luke’s
    expect(last(rt, 'ui')).toMatchObject({ mode: 'play', side: 'rebel', hero: 'luke', play: 'story' });
    expect(last(rt, 'ui').objective).toBeTruthy();
    expect(last(rt, 'hud').room).toBe('hold');
    expect(rt.emitted).toContainEqual({ type: 'achievement', id: 'ds-aboard' });
  });

  it('starts a story again from its beginning when asked to start it afresh', async () => {
    const { rt, world } = await make({}, { stored: { ds1: { story: { rebel: 'compactor' } } } });
    world.step(1 / 60, snap());
    expect(last(rt, 'ui').saved.ds1.rebel).toBe(true);
    world.start({ station: 'ds1', side: 'rebel', hero: 'luke', mode: 'story', fresh: true });
    world.quit();
    world.step(1 / 60, snap());
    expect(last(rt, 'ui').saved.ds1.rebel).toBe(false);
    expect(rt.store.get(SAVE).ds1.story.rebel).toBeNull();
  });
});

describe('aboard the Death Star, what the page is told of the game', () => {
  it('shows the story’s step as the objective, and none in free roam', async () => {
    const story = await make({ side: 'rebel', mode: 'story' });
    story.world.step(1 / 60, snap());
    expect(last(story.rt, 'ui').objective).toBe(objectiveOf(story.world.game));
    expect(last(story.rt, 'ui').objective).toBeTruthy();
    const roam = await make({ side: 'imperial', mode: 'roam' });
    roam.world.step(1 / 60, snap());
    expect(last(roam.rt, 'ui').objective).toBeNull();
  });

  it('tells the HUD your health out of its most, the section’s security and, in armour, the doubt', async () => {
    const { rt, world } = await make({ side: 'imperial', mode: 'roam' });
    world.step(1 / 60, snap());
    expect(last(rt, 'hud')).toMatchObject({ hp: 100, hpMax: 100, alert: 'calm', doubt: null, blade: null, roomName: 'Docking Bay 327' });
    const rebel = await make({ side: 'rebel', mode: 'roam' });
    Object.assign(rebel.world.game.you, { armour: true, helmet: true });
    rebel.world.step(1 / 60, snap());
    expect(last(rebel.rt, 'hud').doubt).toBe(0);
  });

  it('shows a conversation with its speaker’s name, the line and the choices', async () => {
    const { rt, world } = await make({ side: 'imperial', mode: 'roam' });
    world.game.talk = { id: 'x', node: 'a', who: 'tarkin', say: 'You may fire when ready.', choices: ['Yes, sir', 'Leave'], end: false, npc: null };
    world.step(1 / 60, snap());
    expect(last(rt, 'ui').talk).toEqual({ who: 'Governor Tarkin', line: 'You may fire when ready.', choices: ['Yes, sir', 'Leave'] });
    expect(last(rt, 'ui').prompt).toBeNull();
  });

  it('says the game’s lines as subtitles, passes on its achievements and hands the scene every event', async () => {
    const { rt, world, scene } = await make({ side: 'imperial', mode: 'roam' });
    world.step(1 / 60, snap());
    world.game.events.push({ type: 'say', who: 'tarkin', name: 'Grand Moff Tarkin', text: 'Evacuate?' }, { type: 'achievement', id: 'ds-1138' });
    world.step(1 / 30, snap());
    expect(rt.emitted).toContainEqual({ type: 'say', who: 'Grand Moff Tarkin', text: 'Evacuate?' });
    expect(rt.emitted).toContainEqual({ type: 'achievement', id: 'ds-1138' });
    const heard = scene.hear.mock.calls.flatMap(([events]) => events);
    expect(heard).toContainEqual(expect.objectContaining({ type: 'say', text: 'Evacuate?' }));
  });

  it('tells the page where a hit on you came from, as a turn from where you face', async () => {
    const { rt, world } = await make({ side: 'imperial', mode: 'roam' });
    world.step(1 / 60, snap());
    const you = world.game.you;
    you.yaw = 0;
    // from straight behind: +z when you face −z
    world.game.events.push({ type: 'hurt', amount: 10, from: { x: you.x, z: you.z + 5 } });
    world.step(1 / 30, snap());
    const hit = rt.emitted.filter((e) => e.type === 'hurt').at(-1);
    expect(hit.amount).toBe(10);
    expect(Math.abs(hit.angle)).toBeCloseTo(Math.PI);
  });
});

describe('aboard the Death Star, walking', () => {
  it('walks you the way the camera faces, and the stick strafes across it', async () => {
    const { world, scene } = await make({ side: 'imperial', mode: 'roam' });
    world.look(400, 0);
    world.step(1 / 60, snap());
    world.draw({ dt: 1 / 60, renderer: scene.renderer });
    const yaw = scene.sync.mock.calls.at(-1)[2].yaw;
    expect(yaw).toBeGreaterThan(0.3);
    const you = world.game.you;
    let from = { x: you.x, z: you.z };
    frames(world, 0.5, ['KeyW']);
    expect(Math.atan2(you.x - from.x, -(you.z - from.z))).toBeCloseTo(yaw, 2);
    from = { x: you.x, z: you.z };
    world.stick(1, 0);
    frames(world, 0.5);
    world.stick(0, 0);
    expect(Math.atan2(you.x - from.x, -(you.z - from.z))).toBeCloseTo(yaw + Math.PI / 2, 2);
  });

  it('runs at most four steps for a long frame', async () => {
    const { world } = await make({ side: 'imperial', mode: 'roam' });
    const you = world.game.you;
    const z = you.z;
    world.step(2, snap({ held: ['KeyW'] }));
    expect(z - you.z).toBeGreaterThan(0.2);
    expect(z - you.z).toBeLessThanOrEqual((4 / 30) * 1.6 + 1e-6);
  });

  it('keeps a press made in a frame too short for a step, and takes the lift on it', async () => {
    const { rt, world } = await make({ side: 'imperial', at: 'lift1-l2' });
    frames(world, 0.6);
    expect(last(rt, 'ui').prompt).toEqual({ text: 'take the lift down to Level 5', use: true });
    world.step(1 / 240, snap({ pressed: ['KeyE'], held: ['KeyE'] }));
    world.step(1 / 30, snap());
    expect(world.game.lift).toMatchObject({ from: 'lift1-l2', to: 'lift1-l5' });
    frames(world, 3.2);
    expect(last(rt, 'hud').room).toBe('lift1-l5');
  });

  it('keeps the rooms you see, for the map', async () => {
    const { rt, world } = await make({ side: 'imperial', mode: 'roam' });
    frames(world, 5, ['KeyW']);
    expect(last(rt, 'ui').map.seen).toContain('corr327');
    expect(rt.store.get(SAVE).ds1.seen).toContain('corr327');
  });
});

describe('aboard the Death Star, the menus', () => {
  it('pauses on Esc or P, and P carries on', async () => {
    const { rt, world } = await make({ side: 'imperial' });
    world.step(1 / 60, snap({ pressed: ['Escape'] }));
    expect(last(rt, 'ui').mode).toBe('pause');
    // (Esc again is the browser letting go of the pointer, not a wish to play on)
    world.step(1 / 60, snap({ pressed: ['Escape'] }));
    expect(last(rt, 'ui').mode).toBe('pause');
    world.step(1 / 60, snap({ pressed: ['KeyP'] }));
    expect(last(rt, 'ui').mode).toBe('play');
    world.step(1 / 60, snap({ pressed: ['KeyP'] }));
    expect(last(rt, 'ui').mode).toBe('pause');
    world.pause(false);
    world.step(1 / 60, snap());
    expect(last(rt, 'ui').mode).toBe('play');
  });

  it('leaves Tab, Space and the arrows to the menus while one is up', async () => {
    const { rt, world } = await make({ side: 'imperial' });
    world.pause(true);
    world.step(1 / 60, snap());
    expect(rt.input.bind).toHaveBeenLastCalledWith({ pause: ['KeyP'] });
    world.pause(false);
    world.step(1 / 60, snap());
    expect(rt.input.bind).toHaveBeenLastCalledWith(KEYS);
  });

  it('opens the map on M and shuts it on Esc before pausing', async () => {
    const { rt, world } = await make({ side: 'imperial' });
    world.step(1 / 60, snap({ pressed: ['KeyM'] }));
    expect(last(rt, 'ui')).toMatchObject({ mode: 'play', map: { open: true } });
    world.step(1 / 60, snap({ pressed: ['Escape'] }));
    expect(last(rt, 'ui')).toMatchObject({ mode: 'play', map: { open: false } });
    world.map(true);
    world.step(1 / 60, snap());
    expect(last(rt, 'ui').map.open).toBe(true);
  });

  it('turns to first person on V and keeps the setting', async () => {
    const { rt, world, scene } = await make({ side: 'imperial' });
    world.step(1 / 60, snap({ pressed: ['KeyV'] }));
    world.draw({ dt: 1 / 60, renderer: rt.renderer });
    expect(last(rt, 'ui').settings.view).toBe('first');
    expect(scene.sync.mock.calls.at(-1)[2].view).toBe('first');
    expect(rt.store.get(SAVE).settings.view).toBe('first');
    world.set({ subtitles: false, view: 'sideways' });
    world.step(1 / 60, snap());
    expect(last(rt, 'ui').settings).toEqual({ view: 'first', sound: true, subtitles: false, guide: true, tips: true });
  });

  it('quits to the start screen, offering the last game’s choices', async () => {
    const { rt, world } = await make({ side: 'imperial', mode: 'roam' });
    world.quit();
    world.step(1 / 60, snap());
    expect(last(rt, 'ui')).toMatchObject({ mode: 'start', station: 'ds1', side: 'imperial', play: 'roam' });
  });
});

describe('aboard the Death Star, drawing', () => {
  it('draws with the frame’s renderer through bloom on a high tier', async () => {
    const { rt, world, scene } = await make({ side: 'imperial' });
    expect(rt.gfx.post).toHaveBeenCalledWith([
      // (no multisampling and the composer's glow: what the classic backend's EffectComposer and UnrealBloomPass drew)
      { kind: 'render', scene: scene.scene, camera: scene.camera, samples: 0 },
      // (over the lamp-lit walls and floor, which reach about 2 in linear light: only the light strips and grids glow)
      { kind: 'bloom', strength: 0.6, radius: 0.4, threshold: 2.2, composer: true },
      { kind: 'output' },
    ]);
    world.step(1 / 60, snap());
    world.draw({ dt: 1 / 60, renderer: rt.renderer });
    expect(rt.chain.render).toHaveBeenCalledTimes(1);
    expect(scene.sync).toHaveBeenCalledWith(world.game, expect.any(Number), expect.objectContaining({ view: 'third', aim: false }));
  });

  it('draws plainly with the frame’s renderer on a lower tier, or with no post chain', async () => {
    for (const opts of [{ tier: 'mid' }, { tier: 'high', post: false }]) {
      const { rt, world, scene } = await make({ side: 'imperial' }, opts);
      const other = fakeRenderer();
      world.step(1 / 60, snap());
      world.draw({ dt: 1 / 60, renderer: other });
      expect(other.render).toHaveBeenCalledWith(scene.scene, scene.camera);
      expect(rt.chain.render).not.toHaveBeenCalled();
    }
  });

  it('lets go of bloom when the frames come slowly', async () => {
    const { rt, world } = await make({ side: 'imperial' });
    world.lowerQuality(2);
    world.draw({ dt: 1 / 60, renderer: rt.renderer });
    expect(rt.chain.dispose).toHaveBeenCalled();
    expect(rt.renderer.render).toHaveBeenCalled();
  });

  it('gives the development checks a handle on the game', async () => {
    vi.stubGlobal('window', {});
    const { rt, world } = await make({ side: 'imperial' });
    const hook = window.__deathstar;
    expect(hook.g).toBe(world.game);
    expect(hook.teleport('ctl327')).toBe(true);
    world.step(1 / 60, snap());
    world.draw({ dt: 1 / 60, renderer: rt.renderer });
    expect(hook.info()).toMatchObject({ calls: 12, triangles: 3456, room: 'ctl327' });
    hook.do('pause', true);
    world.step(1 / 60, snap());
    expect(last(rt, 'ui').mode).toBe('pause');
    world.dispose();
    expect(window.__deathstar).toBeUndefined();
  });
});

describe('aboard the Death Star, on the site', () => {
  it('is a world of its own inside the Death Star’s address, in Star Wars', () => {
    expect(WORLD_MB[PATH]).toBe(6);
    expect(worldAt(PATH).to).toBe(PATH);
    expect(worldAt('/deathstar').to).toBe('/deathstar');
    expect(byPath(PATH).id).toBe('starwars');
  });

  it('has a route of its own, with no footer over the station', () => {
    const app = readFileSync(new URL('../../../App.jsx', import.meta.url), 'utf8');
    expect(app).toContain(`<Route path="${PATH}" element={<DeathStarInside />} />`);
    expect(app).toMatch(new RegExp(`pathname !== '${PATH}'[^\\n]*<Footer />`));
  });

  it('is named for the other pilots, the guide and the tour', () => {
    // (read as “went to …” and “Go to …”, so a place, not “aboard”)
    expect(placeName(PATH)).toBe('the Death Star’s corridors');
    expect(guideFor(PATH).key).toBe(PATH);
    expect(guideFor(PATH).title).toBe('Aboard the Death Star');
    expect(briefKeyFor(PATH)).toBe(PATH);
  });

  it('tells both pause keys in the guide, P for while the pointer is held', () => {
    // (Esc first lets go of a held pointer, so P is the key that pauses then)
    const pause = guideFor(PATH).keys.flatMap((g) => g.rows).find(([, what]) => what === 'Pause');
    expect(keyTokens(pause[0]).map((t) => t.key).filter(Boolean)).toEqual(['Esc', 'P']);
  });

  it('has an achievement for coming aboard, earned on arrival', () => {
    expect(ACHIEVEMENTS['ds-aboard'].name).toBeTruthy();
    const achievements = readFileSync(new URL('../../Achievements.jsx', import.meta.url), 'utf8');
    expect(achievements).toContain(`if (pathname === '${PATH}') unlock('ds-aboard');`);
  });

  it('is in the command palette', () => {
    const palette = readFileSync(new URL('../../CommandPalette.jsx', import.meta.url), 'utf8');
    expect(palette).toMatch(new RegExp(`id: 'w-dsin'[^\\n]*run: go\\('${PATH}'\\)`));
  });
});
