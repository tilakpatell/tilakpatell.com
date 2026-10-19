import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { check } from './budget.mjs';
import { command, lying, wslPath } from './generate.mjs';
import { caption, layout } from './judge.mjs';

describe('judging sheets', () => {
  it('lay the views of each model out in a row', () => {
    const { width, height, cells } = layout(2, ['three', 'front'], 100, 50);
    expect([width, height]).toEqual([200, 100]);
    expect(cells[1]).toEqual([{ row: 1, view: 'three', left: 0, top: 50 }, { row: 1, view: 'front', left: 100, top: 50 }]);
  });
  it('caption a model with its name, triangles and size', () => {
    expect(caption('C:/x/x-wing.glb', { tris: 15987 }, 409872)).toBe('x-wing.glb  15,987 tris  400 KB');
  });
});

describe('engines', () => {
  it('see Windows paths the way WSL does', () => {
    expect(wslPath('C:\\Users\\tilak\\a b\\c.png')).toBe('/mnt/c/Users/tilak/a b/c.png');
    expect(wslPath('/home/tilak/x.glb')).toBe('/home/tilak/x.glb');
  });
  it('run the reference TRELLIS.2 in WSL with the paths translated', () => {
    const cmd = command('trellis2', 'C:\\in\\drone.png', 'C:\\out\\drone.glb', { seed: 7 });
    expect(cmd.slice(0, 5)).toEqual(['wsl.exe', '-d', 'Ubuntu-24.04', '-e', 'bash']);
    expect(cmd.at(-1)).toContain("'/mnt/c/in/drone.png' '/mnt/c/out/drone.glb' --seed 7");
  });
  it('run the contract tests’ fake engine with node, every side it was given in turn', () => {
    const cmd = command('fake', { front: 'f.png', back: 'b.png', left: 'l.png' }, 'o.glb', { seed: 3 });
    expect(cmd[0]).toBe(process.execPath);
    expect(cmd[1]).toMatch(/ai-e2e[\\/]fakes[\\/]engine\.mjs$/);
    expect(cmd.slice(2)).toEqual(['f.png', 'o.glb', '--seed', '3', '--left', 'l.png', '--back', 'b.png', '--res', '1024']);
  });
  it('refuse an engine it does not know', () => {
    expect(() => command('meshy', 'a.png', 'b.glb')).toThrow(/no engine meshy/);
  });
});

describe('the web budget', () => {
  it('passes a model within its triangle budget and under 1 MB', () => {
    expect(check({ tris: 16000, after: 15900, bytes: 400 * 1024 })).toEqual([]);
  });
  it('refuses one over budget, naming each problem', () => {
    const problems = check({ tris: 16000, after: 24000, bytes: 4200 * 1024 });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/24000 triangles, over the budget of 16000/);
    expect(problems[1]).toMatch(/4200 KB, over 4096 KB/);
  });
});

describe('concept pictures', () => {
  it('ask for one object on white, the way the 3D model wants it', async () => {
    const { prompt } = await import('./picture.mjs');
    expect(prompt('an X-wing')).toMatch(/^an X-wing, .*white background.*no text/);
  });
});

