import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Btn } from './Btn';

export type OverflowMenuItem = {
  id: string;
  label: string;
  /** Деструктивное действие (отозвать и т.п.) */
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export type OverflowMenuProps = {
  items: OverflowMenuItem[];
  /** aria-label у кнопки «⋯» */
  'aria-label'?: string;
};

/** Меню строки таблицы: кнопка «⋯» и выпадающий список действий. */
export function OverflowMenu({ items, 'aria-label': ariaLabel = 'Действия' }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;

    function place() {
      const btn = btnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const menuWidth = 200;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );
      setPos({ top: rect.bottom + 4, left });
    }

    place();

    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="overflow-menu">
      <Btn
        ref={btnRef}
        type="button"
        variant="ghost"
        size="icon"
        className="overflow-menu__trigger"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="overflow-menu__dots" aria-hidden>
          ⋯
        </span>
      </Btn>
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className="overflow-menu__panel"
              role="menu"
              style={{ top: pos.top, left: pos.left }}
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={[
                    'overflow-menu__item',
                    item.danger ? 'overflow-menu__item--danger' : undefined,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
