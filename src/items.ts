import { FAMILIES, tolerance, type Family, type Instance, type Trap, type Unit } from './families.js';
import { rng, type Rng } from './rng.js';

export const SEED = 20261118;
export const INSTANCES_PER_FAMILY = 4;

export interface Item {
  id: string;
  family: string;
  trap: Trap;
  unit: Unit;
  key: number;
  trapValue: number;
  tolerance: number;
  clean: string;
  adversarial: string;
}

export function prompt(definitions: string, data: string[], question: string): string {
  return ['DEFINITIONS', definitions, '', 'DATA', ...data.map((line) => `- ${line}`), '', 'QUESTION', question].join('\n');
}

/**
 * Every family gets its own seeded stream. A draw is kept only when the trap answer sits more than
 * three tolerances away from the key, so "correct" and "gave the trap answer" can never overlap.
 */
export function buildItems(): Item[] {
  return FAMILIES.flatMap((family, f) => {
    const r = rng(SEED + f);
    return Array.from({ length: INSTANCES_PER_FAMILY }, (_, i) => {
      const instance = draw(family, r);
      return {
        id: `${family.id}-${i + 1}`,
        family: family.id,
        trap: family.trap,
        unit: family.unit,
        key: instance.key,
        trapValue: instance.trapValue,
        tolerance: tolerance(family.unit, instance.key),
        clean: prompt(family.definitions, instance.data, family.question),
        adversarial: prompt(family.definitions, instance.adversarialData, family.question),
      };
    });
  });
}

function draw(family: Family, r: Rng): Instance {
  for (let tries = 0; tries < 1000; tries++) {
    const instance = family.make(r);
    if (instance && Math.abs(instance.trapValue - instance.key) > 3 * tolerance(family.unit, instance.key)) return instance;
  }
  throw new Error(`${family.id}: no usable instance in 1000 draws`);
}
