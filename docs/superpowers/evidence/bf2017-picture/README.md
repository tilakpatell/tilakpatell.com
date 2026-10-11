# Evidence: the picture everywhere (2026-10-11)

The design: `docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md`. One folder a lane that writes here.

| where | what | written by |
| --- | --- | --- |
| `w/DRY.md` | every desktop job’s plan from a cloud session: what each would make and what the cloud lacks of what it needs | lane W, by hand from the dry runs |
| `w/atlases/FORMAT.md` | the Enlighten atlases’ maps, formats and sizes, and what the bucket gets, for lane Q3 | lane W |
| `w/<job>/README.md` | a desktop run’s plan, checks and report (the pull request’s body) | `scripts/desktop/bf2017-<job>.mjs` on the desktop |
| `w/panoramas/made.json` | each HDR sky: size, bytes, its brightest texel (`peak`), the bucket’s and the site’s paths | the `panoramas` job |
| `w/atlases/made.json` | the atlases sent, those that failed, the HDR irradiance and its peaks | the `atlases` job |
| `w/textures/made.json` | the not-uploaded textures sent, those that failed, those with no file | the `textures` job |
| `w/uastc/psnr.json` | each colour map’s PSNR as UASTC and as the served ETC1S against the BC7 master, and whether it was kept | the `uastc` job |
| `w/depots/share.json` | the depots’ resolved share, of all and of the entries left when the per-block constants are set apart | the `depots` job |
| `gate/<date>.json`, `gate/shots/` | every world at ultra on the desktop’s chip, both legs: p50, p95, calls, triangles, MB, the backend, a shot a world | the `gate` job |

Every JSON here carries its own `_source`.
