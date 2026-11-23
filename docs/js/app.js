import { createAnalysisProject, restoreAnalysisProject, adaptAnalysisPassage, addAnalysisProposition,
  removeAnalysisProposition, addAnalysisGroup, addAnalysisRelation, addAnalysisTokenToProposition,
  DISCOURSE_RELATION_TYPES, addAnalysisPropositionAnchor, removeAnalysisPropositionAnchor,
  addAnalysisConstituent, attachAnalysisConstituent, detachAnalysisConstituent,
  removeAnalysisTokensFromProposition } from './core/project.js';
import { placeAnalysisCanvasWord, resetAnalysisCanvas, widenAnalysisCanvas } from './core/canvas-layout.js';
import { createPracticePassage } from './core/practice-passages.js';
import { openAnalysisRepository } from './adapters/project-storage.js';
import { createUiElement as el, downloadProjectBackup } from './ui/dom.js';
import { createAnalysisCanvasController } from './ui/analysis-canvas.js';
import { createEditionLibrary, loadBundledEditionCatalog } from './adapters/edition-library.js';
import { normalizeEditionCorpus } from './core/editions.js';
import { createEditionBrowser } from './ui/edition-browser.js';

const $ = selector => document.querySelector(selector);
let repository = null;
let project = null;
let selectedTokens = new Set();
let selectedPropositions = new Set();
let selectionAnchor = null;
let focusedRelationId = null;
let operationQueue = Promise.resolve();
let undoStack = [];
let redoStack = [];
const sessionProjects = new Map();

function report(message, error = false) {
  $('#feedback').textContent = message;
  $('#feedback').dataset.error = String(error);
}

/** Serialize all edits, including pointer drops and keyboard nudges. */
function runUiOperation(operation) {
  operationQueue = operationQueue.then(async () => {
    try { await operation(); }
    catch (error) { report(error.message, true); }
  });
  return operationQueue;
}

function showProjectDrawer(show) {
  $('#project-drawer').hidden = !show;
  $('#toggle-projects').setAttribute('aria-expanded', String(show));
}

function closeEditors() {
  for (const selector of ['#group-form', '#relation-form', '#anchor-form', '#role-form', '#word-inspector']) $(selector).hidden = true;
  $('#context-drawer').hidden = true;
  $('#toggle-inspector').setAttribute('aria-expanded', 'false');
  $('#inspector-empty').hidden = false;
}

function showInspector() {
  $('#context-drawer').hidden = false;
  $('#toggle-inspector').setAttribute('aria-expanded', 'true');
}

async function persistProject(next, { history = true } = {}) {
  if (history && project?.id === next.id) { undoStack.push(project); redoStack = []; }
  project = next;
  sessionProjects.set(next.id, structuredClone(next));
  renderProject();
  if (repository) {
    try {
      await repository.save(next);
      $('#storage-status').textContent = 'Saved in this browser. Export a backup to keep a portable copy.';
    } catch (error) {
      $('#storage-status').textContent = 'Not saved to browser storage. Export a backup before leaving.';
      throw error;
    }
  } else $('#storage-status').textContent = 'Session only. Browser storage is unavailable; export before leaving.';
  await refreshProjectList();
}

async function activateProject(next) {
  selectedTokens.clear(); selectedPropositions.clear(); selectionAnchor = null; focusedRelationId = null;
  undoStack = []; redoStack = []; closeEditors();
  if (!next.layout) {
    const available = $('#main-content').getBoundingClientRect().width - 32;
    const columns = Math.max(8, Math.floor((available - 158) / 24));
    next = { ...next, layout: { columns, words: {} } };
  }
  showProjectDrawer(false);
  await persistProject(next, { history: false });
}

