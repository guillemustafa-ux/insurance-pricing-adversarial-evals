import { expect, it } from 'vitest';
import { grade } from '../src/grade.js';

const item = { key: 100, trapValue: 50, tolerance: 0.5 };

it.each([
  [100.4, 'correct'],
  [99.5, 'correct'],
  [100.51, 'wrong'],
  [50.2, 'trap'],
  [75, 'wrong'],
  [null, 'no_answer'],
  [Number.NaN, 'no_answer'],
] as const)('an answer of %s is %s', (answer, verdict) => {
  expect(grade(answer, item)).toBe(verdict);
});
