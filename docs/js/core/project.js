import { adaptProfiledPassage } from './linguistic-profiles.js';
import { normalizeAnalysisPresentation } from './presentation.js';

/** @file Pure analysis commands. IDs are supplied by the caller; no clock, DOM or storage. */
/** @typedef {{id:string, tokenIds:string[]}} AnalysisProposition */
/** @typedef {{id:string, propositionIds:string[], label:string}} AnalysisGroup */
/** @typedef {{id:string, from:string, to:string, label:string}} AnalysisRelation */
/** @typedef {{schemaVersion:number, id:string, name:string, passage:object, propositions:AnalysisProposition[], groups:AnalysisGroup[], relations:AnalysisRelation[], layout?:{columns:number,words:object}}} AnalysisProject */
export function requireAnalysisCondition(condition, message) {
  if (!condition) throw new Error(message);
}

/** Normalize a parsed-record passage; no text reconstruction or guessed annotations.
 * @param {object} passage Shared token-record adapter input.
 * @returns {import('../vendor/linguistic-adapters/source-model.js').LinguisticUnit}
 */
export function adaptAnalysisPassage(passage) {
  return adaptProfiledPassage(passage);
}

/** Create a portable analysis document around one edition-specific passage.
 * @param {{id:string,name:string,passage:object}} input Explicit identity and parsed source.
 * @returns {AnalysisProject}
 */
export function createAnalysisProject({ id, name, passage }) {
  requireAnalysisCondition(typeof id === 'string' && id.trim(), 'A project ID is required.');
  requireAnalysisCondition(typeof name === 'string' && name.trim(), 'Give the project a name.');
  adaptAnalysisPassage(passage);
  return { schemaVersion: 1, id, name: name.trim(), passage: structuredClone(passage),
    propositions: [], groups: [], relations: [] };
}

/** Restore through the same commands used for editing; reject invalid imports atomically.
 * @param {AnalysisProject} value Untrusted deserialized document.
 * @returns {AnalysisProject} Validated, detached document.
 */
export function restoreAnalysisProject(value) {
  requireAnalysisCondition(value?.schemaVersion === 1, 'Unsupported project format.');
  requireAnalysisCondition(['propositions', 'groups', 'relations'].every(key => Array.isArray(value[key])), 'Project collections are missing.');
  let project = createAnalysisProject(value);
  for (const proposition of value.propositions) project = addAnalysisProposition(project, proposition);
  for (const group of value.groups) project = addAnalysisGroup(project, group);
  for (const relation of value.relations) project = addAnalysisRelation(project, relation);
  // Old v1 backups have no layout. Keep their semantic content and derive initial placement.
  if (value.layout === undefined) return project;
  const tokenIds = adaptAnalysisPassage(project.passage).tokens.map(token => token.id);
  return { ...project, layout: normalizeAnalysisPresentation(value.layout, tokenIds) };
}

/** Add a contiguous, unassigned token span without changing source order or text.
 * @param {AnalysisProject} project Current document.
 * @param {AnalysisProposition} input Explicit identity and source-order token IDs.
 * @returns {AnalysisProject}
 */
export function addAnalysisProposition(project, { id, tokenIds }) {
  const unit = adaptAnalysisPassage(project.passage);
  requireAnalysisCondition(Array.isArray(tokenIds), 'Provide an ordered token ID array.');
  const indices = tokenIds.map(tokenId => unit.tokens.findIndex(token => token.id === tokenId));
  requireAnalysisCondition(typeof id === 'string' && id.trim() && ![...project.propositions, ...project.groups, ...project.relations].some(item => item.id === id), 'Proposition ID must be unique.');
  requireAnalysisCondition(indices?.length && indices.every((index, position) => index >= 0 && (!position || index === indices[position - 1] + 1)),
    'Select consecutive tokens in source order.');
  const assigned = new Set(project.propositions.flatMap(item => item.tokenIds));
  requireAnalysisCondition(tokenIds.every(tokenId => !assigned.has(tokenId)), 'Some selected words already belong to a proposition.');
  const propositions = [...project.propositions, { id, tokenIds: [...tokenIds] }]
    .sort((a, b) => unit.tokens.findIndex(token => token.id === a.tokenIds[0]) - unit.tokens.findIndex(token => token.id === b.tokenIds[0]));
  // Existing group endpoints must not silently absorb an inserted proposition.
  const next = { ...project, propositions };
  requireAnalysisCondition(project.groups.every(group => group.propositionIds.length === groupBounds(next, group).end - groupBounds(next, group).start + 1),
    'Remove the surrounding group before inserting a proposition inside it.');
  return next;
}

