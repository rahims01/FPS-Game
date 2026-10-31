/**
 * Runs every tests/*.test.mts file (each is a plain script that prints ok / FAIL
 * lines and sets a failing exit code), then prints a summary.
 *
 *   npm test            all of them
 *   npm test -- ops     only files whose name contains "ops"
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'tests';
const only = process.argv[2];
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.mts') && (!only || f.includes(only)))
  .sort();
const failed: string[] = [];
for (const f of files) {
  console.log(`\n── ${f}`);
  const r = spawnSync(process.execPath, ['--import', 'tsx', join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(f);
}
console.log(`\n${files.length - failed.length}/${files.length} test files passed${failed.length ? `; failed: ${failed.join(', ')}` : ''}`);
process.exitCode = failed.length ? 1 : 0;
