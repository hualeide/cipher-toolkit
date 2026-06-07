# Build Windows single-file exe (Node 22+, run on Windows)
# Usage: .\scripts\build-win.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host ''
Write-Host '=== Cipher Toolkit - Windows exe build ===' -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js 22+ required: https://nodejs.org/' -ForegroundColor Red
  exit 1
}

Write-Host '[1/3] Build frontend...'
npm run build --prefix frontend
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '[2/3] Backend deps...'
if (-not (Test-Path 'backend/node_modules/sharp')) {
  npm install --prefix backend --omit=dev
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host '  Using existing backend/node_modules (stop running app if build fails)'
}

New-Item -ItemType Directory -Force -Path release | Out-Null
if (Test-Path 'release/CipherToolkit.exe') { Remove-Item 'release/CipherToolkit.exe' -Force }

Write-Host '[3/3] Package exe with caxa (1-3 min, ~80-120 MB)...'
$exePath = 'release/CipherToolkit.exe'
& npx --yes caxa@3 `
  --input backend `
  --input frontend/dist `
  --input docs `
  --input scripts `
  --output $exePath `
  -- "{{caxaNodeModulePath}}" "scripts/desktop-launcher.mjs"

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Copy-Item scripts/CipherToolkit.cmd release/CipherToolkit.cmd -Force
$zipPath = 'release/CipherToolkit-win64.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path release/CipherToolkit.exe, release/CipherToolkit.cmd -DestinationPath $zipPath

Write-Host ''
Write-Host "Done:" -ForegroundColor Green
Write-Host "  $(Resolve-Path $exePath)"
Write-Host "  $(Resolve-Path release/CipherToolkit.cmd)  (recommended: visible console)"
Write-Host "  $(Resolve-Path $zipPath)  (for GitHub Release)"
Write-Host 'Double-click .cmd or .exe — browser opens automatically. Close console to stop.'
Write-Host ''
