import { describe, expect, it } from 'vitest';
import { buildControlTriggerClassName } from './controlTrigger';

describe('buildControlTriggerClassName', () => {
  it('собирает базовый класс', () => {
    expect(buildControlTriggerClassName()).toBe('control-trigger');
  });

  it('добавляет только нужные модификаторы', () => {
    expect(
      buildControlTriggerClassName({
        block: true,
        className: 'scrollable-choice__trigger',
      }),
    ).toBe('control-trigger control-trigger--block scrollable-choice__trigger');

    expect(
      buildControlTriggerClassName({
        inline: true,
        soft: true,
        className: 'analytics-period-picker__trigger',
      }),
    ).toBe(
      'control-trigger control-trigger--inline control-trigger--soft analytics-period-picker__trigger',
    );
  });
});
