import { describe, expect, it } from 'vitest';
import { requestDateRange } from './date-range';

describe('report calendar date ranges', () => {
  it('leaves absent bounds unrestricted', () => {
    expect(requestDateRange('', '')).toEqual({
      requestedFrom: '',
      requestedTo: '',
    });
  });
  it('includes the entire selected end day using an exclusive next midnight', () => {
    expect(requestDateRange('2026-11-13', '2026-11-13')).toEqual({
      requestedFrom: new Date(2026, 10, 13).toISOString(),
      requestedTo: new Date(2026, 10, 14).toISOString(),
    });
  });
  it('rejects inverted dates and impossible calendar dates', () => {
    expect(requestDateRange('2026-11-14', '2026-11-13')).toBeNull();
    expect(requestDateRange('2026-02-30', '')).toBeNull();
    expect(requestDateRange('', 'not-a-date')).toBeNull();
  });
});
