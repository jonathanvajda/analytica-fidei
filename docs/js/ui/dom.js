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
  downloadTextFile(JSON.stringify(project, null, 2), `${safeFileStem(project.name)}.json`, 'application/json');
}

export function safeFileStem(name) {
  return String(name).replace(/[^\p{L}\p{N}_-]/gu, '_') || 'analysis';
}

export function downloadTextFile(text, filename, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = createUiElement('a', { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
