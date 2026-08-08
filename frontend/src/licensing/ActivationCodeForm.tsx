import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { Btn } from '../components/Btn';
import { FieldLabel } from '../components/FieldLabel';
import { FormError } from '../components/FormActions';
import { ValidatedInput } from '../components/ValidatedInput';
import type { LicenseStatusDto } from './useLicenseStatus';

type Props = {
  onRedeemed: (status: LicenseStatusDto) => void;
};

/** Шаг 3: клиент вставляет код ответа поставщика. */
export function ActivationCodeForm({ onRedeemed }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const status = await api<LicenseStatusDto>('/license/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      });
      setCode('');
      onRedeemed(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось применить код');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack stack--gap-2" onSubmit={(e) => void onSubmit(e)}>
      <FieldLabel>Код активации от поставщика</FieldLabel>
      <div className="input-row">
        <ValidatedInput
          id="activation-code"
          kind="text"
          value={code}
          onChange={setCode}
          placeholder="SAKACT-…"
          autoComplete="off"
          spellCheck={false}
        />
        <Btn type="submit" variant="primary" disabled={busy || !code.trim()}>
          {busy ? 'Проверка…' : 'Активировать'}
        </Btn>
      </div>
      <FormError>{error}</FormError>
    </form>
  );
}
