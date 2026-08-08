#!/usr/bin/env python3
"""Запуск License Admin API: uvicorn на 127.0.0.1:8766."""

from __future__ import annotations

import uvicorn


def main() -> None:
    uvicorn.run("license_admin.app:app", host="127.0.0.1", port=8766, reload=False)


if __name__ == "__main__":
    main()