async function refreshProjectList() {
  const saved = repository ? await repository.list() : [];
  const records = new Map([...saved, ...sessionProjects.values()].map(item => [item.id, item]));
  $('#project-list').replaceChildren(...[...records.values()].map(item => {
    const button = el('button', { text: item.name, className: 'project-link', 'aria-current': item.id === project?.id });
    button.addEventListener('click', () => runUiOperation(async () => {
      const record = sessionProjects.get(item.id) ?? await repository.get(item.id);
      if (!record) throw new Error('Project no longer exists.');
      await activateProject(restoreAnalysisProject(record)); report(`Opened ${record.name}.`);
    }));
    return button;
  }));
}

const canvas = createAnalysisCanvasController({ root: $('#analysis-canvas'), viewport: $('#canvas-viewport'), sizer: $('#canvas-sizer'),
  onSelectWord: selectCanvasWord,
  onInspectWord: inspectCanvasWord,
  onMoveWord: (tokenId, column, row, target = null) => runUiOperation(async () => {
    const current = project.propositions.find(item => item.tokenIds.includes(tokenId));
    const reassigned = target?.kind === 'proposition' && current?.id !== target.id;
    const returned = target?.kind === 'source' && Boolean(current);
    let semanticProject = project;
    if (reassigned) semanticProject = addAnalysisTokenToProposition(project, { propositionId: target.id, tokenId });
    if (returned) semanticProject = removeAnalysisTokensFromProposition(project, { propositionId: current.id, tokenIds: [tokenId] });
    await persistProject(placeAnalysisCanvasWord(semanticProject, { tokenId, column, row }, { tokenWidths: canvas.getWidths() }));
    canvas.focusWord(tokenId);
    report(reassigned ? 'Missed word added to the proposition and placed on its grid.' : returned
      ? 'Word returned to unassigned source staging.' : 'Word placed on the grid. Source order and proposition membership are preserved.');
  }),
  onToggleProposition: (id, checked) => {
    if (checked) selectedPropositions.add(id); else selectedPropositions.delete(id);
    updateCanvasActions();
  },
  onRemoveProposition: id => runUiOperation(async () => {
    selectedPropositions.delete(id); focusedRelationId = null;
    await persistProject(removeAnalysisProposition(project, id));
    report('Proposition removed. Its words remain on the canvas; dependent groups and relations were removed.');
  }),
  onRemoveGroup: id => runUiOperation(async () => {
    await persistProject({ ...project, groups: project.groups.filter(item => item.id !== id) });
    report('Group removed. Propositions and relationships were retained.');
  }),
  onRemovePropositionAnchor: (propositionId, tokenId) => runUiOperation(async () => {
    await persistProject(removeAnalysisPropositionAnchor(project, { propositionId, tokenId }));
    report('Connective anchor removed. The source word and discourse relationships were retained.');
  }),
  onDetachConstituent: (propositionId, constituentId, role) => runUiOperation(async () => {
    await persistProject(detachAnalysisConstituent(project, { propositionId, constituentId, role }));
    report('Grammatical role removed. The reusable constituent and source words were retained.');
  }),
  onFocusRelation: id => { focusedRelationId = focusedRelationId === id ? null : id; renderCanvas(); },
});

function activeUnit() { return adaptAnalysisPassage(project.passage); }

function renderProject() {
  $('#welcome').hidden = Boolean(project);
  $('#workbench').hidden = !project;
  $('#project-actions').hidden = !project;
  if (!project) { $('#active-project-name').textContent = 'Discourse analysis canvas'; $('#source-description').textContent = ''; return; }
  const unit = activeUnit();
  $('#active-project-name').textContent = project.name;
  $('#source-description').textContent = `${project.passage.editionTitle ?? unit.source.sourceId} · ${unit.source.language}`;
  $('#passage-reference').textContent = unit.reference?.display ?? unit.unitKey;
  $('#original-text').textContent = unit.text ?? 'Exact source text was not supplied. Individual tokens are preserved.';
  $('#original-text').lang = unit.source.language;
  renderCanvas();
}

function renderCanvas() {
  canvas.render({ project, selectedTokens, selectedPropositions, focusedRelationId });
  updateCanvasActions();
}

