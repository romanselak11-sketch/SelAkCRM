import { describe, expect, it } from 'vitest';
import {
  formatRenewalTaskDisplay,
  isRenewalTaskCompleted,
  isRenewalTaskOverdue,
  renewalTaskDeadlineClass,
} from './renewal-task-display';

describe('formatRenewalTaskDisplay', () => {
  it('formats days left', () => {
    expect(formatRenewalTaskDisplay({ kind: 'days', value: 5 })).toBe('5 дн.');
  });

  it('formats overdue label', () => {
    expect(formatRenewalTaskDisplay({ kind: 'overdue', value: '2 дн. 3ч 15м' })).toBe(
      'Просрочена на 2 дн. 3ч 15м',
    );
  });

  it('formats completed date', () => {
    const text = formatRenewalTaskDisplay({ kind: 'completed', value: '2026-04-30T10:31:00.000Z' });
    expect(text).toMatch(/30\.04\.2026/);
  });

  it('detects overdue', () => {
    expect(isRenewalTaskOverdue({ kind: 'overdue', value: '1 дн.' })).toBe(true);
    expect(isRenewalTaskOverdue({ kind: 'days', value: 1 })).toBe(false);
  });

  it('detects completed', () => {
    expect(isRenewalTaskCompleted({ kind: 'completed', value: '2026-01-01T00:00:00.000Z' })).toBe(true);
    expect(isRenewalTaskCompleted({ kind: 'days', value: 1 })).toBe(false);
  });

  it('maps deadline css class', () => {
    expect(renewalTaskDeadlineClass({ kind: 'overdue', value: '1 дн.' })).toBe(
      'renewal-task-deadline--overdue',
    );
    expect(renewalTaskDeadlineClass({ kind: 'completed', value: '2026-01-01T00:00:00.000Z' })).toBe(
      'renewal-task-deadline--completed',
    );
    expect(renewalTaskDeadlineClass({ kind: 'days', value: 3 })).toBeUndefined();
  });
});
