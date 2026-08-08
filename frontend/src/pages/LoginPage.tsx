import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { AuthCard } from '../components/AuthCard';
import { Btn } from '../components/Btn';
import { EmptyHint } from '../components/EmptyHint';
import { FormActions, FormError } from '../components/FormActions';
import { FieldLabel } from '../components/FieldLabel';
import { ValidatedInput } from '../components/ValidatedInput';
import { setDocumentTitle } from '../utils/documentTitle';

export function LoginPage() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);

  useEffect(() => {
    setDocumentTitle('Вход');
  }, []);

  useEffect(() => {
    void api<{ needsSetup: boolean }>('/setup/status')
      .then((s) => {
        setNeedsSetup(s.needsSetup);
        if (s.needsSetup) nav('/setup', { replace: true });
      })
      .catch(() => {
        setNeedsSetup(false);
      });
  }, [nav]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await api<{
        accessToken: string;
        user: {
          id: string;
          login: string;
          role: 'SUPER_ADMIN' | 'SUPER_MANAGER' | 'MANAGER';
          theme: 'light' | 'dark';
          permissions: string[];
        };
      }>('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });
      setSession(res.accessToken, res.user);
      nav('/', { replace: true });
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'Ошибка входа');
    }
  }

  return (
    <AuthCard
      brand="SelAkCRM"
      title="Вход"
      subtitle="Введите учётные данные, выданные администратором."
      footer={
        needsSetup ? (
          <EmptyHint className="u-mt-5 u-mb-0">
            <Link to="/setup">Первичная настройка</Link>
          </EmptyHint>
        ) : null
      }
    >
      <form className="form-grid form-grid--one" onSubmit={onSubmit}>
        <label className="field">
          <FieldLabel hint="Имя для входа">Логин</FieldLabel>
          <ValidatedInput
            kind="login"
            value={login}
            onChange={setLogin}
            autoComplete="username"
          />
        </label>
        <label className="field">
          <FieldLabel hint="Пароль от учётной записи">Пароль</FieldLabel>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <FormError>{err}</FormError>
        <FormActions>
          <Btn variant="primary" type="submit">
            Войти
          </Btn>
        </FormActions>
      </form>
    </AuthCard>
  );
}
