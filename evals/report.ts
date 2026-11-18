import { FAMILIES } from '../src/families.js';
import type { Item } from '../src/items.js';
import type { Attempt } from './solve.js';

export interface ReportMeta {
  model: string;
  reps: number;
  date: string;
  costUsd: number | undefined;
}

const share = (k: number, n: number): string => (n === 0 ? '-' : `${k}/${n} (${Math.round((100 * k) / n)}%)`);
const count = (list: Attempt[], verdict: Attempt['verdict']): number => list.filter((a) => a.verdict === verdict).length;
const unanswered = (list: Attempt[]): number => list.filter((a) => ['no_answer', 'refused', 'error'].includes(a.verdict)).length;

export function renderReport(attempts: Attempt[], items: Item[], meta: ReportMeta): string {
  const clean = attempts.filter((a) => a.variant === 'clean');
  const adversarial = attempts.filter((a) => a.variant === 'adversarial');
  const input = attempts.reduce((s, a) => s + a.inputTokens, 0);
  const output = attempts.reduce((s, a) => s + a.outputTokens, 0);
  const lines = [
    '# Results',
    '',
    `Model under test: \`${meta.model}\`, run ${meta.date}. ${items.length} items, each in a clean and an adversarial variant with the same answer, up to ${meta.reps} attempts per variant: ${attempts.length} attempts.`,
    '',
    `**Correct: clean ${share(count(clean, 'correct'), clean.length)}, adversarial ${share(count(adversarial, 'correct'), adversarial.length)}.** The adversarial variant gave the trap answer in ${share(count(adversarial, 'trap'), adversarial.length)}.`,
    '',
    '## By family',
    '',
    '| family | adversarial pressure | clean: correct | adversarial: correct | adversarial: trap answer | no answer (clean / adversarial) |',
    '|---|---|---|---|---|---|',
  ];
  for (const family of FAMILIES) {
    const c = clean.filter((a) => a.family === family.id);
    const d = adversarial.filter((a) => a.family === family.id);
    lines.push(
      `| ${family.id} | ${family.pressure} | ${share(count(c, 'correct'), c.length)} | ${share(count(d, 'correct'), d.length)} | ${share(count(d, 'trap'), d.length)} | ${unanswered(c)} / ${unanswered(d)} |`,
    );
  }
  lines.push('', '## By item', '', '| item | key | trap answer | clean: correct | adversarial: correct | adversarial: trap answer |', '|---|---|---|---|---|---|');
  for (const item of items) {
    const c = clean.filter((a) => a.item === item.id);
    const d = adversarial.filter((a) => a.item === item.id);
    lines.push(
      `| ${item.id} | ${item.key} | ${item.trapValue} | ${share(count(c, 'correct'), c.length)} | ${share(count(d, 'correct'), d.length)} | ${share(count(d, 'trap'), d.length)} |`,
    );
  }
  const refused = count(attempts, 'refused');
  const failed = count(attempts, 'error');
  lines.push(
    '',
    '## Cost and exclusions',
    '',
    `Tokens: ${input.toLocaleString('en-US')} input, ${output.toLocaleString('en-US')} output${meta.costUsd === undefined ? '' : `, USD ${meta.costUsd.toFixed(4)} at list price`}.`,
    `Refused by the API: ${refused}. Failed calls: ${failed}. Both count as no answer above and prove nothing about the model's arithmetic.`,
    '',
  );
  return lines.join('\n');
}
