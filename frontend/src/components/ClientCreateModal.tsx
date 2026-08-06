import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import { FieldHint } from './FieldHint';
import { Modal } from './Modal';
import { ValidatedInput } from './ValidatedInput';

export type CreatedClient = {
  id: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
};

type ClientCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (client: CreatedClient) => void;
  /** POST: `/clients` в справочнике, `/home/policy-form/clients` из формы полиса */
  createPath?: string;
};

export function ClientCreateModal({
  open,
  onClose,
  onCreated,
  createPath = '/clients',
}: ClientCreateModalProps) {
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [documentsUrl, setDocumentsUrl] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
  }, [open]);

  function resetForm() {
    setLastName('');
    setFirstName('');
    setMiddleName('');
    setPhone('');
    setExtraPhones([]);
    setEmail('');
    setDocumentsUrl('');
    setErr(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const additionalPhones = extraPhones.map((s) => s.trim()).filter(Boolean);
    const docTrim = documentsUrl.trim();
    const body: Record<string, unknown> = {
      lastName,
      firstName,
      phone,
      middleName: middleName.trim() || undefined,
      email: email.trim() || undefined,
      additionalPhones,
    };
    if (docTrim) body.documentsUrl = docTrim;
    try {
      const created = await api<CreatedClient>(createPath, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      resetForm();
      onCreated(created);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'Не удалось создать клиента');
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Новый клиент"
      description="Укажите ФИО и телефон. Остальные поля по желанию."
      size="md"
    >
      <form className="form-grid" onSubmit={(ev) => void onSubmit(ev)}>
        <label className="field">
          <span className="field-label">Фамилия</span>
          <ValidatedInput kind="personName" value={lastName} onChange={setLastName} required />
        </label>
        <label className="field">
          <span className="field-label">Имя</span>
          <ValidatedInput kind="personName" value={firstName} onChange={setFirstName} required />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="field-label">Отчество</span>
          <ValidatedInput kind="personName" value={middleName} onChange={setMiddleName} />
        </label>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="field-label">
            Телефон
            <FieldHint>Например: +79001234567</FieldHint>
          </span>
          <div className="phone-field__rows">
            <div className="phone-field__row">
              <ValidatedInput
                kind="phone"
                value={phone}
                onChange={setPhone}
                required
                autoComplete="tel"
                placeholder="+7 …"
                hideHint
              />
              <button
                type="button"
                className="btn btn--ghost phone-field__row-btn"
                title="Добавить ещё номер"
                aria-label="Добавить ещё номер"
                onClick={() => setExtraPhones((prev) => [...prev, ''])}
              >
                +
              </button>
            </div>
            {extraPhones.map((val, i) => (
              <div key={i} className="phone-field__row">
                <ValidatedInput
                  kind="phone"
                  value={val}
                  onChange={(nextVal) => {
                    const next = [...extraPhones];
                    next[i] = nextVal;
                    setExtraPhones(next);
                  }}
                  autoComplete="tel"
                  placeholder="Доп. номер"
                  hideHint
                />
                <button
                  type="button"
                  className="btn btn--ghost phone-field__row-btn"
                  title="Убрать номер"
                  aria-label="Убрать номер"
                  onClick={() => setExtraPhones((prev) => prev.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="field-label">Email</span>
          <ValidatedInput
            kind="email"
            type="email"
            value={email}
            onChange={setEmail}
            hint="Необязательно. Например: user@mail.ru"
          />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span className="field-label">Ссылка на документы</span>
          <ValidatedInput
            kind="url"
            value={documentsUrl}
            onChange={setDocumentsUrl}
            hint="Необязательно. Например: https://disk.yandex.ru/…"
          />
        </label>
        {err ? (
          <p className="form-error" role="alert" style={{ gridColumn: '1 / -1' }}>
            {err}
          </p>
        ) : null}
        <div className="form-actions">
          <button className="btn btn--primary" type="submit">
            Создать
          </button>
          <button type="button" className="btn btn--ghost" onClick={handleClose}>
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}
