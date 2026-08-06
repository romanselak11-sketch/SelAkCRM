import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ListPaginationFooter } from '../components/ListPaginationFooter';
import { Modal } from '../components/Modal';
import { PageHeading } from '../components/PageHeading';
import { FieldHint } from '../components/FieldHint';
import { ValidatedInput } from '../components/ValidatedInput';
import { setDocumentTitle } from '../utils/documentTitle';
import type { ListPageSize, Paginated } from '../utils/listPagination';

type UserRow = { id: string; login: string; role: string; isActive: boolean };

type RoleOpt = 'SUPER_ADMIN' | 'SUPER_MANAGER' | 'MANAGER';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Супер-админ',
  SUPER_MANAGER: 'Супер-менеджер',
  MANAGER: 'Менеджер',
};

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

/** Журнал аудита за выбранный день: при смене дня сбрасывается страница пагинации через `key` у родителя. */
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
        <p className="empty-hint empty-hint--panel">Нет записей за этот день.</p>
      ) : (
        <ul className="audit-log">
          {auditEvents.map((ev) => (
            <li key={ev.id} className="audit-log-item">
              <time className="audit-log-time" dateTime={ev.createdAt}>
                {ev.createdAt.slice(0, 19).replace('T', ' ')}
              </time>
              <span className="audit-log-desc">{ev.descriptionRu ?? ev.action}</span>
            </li>
          ))}
        </ul>
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

export function SettingsPage() {
  const { me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [selMonth, setSelMonth] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [selDay, setSelDay] = useState<string | null>(null);
  const [auditLimit, setAuditLimit] = useState<ListPageSize>(10);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'SUPER_MANAGER' | 'MANAGER'>('MANAGER');
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState<RoleOpt>('MANAGER');
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [editErr, setEditErr] = useState<string | null>(null);

  const isAdmin = me?.role === 'SUPER_ADMIN';

  useEffect(() => {
    setDocumentTitle('Настройки');
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void api<UserRow[]>('/users').then(setUsers);
      void api<{ months: string[] }>('/audit/months').then((m) => {
        setMonths(m.months);
        if (m.months[0]) setSelMonth(m.months[0]);
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !selMonth) return;
    void api<{ days: string[] }>(`/audit/days?month=${selMonth}`).then((d) => {
      setDays(d.days);
      if (d.days[0]) setSelDay(d.days[0]);
    });
  }, [isAdmin, selMonth]);

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

  if (me?.role === 'SUPER_MANAGER') {
    return (
      <div className="page">
        <header className="page-header">
          <PageHeading title="Настройки" />
        </header>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="page">
      <header className="page-header">
        <PageHeading title="Настройки" />
        <div className="page-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setLogin('');
              setPassword('');
              setRole('MANAGER');
              setUserModalOpen(true);
            }}
          >
            Новый пользователь
          </button>
        </div>
      </header>

      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title="Новый пользователь"
        description="Задайте логин, надёжный пароль (не меньше 10 символов) и роль."
        size="md"
      >
        <form className="form-grid" onSubmit={addUser}>
          <label className="field">
            <span className="field-label">Логин</span>
            <ValidatedInput kind="login" value={login} onChange={setLogin} required />
          </label>
          <label className="field">
            <span className="field-label">
              Пароль
              <FieldHint>Любые символы, не короче 10</FieldHint>
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span className="field-label">Роль</span>
            <select value={role} onChange={(e) => setRole(e.target.value as 'SUPER_MANAGER' | 'MANAGER')}>
              <option value="MANAGER">Менеджер</option>
              <option value="SUPER_MANAGER">Супер-менеджер</option>
            </select>
          </label>
          <div className="form-actions">
            <button className="btn btn--primary" type="submit">
              Добавить
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setUserModalOpen(false)}>
              Отмена
            </button>
          </div>
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
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span className="field-label">Логин</span>
              <input value={editUser.login} readOnly />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span className="field-label">Роль</span>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as RoleOpt)}
              >
                <option value="MANAGER">Менеджер</option>
                <option value="SUPER_MANAGER">Супер-менеджер</option>
                <option value="SUPER_ADMIN">Супер-админ</option>
              </select>
            </label>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <span className="field-label">Доступ в систему</span>
              <label
                className={`activity-status ${editActive ? 'activity-status--active' : 'activity-status--inactive'}`}
                htmlFor="edit-user-active"
              >
                <input
                  id="edit-user-active"
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                <span className="activity-status-text">{editActive ? 'Активен' : 'Неактивен'}</span>
              </label>
            </div>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span className="field-label">
                Новый пароль
                <FieldHint>Оставьте пустым или задайте новый (не короче 10 символов)</FieldHint>
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
            </label>
            {editErr ? (
              <p className="form-error" role="alert" style={{ gridColumn: '1 / -1' }}>
                {editErr}
              </p>
            ) : null}
            <div className="form-actions">
              <button className="btn btn--primary" type="submit">
                Сохранить
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setEditUser(null);
                  setEditPassword('');
                  setEditErr(null);
                }}
              >
                Отмена
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Пользователи</h2>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Логин</th>
                <th>Роль</th>
                <th>Статус</th>
                <th style={{ width: '1%' }} />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.login}</td>
                  <td>{roleLabel(u.role)}</td>
                  <td>{u.isActive ? 'активен' : 'нет'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => openEditUser(u)}
                    >
                      Изменить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Журнал аудита</h2>
        </div>
        <div className="stack stack--row stack--gap-3 u-mb-4">
          <label className="field" style={{ flex: '1 1 200px' }}>
            <span className="field-label">Месяц</span>
            <select value={selMonth ?? ''} onChange={(e) => setSelMonth(e.target.value || null)}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ flex: '1 1 200px' }}>
            <span className="field-label">День</span>
            <select value={selDay ?? ''} onChange={(e) => setSelDay(e.target.value || null)}>
              {days.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
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
      </section>
    </div>
  );
}
