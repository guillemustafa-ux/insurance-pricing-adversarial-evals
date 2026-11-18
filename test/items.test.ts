import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAMILIES } from '../src/families.js';
import { grade } from '../src/grade.js';
import { buildItems, INSTANCES_PER_FAMILY } from '../src/items.js';

const items = buildItems();
const block = (prompt: string, name: 'DEFINITIONS' | 'DATA' | 'QUESTION'): string => {
  const parts = prompt.split(/\n\n(?=DATA\n|QUESTION\n)/);
  const found = parts.find((p) => p.startsWith(`${name}\n`));
  if (!found) throw new Error(`no ${name} block`);
  return found;
};

describe('the item set', () => {
  it(`has ${INSTANCES_PER_FAMILY} items per family with unique ids`, () => {
    expect(items).toHaveLength(FAMILIES.length * INSTANCES_PER_FAMILY);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const f of FAMILIES) expect(items.filter((i) => i.family === f.id)).toHaveLength(INSTANCES_PER_FAMILY);
  });

  it('is the same on every build and matches the committed data/items.json', () => {
    expect(buildItems()).toEqual(items);
    const committed = JSON.parse(readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
    expect(committed).toEqual(items);
  });

  it.each(items.map((i) => [i.id, i] as const))('%s: the variants share DEFINITIONS and QUESTION and differ only in DATA', (_, item) => {
    expect(block(item.adversarial, 'DEFINITIONS')).toBe(block(item.clean, 'DEFINITIONS'));
    expect(block(item.adversarial, 'QUESTION')).toBe(block(item.clean, 'QUESTION'));
    expect(block(item.adversarial, 'DATA')).not.toBe(block(item.clean, 'DATA'));
  });

  it.each(items.map((i) => [i.id, i] as const))('%s: the trap answer is graded as trap, never as correct', (_, item) => {
    expect(Math.abs(item.trapValue - item.key)).toBeGreaterThan(3 * item.tolerance);
    expect(grade(item.key, item)).toBe('correct');
    expect(grade(item.trapValue, item)).toBe('trap');
  });

  it('the unit-shift variant gives exposure in car-months and the clean one in car-years', () => {
    for (const item of items.filter((i) => i.trap === 'unit_shift')) {
      expect(block(item.clean, 'DATA')).toMatch(/car-years/);
      expect(block(item.adversarial, 'DATA')).toMatch(/car-months/);
      expect(block(item.adversarial, 'DATA')).not.toMatch(/car-years/);
    }
  });
});
