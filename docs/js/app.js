import { createAnalysisProject, restoreAnalysisProject, adaptAnalysisPassage, addAnalysisProposition,
  removeAnalysisProposition, addAnalysisGroup, updateAnalysisGroup, removeAnalysisGroup, addAnalysisRelation, addAnalysisTokenToProposition,
  DISCOURSE_RELATION_TYPES, ANALYSIS_NOTE_CATEGORIES, addAnalysisPropositionAnchor, removeAnalysisPropositionAnchor,
  addAnalysisGroupAnchor, removeAnalysisGroupAnchor,
  addAnalysisRelationAnchor, removeAnalysisRelationAnchor,
  addAnalysisConstituent, updateAnalysisConstituent, removeAnalysisConstituent,
  attachAnalysisConstituent, detachAnalysisConstituent,
  MODIFIER_FUNCTIONS, addAnalysisDependency, updateAnalysisDependency, removeAnalysisDependency,
  removeAnalysisTokensFromProposition, addAnalysisNote, updateAnalysisNote, removeAnalysisNote,
  updateAnalysisRelation, removeAnalysisRelation, traceAnalysisArgument,
  rejectAnalysisProposal, restoreAnalysisProposal, importParsedAnalysisDataset, acceptParsedClauseProposal, acceptParsedConstituentProposal,
  rejectParsedAnalysisProposal, restoreParsedAnalysisProposal } from './core/project.js';
import { placeAnalysisCanvasWord, resetAnalysisCanvas, widenAnalysisCanvas } from './core/canvas-layout.js';
import { createPracticePassage } from './core/practice-passages.js';
import { openAnalysisRepository } from './adapters/project-storage.js';
import { createUiElement as el, downloadProjectBackup, downloadTextFile, safeFileStem } from './ui/dom.js';
import { createAnalysisCanvasController } from './ui/analysis-canvas.js';
import { createEditionLibrary, loadBundledEditionCatalog } from './adapters/edition-library.js';
import { normalizeEditionCorpus } from './core/editions.js';
import { createAnalysisMermaid } from './core/mermaid-export.js';
import { createAnalysisSvg } from './core/svg-export.js';
import { collectGrammaticalLandmarks, GRAMMATICAL_LANDMARK_TYPES } from './core/grammatical-landmarks.js';
import { suggestConnectiveCues } from './core/connective-suggestions.js';
import { createEditionBrowser } from './ui/edition-browser.js';

const $ = selector => document.querySelector(selector);
const THEME_STORAGE_KEY = 'analytica-fidei-theme';
const GLOSS_STORAGE_KEY = 'analytica-fidei-show-glosses';
const VOWEL_STORAGE_KEY = 'analytica-fidei-show-hebrew-vowels';
const CANTILLATION_STORAGE_KEY = 'analytica-fidei-show-hebrew-cantillation';
const LANDMARK_STORAGE_KEY = 'analytica-fidei-show-grammatical-landmarks';
const LANDMARK_FILTER_STORAGE_KEY = 'analytica-fidei-grammatical-landmark-filters';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#theme-toggle').setAttribute('aria-pressed', String(theme === 'dark'));
  $('#theme-toggle').textContent = theme === 'dark' ? 'Light theme' : 'Dark theme';
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#102a25' : '#173f37';
}

let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_STORAGE_KEY); } catch { /* Preference persistence is optional. */ }
applyTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme
  : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

let showGlosses = false;
try { showGlosses = localStorage.getItem(GLOSS_STORAGE_KEY) === 'true'; } catch { /* Optional preference. */ }
let showHebrewVowels = true;
let showHebrewCantillation = true;
let showLandmarks = false;
let landmarkFilters = { finite: true, connective: true, other: true };
try {
  showHebrewVowels = localStorage.getItem(VOWEL_STORAGE_KEY) !== 'false';
  showHebrewCantillation = localStorage.getItem(CANTILLATION_STORAGE_KEY) !== 'false';
} catch { /* Optional preferences. */ }
try { showLandmarks = localStorage.getItem(LANDMARK_STORAGE_KEY) === 'true'; } catch { /* Optional preference. */ }
try {
  const saved = JSON.parse(localStorage.getItem(LANDMARK_FILTER_STORAGE_KEY));
  if (saved && ['finite', 'connective', 'other'].every(key => typeof saved[key] === 'boolean')) landmarkFilters = saved;
} catch { /* Optional preference. */ }

let repository = null;
let project = null;
let selectedTokens = new Set();
let selectedPropositions = new Set();
let selectedGroups = new Set();
let selectionAnchor = null;
let focusedRelationId = null;
let traceArgument = false;
let editingRelationId = null;
let editingNoteId = null;
let noteDraftTarget = null;
let editingGroupId = null;
let editingDependencyId = null;
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

function closeSettings() {
  $('#settings-panel').hidden = true;
  $('#toggle-settings').setAttribute('aria-expanded', 'false');
}

function closeEditors() {
  for (const selector of ['#group-form', '#relation-form', '#anchor-form', '#role-form', '#modifier-form', '#note-form', '#word-inspector']) $(selector).hidden = true;
  $('#context-drawer').hidden = true;
  $('#toggle-inspector').setAttribute('aria-expanded', 'false');
  $('#inspector-empty').hidden = false;
}

