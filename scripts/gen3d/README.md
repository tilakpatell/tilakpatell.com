# Making the site's 3D models here

Concept image → 3D → web GLB, all on this machine's GPU, so a model can be
made and remade as often as it takes to get one right.

```
node scripts/gen3d/make.mjs x-wing --image photo.png --what "an X-wing starfighter"       # from your own picture, followed closely
node scripts/gen3d/make.mjs x-wing --prompt "an X-wing starfighter" --what "an X-wing"     # from words (Z-Image-Turbo draws it)
```

`make.mjs` runs the steps, each usable on its own:

```
node scripts/gen3d/prepare.mjs photo.jpg cache/xwing.png               # your picture trimmed, squared, 1024 (what the model expects)
node scripts/gen3d/picture.mjs "an X-wing starfighter" cache/xwing.png  # or a concept image from words
node scripts/gen3d/generate.mjs cache/xwing.png cache/raw/xwing.glb [--faithful]   # image → raw textured GLB, ~300k triangles
node scripts/gen3d/bake.mjs cache/raw/xwing.glb cache/xwing-low.glb --faces 60000  # the high mesh baked onto a low one (Blender)
node scripts/gen3d/web.mjs cache/xwing-low.glb x-wing --tris 60000 --tex 2048 --what "an X-wing starfighter"
node scripts/gen3d/judge.mjs cache/xwing.png cache/raw/xwing.glb public/models/gen3d/x-wing.glb   # four views each, side by side
```

A picture of your own goes through **Pixal3D** (`--faithful`, on by default
with `--image`): a TRELLIS.2 fine-tune that projects each 3D cell into the
picture and samples it there, so the shape follows what you gave it; pass
`--fov` if you know the camera's horizontal field of view. A prompt goes
through TRELLIS.2 proper. Either way the model is made at full quality
first (res 1024, ~300k triangles, 2048² PBR atlas) and only then cut down
for the web: simplifying the raw mesh directly smears its texture (its atlas
is thousands of tiny charts), so `bake.mjs` decimates it, unwraps the low
mesh afresh and bakes colour, roughness, metalness and a normal map from the
high one. Without Blender, `web.mjs` simplifies the raw mesh and stops where
the seams let it (~25k triangles).

`web.mjs` writes `public/models/gen3d/<name>.glb` (welded, simplified to the
triangle budget, WebP textures, meshopt: the same steps as
`scripts/meshy-import.mjs`) and credits it in `public/games/credits.json`.
It refuses a model over its budget or over 4 MB. Everything else lands in
`scripts/gen3d/cache/` (git-ignored; `GEN3D_CACHE` for elsewhere).

Three cuts are made of every model (`.hq`, plain, `.lo`: `budget.mjs`), and
`--faces`/`--tex` scale all three: `--faces 4000` for a rock gives
4000/2000/667, not three copies of one cut.

**A failed run picks up where it stopped.** Each step's output keeps a key of
what it was made from (`raw.glb.key`: the pictures, seed, res, engine), and a
step whose inputs haven't changed is reused, so a job that died at the bake
or the cut doesn't spend the GPU on the raw model again. `--fresh` makes all
of it again. A run's own lines are in `cache/<name>/make.log`, its outcome in
`result.json`. Every engine, the concept picture and the bake are stopped if
they hang (`GEN3D_ENGINE_MINUTES` 45, `GEN3D_PICTURE_MINUTES` 10,
`GEN3D_BAKE_MINUTES` 20).

**Where the tools are.** Installed from inside the Claude desktop app (an
MSIX package), `%LOCALAPPDATA%\trellis-studio`, `sdcpp`, `llamacpp` and
`blender` really live in the app's boxed copy
(`%LOCALAPPDATA%\Packages\Claude_…\LocalCache\Local\…`), which a process
started outside the app (the Actions runner, a scheduled task) can't see at
the usual path. `localDir()` (scripts/desktop/lib.mjs) looks in both.

## From anywhere: the gen3d workflow

A model can be asked for from a phone, a laptop or a cloud session. The
desktop makes it when it's awake. `scripts/desktop/README.md` has the
whole picture. In short:

```
node scripts/desktop/ask.mjs gen3d tie-fighter --what "a TIE fighter" --image https://…/tie.png --faces 30000
```

or Actions → *gen3d* → *Run workflow*, or a new issue from the *3D model*
form. Each one is an issue labelled **`gen3d`**: the title is the model's
name, and the body says what, one field a line (or several to a line, two
spaces apart), all optional but one of `prompt`/`what`/`image`:

