import { createAnalysisProject, adaptAnalysisPassage, addAnalysisProposition, addAnalysisPropositionAnchor,
  rejectAnalysisProposal, restoreAnalysisProposal, restoreAnalysisProject } from '../docs/js/core/project.js';
import { collectGrammaticalLandmarks } from '../docs/js/core/grammatical-landmarks.js';
import { suggestConnectiveCues } from '../docs/js/core/connective-suggestions.js';

test('landmarks use supplied POS and accepted anchors without decoding unknown morphology', () => {
  const passage = { source: { sourceId: 'fixture', version: '1', language: 'grc' }, unitKey: '1', text: 'λέγει οὖν λόγος',
    records: [
      { text: 'λέγει', start: 0, end: 5, pos: 'finite verb', morph: 'UNKNOWN' },
      { text: 'οὖν', start: 6, end: 9, pos: 'conjunction' },
      { text: 'λόγος', start: 10, end: 15, pos: 'noun' },
    ] };
  let project = createAnalysisProject({ id: 'p', name: 'Landmarks', passage });
  const ids = adaptAnalysisPassage(passage).tokens.map(item => item.id);
  project = addAnalysisProposition(project, { id: 'prop', tokenIds: ids });
  project = addAnalysisPropositionAnchor(project, { propositionId: 'prop', tokenId: ids[2], function: 'reason' });
  const landmarks = collectGrammaticalLandmarks(project);
  expect(landmarks.get(ids[0]).map(item => item.type)).toEqual(['finite-verb']);
  expect(landmarks.get(ids[1]).map(item => item.type)).toEqual(['connective']);
  expect(landmarks.get(ids[2])).toEqual(expect.arrayContaining([{ type: 'noun', source: 'supplied', annotationId: expect.any(String) },
    { type: 'connective', source: 'accepted' }]));
});

test('versioned language lexicons emit proposals without accepting relationships', () => {
  const passage = { source: { sourceId: 'fixture', version: '1', language: 'grc' }, unitKey: '1', text: 'οὖν λόγος',
    records: [{ text: 'οὖν', start: 0, end: 3 }, { text: 'λόγος', start: 4, end: 9 }] };
  const project = createAnalysisProject({ id: 'p', name: 'Suggested cues', passage });
  const ids = adaptAnalysisPassage(passage).tokens.map(item => item.id);
  const suggestions = suggestConnectiveCues(project);
  expect(suggestions.get(ids[0])).toMatchObject({ function: 'result', status: 'proposed',
    provenance: { providerId: 'analytica-fidei-connectives', version: '1' } });
  expect(suggestions.has(ids[1])).toBe(false);
  expect(collectGrammaticalLandmarks(project).get(ids[0])).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'connective', source: 'proposed', function: 'result' }),
  ]));
  expect(project.relations).toEqual([]);
});

test('connective proposals run only for a supported analysis language', () => {
  const passage = { source: { sourceId: 'fixture', version: '1', language: 'hbo' }, unitKey: '1', text: 'οὖν',
    records: [{ text: 'οὖν', start: 0, end: 3 }] };
  const project = createAnalysisProject({ id: 'p', name: 'Unsupported language', passage });
  expect(suggestConnectiveCues(project).size).toBe(0);
});

test('connective proposal rejection persists and remains reversible', () => {
  const passage = { source: { sourceId: 'fixture', version: '1', language: 'en' }, unitKey: '1', text: 'Therefore listen',
    records: [{ text: 'Therefore', start: 0, end: 9 }, { text: 'listen', start: 10, end: 16 }] };
  let project = createAnalysisProject({ id: 'p', name: 'Proposal review', passage });
  const tokenId = adaptAnalysisPassage(passage).tokens[0].id;
  const review = { kind: 'connective-cue', tokenId, providerId: 'analytica-fidei-connectives', version: '1' };
  project = rejectAnalysisProposal(project, review);
  expect(suggestConnectiveCues(project).has(tokenId)).toBe(false);
  expect(suggestConnectiveCues(project, { includeRejected: true }).get(tokenId).status).toBe('rejected');
  project = restoreAnalysisProject(JSON.parse(JSON.stringify(project)));
  expect(project.proposalReviews).toEqual([{ ...review, status: 'rejected' }]);
  project = restoreAnalysisProposal(project, review);
  expect(suggestConnectiveCues(project).get(tokenId).status).toBe('proposed');
});
