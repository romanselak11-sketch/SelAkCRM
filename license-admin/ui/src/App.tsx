import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AuthCard } from '@crm/components/AuthCard';
import { Badge } from '@crm/components/Badge';
import { Btn } from '@crm/components/Btn';
import { Card, CardHeader } from '@crm/components/Card';
import {
  DataTable,
  DataTableActionCell,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
} from '@crm/components/DataTable';
import { EmptyHint } from '@crm/components/EmptyHint';
import { FieldLabel } from '@crm/components/FieldLabel';
import { FormActions, FormError } from '@crm/components/FormActions';
import { Modal } from '@crm/components/Modal';
import { OverflowMenu } from '@crm/components/OverflowMenu';
import { PageHeader } from '@crm/components/PageHeader';
import { Stack } from '@crm/components/Stack';
import { ValidatedInput } from '@crm/components/ValidatedInput';
import { ValidatedTextarea } from '@crm/components/ValidatedTextarea';
import { CopyRow } from '@crm/licensing/CopyRow';

type LicenseRow = {
  id: string;
  keyId: string;
  status: string;
  maxSeats: number | null;
  activationsCount: number;
  createdAt: string;
  note: string;
  activations: { hwid: string; activatedAt: string; label: string }[];
  hasVaultKey: boolean;
};

type IssuedCode = {
  code: string;
  keyId: string;
  hwid: string;
  reissue: boolean;
  seatsUsed: number;
  maxSeats: number | null;
};

type Tab = 'activate' | 'keys' | 'help' | 'audit';

const NAV: { id: Tab; label: string }[] = [
  { id: 'activate', label: 'Активация' },
  { id: 'keys', label: 'Ключи' },
  { id: 'help', label: 'Справка' },
  { id: 'audit', label: 'Журнал' },
];

const AUDIT_ACTIONS: Record<string, string> = {
  generate_keypair: 'Создана пара ключей подписи',
  create_license: 'Создан лицензионный ключ',
  revoke: 'Ключ отозван',
  deallocate: 'Устройство отвязано',
  issue_code: 'Выдан код активации',
};

function statusLabel(status: string): string {
  if (status === 'active') return 'Активен';
  if (status === 'revoked') return 'Отозван';
  return status;
}

function seatsLabel(lic: LicenseRow): string {
  return lic.maxSeats == null ? `${lic.activationsCount} · ∞` : `${lic.activationsCount}/${lic.maxSeats}`;
}

function auditLabel(action: string): string {
  return AUDIT_ACTIONS[action] ?? action;
}

