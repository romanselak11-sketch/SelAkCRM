# -*- mode: python ; coding: utf-8 -*-
# Запускать из каталога backend на Windows после: npm run build в ../frontend
import sys
from pathlib import Path

block_cipher = None
backend_dir = Path(SPECPATH).resolve()
frontend_dist = backend_dir.parent / "frontend" / "dist"

datas = [
    (str(backend_dir / "alembic"), "alembic"),
    (str(backend_dir / "alembic.ini"), "."),
    (str(backend_dir / "assets" / "selak.ico"), "assets"),
    (str(backend_dir / "selakcrm" / "licensing" / "public.pem"), "selakcrm/licensing"),
    (str(backend_dir / "selakcrm" / "licensing" / "public_next.pem"), "selakcrm/licensing"),
]
if frontend_dist.is_dir() and (frontend_dist / "index.html").is_file():
    datas.append((str(frontend_dist), "frontend_dist"))
else:
    print("WARNING: ../frontend/dist не найден — соберите фронт: cd frontend && npm run build", file=sys.stderr)

a = Analysis(
    ["desktop_entry.py"],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=datas,
    hiddenimports=[
        "selakcrm.main",
        "pystray._win32",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.loops.auto",
        "uvicorn.logging",
        "sqlalchemy.dialects.sqlite",
        "sqlalchemy.sql.default_comparator",
        "apscheduler.schedulers.background",
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
    name="SelakCRM",
    icon=str(backend_dir / "assets" / "selak.ico"),
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
