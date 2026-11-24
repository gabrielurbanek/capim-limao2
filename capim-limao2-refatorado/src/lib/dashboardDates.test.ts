import { describe, expect, it } from 'vitest';
import { createDashboardWindow, createTrendBuckets } from './dashboardDates';

describe('dashboard date windows', () => {
  it('covers exactly seven calendar days including today', () => {
    const window = createDashboardWindow('7', '', '', new Date(2026, 10, 24, 12));
    expect(window?.days).toBe(7);
    expect(window?.start.getDate()).toBe(18);
    expect(window?.start.getHours()).toBe(0);
  });

  it('rejects invalid and reversed custom ranges', () => {
    expect(createDashboardWindow('custom', '2026-02-30', '2026-03-01')).toBeNull();
    expect(createDashboardWindow('custom', '2026-03-02', '2026-03-01')).toBeNull();
  });

  it('uses one bucket per month for custom ranges above 90 days', () => {
    const window = createDashboardWindow('custom', '2026-01-15', '2026-05-02');
    const buckets = window ? createTrendBuckets(window) : [];
    expect(buckets.map((bucket) => bucket.key)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']);
  });
});
