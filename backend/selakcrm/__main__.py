"""Запуск: ``python -m selakcrm`` — в разработке API на PORT (по умолчанию 3000)."""

from __future__ import annotations

import os
import sys


def main() -> None:
    from selakcrm.desktop_runtime import apply_desktop_environment_if_frozen, run_desktop_uvicorn

    apply_desktop_environment_if_frozen()
    if getattr(sys, "frozen", False):
        run_desktop_uvicorn()
        return
    import uvicorn

    port = int(os.environ.get("PORT", "3000"))
    uvicorn.run("selakcrm.main:app", host="127.0.0.1", port=port, reload=False, log_level="info")


if __name__ == "__main__":
    main()
