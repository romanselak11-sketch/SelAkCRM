import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const stylesDir = resolve(__dirname);

/** Каталог переиспользуемых примитивов — регрессия, что слой не «потеряется». */
const REQUIRED_PRIMITIVES = [
  '.surface-panel',
  '.surface-panel--pad',
  '.control-trigger',
  '.control-trigger--block',
  '.control-trigger--inline',
  '.control-trigger--soft',
  '.actions-row',
  '.page-actions',
  '.row-actions',
  '.field--span-all',
  '.field--flex-md',
  '.form-actions--flush',
  '.empty-hint',
  '.empty-hint--in-card',
  '.empty-hint--panel',
  '.empty-hint--chart',
  '.auth-brand',
  '.auth-heading',
  '.entity-list',
  '.entity-list__item',
  '.text-muted',
  '.text-meta',
  '.label-caps',
  '.u-mb-4',
  '.u-mb-5',
  '.u-mt-5',
  '.u-cursor-pointer',
] as const;

const REQUIRED_TOKENS = [
  '--bg-page',
  '--bg-surface',
  '--text-primary',
  '--text-secondary',
  '--border-default',
  '--border-input',
  '--accent',
  '--accent-hover',
  '--focus-outline',
  '--focus-outline-offset',
  '--focus-field-shadow',
  '--text-xs',
  '--text-base',
  '--text-3xl',
  '--btn-pad-y',
  '--btn-font',
  '--icon-btn-size',
  '--control-height',
  '--control-line-height',
  '--radius-full',
  '--on-accent',
  '--duration-fast',
  '--disabled-opacity',
  '--task-in-progress-fg',
  '--task-declined-fg',
  '--row-height',
  '--content-max',
] as const;

const STYLE_MODULES = [
  'layout.css',
  'forms.css',
  'buttons.css',
  'tables.css',
  'components.css',
  'analytics.css',
] as const;

