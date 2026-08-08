import { useState } from 'react';
import type { ReactNode } from 'react';
import { Btn } from '../components/Btn';
import { ActivationCodeForm } from './ActivationCodeForm';
import { CopyRow } from './CopyRow';
import { LicenseKeyForm } from './LicenseKeyForm';
import type { LicenseStatusDto } from './useLicenseStatus';

type Props = {
  status: LicenseStatusDto['status'] | null;
  requestCode: string | null;
  onChanged: () => void;
};

/**
 * Активация в два обмена: клиент отдаёт код запроса, поставщик возвращает код активации.
 * Один и тот же блок используется на экране блокировки и в настройках.
 */
export function LicenseActivation({ status, requestCode, onChanged }: Props) {
  const [replacingKey, setReplacingKey] = useState(false);
  const pending = status === 'pending_activation' && requestCode != null;

  if (!pending || replacingKey) {
    return (
      <div className="stack stack--gap-3">
        <LicenseKeyForm
          autoFocus={replacingKey}
          onActivated={() => {
            setReplacingKey(false);
            onChanged();
          }}
        />
        {replacingKey ? (
          <Btn size="sm" variant="ghost" onClick={() => setReplacingKey(false)}>
            Отмена
          </Btn>
        ) : null}
      </div>
    );
  }

  return (
    <div className="stack stack--gap-4">
      <Step number={1} title="Отправьте код запроса поставщику">
        <CopyRow
          label="Код запроса"
          value={requestCode}
          description="Код содержит ваш ключ и отпечаток этого компьютера."
        />
      </Step>
      <Step number={2} title="Вставьте код активации в ответ">
        <ActivationCodeForm onRedeemed={onChanged} />
      </Step>
      <Btn size="sm" variant="ghost" onClick={() => setReplacingKey(true)}>
        Ввести другой ключ
      </Btn>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="license-step">
      <p className="license-step__title">
        <span className="license-step__number">{number}</span>
        {title}
      </p>
      {children}
    </section>
  );
}