```
what: a TIE fighter                 (for the credit and the judge; the prompt if there is none)
prompt: a TIE fighter, grey, …      (FLUX draws the concept picture)
image: (attach a picture, or a URL) (the picture to follow; Pixal3D unless faithful: no)
faces: 30000  tex: 2048  seed: 42  res: 1024  fov: 49  engine: trelliscpp|trellis2|hunyuan
faithful: no  bake: no  fresh: yes  ultra: yes   (ultra: a fourth cut, NAME.ultra.glb, for the ultra level: budget.mjs ULTRA)
```

The self-hosted runner on the desktop runs `runner.mjs --issue N` in the
pipeline's own checkout beside the repository (`<repo>-gen3d`), on a branch
`gen3d/<name>` from `origin/main`. It waits for the GPU if something else
holds it. It pushes, opens a pull request with the judging sheet
(committed under `docs/gen3d/`) and comments on the issue, which it closes.
A failure is commented with the log's tail and labelled `gen3d:failed`:
fix the issue, then remove the label to try again (it resumes at the step
that failed). Wiring the model into a scene is a separate change.
`node scripts/desktop/status.mjs` says what's queued and whether the
desktop is up.

**Several pictures beat one.** Attach the front, left, back (and right) of
the thing, in that order (or name them: `front: URL`), and the job goes
through **Hunyuan3D-2 multi-view** (`--engine hunyuan`), which sees every
side; one picture goes through TRELLIS.2. On the command line:
`make.mjs NAME --image front.png --left left.png --back back.png`.

**Always give it a picture.** A prompt only works for designs FLUX knows
(an X-wing, a TIE); for anything else (a CR90, a particular building, a
character) attach a picture: three-quarter view, the whole thing in frame,
plain background if you can. A model the site already has is remade from
its own render (`remake.mjs`), which keeps its shape and adds the detail;
that only helps when the old shape was right.

### Keeping it running on the desktop

The GitHub Actions runner in `~\actions-runner` takes the jobs, kept going
by the `desktop-jobs-runner` scheduled task (`scripts/desktop/setup-runner.ps1`
sets both up, once, from a normal PowerShell window). Each job runs on a
fresh `origin/main`, so a merged change to these scripts is picked up by
the next job. The old Startup-folder poller (`gen3d-runner.vbs` running
`%LOCALAPPDATA%\gen3d\runner.cmd`) never survived a reboot: that file was
written from inside the Claude app, whose AppData is boxed, so at logon it
wasn't there. The setup moves it aside.

## The engines

Two run the same model, Microsoft's TRELLIS.2-4B (MIT), from a single image:

