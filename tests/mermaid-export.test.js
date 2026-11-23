import { createAnalysisProject, adaptAnalysisPassage, addAnalysisProposition,
  addAnalysisGroup, addAnalysisRelation, addAnalysisRelationAnchor } from '../docs/js/core/project.js';
import { createAnalysisMermaid } from '../docs/js/core/mermaid-export.js';
import { segmentLinguisticWords } from '../docs/js/vendor/linguistic-adapters/index.js';

test('Mermaid export preserves ordered propositions, groups, and semantic edges', () => {
  const text = 'one two three four';
  const passage = { source: { sourceId: 'fixture', version: '1', language: 'en' }, unitKey: '1', text,
    records: segmentLinguisticWords(text, new Intl.Segmenter('en', { granularity: 'word' })) };
  let project = createAnalysisProject({ id: 'project', name: 'Test', passage });
  const ids = adaptAnalysisPassage(project.passage).tokens.map(token => token.id);
  project = addAnalysisProposition(project, { id: 'first', tokenIds: ids.slice(0, 2) });
  project = addAnalysisProposition(project, { id: 'second', tokenIds: ids.slice(2, 4) });
  project = addAnalysisGroup(project, { id: 'group', propositionIds: ['first', 'second'], label: 'Claim & support' });
  project = addAnalysisRelation(project, { id: 'relation', from: 'second', to: 'first', type: 'evidence' });
  project = addAnalysisRelationAnchor(project, { relationId: 'relation', tokenId: ids[2], function: 'cause' });

  expect(createAnalysisMermaid(project)).toBe(`flowchart TD
  %% Semantic export; freeform canvas coordinates are intentionally omitted.
  subgraph g1["Claim &amp; support"]
    direction TB
    p1["P1: one two"]
    p2["P2: three four"]
  end
  p2 -->|"Evidence · cue: three (cause)"| p1
`);
});