describe('following a picture closely', () => {
  it('runs trellis.cpp with the Pixal3D weights and the camera it was taken with', () => {
    const cmd = command('trelliscpp', 'a.png', 'b.glb', { faithful: true, fov: 52 });
    if (!cmd) return; // trellis.cpp isn't installed here
    expect(cmd.join(' ')).toContain('--model pixal3d --fov 52');
    expect(command('trelliscpp', 'a.png', 'b.glb').join(' ')).not.toContain('pixal3d');
  });
  it('stands up only what Pixal3D made, which lies along Z', () => {
    expect(lying('trelliscpp', true)).toBe(true);
    expect([lying('trelliscpp', false), lying('trellis2', true), lying('hunyuan', false), lying('fake', true)]).toEqual([false, false, false, false]);
  });
  it('stands a tower Pixal3D laid along Z, its base at +Z, on its base: wide at the foot, Y up', async () => {
    const { Document } = await import('@gltf-transform/core');
    const { upright } = await import('./upright.mjs');
    // (a tapering tower as Jedha's temple came out: its stepped base, 0.5 across, at +Z; its top, 0.1 across, at −Z)
    const ring = (w, z) => [[-w, -w, z], [w, -w, z], [w, w, z], [-w, w, z]];
    const pts = [...ring(0.25, 0.45), ...ring(0.05, -0.45)].flat();
    const doc = new Document();
    const buffer = doc.createBuffer();
    const position = doc.createAccessor().setType('VEC3').setArray(new Float32Array(pts)).setBuffer(buffer);
    doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', position))));
    await upright(doc);
    const a = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION');
    const out = Array.from({ length: a.getCount() }, (_, i) => a.getElement(i, []));
    const span = (vs, k) => Math.max(...vs.map((v) => v[k])) - Math.min(...vs.map((v) => v[k]));
    // (now along Y, the base at the foot)
    expect(span(out, 1)).toBeCloseTo(0.9);
    expect(span(out, 2)).toBeCloseTo(0.5);
    const foot = out.filter((v) => v[1] < 0);
    const top = out.filter((v) => v[1] > 0);
    expect(span(foot, 0)).toBeCloseTo(0.5);
    expect(span(top, 0)).toBeCloseTo(0.1);
  });
});

describe('preparing a picture of your own', () => {
  it('frames the subject in a square with room around it', async () => {
    const { frame } = await import('./prepare.mjs');
    expect(frame(840, 400, 0.08)).toEqual([1000, 80, 300]);
    expect(frame(100, 100, 0)).toEqual([100, 0, 0]);
  });
  it('fits a subject bigger than the size it makes, scaled down into the square', async () => {
    const { prepare } = await import('./prepare.mjs');
    const { default: sharp } = await import('sharp');
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'gen3d-'));
    // a dark figure 60×110 on white, taller than the 64 asked for (a portrait's figure, 1154 tall, at 1024)
    const figure = await sharp({ create: { width: 60, height: 110, channels: 3, background: '#203040' } }).png().toBuffer();
    const given = join(dir, 'given.png');
    await sharp({ create: { width: 100, height: 140, channels: 3, background: '#ffffff' } }).composite([{ input: figure, left: 20, top: 15 }]).png().toFile(given);
    const out = join(dir, 'out.png');
    await prepare(given, out, { size: 64, room: 0.1 });
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([64, 64]);
    const at = (x, y) => data[(y * info.width + x) * info.channels];
    expect(at(32, 32)).toBeLessThan(80); // the figure, in the middle
    expect(at(32, 2)).toBeGreaterThan(240); // room above it
    expect(at(32, 61)).toBeGreaterThan(240); // and below
  });
});

describe('the picture models', () => {
  it('give FLUX its two text encoders and Z-Image its one', async () => {
    const { SDCPP, command, ready } = await import('./picture.mjs');
    if (!ready('zimage')) return; // stable-diffusion.cpp isn't set up here
    const z = command('a drone', 'o.png', { model: 'zimage' }).join(' ');
    expect(z).toContain(`--llm ${SDCPP.zimage.llm}`);
    expect(z).toContain('--steps 8');
    if (!ready('flux')) return;
    const f = command('a drone', 'o.png', { model: 'flux' }).join(' ');
    expect(f).toContain('--clip_l');
    expect(f).toContain('--t5xxl');
    expect(f).toContain('--steps 4');
  });
});

