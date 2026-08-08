import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Btn } from '../components/Btn';
import { Badge } from '../components/Badge';
import { LoadingScreen } from '../components/LoadingScreen';
import { hasPermission } from '../domain/permissions';
import { formatRemaining } from '../licensing/formatRemaining';
import { useLicenseStatus } from '../licensing/useLicenseStatus';
import { setDocumentTitle } from '../utils/documentTitle';
import { resetPageScrollLock } from '../utils/pageScrollLock';

function NavIcon({
  name,
}: {
  name: 'home' | 'building' | 'users' | 'file' | 'chart' | 'gear' | 'tasks';
}) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':
      return (
        <svg {...common} className="sidebar-nav-icon" aria-hidden>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case 'building':
      return (
        <svg {...common} className="sidebar-nav-icon" aria-hidden>
          <path d="M4 21V8l8-4v17" />
          <path d="M12 11h5v10" />
          <path d="M9 15h.01M9 18h.01M15 15h.01M15 18h.01" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common} className="sidebar-nav-icon" aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'file':
      return (
        <svg {...common} className="sidebar-nav-icon" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M10 12h4M10 16h4" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common} className="sidebar-nav-icon" aria-hidden>
          <path d="M3 3v18h18" />
          <path d="M7 16l4-4 4 4 6-8" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...common} className="sidebar-nav-icon" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    case 'tasks':
      return (
        <svg {...common} className="sidebar-nav-icon" aria-hidden>
          <path d="M9 11H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4" />
          <path d="M15 11h4a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-4" />
          <path d="M12 3v14" />
          <path d="M9 7h6" />
        </svg>
      );
    default:
      return null;
  }
}

const SIDEBAR_COLLAPSED_KEY = 'selakcrm-sidebar-collapsed';

