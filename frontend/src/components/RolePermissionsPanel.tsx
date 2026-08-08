import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Btn } from './Btn';
import { EmptyHint } from './EmptyHint';
import { FormActions, FormError } from './FormActions';
import { Stack } from './Stack';
import { Switch } from './Switch';

type CatalogItem = { key: string; label: string; group: string };

type MatrixResponse = {
  catalog: CatalogItem[];
  configurableRoles: string[];
  lockedRole: string;
  roles: Record<string, string[]>;
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_MANAGER: 'Супер-менеджер',
  MANAGER: 'Менеджер',
  SUPER_ADMIN: 'Супер-админ',
};

const GROUP_LABELS: Record<string, string> = {
  sections: 'Разделы',
  functions: 'Функции',
};

type RolePermissionsPanelProps = {
  onSaved?: () => void;
};

export function RolePermissionsPanel({ onSaved }: RolePermissionsPanelProps) {
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null);
  const [role, setRole] = useState<string>('MANAGER');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api<MatrixResponse>('/role-permissions')
      .then((m) => {
        if (cancelled) return;
        setMatrix(m);
        const initialRole = m.configurableRoles.includes('MANAGER')
          ? 'MANAGER'
          : (m.configurableRoles[0] ?? 'MANAGER');
        setRole(initialRole);
        setSelected(new Set(m.roles[initialRole] ?? []));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setErr('Не удалось загрузить права ролей');
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const baseline = useMemo(() => {
    if (!matrix) return new Set<string>();
    return new Set(matrix.roles[role] ?? []);
  }, [matrix, role]);

  const dirty = useMemo(() => {
    if (selected.size !== baseline.size) return true;
    for (const k of selected) {
      if (!baseline.has(k)) return true;
    }
    return false;
  }, [selected, baseline]);

  function selectRole(next: string) {
    if (!matrix) return;
    setRole(next);
    setSelected(new Set(matrix.roles[next] ?? []));
    setErr(null);
  }

  function toggle(key: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function save() {
    if (!matrix || !dirty) return;
    setSaving(true);
    setErr(null);
    try {
      const updated = await api<MatrixResponse>('/role-permissions', {
        method: 'PUT',
        body: JSON.stringify({ role, permissions: [...selected] }),
      });
      setMatrix(updated);
      setSelected(new Set(updated.roles[role] ?? []));
      onSaved?.();
    } catch {
      setErr('Не удалось сохранить права');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <EmptyHint variant="panel">Загрузка…</EmptyHint>;
  }

  if (!matrix) {
    return <FormError>{err}</FormError>;
  }

  const byGroup = matrix.catalog.reduce<Record<string, CatalogItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="role-perm">
      <p className="field-hint role-perm__intro">
        Доступ для супер-менеджера и менеджера. Супер-админ всегда с полным доступом.
      </p>
      <FormError>{err}</FormError>
      <Stack direction="row" gap={2} wrap className="role-perm__roles" role="tablist" aria-label="Роль">
        {matrix.configurableRoles.map((r) => (
          <Btn
            key={r}
            role="tab"
            aria-selected={role === r}
            variant="ghost"
            size="sm"
            pill
            softActive={role === r}
            onClick={() => selectRole(r)}
          >
            {ROLE_LABELS[r] ?? r}
          </Btn>
        ))}
      </Stack>

      <div className="role-perm__groups">
        {Object.entries(byGroup).map(([group, items]) => (
          <section key={group} className="role-perm__group" aria-labelledby={`role-perm-g-${group}`}>
            <h3 id={`role-perm-g-${group}`} className="role-perm__group-title">
              {GROUP_LABELS[group] ?? group}
            </h3>
            <ul className="role-perm__list">
              {items.map((item) => {
                const on = selected.has(item.key);
                return (
                  <li key={item.key} className="role-perm__row">
                    <Switch
                      id={`perm-${role}-${item.key}`}
                      label={item.label}
                      checked={on}
                      onChange={(e) => toggle(item.key, e.target.checked)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <FormActions>
        <Btn variant="primary" disabled={saving || !dirty} onClick={() => void save()}>
          Сохранить
        </Btn>
      </FormActions>
    </div>
  );
}
