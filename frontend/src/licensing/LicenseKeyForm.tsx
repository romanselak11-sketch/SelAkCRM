import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { Btn } from '../components/Btn';
import { FieldLabel } from '../components/FieldLabel';
import { FormError } from '../components/FormActions';
import { ValidatedInput } from '../components/ValidatedInput';
import type { LicenseStatusDto } from './useLicenseStatus';

type Props = {
  onActivated: (status: LicenseStatusDto) => void;
  autoFocus?: boolean;
};

/** Шаг 1: клиент вводит ключ, выданный поставщиком. */
export function LicenseKeyForm({ onActivated, autoFocus }: Props) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const status = await api<LicenseStatusDto>('/license/activate', {
        method: 'POST',
        body: JSON.stringify({ full_key: key.trim() }),
      });
      setKey('');
      onActivated(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось принять ключ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack stack--gap-2" onSubmit={(e) => void onSubmit(e)}>
      <FieldLabel>Лицензионный ключ</FieldLabel>
      <div className="input-row">
        <ValidatedInput
          id="license-key"
          kind="text"
          value={key}
          onChange={setKey}
          placeholder="SAK-XXXXXXXX-…"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
        />
        <Btn type="submit" variant="primary" disabled={busy || !key.trim()}>
          {busy ? 'Проверка…' : 'Продолжить'}
        </Btn>
      </div>
      <FormError>{error}</FormError>
    </form>
  );
}
