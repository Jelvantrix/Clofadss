import React, { useEffect, useMemo, useState } from 'react';
import { BosClientError, bosFetch } from '../../bos/client';
import { useTaskRecords } from './useTaskRecords';
import type { TaskData, TaskDefinition, TaskField, TaskOption, TaskValues } from './types';

interface TaskFormProps {
  task: TaskDefinition;
  data: TaskData;
  previewMode?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const defaultsFor = (task: TaskDefinition): TaskValues => {
  const values: TaskValues = {};
  for (const field of task.fields) {
    if (field.defaultValue !== undefined) {
      values[field.name] =
        typeof field.defaultValue === 'number' ? String(field.defaultValue) : field.defaultValue;
    } else if (field.type === 'checkbox') {
      values[field.name] = false;
    } else if (field.type === 'multirecord') {
      values[field.name] = [];
    } else {
      values[field.name] = '';
    }
  }
  return values;
};

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const fieldValue = (values: TaskValues, name: string) => values[name];

const FieldShell: React.FC<{
  field: TaskField;
  error?: string;
  children: React.ReactNode;
}> = ({ field, error, children }) => (
  <div className={`bos-task-field ${field.wide ? 'is-wide' : ''}`}>
    <label htmlFor={`task-${field.name}`}>
      {field.label}
      {field.required ? <span className="bos-task-req"> · required</span> : null}
    </label>
    {children}
    {field.help && !error ? <small className="bos-task-help">{field.help}</small> : null}
    {error ? <small className="bos-task-error">{error}</small> : null}
  </div>
);

const MultiRecord: React.FC<{
  field: TaskField;
  options: TaskOption[];
  value: string[];
  loading?: boolean;
  error?: string;
  onChange: (value: string[]) => void;
}> = ({ field, options, value, loading, error, onChange }) => {
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const visible = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;

  if (loading) {
    return <div className="bos-task-loading">Loading the list…</div>;
  }
  if (error) {
    return <div className="bos-task-loadwarning">{error}</div>;
  }
  if (options.length === 0) {
    return <div className="bos-task-empty">Nothing is available to choose here yet.</div>;
  }

  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((entry) => entry !== optionValue)
        : [...value, optionValue]
    );
  };

  return (
    <div className="bos-task-multi">
      {options.length > 8 && (
        <input
          type="search"
          className="bos-task-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search…"
          aria-label={`Search ${field.label}`}
        />
      )}
      <div className="bos-task-multilist" role="group" aria-label={field.label}>
        {visible.length === 0 ? (
          <div className="bos-task-empty">No matches.</div>
        ) : (
          visible.map((option) => (
            <label key={option.value} className="bos-task-checkrow">
              <input
                type="checkbox"
                checked={value.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))
        )}
      </div>
      <small className="bos-task-help">
        {value.length === 0 ? 'Nothing selected yet.' : `${value.length} selected.`}
      </small>
    </div>
  );
};

