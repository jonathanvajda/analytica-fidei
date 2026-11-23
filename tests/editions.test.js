import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseSblgntBookText, normalizeEditionCorpus, normalizeEditionDescriptor, describeEditionBook, selectEditionPassage,
  canonicalizeEditionTextBytes } from '../docs/js/core/editions.js';
import { adaptAnalysisPassage, createAnalysisProject, addAnalysisProposition, restoreAnalysisProject } from '../docs/js/core/project.js';
import { createEditionLibrary, getEditionKey, loadBundledEditionCatalog } from '../docs/js/adapters/edition-library.js';

const digest = async bytes => createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const text = 'TITLE\nJohn 1:1\tἘν ἀρχῇ ἦν ὁ λόγος. \nJohn 1:2\tοὗτος ἦν.  \nJohn 1:4\tζωὴ ἦν.\n';
const book = () => parseSblgntBookText(text, { id: 'John', name: 'John' });
const descriptor = () => normalizeEditionDescriptor({ id: 'fixture', title: 'Test edition', profile: 'sblgnt-records',
  source: { sourceId: 'fixture', version: '1', language: 'grc', referenceScheme: 'fixture' },
  resources: [{ kind: 'text', license: 'test-fixture', attribution: 'Synthetic fixture' }] });

test('SBLGNT parser retains payload whitespace, punctuation, offsets and source order', () => {
  const parsed = book();
  expect(parsed.verses[0].text).toBe('Ἐν ἀρχῇ ἦν ὁ λόγος. ');
  expect(parsed.verses[1].text.endsWith('  ')).toBe(true);
  expect(parsed.verses[0].records[0]).toEqual({ id: 'John.1.1.w1', text: 'Ἐν', start: 0, end: 2 });
  for (const verse of parsed.verses) for (const word of verse.records) expect(verse.text.slice(word.start, word.end)).toBe(word.text);
  expect(describeEditionBook(parsed).chapters[0].verses).toEqual([1, 2, 4]);
});

test('elision apostrophes and combining marks remain part of supplied Greek words', () => {
  const parsed = parseSblgntBookText('TITLE\nJohn 1:1\tδιʼ ἀρχῆς·\n', { id: 'John', name: 'John' });
  expect(parsed.verses[0].records.map(word => word.text)).toEqual(['διʼ', 'ἀρχῆς']);
});

test('invalid or reordered source lines fail rather than becoming invented verses', () => {
  for (const invalid of ['TITLE\nJohn 1:1 no tab', 'TITLE\nMatt 1:1\tx', 'TITLE\nJohn 1:2\tx\nJohn 1:1\ty',
    'TITLE\nJohn 1:1\tx\nJohn 1:1\ty', 'TITLE\n']) {
    expect(() => parseSblgntBookText(invalid, { id: 'John', name: 'John' })).toThrow();
  }
});

test('range selection rejects gaps, reversed/out-of-book references, and oversized ranges', () => {
  for (const range of [{ chapter: 1, start: 1, end: 4 }, { chapter: 1, start: 2, end: 1 },
    { chapter: 2, start: 1, end: 1 }, { chapter: 1, start: 1, end: 26 }]) {
    expect(() => selectEditionPassage(descriptor(), book(), range)).toThrow();
  }
});

test('a token keeps its canonical edition identity across overlapping selected ranges', () => {
  const one = adaptAnalysisPassage(selectEditionPassage(descriptor(), book(), { chapter: 1, start: 2, end: 2 }));
  const range = adaptAnalysisPassage(selectEditionPassage(descriptor(), book(), { chapter: 1, start: 1, end: 2 }));
  expect(range.tokens.filter(token => token.reference.verse === 2).map(token => token.id)).toEqual(one.tokens.map(token => token.id));
  expect(range.text).toBe('Ἐν ἀρχῇ ἦν ὁ λόγος. \nοὗτος ἦν.  ');
  expect(range.tokens.map(token => token.index)).toEqual(range.tokens.map((_, index) => index));
  for (const token of range.tokens) expect(range.text.slice(token.range.start, token.range.end)).toBe(token.text);
  expect(range.annotations).toEqual([]); // Text does not imply morphology coverage.
});

