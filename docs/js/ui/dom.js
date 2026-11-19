/** Create elements with textContent only: imported text is always data, never markup. */
export function createUiElement(tag, { text, className, ...attributes } = {}, children = []) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  element.append(...children);
  return element;
}

/** Download a portable JSON backup; browser effects live outside the analysis core. */
export function downloadProjectBackup(project) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
  const link = createUiElement('a', { href: url, download: `${project.name.replace(/[^\p{L}\p{N}_-]/gu, '_') || 'analysis'}.json` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
