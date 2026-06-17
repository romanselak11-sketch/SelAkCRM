from __future__ import annotations

from typing import Any


def _payload_record(payload: Any) -> dict[str, Any]:
    if payload is None or not isinstance(payload, dict):
        return {}
    return payload


def _str(v: Any) -> str | None:
    return v if isinstance(v, str) else None


def _bool(v: Any) -> bool | None:
    return v if isinstance(v, bool) else None


ROLE_RU: dict[str, str] = {
    "SUPER_ADMIN": "супер-админ",
    "SUPER_MANAGER": "супер-менеджер",
    "MANAGER": "менеджер",
}

POLICY_FIELDS: dict[str, str] = {
    "number": "номер",
    "category": "категория",
    "source": "источник",
    "insuranceSumS": "страховая сумма",
    "premiumPercent": "комиссия, %",
    "premiumRubles": "премия, ₽",
    "endDate": "дата окончания полиса",
    "startDate": "дата начала",
    "termDays": "срок, дней",
}

CLIENT_FIELDS: dict[str, str] = {
    "lastName": "фамилия",
    "firstName": "имя",
    "middleName": "отчество",
    "phone": "телефон",
    "email": "email",
    "documentsUrl": "ссылка на документы",
}

USER_FIELDS: dict[str, str] = {
    "role": "роль",
    "isActive": "активность",
    "password": "пароль",
}


def _role_ru(role: Any) -> str:
    r = str(role or "")
    return ROLE_RU.get(r, r)


def _fields_ru(payload: dict[str, Any], key: str, labels: dict[str, str]) -> str:
    raw = payload.get(key)
    if not isinstance(raw, list):
        return ""
    parts = [labels.get(str(f), str(f)) for f in raw if isinstance(f, str)]
    if not parts:
        return ""
    return f" Изменены поля: {', '.join(parts)}."


def _actor_phrase(user_login: str | None) -> str:
    if user_login:
        return f"Пользователь «{user_login}»"
    return "Система"


def describe_audit_event(
    *,
    action: str,
    entity_type: str,
    entity_id: str | None,
    payload: Any,
    user_login: str | None,
) -> str:
    actor = _actor_phrase(user_login)
    p = _payload_record(payload)

    if action == "LOGIN_SUCCESS":
        return f"{actor} успешно аутентифицирован."
    if action == "LOGIN_FAILED":
        login = entity_id or "—"
        ip = _str(p.get("ip"))
        return f"Неудачная попытка входа (логин: «{login}»){f', IP: {ip}' if ip else ''}."
    if action == "USER_CREATE":
        login = _str(p.get("login")) or entity_id or "—"
        role = _role_ru(p.get("role"))
        return f"{actor} создал пользователя «{login}» с ролью «{role}»."
    if action == "USER_UPDATE":
        extra = _fields_ru(p, "fields", USER_FIELDS)
        return f"{actor} изменил данные пользователя.{extra}"
    if action == "USER_PASSWORD_SET_BY_ADMIN":
        return f"{actor} задал новый пароль другому пользователю (учётная запись по ссылке в журнале)."
    if action == "USER_ARCHIVE":
        login = _str(p.get("login")) or "—"
        return f"{actor} удалил из системы пользователя «{login}»."
    if action == "USER_RESTORE":
        return f"{actor} восстановил пользователя в системе."

    if action == "CLIENT_CREATE":
        ln = _str(p.get("lastName")) or ""
        fn = _str(p.get("firstName")) or ""
        name = " ".join(x for x in (ln, fn) if x).strip() or "без имени в журнале"
        return f"{actor} добавил клиента: {name}."
    if action == "CLIENT_UPDATE":
        extra = _fields_ru(p, "fields", CLIENT_FIELDS)
        return f"{actor} изменил карточку клиента.{extra}"
    if action == "CLIENT_ARCHIVE":
        return f"{actor} архивировал клиента."
    if action == "CLIENT_RESTORE":
        return f"{actor} восстановил клиента из архива."

    if action == "COMPANY_CREATE":
        name = _str(p.get("name")) or "—"
        return f"{actor} добавил страховую компанию «{name}»."
    if action == "COMPANY_UPDATE":
        name = _str(p.get("name")) or "—"
        return f"{actor} изменил страховую компанию (новое название: «{name}»)."
    if action == "COMPANY_ARCHIVE":
        return f"{actor} архивировал страховую компанию."
    if action == "COMPANY_RESTORE":
        return f"{actor} восстановил страховую компанию из архива."

    if action == "PRODUCT_CREATE":
        name = _str(p.get("name")) or "—"
        return f"{actor} добавил продукт «{name}» для компании."
    if action == "PRODUCT_UPDATE":
        product_fields = {
            "name": "название",
            "category": "категория",
            "defaultPremiumPct": "комиссия по умолчанию, %",
        }
        extra = _fields_ru(p, "fields", product_fields)
        return f"{actor} изменил страховой продукт.{extra}"
    if action == "PRODUCT_ARCHIVE":
        return f"{actor} архивировал страховой продукт."
    if action == "PRODUCT_RESTORE":
        return f"{actor} восстановил страховой продукт из архива."

    if action == "POLICY_CREATE":
        num = _str(p.get("number")) or "—"
        from_home = _bool(p.get("fromHome"))
        suffix = " (оформление с главной страницы)." if from_home else "."
        return f"{actor} создал полис № {num}{suffix}"
    if action == "POLICY_UPDATE":
        extra = _fields_ru(p, "fields", POLICY_FIELDS)
        return f"{actor} изменил полис.{extra}"
    if action == "POLICY_ARCHIVE":
        return f"{actor} отправил полис в архив."
    if action == "POLICY_RESTORE":
        return f"{actor} восстановил полис из архива."

    if action == "RENEWAL_DECLINED":
        reason = _str(p.get("reason")) or ""
        hint = ""
        if reason:
            hint = f" Причина: {reason[:120]}{'…' if len(reason) > 120 else ''}"
        return f"{actor} отметил отказ клиента от продления по задаче продления.{hint}"
    if action == "RENEWAL_POSTPONED":
        mode = _str(p.get("mode"))
        m = "ожидание обратной связи" if mode == "feedback" else "отсрочка"
        comment = _str(p.get("comment")) or ""
        hint = ""
        if comment:
            hint = f" Комментарий: {comment[:120]}{'…' if len(comment) > 120 else ''}"
        return f"{actor} отложил задачу продления ({m}).{hint}"
    if action == "RENEWAL_RENEWED":
        new_id = _str(p.get("newPolicyId"))
        tail = f" (новый полис id: {new_id})" if new_id else ""
        return f"{actor} оформил продление полиса{tail}."

    eid = f", id: {entity_id}" if entity_id else ""
    return f"{actor}: действие «{action}» ({entity_type}{eid})."
