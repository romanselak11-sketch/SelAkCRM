import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth';
import { AppLayout } from './layout/AppLayout';
import { ClientsPage } from './pages/ClientsPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { PolicyFormPage } from './pages/PolicyFormPage';
import { SettingsPage } from './pages/SettingsPage';
import { SetupPage } from './pages/SetupPage';
import { TasksPage } from './pages/TasksPage';

const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="policies" element={<PoliciesPage />} />
            <Route path="policies/new" element={<PolicyFormPage />} />
            <Route path="renew/:taskId" element={<PolicyFormPage />} />
            <Route
              path="analytics"
              element={
                <Suspense
                  fallback={
                    <div className="card" style={{ padding: 'var(--space-6)' }}>
                      <p className="empty-hint empty-hint--chart" style={{ margin: 0 }}>
                        Загрузка аналитики…
                      </p>
                    </div>
                  }
                >
                  <AnalyticsPage />
                </Suspense>
              }
            />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