function showInspector() {
  closeSettings();
  renderConstituentLibrary();
  renderProposalReview();
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
  selectedTokens.clear(); selectedPropositions.clear(); selectedGroups.clear(); selectionAnchor = null; focusedRelationId = null; traceArgument = false;
  undoStack = []; redoStack = []; closeEditors(); closeSettings();
  if (!next.layout) {
    const available = $('#main-content').getBoundingClientRect().width - 32;
    const columns = Math.max(8, Math.floor((available - 158) / 24));
    next = { ...next, layout: { columns, words: {} } };
  }
  showProjectDrawer(false);
  $('#mermaid-preview').hidden = true;
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
    if (checked) { closeEditors(); showInspector(); }
  },
  onToggleGroup: (id, checked) => {
    if (checked) selectedGroups.add(id); else selectedGroups.delete(id);
    updateCanvasActions();
    if (checked) { closeEditors(); showInspector(); }
  },
  onRemoveProposition: id => runUiOperation(async () => {
    selectedPropositions.delete(id); focusedRelationId = null;
    await persistProject(removeAnalysisProposition(project, id));
    report('Proposition removed. Its words remain on the canvas; dependent groups and relations were removed.');
  }),
  onEditGroup: id => {
    const group = project.groups.find(item => item.id === id);
    editingGroupId = id;
    $('#group-label').value = group.label;
    $('#group-form-title').textContent = 'Edit discourse group';
    $('#save-group').textContent = 'Save group label';
    openCanvasEditor('#group-form');
  },
  onRemoveGroup: id => runUiOperation(async () => {
    selectedGroups.delete(id);
    await persistProject(removeAnalysisGroup(project, id));
    report('Group removed. Its propositions and unrelated relationships were retained.');
  }),
  onRemovePropositionAnchor: (propositionId, tokenId) => runUiOperation(async () => {
    await persistProject(removeAnalysisPropositionAnchor(project, { propositionId, tokenId }));
    report('Connective anchor removed. The source word and discourse relationships were retained.');
  }),
  onDetachConstituent: (propositionId, constituentId, role) => runUiOperation(async () => {
    await persistProject(detachAnalysisConstituent(project, { propositionId, constituentId, role }));
    report('Grammatical role removed. The reusable constituent and source words were retained.');
  }),
  onEditDependency: openDependencyEditor,
  onRemoveDependency: id => runUiOperation(async () => {
    await persistProject(removeAnalysisDependency(project, id)); report('Modifier analysis removed. Constituents and roles were retained.');
  }),
  onEditNote: openNoteEditor,
  onRemoveNote: id => runUiOperation(async () => {
    await persistProject(removeAnalysisNote(project, id)); report('Analysis note removed.');
  }),
  onRemoveRelationAnchor: (relationId, tokenId) => runUiOperation(async () => {
    await persistProject(removeAnalysisRelationAnchor(project, { relationId, tokenId }));
    report('Relationship connective anchor removed. The source word and relationship were retained.');
  }),
  onRemoveGroupAnchor: (groupId, tokenId) => runUiOperation(async () => {
    await persistProject(removeAnalysisGroupAnchor(project, { groupId, tokenId }));
    report('Group connective anchor removed. The source word and group were retained.');
  }),
  onFocusRelation: id => { focusedRelationId = focusedRelationId === id ? null : id; traceArgument = false; renderCanvas(); },
});

function activeUnit() { return adaptAnalysisPassage(project.passage); }

function renderProject() {
  $('#welcome').hidden = Boolean(project);
  $('#workbench').hidden = !project;
  $('#project-actions').hidden = !project;
  if (!project) { $('#active-project-name').textContent = 'Discourse analysis canvas'; $('#source-description').textContent = ''; return; }
  renderConstituentLibrary();
  renderProposalReview();
  const unit = activeUnit();
  $('#active-project-name').textContent = project.name;
  $('#source-description').textContent = `${project.passage.editionTitle ?? unit.source.sourceId} · ${unit.source.language}`;
  $('#passage-reference').textContent = unit.reference?.display ?? unit.unitKey;
  $('#original-text').textContent = unit.text ?? 'Exact source text was not supplied. Individual tokens are preserved.';
  $('#original-text').lang = unit.source.language;
  const hasGlosses = unit.annotations.some(item => item.kind === 'gloss' && item.status !== 'unavailable');
  $('#toggle-glosses').disabled = !hasGlosses;
  $('#toggle-glosses').setAttribute('aria-pressed', String(hasGlosses && showGlosses));
  $('#toggle-glosses').textContent = !hasGlosses ? 'Glosses unavailable' : showGlosses ? 'Hide glosses' : 'Show glosses';
  const landmarkMap = collectGrammaticalLandmarks(project);
  const landmarkCount = [...landmarkMap.values()].filter(items => items.length).length;
  const landmarkTotals = [...landmarkMap.values()].flat().reduce((counts, item) => {
    const key = item.type === 'finite-verb' ? 'finite' : item.type === 'connective' ? 'connective' : 'other';
    counts[key] += 1; return counts;
  }, { finite: 0, connective: 0, other: 0 });
  $('#toggle-landmarks').disabled = !landmarkCount;
  $('#toggle-landmarks').setAttribute('aria-pressed', String(landmarkCount > 0 && showLandmarks));
  $('#toggle-landmarks').textContent = !landmarkCount ? 'Grammatical landmarks unavailable'
    : showLandmarks ? 'Hide grammatical landmarks' : 'Show grammatical landmarks';
  $('#landmark-coverage').textContent = landmarkCount
    ? `${landmarkTotals.finite} finite · ${landmarkTotals.connective} connective · ${landmarkTotals.other} other supplied, proposed, or accepted landmarks.`
    : 'No supplied part-of-speech landmarks, lexical connective proposals, or accepted connective anchors are available.';
  for (const key of ['finite', 'connective', 'other']) $(`#landmark-${key}`).checked = landmarkFilters[key];
  const hasVowels = unit.tokens.some(token => /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/u.test(token.text));
  const hasCantillation = unit.tokens.some(token => /[\u0591-\u05AF]/u.test(token.text));
  const isHebrewText = /^(hbo|he)(-|$)/i.test(unit.source.language);
  $('#toggle-vowels').hidden = !isHebrewText;
  $('#toggle-cantillation').hidden = !isHebrewText;
  $('#toggle-vowels').disabled = !hasVowels;
  $('#toggle-vowels').setAttribute('aria-pressed', String(hasVowels && showHebrewVowels));
  $('#toggle-vowels').textContent = !hasVowels ? 'Vowels unavailable' : showHebrewVowels ? 'Hide vowels' : 'Show vowels';
  $('#toggle-cantillation').disabled = !hasCantillation;
  $('#toggle-cantillation').setAttribute('aria-pressed', String(hasCantillation && showHebrewCantillation));
  $('#toggle-cantillation').textContent = !hasCantillation ? 'Cantillation unavailable' : showHebrewCantillation ? 'Hide cantillation' : 'Show cantillation';
  renderCanvas();
}

