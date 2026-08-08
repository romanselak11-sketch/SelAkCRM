# Build SelakCRM-LicenseAdmin.exe (run on Windows via PowerShell or build_windows_exe.cmd).
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$adminDir = Split-Path -Parent $scriptDir
$root = Split-Path -Parent $adminDir
Set-Location $adminDir

Push-Location ui
npm ci
npm run build
Pop-Location

if (-not (Test-Path "ui/dist/index.html")) {
    Write-Error "Missing ui/dist - run UI build first."
}

python -m pip install -e "$root\backend"
python -m pip install -e ".[windows-exe]"
pyinstaller --noconfirm license_admin.spec
Write-Host "Done: license-admin/dist/SelakCRM-LicenseAdmin.exe"