function updateCanvasActions() {
  const selectionParts = [];
  if (selectedTokens.size) selectionParts.push(`${selectedTokens.size} ${selectedTokens.size === 1 ? 'word' : 'words'}`);
  if (selectedPropositions.size) selectionParts.push(`${selectedPropositions.size} ${selectedPropositions.size === 1 ? 'proposition' : 'propositions'}`);
  $('#selection-count').textContent = selectionParts.length ? `${selectionParts.join(' · ')} selected` : 'Select words or propositions on the canvas';
  $('#add-proposition').disabled = !selectedTokens.size;
  const selectedOwners = new Set([...selectedTokens].map(id => project.propositions.find(item => item.tokenIds.includes(id))?.id));
  $('#return-source').disabled = !selectedTokens.size || selectedOwners.size !== 1 || selectedOwners.has(undefined);
  $('#open-group').disabled = selectedPropositions.size < 2;
  $('#open-relation').disabled = selectedPropositions.size !== 2;
  $('#open-anchor').disabled = selectedPropositions.size !== 1 || selectedTokens.size !== 1;
  $('#open-role').disabled = selectedPropositions.size !== 1 || (!selectedTokens.size && !project.constituents.length);
  $('#undo').disabled = !undoStack.length; $('#redo').disabled = !redoStack.length;
  const unit = activeUnit();
  $('#assignment-summary').textContent = `${project.propositions.flatMap(item => item.tokenIds).length}/${unit.tokens.length} words assigned · ${project.propositions.length} propositions · ${project.relations.length} relationships`;
  const relation = project.relations.find(item => item.id === focusedRelationId);
  $('#relation-summary').textContent = relation ? `Focused: ${relation.label} · click its label to hide the connector` : 'Select a relationship label to trace its connection.';
  $('#remove-relation').hidden = !relation;
}

function selectCanvasWord(id, extend) {
  if (extend && selectionAnchor) {
    const ids = activeUnit().tokens.map(token => token.id);
    const bounds = [ids.indexOf(selectionAnchor), ids.indexOf(id)].sort((a, b) => a - b);
    selectedTokens = new Set(ids.slice(bounds[0], bounds[1] + 1));
  } else {
    if (selectedTokens.has(id)) selectedTokens.delete(id); else selectedTokens.add(id);
    selectionAnchor = id;
  }
  // Keep the word DOM stable so double-clicks, focus and touch targets remain intact.
  canvas.updateSelection(selectedTokens); updateCanvasActions(); canvas.focusWord(id);
  if (!$('#context-drawer').hidden && $('#group-form').hidden && $('#relation-form').hidden && $('#anchor-form').hidden && $('#role-form').hidden) inspectCanvasWord(id);
}

function inspectCanvasWord(id) {
  const unit = activeUnit();
  const token = unit.tokens.find(item => item.id === id);
  const annotations = unit.annotations.filter(item => item.targetTokenId === id);
  closeEditors(); showInspector(); $('#inspector-empty').hidden = true; $('#word-inspector').hidden = false;
  $('#word-details').replaceChildren(el('p', { text: `${token.text} · ${token.language}`, lang: token.language, dir: 'auto' }),
    ...(token.reference ? [el('p', { text: token.reference.display })] : []),
    ...annotations.map(item => el('p', { text: `${item.kind}: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)} · ${item.scheme ?? 'unspecified scheme'} · ${item.status} · ${item.provenance.providerId}` })),
    ...(annotations.length ? [] : [el('p', { text: 'No lexical annotations supplied for this word.' })]),
    el('p', { className: 'subtle', text: `Source: ${unit.source.sourceId} · ${unit.source.version}` }),
    ...(project.passage.resources ?? []).map(resource => el('p', { className: 'small subtle', text: `${resource.kind}: ${resource.license} · ${resource.attribution}` })));
}

function openCanvasEditor(selector) {
  closeEditors(); showInspector(); $('#inspector-empty').hidden = true; $(selector).hidden = false;
  $(selector).querySelector('input,select')?.focus();
}

