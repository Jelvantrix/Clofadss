import React, { useMemo, useState } from 'react';
import {
  BOS_ACTION_CATALOG,
  BOS_ACTION_COUNT,
  BOS_ACTION_FLAT,
  type BosActionMeta,
  type BosActionSystemMeta,
} from '../../bos/actionCatalog';
import { bosFetch } from '../../bos/client';

/* ==========================================================================
   Control registry — every action the BOS dispatcher actually exposes.
   The registry is generated from the server manifest, so this screen cannot
   drift from what the backend can execute. Read actions need no input; write
   actions take a JSON object and always require an explicit arm step.
   ========================================================================== */

interface SelectedAction extends BosActionMeta {
  systemId: string;
  systemName: string;
  screen: string;
}

export interface AdminControlsViewProps {
  onOpenScreen: (screenId: string) => void;
  onOpenTasks?: () => void;
  contextScreen?: string;
  previewMode?: boolean;
}

const isWrite = (action: BosActionMeta) => !action.permission.endsWith('.read');
const actionLabel = (name: string) => name.replace(/([a-z])([A-Z])/g, '$1 $2');

const systemsForScreen = (screen?: string): BosActionSystemMeta[] => {
  if (!screen) return [];
  return BOS_ACTION_CATALOG.filter((system) => system.screen === screen);
};

