import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** When true, clicking the backdrop does not close the dialog */
  disableBackdropClose?: boolean;
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  size = 'md',
  disableBackdropClose,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
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
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