function groupBounds(project, group) {
  requireAnalysisCondition(Array.isArray(group.propositionIds), 'Provide an ordered proposition ID array.');
  const positions = group.propositionIds.map(id => project.propositions.findIndex(item => item.id === id));
  requireAnalysisCondition(positions.length >= 2 && positions.every((position, index) => position >= 0 && (!index || position === positions[index - 1] + 1)),
    'A group requires at least two consecutive propositions in source order.');
  return { start: positions[0], end: positions.at(-1) };
}

/** Primary groups form laminar spans: overlap must be full containment, never crossing.
 * @param {AnalysisProject} project Current document.
 * @param {AnalysisGroup} input Proposed group.
 * @returns {AnalysisProject}
 */
export function addAnalysisGroup(project, { id, propositionIds, label = '' }) {
  requireAnalysisCondition(typeof id === 'string' && id.trim() && ![...project.propositions, ...project.groups, ...project.relations].some(item => item.id === id), 'Group ID must be unique.');
  requireAnalysisCondition(typeof label === 'string', 'Group label must be text.');
  const range = groupBounds(project, { propositionIds });
  for (const group of project.groups) {
    const other = groupBounds(project, group);
    const disjoint = range.end < other.start || other.end < range.start;
    const contains = range.start <= other.start && range.end >= other.end;
    const inside = other.start <= range.start && other.end >= range.end;
    requireAnalysisCondition(disjoint || contains || inside, 'This group would cross an existing bracket. Choose a nested or disjoint span.');
    requireAnalysisCondition(range.start !== other.start || range.end !== other.end, 'That proposition span already has a group.');
  }
  return { ...project, groups: [...project.groups, { id, propositionIds: [...propositionIds], label: label.trim() }] };
}

/** Semantic edges are separate from primary bracket containment. They never force crossing lines.
 * @param {AnalysisProject} project Current document.
 * @param {AnalysisRelation} input Proposed directed edge.
 * @returns {AnalysisProject}
 */
export function addAnalysisRelation(project, { id, from, to, label }) {
  const known = new Set(project.propositions.map(item => item.id));
  requireAnalysisCondition(typeof id === 'string' && id.trim() && ![...project.propositions, ...project.groups, ...project.relations].some(item => item.id === id), 'Relation ID must be unique.');
  requireAnalysisCondition(known.has(from) && known.has(to) && from !== to, 'Choose two different propositions.');
  requireAnalysisCondition(typeof label === 'string' && label.trim(), 'Describe the directed relation.');
  return { ...project, relations: [...project.relations, { id, from, to, label: label.trim() }] };
}

/** Remove a proposition and its dependent groups/relations, returning its words to staging.
 * @param {AnalysisProject} project Current document.
 * @param {string} id Proposition to remove.
 * @returns {AnalysisProject}
 */
export function removeAnalysisProposition(project, id) {
  return { ...project, propositions: project.propositions.filter(item => item.id !== id),
    groups: project.groups.filter(group => !group.propositionIds.includes(id)),
    relations: project.relations.filter(item => item.from !== id && item.to !== id) };
}

/** Derive an ordered bracket tree; semantic edges remain a separate graph.
 * @param {AnalysisProject} project Validated analysis.
 * @returns {object[]} Nested groups and proposition leaves in source order.
 */
export function buildAnalysisOutline(project) {
  const groups = project.groups.map(group => ({ ...group, ...groupBounds(project, group), children: [] }));
  const roots = [];
  for (const node of [...groups, ...project.propositions.map((item, index) => ({ ...item, start: index, end: index }))]) {
    const parent = groups.filter(group => group.id !== node.id && group.start <= node.start && group.end >= node.end)
      .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
    (parent ? parent.children : roots).push(node);
  }
  const sortChildren = nodes => nodes.sort((a, b) => a.start - b.start).map(node => node.children ? { ...node, children: sortChildren(node.children) } : node);
  return sortChildren(roots);
}