const pretty = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const relativeTime = (date: Date) =>
  date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const AdminControlsView: React.FC<AdminControlsViewProps> = ({
  onOpenScreen,
  onOpenTasks,
  contextScreen,
  previewMode = false,
}) => {
  const contextSystems = useMemo(() => systemsForScreen(contextScreen), [contextScreen]);
  const [systemFilter, setSystemFilter] = useState<string>(() => contextSystems[0]?.systemId || 'all');
  const [mode, setMode] = useState<'all' | 'read' | 'write'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SelectedAction | null>(null);
  const [inputText, setInputText] = useState('{}');
  const [armed, setArmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<Date | null>(null);

  const totals = useMemo(() => {
    const write = BOS_ACTION_FLAT.filter(isWrite).length;
    return { all: BOS_ACTION_COUNT, read: BOS_ACTION_COUNT - write, write };
  }, []);

  const visibleSystems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return BOS_ACTION_CATALOG.filter((system) => {
      if (systemFilter !== 'all' && system.systemId !== systemFilter) return false;
      if (!needle) return true;
      return (
        system.systemName.toLowerCase().includes(needle) ||
        system.actions.some(
          (action) =>
            action.name.toLowerCase().includes(needle) ||
            action.description.toLowerCase().includes(needle) ||
            action.permission.toLowerCase().includes(needle)
        )
      );
    });
  }, [query, systemFilter]);

  const visibleActions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const out: SelectedAction[] = [];
    for (const system of visibleSystems) {
      for (const action of system.actions) {
        if (mode === 'read' && isWrite(action)) continue;
        if (mode === 'write' && !isWrite(action)) continue;
        if (
          needle &&
          !`${system.systemName} ${action.name} ${action.description} ${action.permission}`
            .toLowerCase()
            .includes(needle)
        ) {
          continue;
        }
        out.push({
          ...action,
          systemId: system.systemId,
          systemName: system.systemName,
          screen: system.screen,
        });
      }
    }
    return out;
  }, [mode, query, visibleSystems]);

  const openAction = (action: SelectedAction) => {
    setSelected(action);
    setInputText('{}');
    setArmed(false);
    setRunning(false);
    setResult(null);
    setError('');
    setDurationMs(null);
    setFinishedAt(null);
  };

  const closeAction = () => {
    if (running) return;
    setSelected(null);
  };

  const parsedInput = useMemo(() => {
    try {
      const parsed = JSON.parse(inputText || '{}');
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
        return { value: null as Record<string, unknown> | null, error: 'Input must be a JSON object.' };
      }
      return { value: parsed as Record<string, unknown>, error: '' };
    } catch {
      return { value: null as Record<string, unknown> | null, error: 'Input is not valid JSON.' };
    }
  }, [inputText]);

  const selectedIsWrite = selected ? isWrite(selected) : false;
  const canRun =
    Boolean(selected) &&
    !running &&
    !parsedInput.error &&
    (!selectedIsWrite || armed);

  const runAction = async () => {
    if (!selected || !parsedInput.value || !canRun) return;
    setRunning(true);
    setResult(null);
    setError('');
    setDurationMs(null);
    const started = performance.now();
    try {
      const response = await bosFetch<unknown>(selected.systemId, selected.name, parsedInput.value);
      setResult(response ?? { ok: true });
      setDurationMs(Math.round(performance.now() - started));
      setFinishedAt(new Date());
    } catch (err) {
      const candidate = err as { message?: string; code?: string; status?: number };
      setError(
        [
          candidate.message || 'The action failed.',
          candidate.code ? `code: ${candidate.code}` : '',
          candidate.status ? `status: ${candidate.status}` : '',
        ]
          .filter(Boolean)
          .join(' · ')
      );
      setDurationMs(Math.round(performance.now() - started));
      setFinishedAt(new Date());
    } finally {
      setRunning(false);
      setArmed(false);
    }
  };

  const readCount = (system: BosActionSystemMeta) =>
    system.actions.filter((action) => !isWrite(action)).length;

  return (
    <div className="bos-controls-page">
      <div className="bos-console-head">
        <div>
          <div className="bos-kicker">Control registry · server-exposed actions</div>
          <h2>All controls</h2>
          <p>
            {totals.all} actions across {BOS_ACTION_CATALOG.length} systems · {totals.read} read ·{' '}
            {totals.write} write. Every action below is dispatched by the BOS server; nothing is
            simulated in the browser. Actions whose tables are not applied yet return an explicit
            dispatcher error instead of a fabricated result.
          </p>
        </div>
        <div className="bos-console-live">
          <span className="bos-b bos-recorded">manifest · generated</span>
          {contextScreen && (
            <span>
              Context · {contextScreen}
            </span>
          )}
          {onOpenTasks && (
            <button type="button" className="bos-btn" onClick={onOpenTasks}>
              Everyday tasks
            </button>
          )}
        </div>
      </div>

      <div className="bos-ctl-stats">
        <button
          type="button"
          className={`bos-ctl-stat ${mode === 'all' ? 'is-on' : ''}`}
          onClick={() => setMode('all')}
        >
          <small>All controls</small>
          <b>{totals.all}</b>
          <em>read + write</em>
        </button>
        <button
          type="button"
          className={`bos-ctl-stat ${mode === 'read' ? 'is-on' : ''}`}
          onClick={() => setMode('read')}
        >
          <small>Read</small>
          <b>{totals.read}</b>
          <em>safe to inspect</em>
        </button>
        <button
          type="button"
          className={`bos-ctl-stat ${mode === 'write' ? 'is-on' : ''}`}
          onClick={() => setMode('write')}
        >
          <small>Write</small>
          <b>{totals.write}</b>
          <em>needs arming</em>
        </button>
        <div className="bos-ctl-stat bos-ctl-stat-static">
          <small>Systems</small>
          <b>{BOS_ACTION_CATALOG.length}</b>
          <em>one dispatcher</em>
        </div>
      </div>

      <div className="bos-ctl-layout">
        <aside className="bos-card bos-ctl-rail">
          <h3>
            Systems
            <span className="bos-b bos-estimated">{BOS_ACTION_CATALOG.length}</span>
          </h3>
          <div className="bos-ctl-search">
            <input
              className="bos-sr"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search actions, permissions…"
              aria-label="Search actions"
            />
          </div>
          <div className="bos-ctl-systems">
            <button
              type="button"
              className={`bos-ctl-system ${systemFilter === 'all' ? 'is-on' : ''}`}
              onClick={() => setSystemFilter('all')}
            >
              <span>
                <b>All systems</b>
                <small>every registered action</small>
              </span>
              <em>{totals.all}</em>
            </button>
            {BOS_ACTION_CATALOG.map((system) => (
              <button
                key={system.systemId}
                type="button"
                className={`bos-ctl-system ${systemFilter === system.systemId ? 'is-on' : ''}`}
                onClick={() => setSystemFilter(system.systemId)}
              >
                <span>
                  <b>{system.systemName}</b>
                  <small>
                    {system.actions.length} actions · {readCount(system)} read
                  </small>
                </span>
                <em>{String(system.index).padStart(2, '0')}</em>
              </button>
            ))}
          </div>
        </aside>

        <section className="bos-card bos-ctl-listcard">
          <h3>
            {systemFilter === 'all'
              ? 'Registered actions'
              : BOS_ACTION_CATALOG.find((system) => system.systemId === systemFilter)?.systemName}
            <span className="bos-b bos-recorded">{visibleActions.length}</span>
          </h3>

          {contextSystems.length > 0 && systemFilter !== 'all' && (
            <div className="bos-ctl-context">
              <span>
                Opened from <b>{contextScreen}</b>.{' '}
                {contextSystems.length === 1
                  ? `${contextSystems[0].systemName} powers this screen.`
                  : `${contextSystems.length} systems power this screen.`}
              </span>
              <button type="button" className="bos-btn" onClick={() => setSystemFilter('all')}>
                Show all systems
              </button>
            </div>
          )}

          {previewMode && (
            <div className="bos-note">
              Local preview has no operator session. Actions will return an authorization error until
              you run them from the signed-in console.
            </div>
          )}

          {visibleActions.length === 0 ? (
            <div className="bos-empty">
              No actions match this search. Clear the query or switch systems.
            </div>
          ) : (
            <div className="bos-ctl-actions">
              {visibleActions.map((action) => (
                <button
                  key={`${action.systemId}.${action.name}`}
                  type="button"
                  className="bos-ctl-action"
                  onClick={() => openAction(action)}
                >
                  <span className="bos-ctl-actionhead">
                    <b>{actionLabel(action.name)}</b>
                    <span className={`bos-b ${isWrite(action) ? 'bos-estimated' : 'bos-recorded'}`}>
                      {isWrite(action) ? 'write' : 'read'}
                    </span>
                  </span>
                  <span className="bos-ctl-actiondesc">{action.description}</span>
                  <span className="bos-ctl-actionmeta">
                    <small>{action.systemName}</small>
                    <code>{action.permission}</code>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <div className="bos-ctl-overlay" role="dialog" aria-modal="true" aria-label="Run action">
          <button
            type="button"
            className="bos-ctl-backdrop"
            aria-label="Close"
            onClick={closeAction}
          />
          <div className="bos-ctl-runner">
            <header className="bos-ctl-runhead">
              <div>
                <div className="bos-kicker">
                  {selected.systemName} · {selected.permission}
                </div>
                <h3>{actionLabel(selected.name)}</h3>
                <p>{selected.description}</p>
              </div>
              <button type="button" className="bos-ctl-x" onClick={closeAction} aria-label="Close">
                ×
              </button>
            </header>

            <div className="bos-ctl-runbody">
              <div className="bos-ctl-target">
                <code>
                  POST /api/bos/{selected.systemId}/{selected.name}
                </code>
                <button
                  type="button"
                  className="bos-btn"
                  onClick={() => onOpenScreen(selected.screen)}
                >
                  Open related screen
                </button>
              </div>

              <label className="bos-ctl-label" htmlFor="bos-action-input">
                Input · JSON object
              </label>
              <textarea
                id="bos-action-input"
                className="bos-ctl-json"
                value={inputText}
                spellCheck={false}
                onChange={(event) => {
                  setInputText(event.target.value);
                  setResult(null);
                  setError('');
                }}
                rows={7}
              />
              <div className="bos-ctl-inputfoot">
                <span className={parsedInput.error ? 'bos-ctl-invalid' : 'bos-ctl-valid'}>
                  {parsedInput.error || 'Valid JSON. The server validates every field.'}
                </span>
                <button
                  type="button"
                  className="bos-btn"
                  onClick={() => setInputText('{}')}
                  disabled={running}
                >
                  Reset to {'{}'}
                </button>
              </div>

              {selectedIsWrite && (
                <label className="bos-ctl-arm">
                  <input
                    type="checkbox"
                    checked={armed}
                    onChange={(event) => setArmed(event.target.checked)}
                    disabled={running}
                  />
                  <span>
                    This action changes data. Arm it for this run; the server still enforces the
                    operator permission and writes an audit event.
                  </span>
                </label>
              )}

              <div className="bos-ctl-run">
                <button
                  type="button"
                  className="bos-btn bos-btn-dark"
                  onClick={() => void runAction()}
                  disabled={!canRun}
                >
                  {running ? 'Running…' : selectedIsWrite ? 'Arm & run' : 'Run action'}
                </button>
                {running && <span className="bos-ctl-running">Waiting for dispatcher…</span>}
                {!running && finishedAt && durationMs !== null && (
                  <span className="bos-ctl-running">
                    Finished {relativeTime(finishedAt)} · {durationMs} ms
                  </span>
                )}
              </div>

              {error && (
                <div className="bos-ctl-error" role="alert">
                  <b>Action failed</b>
                  <span>{error}</span>
                </div>
              )}

              {result !== null && (
                <div className="bos-ctl-result">
                  <div className="bos-ctl-resulthead">
                    <b>Recorded response</b>
                    <span className="bos-b bos-recorded">server</span>
                  </div>
                  <pre>{pretty(result)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminControlsView;
