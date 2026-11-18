// Writes the generated item set to data/items.json, so it can be read without running anything.
// test/items.test.ts fails when the file and the generator disagree.
import { writeFileSync } from 'node:fs';
import { buildItems } from '../src/items.js';

const items = buildItems();
writeFileSync(new URL('../data/items.json', import.meta.url), `${JSON.stringify(items, null, 2)}\n`);
console.log(`data/items.json: ${items.length} items`);
