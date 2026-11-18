import { describe, expect, it } from 'vitest';
import {
  credibilityWeighted,
  indicatedChange,
  lossEliminationRatio,
  paidShare,
  purePremium,
  round2,
  simpleAverageFactors,
  trended,
  ultimate,
  volumeWeightedFactors,
} from '../src/solvers.js';

// Each solver is pinned by an example worked by hand from its family's definitions, and the same
// example shows that the family's trap method gives a different number. A solver replaced by its
// trap method (the likeliest mutant) fails here.

describe('solvers against hand-worked examples', () => {
  it('pure premium: USD 1,234,500 over 1,500 car-years is 823.00; taking 18,000 car-months as car-years gives 68.58', () => {
    expect(round2(purePremium(1_234_500, 1_500))).toBe(823);
    expect(round2(purePremium(1_234_500, 18_000))).toBe(68.58);
  });

  it('indicated rate change: a 68.40% loss ratio against 100 - 25 - 5 = 70% permissible is -2.29%', () => {
    expect(round2(indicatedChange(68.4, 25, 5))).toBe(-2.29);
    expect(round2(indicatedChange(77, 25, 5))).toBe(10);
  });

  const triangle = [
    [100, 150, 165, 170],
    [200, 280, 300],
    [300, 420],
    [400],
  ];

  it('chain ladder: volume-weighted factors 850/600, 465/430, 170/165 take AY 2025 from 400 to 631.36', () => {
    const factors = volumeWeightedFactors(triangle);
    expect(factors.map((f) => f.toFixed(6))).toEqual([(850 / 600).toFixed(6), (465 / 430).toFixed(6), (170 / 165).toFixed(6)]);
    expect(round2(ultimate(triangle, 3, factors))).toBe(631.36);
  });

  it('chain ladder: an AY starts from its latest age (AY 2024 at 24 months: 420 * 465/430 * 170/165 = 467.95)', () => {
    expect(round2(ultimate(triangle, 2, volumeWeightedFactors(triangle)))).toBe(467.95);
    expect(round2(ultimate(triangle, 0, volumeWeightedFactors(triangle)))).toBe(170);
  });

  it('chain ladder trap: simple-average factors 4.3/3, 38/35, 34/33 give 641.34 for the same AY', () => {
    expect(round2(ultimate(triangle, 3, simpleAverageFactors(triangle)))).toBe(641.34);
  });

  it('trend: USD 1,000,000 at 5% over 3 years is 1,157,625.00; one year short is 1,102,500.00', () => {
    expect(round2(trended(1_000_000, 5, 3))).toBe(1_157_625);
    expect(round2(trended(1_000_000, 5, 2))).toBe(1_102_500);
  });

  it('credibility: 360 claims against a 1,000 standard is Z = 0.6, so 0.6 * 10 + 0.4 * 5 = 8.00', () => {
    expect(round2(credibilityWeighted(360, 1000, 10, 5))).toBe(8);
    expect(round2(credibilityWeighted(541, 1082, 12, 2))).toBe(9.07);
  });

  it('credibility: Z is capped at 1, so more claims than the standard gives the observed indication', () => {
    expect(credibilityWeighted(2000, 1082, 10, 5)).toBe(10);
  });

  it('loss elimination ratio: losses 500, 1,500, 4,000 with d = 1,000 eliminate 2,500 of 6,000 = 41.67%; the paid share is 58.33%', () => {
    expect(round2(lossEliminationRatio([500, 1500, 4000], 1000))).toBe(41.67);
    expect(round2(paidShare([500, 1500, 4000], 1000))).toBe(58.33);
  });
});