function renderConstituentLibrary() {
  if (!project) return;
  const unit = activeUnit();
  $('#constituent-library').hidden = !project.constituents.length;
  $('#constituent-list').replaceChildren(...project.constituents.map(constituent => {
    const sourceText = unit.tokens.filter(token => constituent.tokenIds.includes(token.id)).map(token => token.text).join(' ');
    const uses = project.propositions.flatMap(proposition => proposition.constituentRoles ?? [])
      .filter(role => role.constituentId === constituent.id).length;
    const rename = el('button', { type: 'button', text: 'Rename', 'aria-label': `Rename constituent ${constituent.label || sourceText}` });
    rename.addEventListener('click', () => {
      const label = prompt('Reusable constituent name', constituent.label || sourceText);
      if (label === null) return;
      runUiOperation(async () => {
        await persistProject(updateAnalysisConstituent(project, { id: constituent.id, label }));
        report('Reusable constituent renamed everywhere it is used.');
      });
    });
    const addNote = el('button', { type: 'button', text: 'Add note', 'aria-label': `Add note to constituent ${constituent.label || sourceText}` });
    addNote.addEventListener('click', () => openNoteEditor(null, { targetType: 'constituent', targetId: constituent.id }));
    const remove = el('button', { type: 'button', text: 'Delete', className: 'quiet danger',
      'aria-label': `Delete constituent ${constituent.label || sourceText}`, ...(uses ? { disabled: '' } : {}) });
    if (uses) remove.title = `Used by ${uses} grammatical ${uses === 1 ? 'role' : 'roles'}; detach them first.`;
    remove.addEventListener('click', () => runUiOperation(async () => {
      await persistProject(removeAnalysisConstituent(project, constituent.id));
      report('Unused reusable constituent deleted.');
    }));
    const notes = (project.notes ?? []).filter(note => note.targetType === 'constituent' && note.targetId === constituent.id)
      .map(note => {
        const edit = el('button', { type: 'button', className: 'quiet', text: 'Edit', 'aria-label': 'Edit constituent note' });
        edit.addEventListener('click', () => openNoteEditor(note.id));
        const removeNote = el('button', { type: 'button', className: 'quiet danger', text: '×', 'aria-label': 'Remove constituent note' });
        removeNote.addEventListener('click', () => runUiOperation(async () => {
          await persistProject(removeAnalysisNote(project, note.id)); report('Analysis note removed.');
        }));
        return el('span', { className: 'semantic-badge note', title: note.text }, [el('span', { text: `${note.category ?? 'general'}: ${note.text}` }), edit, removeNote]);
      });
    return el('div', { className: 'constituent-item' }, [
      el('p', { text: constituent.label || sourceText }),
      el('p', { className: 'small subtle', text: `${sourceText} · ${uses} ${uses === 1 ? 'use' : 'uses'}` }),
      el('div', { className: 'toolbar' }, [addNote, rename, remove]),
      ...(notes.length ? [el('div', { className: 'constituent-notes' }, notes)] : []),
    ]);
  }));
}

function renderProposalReview() {
  if (!project) return;
  const proposals = project.analysisProposals ?? [];
  $('#proposal-review').hidden = !proposals.length;
  if (!proposals.length) { $('#proposal-list').replaceChildren(); return; }
  const unit = activeUnit();
  const counts = proposals.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {});
  $('#proposal-summary').textContent = `${counts.proposed ?? 0} awaiting review · ${counts.accepted ?? 0} accepted · ${counts.rejected ?? 0} rejected`;
  $('#proposal-list').replaceChildren(...proposals.map(proposal => {
    const words = unit.tokens.filter(token => proposal.tokenIds.includes(token.id)).map(token => token.text).join(' ');
    const actions = [];
    if (proposal.status === 'proposed' && proposal.type === 'clause') {
      const accept = el('button', { type: 'button', text: 'Accept clause', className: 'primary' });
      accept.addEventListener('click', () => runUiOperation(async () => {
        await persistProject(acceptParsedClauseProposal(project, { proposalId: proposal.id, propositionId: crypto.randomUUID() }));
        showInspector(); report('Proposed clause accepted as a proposition. The imported provenance was retained.');
      }));
      actions.push(accept);
    }
    if (proposal.status === 'proposed' && proposal.type === 'constituent') {
      const accept = el('button', { type: 'button', text: 'Accept constituent', className: 'primary' });
      accept.addEventListener('click', () => runUiOperation(async () => {
        await persistProject(acceptParsedConstituentProposal(project, { proposalId: proposal.id, constituentId: crypto.randomUUID() }));
        showInspector(); report('Proposed phrase accepted as a reusable constituent. No grammatical role was inferred.');
      }));
      actions.push(accept);
    }
    if (proposal.status === 'proposed') {
      const reject = el('button', { type: 'button', text: 'Reject', className: 'quiet' });
      reject.addEventListener('click', () => runUiOperation(async () => {
        await persistProject(rejectParsedAnalysisProposal(project, proposal.id)); showInspector(); report('Parsed-analysis proposal rejected.');
      }));
      actions.push(reject);
    } else if (proposal.status === 'rejected') {
      const restore = el('button', { type: 'button', text: 'Restore proposal', className: 'quiet' });
      restore.addEventListener('click', () => runUiOperation(async () => {
        await persistProject(restoreParsedAnalysisProposal(project, proposal.id)); showInspector(); report('Parsed-analysis proposal restored for review.');
      }));
      actions.push(restore);
    }
    return el('article', { className: `proposal-item ${proposal.status}` }, [
      el('p', { text: words, lang: unit.source.language, dir: 'auto' }),
      el('p', { className: 'small subtle', text: `${proposal.type} · ${proposal.status} · ${proposal.provenance.providerId} ${proposal.provenance.version}` }),
      ...(proposal.confidence === undefined ? [] : [el('p', { className: 'small', text: `Confidence: ${Math.round(proposal.confidence * 100)}%` })]),
      ...(proposal.status === 'proposed' && !['clause', 'constituent'].includes(proposal.type)
        ? [el('p', { className: 'small subtle', text: 'Acceptance for this proposal type is not implemented yet; review or reject it without changing the analysis.' })] : []),
      el('div', { className: 'toolbar' }, actions),
    ]);
  }));
}

