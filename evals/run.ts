/**
 * The paid run: every item, both variants, `--reps` attempts each, against one model through the
 * copied harness core. Needs ANTHROPIC_API_KEY in the environment or in a git-ignored .env.local;
 * the key is never printed. Results and the report are rewritten after every attempt, so a run that
 * dies keeps everything measured before it.
 *
 *   npm run eval -- --model claude-haiku-5-5 --reps 5 --concurrency 4 --max-tokens 2000000
 */
import Anthropic from '@anthropic-ai/sdk';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildItems, type Item } from '../src/items.js';
import { costUsd } from './model.js';
import { renderReport } from './report.js';
import { attempt, type Attempt, type Variant } from './solve.js';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

function apiKey(): string {
  if (!process.env.ANTHROPIC_API_KEY && existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = /^\s*ANTHROPIC_API_KEY\s*=\s*(.*)$/.exec(line);
      if (m) process.env.ANTHROPIC_API_KEY = m[1]!;
    }
  }
  return (process.env.ANTHROPIC_API_KEY ?? '').replace(/"/g, '').trim();
}

const key = apiKey();
if (!key) {
  console.log('eval: skipped (ANTHROPIC_API_KEY is not set in the environment or .env.local)');
  process.exit(0);
}
const model = arg('model', 'claude-haiku-5-5');
const reps = Number(arg('reps', '5'));
const concurrency = Number(arg('concurrency', '4'));
const maxTokens = Number(arg('max-tokens', '2000000'));
const only = arg('items', '').split(',').filter(Boolean);
const out = arg('out', 'evals/results');

const client = new Anthropic({ apiKey: key, maxRetries: 3 });
const items = buildItems().filter((i) => only.length === 0 || only.includes(i.id));
// Rep by rep, so a run cut short still has both variants of every item in the same proportion.
const jobs: { item: Item; variant: Variant; rep: number }[] = [];
for (let rep = 1; rep <= reps; rep++) {
  for (const item of items) for (const variant of ['clean', 'adversarial'] as const) jobs.push({ item, variant, rep });
}

const attempts: Attempt[] = [];
let spent = 0;
let next = 0;
let errorsInARow = 0;
mkdirSync(out, { recursive: true });

function save(): void {
  const sorted = [...attempts].sort((a, b) => a.item.localeCompare(b.item) || a.variant.localeCompare(b.variant) || a.rep - b.rep);
  const input = sorted.reduce((s, a) => s + a.inputTokens, 0);
  const output = sorted.reduce((s, a) => s + a.outputTokens, 0);
  const cost = costUsd(model, input, output);
  writeFileSync(join(out, `results-${model}.json`), `${JSON.stringify({ model, reps, items: items.length, attempts: sorted }, null, 2)}\n`);
  writeFileSync(join(out, 'REPORT.md'), renderReport(sorted, items, { model, reps, date: new Date().toISOString().slice(0, 10), costUsd: cost }));
}

async function worker(): Promise<void> {
  while (next < jobs.length && spent < maxTokens) {
    const job = jobs[next++]!;
    const result = await attempt(client, model, job.item, job.variant, job.rep);
    attempts.push(result);
    spent += result.inputTokens + result.outputTokens;
    errorsInARow = result.verdict === 'error' ? errorsInARow + 1 : 0;
    if (errorsInARow >= 8) {
      console.log(`stopping: 8 failed calls in a row (last: ${result.error})`);
      next = jobs.length;
    }
    save();
    console.log(`${attempts.length}/${jobs.length} ${result.item} ${result.variant} ${result.verdict}`);
  }
}

const started = Date.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
save();
const cost = costUsd(model, attempts.reduce((s, a) => s + a.inputTokens, 0), attempts.reduce((s, a) => s + a.outputTokens, 0));
console.log(`done: ${attempts.length} attempts in ${Math.round((Date.now() - started) / 1000)} s, ${spent} tokens, USD ${cost?.toFixed(4) ?? '?'} at list price`);
