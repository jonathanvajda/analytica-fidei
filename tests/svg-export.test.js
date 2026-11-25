import { createAnalysisProject, adaptAnalysisPassage, addAnalysisProposition,
  addAnalysisGroup, addAnalysisRelation } from '../docs/js/core/project.js';
import { createAnalysisSvg } from '../docs/js/core/svg-export.js';

test('SVG export serializes resolved words, groups, and directed relationships as vectors', () => {
  const passage = { source: { sourceId: 'fixture', version: '1', language: 'en' }, unitKey: '1', text: 'one & two three',
    records: [{ id: 'w1', text: 'one', start: 0, end: 3 }, { id: 'w2', text: '&', start: 4, end: 5 },
      { id: 'w3', text: 'two', start: 6, end: 9 }, { id: 'w4', text: 'three', start: 10, end: 15 }] };
  let project = createAnalysisProject({ id: 'p', name: 'Claim < support', passage });
  const ids = adaptAnalysisPassage(passage).tokens.map(item => item.id);
  project = addAnalysisProposition(project, { id: 'p1', tokenIds: ids.slice(0, 2) });
  project = addAnalysisProposition(project, { id: 'p2', tokenIds: ids.slice(2) });
  project = addAnalysisGroup(project, { id: 'g1', propositionIds: ['p1', 'p2'], label: 'Whole argument' });
  project = addAnalysisRelation(project, { id: 'r1', from: 'p2', to: 'p1', type: 'evidence' });
  const svg = createAnalysisSvg(project);
  expect(svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
  expect(svg).toContain('<title id="title">Claim &lt; support discourse analysis</title>');
  expect(svg).toContain('data-token-id=');
  expect(svg).toContain('>one</text>');
  expect(svg).toContain('>&amp;</text>');
  expect(svg).toContain('data-group-id="g1"');
  expect(svg).toContain('G1: Whole argument');
  expect(svg).toContain('data-relation-id="r1"');
  expect(svg).toContain('marker-end="url(#arrow)"');
  expect(svg).toContain('>Evidence</text>');
  expect(svg).not.toContain('<script');
});

test('SVG export preserves canonical RTL source text and language metadata', () => {
  const passage = { source: { sourceId: 'h', version: '1', language: 'hbo' }, unitKey: '1', records: [{ id: 'w1', text: 'בְּרֵאשִׁית' }] };
  const svg = createAnalysisSvg(createAnalysisProject({ id: 'p', name: 'Hebrew', passage }));
  expect(svg).toContain('lang="hbo" direction="rtl" unicode-bidi="plaintext">בְּרֵאשִׁית</text>');
});
