"""
Точка входа для PyInstaller (Windows exe License Admin).

Сборка (из каталога license-admin на машине с Windows):
  cd ui && npm ci && npm run build && cd ..
  pip install -e ../backend
  pip install -e ".[windows-exe]"
  pyinstaller --noconfirm license_admin.spec
"""

from __future__ import annotations

from license_admin.desktop_runtime import apply_desktop_environment_if_frozen, run_desktop


def main() -> None:
    apply_desktop_environment_if_frozen()
    run_desktop()


if __name__ == "__main__":
    main()
