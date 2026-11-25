import { computeAnalysisCanvas, CANVAS_CELL_WIDTH, CANVAS_ROW_HEIGHT } from './canvas-layout.js';

function xml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function endpointY(model, id) {
  const group = model.groups.find(item => item.id === id);
  if (group) return (group.top + group.bottom) / 2;
  const block = model.blocks.find(item => item.id === id);
  if (!block) throw new Error('SVG relationship endpoint is not present in the resolved layout.');
  return block.wordY + 19;
}

/** Generate a standalone vector diagram from semantic state and resolved grid layout. */
export function createAnalysisSvg(project, { tokenWidths = {} } = {}) {
  const model = computeAnalysisCanvas(project, { tokenWidths });
  const rtl = /^(hbo|he|arc)(-|$)/i.test(model.unit.source.language);
  const propositionNumber = id => project.propositions.findIndex(item => item.id === id) + 1;
  const groupNumber = id => project.groups.findIndex(item => item.id === id) + 1;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${model.width}" height="${model.height}" viewBox="0 0 ${model.width} ${model.height}" role="img" aria-labelledby="title description">`,
    `<title id="title">${xml(project.name)} discourse analysis</title>`,
    `<desc id="description">Vector export of ${xml(model.unit.reference?.display ?? model.unit.unitKey)} with ${project.propositions.length} propositions, ${project.groups.length} groups, and ${project.relations.length} relationships.</desc>`,
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#9a641f"/></marker></defs>',
    '<style>.background{fill:#fff}.block{fill:none;stroke:#e1e8e2}.heading{font:600 11px system-ui,sans-serif;fill:#49665b}.word-box{fill:#fffef9;stroke:#b8c8bb}.word{font:20px Georgia,"Times New Roman",serif;fill:#263c36}.group{fill:none;stroke:#65876e;stroke-width:1.6}.group-label{font:600 11px system-ui,sans-serif;fill:#315f52}.relation{fill:none;stroke:#9a641f;stroke-width:2;stroke-dasharray:5 3}.relation-label{font:600 10px system-ui,sans-serif;fill:#704715}.source{font:600 10px system-ui,sans-serif;fill:#71857a;text-transform:uppercase}</style>',
    `<rect class="background" width="${model.width}" height="${model.height}"/>`,
  ];
  for (const block of model.blocks) {
    lines.push(`<rect class="block" x="0" y="${block.top}" width="${model.width}" height="${block.bottom - block.top}"/>`);
    lines.push(block.kind === 'proposition'
      ? `<text class="heading" x="${model.gutter}" y="${block.headingY + 10}">P${propositionNumber(block.id)}</text>`
      : `<text class="source" x="${model.gutter}" y="${block.headingY + 10}">Source</text>`);
    for (const word of block.words) {
      const x = model.gutter + word.column * CANVAS_CELL_WIDTH;
      const y = block.wordY + word.row * CANVAS_ROW_HEIGHT;
      const width = word.width * CANVAS_CELL_WIDTH - 4;
      lines.push(`<g data-token-id="${xml(word.id)}"><rect class="word-box" x="${x}" y="${y}" width="${width}" height="38" rx="4"/>`,
        `<text class="word" x="${x + width / 2}" y="${y + 26}" text-anchor="middle" lang="${xml(word.language)}" direction="${rtl ? 'rtl' : 'ltr'}" unicode-bidi="plaintext">${xml(word.text)}</text></g>`);
    }
  }
  for (const group of model.groups) {
    lines.push(`<path class="group" data-group-id="${xml(group.id)}" d="M ${model.gutter - 52} ${group.top} H ${group.x + 8} Q ${group.x} ${group.top} ${group.x} ${group.top + 8} V ${group.bottom - 8} Q ${group.x} ${group.bottom} ${group.x + 8} ${group.bottom} H ${model.gutter - 52}"/>`,
      `<text class="group-label" x="${model.gutter}" y="${group.top - 3}">G${groupNumber(group.id)}: ${xml(group.label || 'Discourse group')}</text>`);
  }
  project.relations.forEach((relation, index) => {
    const fromY = endpointY(model, relation.from);
    const toY = endpointY(model, relation.to);
    const lane = Math.max(8, model.gutter - 42 - index * 10);
    const x = model.gutter - 16;
    lines.push(`<path class="relation" data-relation-id="${xml(relation.id)}" marker-end="url(#arrow)" d="M ${x} ${fromY} H ${lane} V ${toY} H ${x}"/>`,
      `<text class="relation-label" x="${model.gutter + 8}" y="${Math.min(fromY, toY) + 14}">${xml(relation.label)}</text>`);
  });
  lines.push('</svg>');
  return `${lines.join('\n')}\n`;
}
