"""Каталог прав ролей и матрица по умолчанию (текущее поведение до настройки админом)."""

from __future__ import annotations

from typing import Iterable

# Ключи, которые админ может выдавать SUPER_MANAGER / MANAGER.
PERMISSION_CATALOG: list[dict[str, str]] = [
    {"key": "nav.home", "label": "Раздел: Главная", "group": "sections"},
    {"key": "nav.tasks", "label": "Раздел: Задачи", "group": "sections"},
    {"key": "nav.companies", "label": "Раздел: Компании", "group": "sections"},
    {"key": "nav.clients", "label": "Раздел: Клиенты", "group": "sections"},
    {"key": "nav.policies", "label": "Раздел: Полисы", "group": "sections"},
    {"key": "nav.analytics", "label": "Раздел: Аналитика", "group": "sections"},
    {"key": "nav.settings", "label": "Раздел: Настройки", "group": "sections"},
    {"key": "insurance.write", "label": "Редактирование компаний и продуктов", "group": "functions"},
    {"key": "clients.write", "label": "Создание и редактирование клиентов", "group": "functions"},
    {"key": "clients.view_policies", "label": "Полисы клиента", "group": "functions"},
    {"key": "policies.create", "label": "Создание полисов", "group": "functions"},
    {"key": "policies.edit", "label": "Редактирование полисов", "group": "functions"},
    {"key": "tasks.create", "label": "Создание задач продления", "group": "functions"},
    {"key": "tasks.act", "label": "Работа с задачами продления", "group": "functions"},
    {"key": "tasks.edit_policy", "label": "Редактирование полиса из задачи", "group": "functions"},
    {"key": "audit.read", "label": "Журнал аудита", "group": "functions"},
    {"key": "users.manage", "label": "Управление пользователями", "group": "functions"},
]

# Только SUPER_ADMIN; в редакторе ролей не показывается.
ADMIN_ONLY_PERMISSIONS: tuple[str, ...] = ("settings.role_permissions",)

EDITABLE_PERMISSION_KEYS: frozenset[str] = frozenset(p["key"] for p in PERMISSION_CATALOG)

ALL_PERMISSION_KEYS: frozenset[str] = EDITABLE_PERMISSION_KEYS | frozenset(ADMIN_ONLY_PERMISSIONS)

CONFIGURABLE_ROLES: tuple[str, ...] = ("SUPER_MANAGER", "MANAGER")

LOCKED_ROLE = "SUPER_ADMIN"

DEFAULT_ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "SUPER_MANAGER": frozenset(
        {
            "nav.home",
            "nav.tasks",
            "nav.companies",
            "nav.clients",
            "nav.policies",
            "nav.settings",
            "insurance.write",
            "clients.write",
            "clients.view_policies",
            "policies.create",
            "policies.edit",
            "tasks.create",
            "tasks.act",
            "tasks.edit_policy",
        }
    ),
    "MANAGER": frozenset(
        {
            "nav.home",
            "nav.tasks",
            "policies.create",
            "tasks.create",
            "tasks.act",
        }
    ),
}


def all_permissions_for_admin() -> list[str]:
    return sorted(ALL_PERMISSION_KEYS)


def default_permissions_for_role(role: str) -> list[str]:
    if role == LOCKED_ROLE:
        return all_permissions_for_admin()
    defaults = DEFAULT_ROLE_PERMISSIONS.get(role)
    if defaults is None:
        return []
    return sorted(defaults)


def normalize_permission_list(keys: Iterable[str]) -> list[str]:
    """Оставляет только известные редактируемые ключи, без дублей, в стабильном порядке."""
    wanted = set(keys) & EDITABLE_PERMISSION_KEYS
    order = [p["key"] for p in PERMISSION_CATALOG]
    return [k for k in order if k in wanted]


def catalog_for_api() -> list[dict[str, str]]:
    return [dict(p) for p in PERMISSION_CATALOG]
