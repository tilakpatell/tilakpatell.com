<#
The two VP6 movie textures in the Battlefront II (2017) export that the space
layer can use (lane Q of the fifth design: docs/superpowers/specs/2026-10-10-
bf2017-every-asset-design.md), made WebM (VP9) on the owner's desktop, where
the export and ffmpeg are: a capital ship's destruction and the second Death
Star's end. The third VP6, Starkiller Base's, is the sequel era's and is left
out by the standing rule.

  powershell -ExecutionPolicy Bypass -File scripts\desktop\bf2017-vp6.ps1
  powershell -ExecutionPolicy Bypass -File scripts\desktop\bf2017-vp6.ps1 -Export D:\BF2_Extract\web_opt

It finds each VP6 under the export by its name, writes
public\models\galaxy\space\film\<name>.webm in the repository (muted, VP9 at
2 Mbit/s, the game's size and rate), and says what to run next: publish them
(node scripts\assets-publish.mjs, which walks that folder) and set
`published: true` on their rows in src\components\galaxy\capitalFilm.js, so
galaxy/capitalFilm.js's videoLook stops answering null for them.
#>
param(
  [string]$Export = "$HOME\Downloads\BF2_Extract\web_opt",
  [string]$Out = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'public\models\galaxy\space\film')
)

$ErrorActionPreference = 'Continue'
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host 'ffmpeg is not on PATH: winget install Gyan.FFmpeg, then open a new window.'
  exit 1
}
if (-not (Test-Path $Export)) {
  Write-Host "No export at $Export (pass -Export <the web_opt folder>)."
  exit 1
}
New-Item -ItemType Directory -Force -Path $Out | Out-Null

# the VP6 by its name in the export, and the site's name for the WebM
$films = @(
  @{ Vp6 = 'MT_CapitalShipDestruction.vp6'; Webm = 'capital-death.webm' },
  @{ Vp6 = 'deathStarII_event010_mainExplosion_v003.vp6'; Webm = 'deathstar-end.webm' }
)
$made = 0
foreach ($f in $films) {
  $src = Get-ChildItem -Path $Export -Recurse -Filter $f.Vp6 -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $src) {
    Write-Host "$($f.Vp6): not in the export"
    continue
  }
  $dst = Join-Path $Out $f.Webm
  & ffmpeg -y -hide_banner -loglevel error -i $src.FullName -an -c:v libvpx-vp9 -b:v 2M $dst
  if ($LASTEXITCODE -eq 0 -and (Test-Path $dst)) {
    $kb = [math]::Round((Get-Item $dst).Length / 1KB)
    Write-Host "$($f.Webm)  $kb KB  <- $($src.FullName)"
    $made++
  } else {
    Write-Host "$($f.Vp6): ffmpeg failed ($LASTEXITCODE)"
  }
}
Write-Host ''
Write-Host "$made of $($films.Count) made. Then: node scripts\assets-publish.mjs; node scripts\assets-check.mjs;"
Write-Host 'set published: true on their rows in src\components\galaxy\capitalFilm.js, and commit the manifest, .gitignore and that file.'