describe('baking in Blender', () => {
  it('runs a Windows Blender directly', async () => {
    const { command } = await import('./bake.mjs');
    const cmd = command('C:/m/raw.glb', 'C:/m/low.glb', { faces: 20000, tex: 1024, where: { kind: 'windows', exe: 'C:/b/blender.exe' } });
    expect(cmd[0]).toBe('C:/b/blender.exe');
    expect(cmd.slice(1, 3)).toEqual(['--background', '--python']);
    expect(cmd.slice(-6)).toEqual(['C:/m/raw.glb', 'C:/m/low.glb', '--faces', '20000', '--tex', '1024']);
  });
  it('runs a Linux Blender in WSL with the paths translated and its missing X libraries found', async () => {
    const { command } = await import('./bake.mjs');
    const cmd = command('C:/m/raw.glb', 'C:/m/low.glb', { where: { kind: 'wsl', exe: '/home/me/blender/blender-4.5.9-linux-x64/blender' } });
    expect(cmd.slice(0, 4)).toEqual(['wsl.exe', '-d', 'Ubuntu-24.04', '-e']);
    const run = cmd.at(-1);
    // (bake.py's own path, as WSL sees it: /mnt/c/… where the repo is on a
    // Windows drive, as it is when this runs for real; as it is anywhere else)
    const script = wslPath(fileURLToPath(new URL('./bake.py', import.meta.url)));
    expect(run).toContain(`'/home/me/blender/blender-4.5.9-linux-x64/blender' '--background' '--python' '${script}'`);
    expect(run).toContain("'/mnt/c/m/raw.glb' '/mnt/c/m/low.glb' '--faces' '24000' '--tex' '2048'");
    expect(run).toMatch(/^export LD_LIBRARY_PATH=~\/miniforge3\/envs\/x11libs\/lib/);
  });
  it('has no command without a Blender', async () => {
    const { command } = await import('./bake.mjs');
    expect(command('a.glb', 'b.glb', { where: null })).toBeNull();
  });
});

describe('the runner, jobs from GitHub issues', () => {
  it('reads a prompt job from an issue: the title names it, the body says what', async () => {
    const { parseIssue, makeArgs } = await import('./runner.mjs');
    const job = parseIssue({ number: 7, title: 'gen3d: TIE Fighter', body: 'what: a TIE fighter\nprompt: a TIE fighter, grey, twin solar panels\nfaces: 16000\nbake: no' });
    expect(job).toMatchObject({ number: 7, name: 'tie-fighter', what: 'a TIE fighter', prompt: 'a TIE fighter, grey, twin solar panels', faces: 16000, noBake: true, faithful: false });
    expect(makeArgs(job)).toEqual(['tie-fighter', '--prompt', 'a TIE fighter, grey, twin solar panels', '--what', 'a TIE fighter', '--faces', '16000', '--no-bake']);
  });
  it('takes an attached picture as the image, followed closely unless told not to', async () => {
    const { parseIssue, makeArgs } = await import('./runner.mjs');
    const job = parseIssue({ number: 8, title: 'Red Five', body: 'what: Red Five\n\n![photo](https://github.com/user-attachments/assets/abc.png)\nfov: 49' });
    expect(job).toMatchObject({ name: 'red-five', image: 'https://github.com/user-attachments/assets/abc.png', prompt: undefined, faithful: true, fov: 49 });
    expect(makeArgs(job, 'C:/c/from-issue.png')).toEqual(['red-five', '--image', 'C:/c/from-issue.png', '--what', 'Red Five', '--fov', '49', '--faithful']);
    expect(parseIssue({ number: 9, title: 'Red Five', body: 'image: https://x.test/a.png\nfaithful: no' })).toMatchObject({ image: 'https://x.test/a.png', faithful: false });
  });
  it('makes the title the prompt when the body says nothing, and no job from an empty title', async () => {
    const { parseIssue } = await import('./runner.mjs');
    expect(parseIssue({ number: 1, title: 'an AT-AT walker', body: '' })).toMatchObject({ name: 'an-at-at-walker', what: 'an AT-AT walker', prompt: 'an AT-AT walker' });
    expect(parseIssue({ number: 2, title: 'gen3d:', body: 'prompt: x' })).toBeNull();
  });
});

