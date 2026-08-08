# Build SelakCRM.exe (run on Windows via PowerShell or build_windows_exe.cmd).
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$root = Split-Path -Parent $backendDir
Set-Location $root

Push-Location frontend
npm ci
npm run build
Pop-Location

Push-Location backend
python -m pip install -e ".[windows-exe]"
if (-not (Test-Path "../frontend/dist/index.html")) {
    Write-Error "Missing frontend/dist - run frontend build first."
}
pyinstaller --noconfirm selakcrm.spec
Write-Host "Done: backend/dist/SelakCRM.exe"
Pop-Location
