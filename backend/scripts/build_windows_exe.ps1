# Сборка SelakCRM.exe (запускать в PowerShell на Windows).
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
    Write-Error "Нет frontend/dist — проверьте сборку фронта."
}
pyinstaller --noconfirm selakcrm.spec
Write-Host "Готово: backend/dist/SelakCRM.exe"
Pop-Location