describe('the runner, reading what people and sessions actually write', () => {
  it('reads two fields on one line, and an image field holding a bare link', async () => {
    const { parseIssue, makeArgs } = await import('./runner.mjs');
    const body = 'what: Grand Regent Thragg, full body, A-pose\nimage: https://static.wikia.nocookie.net/amazon-invincible/images/b/be/Thragg.png/revision/latest\nfaces: 30000  tex: 2048\n\nMeshy got his skin wrong twice.';
    const job = parseIssue({ number: 441, title: 'thragg', body });
    expect(job).toMatchObject({ name: 'thragg', faces: 30000, tex: 2048, faithful: true, image: 'https://static.wikia.nocookie.net/amazon-invincible/images/b/be/Thragg.png/revision/latest' });
    expect(job.error).toBeUndefined();
    expect(makeArgs(job, 'C:/c/from-issue.png')).toEqual(['thragg', '--image', 'C:/c/from-issue.png', '--what', 'Grand Regent Thragg, full body, A-pose', '--faces', '30000', '--tex', '2048', '--faithful']);
  });
  it('reads an issue form, and says what is wrong with a bad field', async () => {
    const { parseIssue } = await import('./runner.mjs');
    const form = '### what\n\na mossy boulder\n\n### image\n\n![rock](https://github.com/user-attachments/assets/r.png)\n\n### faces\n\n4k\n\n### more\n\nengine: meshy';
    const job = parseIssue({ number: 5, title: 'galaxy-mossrock', body: form });
    expect(job).toMatchObject({ what: 'a mossy boulder', image: 'https://github.com/user-attachments/assets/r.png', faces: 4000 });
    expect(job.error).toMatch(/engine: "meshy"/);
    expect(parseIssue({ number: 6, title: 'x', body: 'what: x\nfaces: lots' }).error).toMatch(/faces: "lots"/);
  });
  it('turns a form into an issue, refusing one with nothing to make', async () => {
    const { request } = await import('./runner.mjs');
    expect(request({ name: 'Cecil Stedman', what: 'Cecil', image: 'https://x.test/c.png', faces: '30000', options: 'tex: 2048  seed: 7' })).toEqual({ title: 'cecil-stedman', body: 'what: Cecil\nimage: https://x.test/c.png\nfaces: 30000\ntex: 2048\nseed: 7' });
    expect(request({ name: 'crest', what: 'the Razor Crest', image: 'https://x.test/f.png, https://x.test/l.png' }).body).toBe('what: the Razor Crest\nfront: https://x.test/f.png\nleft: https://x.test/l.png');
    expect(() => request({ name: 'x' })).toThrow(/at least one of what, prompt or image/);
    expect(() => request({ what: 'x' })).toThrow(/name/);
    expect(() => request({ name: 'x', what: 'x', faces: 'many' })).toThrow(/faces/);
  });
});

describe('the three cuts of a smaller model', () => {
  it('scale with the faces asked for, the texture no bigger than asked', async () => {
    const { cutsFor, TIERS } = await import('./budget.mjs');
    expect(cutsFor()).toEqual(TIERS);
    const rock = cutsFor(4000, 1024);
    expect([rock.hq.faces, rock.mid.faces, rock.lo.faces]).toEqual([4000, 2000, 667]);
    expect([rock.hq.tex, rock.mid.tex, rock.lo.tex]).toEqual([1024, 1024, 1024]);
    expect(cutsFor(30000, 2048).hq).toMatchObject({ faces: 30000, tex: 2048, suffix: '.hq' });
  });
});

describe('the ultra cut, made only for the models asked for it', () => {
  it('is the raw mesh at 300k faces, with 8192 maps, under 24 MB, and kept out of the three standard cuts', async () => {
    const { TIERS, ULTRA, fileFor } = await import('./budget.mjs');
    expect(ULTRA).toEqual({ suffix: '.ultra', faces: 300000, tex: 8192, bytes: 24 * 1024 * 1024, detail: ['ultra'] });
    expect(Object.keys(TIERS)).toEqual(['hq', 'mid', 'lo']);
    expect(fileFor('x-wing', 'ultra')).toBe('x-wing.hq.glb');
    expect(fileFor('x-wing', 'ultra', { ultra: true })).toBe('x-wing.ultra.glb');
    expect(fileFor('x-wing', 'high', { ultra: true })).toBe('x-wing.hq.glb');
  });
});

