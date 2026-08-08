import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { activateOnEnterOrSpace } from '../utils/tableRowActivate';
import { EmptyHint } from './EmptyHint';

export function DataTable({
  className,
  children,
  ...rest
}: { children: ReactNode; className?: string } & Omit<
  HTMLAttributes<HTMLTableElement>,
  'className' | 'children'
>) {
  return (
    <div className="data-table-wrap">
      <table className={['data-table', className].filter(Boolean).join(' ')} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function DataTableRow({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & Omit<
  HTMLAttributes<HTMLTableRowElement>,
  'className' | 'children'
>) {
  return (
    <tr className={className} {...rest}>
      {children}
    </tr>
  );
}

export type DataTableClickRowProps = {
  children: ReactNode;
  onActivate: () => void;
  ariaLabel: string;
  className?: string;
};

/** Кликабельная строка реестра (Enter/Space + focus). */
export function DataTableClickRow({
  children,
  onActivate,
  ariaLabel,
  className,
}: DataTableClickRowProps) {
  return (
    <tr
      className={['data-table__click-row', className].filter(Boolean).join(' ')}
      onClick={onActivate}
      onKeyDown={(e) => activateOnEnterOrSpace(e, onActivate)}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
    >
      {children}
    </tr>
  );
}

export function DataTableEmpty({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr className="data-table__empty-row">
      <td colSpan={colSpan}>
        <EmptyHint variant="inCell">{children}</EmptyHint>
      </td>
    </tr>
  );
}

export function DataTableTh({
  narrow,
  numeric,
  date,
  fit,
  children,
  className,
  ...rest
}: {
  narrow?: boolean;
  /** Числа/суммы: mono + выравнивание вправо */
  numeric?: boolean;
  /** Короткие даты: mono, заголовок слева */
  date?: boolean;
  /** Колонка по ширине контента, без обрезки (сроки, статусы) */
  fit?: boolean;
  children?: ReactNode;
  className?: string;
} & Omit<ThHTMLAttributes<HTMLTableCellElement>, 'className' | 'children'>) {
  return (
    <th
      className={
        [
          narrow ? 'col--narrow' : undefined,
          numeric ? 'col--num' : undefined,
          date ? 'col--date' : undefined,
          fit ? 'col--fit' : undefined,
          className,
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
      {...rest}
    >
      {children}
    </th>
  );
}

export function DataTableTd({
  narrow,
  numeric,
  date,
  fit,
  children,
  className,
  ...rest
}: {
  narrow?: boolean;
  numeric?: boolean;
  date?: boolean;
  fit?: boolean;
  children?: ReactNode;
  className?: string;
} & Omit<TdHTMLAttributes<HTMLTableCellElement>, 'className' | 'children'>) {
  return (
    <td
      className={
        [
          narrow ? 'col--narrow' : undefined,
          numeric ? 'col--num' : undefined,
          date ? 'col--date' : undefined,
          fit ? 'col--fit' : undefined,
          className,
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
      {...rest}
    >
      {children}
    </td>
  );
}

/** Ячейка действий: stopPropagation, чтобы клик по кнопке не открывал строку. */
export function DataTableActionCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={['col--narrow', 'data-table__actions', className].filter(Boolean).join(' ')}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="data-table__actions-inner">{children}</div>
    </td>
  );
}

export function DataTableClipCell({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <td className="data-table__cell--clip" title={title}>
      {children}
    </td>
  );
}
