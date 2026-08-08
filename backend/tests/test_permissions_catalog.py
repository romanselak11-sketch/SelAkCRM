from selakcrm.permissions import (
    LOCKED_ROLE,
    default_permissions_for_role,
    normalize_permission_list,
)


def test_admin_defaults_include_locked_keys():
    perms = default_permissions_for_role(LOCKED_ROLE)
    assert "settings.role_permissions" in perms
    assert "users.manage" in perms
    assert "nav.analytics" in perms


def test_normalize_drops_unknown_and_admin_only():
    out = normalize_permission_list(
        ["nav.home", "settings.role_permissions", "nope", "nav.home", "tasks.act"]
    )
    assert out == ["nav.home", "tasks.act"]


def test_manager_defaults_are_narrow():
    perms = set(default_permissions_for_role("MANAGER"))
    assert perms == {
        "nav.home",
        "nav.tasks",
        "policies.create",
        "tasks.create",
        "tasks.act",
    }
