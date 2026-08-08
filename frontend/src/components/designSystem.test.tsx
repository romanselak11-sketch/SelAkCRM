import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmptyHint } from './EmptyHint';
import { Card, CardHeader } from './Card';
import {
  DataTable,
  DataTableEmpty,
  DataTableClickRow,
  DataTableActionCell,
  DataTableTd,
  DataTableTh,
} from './DataTable';
import { FormActions, FormError } from './FormActions';
import { ListToolbar, ListSearchInput } from './ListToolbar';
import { Badge } from './Badge';
import { AuthCard } from './AuthCard';
import { LoadingScreen } from './LoadingScreen';
import { EntityList, EntityListItem, EntityListMeta } from './EntityList';
import { AuditLog, AuditLogItem } from './AuditLog';
import { LabelCaps, SurfacePanel } from './SurfacePanel';
import { ListPaginationFooter } from './ListPaginationFooter';
import { TaskStatusBadge } from './TaskStatusBadge';

describe('design system layout components', () => {
  it('EmptyHint variants', () => {
    expect(renderToStaticMarkup(<EmptyHint variant="inCell">Нет</EmptyHint>)).toContain(
      'empty-hint--in-cell',
    );
    expect(renderToStaticMarkup(<EmptyHint variant="chart">…</EmptyHint>)).toContain(
      'empty-hint--chart',
    );
  });

  it('Card + header', () => {
    const html = renderToStaticMarkup(
      <Card>
        <CardHeader title="Список" />
        content
      </Card>,
    );
    expect(html).toContain('card-header');
    expect(html).toContain('card-title');
  });

  it('DataTable empty + click row + numeric/date cells', () => {
    const html = renderToStaticMarkup(
      <DataTable>
        <thead>
          <tr>
            <DataTableTh>Имя</DataTableTh>
            <DataTableTh numeric>Сумма</DataTableTh>
            <DataTableTh date>Дата</DataTableTh>
          </tr>
        </thead>
        <tbody>
          <DataTableEmpty colSpan={2}>Пусто</DataTableEmpty>
          <DataTableClickRow onActivate={() => undefined} ariaLabel="Открыть">
            <DataTableTd>A</DataTableTd>
            <DataTableTd numeric>100</DataTableTd>
            <DataTableTd date>01.01.2026</DataTableTd>
            <DataTableActionCell>
              <span>act</span>
            </DataTableActionCell>
          </DataTableClickRow>
        </tbody>
      </DataTable>,
    );
    expect(html).toContain('data-table-wrap');
    expect(html).toContain('data-table__empty-row');
    expect(html).toContain('data-table__click-row');
    expect(html).toContain('col--narrow');
    expect(html).toContain('data-table__actions');
    expect(html).toContain('col--num');
    expect(html).toContain('col--date');
  });

  it('DataTable fit-колонка с ellipsis', () => {
    const html = renderToStaticMarkup(
      <DataTable>
        <tbody>
          <tr>
            <DataTableTd fit title="Просрочена на 25 дн. 17ч 42м">
              Просрочена на 25 дн. 17ч 42м
            </DataTableTd>
          </tr>
        </tbody>
      </DataTable>,
    );
    expect(html).toContain('col--fit');
    expect(html).toContain('title="Просрочена на 25 дн. 17ч 42м"');
  });

  it('TaskStatusBadge — точка + текст', () => {
    const html = renderToStaticMarkup(<TaskStatusBadge status="IN_PROGRESS" />);
    expect(html).toContain('task-status-badge__dot');
    expect(html).toContain('В работу');
    expect(html).toContain('task-status-badge--in-progress');
  });

  it('FormActions flush + FormError', () => {
    expect(renderToStaticMarkup(<FormActions flush>x</FormActions>)).toContain(
      'form-actions--flush',
    );
    expect(renderToStaticMarkup(<FormError>Ошибка</FormError>)).toContain('role="alert"');
    expect(renderToStaticMarkup(<FormError>{null}</FormError>)).toBe('');
  });

  it('ListToolbar + search', () => {
    const html = renderToStaticMarkup(
      <ListToolbar>
        <ListSearchInput
          value=""
          onChange={() => undefined}
          placeholder="Поиск"
          aria-label="Поиск"
        />
      </ListToolbar>,
    );
    expect(html).toContain('list-toolbar');
    expect(html).toContain('type="search"');
  });

  it('Badge + AuthCard + LoadingScreen', () => {
    expect(renderToStaticMarkup(<Badge variant="accent">u</Badge>)).toContain('badge--accent');
    expect(
      renderToStaticMarkup(
        <AuthCard brand="X" title="Вход" subtitle="sub">
          form
        </AuthCard>,
      ),
    ).toContain('auth-card');
    expect(renderToStaticMarkup(<LoadingScreen />)).toContain('loading-screen');
  });

  it('EntityList + AuditLog + SurfacePanel', () => {
    expect(
      renderToStaticMarkup(
        <EntityList spaced>
          <EntityListItem active>
            item <EntityListMeta>meta</EntityListMeta>
          </EntityListItem>
        </EntityList>,
      ),
    ).toContain('entity-list__item--active');
    expect(
      renderToStaticMarkup(
        <AuditLog>
          <AuditLogItem dateTime="2026-01-01T00:00:00Z" timeLabel="t">
            desc
          </AuditLogItem>
        </AuditLog>,
      ),
    ).toContain('audit-log-item');
    expect(
      renderToStaticMarkup(
        <SurfacePanel pad>
          <LabelCaps>Период</LabelCaps>
        </SurfacePanel>,
      ),
    ).toContain('surface-panel--pad');
  });

  it('ListPaginationFooter full + page-size', () => {
    const html = renderToStaticMarkup(
      <ListPaginationFooter
        total={40}
        page={2}
        limit={25}
        onPageChange={() => undefined}
        onLimitChange={() => undefined}
        navAriaLabel="Страницы"
      />,
    );
    expect(html).toContain('audit-footer');
    expect(html).toContain('audit-footer__page-size');
    expect(html).toContain('Записей на странице');
    expect(html).toContain('scrollable-choice');
    expect(html).not.toContain('<select');
  });
});
