import { describe, expect, it } from 'vitest';
import { formatRemaining } from './formatRemaining';

describe('formatRemaining', () => {
  it('handles boundaries', () => {
    expect(formatRemaining(0)).toBe('меньше часа');
    expect(formatRemaining(3599)).toBe('меньше часа');
    expect(formatRemaining(3600)).toBe('1 час');
    expect(formatRemaining(86399)).toMatch(/час/);
    expect(formatRemaining(86400)).toBe('1 день');
    expect(formatRemaining(2 * 86400)).toBe('2 дня');
    expect(formatRemaining(5 * 86400)).toBe('5 дней');
  });
});
