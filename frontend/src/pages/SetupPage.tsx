import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { FieldHint } from '../components/FieldHint';
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

  if (needs === null) return <p className="loading-screen">Загрузка…</p>;

  return (
    <div className="auth-layout">
      <div className="card card--pad-lg auth-card">
        <div className="page-titles auth-card-intro">
          <p className="sidebar-brand-mark" style={{ fontSize: '1.25rem' }}>
            SelAkCRM
          </p>
          <h1 className="page-title" style={{ fontSize: '1.5rem' }}>
            Первичная настройка
          </h1>
          <p className="page-sub">Создайте учётную запись супер-администратора (пароль не менее 10 символов).</p>
        </div>
        <form className="form-grid form-grid--one" onSubmit={onSubmit}>
          <label className="field">
            <span className="field-label">Логин супер-админа</span>
            <ValidatedInput kind="login" value={login} onChange={setLogin} />
          </label>
          <label className="field">
            <span className="field-label">
              Пароль
              <FieldHint>Любые символы, не короче 10</FieldHint>
            </span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {err && (
            <p className="form-error" role="alert">
              {err}
            </p>
          )}
          <div className="form-actions">
            <button className="btn btn--primary" type="submit">
              Завершить установку
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
