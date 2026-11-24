import { createAnalysisProject, adaptAnalysisPassage, addAnalysisProposition, addAnalysisPropositionAnchor } from '../docs/js/core/project.js';
import { collectGrammaticalLandmarks } from '../docs/js/core/grammatical-landmarks.js';

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
