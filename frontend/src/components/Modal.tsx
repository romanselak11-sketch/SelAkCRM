import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { lockPageScroll, unlockPageScroll } from '../utils/pageScrollLock';
import { Btn } from './Btn';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** When true, clicking the backdrop does not close the dialog */
  disableBackdropClose?: boolean;
  /** Дополнительный класс для области контента (например, без общего скролла). */
  bodyClassName?: string;
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  size = 'md',
  disableBackdropClose,
  bodyClassName,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    lockPageScroll();
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockPageScroll();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    return () => {
      const prev = previouslyFocusedRef.current;
      if (prev && document.contains(prev)) {
        prev.focus();
      }
      previouslyFocusedRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  const sizeClass =
    size === 'sm'
      ? 'modal-panel--sm'
      : size === 'lg'
        ? 'modal-panel--lg'
        : size === 'xl'
          ? 'modal-panel--xl'
          : 'modal-panel--md';

  return createPortal(
    <div className="modal-root" role="presentation">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Закрыть"
        onClick={() => {
          if (!disableBackdropClose) onClose();
        }}
      />
      <div
        ref={panelRef}
        className={`modal-panel ${sizeClass}`}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
      >
        <header className="modal-header">
          <div className="modal-header-text">
            <h2 id={titleId} className="modal-title">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="modal-desc">
                {description}
              </p>
            ) : null}
          </div>
          <Btn variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </Btn>
        </header>
        <div className={bodyClassName ? `modal-body ${bodyClassName}` : 'modal-body'}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