test('range projects preserve segment sources and analyses through backup restoration', () => {
  const passage = selectEditionPassage(descriptor(), book(), { chapter: 1, start: 1, end: 2 });
  const initial = createAnalysisProject({ id: 'p', name: 'Range', passage });
  const project = addAnalysisProposition(initial, { id: 'prop', tokenIds: adaptAnalysisPassage(passage).tokens.slice(0, 3).map(token => token.id) });
  expect(restoreAnalysisProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  expect(project.passage.resources).toEqual(descriptor().resources);
});

test('imported OSHB codes retain their distinction from lemma spellings', () => {
  const corpus = normalizeEditionCorpus({ format: 'discourse-corpus-v1', edition: { ...descriptor(), id: 'hebrew', profile: 'oshb-words',
    source: { sourceId: 'h', version: '1', language: 'hbo', referenceScheme: 'fixture' } },
    books: [{ id: 'Gen', name: 'Genesis', verses: [{ chapter: 1, verse: 1, records: [{ text: 'מֶלֶךְ', lemma: '4428', morph: 'HNcmsa' }] }] }] });
  const unit = adaptAnalysisPassage(selectEditionPassage(corpus.edition, corpus.books[0], { chapter: 1, start: 1, end: 1 }));
  expect(unit.annotations.some(item => item.kind === 'lemma')).toBe(false);
  expect(unit.annotations.find(item => item.kind === 'lexicalReference').value.references[0].id).toBe('H4428');
  expect(unit.annotations.find(item => item.kind === 'morphology').scheme).toBe('oshb-morphology');
});

test('corpus validation rejects absent rights, duplicate books and inconsistent token offsets', () => {
  expect(() => normalizeEditionDescriptor({ ...descriptor(), resources: [] })).toThrow(/license/);
  const corpus = { format: 'discourse-corpus-v1', edition: descriptor(), books: [book()] };
  expect(() => normalizeEditionCorpus({ ...corpus, books: [book(), book()] })).toThrow(/duplicate/);
  const broken = structuredClone(corpus);
  broken.books[0].verses[0].records[0].end = 1;
  expect(() => normalizeEditionCorpus(broken)).toThrow();
});

test('book loader is lazy, checks hashes, caches successes, detaches records and retries failures', async () => {
  let calls = 0;
  const bytes = new TextEncoder().encode(text);
  const edition = { ...descriptor(), bundled: true, registryUrl: 'https://example.test/app/data/editions.json', format: 'sblgnt-tab-text',
    books: [{ id: 'John', name: 'John', path: './editions/test/John.txt', sha256: await digest(bytes) }] };
  const library = createEditionLibrary({ catalog: [edition], digest, fetchRef: async () => {
    calls += 1;
    return calls === 1 ? new Response('unavailable', { status: 503 }) : new Response(bytes);
  } });
  expect(calls).toBe(0);
  await expect(library.loadBook(getEditionKey(edition), 'John')).rejects.toThrow(/Could not load/);
  const loaded = await library.loadBook(getEditionKey(edition), 'John');
  loaded.verses[0].text = 'changed';
  expect((await library.loadBook(getEditionKey(edition), 'John')).verses[0].text).not.toBe('changed');
  expect(calls).toBe(2);
});

test('book integrity treats Windows and Unix line endings as the same versioned text', async () => {
  const lfBytes = new TextEncoder().encode(text);
  const crlfBytes = new TextEncoder().encode(text.replace(/\n/g, '\r\n'));
  const edition = { ...descriptor(), bundled: true, registryUrl: 'https://example.test/app/data/editions.json', format: 'sblgnt-tab-text',
    books: [{ id: 'John', name: 'John', path: './editions/test/John.txt', sha256: await digest(canonicalizeEditionTextBytes(lfBytes)) }] };
  const library = createEditionLibrary({ catalog: [edition], digest, fetchRef: async () => new Response(crlfBytes) });
  await expect(library.loadBook(getEditionKey(edition), 'John')).resolves.toMatchObject({ id: 'John' });
});

test('corrupt assets and paths outside the local edition directory are rejected', async () => {
  const edition = { ...descriptor(), registryUrl: 'https://example.test/app/data/editions.json', format: 'sblgnt-tab-text',
    books: [{ id: 'John', name: 'John', path: './editions/test/John.txt', sha256: 'wrong' }] };
  const library = createEditionLibrary({ catalog: [edition], digest, fetchRef: async () => new Response(text) });
  await expect(library.loadBook(getEditionKey(edition), 'John')).rejects.toThrow(/integrity/);
  edition.books[0].path = 'https://other.test/John.txt';
  const external = createEditionLibrary({ catalog: [edition], fetchRef: () => { throw new Error('Should not fetch'); } });
  await expect(external.loadBook(getEditionKey(edition), 'John')).rejects.toThrow(/inside the local/);
});

test('local corpus versions are explicit and do not silently replace an existing edition', () => {
  const corpus = { format: 'discourse-corpus-v1', edition: descriptor(), books: [book()] };
  const library = createEditionLibrary();
  library.addCorpus(corpus);
  expect(() => library.addCorpus(corpus)).toThrow(/already/);
  const copy = library.list(); copy[0].title = 'Mutation';
  expect(library.list()[0].title).toBe('Test edition');
});

test('bundled registry is loadable at a repository subpath', async () => {
  const registry = JSON.parse(await readFile(new URL('../docs/data/editions.json', import.meta.url), 'utf8'));
  const catalog = await loadBundledEditionCatalog({ registryUrl: 'https://example.test/repo/data/editions.json', fetchRef: async () => Response.json(registry) });
  expect(catalog[0].books).toHaveLength(27);
  expect(catalog[0].source.language).toBe('grc');
});
