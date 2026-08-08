/** Собирает классы кнопки-триггера (select / period). */
export function buildControlTriggerClassName(options: {
  block?: boolean;
  inline?: boolean;
  soft?: boolean;
  className?: string;
} = {}): string {
  const { block, inline, soft, className } = options;
  return [
    'control-trigger',
    block ? 'control-trigger--block' : undefined,
    inline ? 'control-trigger--inline' : undefined,
    soft ? 'control-trigger--soft' : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}
