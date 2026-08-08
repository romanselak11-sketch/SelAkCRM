# Ключи подписи кодов активации

- `public.pem` — можно держать в репо / копируется в `backend/selakcrm/licensing/public.pem`
- `private.pem` — **секрет**, в `.gitignore`

Генерируются при первом входе в License Admin. Без `private.pem` выдать код активации невозможно — держите офлайн-копию.
