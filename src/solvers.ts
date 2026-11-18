/**
 * The answer key: each function computes one quantity exactly as the DEFINITIONS block of its
 * family states it. Percentages go in and come out as percent numbers (68.4 means 68.4%).
 */

export const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Claim frequency * claim severity, which reduces to losses / exposure in car-years. */
export function purePremium(losses: number, exposureCarYears: number): number {
  return losses / exposureCarYears;
}

/** Experience loss ratio / permissible loss ratio - 1, in percent. */
export function indicatedChange(lossRatioPct: number, variableExpensePct: number, profitPct: number): number {
  return (lossRatioPct / (100 - variableExpensePct - profitPct) - 1) * 100;
}

/**
 * `rows[i]` holds the cumulative losses of accident year i at ages 12, 24, 36, 48 months; later
 * accident years have fewer ages. A factor sums over the accident years that have the next age.
 */
export function volumeWeightedFactors(rows: number[][]): number[] {
  const factors: number[] = [];
  for (let age = 0; age < rows[0]!.length - 1; age++) {
    let next = 0;
    let earlier = 0;
    for (const row of rows) {
      if (row.length > age + 1) {
        next += row[age + 1]!;
        earlier += row[age]!;
      }
    }
    factors.push(next / earlier);
  }
  return factors;
}

/** The trap method of the chain-ladder family: the mean of the individual accident-year factors. */
export function simpleAverageFactors(rows: number[][]): number[] {
  const factors: number[] = [];
  for (let age = 0; age < rows[0]!.length - 1; age++) {
    const individual = rows.filter((row) => row.length > age + 1).map((row) => row[age + 1]! / row[age]!);
    factors.push(individual.reduce((a, b) => a + b, 0) / individual.length);
  }
  return factors;
}

/** Latest cumulative losses of accident year `ay` times the factors from its latest age onwards. */
export function ultimate(rows: number[][], ay: number, factors: number[]): number {
  const row = rows[ay]!;
  let losses = row[row.length - 1]!;
  for (let age = row.length - 1; age < factors.length; age++) losses *= factors[age]!;
  return losses;
}

export function trended(losses: number, annualTrendPct: number, years: number): number {
  return losses * (1 + annualTrendPct / 100) ** years;
}

/** Z = min(1, sqrt(n / standard)); Z * observed + (1 - Z) * complement, in percent. */
export function credibilityWeighted(claims: number, standard: number, observedPct: number, complementPct: number): number {
  const z = Math.min(1, Math.sqrt(claims / standard));
  return z * observedPct + (1 - z) * complementPct;
}

/** Sum of min(x, d) over sum of x, in percent. */
export function lossEliminationRatio(losses: number[], deductible: number): number {
  const total = losses.reduce((a, x) => a + x, 0);
  return (losses.reduce((a, x) => a + Math.min(x, deductible), 0) / total) * 100;
}

/** The trap of the deductible family: the share the insurer pays, read as the share eliminated. */
export function paidShare(losses: number[], deductible: number): number {
  const total = losses.reduce((a, x) => a + x, 0);
  return (losses.reduce((a, x) => a + Math.max(0, x - deductible), 0) / total) * 100;
}