$('#toggle-projects').addEventListener('click', () => showProjectDrawer($('#project-drawer').hidden));
$('#close-projects').addEventListener('click', () => { showProjectDrawer(false); $('#toggle-projects').focus(); });
$('#start-project').addEventListener('click', () => { showProjectDrawer(true); $('#project-name').focus(); });
$('#create-project').addEventListener('submit', event => {
  event.preventDefault();
  runUiOperation(async () => {
    await activateProject(createAnalysisProject({ id: crypto.randomUUID(), name: $('#project-name').value, passage: createPracticePassage($('#sample-language').value) }));
    report('Practice project created. Drag words to arrange them, or select a span to create a proposition.');
  });
});

$('#clear-selection').addEventListener('click', () => { selectedTokens.clear(); selectedPropositions.clear(); selectionAnchor = null; closeEditors(); renderCanvas(); });
$('#add-proposition').addEventListener('click', () => runUiOperation(async () => {
  const tokenIds = activeUnit().tokens.filter(token => selectedTokens.has(token.id)).map(token => token.id);
  const next = addAnalysisProposition(project, { id: crypto.randomUUID(), tokenIds });
  selectedTokens.clear();
  await persistProject(next); report('Proposition created on the canvas. Drag its words to arrange the sentence flow.');
}));
$('#return-source').addEventListener('click', () => runUiOperation(async () => {
  const proposition = project.propositions.find(item => [...selectedTokens].every(id => item.tokenIds.includes(id)));
  const next = removeAnalysisTokensFromProposition(project, { propositionId: proposition?.id, tokenIds: [...selectedTokens] });
  selectedTokens.clear(); selectionAnchor = null;
  await persistProject(next); report('Selected words returned to unassigned source staging.');
}));

$('#open-group').addEventListener('click', () => openCanvasEditor('#group-form'));
$('#group-form').addEventListener('submit', event => {
  event.preventDefault();
  runUiOperation(async () => {
    const propositionIds = project.propositions.filter(item => selectedPropositions.has(item.id)).map(item => item.id);
    const next = addAnalysisGroup(project, { id: crypto.randomUUID(), propositionIds, label: $('#group-label').value });
    selectedPropositions.clear(); $('#group-label').value = ''; closeEditors();
    await persistProject(next); report('Group created. Its bracket is shown beside the words.');
  });
});

$('#open-relation').addEventListener('click', () => {
  const selected = [...selectedPropositions];
  for (const [selector, id] of [['#relation-from', selected[0]], ['#relation-to', selected[1]]]) {
    $(selector).replaceChildren(...project.propositions.map((item, index) => el('option', { value: item.id, text: `P${index + 1}` })));
    $(selector).value = id;
  }
  $('#relation-type').replaceChildren(el('option', { value: '', text: 'Choose a relationship' }),
    ...DISCOURSE_RELATION_TYPES.map(item => el('option', { value: item.id, text: item.label, title: item.description })));
  openCanvasEditor('#relation-form');
});
$('#relation-form').addEventListener('submit', event => {
  event.preventDefault();
  runUiOperation(async () => {
    const id = crypto.randomUUID();
    const next = addAnalysisRelation(project, { id, from: $('#relation-from').value, to: $('#relation-to').value, type: $('#relation-type').value });
    focusedRelationId = id; $('#relation-type').value = ''; closeEditors();
    await persistProject(next); report('Directed relationship added beside its proposition.');
  });
});
$('#open-anchor').addEventListener('click', () => {
  const propositionId = [...selectedPropositions][0];
  const tokenId = [...selectedTokens][0];
  const token = activeUnit().tokens.find(item => item.id === tokenId);
  const number = project.propositions.findIndex(item => item.id === propositionId) + 1;
  $('#anchor-selection').textContent = `${token.text} → P${number}`;
  openCanvasEditor('#anchor-form');
});
$('#anchor-form').addEventListener('submit', event => {
  event.preventDefault();
  runUiOperation(async () => {
    const propositionId = [...selectedPropositions][0];
    const tokenId = [...selectedTokens][0];
    const next = addAnalysisPropositionAnchor(project,
      { propositionId, tokenId, function: $('#anchor-function').value });
    selectedTokens.clear(); selectedPropositions.clear(); $('#anchor-function').value = ''; closeEditors();
    await persistProject(next);
    report('Connective cue anchored to the proposition without asserting a discourse relationship.');
  });
});

