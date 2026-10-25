export const studioJobTypes = ['JSON_TRANSFORM', 'CSV_VALIDATE', 'REPORT_GENERATE', 'FAILURE_SIMULATION'] as const;
export type StudioJobType = (typeof studioJobTypes)[number];

export function isStudioJobType(value: string): value is StudioJobType {
  return (studioJobTypes as readonly string[]).includes(value);
}

export interface StudioRecord {
  name: string;
  team: string;
  value: string;
}

export interface StudioFormValues {
  records: StudioRecord[];
  select: string;
  csv: string;
  failUntilAttempt: number;
}

export function createStudioRecord(): StudioRecord {
  return { name: '', team: '', value: '' };
}

function normalizedRecords(records: StudioRecord[]): Array<Record<string, string>> {
  return records
    .map((record) => Object.fromEntries(Object.entries(record).filter(([, value]) => value.trim().length > 0)))
    .filter((record) => Object.keys(record).length > 0);
}

export function buildStudioPayload(type: StudioJobType, values: StudioFormValues): Record<string, unknown> {
  if (type === 'CSV_VALIDATE') return { csv: values.csv };
  if (type === 'FAILURE_SIMULATION') return { failUntilAttempt: values.failUntilAttempt };
  const records = normalizedRecords(values.records);
  const select = values.select.split(',').map((field) => field.trim()).filter(Boolean);
  return select.length ? { records, select } : { records };
}

export function validateStudioInput(type: StudioJobType, values: StudioFormValues): string | null {
  if (type === 'CSV_VALIDATE' && values.csv.trim().length === 0) return 'Add CSV content or choose a CSV file.';
  if ((type === 'JSON_TRANSFORM' || type === 'REPORT_GENERATE') && normalizedRecords(values.records).length === 0) return 'Add at least one record.';
  if (type === 'FAILURE_SIMULATION' && (!Number.isInteger(values.failUntilAttempt) || values.failUntilAttempt < 1 || values.failUntilAttempt > 3)) return 'Failure attempts must be between 1 and 3.';
  return null;
}