export const TaskForm: React.FC<TaskFormProps> = ({
  task,
  data,
  previewMode = false,
  onClose,
  onSaved,
}) => {
  const sources = useMemo(
    () => task.fields.flatMap((field) => (field.source ? [field.source] : [])),
    [task]
  );
  const records = useTaskRecords(sources, data);
  const [values, setValues] = useState<TaskValues>(() => defaultsFor(task));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setValues(defaultsFor(task));
    setErrors({});
    setFailure('');
    setSuccess('');
    setConfirmed(false);
  }, [task]);

  const setValue = (name: string, value: string | boolean | string[]) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const validate = () => {
    const next: Record<string, string> = {};
    for (const field of task.fields) {
      const raw = fieldValue(values, field.name);
      const empty =
        raw === undefined ||
        raw === '' ||
        (field.type === 'multirecord' && (!Array.isArray(raw) || raw.length === 0));
      if (field.required && empty) {
        next[field.name] =
          field.type === 'multirecord' ? 'Choose at least one.' : 'Please fill this in.';
        continue;
      }
      if (empty) continue;
      if (field.type === 'email' && !isEmail(String(raw))) {
        next[field.name] = 'Enter a valid email address.';
      }
      if ((field.type === 'number' || field.type === 'money') && Number.isNaN(Number(raw))) {
        next[field.name] = 'Enter a number.';
      }
      if (field.type === 'date' && Number.isNaN(Date.parse(String(raw)))) {
        next[field.name] = 'Choose a valid date.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = () => {
    const input: Record<string, unknown> = {};
    for (const field of task.fields) {
      const raw = fieldValue(values, field.name);
      if (field.type === 'checkbox') {
        input[field.name] = Boolean(raw);
        continue;
      }
      if (field.type === 'multirecord') {
        input[field.name] = Array.isArray(raw) ? raw : [];
        continue;
      }
      if (raw === undefined || raw === '') continue;
      if (field.type === 'money') {
        input[field.name] = Math.round(Number(raw) * 100);
      } else if (field.type === 'number') {
        input[field.name] = Number(raw);
      } else if (field.type === 'date') {
        input[field.name] = new Date(String(raw)).toISOString();
      } else {
        input[field.name] = String(raw);
      }
    }
    return task.buildInput ? task.buildInput(input) : input;
  };

  const friendlyError = (error: unknown) => {
    if (error instanceof BosClientError) {
      if (error.status === 401) return 'Your session has ended. Sign in again to keep working.';
      if (error.status === 403 || error.code === 'forbidden') {
        return 'You do not have permission to do this. Ask an owner or admin to give you access.';
      }
      if (error.status === 404) return 'We could not find that record. It may have been removed.';
      const message = String(error.message || '');
      if (/relation .* does not exist|schema cache|does not exist/i.test(message)) {
        return 'This feature is not fully connected on this site yet. Ask the administrator to finish setup.';
      }
      if (/fetch|network|Failed to fetch/i.test(message)) {
        return 'The server could not be reached. Check the connection and try again.';
      }
      return message || 'Something went wrong. Please try again.';
    }
    const message = error instanceof Error ? error.message : String(error);
    return message || 'Something went wrong. Please try again.';
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    if (task.danger && !confirmed) {
      setFailure('Tick the confirmation box before continuing.');
      return;
    }
    setRunning(true);
    setFailure('');
    try {
      await bosFetch(task.system, task.action, buildPayload());
      setSuccess(task.success || 'Saved.');
      onSaved();
    } catch (error) {
      setFailure(friendlyError(error));
    } finally {
      setRunning(false);
    }
  };

  if (success) {
    return (
      <div className="bos-task-overlay" role="dialog" aria-modal="true" aria-label={task.title}>
        <button type="button" className="bos-task-backdrop" aria-label="Close" onClick={onClose} />
        <div className="bos-task-modal bos-task-done">
          <div className="bos-task-doneicon" aria-hidden="true">
            ✓
          </div>
          <h3>Done</h3>
          <p>{success}</p>
          <button type="button" className="bos-btn bos-btn-dark" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bos-task-overlay" role="dialog" aria-modal="true" aria-label={task.title}>
      <button type="button" className="bos-task-backdrop" aria-label="Close" onClick={onClose} />
      <form className="bos-task-modal" onSubmit={(event) => void submit(event)}>
        <header className="bos-task-head">
          <div>
            <div className="bos-kicker">{task.group}</div>
            <h3>{task.title}</h3>
            <p>{task.description}</p>
          </div>
          <button type="button" className="bos-ctl-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="bos-task-body">
          {previewMode && (
            <div className="bos-note">
              This is the local preview. Saving needs a signed-in operator session.
            </div>
          )}

          <div className="bos-task-grid">
            {task.fields.map((field) => {
              const error = errors[field.name];
              const raw = fieldValue(values, field.name);

              if (field.type === 'checkbox') {
                return (
                  <FieldShell key={field.name} field={field} error={error}>
                    <label className="bos-task-toggle">
                      <input
                        id={`task-${field.name}`}
                        type="checkbox"
                        checked={Boolean(raw)}
                        onChange={(event) => setValue(field.name, event.target.checked)}
                      />
                      <span>{field.help || 'Yes'}</span>
                    </label>
                  </FieldShell>
                );
              }

              if (field.type === 'multirecord') {
                const options = field.source ? records.bySource[field.source] || [] : [];
                return (
                  <FieldShell key={field.name} field={field} error={error}>
                    <MultiRecord
                      field={field}
                      options={options}
                      value={Array.isArray(raw) ? raw : []}
                      loading={field.source ? records.loading[field.source] : false}
                      error={field.source ? records.errors[field.source] : ''}
                      onChange={(value) => setValue(field.name, value)}
                    />
                  </FieldShell>
                );
              }

              if (field.type === 'record') {
                const options = field.source ? records.bySource[field.source] || [] : [];
                const loading = field.source ? records.loading[field.source] : false;
                const loadError = field.source ? records.errors[field.source] : '';
                if (loadError) {
                  return (
                    <FieldShell key={field.name} field={field} error={error}>
                      <input
                        id={`task-${field.name}`}
                        type="text"
                        className="bos-task-input"
                        value={String(raw || '')}
                        onChange={(event) => setValue(field.name, event.target.value)}
                        placeholder="Enter the reference"
                      />
                      <small className="bos-task-help">{loadError}</small>
                    </FieldShell>
                  );
                }
                return (
                  <FieldShell key={field.name} field={field} error={error}>
                    <select
                      id={`task-${field.name}`}
                      className="bos-task-input"
                      value={String(raw || '')}
                      onChange={(event) => setValue(field.name, event.target.value)}
                      disabled={loading}
                    >
                      <option value="">
                        {loading ? 'Loading…' : options.length === 0 ? 'Nothing available yet' : 'Choose…'}
                      </option>
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {!loading && options.length === 0 && (
                      <small className="bos-task-help">
                        There is nothing to choose here yet. Create it first, then come back.
                      </small>
                    )}
                  </FieldShell>
                );
              }

              if (field.type === 'select') {
                return (
                  <FieldShell key={field.name} field={field} error={error}>
                    <select
                      id={`task-${field.name}`}
                      className="bos-task-input"
                      value={String(raw || '')}
                      onChange={(event) => setValue(field.name, event.target.value)}
                    >
                      <option value="">Choose…</option>
                      {(field.options || []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FieldShell>
                );
              }

              if (field.type === 'textarea') {
                return (
                  <FieldShell key={field.name} field={field} error={error}>
                    <textarea
                      id={`task-${field.name}`}
                      className="bos-task-input"
                      rows={4}
                      value={String(raw || '')}
                      onChange={(event) => setValue(field.name, event.target.value)}
                      placeholder={field.placeholder}
                    />
                  </FieldShell>
                );
              }

              if (field.type === 'money') {
                return (
                  <FieldShell key={field.name} field={field} error={error}>
                    <div className="bos-task-money">
                      <span aria-hidden="true">€</span>
                      <input
                        id={`task-${field.name}`}
                        type="number"
                        className="bos-task-input"
                        min={field.min ?? 0}
                        max={field.max}
                        step={field.step ?? 0.01}
                        value={String(raw ?? '')}
                        onChange={(event) => setValue(field.name, event.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </FieldShell>
                );
              }

              return (
                <FieldShell key={field.name} field={field} error={error}>
                  <input
                    id={`task-${field.name}`}
                    type={
                      field.type === 'email'
                        ? 'email'
                        : field.type === 'number'
                          ? 'number'
                          : field.type === 'date'
                            ? 'date'
                            : 'text'
                    }
                    className="bos-task-input"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={String(raw ?? '')}
                    onChange={(event) => setValue(field.name, event.target.value)}
                    placeholder={field.placeholder}
                  />
                </FieldShell>
              );
            })}
          </div>

          {task.danger && (
            <div className="bos-task-danger">
              <b>This cannot be undone.</b>
              <label className="bos-task-toggle">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>I understand this is permanent.</span>
              </label>
            </div>
          )}

          {failure && (
            <div className="bos-task-failure" role="alert">
              <b>That did not work</b>
              <span>{failure}</span>
            </div>
          )}
        </div>

        <footer className="bos-task-foot">
          <button type="button" className="bos-btn" onClick={onClose} disabled={running}>
            Cancel
          </button>
          <button
            type="submit"
            className={`bos-btn ${task.danger ? 'bos-btn-danger' : 'bos-btn-dark'}`}
            disabled={running || (task.danger && !confirmed)}
          >
            {running ? 'Saving…' : task.submitLabel || 'Save'}
          </button>
        </footer>
      </form>
    </div>
  );
};

export default TaskForm;