function formatAuditTime(iso: string): string {
  const raw = iso.replace(/Z$/, '');
  if (raw.length >= 19) return raw.slice(0, 19).replace('T', ' ');
  return iso;
}

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.body && !(opts.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : res.statusText;
    throw new Error(msg || 'Ошибка');
  }
  return data as T;
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<Tab>('activate');
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [keyModal, setKeyModal] = useState<{ keyId: string; fullKey: string } | null>(null);

  const [note, setNote] = useState('');
  const [maxSeats, setMaxSeats] = useState('1');
  const [unlimited, setUnlimited] = useState(false);

  const [requestCode, setRequestCode] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [issued, setIssued] = useState<IssuedCode | null>(null);

  const [audit, setAudit] = useState<{ at: string; action: string }[]>([]);

  const refresh = useCallback(async () => {
    const status = await api<{ unlocked: boolean }>('/api/status');
    setUnlocked(status.unlocked);
    if (status.unlocked) {
      setLicenses(await api<LicenseRow[]>('/api/licenses'));
      setAudit(await api<{ at: string; action: string }[]>('/api/audit'));
    }
  }, []);

  useEffect(() => {
    void refresh().catch((e) => setError(String(e.message || e)));
  }, [refresh]);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/unlock', { method: 'POST', body: JSON.stringify({ password }) });
      await api('/api/ensure-keys', { method: 'POST' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function createLicense(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api<{ fullKey: string; keyId: string }>('/api/licenses', {
        method: 'POST',
        body: JSON.stringify({
          note,
          maxSeats: unlimited ? null : Number(maxSeats) || 1,
        }),
      });
      setKeyModal({ keyId: res.keyId, fullKey: res.fullKey });
      setNote('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function issueCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIssued(null);
    try {
      const res = await api<IssuedCode>('/api/activate', {
        method: 'POST',
        body: JSON.stringify({ requestCode, label: deviceLabel || null }),
      });
      setIssued(res);
      setRequestCode('');
      setDeviceLabel('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  function revealKey(lic: LicenseRow) {
    void api<{ fullKey: string }>(`/api/licenses/${lic.id}/reveal`, { method: 'POST' })
      .then((r) => setKeyModal({ keyId: lic.keyId, fullKey: r.fullKey }))
      .catch((e) => setError(String(e.message || e)));
  }

  function revokeKey(lic: LicenseRow) {
    if (
      !window.confirm(
        `Отозвать ключ ${lic.keyId}? Новые устройства активировать будет нельзя. ` +
          'Уже выданные коды продолжат работать.',
      )
    ) {
      return;
    }
    void api(`/api/licenses/${lic.id}/revoke`, { method: 'POST' })
      .then(() => refresh())
      .catch((e) => setError(String(e.message || e)));
  }

  if (!unlocked) {
    return (
      <AuthCard
        brand="SelAkCRM"
        title="Админ лицензий"
        subtitle="Пароль хранилища ключей. При первом входе задайте новый — он создаст локальный vault."
      >
        <form className="stack" onSubmit={(e) => void unlock(e)}>
          <label className="field">
            <FieldLabel>Пароль</FieldLabel>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
            />
          </label>
          {error ? <FormError>{error}</FormError> : null}
          <FormActions>
            <Btn variant="primary" type="submit">
              Разблокировать
            </Btn>
          </FormActions>
        </form>
      </AuthCard>
    );
  }

  return (
    <>
      <div className="admin-shell">
        <aside className="sidebar" aria-label="Навигация">
          <div className="sidebar-brand">
            <div className="sidebar-brand-top">
              <div className="sidebar-brand-copy">
                <span className="sidebar-brand-mark">SelAkCRM</span>
                <span className="sidebar-brand-tag">Админ лицензий</span>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Разделы">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'active' : undefined}
                aria-current={tab === item.id ? 'page' : undefined}
                onClick={() => {
                  setTab(item.id);
                  setError(null);
                  setInfo(null);
                }}
              >
                <span className="sidebar-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="admin-main">
          <Stack gap={4}>
            {error ? <FormError>{error}</FormError> : null}
            {info ? <p className="page-sub">{info}</p> : null}

            {tab === 'activate' ? (
              <>
                <PageHeader
                  title="Активация"
                  hint="Клиент присылает код запроса — вы возвращаете код активации."
                />
                <Card>
                  <form className="stack stack--gap-4" onSubmit={(e) => void issueCode(e)}>
                    <label className="field">
                      <FieldLabel hint="Клиент копирует его в CRM: Настройки → Лицензия.">
                        Код запроса от клиента
                      </FieldLabel>
                      <ValidatedTextarea
                        value={requestCode}
                        onChange={setRequestCode}
                        rows={3}
                        placeholder="SAKREQ-…"
                        required
                      />
                    </label>
                    <label className="field">
                      <FieldLabel hint="Как назвать этот компьютер в списке устройств: офис, ноутбук Ивана.">
                        Метка устройства
                      </FieldLabel>
                      <ValidatedInput kind="text" value={deviceLabel} onChange={setDeviceLabel} />
                    </label>
                    <FormActions>
                      <Btn variant="primary" type="submit">
                        Выдать код активации
                      </Btn>
                    </FormActions>
                  </form>
                </Card>

                {issued ? (
                  <Card>
                    <CardHeader
                      title="Код активации готов"
                      actions={
                        <Badge variant="accent">
                          {issued.maxSeats == null
                            ? `${issued.seatsUsed} устройств`
                            : `${issued.seatsUsed} из ${issued.maxSeats}`}
                        </Badge>
                      }
                    />
                    <Stack gap={3}>
                      <CopyRow
                        label="Отправьте этот код клиенту"
                        value={issued.code}
                        description={
                          issued.reissue
                            ? `Повторная выдача для ${issued.hwid} — место не занято заново.`
                            : `Ключ ${issued.keyId}, устройство ${issued.hwid}.`
                        }
                      />
                    </Stack>
                  </Card>
                ) : null}
              </>
            ) : null}

            {tab === 'keys' ? (
              <>
                <PageHeader title="Ключи" hint="Выпуск ключей и список активированных устройств." />
                <Card>
                  <CardHeader title="Создать ключ" />
                  <form className="form-grid" onSubmit={(e) => void createLicense(e)}>
                    <label className="field field--span-all">
                      <FieldLabel hint="Видна только вам, клиенту не передаётся.">
                        Заметка
                      </FieldLabel>
                      <ValidatedInput
                        kind="text"
                        value={note}
                        onChange={setNote}
                        placeholder="ООО Ромашка"
                      />
                    </label>

                    <label className="field">
                      <FieldLabel hint="Сколько компьютеров сможет работать по этому ключу.">
                        Число устройств
                      </FieldLabel>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={unlimited ? '' : maxSeats}
                        disabled={unlimited}
                        onChange={(e) => setMaxSeats(e.target.value.replace(/[^\d]/g, ''))}
                        required={!unlimited}
                      />
                    </label>

                    <div className="field">
                      <FieldLabel>Без ограничения</FieldLabel>
                      <div className="admin-mode-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={unlimited}
                            onChange={(e) => setUnlimited(e.target.checked)}
                          />
                          Любое число компьютеров
                        </label>
                      </div>
                    </div>

                    <FormActions>
                      <Btn variant="primary" type="submit">
                        Сгенерировать
                      </Btn>
                    </FormActions>
                  </form>
                </Card>

                <Card>
                  <CardHeader title="Список ключей" />
                  {licenses.length === 0 ? (
                    <EmptyHint variant="panel">Ключей пока нет. Создайте первый выше.</EmptyHint>
                  ) : (
                    <DataTable>
                      <DataTableHead>
                        <DataTableRow>
                          <DataTableTh>ID ключа</DataTableTh>
                          <DataTableTh>Статус</DataTableTh>
                          <DataTableTh numeric>Устройства</DataTableTh>
                          <DataTableTh>Заметка</DataTableTh>
                          <DataTableTh narrow>Действия</DataTableTh>
                        </DataTableRow>
                      </DataTableHead>
                      <DataTableBody>
                        {licenses.map((lic) => (
                          <DataTableRow key={lic.id}>
                            <DataTableTd>
                              <div className="stack stack--gap-2">
                                <span className="mono">{lic.keyId}</span>
                                {lic.activations.length > 0 ? (
                                  <div className="admin-activations">
                                    {lic.activations.map((a) => (
                                      <div key={a.hwid} className="admin-activation-row">
                                        <span className="admin-activation-label">
                                          {a.label || 'Без метки'}
                                        </span>
                                        <span className="mono admin-activation-hwid" title={a.hwid}>
                                          {a.hwid}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </DataTableTd>
                            <DataTableTd>
                              <Badge variant={lic.status === 'revoked' ? 'default' : 'accent'}>
                                {statusLabel(lic.status)}
                              </Badge>
                            </DataTableTd>
                            <DataTableTd numeric className="mono">
                              {seatsLabel(lic)}
                            </DataTableTd>
                            <DataTableTd>{lic.note || '—'}</DataTableTd>
                            <DataTableActionCell>
                              <OverflowMenu
                                aria-label={`Действия для ${lic.keyId}`}
                                items={[
                                  {
                                    id: 'reveal',
                                    label: 'Показать ключ',
                                    onSelect: () => revealKey(lic),
                                  },
                                  ...lic.activations.map((a) => ({
                                    id: `dealloc-${a.hwid}`,
                                    label: a.label
                                      ? `Отвязать: ${a.label}`
                                      : 'Отвязать устройство',
                                    onSelect: () => {
                                      const name = a.label || a.hwid;
                                      if (
                                        !window.confirm(
                                          `Отвязать устройство «${name}»? Место освободится для другого компьютера.`,
                                        )
                                      ) {
                                        return;
                                      }
                                      void api(`/api/licenses/${lic.id}/deallocate`, {
                                        method: 'POST',
                                        body: JSON.stringify({ hwid: a.hwid }),
                                      })
                                        .then(() => refresh())
                                        .catch((e) => setError(String(e.message || e)));
                                    },
                                  })),
                                  {
                                    id: 'revoke',
                                    label: 'Отозвать',
                                    danger: true,
                                    disabled: lic.status === 'revoked',
                                    onSelect: () => revokeKey(lic),
                                  },
                                ]}
                              />
                            </DataTableActionCell>
                          </DataTableRow>
                        ))}
                      </DataTableBody>
                    </DataTable>
                  )}
                </Card>
              </>
            ) : null}

            {tab === 'help' ? (
              <>
                <PageHeader title="Справка" hint="Как выдавать лицензии SelAkCRM." />

                <Card>
                  <CardHeader title="Как это работает" />
                  <p className="admin-help-lead">
                    Вы выпускаете ключ и передаёте его клиенту. Клиент вводит ключ в CRM и получает
                    код запроса. Вы обмениваете этот код на код активации — клиент вставляет его и
                    работает. Ничего публиковать и никуда выкладывать не нужно.
                  </p>
                </Card>

                <Card>
                  <CardHeader title="Порядок действий" />
                  <ol className="admin-help-steps">
                    <li>
                      <div className="admin-help-step-body">
                        <strong>Создайте ключ</strong>
                        <p>
                          Раздел «Ключи» → укажите число устройств → «Сгенерировать». Скопируйте
                          полный ключ из окна: позже он показывается только через «Показать ключ».
                        </p>
                      </div>
                    </li>
                    <li>
                      <div className="admin-help-step-body">
                        <strong>Клиент вводит ключ</strong>
                        <p>
                          В CRM: Настройки → Лицензия. После ввода там появляется код запроса —
                          клиент присылает его вам.
                        </p>
                      </div>
                    </li>
                    <li>
                      <div className="admin-help-step-body">
                        <strong>Выдайте код активации</strong>
                        <p>
                          Раздел «Активация» → вставьте код запроса → «Выдать код активации».
                          Отправьте полученный код клиенту.
                        </p>
                      </div>
                    </li>
                    <li>
                      <div className="admin-help-step-body">
                        <strong>Клиент вставляет код</strong>
                        <p>Лицензия активируется сразу и бессрочно. Интернет не нужен.</p>
                      </div>
                    </li>
                  </ol>
                </Card>

                <div className="admin-help-grid">
                  <Card>
                    <CardHeader title="Лимит устройств" />
                    <Stack gap={3}>
                      <p className="page-sub">
                        Код активации привязан к конкретному компьютеру. Превысить лимит нельзя:
                        места считаются здесь, в момент выдачи кода.
                      </p>
                      <ul className="admin-help-list">
                        <li>Повторная выдача на тот же компьютер место не занимает.</li>
                        <li>
                          Клиент сменил ПК — в меню «⋯» у ключа выберите «Отвязать», затем выдайте
                          новый код.
                        </li>
                        <li>Переустановка Windows меняет отпечаток: нужен новый код.</li>
                      </ul>
                    </Stack>
                  </Card>
                  <Card>
                    <CardHeader title="Что значит «Отозвать»" />
                    <Stack gap={3}>
                      <p className="page-sub">
                        Отзыв запрещает выдавать новые коды по этому ключу. Уже выданные коды
                        продолжают работать: они бессрочные и проверяются без сети.
                      </p>
                      <ul className="admin-help-list">
                        <li>Отзыв полезен, если ключ утёк или клиент не продлил договор.</li>
                        <li>Отключить работающий компьютер удалённо нельзя.</li>
                      </ul>
                    </Stack>
                  </Card>
                </div>

                <Card>
                  <CardHeader title="Важно сохранить" />
                  <div className="admin-help-callout">
                    <p>
                      Сделайте офлайн-копию{' '}
                      <code className="mono">license-admin/keys/private.pem</code> и папки{' '}
                      <code className="mono">license-admin/data/</code>. Без приватного ключа вы не
                      сможете выдавать коды активации, а без данных потеряете список выданных ключей
                      и занятых мест.
                    </p>
                  </div>
                </Card>
              </>
            ) : null}

            {tab === 'audit' ? (
              <>
                <PageHeader
                  title="Журнал"
                  hint="Локальная история действий в этой админке (не аудит CRM)."
                />
                <Card>
                  {audit.length === 0 ? (
                    <EmptyHint variant="panel">Записей пока нет.</EmptyHint>
                  ) : (
                    <ul className="admin-audit-list">
                      {audit.map((a, i) => (
                        <li key={`${a.at}-${i}`}>
                          <span className="admin-audit-time">{formatAuditTime(a.at)}</span>
                          <span className="admin-audit-action">{auditLabel(a.action)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </>
            ) : null}
          </Stack>
        </main>
      </div>

      <Modal
        open={keyModal != null}
        title="Лицензионный ключ"
        description={
          keyModal
            ? `Передайте ключ ${keyModal.keyId} клиенту. Он понадобится ему один раз, при первом вводе.`
            : undefined
        }
        size="md"
        onClose={() => setKeyModal(null)}
      >
        {keyModal ? (
          <Stack gap={4}>
            <CopyRow label="Полный ключ" value={keyModal.fullKey} />
            <FormActions>
              <Btn variant="default" type="button" onClick={() => setKeyModal(null)}>
                Закрыть
              </Btn>
            </FormActions>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}
