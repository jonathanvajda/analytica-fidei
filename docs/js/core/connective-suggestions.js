import { adaptAnalysisPassage } from './project.js';

export const CONNECTIVE_LEXICON = Object.freeze({
  id: 'analytica-fidei-connectives',
  version: '1',
  entries: Object.freeze({
    grc: Object.freeze({
      'και': { function: 'coordination', explanation: 'Common coordinating conjunction.' },
      'γαρ': { function: 'cause', explanation: 'Common explanatory or causal conjunction.' },
      'ουν': { function: 'result', explanation: 'Common inferential connective.' },
      'ινα': { function: 'purpose', explanation: 'Common purpose-clause marker; context can also indicate result.' },
    }),
    en: Object.freeze({
      and: { function: 'coordination', explanation: 'Common coordinating conjunction.' },
      because: { function: 'cause', explanation: 'Common causal subordinator.' },
      therefore: { function: 'result', explanation: 'Common inferential connective.' },
      but: { function: 'contrast', explanation: 'Common contrastive conjunction.' },
    }),
  }),
});

function lookupForm(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}]/gu, '').toLocaleLowerCase();
}

/** Return reviewable lexical cues without changing the accepted analysis. */
export function suggestConnectiveCues(project) {
  const unit = adaptAnalysisPassage(project.passage);
  const language = unit.source.language.toLowerCase().split('-')[0];
  const entries = CONNECTIVE_LEXICON.entries[language];
  if (!entries) return new Map();
  return new Map(unit.tokens.flatMap(token => {
    const match = entries[lookupForm(token.text)];
    return match ? [[token.id, { tokenId: token.id, ...match, status: 'proposed',
      provenance: { providerId: CONNECTIVE_LEXICON.id, version: CONNECTIVE_LEXICON.version } }]] : [];
  }));
}
