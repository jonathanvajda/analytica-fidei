import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseSblgntBookText, describeEditionBook } from '../docs/js/core/editions.js';

const PINNED_REVISION = 'c4d241a9c1c479a55b989ba35a4976c1d0b8052c';
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/build-sblgnt.mjs <local SBLGNT checkout>');
const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision !== PINNED_REVISION) throw new Error('Unexpected SBLGNT revision. Review the new release before changing the pin.');
const origin = execFileSync('git', ['-C', source, 'config', '--get', 'remote.origin.url'], { encoding: 'utf8' }).trim();
const repository = /github\.com[/:]([^/]+\/[^\s]+?)(?:\.git)?$/.exec(origin)?.[1];
if (!repository) throw new Error('Expected a GitHub source repository.');
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const names = [['Matt','Matthew'],['Mark','Mark'],['Luke','Luke'],['John','John'],['Acts','Acts'],['Rom','Romans'],
  ['1Cor','1 Corinthians'],['2Cor','2 Corinthians'],['Gal','Galatians'],['Eph','Ephesians'],['Phil','Philippians'],
  ['Col','Colossians'],['1Thess','1 Thessalonians'],['2Thess','2 Thessalonians'],['1Tim','1 Timothy'],['2Tim','2 Timothy'],
  ['Titus','Titus'],['Phlm','Philemon'],['Heb','Hebrews'],['Jas','James'],['1Pet','1 Peter'],['2Pet','2 Peter'],
  ['1John','1 John'],['2John','2 John'],['3John','3 John'],['Jude','Jude'],['Rev','Revelation']];
const directory = 'docs/data/editions/sblgnt';
await mkdir(`${directory}/text`, { recursive: true });
const license = await readFile(resolve(source, 'LICENSE'));
const readme = await readFile(resolve(source, 'README.md'), 'utf8');
if (!license.toString('utf8').startsWith('Attribution 4.0 International') || !readme.includes('creativecommons.org/licenses/by/4.0/')) throw new Error('Expected the reviewed CC BY 4.0 source license.');
await writeFile(`${directory}/LICENSE`, license);
const books = [];
for (const [id, name] of names) {
  const inputPath = `data/sblgnt/text/${id}.txt`;
  const content = await readFile(resolve(source, inputPath));
  // Refuse modified source files even when HEAD still matches the reviewed revision.
  const committed = execFileSync('git', ['-C', source, 'show', `${revision}:${inputPath}`]);
  if (hash(content) !== hash(committed)) throw new Error(`Modified source file: ${inputPath}`);
  const book = parseSblgntBookText(content.toString('utf8'), { id, name });
  const path = `./editions/sblgnt/text/${id}.txt`;
  await writeFile(`${directory}/text/${id}.txt`, content);
  books.push({ ...describeEditionBook(book), path, sha256: hash(content), verses: book.verses.length,
    tokens: book.verses.reduce((total, verse) => total + verse.records.length, 0) });
}
const edition = { id: 'sblgnt', title: 'SBL Greek New Testament', profile: 'sblgnt-records',
  source: { sourceId: 'sblgnt', version: `1.2-${revision}-word-v1`, language: 'grc', referenceScheme: 'sblgnt-1.2',
    provenance: { providerId: 'sblgnt', release: '1.2', revision, repository: `https://github.com/${repository}`,
      tokenization: 'discourse-sblgnt-word-v1', modifications: 'Original verse payload retained. Deterministic word records and UTF-16 offsets added; no morphology inferred.' } },
  resources: [{ kind: 'text', license: 'CC-BY-4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'The Greek New Testament: SBL Edition. Michael W. Holmes, General Editor. Copyright 2010 Logos Bible Software and the Society of Biblical Literature.',
    sourceUrl: `https://github.com/${repository}/tree/${revision}` }],
  format: 'sblgnt-tab-text', capabilities: { text: true, lemma: false, morphology: false, gloss: false, strongs: false }, books };
const manifest = { format: 'discourse-edition-registry-v1', editions: [edition],
  build: { script: 'scripts/build-sblgnt.mjs', scriptSha256: hash(await readFile('scripts/build-sblgnt.mjs')),
    parser: 'docs/js/core/editions.js', parserSha256: hash(await readFile('docs/js/core/editions.js')), licenseSha256: hash(license) } };
await writeFile('docs/data/editions.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${books.length} books, ${books.reduce((total, book) => total + book.verses, 0)} supplied verses.`);
