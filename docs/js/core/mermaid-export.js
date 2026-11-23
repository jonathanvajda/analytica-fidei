import { adaptAnalysisPassage, buildAnalysisOutline } from './project.js';

function escapeLabel(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\s+/g, ' ').trim();
}

/** Export the ordered semantic analysis as portable Mermaid flowchart source. */
export function createAnalysisMermaid(project) {
  const unit = adaptAnalysisPassage(project.passage);
  const tokens = new Map(unit.tokens.map(token => [token.id, token.text]));
  const aliases = new Map(project.propositions.map((proposition, index) => [proposition.id, `p${index + 1}`]));
  const lines = ['flowchart TD', '  %% Semantic export; freeform canvas coordinates are intentionally omitted.'];
  let groupNumber = 0;
  function writeNodes(nodes, depth = 1) {
    for (const node of nodes) {
      const indent = '  '.repeat(depth);
      if (node.children) {
        lines.push(`${indent}subgraph g${++groupNumber}["${escapeLabel(node.label || 'Discourse group')}"]`);
        lines.push(`${indent}  direction TB`);
        writeNodes(node.children, depth + 1);
        lines.push(`${indent}end`);
      } else {
        const number = project.propositions.findIndex(item => item.id === node.id) + 1;
        const text = node.tokenIds.map(tokenId => tokens.get(tokenId) ?? '').filter(Boolean).join(' ');
        lines.push(`${indent}${aliases.get(node.id)}["P${number}: ${escapeLabel(text)}"]`);
      }
    }
  }
  writeNodes(buildAnalysisOutline(project));
  for (const relation of project.relations) lines.push(`  ${aliases.get(relation.from)} -->|"${escapeLabel(relation.label)}"| ${aliases.get(relation.to)}`);
  return `${lines.join('\n')}\n`;
}
