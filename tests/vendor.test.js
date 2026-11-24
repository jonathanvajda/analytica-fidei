import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createContext, runInContext } from 'node:vm';
import { createLinguisticSource } from '../docs/js/vendor/linguistic-adapters/index.js';

test('vendored module contents match the recorded source snapshot', async () => {
  const manifest = JSON.parse(await readFile(new URL('../docs/js/vendor/manifest.json', import.meta.url), 'utf8'));
  for (const file of manifest.files) {
    const content = await readFile(new URL(`../${file.path}`, import.meta.url));
    const canonical = content.toString('utf8').replace(/\r\n/g, '\n');
    const actual = createHash('sha256').update(canonical).digest('hex');
    if (actual !== file.sha256) throw new Error(`${file.path} does not match its vendored snapshot. `
      + 'Review the source change, then run "npm run vendor:manifest" to record it.');
  }
});

test('vendor integrity hashes are stable across Git line endings', () => {
  const hash = value => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');
  expect(hash('export const value = 1;\n')).toBe(hash('export const value = 1;\r\n'));
});

test('plain metadata from another JS realm is accepted, but class instances are not', () => {
  const provenance = runInContext('({ providerId: "other-realm", nested: { value: 3 } })', createContext({}));
  expect(createLinguisticSource({ sourceId: 's', version: '1', language: 'en', provenance }).provenance).toEqual(provenance);
  expect(() => createLinguisticSource({ sourceId: 's', version: '1', language: 'en', provenance: new Date() })).toThrow(/JSON-compatible/);
});
