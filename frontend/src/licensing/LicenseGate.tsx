import type { ReactNode } from 'react';
import { AuthCard } from '../components/AuthCard';
import { LoadingScreen } from '../components/LoadingScreen';
import { LicenseActivation } from './LicenseActivation';
import { useLicenseStatus } from './useLicenseStatus';

const SUBTITLE: Record<string, string> = {
  trial_expired: 'Демо-период закончился. Введите лицензионный ключ, чтобы продолжить.',
  clock_rollback: 'Системные часы переведены назад. Установите верное время и перезапустите программу.',
  invalid_key: 'Сохранённый ключ повреждён. Введите его заново.',
  code_mismatch: 'Оборудование компьютера изменилось. Запросите новый код активации.',
};

const PENDING_SUBTITLE = 'Ключ принят. Осталось обменять код запроса на код активации.';
const DEFAULT_SUBTITLE = 'Введите лицензионный ключ, чтобы продолжить работу.';

type Props = { children: ReactNode };

export function LicenseGate({ children }: Props) {
  const license = useLicenseStatus();

  if (license.loading && !license.data) {
    return <LoadingScreen>Проверка лицензии…</LoadingScreen>;
  }

  const status = license.status;
  if (status === 'demo' || status === 'full') {
    return <>{children}</>;
  }

  const subtitle =
    status === 'pending_activation'
      ? (license.reason ? SUBTITLE[license.reason] : null) ?? PENDING_SUBTITLE
      : (license.reason ? SUBTITLE[license.reason] : null) ?? DEFAULT_SUBTITLE;

  return (
    <AuthCard
      brand="SelAkCRM"
      title="Лицензия"
      subtitle={subtitle}
      footer={
        <p className="page-sub license-gate__footer">Версия {license.productVersion || '—'}</p>
      }
    >
      <LicenseActivation
        status={status}
        requestCode={license.requestCode}
        onChanged={() => void license.refetch()}
      />
    </AuthCard>
  );
}
