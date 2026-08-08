import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { AuthCard } from '../components/AuthCard';
import { Btn } from '../components/Btn';
import { FormActions, FormError } from '../components/FormActions';
import { FieldLabel } from '../components/FieldLabel';
import { LoadingScreen } from '../components/LoadingScreen';
import { ValidatedInput } from '../components/ValidatedInput';
import { setDocumentTitle } from '../utils/documentTitle';

export function SetupPage() {
  const nav = useNavigate();
  const [needs, setNeeds] = useState<boolean | null>(null);
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDocumentTitle('Настройка');
  }, []);

  useEffect(() => {
    void api<{ needsSetup: boolean }>('/setup/status').then((s) => {
      setNeeds(s.needsSetup);
      if (!s.needsSetup) nav('/login', { replace: true });
    });
  }, [nav]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api('/setup/complete', {
        method: 'POST',
        body: JSON.stringify({ adminLogin: login, adminPassword: password }),
      });
      nav('/login', { replace: true });
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'Ошибка');
    }
  }

  if (needs === null) return <LoadingScreen />;

  return (
    <AuthCard
      brand="SelAkCRM"
      title="Первичная настройка"
      subtitle="Создайте учётную запись супер-администратора (пароль не менее 10 символов)."
    >
      <form className="form-grid form-grid--one" onSubmit={onSubmit}>
        <label className="field">
          <FieldLabel hint="Имя для входа">Логин супер-админа</FieldLabel>
          <ValidatedInput kind="login" value={login} onChange={setLogin} />
        </label>
        <label className="field">
          <FieldLabel hint="Не короче 10 символов">Пароль</FieldLabel>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <FormError>{err}</FormError>
        <FormActions>
          <Btn variant="primary" type="submit">
            Завершить установку
          </Btn>
        </FormActions>
      </form>
    </AuthCard>
  );
}
