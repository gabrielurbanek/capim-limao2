export type DashboardPeriod = 'today' | '7' | '30' | '90' | 'custom';
export interface DateWindow { start: Date; end: Date; days: number }
export interface TrendBucket { key: string; label: string }

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]); const month = Number(match[2]) - 1; const day = Number(match[3]);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

function calendarDays(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / 86_400_000) + 1;
}

export function createDashboardWindow(period: DashboardPeriod, customStart: string, customEnd: string, now = new Date()): DateWindow | null {
  let start: Date; let end: Date;
  if (period === 'custom') {
    const parsedStart = parseLocalDate(customStart); const parsedEnd = parseLocalDate(customEnd);
    if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) return null;
    start = parsedStart;
    end = new Date(parsedEnd);
    end.setHours(23, 59, 59, 999);
  } else {
    end = new Date(now);
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = period === 'today' ? 1 : Number(period);
    start.setDate(start.getDate() - days + 1);
  }
  return { start, end, days: calendarDays(start, end) };
}

export function createTrendBuckets(window: DateWindow): TrendBucket[] {
  const monthly = window.days > 90;
  const cursor = new Date(window.start.getFullYear(), window.start.getMonth(), monthly ? 1 : window.start.getDate());
  const last = new Date(window.end.getFullYear(), window.end.getMonth(), monthly ? 1 : window.end.getDate());
  const buckets: TrendBucket[] = [];
  while (cursor <= last) {
    const key = monthly
      ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      : `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    const label = monthly
      ? cursor.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      : cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    buckets.push({ key, label });
    if (monthly) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

export function trendDateKey(date: Date, monthly: boolean): string {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0');
  return monthly ? `${year}-${month}` : `${year}-${month}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