function renderCanvas() {
  const argumentTrace = traceArgument && focusedRelationId ? traceAnalysisArgument(project, focusedRelationId) : null;
  canvas.render({ project, selectedTokens, selectedPropositions, selectedGroups, focusedRelationId, argumentTrace, showGlosses, showLandmarks, landmarkFilters,
    showHebrewVowels, showHebrewCantillation });
  updateCanvasActions();
}

function updateCanvasActions() {
  const selectionParts = [];
  if (selectedTokens.size) selectionParts.push(`${selectedTokens.size} ${selectedTokens.size === 1 ? 'word' : 'words'}`);
  if (selectedPropositions.size) selectionParts.push(`${selectedPropositions.size} ${selectedPropositions.size === 1 ? 'proposition' : 'propositions'}`);
  if (selectedGroups.size) selectionParts.push(`${selectedGroups.size} ${selectedGroups.size === 1 ? 'group' : 'groups'}`);
  $('#selection-count').textContent = selectionParts.length ? `${selectionParts.join(' · ')} selected` : 'Select words or propositions on the canvas';
  $('#add-proposition').disabled = !selectedTokens.size;
  const selectedOwners = new Set([...selectedTokens].map(id => project.propositions.find(item => item.tokenIds.includes(id))?.id));
  $('#return-source').disabled = !selectedTokens.size || selectedOwners.size !== 1 || selectedOwners.has(undefined);
  $('#open-group').disabled = selectedPropositions.size < 2;
  $('#open-relation').disabled = selectedPropositions.size + selectedGroups.size !== 2;
  $('#open-anchor').disabled = selectedTokens.size !== 1
    || (selectedPropositions.size !== 1 && selectedGroups.size !== 1 && !focusedRelationId);
  $('#open-role').disabled = selectedPropositions.size !== 1 || (!selectedTokens.size && !project.constituents.length);
  const selectedProposition = project.propositions.find(item => selectedPropositions.has(item.id));
  $('#open-modifier').disabled = !selectedProposition || !(selectedProposition.constituentRoles?.length);
  $('#open-note').disabled = !((selectedTokens.size === 1 && selectedPropositions.size === 0) ||
    (selectedTokens.size === 0 && selectedPropositions.size === 1));
  $('#undo').disabled = !undoStack.length; $('#redo').disabled = !redoStack.length;
  const unit = activeUnit();
  $('#assignment-summary').textContent = `${project.propositions.flatMap(item => item.tokenIds).length}/${unit.tokens.length} words assigned · ${project.propositions.length} propositions · ${project.relations.length} relationships`;
  const relation = project.relations.find(item => item.id === focusedRelationId);
  $('#relation-summary').textContent = relation ? `Focused: ${relation.label} · click its label to hide the connector` : 'Select a relationship label to trace its connection.';
  $('#remove-relation').hidden = !relation;
  $('#edit-relation').hidden = !relation;
  $('#note-relation').hidden = !relation;
  $('#trace-argument').hidden = !relation;
  $('#trace-argument').setAttribute('aria-pressed', String(Boolean(relation && traceArgument)));
  $('#trace-argument').textContent = traceArgument ? 'Show focused relationship only' : 'Trace connected argument';
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
  if (selectedTokens.has(id)) inspectCanvasWord(id);
}