describe('a step made again only when its inputs change', () => {
  it('reuses the last output for the same key', async () => {
    const { once, digest } = await import('./steps.mjs');
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const file = join(mkdtempSync(join(tmpdir(), 'once-')), 'raw.glb');
    let runs = 0;
    const make = async () => {
      runs++;
      writeFileSync(file, 'x');
      return { seconds: 1 };
    };
    expect((await once(file, digest('a', 1), make)).reused).toBe(false);
    expect((await once(file, digest('a', 1), make)).reused).toBe(true);
    expect((await once(file, digest('a', 2), make)).reused).toBe(false);
    expect((await once(file, digest('a', 2), make, { fresh: true })).reused).toBe(false);
    expect(runs).toBe(3);
    expect(digest(Buffer.from('ab'), 'c')).not.toBe(digest('a', 'bc'));
  });
});

// an engine's script as WSL is handed it, wherever this checkout is (on a
// Windows drive, /mnt/c/…; on Linux, CI's or a cloud box's, its own path)
const engine = (file) => wslPath(fileURLToPath(new URL(`./engines/${file}`, import.meta.url)));

describe('several sides of one thing', () => {
  it('runs Hunyuan3D multi-view in WSL with every side given', async () => {
    const { command } = await import('./generate.mjs');
    const cmd = command('hunyuan', { front: 'C:/p/f.png', back: 'C:/p/b.png' }, 'C:/p/out.glb', { seed: 7, paint21: false });
    expect(cmd.slice(0, 3)).toEqual(['wsl.exe', '-d', 'Ubuntu-24.04']);
    expect(cmd.at(-1)).toContain(`activate hy3d && cd ~/Hunyuan3D-2 && python '${engine('hunyuan.py')}'`);
    expect(cmd.at(-1)).toContain("'/mnt/c/p/out.glb' --front '/mnt/c/p/f.png' --back '/mnt/c/p/b.png' --seed 7 --steps 50 --faces 300000");
  });
  it('paints the multi-view shape with 2.1 PBR paint from the front when that env is here', async () => {
    const { command } = await import('./generate.mjs');
    const run = command('hunyuan', { front: 'C:/p/f.png', left: 'C:/p/l.png' }, 'C:/p/out.glb', { paint21: true }).at(-1);
    expect(run).toContain(`'/mnt/c/p/out.glb.white.glb' --front '/mnt/c/p/f.png' --left '/mnt/c/p/l.png' --seed 42 --steps 50 --faces 300000 --white && source ~/miniforge3/bin/activate hy3d21 && cd ~/Hunyuan3D-2.1 && python '${engine('hunyuan_paint21.py')}'`);
    expect(run).toContain("hunyuan_paint21.py' '/mnt/c/p/out.glb.white.glb' '/mnt/c/p/f.png' '/mnt/c/p/out.glb'");
  });
  it('gives TRELLIS.2 the front of several sides', async () => {
    const { command } = await import('./generate.mjs');
    const cmd = command('trellis2', { front: 'C:/p/f.png', left: 'C:/p/l.png' }, 'C:/p/out.glb', {});
    expect(cmd.at(-1)).toContain("'/mnt/c/p/f.png'");
    expect(cmd.at(-1)).not.toContain('l.png');
  });
  it('reads an issue with pictures for each side, in order or by name', async () => {
    const { parseIssue, makeArgs } = await import('./runner.mjs');
    const job = parseIssue({ number: 3, title: 'Razor Crest', body: 'what: the Razor Crest\n![f](https://x.test/1.png)\n![l](https://x.test/2.png)\n![b](https://x.test/3.png)' });
    expect(job.views).toEqual({ front: 'https://x.test/1.png', left: 'https://x.test/2.png', back: 'https://x.test/3.png' });
    expect(job.image).toBe('https://x.test/1.png');
    expect(makeArgs(job, 'C:/c/f.png', { front: 'C:/c/f.png', left: 'C:/c/l.png', back: 'C:/c/b.png' })).toEqual(['razor-crest', '--image', 'C:/c/f.png', '--left', 'C:/c/l.png', '--back', 'C:/c/b.png', '--what', 'the Razor Crest']);
    const named = parseIssue({ number: 4, title: 'Razor Crest', body: 'front: https://x.test/a.png\nback: https://x.test/c.png\n![x](https://x.test/zzz.png)' });
    expect(named.views).toEqual({ front: 'https://x.test/a.png', back: 'https://x.test/c.png' });
    expect(parseIssue({ number: 5, title: 'One', body: '![x](https://x.test/one.png)' }).views).toBeUndefined();
  });
});

