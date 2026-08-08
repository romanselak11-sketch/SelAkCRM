# SelAkCRM License Admin

Консоль вендора: выпуск ключей и выдача кодов активации. Всё хранится локально, публиковать и коммитить ничего не нужно.

## Запуск

```bash
# API
cd backend && source .venv/bin/activate
pip install -e .            # selakcrm в editable-режиме
pip install -e ../license-admin
cd ../license-admin/api
PYTHONPATH=. python run.py

# UI (другой терминал)
cd license-admin/ui
npm install
npm run dev
```

Откройте http://127.0.0.1:5174 — пароль vault задаётся при первом входе.

## Порядок выдачи лицензии

1. **Ключи** → число устройств → «Сгенерировать». Скопируйте полный ключ и передайте клиенту.
2. Клиент вводит ключ в CRM и присылает **код запроса** (`SAKREQ-…`).
3. **Активация** → вставьте код запроса → «Выдать код активации».
4. Отправьте клиенту **код активации** (`SAKACT-…`). Он вставляет его — готово.

## Где лежат файлы

| Путь | Назначение |
|------|------------|
| `license-admin/keys/private.pem` | Приватный ключ подписи (**не в Git**) |
| `license-admin/keys/public.pem` | Публичный ключ (+ копия в `backend/selakcrm/licensing/public.pem`) |
| `license-admin/data/` | Vault с полными ключами, список устройств, журнал (**не в Git**) |

Обе позиции без Git обязательно держите в офлайн-бэкапе: без них новые активации невозможны.

## Что важно понимать

- Код активации привязан к компьютеру и **бессрочен**.
- Лимит устройств соблюдается здесь: сверх `max_seats` код не выдаётся.
- «Отозвать» запрещает новые активации, но не отключает уже работающие копии.

Подробности схемы — в [docs/licensing.md](../docs/licensing.md).

## Сборка Windows exe

На машине с Windows откройте **cmd** или **PowerShell** и выполните одно из:

```bat
cd /d D:\SelAkCRM\license-admin
scripts\build_windows_exe.cmd
```

```powershell
cd D:\SelAkCRM\license-admin
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build_windows_exe.ps1
```

Можно просто двойным щелчком запустить `license-admin\scripts\build_windows_exe.cmd`.

Или вручную:

```powershell
cd D:\SelAkCRM\license-admin\ui
npm ci
npm run build

cd D:\SelAkCRM\license-admin
python -m pip install -e ..\backend
python -m pip install -e ".[windows-exe]"
pyinstaller --noconfirm license_admin.spec
```

Результат: `license-admin/dist/SelakCRM-LicenseAdmin.exe`.

Данные вендора (vault, ключи) пишутся в `%LOCALAPPDATA%\SelakCRM-LicenseAdmin\` — не в каталог exe. Копия `public.pem` для сборки CRM-клиента: `%LOCALAPPDATA%\SelakCRM-LicenseAdmin\backend\selakcrm\licensing\public.pem`.

## Стиль

UI переиспользует компоненты и токены CRM через Vite alias `@crm` → `frontend/src`.
