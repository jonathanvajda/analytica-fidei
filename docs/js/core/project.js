import { adaptProfiledPassage } from './linguistic-profiles.js';
import { normalizeAnalysisPresentation } from './presentation.js';

/** @file Pure analysis commands. IDs are supplied by the caller; no clock, DOM or storage. */
/** @typedef {{id:string, tokenIds:string[], constituentRoles?:AnalysisConstituentRole[], anchors?:AnalysisAnchor[]}} AnalysisProposition */
/** @typedef {{id:string, tokenIds:string[], label:string}} AnalysisConstituent */
/** @typedef {{constituentId:string, role:string, realization:'explicit'|'implicit'}} AnalysisConstituentRole */
/** @typedef {{tokenId:string, kind:'connective', function:string}} AnalysisAnchor */
/** @typedef {{id:string,targetType:'token'|'proposition',targetId:string,text:string}} AnalysisNote */
/** @typedef {{id:string, propositionIds:string[], label:string}} AnalysisGroup */
/** @typedef {{id:string, from:string, to:string, label:string, type?:string}} AnalysisRelation */
/** @typedef {{schemaVersion:number, id:string, name:string, passage:object, propositions:AnalysisProposition[], constituents:AnalysisConstituent[], groups:AnalysisGroup[], relations:AnalysisRelation[], notes:AnalysisNote[], layout?:{columns:number,words:object}}} AnalysisProject */
export function requireAnalysisCondition(condition, message) {
  if (!condition) throw new Error(message);
}

/** Small initial vocabulary from DA-Spec §13. IDs are stable data; labels are presentation. */
export const DISCOURSE_RELATION_TYPES = Object.freeze([
  { id: 'cause', label: 'Cause', description: 'The source presents what brings about the target.' },
  { id: 'reason', label: 'Reason', description: 'The source gives the reason for the target.' },
  { id: 'purpose', label: 'Purpose', description: 'The source states the intended purpose of the target.' },
  { id: 'result', label: 'Result', description: 'The source states a result of the target.' },
  { id: 'condition', label: 'Condition', description: 'The source states a condition for the target.' },
  { id: 'concession', label: 'Concession', description: 'The source concedes a point in relation to the target.' },
  { id: 'contrast', label: 'Contrast', description: 'The source contrasts with the target.' },
  { id: 'explanation', label: 'Explanation', description: 'The source explains the target.' },
  { id: 'elaboration', label: 'Elaboration', description: 'The source develops the target with further detail.' },
  { id: 'evidence', label: 'Evidence', description: 'The source supplies evidence for the target.' },
  { id: 'sequence', label: 'Sequence', description: 'The source follows the target in discourse sequence.' },
  { id: 'summary', label: 'Summary', description: 'The source summarizes the target.' },
]);

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
    propositions: [], constituents: [], groups: [], relations: [], notes: [] };
}

/** Restore through the same commands used for editing; reject invalid imports atomically.
 * @param {AnalysisProject} value Untrusted deserialized document.
 * @returns {AnalysisProject} Validated, detached document.
 */