describe("the model's eyes", () => {
  it('finds the JSON in an answer wrapped in prose or a fence', async () => {
    const { parseJson } = await import('./vlm.mjs');
    expect(parseJson('Sure. ```json\n{"score": 7, "problems": ["the wings are too short"]}\n```')).toEqual({ score: 7, problems: ['the wings are too short'] });
    expect(() => parseJson('no idea')).toThrow(/no JSON/);
  });
});

describe('every field an issue can give, read back', () => {
  const read = async (body, title = 'x-wing') => (await import('./runner.mjs')).parseIssue({ number: 1, title, body });
  const URL1 = 'https://x.test/front.png';
  it('reads each field into the job, or the job’s own name for it', async () => {
    const { KEYS } = await import('./runner.mjs');
    const cases = {
      what: ['an X-wing', { what: 'an X-wing' }],
      prompt: ['an X-wing, grey', { prompt: 'an X-wing, grey' }],
      image: [URL1, { image: URL1 }],
      front: [URL1, { image: URL1 }],
      left: [URL1, { views: { left: URL1 } }],
      back: [URL1, { views: { back: URL1 } }],
      right: [URL1, { views: { right: URL1 } }],
      faces: ['8000', { faces: 8000 }],
      tex: ['1024', { tex: 1024 }],
      seed: ['7', { seed: 7 }],
      res: ['512', { res: 512 }],
      fov: ['49', { fov: 49 }],
      engine: ['Hunyuan', { engine: 'hunyuan' }],
      faithful: ['no', { faithful: false }],
      bake: ['no', { noBake: true }],
      fresh: ['yes', { fresh: true }],
      ultra: ['yes', { ultra: true }],
    };
    // `more` is the issue form's catch-all section, whose lines are the other fields
    expect(KEYS.filter((k) => k !== 'more').sort()).toEqual(Object.keys(cases).sort());
    for (const [key, [value, want]] of Object.entries(cases)) {
      // a side alone is one view, so give it a front to stand beside
      // (a prompt only counts with no picture to follow)
      const given = { what: 'a thing', ...(key === 'prompt' ? {} : { image: URL1 }), ...(['left', 'back', 'right'].includes(key) ? { front: URL1 } : {}), [key]: value };
      const job = await read(Object.entries(given).map(([k, v]) => `${k}: ${v}`).join('\n'));
      expect(job.error, key).toBeUndefined();
      expect(job, key).toMatchObject(want);
    }
  });
  it('takes every spelling of yes and no', async () => {
    for (const yes of ['yes', 'Yes', 'true', 'on', '1']) expect((await read(`what: a\nfresh: ${yes}`)).fresh, yes).toBe(true);
    for (const no of ['no', 'NO', 'false', 'off', '0']) {
      const job = await read(`what: a\nimage: ${URL1}\nfaithful: ${no}\nbake: ${no}`);
      expect([job.faithful, job.noBake], no).toEqual([false, true]);
    }
    expect((await read('what: a\nfresh: maybe')).fresh).toBe(false);
  });
  it('reads 24k as 24000, and commas and spaces in a number', async () => {
    expect((await read('what: a\nfaces: 24k')).faces).toBe(24000);
    expect((await read('what: a\nfaces: 24,000')).faces).toBe(24000);
    expect((await read('what: a\nfaces: 24 000')).faces).toBe(24000);
  });
  it('finds the link in an image field however it is written', async () => {
    expect((await read(`image: ${URL1}`)).image).toBe(URL1);
    expect((await read(`image: ![a picture](${URL1})`)).image).toBe(URL1);
    expect((await read(`image: <img width="300" src="${URL1}">`)).image).toBe(URL1);
    expect((await read('image: a picture I took')).error).toMatch(/image: "a picture I took" has no link in it/);
  });
  it('takes attached pictures as front, left, back and right, in that order', async () => {
    const body = ['a', 'b', 'c', 'd', 'e'].map((n) => `![${n}](https://x.test/${n}.png)`).join('\n');
    const job = await read(`what: a thing\n${body}`);
    expect(job.views).toEqual({ front: 'https://x.test/a.png', left: 'https://x.test/b.png', back: 'https://x.test/c.png', right: 'https://x.test/d.png' });
    expect(job.image).toBe('https://x.test/a.png');
  });
});

