import { createAnalysisProject, importParsedAnalysisDataset, restoreAnalysisProject, adaptAnalysisPassage,
  acceptParsedClauseProposal, rejectParsedAnalysisProposal, restoreParsedAnalysisProposal } from '../docs/js/core/project.js';
import { removeAnalysisProposition, acceptParsedConstituentProposal, removeAnalysisConstituent } from '../docs/js/core/project.js';

const passage = { source: { sourceId: 'sblgnt', version: '1', language: 'grc' }, unitKey: 'Eph.4.11', text: 'καὶ ἔδωκεν',
  records: [{ id: 'w1', text: 'καὶ', start: 0, end: 3 }, { id: 'w2', text: 'ἔδωκεν', start: 4, end: 10 }] };
const [firstId, secondId] = adaptAnalysisPassage(passage).tokens.map(item => item.id);
const dataset = { dataset: { id: 'syntax-fixture', version: '2026.1', language: 'grc', sourceId: 'sblgnt' }, proposals: [
  { id: 'p-clause', type: 'clause', tokenIds: [firstId, secondId], data: { clauseType: 'independent' }, confidence: 0.98, sourceRef: 'row:1' },
  { id: 'p-verb', type: 'verbal-feature', tokenIds: [secondId], data: { finite: true, tense: 'aorist' } },
  { id: 'p-phrase', type: 'constituent', tokenIds: [firstId], data: { label: 'linking phrase' } },
] };

test('identified parsed data becomes immutable provenance-bearing drafts', () => {
  const original = createAnalysisProject({ id: 'p', name: 'Parsed draft', passage });
  const project = importParsedAnalysisDataset(original, dataset);
  expect(project.analysisProposals).toHaveLength(3);
  expect(project.analysisProposals[0]).toMatchObject({ id: 'p-clause', status: 'proposed', confidence: 0.98,
    provenance: { providerId: 'syntax-fixture', version: '2026.1', language: 'grc', sourceId: 'sblgnt' } });
  expect(Object.isFrozen(project.analysisProposals[0])).toBe(true);
  expect(original.analysisProposals).toEqual([]);
  expect(project.propositions).toEqual([]);
  expect(restoreAnalysisProject(JSON.parse(JSON.stringify(project))).analysisProposals).toEqual(project.analysisProposals);
});

test('constituent acceptance creates a reusable phrase without inventing a role', () => {
  let project = importParsedAnalysisDataset(createAnalysisProject({ id: 'p', name: 'Review', passage }), dataset);
  project = acceptParsedConstituentProposal(project, { proposalId: 'p-phrase', constituentId: 'accepted-phrase' });
  expect(project.constituents).toEqual([{ id: 'accepted-phrase', tokenIds: [firstId], label: 'linking phrase' }]);
  expect(project.propositions).toEqual([]);
  expect(project.analysisProposals.find(item => item.id === 'p-phrase')).toMatchObject({
    status: 'accepted', acceptedEntityId: 'accepted-phrase',
  });
  expect(restoreAnalysisProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  project = removeAnalysisConstituent(project, 'accepted-phrase');
  expect(project.analysisProposals.find(item => item.id === 'p-phrase')).toMatchObject({ status: 'proposed' });
});

test('clause acceptance uses proposition validation and proposal review is reversible', () => {
  let project = importParsedAnalysisDataset(createAnalysisProject({ id: 'p', name: 'Review', passage }), dataset);
  project = rejectParsedAnalysisProposal(project, 'p-clause');
  expect(project.analysisProposals.find(item => item.id === 'p-clause').status).toBe('rejected');
  project = restoreParsedAnalysisProposal(project, 'p-clause');
  project = acceptParsedClauseProposal(project, { proposalId: 'p-clause', propositionId: 'accepted-clause' });
  expect(project.propositions[0]).toMatchObject({ id: 'accepted-clause', tokenIds: [firstId, secondId] });
  expect(project.analysisProposals.find(item => item.id === 'p-clause')).toMatchObject({
    status: 'accepted', acceptedEntityId: 'accepted-clause', provenance: { providerId: 'syntax-fixture' },
  });
  expect(() => acceptParsedClauseProposal(project, { proposalId: 'p-clause', propositionId: 'again' })).toThrow(/proposed clause/);
  expect(restoreAnalysisProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  project = removeAnalysisProposition(project, 'accepted-clause');
  expect(project.analysisProposals.find(item => item.id === 'p-clause')).toMatchObject({ status: 'proposed' });
  expect(project.analysisProposals.find(item => item.id === 'p-clause')).not.toHaveProperty('acceptedEntityId');
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