function configureRoleForm() {
  const unit = activeUnit();
  const selectedIds = unit.tokens.filter(token => selectedTokens.has(token.id)).map(token => token.id);
  const options = [];
  if (selectedIds.length) options.push(el('option', { value: '__selected', text: `Selected words: ${unit.tokens.filter(token => selectedTokens.has(token.id)).map(token => token.text).join(' ')}` }));
  options.push(...project.constituents.map(constituent => el('option', { value: constituent.id,
    text: constituent.label || unit.tokens.filter(token => constituent.tokenIds.includes(token.id)).map(token => token.text).join(' ') })));
  $('#role-constituent').replaceChildren(...options);
  const creating = $('#role-constituent').value === '__selected';
  $('#role-label').hidden = $('#role-label-field').hidden = !creating;
  $('#role-realization').disabled = creating;
  if (creating) $('#role-realization').value = 'explicit'; else $('#role-realization').value = 'implicit';
}

$('#open-role').addEventListener('click', () => { configureRoleForm(); openCanvasEditor('#role-form'); });
$('#role-constituent').addEventListener('change', configureRoleForm);
$('#role-form').addEventListener('submit', event => {
  event.preventDefault();
  runUiOperation(async () => {
    const propositionId = [...selectedPropositions][0];
    const selected = $('#role-constituent').value;
    let next = project;
    let constituentId = selected;
    if (selected === '__selected') {
      constituentId = crypto.randomUUID();
      const tokenIds = activeUnit().tokens.filter(token => selectedTokens.has(token.id)).map(token => token.id);
      next = addAnalysisConstituent(next, { id: constituentId, tokenIds, label: $('#role-label').value });
    }
    next = attachAnalysisConstituent(next, { propositionId, constituentId, role: $('#role-type').value,
      realization: selected === '__selected' ? 'explicit' : $('#role-realization').value });
    selectedTokens.clear(); selectedPropositions.clear(); $('#role-label').value = ''; $('#role-type').value = ''; closeEditors();
    await persistProject(next);
    report(selected === '__selected' ? 'Explicit grammatical constituent created and assigned.' : 'Reusable constituent assigned to the proposition.');
  });
});
$('#remove-relation').addEventListener('click', () => runUiOperation(async () => {
  const next = { ...project, relations: project.relations.filter(item => item.id !== focusedRelationId) };
  focusedRelationId = null; await persistProject(next); report('Relationship removed.');
}));

for (const button of document.querySelectorAll('[data-close-popover]')) button.addEventListener('click', closeEditors);
$('#close-inspector').addEventListener('click', closeEditors);
$('#toggle-inspector').addEventListener('click', () => {
  if (!$('#context-drawer').hidden) { closeEditors(); return; }
  const id = [...selectedTokens].at(-1);
  if (id) inspectCanvasWord(id); else showInspector();
});
$('#canvas-zoom').addEventListener('change', event => canvas.setZoom(Number(event.target.value)));
$('#reset-layout').addEventListener('click', () => runUiOperation(async () => {
  await persistProject(resetAnalysisCanvas(project)); report('Word positions reset. Propositions, groups, and relationships are preserved.');
}));
$('#widen-canvas').addEventListener('click', () => runUiOperation(async () => {
  const next = widenAnalysisCanvas(project);
  await persistProject(next); report(`Canvas widened to ${next.layout.columns} columns. Scroll horizontally to use the added space.`);
}));