describe('what the runner hands make.mjs', () => {
  it('turns Pixal3D off when the issue says faithful: no', async () => {
    const { makeArgs, parseIssue } = await import('./runner.mjs');
    const job = parseIssue({ number: 1, title: 'x', body: 'image: https://x.test/a.png\nfaithful: no' });
    expect(makeArgs(job, 'a.png')).toContain('--no-faithful');
    expect(makeArgs({ ...job, faithful: true }, 'a.png')).not.toContain('--no-faithful');
  });
  it('looks for a job’s sheet and outcome where make.mjs put them, GEN3D_CACHE or not', async () => {
    const { cacheOf } = await import('./runner.mjs');
    const saved = process.env.GEN3D_CACHE;
    delete process.env.GEN3D_CACHE;
    expect(cacheOf('/r', 'xw').split(/[\\/]/).slice(-5)).toEqual(['r', 'scripts', 'gen3d', 'cache', 'xw']);
    process.env.GEN3D_CACHE = '/elsewhere';
    expect(cacheOf('/r', 'xw').split(/[\\/]/).slice(-2)).toEqual(['elsewhere', 'xw']);
    if (saved === undefined) delete process.env.GEN3D_CACHE;
    else process.env.GEN3D_CACHE = saved;
  });
});

describe('the budget a shipped model was cut to', () => {
  it('is the smallest ask its three cuts all fit', async () => {
    const { cutsFor, inferFaces } = await import('./budget.mjs');
    // cut at the defaults: 120000 / 60000 / 20000
    expect(inferFaces({ hq: 119000, mid: 60000, lo: 20500 })).toBe(Math.ceil(20500 * 6 / 1.05));
    // a rock asked for at 4000 faces: 4000 / 2000 / 667
    const rock = cutsFor(4000);
    expect(inferFaces({ hq: rock.hq.faces, mid: rock.mid.faces, lo: rock.lo.faces })).toBeLessThanOrEqual(4000);
    // never more than the top cut's own budget
    expect(inferFaces({ hq: 500000, mid: 1, lo: 1 })).toBe(120000);
  });
});

