import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// evals/model.ts is the harness core of cloud-api-booking-receptionist-proof, copied unchanged from
// its commit 045cdf5 (git blob d042f73b3fd0dc9de3294674a6f79afe3ef3b57c). Editing it here breaks this.
const SHA256_AT_045CDF5 = '4e525e5c03e8bbf4fe41255c82c73640eeeb0183db2d8ea3c396b81a6f0dbc3b';

it('evals/model.ts is byte for byte the core of the red-team harness it was copied from', () => {
  const text = readFileSync(new URL('../evals/model.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  expect(createHash('sha256').update(text).digest('hex')).toBe(SHA256_AT_045CDF5);
});