function travelCanvasHistory(redo = false) {
  return runUiOperation(async () => {
    const from = redo ? redoStack : undoStack;
    const to = redo ? undoStack : redoStack;
    if (!from.length) return;
    to.push(project); const next = from.pop();
    selectedTokens.clear(); selectedPropositions.clear(); focusedRelationId = null; closeEditors();
    await persistProject(next, { history: false }); report(redo ? 'Edit restored.' : 'Edit undone.');
  });
}
$('#undo').addEventListener('click', () => travelCanvasHistory());
$('#redo').addEventListener('click', () => travelCanvasHistory(true));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeEditors(); showProjectDrawer(false); }
  if (!project || event.target.matches('input,textarea,select') || event.target.isContentEditable) return;
  if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
    event.preventDefault(); travelCanvasHistory(event.key.toLowerCase() === 'y' || event.shiftKey);
  }
});

$('#export-project').addEventListener('click', () => { downloadProjectBackup(project); report('JSON backup exported, including word positions.'); });
$('#delete-project').addEventListener('click', () => runUiOperation(async () => {
  if (!confirm(`Delete “${project.name}” from this browser? Export a backup first if you need it.`)) return;
  if (repository) await repository.delete(project.id);
  sessionProjects.delete(project.id); project = null; undoStack = []; redoStack = [];
  renderProject(); showProjectDrawer(true); await refreshProjectList(); report('Project deleted.');
}));

for (const [selector, isProject] of [['#project-file', true], ['#passage-file', false]]) {
  $(selector).addEventListener('change', event => runUiOperation(async () => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      const next = isProject ? { ...restoreAnalysisProject(value), id: crypto.randomUUID(), name: `${value.name} (imported)` }
        : createAnalysisProject({ id: crypto.randomUUID(), name: $('#project-name').value.trim() || file.name.replace(/\.json$/i, ''), passage: value });
      await activateProject(next); report(isProject ? 'Backup opened as a separate project.' : 'Passage imported onto the canvas.');
    } finally { event.target.value = ''; }
  }));
}

await runUiOperation(async () => {
  try {
    repository = await openAnalysisRepository(); $('#storage-status').textContent = 'Local storage ready. Projects stay on this browser.';
  } catch { $('#storage-status').textContent = 'Session only. Browser storage is unavailable; export before leaving.'; }
  await refreshProjectList();
  const results = await Promise.allSettled([loadBundledEditionCatalog(), repository ? repository.listEditions() : Promise.resolve([])]);
  const catalog = results[0].status === 'fulfilled' ? results[0].value : [];
  const corpora = results[1].status === 'fulfilled' ? results[1].value : [];
  const library = createEditionLibrary({ catalog });
  let invalidCorpus = false;
  for (const corpus of corpora) {
    try { library.addCorpus(corpus); }
    catch { invalidCorpus = true; }
  }
  createEditionBrowser({ library,
    onOpenPassage: (passage, name) => runUiOperation(async () => {
      await activateProject(createAnalysisProject({ id: crypto.randomUUID(), name, passage }));
      $('#canvas-viewport').scrollTo(0, 0);
      report(`${passage.reference.display} opened. This analysis keeps its own source, propositions, and word positions.`);
    }),
    onImportCorpus: async value => {
      const corpus = normalizeEditionCorpus(value);
      const key = `${corpus.edition.id}@${corpus.edition.source.version}`;
      if (library.list().some(edition => `${edition.id}@${edition.source.version}` === key)) throw new Error('This edition version is already in the library.');
      if (repository) await repository.saveEdition(corpus);
      library.addCorpus(corpus);
      if (!repository) report('Edition available for this session only; browser storage is unavailable.');
      return corpus;
    },
    onError: error => report(error.message, true),
  });
  if (invalidCorpus || results.some(result => result.status === 'rejected')) $('#edition-status').textContent = 'Some library data could not be loaded. Available editions and practice tools can still be used.';
});
