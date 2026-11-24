import { adaptAnalysisPassage } from './project.js';
import { normalizeAnalysisPresentation, MAX_CANVAS_COLUMNS, MAX_CANVAS_ROW } from './presentation.js';

export const CANVAS_CELL_WIDTH = 24;
export const CANVAS_ROW_HEIGHT = 52;
export const CANVAS_WORD_HEIGHT = 38;

/** Build source-ordered runs for propositions and words that are not yet assigned. */
function collectCanvasBlocks(project, tokens) {
  const assigned = new Map(project.propositions.flatMap(proposition => proposition.tokenIds.map(id => [id, proposition])));
  const blocks = [];
  for (const token of tokens) {
    const proposition = assigned.get(token.id);
    const previous = blocks.at(-1);
    const id = proposition?.id ?? (previous?.kind === 'source' ? previous.id : `source:${token.id}`);
    if (previous?.id === id) previous.tokens.push(token);
    else blocks.push({ id, kind: proposition ? 'proposition' : 'source', proposition, tokens: [token] });
  }
  return blocks;
}

function wordCellWidth(token, columns, tokenWidths) {
  const measured = tokenWidths[token.id] ?? Array.from(token.text).length * 12 + 26;
  return Math.min(columns, Math.max(2, Math.ceil(measured / CANVAS_CELL_WIDTH)));
}

function cellsOverlap(a, b) {
  return a.row === b.row && a.column < b.column + b.width && b.column < a.column + a.width;
}

/** Move collisions forward deterministically rather than allowing overlapping words. */
function findAvailableWordCell(point, occupied, columns) {
  let candidate = { ...point, column: Math.min(point.column, columns - point.width) };
  if (candidate.row > MAX_CANVAS_ROW) throw new Error('This word placement exceeds the canvas row limit.');
  while (occupied.some(other => cellsOverlap(candidate, other))) {
    candidate.column += 1;
    if (candidate.column + candidate.width > columns) candidate = { ...candidate, column: 0, row: candidate.row + 1 };
    if (candidate.row > MAX_CANVAS_ROW) throw new Error('This word placement exceeds the canvas row limit.');
  }
  return candidate;
}

function arrangeBlockWords(block, presentation, tokenWidths, reserved = null) {
  const placed = reserved ? [reserved] : [];
  let cursor = { column: 0, row: 0 };
  // Explicit placements take priority over default source-order flow.
  const ordered = [...block.tokens].sort((a, b) => Number(Boolean(presentation.words[b.id])) - Number(Boolean(presentation.words[a.id])));
  for (const token of ordered) {
    if (token.id === reserved?.tokenId) continue;
    const width = wordCellWidth(token, presentation.columns, tokenWidths);
    const saved = presentation.words[token.id];
    let point = saved ?? { column: block.rtl ? presentation.columns - cursor.column - width : cursor.column, row: cursor.row };
    if (saved) point = { ...point, column: Math.min(point.column, presentation.columns - width) };
    if (point.column < 0 || point.column + width > presentation.columns) point = { column: block.rtl ? presentation.columns - width : 0, row: point.row + 1 };
    const placement = findAvailableWordCell({ ...point, width, tokenId: token.id }, placed, presentation.columns);
    placed.push(placement);
    if (!saved) cursor = { column: block.rtl ? presentation.columns - placement.column : placement.column + width, row: placement.row };
  }
  const byId = new Map(placed.map(point => [point.tokenId, point]));
  return block.tokens.map(token => ({ ...token, ...byId.get(token.id) }));
}

/** Derive a grid, group bracket lanes, and integrated relationship anchors.
 * @param {object} project Validated analysis document.
 * @param {{tokenWidths?:object}} [options] Measured pixel widths supplied by the renderer.
 * @returns {object} Pure geometry; token order and semantic membership remain unchanged.
 */
