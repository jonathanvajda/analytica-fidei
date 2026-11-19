import { createLinguisticSource } from '../vendor/linguistic-adapters/index.js';
import { adaptProfiledUnit } from './linguistic-profiles.js';

const PROFILES = new Set(['records', 'sblgnt-records', 'oshb-words']);

/** Validate identity and rights metadata without interpreting license terms.
 * @param {object} value Edition descriptor from a registry or imported corpus.
 * @returns {object} Detached, portable descriptor.
 */
export function normalizeEditionDescriptor(value) {
  if (!value || typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(value.id) ||
    typeof value.title !== 'string' || !value.title.trim() || !PROFILES.has(value.profile ?? 'records')) throw new Error('Invalid edition descriptor.');
  const source = createLinguisticSource(value.source);
  if (!source.referenceScheme) throw new Error('An edition requires an explicit reference scheme.');
  if (!Array.isArray(value.resources) || !value.resources.length || value.resources.some(resource =>
    !resource || typeof resource.kind !== 'string' || typeof resource.license !== 'string' || !resource.license.trim() ||
    typeof resource.attribution !== 'string' || !resource.attribution.trim())) throw new Error('Record the license and attribution of edition resources.');
  return { id: value.id, title: value.title.trim(), source, profile: value.profile ?? 'records',
    resources: structuredClone(value.resources),
    ...(value.glossLanguage ? { glossLanguage: value.glossLanguage } : {}),
    ...(value.morphologyScheme ? { morphologyScheme: value.morphologyScheme } : {}),
    ...(value.fields ? { fields: structuredClone(value.fields) } : {}) };
}

/** Parse official SBLGNT tab-delimited book text, preserving the verse payload exactly.
 * Tokenization is a documented deterministic word projection, not morphology.
 * @param {string} text UTF-8 decoded book file, including its title line.
 * @param {{id:string,name:string}} book Expected source book code and display name.
 * @returns {{id:string,name:string,verses:object[]}}
 */
export function parseSblgntBookText(text, book) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const verses = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    if (index === 0 && !line.includes('\t')) continue; // The upstream title is not a verse.
    const match = /^([^\s]+) ([1-9]\d*):([1-9]\d*)\t(.*)$/.exec(line);
    if (!match || match[1] !== book.id) throw new Error(`Invalid ${book.id} verse record on line ${index + 1}.`);
    const [, , chapter, verse, payload] = match;
    const records = [...payload.matchAll(/[\p{L}\p{M}\p{N}]+(?:['’ʼ][\p{L}\p{M}\p{N}]+)*['’ʼ]?/gu)]
      .map((word, wordIndex) => ({ id: `${book.id}.${chapter}.${verse}.w${wordIndex + 1}`, text: word[0], start: word.index, end: word.index + word[0].length }));
    verses.push({ chapter: Number(chapter), verse: Number(verse), text: payload, records });
  }
  validateVerseOrder(verses);
  if (!verses.length) throw new Error('The imported book has no verse records.');
  return { id: book.id, name: book.name, verses };
}

function validateVerseOrder(verses) {
  let previousChapter = 0;
  let previousVerse = 0;
  for (const verse of verses) {
    if (!Number.isInteger(verse.chapter) || verse.chapter < 1 || !Number.isInteger(verse.verse) || verse.verse < 1 ||
      verse.chapter < previousChapter || (verse.chapter === previousChapter && verse.verse <= previousVerse)) throw new Error('Verse records must be distinct and in source order.');
    previousChapter = verse.chapter; previousVerse = verse.verse;
  }
}

/** Available references come from actual records, not assumed verse counts. */
export function describeEditionBook(book) {
  const chapters = new Map();
  for (const item of book.verses) {
    if (!chapters.has(item.chapter)) chapters.set(item.chapter, []);
    chapters.get(item.chapter).push(item.verse);
  }
  return { id: book.id, name: book.name, chapters: [...chapters].map(([number, verses]) => ({ number, verses })) };
}

/** Validate a portable, already-parsed corpus for local import.
 * @param {object} value {format:'discourse-corpus-v1',edition,books:[{id,name,verses}]}.
 * @returns {object} Validated corpus with explicit source, annotation profile and rights.
 */
export function normalizeEditionCorpus(value) {
  if (value?.format !== 'discourse-corpus-v1' || !Array.isArray(value.books) || !value.books.length) throw new Error('Unsupported edition corpus format.');
  const edition = normalizeEditionDescriptor(value.edition);
  const seen = new Set();
  const books = value.books.map(book => {
    if (!book || typeof book.id !== 'string' || !/^[a-z0-9._-]+$/i.test(book.id) || seen.has(book.id) ||
      typeof book.name !== 'string' || !book.name.trim() || !Array.isArray(book.verses) || !book.verses.length) throw new Error('Invalid or duplicate corpus book.');
    seen.add(book.id); validateVerseOrder(book.verses);
    const verses = book.verses.map(verse => {
      const unit = adaptProfiledUnit({ ...edition, text: verse.text, records: verse.records,
        source: edition.source, profile: edition.profile, unitKey: `${book.id}.${verse.chapter}.${verse.verse}` });
      if (!unit.tokens.length && unit.text?.trim()) throw new Error('Nonempty verse text requires supplied token records.');
      return { chapter: verse.chapter, verse: verse.verse, text: verse.text ?? null, records: structuredClone(verse.records) };
    });
    return { id: book.id, name: book.name.trim(), verses };
  });
  return { format: 'discourse-corpus-v1', edition, books };
}

/** Select a within-chapter range without inventing missing verses or cross-edition alignment.
 * Canonical segment keys keep token IDs stable across different selected ranges.
 * @param {object} edition Validated edition descriptor.
 * @param {object} book Parsed edition book.
 * @param {{chapter:number,start:number,end:number}} range Inclusive verse bounds.
 * @returns {object} Portable passage input accepted by the analysis core.
 */
export function selectEditionPassage(edition, book, { chapter, start, end }) {
  if (![chapter, start, end].every(value => Number.isInteger(value) && value > 0) || start > end || end - start >= 25) throw new Error('Choose an ordered range of at most 25 verses within one chapter.');
  const verses = book.verses.filter(item => item.chapter === chapter && item.verse >= start && item.verse <= end);
  if (verses.length !== end - start + 1) throw new Error('This edition has no supplied record for part of the selected range.');
  const display = `${book.name} ${chapter}:${start}${end === start ? '' : `–${end}`}`;
  return { source: structuredClone(edition.source), profile: edition.profile, fields: edition.fields ?? {},
    ...(edition.glossLanguage ? { glossLanguage: edition.glossLanguage } : {}),
    ...(edition.morphologyScheme ? { morphologyScheme: edition.morphologyScheme } : {}),
    unitKey: `${book.id}.${chapter}.${start}-${end}`, reference: { book: book.id, chapter, start, end, display },
    resources: structuredClone(edition.resources), editionTitle: edition.title,
    segments: verses.map(verse => ({ ...structuredClone(verse), unitKey: `${book.id}.${chapter}.${verse.verse}`,
      reference: { book: book.id, chapter, verse: verse.verse, display: `${book.name} ${chapter}:${verse.verse}` } })) };
}
