import React, { useMemo, useState } from 'react';
import { TASK_COUNT, TASK_GROUPS, TASKS } from './taskCatalog';
import { TaskForm } from './TaskForm';
import type { TaskData, TaskDefinition } from './types';

interface AdminTasksViewProps {
  data: TaskData;
  previewMode?: boolean;
  onOpenAdvanced: () => void;
  onSaved: () => void;
}

export const AdminTasksView: React.FC<AdminTasksViewProps> = ({
  data,
  previewMode = false,
  onOpenAdvanced,
  onSaved,
}) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<TaskDefinition | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return TASKS;
    return TASKS.filter((task) =>
      `${task.title} ${task.description} ${task.group}`.toLowerCase().includes(needle)
    );
  }, [query]);

  const groups = useMemo(
    () =>
      TASK_GROUPS.map((group) => ({
        group,
        tasks: filtered.filter((task) => task.group === group),
      })).filter((entry) => entry.tasks.length > 0),
    [filtered]
  );

  return (
    <div className="bos-tasks">
      <div className="bos-console-head">
        <div>
          <div className="bos-kicker">Everyday tasks</div>
          <h2>What would you like to do?</h2>
          <p>
            {TASK_COUNT} plain-language actions across orders, stock, customers, catalogue,
            marketing, content, money, and the team. Choose a task, fill in the form, save. No
            technical setup.
          </p>
        </div>
        <div className="bos-console-live">
          <span className="bos-b bos-recorded">simple view</span>
          <span>{groups.length} areas</span>
        </div>
      </div>

      <div className="bos-task-toolbar">
        <input
          type="search"
          className="bos-task-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tasks, e.g. refund, stock, invite…"
          aria-label="Search tasks"
        />
        <div className="bos-task-chips">
          {TASK_GROUPS.map((group) => (
            <span key={group} className="bos-chip bos-chip-static">
              {group}
            </span>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bos-empty">
          No task matches “{query}”. Try a simpler word such as order, stock, or customer.
        </div>
      ) : (
        <div className="bos-task-groups">
          {groups.map(({ group, tasks }) => (
            <section key={group} className="bos-card bos-task-group">
              <h3>
                {group}
                <span className="bos-b bos-estimated">{tasks.length}</span>
              </h3>
              <div className="bos-task-grid-cards">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className={`bos-task-card ${task.danger ? 'is-danger' : ''}`}
                    onClick={() => setActive(task)}
                  >
                    <span className="bos-task-cardtitle">
                      <b>{task.title}</b>
                      <span className="bos-task-arrow" aria-hidden="true">
                        →
                      </span>
                    </span>
                    <span className="bos-task-carddesc">{task.description}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="bos-task-advanced">
        <div>
          <b>For technical operators</b>
          <p>
            Every server action is still available with its permission and raw input under
            Advanced. Everyday work should stay on this page.
          </p>
        </div>
        <button type="button" className="bos-btn" onClick={onOpenAdvanced}>
          Open advanced controls
        </button>
      </section>

      {active && (
        <TaskForm
          task={active}
          data={data}
          previewMode={previewMode}
          onClose={() => setActive(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
};

export default AdminTasksView;