export function computeAnalysisCanvas(project, { tokenWidths = {} } = {}) {
  const unit = adaptAnalysisPassage(project.passage);
  const presentation = normalizeAnalysisPresentation(project.layout, unit.tokens.map(token => token.id));
  const groups = project.groups.map(group => ({ ...group,
    start: project.propositions.findIndex(item => item.id === group.propositionIds[0]),
    end: project.propositions.findIndex(item => item.id === group.propositionIds.at(-1)) }));
  for (const group of groups) group.depth = groups.filter(other => other.id !== group.id && other.start <= group.start && other.end >= group.end).length;
  const gutter = Math.max(110, 90 + groups.reduce((max, group) => Math.max(max, group.depth + 1), 0) * 24);
  const blocks = collectCanvasBlocks(project, unit.tokens);
  let cursorY = 36;
  for (const block of blocks) {
    block.rtl = /^(hbo|he|arc)(-|$)/.test(unit.source.language);
    block.starts = groups.filter(group => group.propositionIds[0] === block.id).sort((a, b) => a.depth - b.depth);
    block.relations = project.relations.filter(relation => {
      const sourceGroup = project.groups.find(group => group.id === relation.from);
      return (sourceGroup?.propositionIds[0] ?? relation.from) === block.id;
    });
    block.top = cursorY;
    block.headingY = cursorY + block.starts.length * 30;
    block.wordY = block.headingY + 32 + (block.relations.length ? 34 : 0);
    block.words = arrangeBlockWords(block, presentation, tokenWidths);
    const endingGroups = groups.filter(group => group.propositionIds.at(-1) === block.id).length;
    block.bottom = block.wordY + (Math.max(0, ...block.words.map(word => word.row)) + 1) * CANVAS_ROW_HEIGHT + 16 + endingGroups * 6;
    cursorY = block.bottom + 20;
  }
  const byId = new Map(blocks.map(block => [block.id, block]));
  for (const group of groups) {
    const first = byId.get(group.propositionIds[0]);
    const last = byId.get(group.propositionIds.at(-1));
    group.x = 28 + group.depth * 24;
    group.top = first.top + first.starts.findIndex(item => item.id === group.id) * 30 + 12;
    const sharedEndAncestors = groups.filter(other => other.end === group.end && other.depth < group.depth).length;
    group.bottom = last.bottom - 8 - sharedEndAncestors * 6;
  }
  return { unit, presentation, gutter, blocks, groups,
    width: gutter + presentation.columns * CANVAS_CELL_WIDTH + 48, height: Math.max(580, cursorY + 100) };
}

/** Place one word at a snapped grid cell in its current proposition/source run.
 * Other words move only when needed to clear a collision. Layout never reassigns words.
 * @param {object} project Current analysis.
 * @param {{tokenId:string,column:number,row:number}} input Requested local grid position.
 * @param {{tokenWidths?:object}} [options] Same widths used by the renderer.
 * @returns {object} New project, retaining source and semantic collections.
 */
export function placeAnalysisCanvasWord(project, { tokenId, column, row }, { tokenWidths = {} } = {}) {
  if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || row < 0 || row > MAX_CANVAS_ROW) throw new Error('Choose a valid grid position.');
  const canvas = computeAnalysisCanvas(project, { tokenWidths });
  const block = canvas.blocks.find(item => item.tokens.some(token => token.id === tokenId));
  if (!block) throw new Error('The moved word does not belong to this passage.');
  const token = block.tokens.find(item => item.id === tokenId);
  const width = wordCellWidth(token, canvas.presentation.columns, tokenWidths);
  const reserved = { tokenId, column: Math.min(column, canvas.presentation.columns - width), row, width };
  // Resolve from current geometry so default placements also remain stable during a move.
  const words = { ...canvas.presentation.words,
    ...Object.fromEntries(block.words.map(word => [word.id, { column: word.column, row: word.row }])) };
  const placements = arrangeBlockWords(block, { ...canvas.presentation, words }, tokenWidths, reserved);
  return { ...project, layout: { ...canvas.presentation, words: { ...words,
    ...Object.fromEntries(placements.map(word => [word.id, { column: word.column, row: word.row }])) } } };
}

/** Reset visual placement without deleting any analysis. */
export function resetAnalysisCanvas(project) {
  return { ...project, layout: { columns: project.layout?.columns ?? 36, words: {} } };
}

/** Grow the horizontal grid without changing any word coordinates or semantics. */
export function widenAnalysisCanvas(project, additionalColumns = 12) {
  if (!Number.isInteger(additionalColumns) || additionalColumns < 1) throw new Error('Choose a positive canvas extension.');
  const tokenIds = adaptAnalysisPassage(project.passage).tokens.map(token => token.id);
  const presentation = normalizeAnalysisPresentation(project.layout, tokenIds);
  const columns = Math.min(MAX_CANVAS_COLUMNS, presentation.columns + additionalColumns);
  if (columns === presentation.columns) throw new Error('The canvas has reached its maximum supported width.');
  return { ...project, layout: { ...presentation, columns } };
}
