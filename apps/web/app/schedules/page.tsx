'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { AppShell, EmptyState, LoadingState, StatusBadge } from '../../components/shell';
import type { Schedule } from '../../lib/types';

const initialPayload = '{\n  "records": [{ "name": "Scheduled run" }]\n}';

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [type, setType] = useState('JSON_TRANSFORM');
  const [cronExpression, setCronExpression] = useState('*/5 * * * *');
  const [timezone, setTimezone] = useState('UTC');
  const [payload, setPayload] = useState(initialPayload);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api<{ schedules: Schedule[] }>('/schedules')
    .then((result) => setSchedules(result.schedules))
    .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load schedules'))
    .finally(() => setLoading(false));

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    void load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setType('JSON_TRANSFORM');
    setCronExpression('*/5 * * * *');
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    setPayload(initialPayload);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      const body = JSON.stringify({ type, payload: parsed, cronExpression, timezone });
      await api(editing ? `/schedules/${editing}` : '/schedules', { method: editing ? 'PATCH' : 'POST', body });
      resetForm();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid schedule payload');
    } finally {
      setBusy(false);
    }
  };

  const edit = (schedule: Schedule) => {
    setEditing(schedule.id);
    setType(schedule.type);
    setCronExpression(schedule.cronExpression);
    setTimezone(schedule.timezone);
    setPayload(JSON.stringify(schedule.payload, null, 2));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggle = async (schedule: Schedule) => {
    setError('');
    try {
      await api(`/schedules/${schedule.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !schedule.enabled }) });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update schedule');
    }
  };

  const remove = async (schedule: Schedule) => {
    if (!window.confirm(`Delete the ${schedule.type} schedule?`)) return;
    try {
      await api(`/schedules/${schedule.id}`, { method: 'DELETE' });
      if (editing === schedule.id) resetForm();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete schedule');
    }
  };

  return <AppShell active="/schedules">
    <main className="main">
      <div className="topline"><div><div className="eyebrow">Operations / recurring work</div><h1>Schedules</h1><p className="subtle">Persistent five-field cron schedules. Supported fields include literals, lists, wildcards, and steps.</p></div></div>
      {error && <div className="error" role="alert">{error}</div>}
      <section className="panel schedule-create">
        <h2 className="panel-title">{editing ? 'Edit schedule' : 'Create schedule'}</h2>
        <form className="schedule-form" onSubmit={submit}>
          <label>Task type<select value={type} onChange={(event) => setType(event.target.value)}><option>JSON_TRANSFORM</option><option>CSV_VALIDATE</option><option>REPORT_GENERATE</option><option>FAILURE_SIMULATION</option></select></label>
          <label>Cron expression<input value={cronExpression} onChange={(event) => setCronExpression(event.target.value)} placeholder="*/5 * * * *" /></label>
          <label>Timezone<input value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label>
          <label>Payload JSON<textarea rows={6} value={payload} onChange={(event) => setPayload(event.target.value)} /></label>
          <div className="actions"><button className="button primary" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Create schedule'}</button>{editing && <button type="button" className="button" onClick={resetForm}>Cancel</button>}</div>
        </form>
      </section>
      <section className="panel">
        <h2 className="panel-title">Saved schedules</h2>
        {loading ? <LoadingState label="Loading schedules..." /> : schedules.length ? <div className="schedule-list">{schedules.map((schedule) => <article className="schedule-row" key={schedule.id}>
          <div><strong>{schedule.type.replaceAll('_', ' ')}</strong><div className="mono">{schedule.cronExpression} · {schedule.timezone}</div><div className="subtle">Next {new Date(schedule.nextRunAt).toLocaleString()}{schedule.lastRunAt ? ` · Last ${new Date(schedule.lastRunAt).toLocaleString()}` : ''}</div></div>
          <div className="actions"><StatusBadge status={schedule.enabled ? 'ok' : 'unknown'} /><button className="button" onClick={() => edit(schedule)}>Edit</button><button className="button" onClick={() => toggle(schedule)}>{schedule.enabled ? 'Pause' : 'Resume'}</button><button className="button" onClick={() => remove(schedule)}>Delete</button></div>
        </article>)}</div> : <EmptyState title="No schedules yet" description="Create a recurring job definition to run work without a browser timer." />}
      </section>
    </main>
  </AppShell>;
}
