import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ListPaginationFooter } from '../components/ListPaginationFooter';
import { Badge } from '../components/Badge';
import { Btn } from '../components/Btn';
import { Card, CardHeader } from '../components/Card';
import {
  DataTable,
  DataTableActionCell,
  DataTableBody,
  DataTableEmpty,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from '../components/DataTable';
import { EmptyHint } from '../components/EmptyHint';
import { FormActions, FormError } from '../components/FormActions';
import { AuditLog, AuditLogItem } from '../components/AuditLog';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { FieldLabel } from '../components/FieldLabel';
import { RolePermissionsPanel } from '../components/RolePermissionsPanel';
import { ScrollableChoiceList } from '../components/ScrollableChoiceList';
import { Stack } from '../components/Stack';
import { Switch } from '../components/Switch';
import { ValidatedInput } from '../components/ValidatedInput';
import { hasPermission } from '../domain/permissions';
import { CopyRow } from '../licensing/CopyRow';
import { formatRemaining } from '../licensing/formatRemaining';
import { LicenseActivation } from '../licensing/LicenseActivation';
import { useLicenseStatus, type LicenseStatusDto } from '../licensing/useLicenseStatus';
import { setDocumentTitle } from '../utils/documentTitle';
import {
  DEFAULT_LIST_PAGE_SIZE,
  type ListPageSize,
  type Paginated,
} from '../utils/listPagination';

type UserRow = { id: string; login: string; role: string; isActive: boolean };

type RoleOpt = 'SUPER_ADMIN' | 'SUPER_MANAGER' | 'MANAGER';

type AdminTab = 'users' | 'roles';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Супер-админ',
  SUPER_MANAGER: 'Супер-менеджер',
  MANAGER: 'Менеджер',
};

const CREATE_ROLE_OPTIONS = [
  { value: 'MANAGER', label: 'Менеджер' },
  { value: 'SUPER_MANAGER', label: 'Супер-менеджер' },
] as const;

const EDIT_ROLE_OPTIONS = [
  { value: 'MANAGER', label: 'Менеджер' },
  { value: 'SUPER_MANAGER', label: 'Супер-менеджер' },
  { value: 'SUPER_ADMIN', label: 'Супер-админ' },
] as const;

function roleLabel(code: string): string {
  return ROLE_LABELS[code] ?? code;
}

type AuditEv = {
  id: string;
  action: string;
  createdAt: string;
  descriptionRu?: string;
};

type AuditEventsPage = Paginated<AuditEv>;

type AuditJournalSectionProps = {
  selDay: string;
  auditLimit: ListPageSize;
  onAuditLimitChange: (l: ListPageSize) => void;
};

function AuditJournalSection({ selDay, auditLimit, onAuditLimitChange }: AuditJournalSectionProps) {
  const [auditPage, setAuditPage] = useState(1);
  const [auditEvents, setAuditEvents] = useState<AuditEv[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);

  useEffect(() => {
    const q = new URLSearchParams({
      date: selDay,
      page: String(auditPage),
      limit: String(auditLimit),
    }).toString();
    void api<AuditEventsPage>(`/audit/events?${q}`).then((res) => {
      setAuditEvents(res.items);
      setAuditTotal(res.total);
      const totalPages = Math.max(1, Math.ceil(res.total / res.limit));
      if (res.page > totalPages) {
        setAuditPage(totalPages);
      }
    });
  }, [selDay, auditPage, auditLimit]);

  return (
    <>
      {auditTotal === 0 ? (
        <EmptyHint variant="panel">Нет записей за этот день.</EmptyHint>
      ) : (
        <AuditLog>
          {auditEvents.map((ev) => (
            <AuditLogItem
              key={ev.id}
              dateTime={ev.createdAt}
              timeLabel={ev.createdAt.slice(0, 19).replace('T', ' ')}
            >
              {ev.descriptionRu ?? ev.action}
            </AuditLogItem>
          ))}
        </AuditLog>
      )}
      <ListPaginationFooter
        total={auditTotal}
        page={auditPage}
        limit={auditLimit}
        onPageChange={setAuditPage}
        onLimitChange={(l) => {
          onAuditLimitChange(l);
          setAuditPage(1);
        }}
        navAriaLabel="Страницы журнала аудита"
      />
    </>
  );
}