function inspectCanvasWord(id) {
  const unit = activeUnit();
  const token = unit.tokens.find(item => item.id === id);
  const annotations = unit.annotations.filter(item => item.targetTokenId === id);
  const notes = (project.notes ?? []).filter(item => item.targetType === 'token' && item.targetId === id);
  const connectiveSuggestion = suggestConnectiveCues(project, { includeRejected: true }).get(id);
  const annotationElement = item => {
    if (item.kind !== 'readingAlternative') return el('p', { text: `${item.kind}: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)} · ${item.scheme ?? 'unspecified scheme'} · ${item.status} · ${item.provenance.providerId}` });
    return el('section', { className: 'reading-alternative', 'aria-label': 'Supplied written and read alternative' }, [
      el('p', {}, [el('strong', { text: 'Written: ' }), el('bdi', { text: item.value.written, lang: token.language, dir: 'auto' })]),
      el('p', {}, [el('strong', { text: 'Read: ' }), el('bdi', { text: item.value.read, lang: item.language ?? token.language, dir: 'auto' })]),
      el('p', { className: 'small subtle', text: `${item.value.type ?? 'reading alternative'} · ${item.scheme ?? 'unspecified scheme'} · ${item.status} · ${item.provenance.providerId}` }),
    ]);
  };
  closeEditors(); showInspector(); $('#inspector-empty').hidden = true; $('#word-inspector').hidden = false;
  $('#word-details').replaceChildren(el('p', { text: `${token.text} · ${token.language}`, lang: token.language, dir: 'auto' }),
    ...(token.reference ? [el('p', { text: token.reference.display })] : []),
    ...annotations.map(annotationElement),
    ...(annotations.length ? [] : [el('p', { text: 'No lexical annotations supplied for this word.' })]),
    ...(connectiveSuggestion ? [el('div', { className: 'connective-suggestion' }, [
      el('p', { text: connectiveSuggestion.status === 'rejected'
        ? `Dismissed connective suggestion: ${connectiveSuggestion.function} · ${connectiveSuggestion.explanation}`
        : connectiveSuggestion.status === 'accepted'
          ? `Accepted connective cue: ${connectiveSuggestion.function} · The lexical proposal has been reviewed and anchored.`
        : `Draft connective cue: ${connectiveSuggestion.function} · ${connectiveSuggestion.explanation} Review by anchoring it; no relationship has been inferred.` }),
      ...(connectiveSuggestion.status === 'accepted' ? [] : [(() => {
        const rejected = connectiveSuggestion.status === 'rejected';
        const button = el('button', { type: 'button', className: 'quiet',
          text: rejected ? 'Restore suggestion' : 'Dismiss suggestion' });
        button.addEventListener('click', () => runUiOperation(async () => {
          const review = { kind: 'connective-cue', tokenId: id,
            providerId: connectiveSuggestion.provenance.providerId, version: connectiveSuggestion.provenance.version };
          await persistProject(rejected ? restoreAnalysisProposal(project, review) : rejectAnalysisProposal(project, review));
          inspectCanvasWord(id);
          report(rejected ? 'Connective suggestion restored for review.' : 'Connective suggestion dismissed. Use Undo or Restore suggestion to reconsider it.');
        }));
        return button;
      })()]),
    ])] : []),
    ...notes.map(note => {
      const edit = el('button', { type: 'button', className: 'quiet', text: 'Edit', 'aria-label': 'Edit word note' });
      edit.addEventListener('click', () => openNoteEditor(note.id));
      const remove = el('button', { type: 'button', className: 'quiet danger', text: 'Remove', 'aria-label': 'Remove word note' });
      remove.addEventListener('click', () => runUiOperation(async () => {
        await persistProject(removeAnalysisNote(project, note.id)); report('Analysis note removed.');
      }));
      return el('div', { className: 'inspector-note' }, [el('p', { text: `${note.category ?? 'general'}: ${note.text}` }), edit, remove]);
    }),
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

$('#clear-selection').addEventListener('click', () => { selectedTokens.clear(); selectedPropositions.clear(); selectedGroups.clear(); selectionAnchor = null; closeEditors(); renderCanvas(); });
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

$('#open-group').addEventListener('click', () => {
  editingGroupId = null;
  $('#group-label').value = '';
  $('#group-form-title').textContent = 'Group propositions';
  $('#save-group').textContent = 'Apply group';
  openCanvasEditor('#group-form');
});
$('#group-form').addEventListener('submit', event => {
  event.preventDefault();
  runUiOperation(async () => {
    const revised = Boolean(editingGroupId);
    const propositionIds = project.propositions.filter(item => selectedPropositions.has(item.id)).map(item => item.id);
    const next = editingGroupId
      ? updateAnalysisGroup(project, { id: editingGroupId, label: $('#group-label').value })
      : addAnalysisGroup(project, { id: crypto.randomUUID(), propositionIds, label: $('#group-label').value });
    editingGroupId = null;
    selectedPropositions.clear(); $('#group-label').value = ''; closeEditors();
    await persistProject(next); report(revised ? 'Discourse group label updated.' : 'Group created. Its bracket is shown beside the words.');
  });
});

function configureRelationForm(relation = null) {
  const selected = relation ? [relation.from, relation.to] : [...selectedPropositions, ...selectedGroups];
  const endpointOptions = [
    ...project.propositions.map((item, index) => el('option', { value: item.id, text: `P${index + 1} · Proposition` })),
    ...project.groups.map((item, index) => el('option', { value: item.id, text: `G${index + 1} · ${item.label || 'Discourse group'}` })),
  ];
  for (const [selector, id] of [['#relation-from', selected[0]], ['#relation-to', selected[1]]]) {
    $(selector).replaceChildren(...endpointOptions.map(option => option.cloneNode(true)));
    $(selector).value = id;
  }
  $('#relation-type').replaceChildren(el('option', { value: '', text: 'Choose a relationship' }),
    ...DISCOURSE_RELATION_TYPES.map(item => el('option', { value: item.id, text: item.label, title: item.description })));
  $('#relation-type').value = relation?.type ?? '';
  updateRelationGuidance();
  $('#relation-form-title').textContent = relation ? 'Edit discourse relationship' : 'Connect analysis units';
  $('#save-relation').textContent = relation ? 'Save relationship' : 'Add relation';
}
function updateRelationGuidance() {
  const type = DISCOURSE_RELATION_TYPES.find(item => item.id === $('#relation-type').value);
  $('#relation-description').textContent = type
    ? `${type.label}: ${type.description} From = ${type.sourceRole}; To = ${type.targetRole}. Reverse the endpoints if those participant roles are backwards.`
    : 'Choose a relationship to see its definition.';
}
$('#relation-legend-list').replaceChildren(...DISCOURSE_RELATION_TYPES.flatMap(item => [
  el('dt', { text: item.label }), el('dd', { text: `${item.description} From: ${item.sourceRole}; To: ${item.targetRole}.` }),
]));
$('#note-category').replaceChildren(...ANALYSIS_NOTE_CATEGORIES.map(item => el('option', { value: item.id, text: item.label })));
$('#landmark-legend-list').replaceChildren(...GRAMMATICAL_LANDMARK_TYPES.flatMap(item => [
  el('dt', { text: `${item.symbol} ${item.label}` }), el('dd', { text: item.description }),
]));
$('#relation-type').addEventListener('change', updateRelationGuidance);
$('#open-relation').addEventListener('click', () => {
  editingRelationId = null;
  configureRelationForm();
  openCanvasEditor('#relation-form');
});
$('#relation-form').addEventListener('submit', event => {
  event.preventDefault();
  runUiOperation(async () => {
    const id = editingRelationId ?? crypto.randomUUID();
    const input = { id, from: $('#relation-from').value, to: $('#relation-to').value, type: $('#relation-type').value };
    const next = editingRelationId ? updateAnalysisRelation(project, input) : addAnalysisRelation(project, input);
    const revised = Boolean(editingRelationId);
    editingRelationId = null;
    focusedRelationId = id; $('#relation-type').value = ''; closeEditors();
    selectedGroups.clear(); selectedPropositions.clear();
    await persistProject(next); report(revised ? 'Discourse relationship updated.' : 'Directed relationship added between the selected analysis units.');
  });
});
$('#open-anchor').addEventListener('click', () => {
  const tokenId = [...selectedTokens][0];
  const token = activeUnit().tokens.find(item => item.id === tokenId);
  const suggestion = suggestConnectiveCues(project).get(tokenId);
  $('#anchor-function').value = suggestion?.function ?? '';
  if (selectedPropositions.size === 1) {
    const propositionId = [...selectedPropositions][0];
    const number = project.propositions.findIndex(item => item.id === propositionId) + 1;
    $('#anchor-selection').textContent = `${token.text} → proposition P${number}`;
  } else if (selectedGroups.size === 1) {
    const groupId = [...selectedGroups][0];
    const number = project.groups.findIndex(item => item.id === groupId) + 1;
    $('#anchor-selection').textContent = `${token.text} → discourse group G${number}`;
  } else {
    const relation = project.relations.find(item => item.id === focusedRelationId);
    $('#anchor-selection').textContent = `${token.text} → ${relation.label} relationship`;
  }
  $('#anchor-suggestion').hidden = !suggestion;
  $('#anchor-suggestion').textContent = suggestion
    ? `Draft suggestion: ${suggestion.function}. ${suggestion.explanation} Confirm or choose another function.` : '';
  openCanvasEditor('#anchor-form');
});
$('#anchor-form').addEventListener('submit', event => {
  event.preventDefault();
  runUiOperation(async () => {
    const tokenId = [...selectedTokens][0];
    const groupTarget = selectedGroups.size === 1 ? [...selectedGroups][0] : null;
    const relationTarget = selectedPropositions.size !== 1 && !groupTarget && focusedRelationId;
    const next = groupTarget
      ? addAnalysisGroupAnchor(project, { groupId: groupTarget, tokenId, function: $('#anchor-function').value })
      : relationTarget ? addAnalysisRelationAnchor(project, { relationId: focusedRelationId, tokenId, function: $('#anchor-function').value })
        : addAnalysisPropositionAnchor(project,
          { propositionId: [...selectedPropositions][0], tokenId, function: $('#anchor-function').value });
    selectedTokens.clear(); selectedPropositions.clear(); selectedGroups.clear(); $('#anchor-function').value = ''; closeEditors();
    await persistProject(next);
    report(groupTarget ? 'Connective cue anchored to the discourse group without determining a relationship.' : relationTarget
      ? 'Connective cue anchored to the relationship without changing its semantic type.'
      : 'Connective cue anchored to the proposition without asserting a discourse relationship.');
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
    selectedTokens.clear(); selectedPropositions.clear(); selectedGroups.clear(); $('#role-label').value = ''; $('#role-type').value = ''; closeEditors();
    await persistProject(next);
    report(selected === '__selected' ? 'Explicit grammatical constituent created and assigned.' : 'Reusable constituent assigned to the proposition.');
  });
});

function configureModifierTarget() {
  const substantive = $('#modifier-function').value === 'substantive';
  $('#modifier-target').disabled = substantive;
  $('#modifier-target').required = !substantive;
  if (substantive) $('#modifier-target').value = '';
}

function openDependencyEditor(id = null) {
  editingDependencyId = id;
  const dependency = id ? project.dependencies.find(item => item.id === id) : null;
  const propositionId = dependency?.propositionId ?? [...selectedPropositions][0];
  const proposition = project.propositions.find(item => item.id === propositionId);
  const constituentIds = [...new Set((proposition.constituentRoles ?? []).map(item => item.constituentId))];
  const options = constituentIds.map(constituentId => {
    const constituent = project.constituents.find(item => item.id === constituentId);
    const text = constituent.label || activeUnit().tokens.filter(token => constituent.tokenIds.includes(token.id)).map(token => token.text).join(' ');
    return { id: constituentId, text };
  });
  $('#modifier-constituent').replaceChildren(...options.map(item => el('option', { value: item.id, text: item.text })));
  $('#modifier-target').replaceChildren(el('option', { value: '', text: 'Choose a target' }),
    ...options.map(item => el('option', { value: item.id, text: item.text })));
  $('#modifier-function').replaceChildren(...MODIFIER_FUNCTIONS.map(item => el('option', { value: item.id, text: item.label })));
  $('#modifier-constituent').value = dependency?.modifierId ?? options[0]?.id ?? '';
  $('#modifier-function').value = dependency?.function ?? 'general';
  $('#modifier-target').value = dependency?.targetId ?? '';
  $('#modifier-form').dataset.propositionId = propositionId;
  $('#modifier-form-title').textContent = dependency ? 'Edit modifier analysis' : 'Analyze a modifier';
  $('#save-modifier').textContent = dependency ? 'Save modifier changes' : 'Save modifier analysis';
  configureModifierTarget();
  openCanvasEditor('#modifier-form');
}

$('#open-modifier').addEventListener('click', () => openDependencyEditor());
$('#modifier-function').addEventListener('change', configureModifierTarget);
$('#modifier-constituent').addEventListener('change', () => {
  if ($('#modifier-target').value === $('#modifier-constituent').value) $('#modifier-target').value = '';
});
$('#modifier-form').addEventListener('submit', event => {
  event.preventDefault();
  runUiOperation(async () => {
    const input = { id: editingDependencyId ?? crypto.randomUUID(), propositionId: event.currentTarget.dataset.propositionId,
      modifierId: $('#modifier-constituent').value, targetId: $('#modifier-target').value || undefined,
      function: $('#modifier-function').value };
    const revised = Boolean(editingDependencyId);
    const next = revised ? updateAnalysisDependency(project, input) : addAnalysisDependency(project, input);
    editingDependencyId = null; selectedPropositions.clear(); closeEditors();
    await persistProject(next); report(revised ? 'Modifier analysis updated.' : 'Modifier analysis saved.');
  });
});

function openNoteEditor(id = null, target = null) {
  editingNoteId = id;
  const note = id ? project.notes.find(item => item.id === id) : null;
  noteDraftTarget = note ? { targetType: note.targetType, targetId: note.targetId } : target;
  $('#note-form-title').textContent = note ? 'Edit analysis note' : 'Add an analysis note';
  $('#note-text').value = note?.text ?? '';
  $('#note-category').value = note?.category ?? 'general';
  if (note) {
    if (note.targetType === 'token') {
      const token = activeUnit().tokens.find(item => item.id === note.targetId);
      $('#note-target').textContent = `Word: ${token.text}`;
    } else if (note.targetType === 'proposition') {
      const number = project.propositions.findIndex(item => item.id === note.targetId) + 1;
      $('#note-target').textContent = `Proposition P${number}`;
    } else if (note.targetType === 'relation') {
      $('#note-target').textContent = `Relationship: ${project.relations.find(item => item.id === note.targetId)?.label}`;
    } else $('#note-target').textContent = `Reusable constituent: ${project.constituents.find(item => item.id === note.targetId)?.label || 'unnamed constituent'}`;
    openCanvasEditor('#note-form');
    return;
  }
  if (target?.targetType === 'relation') {
    $('#note-target').textContent = `Relationship: ${project.relations.find(item => item.id === target.targetId)?.label}`;
  } else if (target?.targetType === 'constituent') {
    const constituent = project.constituents.find(item => item.id === target.targetId);
    $('#note-target').textContent = `Reusable constituent: ${constituent.label || 'unnamed constituent'}`;
  } else if (selectedTokens.size === 1) {
    const token = activeUnit().tokens.find(item => item.id === [...selectedTokens][0]);
    $('#note-target').textContent = `Word: ${token.text}`;
    noteDraftTarget = { targetType: 'token', targetId: token.id };
  } else {
    const propositionId = [...selectedPropositions][0];
    const number = project.propositions.findIndex(item => item.id === propositionId) + 1;
    $('#note-target').textContent = `Proposition P${number}`;
    noteDraftTarget = { targetType: 'proposition', targetId: propositionId };
  }
  openCanvasEditor('#note-form');
}
$('#open-note').addEventListener('click', () => openNoteEditor());
$('#note-form').addEventListener('submit', event => {
  event.preventDefault();
  runUiOperation(async () => {
    const revised = Boolean(editingNoteId);
    let next;
    if (editingNoteId) next = updateAnalysisNote(project,
      { id: editingNoteId, text: $('#note-text').value, category: $('#note-category').value });
    else {
      next = addAnalysisNote(project,
        { id: crypto.randomUUID(), ...noteDraftTarget, text: $('#note-text').value, category: $('#note-category').value });
    }
    editingNoteId = null; noteDraftTarget = null;
    selectedTokens.clear(); selectedPropositions.clear(); selectedGroups.clear(); $('#note-text').value = ''; closeEditors();
    await persistProject(next); report(revised ? 'Analysis note updated.' : 'Analysis note saved.');
  });
});
$('#edit-relation').addEventListener('click', () => {
  const relation = project.relations.find(item => item.id === focusedRelationId);
  if (!relation) return;
  editingRelationId = relation.id;
  configureRelationForm(relation);
  openCanvasEditor('#relation-form');
});
$('#trace-argument').addEventListener('click', () => {
  traceArgument = !traceArgument;
  renderCanvas();
  const trace = traceArgument ? traceAnalysisArgument(project, focusedRelationId) : null;
  report(trace ? `Tracing ${trace.propositionIds.length} propositions across ${trace.relationIds.length} relationships.`
    : 'Showing the focused relationship only.');
});
$('#note-relation').addEventListener('click', () => openNoteEditor(null,
  { targetType: 'relation', targetId: focusedRelationId }));
$('#remove-relation').addEventListener('click', () => runUiOperation(async () => {
  const next = removeAnalysisRelation(project, focusedRelationId);
  focusedRelationId = null; traceArgument = false; await persistProject(next); report('Relationship removed.');
}));

for (const button of document.querySelectorAll('[data-close-popover]')) button.addEventListener('click', closeEditors);
$('#close-inspector').addEventListener('click', closeEditors);
$('#toggle-inspector').addEventListener('click', () => {
  if (!$('#context-drawer').hidden) { closeEditors(); return; }
  const id = [...selectedTokens].at(-1);
  if (id) inspectCanvasWord(id); else showInspector();
});
$('#toggle-settings').addEventListener('click', () => {
  const show = $('#settings-panel').hidden;
  if (show) closeEditors();
  $('#settings-panel').hidden = !show;
  $('#toggle-settings').setAttribute('aria-expanded', String(show));
  if (show) $('#canvas-zoom').focus();
});
$('#close-settings').addEventListener('click', () => { closeSettings(); $('#toggle-settings').focus(); });
$('#canvas-zoom').addEventListener('change', event => {
  $('#canvas-zoom').querySelector('[data-fit-value]')?.remove();
  canvas.setZoom(Number(event.target.value));
});
$('#fit-canvas').addEventListener('click', () => {
  const zoom = canvas.fitToView();
  $('#canvas-zoom').querySelector('[data-fit-value]')?.remove();
  const option = el('option', { value: String(zoom), text: `Fit (${Math.round(zoom * 100)}%)`, 'data-fit-value': '' });
  $('#canvas-zoom').append(option); $('#canvas-zoom').value = String(zoom);
  report(`Canvas fit to the viewport at ${Math.round(zoom * 100)}%.`);
});
$('#theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Keep the in-session theme. */ }
});
$('#toggle-glosses').addEventListener('click', () => {
  showGlosses = !showGlosses;
  $('#toggle-glosses').setAttribute('aria-pressed', String(showGlosses));
  $('#toggle-glosses').textContent = showGlosses ? 'Hide glosses' : 'Show glosses';
  try { localStorage.setItem(GLOSS_STORAGE_KEY, String(showGlosses)); } catch { /* Keep the in-session layer. */ }
  renderCanvas();
});
$('#toggle-landmarks').addEventListener('click', () => {
  showLandmarks = !showLandmarks;
  try { localStorage.setItem(LANDMARK_STORAGE_KEY, String(showLandmarks)); } catch { /* Keep in session. */ }
  renderProject();
  report(showLandmarks ? 'Grammatical landmarks shown. Symbols and patterns supplement color.' : 'Grammatical landmarks hidden.');
});
for (const key of ['finite', 'connective', 'other']) $(`#landmark-${key}`).addEventListener('change', event => {
  landmarkFilters = { ...landmarkFilters, [key]: event.target.checked };
  try { localStorage.setItem(LANDMARK_FILTER_STORAGE_KEY, JSON.stringify(landmarkFilters)); } catch { /* Keep in session. */ }
  renderCanvas();
  report('Grammatical landmark layers updated.');
});
function toggleHebrewLayer(key) {
  if (key === 'vowels') showHebrewVowels = !showHebrewVowels;
  else showHebrewCantillation = !showHebrewCantillation;
  const visible = key === 'vowels' ? showHebrewVowels : showHebrewCantillation;
  const button = key === 'vowels' ? $('#toggle-vowels') : $('#toggle-cantillation');
  button.setAttribute('aria-pressed', String(visible));
  button.textContent = `${visible ? 'Hide' : 'Show'} ${key}`;
  try { localStorage.setItem(key === 'vowels' ? VOWEL_STORAGE_KEY : CANTILLATION_STORAGE_KEY, String(visible)); } catch { /* Keep in session. */ }
  renderCanvas();
}
$('#toggle-vowels').addEventListener('click', () => toggleHebrewLayer('vowels'));
$('#toggle-cantillation').addEventListener('click', () => toggleHebrewLayer('cantillation'));
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
    selectedTokens.clear(); selectedPropositions.clear(); selectedGroups.clear(); focusedRelationId = null; closeEditors();
    await persistProject(next, { history: false }); report(redo ? 'Edit restored.' : 'Edit undone.');
  });
}
$('#undo').addEventListener('click', () => travelCanvasHistory());
$('#redo').addEventListener('click', () => travelCanvasHistory(true));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeEditors(); closeSettings(); showProjectDrawer(false); }
  if (!project || event.target.matches('input,textarea,select') || event.target.isContentEditable) return;
  if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
    event.preventDefault(); travelCanvasHistory(event.key.toLowerCase() === 'y' || event.shiftKey);
  }
});

