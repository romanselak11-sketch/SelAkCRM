import type { ReactNode } from 'react';
import { Btn } from './Btn';
import { Stack } from './Stack';

export type PaginationControlsProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  ariaLabel: string;
  /** Центральный блок: номера страниц, текст «Страница N из M» и т.п. */
  center: ReactNode;
  backLabel?: string;
  forwardLabel?: string;
  className?: string;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
};

/**
 * Назад · центр · Вперёд — общая разметка пагинации с едиными отступами.
 */
export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  ariaLabel,
  center,
  backLabel = 'Назад',
  forwardLabel = 'Вперёд',
  className,
  prevDisabled,
  nextDisabled,
}: PaginationControlsProps) {
  return (
    <nav className={['pagination-controls', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      <Stack direction="row" gap={3} align="center" justify="center" wrap className="pagination-controls__inner">
        <Btn
          variant="ghost"
          size="sm"
          disabled={prevDisabled ?? page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          {backLabel}
        </Btn>
        {center}
        <Btn
          variant="ghost"
          size="sm"
          disabled={nextDisabled ?? page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          {forwardLabel}
        </Btn>
      </Stack>
    </nav>
  );
}
