import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { FieldHint } from '../components/FieldHint';
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
        user: { id: string; login: string; role: 'SUPER_ADMIN' | 'SUPER_MANAGER' | 'MANAGER'; theme: 'light' | 'dark' };
      }>('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });
      setSession(res.accessToken, res.user);
      nav('/', { replace: true });
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'Ошибка входа');
    }
  }

  return (
    <div className="auth-layout">
      <div className="card card--pad-lg auth-card">
        <div className="page-titles auth-card-intro">
          <p className="sidebar-brand-mark" style={{ fontSize: '1.25rem' }}>
            SelAkCRM
          </p>
          <h1 className="page-title" style={{ fontSize: '1.5rem' }}>
            Вход
          </h1>
          <p className="page-sub">Введите учётные данные, выданные администратором.</p>
        </div>
        <form className="form-grid form-grid--one" onSubmit={onSubmit}>
          <label className="field">
            <span className="field-label">Логин</span>
            <ValidatedInput
              kind="login"
              value={login}
              onChange={setLogin}
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span className="field-label">Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <FieldHint>Введите пароль от учётной записи</FieldHint>
          </label>
          {err && (
            <p className="form-error" role="alert">
              {err}
            </p>
          )}
          <div className="form-actions">
            <button className="btn btn--primary" type="submit">
              Войти
            </button>
          </div>
        </form>
        {needsSetup ? (
          <p style={{ marginTop: 'var(--space-5)', marginBottom: 0 }} className="empty-hint">
            <Link to="/setup">Первичная настройка</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
