import { createAnalysisProject, adaptAnalysisPassage, addAnalysisProposition, addAnalysisGroup,
  addAnalysisRelation, removeAnalysisProposition, restoreAnalysisProject, buildAnalysisOutline } from '../docs/js/core/project.js';
import { createPracticePassage } from '../docs/js/core/practice-passages.js';
import { segmentLinguisticWords } from '../docs/js/vendor/linguistic-adapters/index.js';

function fixture() {
  const text = 'one two three four five six seven eight';
  const passage = { source: { sourceId: 'fixture', version: '1', language: 'en' }, unitKey: '1', text,
    records: segmentLinguisticWords(text, new Intl.Segmenter('en', { granularity: 'word' })) };
  return createAnalysisProject({ id: 'project', name: 'Test', passage });
}

function withPropositions() {
  let project = fixture();
  const unit = adaptAnalysisPassage(project.passage);
  for (let index = 0; index < 4; index += 1) project = addAnalysisProposition(project,
    { id: `p${index}`, tokenIds: unit.tokens.slice(index * 2, index * 2 + 2).map(token => token.id) });
  return project;
}

test('commands detach source data and do not mutate the project', () => {
  const project = fixture();
  const original = structuredClone(project);
  const unit = adaptAnalysisPassage(project.passage);
  const next = addAnalysisProposition(project, { id: 'p1', tokenIds: unit.tokens.slice(0, 2).map(token => token.id) });
  expect(project).toEqual(original);
  expect(next.propositions).toHaveLength(1);
  expect(next.passage.text).toBe(original.passage.text);
});

test('assignment rejects unknown, repeated, disjoint, reversed, and already assigned tokens', () => {
  const project = fixture();
  const ids = adaptAnalysisPassage(project.passage).tokens.map(token => token.id);
  for (const tokenIds of [[], ['missing'], [ids[0], ids[0]], [ids[0], ids[2]], [ids[1], ids[0]]]) {
    expect(() => addAnalysisProposition(project, { id: 'p', tokenIds })).toThrow();
  }
  const assigned = addAnalysisProposition(project, { id: 'p', tokenIds: [ids[0]] });
  expect(() => addAnalysisProposition(assigned, { id: 'q', tokenIds: [ids[0]] })).toThrow(/already/);
});

test('propositions are restored in source order independently of creation order', () => {
  let project = fixture();
  const ids = adaptAnalysisPassage(project.passage).tokens.map(token => token.id);
  project = addAnalysisProposition(project, { id: 'last', tokenIds: [ids[7]] });
  project = addAnalysisProposition(project, { id: 'first', tokenIds: [ids[0]] });
  expect(project.propositions.map(item => item.id)).toEqual(['first', 'last']);
});

test('laminar groups derive one ordered primary tree', () => {
  let project = withPropositions();
  project = addAnalysisGroup(project, { id: 'inner', propositionIds: ['p1', 'p2'], label: 'Support' });
  project = addAnalysisGroup(project, { id: 'outer', propositionIds: ['p0', 'p1', 'p2', 'p3'] });
  const tree = buildAnalysisOutline(project);
  expect(tree.map(item => item.id)).toEqual(['outer']);
  expect(tree[0].children.map(item => item.id)).toEqual(['p0', 'inner', 'p3']);
  expect(tree[0].children[1].children.map(item => item.id)).toEqual(['p1', 'p2']);
});

test('crossing, nonconsecutive, duplicate, reversed, and singleton groups are rejected', () => {
  const project = addAnalysisGroup(withPropositions(), { id: 'g', propositionIds: ['p0', 'p1', 'p2'] });
  for (const propositionIds of [['p1', 'p2', 'p3'], ['p0', 'p2'], ['p0', 'p1', 'p2'], ['p1', 'p0'], ['p0']]) {
    expect(() => addAnalysisGroup(project, { id: 'bad', propositionIds })).toThrow();
  }
});