export function restoreAnalysisProject(value) {
  requireAnalysisCondition(value?.schemaVersion === 1, 'Unsupported project format.');
  requireAnalysisCondition(['propositions', 'groups', 'relations'].every(key => Array.isArray(value[key])), 'Project collections are missing.');
  let project = createAnalysisProject(value);
  for (const constituent of value.constituents ?? []) project = addAnalysisConstituent(project, constituent);
  // Restore proposition coverage first so role references can target propositions
  // regardless of the order in which the backup was originally edited.
  for (const proposition of value.propositions) project = addAnalysisProposition(project,
    { id: proposition.id, tokenIds: proposition.tokenIds });
  for (const proposition of value.propositions) {
    for (const role of proposition.constituentRoles ?? []) project = attachAnalysisConstituent(project,
      { propositionId: proposition.id, ...role });
    for (const anchor of proposition.anchors ?? []) project = addAnalysisPropositionAnchor(project,
      { propositionId: proposition.id, ...anchor });
  }
  for (const group of value.groups) project = addAnalysisGroup(project, group);
  for (const relation of value.relations) project = addAnalysisRelation(project, relation);
  for (const note of value.notes ?? []) project = addAnalysisNote(project, note);
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
  requireAnalysisCondition(typeof id === 'string' && id.trim() && !analysisEntityIds(project).includes(id), 'Proposition ID must be unique.');
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

/** Add one previously unassigned source word to an existing proposition.
 * The resulting proposition must remain a consecutive source span; this keeps
 * coverage and proposition ordering deterministic while allowing missed edge
 * words to be recovered by drag and drop.
 * @param {AnalysisProject} project Current document.
 * @param {{propositionId:string,tokenId:string}} input Drop target and source word.
 * @returns {AnalysisProject}
 */
export function addAnalysisTokenToProposition(project, { propositionId, tokenId }) {
  const unit = adaptAnalysisPassage(project.passage);
  const proposition = project.propositions.find(item => item.id === propositionId);
  requireAnalysisCondition(proposition, 'Choose a known proposition.');
  const tokenIndex = unit.tokens.findIndex(token => token.id === tokenId);
  requireAnalysisCondition(tokenIndex >= 0, 'Choose a word from this source passage.');
  requireAnalysisCondition(!project.propositions.some(item => item.tokenIds.includes(tokenId)),
    'That word already belongs to a proposition.');
  const tokenIds = [...proposition.tokenIds, tokenId]
    .sort((a, b) => unit.tokens.findIndex(token => token.id === a) - unit.tokens.findIndex(token => token.id === b));
  const indices = tokenIds.map(id => unit.tokens.findIndex(token => token.id === id));
  requireAnalysisCondition(indices.every((index, position) => !position || index === indices[position - 1] + 1),
    'Drop an adjacent source word onto the proposition so its textual span remains consecutive.');
  const propositions = project.propositions.map(item => item.id === propositionId ? { ...item, tokenIds } : item)
    .sort((a, b) => unit.tokens.findIndex(token => token.id === a.tokenIds[0]) - unit.tokens.findIndex(token => token.id === b.tokenIds[0]));
  const next = { ...project, propositions };
  requireAnalysisCondition(project.groups.every(group => group.propositionIds.length === groupBounds(next, group).end - groupBounds(next, group).start + 1),
    'This drop would disrupt an existing proposition group.');
  return next;
}

/** Return one or more edge words from a proposition to unassigned source staging. */
export function removeAnalysisTokensFromProposition(project, { propositionId, tokenIds }) {
  const unit = adaptAnalysisPassage(project.passage);
  const proposition = project.propositions.find(item => item.id === propositionId);
  requireAnalysisCondition(proposition, 'Choose a known proposition.');
  requireAnalysisCondition(Array.isArray(tokenIds) && tokenIds.length > 0 && new Set(tokenIds).size === tokenIds.length,
    'Choose one or more distinct proposition words.');
  requireAnalysisCondition(tokenIds.every(id => proposition.tokenIds.includes(id)), 'Every returned word must belong to the proposition.');
  const remaining = proposition.tokenIds.filter(id => !tokenIds.includes(id));
  requireAnalysisCondition(remaining.length > 0, 'Remove the proposition itself to return all of its words to source.');
  const indices = remaining.map(id => unit.tokens.findIndex(token => token.id === id));
  requireAnalysisCondition(indices.every((index, position) => !position || index === indices[position - 1] + 1),
    'Return words from an edge of the proposition so its textual span remains consecutive.');
  const explicitRoles = (proposition.constituentRoles ?? []).filter(item => item.realization === 'explicit');
  requireAnalysisCondition(explicitRoles.every(role => {
    const constituent = project.constituents.find(item => item.id === role.constituentId);
    return constituent.tokenIds.every(id => remaining.includes(id));
  }), 'Remove the affected explicit grammatical role before returning its source word.');
  return { ...project, propositions: project.propositions.map(item => item.id === propositionId
    ? { ...item, tokenIds: remaining } : item) };
}

function analysisEntityIds(project) {
  return [...project.propositions, ...(project.constituents ?? []), ...project.groups, ...project.relations,
    ...(project.notes ?? [])].map(item => item.id);
}

/** Add a user-authored note to one canonical token or proposition. */
export function addAnalysisNote(project, { id, targetType, targetId, text }) {
  requireAnalysisCondition(typeof id === 'string' && id.trim() && !analysisEntityIds(project).includes(id), 'Note ID must be unique.');
  requireAnalysisCondition(['token', 'proposition'].includes(targetType), 'Choose a word or proposition note target.');
  const known = targetType === 'token'
    ? adaptAnalysisPassage(project.passage).tokens.some(item => item.id === targetId)
    : project.propositions.some(item => item.id === targetId);
  requireAnalysisCondition(known, 'Choose a known note target.');
  requireAnalysisCondition(typeof text === 'string' && text.trim(), 'Write a note before saving.');
  return { ...project, notes: [...(project.notes ?? []), { id, targetType, targetId, text: text.trim() }] };
}

export function removeAnalysisNote(project, id) {
  requireAnalysisCondition((project.notes ?? []).some(item => item.id === id), 'Choose a known note.');
  return { ...project, notes: project.notes.filter(item => item.id !== id) };
}

/** Revise note text without changing its identity or anchor. */
export function updateAnalysisNote(project, { id, text }) {
  requireAnalysisCondition(typeof text === 'string' && text.trim(), 'Write a note before saving.');
  requireAnalysisCondition((project.notes ?? []).some(item => item.id === id), 'Choose a known note.');
  return { ...project, notes: project.notes.map(item => item.id === id ? { ...item, text: text.trim() } : item) };
}

/** Identify a reusable, source-anchored constituent without assigning its tokens again.
 * A constituent can subsequently realize a role explicitly in one proposition and
 * implicitly (elliptically) in any number of others.
 * @param {AnalysisProject} project Current document.
 * @param {AnalysisConstituent} input Constituent identity and source tokens.
 * @returns {AnalysisProject}
 */
export function addAnalysisConstituent(project, { id, tokenIds, label = '' }) {
  const unit = adaptAnalysisPassage(project.passage);
  requireAnalysisCondition(typeof id === 'string' && id.trim() && !analysisEntityIds(project).includes(id), 'Constituent ID must be unique.');
  requireAnalysisCondition(typeof label === 'string', 'Constituent label must be text.');
  requireAnalysisCondition(Array.isArray(tokenIds) && tokenIds.length > 0, 'A constituent requires source tokens.');
  const known = new Set(unit.tokens.map(token => token.id));
  requireAnalysisCondition(new Set(tokenIds).size === tokenIds.length && tokenIds.every(id => known.has(id)),
    'Constituent tokens must be unique words from this source passage.');
  return { ...project, constituents: [...(project.constituents ?? []), { id, tokenIds: [...tokenIds], label: label.trim() }] };
}

/** Rename a reusable constituent without changing its source anchors or role references. */
export function updateAnalysisConstituent(project, { id, label }) {
  requireAnalysisCondition(typeof label === 'string' && label.trim(), 'Give the constituent a name.');
  requireAnalysisCondition((project.constituents ?? []).some(item => item.id === id), 'Choose a known constituent.');
  return { ...project, constituents: project.constituents.map(item => item.id === id
    ? { ...item, label: label.trim() } : item) };
}

/** Remove only an unreferenced constituent so grammatical assertions cannot dangle. */
export function removeAnalysisConstituent(project, id) {
  requireAnalysisCondition((project.constituents ?? []).some(item => item.id === id), 'Choose a known constituent.');
  const used = project.propositions.some(proposition =>
    (proposition.constituentRoles ?? []).some(role => role.constituentId === id));
  requireAnalysisCondition(!used, 'Remove this constituent from every proposition role before deleting it.');
  return { ...project, constituents: project.constituents.filter(item => item.id !== id) };
}

/** Reference one reusable constituent from a proposition role.
 * @param {AnalysisProject} project Current document.
 * @param {{propositionId:string,constituentId:string,role:string,realization?:'explicit'|'implicit'}} input Role assertion.
 * @returns {AnalysisProject}
 */
export function attachAnalysisConstituent(project, { propositionId, constituentId, role, realization = 'implicit' }) {
  requireAnalysisCondition(['explicit', 'implicit'].includes(realization), 'Realization must be explicit or implicit.');
  requireAnalysisCondition(typeof role === 'string' && role.trim(), 'Name the constituent role.');
  requireAnalysisCondition((project.constituents ?? []).some(item => item.id === constituentId), 'Choose a known constituent.');
  const proposition = project.propositions.find(item => item.id === propositionId);
  requireAnalysisCondition(proposition, 'Choose a known proposition.');
  const constituent = project.constituents.find(item => item.id === constituentId);
  requireAnalysisCondition(realization !== 'explicit' || constituent.tokenIds.every(id => proposition.tokenIds.includes(id)),
    'An explicit role must be anchored inside the proposition; use implicit when reusing it elsewhere.');
  const roles = proposition.constituentRoles ?? [];
  requireAnalysisCondition(!roles.some(item => item.constituentId === constituentId && item.role === role.trim()),
    'That constituent already fills this role in the proposition.');
  const assertion = { constituentId, role: role.trim(), realization };
  return { ...project, propositions: project.propositions.map(item => item.id === propositionId
    ? { ...item, constituentRoles: [...roles, assertion] } : item) };
}

/** Remove one role assertion while retaining the reusable constituent for other propositions. */
export function detachAnalysisConstituent(project, { propositionId, constituentId, role }) {
  const proposition = project.propositions.find(item => item.id === propositionId);
  requireAnalysisCondition(proposition, 'Choose a known proposition.');
  const roles = proposition.constituentRoles ?? [];
  requireAnalysisCondition(roles.some(item => item.constituentId === constituentId && item.role === role),
    'Choose a known constituent role.');
  return { ...project, propositions: project.propositions.map(item => item.id === propositionId
    ? { ...item, constituentRoles: roles.filter(assertion =>
      assertion.constituentId !== constituentId || assertion.role !== role) } : item) };
}

/** Mark a source word (normally a conjunction or particle) as a proposition-level cue.
 * Anchors may overlap proposition coverage and never change token assignment.
 * @param {AnalysisProject} project Current document.
 * @param {{propositionId:string,tokenId:string,kind?:'connective',function?:string}} input Anchor assertion.
 * @returns {AnalysisProject}
 */
export function addAnalysisPropositionAnchor(project, { propositionId, tokenId, kind = 'connective', function: anchorFunction = '' }) {
  requireAnalysisCondition(kind === 'connective', 'Only connective anchors are currently supported.');
  requireAnalysisCondition(typeof anchorFunction === 'string', 'Anchor function must be text.');
  const proposition = project.propositions.find(item => item.id === propositionId);
  requireAnalysisCondition(proposition, 'Choose a known proposition.');
  requireAnalysisCondition(adaptAnalysisPassage(project.passage).tokens.some(item => item.id === tokenId), 'Choose a source token as the anchor.');
  const anchors = proposition.anchors ?? [];
  requireAnalysisCondition(!anchors.some(item => item.tokenId === tokenId && item.kind === kind), 'That connective already anchors this proposition.');
  const anchor = { tokenId, kind, function: anchorFunction.trim() };
  return { ...project, propositions: project.propositions.map(item => item.id === propositionId
    ? { ...item, anchors: [...anchors, anchor] } : item) };
}

/** Remove one proposition cue without changing its source token or discourse relations. */
export function removeAnalysisPropositionAnchor(project, { propositionId, tokenId, kind = 'connective' }) {
  const proposition = project.propositions.find(item => item.id === propositionId);
  requireAnalysisCondition(proposition, 'Choose a known proposition.');
  const anchors = proposition.anchors ?? [];
  requireAnalysisCondition(anchors.some(item => item.tokenId === tokenId && item.kind === kind), 'Choose a known proposition anchor.');
  return { ...project, propositions: project.propositions.map(item => item.id === propositionId
    ? { ...item, anchors: anchors.filter(anchor => anchor.tokenId !== tokenId || anchor.kind !== kind) } : item) };
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
  requireAnalysisCondition(typeof id === 'string' && id.trim() && !analysisEntityIds(project).includes(id), 'Group ID must be unique.');
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
export function addAnalysisRelation(project, { id, from, to, label, type }) {
  const known = new Set(project.propositions.map(item => item.id));
  requireAnalysisCondition(typeof id === 'string' && id.trim() && !analysisEntityIds(project).includes(id), 'Relation ID must be unique.');
  requireAnalysisCondition(known.has(from) && known.has(to) && from !== to, 'Choose two different propositions.');
  const relationType = type ? DISCOURSE_RELATION_TYPES.find(item => item.id === type) : null;
  requireAnalysisCondition(!type || relationType, 'Choose a supported discourse relationship.');
  const resolvedLabel = relationType?.label ?? label;
  requireAnalysisCondition(typeof resolvedLabel === 'string' && resolvedLabel.trim(), 'Describe the directed relation.');
  return { ...project, relations: [...project.relations,
    { id, from, to, label: resolvedLabel.trim(), ...(relationType ? { type: relationType.id } : {}) }] };
}

/** Revise a directed semantic edge while retaining its stable identity. */
export function updateAnalysisRelation(project, { id, from, to, label, type }) {
  requireAnalysisCondition(project.relations.some(item => item.id === id), 'Choose a known discourse relationship.');
  const withoutExisting = { ...project, relations: project.relations.filter(item => item.id !== id) };
  const revised = addAnalysisRelation(withoutExisting, { id, from, to, label, type }).relations.at(-1);
  return { ...project, relations: project.relations.map(item => item.id === id ? revised : item) };
}

/** Remove a proposition and its dependent groups/relations, returning its words to staging.
 * @param {AnalysisProject} project Current document.
 * @param {string} id Proposition to remove.
 * @returns {AnalysisProject}
 */
export function removeAnalysisProposition(project, id) {
  return { ...project, propositions: project.propositions.filter(item => item.id !== id),
    groups: project.groups.filter(group => !group.propositionIds.includes(id)),
    relations: project.relations.filter(item => item.from !== id && item.to !== id),
    notes: (project.notes ?? []).filter(item => item.targetType !== 'proposition' || item.targetId !== id) };
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
