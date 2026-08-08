# -*- mode: python ; coding: utf-8 -*-
# Запускать из каталога license-admin на Windows после: npm run build в ui/
import sys
from pathlib import Path

block_cipher = None
admin_dir = Path(SPECPATH).resolve()
api_dir = admin_dir / "api"
ui_dist = admin_dir / "ui" / "dist"
backend_dir = admin_dir.parent / "backend"
icon_path = backend_dir / "assets" / "selak.ico"

datas = []
if icon_path.is_file():
    datas.append((str(icon_path), "assets"))
if ui_dist.is_dir() and (ui_dist / "index.html").is_file():
    datas.append((str(ui_dist), "frontend_dist"))
else:
    print(
        "WARNING: ui/dist не найден — соберите UI: cd ui && npm ci && npm run build",
        file=sys.stderr,
    )

a = Analysis(
    [str(api_dir / "desktop_entry.py")],
    pathex=[str(api_dir), str(backend_dir)],
    binaries=[],
    datas=datas,
    hiddenimports=[
        "license_admin.app",
        "license_admin.service",
        "license_admin.paths",
        "license_admin.ledger",
        "license_admin.desktop_runtime",
        "selakcrm.licensing",
        "selakcrm.licensing.activation_code",
        "selakcrm.licensing.crypto",
        "selakcrm.licensing.keys",
        "selakcrm.time_utils",
        "pystray._win32",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.loops.auto",
        "uvicorn.logging",
        "cryptography.hazmat.primitives.kdf.pbkdf2",
        "cryptography.fernet",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="SelakCRM-LicenseAdmin",
    icon=str(icon_path) if icon_path.is_file() else None,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
