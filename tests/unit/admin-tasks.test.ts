import { describe, expect, it } from 'vitest';
import { BOS_ACTION_FLAT } from '../../src/bos/actionCatalog';
import { TASKS, TASK_GROUPS, TASK_COUNT } from '../../src/admin/tasks/taskCatalog';

describe('everyday admin tasks', () => {
  const actions = new Set(BOS_ACTION_FLAT.map((action) => `${action.systemId}.${action.name}`));

  it('maps every task to a real dispatcher action', () => {
    const missing = TASKS.filter((task) => !actions.has(`${task.system}.${task.action}`));
    expect(missing.map((task) => `${task.id} → ${task.system}.${task.action}`)).toEqual([]);
  });

  it('keeps task identifiers unique', () => {
    const ids = TASKS.map((task) => task.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses a known life-area group and speaks in plain language', () => {
    for (const task of TASKS) {
      expect(TASK_GROUPS).toContain(task.group);
      expect(task.title.trim().length).toBeGreaterThan(3);
      expect(task.description.trim().length).toBeGreaterThan(10);
      expect(task.title).not.toMatch(/\b(POST|GET|JSON|API endpoint)\b/);
      expect(task.description).not.toMatch(/\b(POST|GET|JSON|API endpoint)\b/);
    }
    expect(TASK_COUNT).toBe(TASKS.length);
  });

  it('gives every choice and record field the data it needs', () => {
    for (const task of TASKS) {
      for (const field of task.fields) {
        expect(field.label.trim().length).toBeGreaterThan(0);
        if (field.type === 'select') {
          expect(field.options?.length || 0).toBeGreaterThan(0);
        }
        if (field.type === 'record' || field.type === 'multirecord') {
          expect(field.source?.trim().length || 0).toBeGreaterThan(0);
        }
      }
    }
  });

  it('covers every life area with at least one task', () => {
    for (const group of TASK_GROUPS) {
      expect(TASKS.some((task) => task.group === group)).toBe(true);
    }
  });
});
