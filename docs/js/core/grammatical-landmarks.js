import { adaptAnalysisPassage } from './project.js';
import { suggestConnectiveCues } from './connective-suggestions.js';

export const GRAMMATICAL_LANDMARK_TYPES = Object.freeze([
  { id: 'finite-verb', label: 'Finite verb', symbol: 'V', description: 'Supplied as a finite verbal form.' },
  { id: 'connective', label: 'Connective cue', symbol: '◇', description: 'Supplied as a connective part of speech, proposed by a language lexicon, or accepted as a connective anchor.' },
  { id: 'noun', label: 'Noun', symbol: 'N', description: 'Supplied nominal part of speech.' },
  { id: 'adjective', label: 'Adjective', symbol: 'A', description: 'Supplied adjectival part of speech.' },
  { id: 'adverb', label: 'Adverb', symbol: 'D', description: 'Supplied adverbial part of speech.' },
  { id: 'preposition', label: 'Preposition', symbol: 'P', description: 'Supplied prepositional part of speech.' },
  { id: 'pronoun', label: 'Pronoun', symbol: 'R', description: 'Supplied pronominal part of speech.' },
  { id: 'article', label: 'Article', symbol: 'T', description: 'Supplied article/determiner part of speech.' },
]);

function annotationText(value) {
  if (typeof value === 'string') return value.toLowerCase();
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key} ${item}`).join(' ').toLowerCase();
  return '';
}

function suppliedType(annotation) {
  const text = annotationText(annotation.value);
  if (/finite[-_ ]?verb|verb[-_ ]?finite|\bfinite\b/.test(text)) return 'finite-verb';
  if (/conjunction|connective|particle/.test(text)) return 'connective';
  if (/adjective|adjectival/.test(text)) return 'adjective';
  if (/adverb|adverbial/.test(text)) return 'adverb';
  if (/preposition|prepositional/.test(text)) return 'preposition';
  if (/pronoun|pronominal/.test(text)) return 'pronoun';
  if (/article|determiner/.test(text)) return 'article';
  if (/noun|nominal/.test(text)) return 'noun';
  return null;
}

/** Derive presentation-only landmarks from supplied POS and accepted connective anchors. */
export function collectGrammaticalLandmarks(project) {
  const unit = adaptAnalysisPassage(project.passage);
  const byToken = new Map(unit.tokens.map(token => [token.id, []]));
  for (const annotation of unit.annotations.filter(item => item.kind === 'partOfSpeech' && item.status !== 'unavailable')) {
    const type = suppliedType(annotation);
    if (type) byToken.get(annotation.targetTokenId)?.push({ type, source: 'supplied', annotationId: annotation.id });
  }
  const anchors = [
    ...project.propositions.flatMap(item => item.anchors ?? []),
    ...project.groups.flatMap(item => item.anchors ?? []),
    ...project.relations.flatMap(item => item.anchors ?? []),
  ];
  for (const anchor of anchors) {
    const landmarks = byToken.get(anchor.tokenId);
    if (landmarks && !landmarks.some(item => item.type === 'connective')) landmarks.push({ type: 'connective', source: 'accepted' });
  }
  for (const suggestion of suggestConnectiveCues(project).values()) {
    const landmarks = byToken.get(suggestion.tokenId);
    if (landmarks && !landmarks.some(item => item.type === 'connective')) landmarks.push({
      type: 'connective', source: 'proposed', function: suggestion.function,
      explanation: suggestion.explanation, provenance: suggestion.provenance,
    });
  }
  return byToken;
}
