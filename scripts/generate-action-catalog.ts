/**
 * Regenerates the client-safe action catalog from the server registry.
 *
 * The admin control registry must never drift from the dispatcher it calls.
 * Run this after adding, renaming or removing a BOS action:
 *
 *   npx tsx scripts/generate-action-catalog.ts
 *
 * `tests/unit/bos-registry.test.ts` fails if the committed catalog no longer
 * matches `systemManifest()`.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { systemManifest } from '../src/bos/registry';

const manifest = systemManifest();
const lines: string[] = [];

lines.push('/*');
lines.push(' * AUTO-GENERATED from src/bos/registry.ts — do not edit by hand.');
lines.push(' * Client-safe action metadata for the operator control registry.');
lines.push(' * Run `npx tsx scripts/generate-action-catalog.ts` after changing a system.');
lines.push(' */');
lines.push('');
lines.push('export interface BosActionMeta {');
lines.push('  name: string;');
lines.push('  permission: string;');
lines.push('  description: string;');
lines.push('}');
lines.push('');
lines.push('export interface BosActionSystemMeta {');
lines.push('  systemId: string;');
lines.push('  systemName: string;');
lines.push('  screen: string;');
lines.push('  index: number;');
lines.push('  actions: BosActionMeta[];');
lines.push('}');
lines.push('');
lines.push('export const BOS_ACTION_CATALOG: BosActionSystemMeta[] = [');
for (const system of manifest) {
  lines.push('  {');
  lines.push(`    systemId: ${JSON.stringify(system.id)},`);
  lines.push(`    systemName: ${JSON.stringify(system.name)},`);
  lines.push(`    screen: ${JSON.stringify(system.screen)},`);
  lines.push(`    index: ${system.index},`);
  lines.push('    actions: [');
  for (const action of system.actions) {
    lines.push(
      `      { name: ${JSON.stringify(action.action)}, permission: ${JSON.stringify(
        action.permission
      )}, description: ${JSON.stringify(action.description)} },`
    );
  }
  lines.push('    ],');
  lines.push('  },');
}
lines.push('];');
lines.push('');
lines.push('export const BOS_ACTION_COUNT = BOS_ACTION_CATALOG.reduce(');
lines.push('  (total, system) => total + system.actions.length,');
lines.push('  0');
lines.push(');');
lines.push('');
lines.push('export const BOS_ACTION_FLAT = BOS_ACTION_CATALOG.flatMap((system) =>');
lines.push('  system.actions.map((action) => ({');
lines.push('    ...action,');
lines.push('    systemId: system.systemId,');
lines.push('    systemName: system.systemName,');
lines.push('    screen: system.screen,');
lines.push('  }))');
lines.push(');');
lines.push('');

writeFileSync(join(process.cwd(), 'src/bos/actionCatalog.ts'), lines.join('\n'));
console.log(`Wrote ${manifest.reduce((total, system) => total + system.actions.length, 0)} actions.`);