| engine | where | weights | what it is |
|---|---|---|---|
| `trelliscpp` | Windows, CUDA | f16 GGUF, 16.5 GB | [trellis.cpp](https://github.com/pwilkin/trellis.cpp) v0.8.1: a C++/GGML port, no Python; ~80–220 s a model at res 1024 |
| `trellis2` | WSL (Ubuntu-24.04), CUDA | bf16, ~10 GB | the [reference implementation](https://github.com/microsoft/TRELLIS.2), PyTorch, with its six CUDA extensions |

`generate.mjs` uses `--engine`, else the first set up here. Judge them on the
same images with `judge.mjs` before trusting either on a new kind of subject.

### trellis.cpp (Windows)

Its installer is PowerShell 7 syntax (Windows PowerShell can't parse it), so
by hand, into `%LOCALAPPDATA%\trellis-studio`:

1. `runtime\`: unzip `trellis-cuda-windows-x64.zip` from the
   [latest release](https://github.com/pwilkin/trellis.cpp/releases/latest)
   (`trellis-cli.exe`, `trellis-server.exe`).
2. `models\`: the ten f16 files from
   [ilintar/trellis2-gguf](https://huggingface.co/ilintar/trellis2-gguf/tree/main):
   `birefnet dinov3 ss_flow ss_dec shape_flow_512 shape_flow_1024 shape_dec tex_flow_512 tex_flow_1024 tex_dec` (`.gguf`).

Needs an NVIDIA driver with CUDA 13 (610+). Blackwell (RTX 50) is fine.

### Reference TRELLIS.2 (WSL)

No sudo needed: a user-space conda with the CUDA toolkit in it. In WSL:

```
curl -L -o mf.sh https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh && bash mf.sh -b -p ~/miniforge3
source ~/miniforge3/bin/activate && conda create -y -n trellis2 python=3.10 && conda activate trellis2
conda install -y -c nvidia/label/cuda-12.8.1 cuda-toolkit cuda-nvcc cuda-cudart-dev
export CUDA_HOME=$CONDA_PREFIX TORCH_CUDA_ARCH_LIST=12.0 MAX_JOBS=14
pip install torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu128
git clone --recursive https://github.com/microsoft/TRELLIS.2 ~/TRELLIS.2 && cd ~/TRELLIS.2
pip install imageio imageio-ffmpeg tqdm easydict opencv-python-headless ninja trimesh transformers gradio==6.0.1 tensorboard pandas lpips zstandard "huggingface_hub[hf_xet]" kornia timm
pip install git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8
# flash-attn from a prebuilt wheel (cu128, torch 2.8, cp310): hours of compiling saved
pip install https://github.com/mjun0812/flash-attention-prebuild-wheels/releases/download/v0.7.16/flash_attn-2.8.3%2Bcu128torch2.8-cp310-cp310-linux_x86_64.whl
for r in "-b v0.4.0 https://github.com/NVlabs/nvdiffrast.git" "-b renderutils https://github.com/JeffreyXiang/nvdiffrec.git" "https://github.com/JeffreyXiang/CuMesh.git --recursive" "https://github.com/JeffreyXiang/FlexGEMM.git --recursive"; do git clone $r /tmp/ext && pip install /tmp/ext --no-build-isolation && rm -rf /tmp/ext; done
pip install ./o-voxel --no-build-isolation
hf download microsoft/TRELLIS.2-4B
```

`engines/trellis2.py` is what `generate.mjs` runs there (`wsl.exe`, the
paths translated to `/mnt/c/…`). TRELLIS.2 wants 24 GB of GPU memory.

### Hunyuan3D-2 multi-view (WSL)

Tencent's [Hunyuan3D-2](https://github.com/Tencent/Hunyuan3D-2) with its
multi-view shape model (`tencent/Hunyuan3D-2mv`, front/left/back/right in)
and its turbo paint model, in a conda env of its own beside TRELLIS.2's
(`engines/hy3d-setup.sh`, run in WSL, does this: env `hy3d`, torch 2.8 cu128, the repo at
`~/Hunyuan3D-2` with its two CUDA extensions built, the weights by
`hf download`). `engines/hunyuan.py` is what `generate.mjs` runs there.
Licence: Tencent Hunyuan non-commercial, fine for this site.

Its 2.0 turbo paint is flat (white and stripes where TRELLIS.2 paints
panels), so the shape is painted by **Hunyuan3D-2.1's PBR paint** when
that's here too: `engines/hy3d21-setup.sh` makes env `hy3d21` with the
2.1 repo at `~/Hunyuan3D-2.1`, its rasterizer and renderer built, the
`hunyuan3d-paintpbr-v2-1` weights and the RealESRGAN upscaler it loads;
`generate.mjs` then runs the shape unpainted (`--white`) and
`engines/hunyuan_paint21.py` on it from the front picture (base colour,
metal, roughness at 4096).

### Pixal3D (for --faithful)

Five more GGUFs beside TRELLIS.2's, from
[vegax87/Pixal3D](https://huggingface.co/vegax87/Pixal3D):
`pixal3d_ss_flow pixal3d_shape_flow_512 pixal3d_shape_flow_1024 pixal3d_tex_flow_1024 pixal3d_naf` (`.gguf`).

### Blender (for bake.mjs)

A portable Blender 4.x unzipped under `%LOCALAPPDATA%\blender\` (winget's
copy works too; `$BLENDER` points at any other), or, when the Windows build
won't start (the 5.2 zip fails its side-by-side check on this machine), the
**Linux build in WSL**, which `bake.mjs` finds at `~/blender/blender-*/blender`
(`$BLENDER_WSL` for any other). A bare Ubuntu lacks two X libraries it links;
conda-forge has them:

```
mkdir -p ~/blender && cd ~/blender && curl -L https://mirrors.ocf.berkeley.edu/blender/release/Blender4.5/blender-4.5.9-linux-x64.tar.xz | tar xJ
source ~/miniforge3/bin/activate && conda create -y -n x11libs -c conda-forge xorg-libsm xorg-libice
```

Cycles bakes on the GPU either way (CUDA through WSL): the X-wing, 295k
faces to 24k with colour, roughness, metal and normal maps, in ten seconds.

### Concept images

`picture.mjs` runs [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp)
(the Windows CUDA 12 build, in `%LOCALAPPDATA%\sdcpp\bin`) with
Z-Image-Turbo: `models\z_image_turbo-Q8_0.gguf`
([leejet/Z-Image-Turbo-GGUF](https://huggingface.co/leejet/Z-Image-Turbo-GGUF)),
`models\Qwen3-4B-Instruct-2507-Q8_0.gguf` (unsloth) and `models\ae.safetensors`
(Comfy-Org/z_image_turbo). A good source image is most of a good model:
one object, front three-quarter view, plain white background, even light,
no text.

### The model's eyes (Qwen3-VL)

`vlm.mjs` gives the pipeline eyes: **Claude**, through Claude Code on this
machine (`claude -p`, on the owner's subscription, no API key: run `claude`
once and `/login`, since the desktop app's login doesn't reach the command
line), else Qwen3-VL-8B through llama.cpp's server, free and offline
(`GEN3D_JUDGE=qwen` forces it). Claude is the sharper judge; Qwen is good
enough to catch a wrong ship. Either way the pipeline can look: from a prompt, `make.mjs` draws four concept pictures and keeps the
one it scores most like the thing; after the cut, it scores the four-view
sheet out of 10 (`[name] verdict: …` in the log and the PR) and makes a
miss again once with the next seed. `--no-judge` skips it; `--candidates N`
draws more or fewer. Setup, under `%LOCALAPPDATA%\llamacpp`: `bin\` from
[llama.cpp's Windows CUDA 13 build](https://github.com/ggml-org/llama.cpp/releases)
(`llama-*-bin-win-cuda-13.4-x64.zip` and `cudart-*.zip`, unzipped
together), `models\Qwen3-VL-8B-Instruct-Q8_0.gguf` and `mmproj-F16.gguf`
from [unsloth/Qwen3-VL-8B-Instruct-GGUF](https://huggingface.co/unsloth/Qwen3-VL-8B-Instruct-GGUF).
`node scripts/gen3d/vlm.mjs judge "a TIE fighter" sheet.png` asks it by hand.

### Judging

`judge.mjs` renders through `scripts/glb-shot.mjs` (headless Chromium) and
a dev server serving the repository; on Windows:

```
CHROME="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" BASE=http://127.0.0.1:5299 node scripts/gen3d/judge.mjs out.png a.glb b.glb
```

The GPU is shared with `scripts/voices`: check `nvidia-smi` before a run.

Whether the judge still judges right is tested every night against a
labelled set of sheets (`scripts/ai-e2e/evals/vision.mjs`: 85% in band for
Claude, 70% for Qwen), and the pipeline makes one real X-wing from start to
end (`scripts/ai-e2e/real/health.mjs`), held to a blessed golden; on every
pull request it runs with fake engines (`GEN3D_ENGINE=fake`,
`GEN3D_JUDGE=fake`, …). `scripts/ai-e2e/README.md` has the tiers.

## What was learned making the X-wing

- **A model is only as right as its picture.** From a Z-Image-Turbo concept
  the X-wing came out sharp and wrong (engines on the fuselage): the image
  model didn't know the design. FLUX.1-schnell knows it; a real reference is
  better still. A **render of the model the site already had**, on white
  (`scripts/preview/glb-shot.html?…&bg=ffffff`, prepared with `prepare.mjs`),
  gave TRELLIS.2 the right shape and it added the detail: engine intakes, the
  canopy frame, panel lines, five times the triangles at the same budget.
- **Show the whole shape.** A near-frontal concept hid the fuselage length and
  the model came out squat. Three-quarter, from slightly above, nose visible.
- **Pixal3D assumes a frontal camera**: fed a three-quarter render it kept
  the shape but tilted it. Use it for photos taken facing the subject, with
  `--fov` when known; use plain TRELLIS.2 for renders and concept art.
- **Pixal3D lays its model along Z**, its top toward −Z and the picture's
  front toward +Y; `make.mjs` stands it up (`upright.mjs`) before the bake.
  Seventeen buildings made before that (the galaxy's worlds, October 2026)
  came out on their sides or as reliefs facing the sky. A still with its
  scene round it is also followed too closely: the sky and the ground came
  out as part of the mesh. Give it the subject alone on white.
- **Cut, don't crush.** The raw atlas is thousands of charts; meshopt's
  simplifier stops at the seams (~25k triangles for a 300k mesh) and crossing
  them smears the texture. 24k triangles at 1536² is under 900 KB and looks
  the part; the Blender bake is the way below that.
- **Remakes help fighters, not greebled hulls.** From its own render a
  TIE interceptor or an X-wing comes back with real panel detail; a Star
  Destroyer or a Venator comes back a smooth blob with its greebles gone,
  worse than the Sketchfab original. Big-feature shapes only, and judge the
  sheet before replacing anything.
- **Both engines, in order of use:** `trelliscpp` (f16 GGUF, ~2–4 minutes a
  model at res 1024 on the RTX 5090) does everything here. The reference
  `trellis2` is built in WSL but its image encoder (`facebook/dinov3`) is a
  gated Hugging Face repo: accept the licence and `hf auth login` in the
  `trellis2` conda env, and `--engine trellis2` works, with
  `decimation_target` baking straight onto a low mesh.
