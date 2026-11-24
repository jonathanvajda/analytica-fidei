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
export function suggestConnectiveCues(project, { includeRejected = false } = {}) {
  const unit = adaptAnalysisPassage(project.passage);
  const language = unit.source.language.toLowerCase().split('-')[0];
  const entries = CONNECTIVE_LEXICON.entries[language];
  if (!entries) return new Map();
  const acceptedTokenIds = new Set([
    ...project.propositions.flatMap(item => item.anchors ?? []),
    ...project.groups.flatMap(item => item.anchors ?? []),
    ...project.relations.flatMap(item => item.anchors ?? []),
  ].map(item => item.tokenId));
  return new Map(unit.tokens.flatMap(token => {
    const match = entries[lookupForm(token.text)];
    if (!match) return [];
    const rejected = (project.proposalReviews ?? []).some(item => item.kind === 'connective-cue' && item.tokenId === token.id
      && item.providerId === CONNECTIVE_LEXICON.id && item.version === CONNECTIVE_LEXICON.version && item.status === 'rejected');
    const status = acceptedTokenIds.has(token.id) ? 'accepted' : rejected ? 'rejected' : 'proposed';
    return rejected && !includeRejected ? [] : [[token.id, { tokenId: token.id, ...match, status,
      provenance: { providerId: CONNECTIVE_LEXICON.id, version: CONNECTIVE_LEXICON.version } }]];
  }));
}
