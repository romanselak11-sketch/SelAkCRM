import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Btn } from './Btn';

export type HintTooltipProps = {
  children: ReactNode;
  /** Связь с aria-describedby у контрола */
  id?: string;
  /** Подпись кнопки для скринридеров */
  ariaLabel?: string;
  className?: string;
};

type TipPos = { top: number; left: number };

function clampTipPosition(btn: DOMRect, tipWidth: number, tipHeight: number): TipPos {
  const gap = 8;
  const pad = 8;
  let top = btn.top - tipHeight - gap;
  let left = btn.left + btn.width / 2 - tipWidth / 2;

  left = Math.max(pad, Math.min(left, window.innerWidth - tipWidth - pad));
  if (top < pad) {
    top = btn.bottom + gap;
  }
  const maxTop = window.innerHeight - tipHeight - pad;
  top = Math.max(pad, Math.min(top, maxTop));

  return { top, left };
}

function samePos(a: TipPos | null, b: TipPos): boolean {
  return a != null && a.top === b.top && a.left === b.left;
}

/** Значок «?» с текстом подсказки при наведении / фокусе (поверх модалок). */
export function HintTooltip({
  children,
  id,
  ariaLabel = 'Подсказка',
  className,
}: HintTooltipProps) {
  const generatedId = useId();
  const tipId = id ?? generatedId;
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const refinedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<TipPos | null>(null);

  const updatePosition = useCallback(() => {
    const btn = btnRef.current;
    const tip = tipRef.current;
    if (!btn || !tip) return;
    const next = clampTipPosition(
      btn.getBoundingClientRect(),
      tip.offsetWidth,
      tip.offsetHeight,
    );
    setPos((prev) => (samePos(prev, next) ? prev : next));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      refinedRef.current = false;
      setPos(null);
      return;
    }
    updatePosition();
    const onReposition = () => updatePosition();
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open, children, updatePosition]);

  // Один уточняющий проход после первой расстановки (ширина/высота после layout).
  useLayoutEffect(() => {
    if (!open || !pos || refinedRef.current) return;
    refinedRef.current = true;
    updatePosition();
  }, [open, pos, updatePosition]);

  const tip = (
    <span
      ref={tipRef}
      id={tipId}
      className={[
        'hint-tip__tooltip',
        open ? 'hint-tip__tooltip--ready' : 'hint-tip__tooltip--closed',
        open && pos ? 'hint-tip__tooltip--open' : null,
      ]
        .filter(Boolean)
        .join(' ')}
      role="tooltip"
      aria-hidden={!open}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0 }}
    >
      {children}
    </span>
  );

  return (
    <span
      className={['hint-tip', className].filter(Boolean).join(' ')}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <Btn
        ref={btnRef}
        variant="ghost"
        size="icon"
        className="btn--hint"
        aria-describedby={open ? tipId : undefined}
        aria-label={ariaLabel}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        ?
      </Btn>
      {typeof document !== 'undefined' ? createPortal(tip, document.body) : tip}
    </span>
  );
}