function LicenseSettingsSection() {
  const { me } = useAuth();
  const license = useLicenseStatus();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function deactivate() {
    if (
      !window.confirm(
        'Снять лицензию с этого компьютера? Демо-режим не вернётся — потребуется новый ключ.',
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      await api<LicenseStatusDto>('/license/deactivate', { method: 'POST' });
      await license.refetch();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Не удалось снять лицензию');
    } finally {
      setBusy(false);
    }
  }

  const activated = license.status === 'full';
  const statusLabel =
    license.status === 'demo'
      ? `Демо${license.remainingSeconds != null ? ` · ${formatRemaining(license.remainingSeconds)}` : ''}`
      : activated
        ? 'Активна'
        : license.status === 'pending_activation'
          ? 'Ждёт код активации'
          : 'Доступ закрыт';

  return (
    <Card>
      <CardHeader
        title="Лицензия"
        actions={<Badge variant={activated ? 'accent' : 'default'}>{statusLabel}</Badge>}
      />
      <Stack gap={3}>
        {activated ? null : (
          <LicenseActivation
            status={license.status}
            requestCode={license.requestCode}
            onChanged={() => void license.refetch()}
          />
        )}
        <CopyRow
          label="Отпечаток компьютера"
          value={license.hwid || '—'}
          hint="Понадобится поставщику, если нужно освободить место под другой компьютер."
        />
        <Stack direction="row" gap={3} align="center" justify="between" wrap>
          <span className="page-sub">Версия {license.productVersion || '—'}</span>
          {activated && me?.role === 'SUPER_ADMIN' ? (
            <Btn size="sm" variant="ghost" disabled={busy} onClick={() => void deactivate()}>
              Снять лицензию
            </Btn>
          ) : null}
        </Stack>
        <FormError>{msg}</FormError>
      </Stack>
    </Card>
  );
}

export function SettingsPage() {
  const { me, refresh } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [selMonth, setSelMonth] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [selDay, setSelDay] = useState<string | null>(null);
  const [auditLimit, setAuditLimit] = useState<ListPageSize>(DEFAULT_LIST_PAGE_SIZE);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'SUPER_MANAGER' | 'MANAGER'>('MANAGER');
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState<RoleOpt>('MANAGER');
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [editErr, setEditErr] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>('users');

  const canManageUsers = hasPermission(me, 'users.manage');
  const canReadAudit = hasPermission(me, 'audit.read');
  const canEditRolePerms = hasPermission(me, 'settings.role_permissions');
  const showAdminCard = canManageUsers || canEditRolePerms;
  const showAdminTabs = canManageUsers && canEditRolePerms;

  useEffect(() => {
    setDocumentTitle('Настройки');
  }, []);

  useEffect(() => {
    if (!showAdminTabs) {
      setAdminTab(canManageUsers ? 'users' : 'roles');
    }
  }, [showAdminTabs, canManageUsers]);

  useEffect(() => {
    if (canManageUsers) {
      void api<UserRow[]>('/users').then(setUsers);
    }
  }, [canManageUsers]);

  useEffect(() => {
    if (canReadAudit) {
      void api<{ months: string[] }>('/audit/months').then((m) => {
        setMonths(m.months);
        if (m.months[0]) setSelMonth(m.months[0]);
      });
    }
  }, [canReadAudit]);

  useEffect(() => {
    if (!canReadAudit || !selMonth) return;
    void api<{ days: string[] }>(`/audit/days?month=${selMonth}`).then((d) => {
      setDays(d.days);
      if (d.days[0]) setSelDay(d.days[0]);
    });
  }, [canReadAudit, selMonth]);

  async function addUser(e: FormEvent) {
    e.preventDefault();
    await api('/users', {
      method: 'POST',
      body: JSON.stringify({ login, password, role }),
    });
    setLogin('');
    setPassword('');
    setUserModalOpen(false);
    setUsers(await api<UserRow[]>('/users'));
  }

  function openEditUser(u: UserRow) {
    setEditErr(null);
    setEditUser(u);
    setEditRole(u.role as RoleOpt);
    setEditActive(u.isActive);
    setEditPassword('');
  }

  async function saveEditUser(e: FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditErr(null);
    const pw = editPassword.trim();
    if (pw.length > 0 && pw.length < 10) {
      setEditErr('Пароль не короче 10 символов или оставьте поле пустым.');
      return;
    }
    const body: { role: RoleOpt; isActive: boolean; password?: string } = {
      role: editRole,
      isActive: editActive,
    };
    if (pw.length > 0) {
      body.password = pw;
    }
    await api(`/users/${editUser.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    setEditUser(null);
    setEditPassword('');
    setUsers(await api<UserRow[]>('/users'));
  }

  if (!canManageUsers && !canReadAudit && !canEditRolePerms) {
    return (
      <div className="page">
        <PageHeader title="Настройки" />
        <LicenseSettingsSection />
      </div>
    );
  }

  const activeAdminTab: AdminTab =
    showAdminTabs ? adminTab : canManageUsers ? 'users' : 'roles';
  const cardTitle =
    showAdminTabs
      ? 'Доступ'
      : activeAdminTab === 'users'
        ? 'Пользователи'
        : 'Права ролей';

  return (
    <div className="page">
      <PageHeader
        title="Настройки"
        actions={
          canManageUsers && activeAdminTab === 'users' ? (
            <Btn
              variant="primary"
              onClick={() => {
                setLogin('');
                setPassword('');
                setRole('MANAGER');
                setUserModalOpen(true);
              }}
            >
              Новый пользователь
            </Btn>
          ) : undefined
        }
      />

      <LicenseSettingsSection />

      {canManageUsers ? (
        <>
          <Modal
            open={userModalOpen}
            onClose={() => setUserModalOpen(false)}
            title="Новый пользователь"
            description="Задайте логин, надёжный пароль (не меньше 10 символов) и роль."
            size="md"
          >
            <form className="form-grid" onSubmit={addUser}>
              <label className="field">
                <FieldLabel hint="Имя для входа">Логин</FieldLabel>
                <ValidatedInput kind="login" value={login} onChange={setLogin} required />
              </label>
              <label className="field">
                <FieldLabel hint="Не короче 10 символов">Пароль</FieldLabel>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <label className="field field--span-all">
                <FieldLabel hint="Уровень доступа">Роль</FieldLabel>
                <ScrollableChoiceList
                  value={role}
                  onChange={(v) => setRole(v as 'SUPER_MANAGER' | 'MANAGER')}
                  options={[...CREATE_ROLE_OPTIONS]}
                  placeholder="Выберите роль"
                  clearable={false}
                  visibleRows={3}
                />
              </label>
              <FormActions>
                <Btn variant="primary" type="submit">
                  Добавить
                </Btn>
                <Btn variant="ghost" onClick={() => setUserModalOpen(false)}>
                  Отмена
                </Btn>
              </FormActions>
            </form>
          </Modal>

          <Modal
            open={editUser !== null}
            onClose={() => {
              setEditUser(null);
              setEditPassword('');
              setEditErr(null);
            }}
            title="Редактирование пользователя"
            description="Логин не меняется. Пароль указывайте только если нужно задать новый (не короче 10 символов)."
            size="md"
          >
            {editUser ? (
              <form className="form-grid" onSubmit={(ev) => void saveEditUser(ev)}>
                <label className="field field--span-all">
                  <FieldLabel hint="Менять нельзя">Логин</FieldLabel>
                  <input value={editUser.login} readOnly />
                </label>
                <label className="field field--span-all">
                  <FieldLabel hint="Уровень доступа">Роль</FieldLabel>
                  <ScrollableChoiceList
                    value={editRole}
                    onChange={(v) => setEditRole(v as RoleOpt)}
                    options={[...EDIT_ROLE_OPTIONS]}
                    placeholder="Выберите роль"
                    clearable={false}
                    visibleRows={3}
                  />
                </label>
                <div className="field field--span-all">
                  <FieldLabel hint="Разрешить вход в систему">Доступ в систему</FieldLabel>
                  <Switch
                    id="edit-user-active"
                    label={editActive ? 'Активен' : 'Неактивен'}
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                  />
                </div>
                <label className="field field--span-all">
                  <FieldLabel hint="Пусто — оставить текущий">Новый пароль</FieldLabel>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                </label>
                <FormError>{editErr}</FormError>
                <FormActions>
                  <Btn variant="primary" type="submit">
                    Сохранить
                  </Btn>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      setEditUser(null);
                      setEditPassword('');
                      setEditErr(null);
                    }}
                  >
                    Отмена
                  </Btn>
                </FormActions>
              </form>
            ) : null}
          </Modal>
        </>
      ) : null}

      {showAdminCard ? (
        <Card className="settings-admin-card">
          <CardHeader
            title={cardTitle}
            actions={
              showAdminTabs ? (
                <Stack
                  direction="row"
                  gap={2}
                  wrap
                  className="settings-admin-tabs"
                  role="tablist"
                  aria-label="Раздел доступа"
                >
                  <Btn
                    role="tab"
                    aria-selected={adminTab === 'users'}
                    variant="ghost"
                    size="sm"
                    pill
                    softActive={adminTab === 'users'}
                    onClick={() => setAdminTab('users')}
                  >
                    Пользователи
                  </Btn>
                  <Btn
                    role="tab"
                    aria-selected={adminTab === 'roles'}
                    variant="ghost"
                    size="sm"
                    pill
                    softActive={adminTab === 'roles'}
                    onClick={() => setAdminTab('roles')}
                  >
                    Права ролей
                  </Btn>
                </Stack>
              ) : undefined
            }
          />

          {activeAdminTab === 'users' && canManageUsers ? (
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableTh>Логин</DataTableTh>
                  <DataTableTh>Роль</DataTableTh>
                  <DataTableTh>Статус</DataTableTh>
                  <DataTableTh narrow />
                </tr>
              </DataTableHead>
              <DataTableBody>
                {users.length === 0 ? (
                  <DataTableEmpty colSpan={4}>Пользователей пока нет.</DataTableEmpty>
                ) : (
                  users.map((u) => (
                    <DataTableRow key={u.id}>
                      <DataTableTd>{u.login}</DataTableTd>
                      <DataTableTd>{roleLabel(u.role)}</DataTableTd>
                      <DataTableTd>{u.isActive ? 'активен' : 'нет'}</DataTableTd>
                      <DataTableActionCell>
                        <Btn variant="ghost" size="sm" onClick={() => openEditUser(u)}>
                          Изменить
                        </Btn>
                      </DataTableActionCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          ) : null}

          {activeAdminTab === 'roles' && canEditRolePerms ? (
            <RolePermissionsPanel onSaved={() => void refresh()} />
          ) : null}
        </Card>
      ) : null}

      {canReadAudit ? (
        <Card>
          <CardHeader title="Журнал аудита" />
          <div className="stack stack--row stack--gap-3 u-mb-4">
            <label className="field field--flex-md">
              <FieldLabel>Месяц</FieldLabel>
              <ScrollableChoiceList
                aria-label="Месяц журнала аудита"
                value={selMonth ?? ''}
                onChange={(v) => setSelMonth(v || null)}
                options={months.map((m) => ({ value: m, label: m }))}
                placeholder="Выберите месяц"
                clearable={false}
                visibleRows={8}
              />
            </label>
            <label className="field field--flex-md">
              <FieldLabel>День</FieldLabel>
              <ScrollableChoiceList
                aria-label="День журнала аудита"
                value={selDay ?? ''}
                onChange={(v) => setSelDay(v || null)}
                options={days.map((d) => ({ value: d, label: d }))}
                placeholder="Выберите день"
                clearable={false}
                visibleRows={8}
              />
            </label>
          </div>
          {selDay ? (
            <AuditJournalSection
              key={selDay}
              selDay={selDay}
              auditLimit={auditLimit}
              onAuditLimitChange={setAuditLimit}
            />
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
