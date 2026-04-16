"""
Точка входа для PyInstaller (Windows exe).

Сборка (из каталога backend на машине с Windows):
  cd ..\\frontend && npm run build && cd ..\\backend
  pip install -e ".[windows-exe]"
  pyinstaller selakcrm.spec
"""

from selakcrm.desktop_runtime import apply_desktop_environment_if_frozen, run_desktop_uvicorn


def main() -> None:
    apply_desktop_environment_if_frozen()
    run_desktop_uvicorn()


if __name__ == "__main__":
    main()