$('#export-project').addEventListener('click', () => { downloadProjectBackup(project); report('JSON backup exported, including word positions.'); });
$('#preview-mermaid').addEventListener('click', () => {
  $('#mermaid-source').textContent = createAnalysisMermaid(project);
  $('#mermaid-preview').hidden = false;
  $('#mermaid-source').focus();
  report('Mermaid semantic source generated.');
});
$('#close-mermaid-preview').addEventListener('click', () => { $('#mermaid-preview').hidden = true; });
$('#download-mermaid').addEventListener('click', () => {
  downloadTextFile(createAnalysisMermaid(project), `${safeFileStem(project.name)}_analysis.mmd`);
  report('Mermaid semantic flowchart exported.');
});
$('#download-svg').addEventListener('click', () => {
  downloadTextFile(createAnalysisSvg(project, { tokenWidths: canvas.getWidths() }), `${safeFileStem(project.name)}_analysis.svg`, 'image/svg+xml;charset=utf-8');
  report('Standalone vector SVG exported from the resolved analysis layout.');
});
$('#proposal-file').addEventListener('change', event => runUiOperation(async () => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const previousCount = project.analysisProposals.length;
    const next = importParsedAnalysisDataset(project, JSON.parse(await file.text()));
    await persistProject(next); showProjectDrawer(false); showInspector();
    report(`${next.analysisProposals.length - previousCount} parsed-analysis proposals imported for review.`);
  } finally { event.target.value = ''; }
}));
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {
  // The workbench remains usable online and local-first storage still functions.
});