function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Иконка как в IDE: скруглённый прямоугольник с вертикальной полосой слева (основная боковая панель). */
function SidebarPrimaryBarIcon() {
  return (
    <svg className="sidebar-toggle-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5.25"
        y="6.25"
        width="13.5"
        height="11.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line
        x1="9.5"
        y1="7.75"
        x2="9.5"
        y2="16.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function sectionTitle(pathname: string): string {
  if (pathname === '/') return 'Главная';
  if (pathname === '/companies') return 'Страховые компании';
  if (pathname === '/clients') return 'Клиенты';
  if (pathname === '/policies') return 'Полисы';
  if (pathname === '/analytics') return 'Аналитика';
  if (pathname === '/settings') return 'Настройки';
  if (pathname === '/tasks') return 'Задачи';
  if (pathname.startsWith('/renew/')) return 'Продление полиса';
  if (pathname === '/policies/new') return 'Новый полис';
  return 'SelAkCRM';
}

export function AppLayout() {
  const { me, logout, loading, refresh } = useAuth();
  const loc = useLocation();
  const [themeOpen, setThemeOpen] = useState(false);
  const themePopoverRef = useRef<HTMLDivElement>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const license = useLicenseStatus();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (license.status !== 'demo' || license.remainingSeconds == null) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [license.status, license.remainingSeconds]);

  const demoLabel = (() => {
    if (license.status !== 'demo' || license.remainingSeconds == null) return null;
    const remaining = Math.max(0, license.remainingSeconds - tick * 60);
    return formatRemaining(remaining);
  })();

  useEffect(() => {
    document.documentElement.dataset.theme = me?.theme ?? 'light';
  }, [me?.theme]);

  useEffect(() => {
    setDocumentTitle(sectionTitle(loc.pathname));
    resetPageScrollLock();
  }, [loc.pathname]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!themeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setThemeOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      const root = themePopoverRef.current;
      if (root && !root.contains(e.target as Node)) setThemeOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [themeOpen]);

  if (loading) return <LoadingScreen />;
  if (!me) return <Navigate to="/login" replace state={{ from: loc }} />;

  const path = loc.pathname;
  const canHome = hasPermission(me, 'nav.home');
  const canTasks = hasPermission(me, 'nav.tasks');
  const canCompanies = hasPermission(me, 'nav.companies');
  const canClients = hasPermission(me, 'nav.clients');
  const canPolicies = hasPermission(me, 'nav.policies');
  const canAnalytics = hasPermission(me, 'nav.analytics');
  const canSettings = hasPermission(me, 'nav.settings');
  const canCreatePolicy = hasPermission(me, 'policies.create');

  const allowed =
    (path === '/' && canHome) ||
    (path === '/tasks' && canTasks) ||
    (path.startsWith('/renew/') && (canHome || canTasks || canCreatePolicy)) ||
    (path === '/policies/new' && canCreatePolicy) ||
    (path === '/companies' && canCompanies) ||
    (path === '/clients' && canClients) ||
    (path === '/policies' && canPolicies) ||
    (path === '/analytics' && canAnalytics) ||
    (path === '/settings' && canSettings);

  if (!allowed) {
    const fallback = canHome ? '/' : canTasks ? '/tasks' : '/login';
    return <Navigate to={fallback} replace />;
  }

  async function setTheme(t: 'light' | 'dark') {
    await api('/me/theme', { method: 'PATCH', body: JSON.stringify({ theme: t }) });
    document.documentElement.dataset.theme = t;
    setThemeOpen(false);
    await refresh();
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        К содержимому
      </a>
      <aside className={sidebarCollapsed ? 'sidebar sidebar--collapsed' : 'sidebar'}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-top">
            <div className="sidebar-brand-copy">
              {sidebarCollapsed ? (
                <>
                  <span className="sidebar-brand-compact" aria-hidden>
                    S
                  </span>
                  <span className="visually-hidden">SelAkCRM, Страховой учёт</span>
                </>
              ) : (
                <>
                  <span className="sidebar-brand-mark">SelAkCRM</span>
                  <span className="sidebar-brand-tag">Страховой учёт</span>
                </>
              )}
            </div>
            <Btn
              variant="ghost"
              size="icon"
              className="sidebar-toggle"
              aria-expanded={!sidebarCollapsed}
              aria-controls="app-sidebar-nav"
              aria-label={sidebarCollapsed ? 'Развернуть боковое меню' : 'Свернуть боковое меню'}
              title={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              <SidebarPrimaryBarIcon />
            </Btn>
          </div>
        </div>
        <nav id="app-sidebar-nav" className="sidebar-nav" aria-label="Основное меню">
          {canHome && (
            <NavLink to="/" end title={sidebarCollapsed ? 'Главная' : undefined}>
              <NavIcon name="home" />
              <span className="sidebar-nav-label">Главная</span>
            </NavLink>
          )}
          {canTasks && (
            <NavLink to="/tasks" title={sidebarCollapsed ? 'Задачи' : undefined}>
              <NavIcon name="tasks" />
              <span className="sidebar-nav-label">Задачи</span>
            </NavLink>
          )}
          {canCompanies && (
            <NavLink to="/companies" title={sidebarCollapsed ? 'Компании' : undefined}>
              <NavIcon name="building" />
              <span className="sidebar-nav-label">Компании</span>
            </NavLink>
          )}
          {canClients && (
            <NavLink to="/clients" title={sidebarCollapsed ? 'Клиенты' : undefined}>
              <NavIcon name="users" />
              <span className="sidebar-nav-label">Клиенты</span>
            </NavLink>
          )}
          {canPolicies && (
            <NavLink to="/policies" title={sidebarCollapsed ? 'Полисы' : undefined}>
              <NavIcon name="file" />
              <span className="sidebar-nav-label">Полисы</span>
            </NavLink>
          )}
          {canAnalytics && (
            <NavLink to="/analytics" title={sidebarCollapsed ? 'Аналитика' : undefined}>
              <NavIcon name="chart" />
              <span className="sidebar-nav-label">Аналитика</span>
            </NavLink>
          )}
          {canSettings && (
            <NavLink to="/settings" title={sidebarCollapsed ? 'Настройки' : undefined}>
              <NavIcon name="gear" />
              <span className="sidebar-nav-label">Настройки</span>
            </NavLink>
          )}
        </nav>
        {!sidebarCollapsed ? (
          <p className="sidebar-license mono" aria-live="polite">
            v{license.productVersion || '—'}
            {license.status === 'demo' && demoLabel ? ` · Демо: ${demoLabel}` : null}
            {license.status === 'full' ? ' · Лицензия активна' : null}
          </p>
        ) : null}
      </aside>
      <div className="app-main-col">
        <header className="topbar">
          <span className="topbar-title">{sectionTitle(loc.pathname)}</span>
          <div className="topbar-actions">
            <div className="topbar-user">
              <Badge>{me.login}</Badge>
            </div>
            <div className="popover-anchor" ref={themePopoverRef}>
              <Btn
                variant="ghost"
                size="sm"
                aria-expanded={themeOpen}
                aria-haspopup="menu"
                onClick={() => setThemeOpen((v) => !v)}
              >
                Тема
              </Btn>
              {themeOpen && (
                <div className="theme-popover" role="menu">
                  <Btn variant="ghost" size="sm" role="menuitem" onClick={() => void setTheme('light')}>
                    Светлая
                  </Btn>
                  <Btn variant="ghost" size="sm" role="menuitem" onClick={() => void setTheme('dark')}>
                    Тёмная
                  </Btn>
                </div>
              )}
            </div>
            <Btn variant="ghost" size="sm" onClick={() => logout()}>
              Выход
            </Btn>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
