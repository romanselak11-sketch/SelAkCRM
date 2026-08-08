import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIST_PAGE_SIZE,
  LIST_PAGE_SIZES,
  buildListQueryString,
} from './listPagination';

describe('listPagination', () => {
  it('дефолт размера страницы входит в допустимые варианты', () => {
    expect(LIST_PAGE_SIZES).toContain(DEFAULT_LIST_PAGE_SIZE);
    expect(DEFAULT_LIST_PAGE_SIZE).toBe(25);
  });

  it('buildListQueryString передаёт limit как есть', () => {
    expect(buildListQueryString(1, DEFAULT_LIST_PAGE_SIZE)).toBe('page=1&limit=25');
  });
});
