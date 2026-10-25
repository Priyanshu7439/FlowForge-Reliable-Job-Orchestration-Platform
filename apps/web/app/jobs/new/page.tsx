'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { AppShell } from '../../../components/shell';
import { buildStudioPayload, createStudioRecord, isStudioJobType, studioJobTypes, validateStudioInput, type StudioFormValues, type StudioJobType } from '../../../lib/job-studio';

const initialValues: StudioFormValues = {
  records: [{ name: 'Ada', team: 'Platform', value: '' }],
  select: 'name, team',
  csv: 'name,team\nAda,Platform\n',
  failUntilAttempt: 1,
};

const descriptions: Record<StudioJobType, string> = {
  JSON_TRANSFORM: 'Select fields from a small set of structured records.',
  CSV_VALIDATE: 'Validate headers, rows, duplicates, and missing values.',
  REPORT_GENERATE: 'Generate a structured processing report from records.',
  FAILURE_SIMULATION: 'Demonstrate bounded retry behavior in development.',
};

export default function NewJob() {
  const router = useRouter();
  const [type, setType] = useState<StudioJobType>('JSON_TRANSFORM');
  const [values, setValues] = useState<StudioFormValues>(initialValues);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const payload = useMemo(() => buildStudioPayload(type, values), [type, values]);

  const updateRecord = (index: number, field: keyof StudioFormValues['records'][number], value: string) => {
    setValues((current) => ({ ...current, records: current.records.map((record, recordIndex) => recordIndex === index ? { ...record, [field]: value } : record) }));
  };

  const changeType = (nextType: StudioJobType) => {
    setType(nextType);
    setError('');
  };

  const readCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) { setError('CSV files must be smaller than 2 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setValues((current) => ({ ...current, csv: typeof reader.result === 'string' ? reader.result : '' }));
    reader.onerror = () => setError('Unable to read that CSV file.');
    reader.readAsText(file);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateStudioInput(type, values);
    if (validationError) { setError(validationError); return; }
    setBusy(true);
    setError('');
    try {
      const result = await api<{ job: { id: string } }>('/jobs', { method: 'POST', body: JSON.stringify({ type, payload, idempotencyKey: `studio-${crypto.randomUUID()}` }) });
      router.push(`/jobs/${result.job.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit job');
    } finally {
      setBusy(false);
    }
  };

  return <AppShell active="/jobs/new">
    <main className="main">
      <div className="topline"><div><div className="eyebrow">Job studio / new execution</div><h1>Submit a job</h1><p className="subtle">Configure a supported task with guided inputs before it enters the queue.</p></div></div>
      <form className="panel studio-form" onSubmit={submit}>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="field"><label htmlFor="type">Task type</label><select id="type" value={type} onChange={(event) => { if (isStudioJobType(event.target.value)) changeType(event.target.value); }}>{studioJobTypes.map((jobType) => <option key={jobType} value={jobType}>{jobType.replaceAll('_', ' ')}</option>)}</select><span className="subtle">{descriptions[type]}</span></div>
        {(type === 'JSON_TRANSFORM' || type === 'REPORT_GENERATE') && <>
          <div className="studio-section"><div><h2 className="panel-title">Records</h2><p className="subtle">Add values to the fields you want to process. Empty fields are omitted from the payload.</p></div><div className="record-list">{values.records.map((record, index) => <div className="record-row" key={`record-${index}`}><label><span className="sr-only">Record {index + 1} name</span><input value={record.name} onChange={(event) => updateRecord(index, 'name', event.target.value)} placeholder="Name" /></label><label><span className="sr-only">Record {index + 1} team</span><input value={record.team} onChange={(event) => updateRecord(index, 'team', event.target.value)} placeholder="Team" /></label><label><span className="sr-only">Record {index + 1} value</span><input value={record.value} onChange={(event) => updateRecord(index, 'value', event.target.value)} placeholder="Value (optional)" /></label><button type="button" className="button" aria-label={`Remove record ${index + 1}`} onClick={() => setValues((current) => ({ ...current, records: current.records.filter((_, recordIndex) => recordIndex !== index) }))}>Remove</button></div>)}</div><button type="button" className="button" onClick={() => setValues((current) => ({ ...current, records: [...current.records, createStudioRecord()] }))}>+ Add record</button></div>
          <div className="field"><label htmlFor="select">Fields to keep <span className="subtle">(optional)</span></label><input id="select" value={values.select} onChange={(event) => setValues((current) => ({ ...current, select: event.target.value }))} placeholder="name, team" /><span className="subtle">Use comma-separated field names, or leave empty to keep every field.</span></div>
        </>}
        {type === 'CSV_VALIDATE' && <div className="field"><label htmlFor="csv-file">CSV input</label><input id="csv-file" type="file" accept=".csv,text/csv" onChange={readCsv} /><textarea aria-label="CSV content" rows={9} value={values.csv} onChange={(event) => setValues((current) => ({ ...current, csv: event.target.value }))} /><span className="subtle">Maximum 2 MB. The executor validates the header and row content.</span></div>}
        {type === 'FAILURE_SIMULATION' && <div className="field"><label htmlFor="fail-until">Fail attempts before recovery</label><input id="fail-until" type="number" min={1} max={3} value={values.failUntilAttempt} onChange={(event) => setValues((current) => ({ ...current, failUntilAttempt: Number(event.target.value) }))} /><span className="subtle">Development demonstration only; the worker still enforces its retry limit.</span></div>}
        <details className="payload-preview"><summary>Preview request payload</summary><pre className="result">{JSON.stringify({ type, payload }, null, 2)}</pre></details>
        <div className="actions"><button className="button primary" disabled={busy} type="submit">{busy ? 'Submitting...' : 'Submit job'}</button><button className="button" type="button" onClick={() => router.push('/dashboard')}>Cancel</button></div>
      </form>
    </main>
  </AppShell>;
}
