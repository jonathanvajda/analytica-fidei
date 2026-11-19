import { segmentLinguisticWords } from '../vendor/linguistic-adapters/index.js';

const TEXTS = {
  en: 'The teacher spoke. The people listened. They asked a question. The teacher answered.',
  grc: 'ὁ διδάσκαλος λέγει. οἱ μαθηταὶ ἀκούουσιν. ὁ διδάσκαλος γράφει. οἱ μαθηταὶ βλέπουσιν.',
  hbo: 'הַמּוֹרֶה דִּבֵּר. הַתַּלְמִיד שָׁמַע. הַמּוֹרֶה כָּתַב. הַתַּלְמִיד קָרָא.',
};

/** Authored practice material only; never presented as scripture or a licensed edition. */
export function createPracticePassage(language = 'en') {
  const text = TEXTS[language];
  if (!text) throw new Error('Unknown practice language.');
  const records = segmentLinguisticWords(text, new Intl.Segmenter(language, { granularity: 'word' }));
  return { source: { sourceId: `practice-${language}`, version: '1', language,
    provenance: { providerId: 'discourse-analysis-practice', description: 'Authored synthetic practice text; not a Bible edition.' } },
    unitKey: 'practice:1', reference: { display: 'Practice text · not a Bible passage' }, text, records };
}
