import { createAnalysisProject, adaptAnalysisPassage, addAnalysisProposition, addAnalysisGroup, addAnalysisRelation,
  restoreAnalysisProject } from '../docs/js/core/project.js';
import { createPracticePassage } from '../docs/js/core/practice-passages.js';
import { computeAnalysisCanvas, placeAnalysisCanvasWord, resetAnalysisCanvas } from '../docs/js/core/canvas-layout.js';

const createProject = language => createAnalysisProject({ id: 'test', name: 'Grid', passage: createPracticePassage(language) });
const wordIds = project => adaptAnalysisPassage(project.passage).tokens.map(token => token.id);

function expectNoOverlaps(canvas) {
  for (const block of canvas.blocks) {
    for (const word of block.words) {
      expect(word.column).toBeGreaterThanOrEqual(0);
      expect(word.column + word.width).toBeLessThanOrEqual(canvas.presentation.columns);
      for (const other of block.words.filter(item => item.id !== word.id && item.row === word.row)) {
        expect(word.column + word.width <= other.column || other.column + other.width <= word.column).toBe(true);
      }
    }
  }
}

test('all source words appear on the canvas before propositions exist', () => {
  const project = createProject();
  const model = computeAnalysisCanvas(project);
  expect(model.blocks).toHaveLength(1);
  expect(model.blocks[0].kind).toBe('source');
  expect(model.blocks[0].words.map(word => word.id)).toEqual(wordIds(project));
  expectNoOverlaps(model);
});

test('grid placement is immutable presentation data, not a change to text or semantics', () => {
  let project = createProject();
  const ids = wordIds(project);
  project = addAnalysisProposition(project, { id: 'p', tokenIds: ids.slice(0, 3) });
  const original = structuredClone(project);
  const moved = placeAnalysisCanvasWord(project, { tokenId: ids[0], column: 12, row: 2 });
  expect(project).toEqual(original);
  expect(moved.passage).toEqual(project.passage);
  expect(moved.propositions).toEqual(project.propositions);
  expect(moved.groups).toEqual(project.groups);
  expect(moved.relations).toEqual(project.relations);
  expect(moved.layout.words[ids[0]]).toEqual({ column: 12, row: 2 });
});

test('dropping onto occupied cells clears collisions without overlap or duplicate tokens', () => {
  const project = createProject();
  const model = computeAnalysisCanvas(project);
  const [first, second] = model.blocks[0].words;
  const moved = placeAnalysisCanvasWord(project, { tokenId: first.id, column: second.column, row: second.row });
  const next = computeAnalysisCanvas(moved);
  expect(next.blocks[0].words.find(word => word.id === first.id).column).toBe(second.column);
  expect(next.blocks[0].words.map(word => word.id)).toEqual(wordIds(project));
  expectNoOverlaps(next);
});

test('expanding a proposition shifts following blocks and their bracket endpoints', () => {
  let project = createProject();
  const ids = wordIds(project);
  project = addAnalysisProposition(project, { id: 'p1', tokenIds: ids.slice(0, 3) });
  project = addAnalysisProposition(project, { id: 'p2', tokenIds: ids.slice(3, 6) });
  project = addAnalysisGroup(project, { id: 'g', propositionIds: ['p1', 'p2'] });
  project = addAnalysisRelation(project, { id: 'r', from: 'p1', to: 'p2', label: 'elicits' });
  const before = computeAnalysisCanvas(project);
  const after = computeAnalysisCanvas(placeAnalysisCanvasWord(project, { tokenId: ids[0], column: 4, row: 4 }));
  expect(after.blocks[1].top).toBeGreaterThan(before.blocks[1].top);
  expect(after.groups[0].bottom).toBeGreaterThan(before.groups[0].bottom);
  expect(after.blocks[0].relations[0]).toEqual(project.relations[0]);
  expect(after.blocks[0].bottom).toBeLessThan(after.blocks[1].top);
});

test('positions survive JSON restoration and old v1 backups still open', () => {
  const project = createProject();
  const moved = placeAnalysisCanvasWord(project, { tokenId: wordIds(project)[0], column: 8, row: 1 });
  expect(restoreAnalysisProject(JSON.parse(JSON.stringify(moved)))).toEqual(moved);
  expect(restoreAnalysisProject(project)).toEqual(project);
  expect(resetAnalysisCanvas(moved).layout.words).toEqual({});
});

test('invalid or foreign saved coordinates cannot enter the analysis', () => {
  const project = createProject();
  const id = wordIds(project)[0];
  for (const point of [{ column: -1, row: 0 }, { column: 0.5, row: 0 }, { column: 0, row: 256 }]) {
    expect(() => placeAnalysisCanvasWord(project, { tokenId: id, ...point })).toThrow();
    expect(() => restoreAnalysisProject({ ...project, layout: { columns: 36, words: { [id]: point } } })).toThrow();
  }
  expect(() => placeAnalysisCanvasWord(project, { tokenId: 'foreign', column: 0, row: 0 })).toThrow(/passage/);
  expect(() => restoreAnalysisProject({ ...project, layout: { columns: 36, words: { foreign: { column: 0, row: 0 } } } })).toThrow();
});

test('Hebrew defaults flow right-to-left while source identities and order stay canonical', () => {
  const project = createProject('hbo');
  const canvas = computeAnalysisCanvas(project);
  const [first, second] = canvas.blocks[0].words;
  expect(first.column).toBeGreaterThan(second.column);
  expect(canvas.blocks[0].words.map(word => word.id)).toEqual(wordIds(project));
  expectNoOverlaps(canvas);
});

test('measured long words fit the grid and retain deterministic collision resolution', () => {
  const project = createProject();
  const id = wordIds(project)[0];
  const options = { tokenWidths: { [id]: 5000 } };
  const moved = placeAnalysisCanvasWord(project, { tokenId: id, column: 30, row: 2 }, options);
  expect(computeAnalysisCanvas(moved, options).blocks[0].words[0].column).toBe(0);
  expectNoOverlaps(computeAnalysisCanvas(moved, options));
  expect(computeAnalysisCanvas(moved, options)).toEqual(computeAnalysisCanvas(moved, options));
});