test('semantic edges do not alter primary placement; dangling edges/groups are removed', () => {
  let project = addAnalysisGroup(withPropositions(), { id: 'g', propositionIds: ['p0', 'p1'] });
  const before = buildAnalysisOutline(project);
  project = addAnalysisRelation(project, { id: 'r', from: 'p2', to: 'p0', label: 'supports' });
  expect(buildAnalysisOutline(project)).toEqual(before);
  expect(() => addAnalysisRelation(project, { id: 'bad', from: 'p0', to: 'missing', label: 'supports' })).toThrow();
  expect(() => addAnalysisRelation(project, { id: 'bad', from: 'p0', to: 'p0', label: 'supports' })).toThrow();
  const removed = removeAnalysisProposition(project, 'p0');
  expect(removed.groups).toEqual([]);
  expect(removed.relations).toEqual([]);
  expect(removed.propositions).toHaveLength(3);
});

test('entity IDs cannot collide across node/edge collections', () => {
  const project = withPropositions();
  expect(() => addAnalysisGroup(project, { id: 'p0', propositionIds: ['p0', 'p1'] })).toThrow(/unique/);
  expect(() => addAnalysisRelation(project, { id: 'p0', from: 'p0', to: 'p1', label: 'x' })).toThrow(/unique/);
});

test('inserting inside a group cannot silently change membership', () => {
  let project = fixture();
  const ids = adaptAnalysisPassage(project.passage).tokens.map(token => token.id);
  project = addAnalysisProposition(project, { id: 'left', tokenIds: [ids[0]] });
  project = addAnalysisProposition(project, { id: 'right', tokenIds: [ids[7]] });
  project = addAnalysisGroup(project, { id: 'g', propositionIds: ['left', 'right'] });
  expect(() => addAnalysisProposition(project, { id: 'middle', tokenIds: [ids[3]] })).toThrow(/consecutive|surrounding/);
});

test('JSON restoration validates source and semantic constraints without partial mutation', () => {
  const project = addAnalysisGroup(withPropositions(), { id: 'g', propositionIds: ['p0', 'p1'] });
  expect(restoreAnalysisProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  expect(() => restoreAnalysisProject({ ...project, schemaVersion: 9 })).toThrow(/format/);
  expect(() => restoreAnalysisProject({ ...project, propositions: [project.propositions[0], project.propositions[0]] })).toThrow();
  expect(() => restoreAnalysisProject({ ...project, groups: [{ id: 'g', propositionIds: ['missing', 'p0'] }] })).toThrow();
});

test.each(['en', 'grc', 'hbo'])('practice %s text preserves exact Unicode and versioned identities', language => {
  const passage = createPracticePassage(language);
  const unit = adaptAnalysisPassage(passage);
  expect(unit.tokens.length).toBeGreaterThan(3);
  expect(unit.source.language).toBe(language);
  for (const token of unit.tokens) expect(unit.text.slice(token.range.start, token.range.end)).toBe(token.text);
  const changed = adaptAnalysisPassage({ ...passage, source: { ...passage.source, version: '2' } });
  expect(changed.tokens[0].id).not.toBe(unit.tokens[0].id);
});

test('range validation rejects splitting a pointed Hebrew grapheme', () => {
  const passage = { source: { sourceId: 'h', version: '1', language: 'hbo' }, unitKey: '1', text: 'שָׁ', records: [{ text: 'ש', start: 0, end: 1 }] };
  expect(() => adaptAnalysisPassage(passage)).toThrow(/grapheme/);
});

test('supplied lexical annotations retain language, provenance, and raw scheme', () => {
  const passage = { source: { sourceId: 'g', version: '1', language: 'grc', provenance: { providerId: 'fixture' } }, unitKey: '1',
    glossLanguage: 'en', morphologyScheme: 'fixture-codes', records: [{ text: 'λόγος', lemma: 'λόγος', gloss: 'word', strongs: 'G3056', morph: 'N-NSM' }] };
  const unit = adaptAnalysisPassage(passage);
  expect(unit.text).toBeNull();
  expect(unit.annotations.find(item => item.kind === 'gloss')).toMatchObject({ value: 'word', language: 'en' });
  expect(unit.annotations.find(item => item.kind === 'morphology')).toMatchObject({ value: 'N-NSM', scheme: 'fixture-codes', provenance: { providerId: 'fixture' } });
});
