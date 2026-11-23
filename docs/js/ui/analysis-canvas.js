import { computeAnalysisCanvas, CANVAS_CELL_WIDTH as CELL, CANVAS_ROW_HEIGHT as ROW,
  CANVAS_WORD_HEIGHT as WORD_HEIGHT } from '../core/canvas-layout.js';
import { MAX_CANVAS_ROW } from '../core/presentation.js';
import { createUiElement as el } from './dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(tag, attributes = {}, children = []) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  element.append(...children);
  return element;
}

function positionElement(element, left, top, width) {
  Object.assign(element.style, { left: `${left}px`, top: `${top}px` });
  if (width !== undefined) element.style.width = `${width}px`;
  return element;
}

/** Browser-only renderer/controller. Geometry and collision rules live in the pure core.
 * @param {object} options Canvas elements and explicit editing callbacks.
 * @returns {{render:function(object):void,updateSelection:function(Set):void,setZoom:function(number):void,focusWord:function(string):void,getWidths:function():object}}
 */
export function createAnalysisCanvasController({ root, viewport, sizer, onSelectWord, onInspectWord,
  onMoveWord, onToggleProposition, onRemoveProposition, onRemoveGroup, onFocusRelation }) {
  let model;
  let state;
  let zoom = 1;
  let drag = null;
  let suppressClick = false;
  let widths = {};
  const measurer = document.createElement('canvas').getContext('2d');

  function measureTokenWidths(project) {
    // Match the rendered font; supply only measurements to the headless layout engine.
    measurer.font = '20px "Palatino Linotype", "Book Antiqua", "Times New Roman", serif';
    const tokens = computeAnalysisCanvas(project).unit.tokens;
    return Object.fromEntries(tokens.map(token => [token.id, measurer.measureText(token.text).width + 26]));
  }

  function applyZoom() {
    if (!model) return;
    const renderWidth = Math.max(model.width, viewport.clientWidth / zoom);
    root.style.width = `${renderWidth}px`;
    root.style.transform = `scale(${zoom})`;
    sizer.style.width = `${renderWidth * zoom}px`;
    sizer.style.height = `${model.height * zoom}px`;
  }

  function renderWord(word, block) {
    const button = el('button', { text: word.text, type: 'button', className: 'token canvas-word',
      lang: word.language, dir: 'auto', 'data-token-id': word.id, 'data-column': word.column, 'data-row': word.row,
      'aria-pressed': state.selectedTokens.has(word.id),
      'aria-label': `${word.text} · ${block.kind === 'source' ? 'unassigned' : `proposition ${state.project.propositions.findIndex(item => item.id === block.id) + 1}`} · column ${word.column + 1}, row ${word.row + 1}`,
      title: 'Drag to place · Arrow keys to nudge · Double-click for word details' });
    const x = model.gutter + word.column * CELL;
    const y = block.wordY + word.row * ROW;
    const elements = [positionElement(button, x, y, word.width * CELL - 4)];
    if (word.isVerseStart && word.reference?.verse) elements.push(positionElement(el('span', {
      className: 'verse-anchor', text: word.reference.verse, title: word.reference.display, 'aria-label': word.reference.display,
    }), x + 2, y - 12));
    return elements;
  }

  function renderBlock(block) {
    const focused = state.project.relations.find(item => item.id === state.focusedRelationId);
    const wrapper = positionElement(el('div', { className: `canvas-block ${block.kind === 'proposition' ? 'proposition' : 'source-block'}${focused && [focused.from, focused.to].includes(block.id) ? ' is-focused' : ''}`,
      'data-block-id': block.id }), 0, block.top);
    wrapper.style.height = `${block.bottom - block.top}px`;
    const heading = positionElement(el('div', { className: 'block-heading' }), model.gutter, block.headingY - block.top);
    if (block.kind === 'proposition') {
      const number = state.project.propositions.findIndex(item => item.id === block.id) + 1;
      const proposition = state.project.propositions[number - 1];
      const checkbox = el('input', { type: 'checkbox', 'aria-label': `Select proposition ${number}` });
      checkbox.checked = state.selectedPropositions.has(block.id);
      checkbox.addEventListener('change', () => onToggleProposition(block.id, checkbox.checked));
      const remove = el('button', { text: '×', className: 'quiet', 'aria-label': `Remove proposition ${number}` });
      remove.addEventListener('click', () => onRemoveProposition(block.id));
      const tokenText = ids => model.unit.tokens.filter(token => ids.includes(token.id)).map(token => token.text).join(' ');
      const roles = (proposition.constituentRoles ?? []).map(assertion => {
        const constituent = (state.project.constituents ?? []).find(item => item.id === assertion.constituentId);
        const name = constituent?.label || tokenText(constituent?.tokenIds ?? []) || 'constituent';
        return el('span', { className: `semantic-badge ${assertion.realization}`,
          text: `${assertion.realization === 'implicit' ? '↶ ' : ''}${assertion.role}: ${name}`,
          title: `${assertion.realization} ${assertion.role}` });
      });
      const anchors = (proposition.anchors ?? []).map(anchor => {
        const word = model.unit.tokens.find(token => token.id === anchor.tokenId)?.text ?? 'source cue';
        return el('span', { className: 'semantic-badge connective',
          text: `◇ ${word}${anchor.function ? ` · ${anchor.function}` : ''}`, title: 'Connective proposition anchor' });
      });
      heading.append(el('label', {}, [checkbox, el('span', { text: `P${number}` })]), ...roles, ...anchors, remove);
    } else heading.append(el('span', { className: 'source-heading', text: 'Source' }));
    wrapper.append(heading);
    return [wrapper, ...block.words.flatMap(word => renderWord(word, block))];
  }

  function renderGroupLabels() {
    return model.groups.map(group => {
      const remove = el('button', { text: '×', 'aria-label': `Ungroup ${group.label || 'propositions'}` });
      remove.addEventListener('click', () => onRemoveGroup(group.id));
      return positionElement(el('div', { className: 'group-badge', title: group.label || 'Discourse group' },
        [el('span', { text: group.label || 'Discourse group' }), remove]), model.gutter, group.top - 12);
    });
  }

  function renderGroupBrackets() {
    return svgElement('svg', { class: 'canvas-brackets', width: model.width, height: model.height, 'aria-hidden': true },
      model.groups.map(group => svgElement('path', { class: 'bracket', 'data-group-id': group.id,
        d: `M ${model.gutter - 52} ${group.top} H ${group.x + 8} Q ${group.x} ${group.top} ${group.x} ${group.top + 8} V ${group.bottom - 8} Q ${group.x} ${group.bottom} ${group.x + 8} ${group.bottom} H ${model.gutter - 52}` })));
  }

  function renderRelations() {
    const number = id => `P${state.project.propositions.findIndex(item => item.id === id) + 1}`;
    const chips = model.blocks.filter(block => block.relations.length).map(block => positionElement(el('div', { className: 'relation-chips' },
      block.relations.map(relation => {
        const button = el('button', { className: 'relation-chip', text: `${relation.label} → ${number(relation.to)}`,
          'aria-label': `${number(relation.from)} → ${number(relation.to)} · ${relation.label}`, 'aria-pressed': state.focusedRelationId === relation.id });
        button.addEventListener('click', () => onFocusRelation(relation.id));
        return button;
      })), model.gutter, block.headingY + 24));
    const relation = state.project.relations.find(item => item.id === state.focusedRelationId);
    if (!relation) return chips;
    const from = model.blocks.find(block => block.id === relation.from);
    const to = model.blocks.find(block => block.id === relation.to);
    const x = model.gutter - 16;
    const lane = model.gutter - 42;
    const svg = svgElement('svg', { class: 'canvas-connectors', width: model.width, height: model.height, 'aria-hidden': true }, [
      svgElement('defs', {}, [svgElement('marker', { id: 'relation-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
        [svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#b37b2b' })])]),
      svgElement('path', { class: 'relation-edge', 'marker-end': 'url(#relation-arrow)',
        d: `M ${x} ${from.wordY + 18} H ${lane} V ${to.wordY + 18} H ${x}` }),
    ]);
    return [svg, ...chips];
  }

  function render(nextState) {
    state = nextState;
    widths = measureTokenWidths(state.project);
    model = computeAnalysisCanvas(state.project, { tokenWidths: widths });
    root.style.height = `${model.height}px`;
    root.replaceChildren(renderGroupBrackets(), ...model.blocks.flatMap(renderBlock), ...renderGroupLabels(), ...renderRelations());
    applyZoom();
  }

  function locateWord(id) {
    const block = model.blocks.find(item => item.words.some(word => word.id === id));
    return { block, word: block?.words.find(word => word.id === id) };
  }

  function focusWord(id) {
    [...root.querySelectorAll('.canvas-word')].find(button => button.dataset.tokenId === id)?.focus({ preventScroll: true });
  }

  root.addEventListener('click', event => {
    if (suppressClick) { suppressClick = false; return; }
    const button = event.target.closest('.canvas-word');
    if (button) onSelectWord(button.dataset.tokenId, event.shiftKey);
  });
  root.addEventListener('dblclick', event => {
    const button = event.target.closest('.canvas-word');
    if (button) onInspectWord(button.dataset.tokenId);
  });
  root.addEventListener('contextmenu', event => {
    const button = event.target.closest('.canvas-word');
    if (button) { event.preventDefault(); onInspectWord(button.dataset.tokenId); }
  });
  root.addEventListener('keydown', event => {
    const button = event.target.closest('.canvas-word');
    const deltas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!button || !deltas[event.key]) return;
    event.preventDefault();
    const { word } = locateWord(button.dataset.tokenId);
    const [dx, dy] = deltas[event.key];
    const step = event.shiftKey ? 4 : 1;
    onMoveWord(word.id, Math.max(0, word.column + dx * step), Math.max(0, Math.min(MAX_CANVAS_ROW, word.row + dy * step)));
  });

  root.addEventListener('pointerdown', event => {
    const button = event.target.closest('.canvas-word');
    if (!button || event.button !== 0) return;
    const rect = button.getBoundingClientRect();
    const { block, word } = locateWord(button.dataset.tokenId);
    drag = { button, block, word, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      grabX: (event.clientX - rect.left) / zoom, grabY: (event.clientY - rect.top) / zoom, active: false };
    button.setPointerCapture(event.pointerId);
  });

  root.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    event.preventDefault();
    if (!drag.active) {
      drag.active = true;
      drag.ghost = drag.button.cloneNode(true);
      drag.ghost.classList.add('drag-ghost');
      drag.ghost.setAttribute('aria-hidden', 'true');
      Object.assign(drag.ghost.style, { width: `${(drag.word.width * CELL - 4) * zoom}px`, height: `${WORD_HEIGHT * zoom}px`, fontSize: `${20 * zoom}px` });
      document.body.append(drag.ghost);
      drag.button.classList.add('is-dragging');
      drag.preview = el('div', { className: 'grid-preview' });
      root.append(drag.preview);
    }
    const bounds = viewport.getBoundingClientRect();
    if (event.clientX > bounds.right - 24) viewport.scrollLeft += 16;
    if (event.clientX < bounds.left + 24) viewport.scrollLeft -= 16;
    if (event.clientY > bounds.bottom - 24) viewport.scrollTop += 16;
    if (event.clientY < bounds.top + 24) viewport.scrollTop -= 16;
    const rect = root.getBoundingClientRect();
    const localY = (event.clientY - rect.top) / zoom;
    const hovered = model.blocks.find(block => block.kind === 'proposition' && localY >= block.top && localY < block.bottom);
    const targetBlock = drag.block.kind === 'source' && hovered ? hovered : drag.block;
    if (drag.targetBlock?.id !== targetBlock.id) {
      root.querySelector('.canvas-block.is-drop-target')?.classList.remove('is-drop-target');
      if (targetBlock.kind === 'proposition' && targetBlock.id !== drag.block.id) {
        root.querySelector(`.canvas-block[data-block-id="${CSS.escape(targetBlock.id)}"]`)?.classList.add('is-drop-target');
      }
    }
    drag.targetBlock = targetBlock;
    drag.column = Math.max(0, Math.min(model.presentation.columns - drag.word.width,
      Math.round(((event.clientX - rect.left) / zoom - drag.grabX - model.gutter) / CELL)));
    drag.row = Math.max(0, Math.min(MAX_CANVAS_ROW, Math.round((localY - drag.grabY - targetBlock.wordY) / ROW)));
    positionElement(drag.preview, model.gutter + drag.column * CELL, targetBlock.wordY + drag.row * ROW, drag.word.width * CELL - 4);
    drag.preview.style.height = `${WORD_HEIGHT}px`;
    Object.assign(drag.ghost.style, { left: `${event.clientX - drag.grabX * zoom}px`, top: `${event.clientY - drag.grabY * zoom}px` });
  });

  function finishDrag(commit) {
    if (!drag) return;
    const previous = drag;
    drag = null;
    root.querySelector('.canvas-block.is-drop-target')?.classList.remove('is-drop-target');
    previous.ghost?.remove(); previous.preview?.remove(); previous.button.classList.remove('is-dragging');
    if (previous.button.hasPointerCapture(previous.pointerId)) previous.button.releasePointerCapture(previous.pointerId);
    if (!previous.active) return;
    suppressClick = true;
    // Clear suppression after the pointer-generated click, including cancellation paths.
    setTimeout(() => { suppressClick = false; }, 0);
    if (commit) onMoveWord(previous.word.id, previous.column, previous.row,
      previous.targetBlock?.kind === 'proposition' ? previous.targetBlock.id : null);
  }
  root.addEventListener('pointerup', () => finishDrag(true));
  root.addEventListener('pointercancel', () => finishDrag(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') finishDrag(false); });
  new ResizeObserver(() => applyZoom()).observe(viewport);

  return { render, focusWord, getWidths: () => widths,
    updateSelection(selectedTokens) {
      state = { ...state, selectedTokens };
      for (const button of root.querySelectorAll('.canvas-word')) button.setAttribute('aria-pressed', String(selectedTokens.has(button.dataset.tokenId)));
    },
    setZoom(value) { zoom = value; applyZoom(); } };
}