describe('design system primitives', () => {
  const primitives = readFileSync(resolve(stylesDir, 'primitives.css'), 'utf8');
  const tokens = readFileSync(resolve(stylesDir, 'tokens.css'), 'utf8');
  const indexCss = readFileSync(resolve(stylesDir, '../index.css'), 'utf8');

  it('содержит обязательные utility/primitive-классы', () => {
    for (const sel of REQUIRED_PRIMITIVES) {
      expect(primitives, `missing ${sel}`).toContain(sel);
    }
  });

  it('токены типографики, кнопок и статусов живут в tokens.css', () => {
    for (const tok of REQUIRED_TOKENS) {
      expect(tokens, `missing ${tok}`).toContain(tok);
    }
  });

  it('модули стилей подключены через index.css', () => {
    for (const mod of STYLE_MODULES) {
      expect(existsSync(resolve(stylesDir, mod)), `file ${mod}`).toBe(true);
      expect(indexCss, `import ${mod}`).toContain(`./styles/${mod}`);
    }
  });

  it('forms.css документирует span form-actions', () => {
    const forms = readFileSync(resolve(stylesDir, 'forms.css'), 'utf8');
    expect(forms).toMatch(/form-actions[\s\S]*grid-column:\s*1\s*\/\s*-1/);
    expect(forms).toMatch(/span-all не нужен|form-actions--flush/);
  });

  it('buttons.css — единый слой btn / icon / pill / soft-active / hint / affix', () => {
    const buttons = readFileSync(resolve(stylesDir, 'buttons.css'), 'utf8');
    for (const sel of [
      '.btn {',
      '.btn--primary',
      '.btn--ghost',
      '.btn--danger-soft',
      '.btn--sm',
      '.btn--icon',
      '.btn--pill',
      '.btn--soft-active',
      '.btn--hint',
      '.btn--input-affix',
      '.badge',
    ]) {
      expect(buttons, `missing ${sel}`).toContain(sel);
    }
    expect(buttons).toContain('scale(0.96)');
    expect(buttons).toContain('.btn--hint::after');
    expect(buttons).not.toMatch(/linear-gradient/);
    expect(buttons).not.toMatch(/color:\s*#fff\b/);
    expect(buttons).not.toContain('analytics-tab');
    expect(buttons).not.toContain('button.primary');
  });

  it('Swiss Brutalism: accent единственный бренд, радиус ≤8px, без теней', () => {
    const tok = readFileSync(resolve(stylesDir, 'tokens.css'), 'utf8');
    expect(tok).toMatch(/--accent:\s*#ff4f00/i);
    expect(tok).toMatch(/--bg-page:\s*#f0f2f5/i);
    expect(tok).toMatch(/--radius-sm:\s*6px/);
    expect(tok).toMatch(/--radius-lg:\s*8px/);
    expect(tok).toMatch(/--shadow-sm:\s*none/);
    expect(tok).toContain("'Inter'");
    expect(tok).toContain("'JetBrains Mono'");
    const tables = readFileSync(resolve(stylesDir, 'tables.css'), 'utf8');
    expect(tables).toContain('col--num');
    expect(tables).toContain('var(--mono)');
    expect(tables).toContain('table-layout: fixed');
    expect(tables).toMatch(/th\.col--date[\s\S]*text-align:\s*left/);
    expect(tables).toContain('col--fit');
    expect(tables).toMatch(/col--narrow[\s\S]*min-width:\s*9rem/);
    expect(tables).toContain('data-table__actions-inner');
    const components = readFileSync(resolve(stylesDir, 'components.css'), 'utf8');
    expect(components).toContain('task-status-badge__dot');
    expect(components).not.toMatch(/task-status-badge--in-progress\s*\{[^}]*background:\s*var\(--task-in-progress-bg\)/);
  });

  it('layout.css — skip-link и logical insets для chrome', () => {
    const layout = readFileSync(resolve(stylesDir, 'layout.css'), 'utf8');
    expect(layout).toContain('.skip-link');
    expect(layout).toContain('scroll-margin-top');
    expect(layout).toContain('padding-inline-end');
    expect(layout).toContain('inset-inline-end');
  });

  it('forms.css — 16px на мобильных для полей (без iOS zoom)', () => {
    const forms = readFileSync(resolve(stylesDir, 'forms.css'), 'utf8');
    expect(forms).toMatch(/@media \(max-width:\s*720px\)[\s\S]*font-size:\s*1rem/);
  });

  it('tokens.css — forced-colors и reduced-motion для press', () => {
    const tok = readFileSync(resolve(stylesDir, 'tokens.css'), 'utf8');
    expect(tok).toContain('forced-colors: active');
    expect(tok).toContain('.btn:active:not(:disabled):not(.btn--hint)');
  });

  it('в TSX нет сырых className="btn …" вне системы', () => {
    const { readdirSync, readFileSync, statSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const root = resolve(stylesDir, '..');
    const bad: string[] = [];
    const rawBtn =
      /className=(["'`])btn(?:\s[^"'`]*)?\1|className=\{`btn\s|className=\{'btn\s|className=\{"btn\s/;
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === 'dist') continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
          continue;
        }
        if (!name.endsWith('.tsx')) continue;
        if (name === 'Btn.tsx' || name === 'Btn.test.tsx') continue;
        const text = readFileSync(p, 'utf8');
        if (rawBtn.test(text)) bad.push(p.replace(root + '/', ''));
      }
    };
    walk(root);
    expect(bad, `raw btn classes in:\n${bad.join('\n')}`).toEqual([]);
  });

  it('в TSX нет сырых DS-классов вне owning-компонентов', () => {
    const { readdirSync, readFileSync, statSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const root = resolve(stylesDir, '..');
    /** Класс → файлы, которым разрешено его эмитить. */
    const rules: Array<{ re: RegExp; allow: Set<string>; label: string }> = [
      {
        label: 'card (не модификатор)',
        re: /className=(["'`])(?:[^"'`]*\s)?card(?:\s[^"'`]*)?\1|className=\{`[^`]*\bcard\b/,
        allow: new Set([
          'components/Card.tsx',
          'components/AuthCard.tsx',
          'components/designSystem.test.tsx',
        ]),
      },
      {
        label: 'data-table-wrap / data-table',
        re: /className=(["'`])[^"'`]*\bdata-table(?:-wrap)?\b/,
        allow: new Set([
          'components/DataTable.tsx',
          'components/designSystem.test.tsx',
        ]),
      },
      {
        label: 'list-toolbar',
        re: /className=(["'`])[^"'`]*\blist-toolbar\b/,
        allow: new Set(['components/ListToolbar.tsx', 'components/designSystem.test.tsx']),
      },
      {
        label: 'empty-hint',
        re: /className=(["'`])[^"'`]*\bempty-hint\b/,
        allow: new Set(['components/EmptyHint.tsx', 'components/designSystem.test.tsx']),
      },
      {
        label: 'form-actions / form-error',
        re: /className=(["'`])[^"'`]*\bform-(?:actions|error)\b/,
        allow: new Set(['components/FormActions.tsx', 'components/designSystem.test.tsx']),
      },
      {
        label: 'loading-screen',
        re: /className=(["'`])[^"'`]*\bloading-screen\b/,
        allow: new Set(['components/LoadingScreen.tsx', 'components/designSystem.test.tsx']),
      },
      {
        label: 'entity-list',
        re: /className=(["'`])[^"'`]*\bentity-list\b/,
        allow: new Set(['components/EntityList.tsx', 'components/designSystem.test.tsx']),
      },
      {
        label: 'audit-log',
        re: /className=(["'`])[^"'`]*\baudit-log\b/,
        allow: new Set(['components/AuditLog.tsx', 'components/designSystem.test.tsx']),
      },
      {
        label: 'surface-panel',
        re: /className=(["'`])[^"'`]*\bsurface-panel\b/,
        allow: new Set(['components/SurfacePanel.tsx', 'components/designSystem.test.tsx']),
      },
      {
        label: 'label-caps',
        re: /className=(["'`])[^"'`]*\blabel-caps\b/,
        allow: new Set(['components/SurfacePanel.tsx', 'components/designSystem.test.tsx']),
      },
      {
        label: 'audit-footer',
        re: /className=(["'`])[^"'`]*\baudit-footer\b/,
        allow: new Set([
          'components/ListPaginationFooter.tsx',
          'components/designSystem.test.tsx',
        ]),
      },
    ];

    const bad: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === 'dist') continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
          continue;
        }
        if (!name.endsWith('.tsx')) continue;
        const rel = p.replace(root + '/', '');
        const text = readFileSync(p, 'utf8');
        for (const rule of rules) {
          if (rule.allow.has(rel)) continue;
          if (rule.re.test(text)) bad.push(`${rel} (${rule.label})`);
        }
      }
    };
    walk(root);
    expect(bad, `raw DS classes in:\n${bad.join('\n')}`).toEqual([]);
  });

  it('tables.css задаёт единый контракт кликабельных строк', () => {
    const tables = readFileSync(resolve(stylesDir, 'tables.css'), 'utf8');
    expect(tables).toContain('.data-table__click-row');
    expect(tables).toContain('.list-toolbar');
    expect(tables).toContain('.data-table__cell--clip');
    expect(tables).not.toContain('data-table--task-registry');
    expect(tables).not.toContain('data-table--task-rows');
  });
});
