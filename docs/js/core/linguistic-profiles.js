import { createTokenRecordAdapter, createSblgntTokenAdapter, createOshbWordAdapter,
  createLinguisticUnit } from '../vendor/linguistic-adapters/index.js';

/** Adapt one parsed unit using an explicit provider profile, never a language guess. */
export function adaptProfiledUnit(passage) {
  const options = { fields: passage.fields ?? {} };
  if (passage.glossLanguage !== undefined) options.glossLanguage = passage.glossLanguage;
  if (passage.morphologyScheme !== undefined) options.morphologyScheme = passage.morphologyScheme;
  const factories = { records: () => createTokenRecordAdapter({ adapterId: 'discourse-parsed-records', ...options }),
    'sblgnt-records': () => createSblgntTokenAdapter(options), 'oshb-words': () => createOshbWordAdapter(options) };
  const factory = factories[passage.profile ?? 'records'];
  if (typeof factory !== 'function') throw new Error('Unsupported linguistic record profile.');
  return factory().adaptUnit(passage);
}

/** Build a range display without changing canonical per-verse token identities.
 * @param {object} passage Single parsed unit or ordered, edition-specific segments.
 * @returns {object} Normalized display unit; exact segment texts remain in the input.
 */
export function adaptProfiledPassage(passage) {
  if (passage.segments === undefined) return adaptProfiledUnit(passage);
  if (!Array.isArray(passage.segments) || !passage.segments.length) throw new Error('A passage range requires source segments.');
  const seen = new Set();
  const units = passage.segments.map(segment => {
    if (seen.has(segment.unitKey)) throw new Error('Duplicate passage segment.');
    seen.add(segment.unitKey);
    return adaptProfiledUnit({ ...passage, ...segment, source: passage.source, profile: passage.profile });
  });
  const exact = units.every(unit => unit.text !== null);
  const text = exact ? units.map(unit => unit.text).join('\n') : null;
  const header = createLinguisticUnit({ source: passage.source, unitKey: passage.unitKey, reference: passage.reference, text, tokens: [] });
  let offset = 0;
  let index = 0;
  const tokens = units.flatMap(unit => {
    const result = unit.tokens.map((token, position) => ({ ...token, index: index++, reference: unit.reference,
      isVerseStart: position === 0, sourceRange: token.range,
      range: exact && token.range ? { ...token.range, start: token.range.start + offset, end: token.range.end + offset } : null }));
    offset += (unit.text?.length ?? 0) + 1;
    return result;
  });
  return { ...header, tokens, annotations: units.flatMap(unit => unit.annotations) };
}
