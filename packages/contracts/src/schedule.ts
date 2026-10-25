export interface CronParts {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]] as const;

function parseField(value: string, minimum: number, maximum: number): number[] {
  if (value === '*') return Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);
  const values = new Set<number>();
  for (const part of value.split(',')) {
    const [base, stepText] = part.split('/');
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1 || (base !== '*' && !/^\d+$/.test(base))) throw new Error('Invalid cron field');
    const start = base === '*' ? minimum : Number(base);
    if (start < minimum || start > maximum) throw new Error('Cron value out of range');
    for (let current = start; current <= maximum; current += step) values.add(current);
  }
  return [...values].sort((left, right) => left - right);
}

export function parseCron(expression: string): CronParts {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error('Cron expression must contain five fields');
  return {
    minute: parseField(fields[0], ...ranges[0]),
    hour: parseField(fields[1], ...ranges[1]),
    dayOfMonth: parseField(fields[2], ...ranges[2]),
    month: parseField(fields[3], ...ranges[3]),
    dayOfWeek: parseField(fields[4], ...ranges[4]),
  };
}

export function validateTimezone(timezone: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); return true; } catch { return false; }
}

function localParts(date: Date, timezone: string): { minute: number; hour: number; dayOfMonth: number; month: number; dayOfWeek: number } {
  const values = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour12: false, weekday: 'short', minute: '2-digit', hour: '2-digit', day: '2-digit', month: '2-digit' }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => values.find((part) => part.type === type)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { minute: Number(get('minute')), hour: Number(get('hour')) % 24, dayOfMonth: Number(get('day')), month: Number(get('month')), dayOfWeek: weekday };
}

export function nextCronOccurrence(expression: string, timezone: string, after: Date): Date {
  const cron = parseCron(expression);
  if (!validateTimezone(timezone)) throw new Error('Invalid timezone');
  const candidate = new Date(after);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  for (let index = 0; index < 366 * 24 * 60; index += 1) {
    const parts = localParts(candidate, timezone);
    const dayMatches = cron.dayOfMonth.includes(parts.dayOfMonth) && cron.dayOfWeek.includes(parts.dayOfWeek);
    if (cron.minute.includes(parts.minute) && cron.hour.includes(parts.hour) && cron.month.includes(parts.month) && dayMatches) return new Date(candidate);
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  throw new Error('Cron expression has no occurrence within one year');
}
