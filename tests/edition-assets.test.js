import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseSblgntBookText, describeEditionBook } from '../docs/js/core/editions.js';

const hash = content => createHash('sha256').update(content).digest('hex');

test('all bundled SBLGNT books match their pinned hashes, coverage and deterministic token offsets', async () => {
  const base = new URL('../docs/data/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('editions.json', base), 'utf8'));
  const [edition] = manifest.editions;
  expect(edition.books).toHaveLength(27);
  let verseCount = 0;
  for (const descriptor of edition.books) {
    const bytes = await readFile(new URL(descriptor.path, base));
    expect(hash(bytes)).toBe(descriptor.sha256);
    const book = parseSblgntBookText(bytes.toString('utf8'), descriptor);
    expect(describeEditionBook(book).chapters).toEqual(descriptor.chapters);
    expect(book.verses.length).toBe(descriptor.verses);
    expect(book.verses.reduce((sum, verse) => sum + verse.records.length, 0)).toBe(descriptor.tokens);
    const ids = new Set();
    for (const verse of book.verses) for (const token of verse.records) {
      if (ids.has(token.id) || verse.text.slice(token.start, token.end) !== token.text) throw new Error(`Invalid word projection in ${descriptor.id}`);
      ids.add(token.id);
    }
    verseCount += book.verses.length;
  }
  expect(verseCount).toBe(7939);
  expect(hash(await readFile(new URL('../scripts/build-sblgnt.mjs', import.meta.url)))).toBe(manifest.build.scriptSha256);
  expect(hash(await readFile(new URL('../docs/js/core/editions.js', import.meta.url)))).toBe(manifest.build.parserSha256);
  expect(hash(await readFile(new URL('editions/sblgnt/LICENSE', base)))).toBe(manifest.build.licenseSha256);
});
