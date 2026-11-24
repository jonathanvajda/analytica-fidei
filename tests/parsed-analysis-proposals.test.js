import { createAnalysisProject, importParsedAnalysisDataset, restoreAnalysisProject, adaptAnalysisPassage } from '../docs/js/core/project.js';

const passage = { source: { sourceId: 'sblgnt', version: '1', language: 'grc' }, unitKey: 'Eph.4.11', text: 'καὶ ἔδωκεν',
  records: [{ id: 'w1', text: 'καὶ', start: 0, end: 3 }, { id: 'w2', text: 'ἔδωκεν', start: 4, end: 10 }] };
const [firstId, secondId] = adaptAnalysisPassage(passage).tokens.map(item => item.id);
const dataset = { dataset: { id: 'syntax-fixture', version: '2026.1', language: 'grc', sourceId: 'sblgnt' }, proposals: [
  { id: 'p-clause', type: 'clause', tokenIds: [firstId, secondId], data: { clauseType: 'independent' }, confidence: 0.98, sourceRef: 'row:1' },
  { id: 'p-verb', type: 'verbal-feature', tokenIds: [secondId], data: { finite: true, tense: 'aorist' } },
] };

test('identified parsed data becomes immutable provenance-bearing drafts', () => {
  const original = createAnalysisProject({ id: 'p', name: 'Parsed draft', passage });
  const project = importParsedAnalysisDataset(original, dataset);
  expect(project.analysisProposals).toHaveLength(2);
  expect(project.analysisProposals[0]).toMatchObject({ id: 'p-clause', status: 'proposed', confidence: 0.98,
    provenance: { providerId: 'syntax-fixture', version: '2026.1', language: 'grc', sourceId: 'sblgnt' } });
  expect(Object.isFrozen(project.analysisProposals[0])).toBe(true);
  expect(original.analysisProposals).toEqual([]);
  expect(project.propositions).toEqual([]);
  expect(restoreAnalysisProject(JSON.parse(JSON.stringify(project))).analysisProposals).toEqual(project.analysisProposals);
});

test.each([
  [{ ...dataset, dataset: { ...dataset.dataset, language: 'en' } }, /language/],
  [{ ...dataset, dataset: { ...dataset.dataset, sourceId: 'kjv' } }, /source/],
  [{ ...dataset, proposals: [{ id: 'bad', type: 'role', tokenIds: ['missing'], data: { role: 'subject' } }] }, /unmapped token/],
  [{ ...dataset, proposals: [{ id: 'bad', type: 'guess', tokenIds: [firstId], data: {} }] }, /Unsupported/],
])('rejects incompatible or unmapped parsed data without changing the project', (invalid, message) => {
  const project = createAnalysisProject({ id: 'p', name: 'Parsed draft', passage });
  expect(() => importParsedAnalysisDataset(project, invalid)).toThrow(message);
  expect(project.analysisProposals).toEqual([]);
});
