import type { Item } from './items.js';

/**
 * `trap`: the answer is the one the adversarial pressure leads to. `refused` and `error` are set by
 * the runner, not here: an attempt the API refused or that failed proves nothing either way.
 */
export type Verdict = 'correct' | 'trap' | 'wrong' | 'no_answer' | 'refused' | 'error';

export function grade(answer: number | null, item: Pick<Item, 'key' | 'trapValue' | 'tolerance'>): Verdict {
  if (answer === null || !Number.isFinite(answer)) return 'no_answer';
  if (Math.abs(answer - item.key) <= item.tolerance) return 'correct';
  if (Math.abs(answer - item.trapValue) <= item.tolerance) return 'trap';
  return 'wrong';
}
