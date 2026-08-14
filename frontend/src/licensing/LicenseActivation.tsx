import { useEffect, useState } from 'react';
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
  /** Мгновенный ответ activate/redeem, пока refetch ещё не обновил props. */
  const [override, setOverride] = useState<Pick<LicenseStatusDto, 'status' | 'requestCode'> | null>(
    null,
  );

  useEffect(() => {
    if (!override) return;
    if (status === override.status && requestCode === override.requestCode) {
      setOverride(null);
    }
  }, [status, requestCode, override]);

  const effectiveStatus = override?.status ?? status;
  const effectiveRequestCode = override?.requestCode ?? requestCode;
  const pending = effectiveStatus === 'pending_activation' && effectiveRequestCode != null;

  if (!pending || replacingKey) {
    return (
      <div className="stack stack--gap-3">
        <LicenseKeyForm
          autoFocus={replacingKey}
          onActivated={(next) => {
            setReplacingKey(false);
            setOverride({ status: next.status, requestCode: next.requestCode });
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
          value={effectiveRequestCode}
          description="Код содержит ваш ключ и отпечаток этого компьютера."
        />
      </Step>
      <Step number={2} title="Вставьте код активации в ответ">
        <ActivationCodeForm
          onRedeemed={(next) => {
            setOverride({ status: next.status, requestCode: next.requestCode });
            onChanged();
          }}
        />
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