describe('the ultra cut', () => {
  it('is a fourth cut made only when asked: 300k faces, 8192 maps, 24 MB, scaled like the others', async () => {
    const { ULTRA, TIERS, cutsFor } = await import('./budget.mjs');
    expect(ULTRA).toMatchObject({ suffix: '.ultra', faces: 300000, tex: 8192, bytes: 24 * 1024 * 1024, detail: ['ultra'] });
    expect(Object.keys(TIERS)).toEqual(['hq', 'mid', 'lo']);
    expect(cutsFor(300000, 8192).ultra).toBeUndefined();
    const big = cutsFor(300000, 8192, { ultra: true });
    expect([big.ultra.faces, big.hq.faces, big.mid.faces, big.lo.faces]).toEqual([300000, 120000, 60000, 20000]);
    expect([big.ultra.tex, big.hq.tex, big.mid.tex, big.lo.tex]).toEqual([8192, 4096, 2048, 1024]);
    // (--faces is the top cut, the ultra one when it's asked for: 30000 faces scales all four by a tenth)
    const small = cutsFor(30000, 8192, { ultra: true });
    expect([small.ultra.faces, small.hq.faces, small.mid.faces, small.lo.faces]).toEqual([30000, 12000, 6000, 2000]);
  });

  it('is the file ultra loads where one was made, and the hq one where not', async () => {
    const { fileFor } = await import('./budget.mjs');
    expect(fileFor('x-wing', 'ultra')).toBe('x-wing.hq.glb');
    expect(fileFor('x-wing', 'ultra', { ultra: true })).toBe('x-wing.ultra.glb');
    expect(fileFor('x-wing', 'high', { ultra: true })).toBe('x-wing.hq.glb');
    expect(fileFor('x-wing', 'mid')).toBe('x-wing.glb');
    expect(fileFor('x-wing', 'low')).toBe('x-wing.lo.glb');
  });

  it('is asked for with ultra: yes, and passed to make.mjs as --ultra', async () => {
    const { parseIssue, makeArgs, request } = await import('./runner.mjs');
    const job = parseIssue({ number: 9, title: 'theed', body: 'what: Theed\nimage: https://x.test/a.png\nfaces: 300000  tex: 8192  ultra: yes' });
    expect(job).toMatchObject({ faces: 300000, tex: 8192, ultra: true });
    expect(makeArgs(job, 'C:/a.png')).toContain('--ultra');
    expect(parseIssue({ number: 10, title: 'theed', body: 'what: Theed' }).ultra).toBe(false);
    expect(makeArgs(parseIssue({ number: 10, title: 'theed', body: 'what: Theed' }))).not.toContain('--ultra');
    expect(request({ name: 'theed', what: 'Theed', image: 'https://x.test/a.png', faces: 300000, options: 'tex: 8192  ultra: yes' }).body).toMatch(/ultra: yes/);
  });
});

describe('a prop’s physics, kept through the web cut', () => {
  it('a GLB with a crate_physical_dynamic node reads back one body after the cut', async () => {
    const { Document } = await import('@gltf-transform/core');
    const { collidersIn, io, webReady } = await import('./web.mjs');
    const doc = new Document();
    const buffer = doc.createBuffer();
    // a unit cube's corners, as twelve triangles
    const p = [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1].map((v) => v / 2);
    const idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 6, 2, 3, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
    const cube = () =>
      doc.createMesh().addPrimitive(
        doc
          .createPrimitive()
          .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(p)).setBuffer(buffer))
          .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buffer)),
      );
    const look = doc.createNode('crate').setMesh(cube());
    // (the collider a unit cube scaled to fit, as a modeller makes it; and an empty one)
    const cuboid = doc.createNode('cuboid').setMesh(cube()).setScale([1.2, 0.8, 1.2]).setTranslation([0, 0.4, 0]);
    const lid = doc.createNode('lid_physical_dynamic').setTranslation([0, 1, 0]).addChild(doc.createNode('cuboid.001').setScale([1.2, 0.2, 1.2]));
    const crate = doc.createNode('crate_physical_dynamic').setExtras({ mass: 3 }).addChild(cuboid).addChild(lid);
    doc.createScene('scene').addChild(look).addChild(crate);
    await webReady(doc, { tris: 1000, tex: 256 });
    const back = await (await io()).readBinary(await (await io()).writeBinary(doc));
    const bodies = await collidersIn(back);
    expect(bodies.map((b) => b.name)).toEqual(['crate_physical_dynamic', 'lid_physical_dynamic']);
    const [c] = bodies[0].desc.colliders;
    expect(c.shape).toBe('cuboid');
    c.args.forEach((v, i) => expect(v).toBeCloseTo([0.6, 0.4, 0.6][i], 3));
    c.position.forEach((v, i) => expect(v).toBeCloseTo([0, 0.4, 0][i], 3));
    expect(bodies[0].desc.mass).toBe(3);
    expect(bodies[1].desc.colliders[0].args[1]).toBeCloseTo(0.1, 3);
    // (the look is still drawn: the cut took nothing but the colliders’ meshes)
    expect(back.getRoot().listNodes().find((n) => n.getName() === 'crate').getMesh()).toBeTruthy();
  });
});
