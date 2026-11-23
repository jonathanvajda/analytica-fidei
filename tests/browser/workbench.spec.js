import { test, expect } from '@playwright/test';

async function createPracticeProject(page, language = 'en') {
  await page.goto('./');
  await expect(page.locator('#storage-status')).toContainText(/ready|unavailable/);
  await page.getByText('Practice texts & single-passage import', { exact: true }).click();
  await page.locator('#project-name').fill('Test analysis');
  await page.locator('#sample-language').selectOption(language);
  await page.getByRole('button', { name: 'Create practice project' }).click();
  await expect(page.locator('#feedback')).toContainText('Practice project created');
}

async function createProposition(page, start, end) {
  for (let index = start; index < end; index += 1) await page.locator('.canvas-word').nth(index).click();
  await page.getByRole('button', { name: 'Create proposition', exact: true }).click();
  await expect(page.locator('#feedback')).toContainText('Proposition created');
}

async function selectPropositions(page, numbers) {
  for (const number of numbers) await page.getByRole('checkbox', { name: `Select proposition ${number}`, exact: true }).check();
}

async function applyGroup(page, label = '') {
  await page.getByRole('button', { name: 'Group selected', exact: true }).click();
  await page.locator('#group-label').fill(label);
  await page.getByRole('button', { name: 'Apply group', exact: true }).click();
}

async function dragWord(page, token, dx, dy) {
  const box = await token.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('#feedback')).toContainText('Word placed');
}

test('one large canvas contains propositions, brackets, and directed relationships', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await createPracticeProject(page);
  await expect(page.locator('#project-drawer')).toBeHidden();
  await expect(page.locator('#context-drawer')).toBeHidden();
  const viewport = await page.locator('#canvas-viewport').boundingBox();
  const windowSize = page.viewportSize();
  expect(viewport.width * viewport.height / (windowSize.width * windowSize.height)).toBeGreaterThan(0.6);
  await createProposition(page, 0, 3);
  await createProposition(page, 3, 6);
  await selectPropositions(page, [1, 2]);
  await applyGroup(page, 'Response');
  await expect(page.locator('.bracket')).toHaveCount(1);
  await selectPropositions(page, [1, 2]);
  await page.getByRole('button', { name: 'Connect selected', exact: true }).click();
  await page.locator('#relation-type').selectOption('evidence');
  await expect(page.locator('#relation-description')).toContainText('supplies evidence');
  await page.getByText('Relationship legend', { exact: true }).click();
  await expect(page.locator('#relation-legend-list')).toContainText('Purpose');
  await page.getByRole('button', { name: 'Add relation', exact: true }).click();
  await expect(page.locator('.relation-chip')).toHaveText('Evidence → P2');
  await expect(page.locator('.relation-edge')).toHaveCount(1);
  await expect(page.locator('#context-drawer')).toBeHidden();
  await page.getByRole('button', { name: 'Edit focused relation' }).click();
  await page.locator('#relation-type').selectOption('reason');
  await page.getByRole('button', { name: 'Save relationship' }).click();
  await expect(page.locator('.relation-chip')).toHaveText('Reason → P2');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Test_analysis.json');
  await page.reload();
  await page.getByRole('button', { name: 'Test analysis', exact: true }).click();
  await expect(page.locator('.bracket')).toHaveCount(1);
  await expect(page.locator('.relation-chip')).toHaveText('Reason → P2');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.locator('#project-file').setInputFiles(await download.path());
  await expect(page.locator('#active-project-name')).toHaveText('Test analysis (imported)');
  await expect(page.locator('.bracket')).toHaveCount(1);
  await page.locator('.relation-chip').click();
  await expect(page.locator('.relation-edge')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('integrated-canvas.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('project data tools preview and download a Mermaid semantic flowchart', async ({ page }) => {
  await createPracticeProject(page);
  await createProposition(page, 0, 3);
  await createProposition(page, 3, 6);
  await selectPropositions(page, [1, 2]);
  await page.getByRole('button', { name: 'Connect selected', exact: true }).click();
  await page.locator('#relation-type').selectOption('evidence');
  await page.getByRole('button', { name: 'Add relation', exact: true }).click();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Preview Mermaid' }).click();
  await expect(page.locator('#mermaid-source')).toContainText('flowchart TD');
  await expect(page.locator('#mermaid-source')).toContainText('Evidence');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Mermaid' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('Test_analysis_analysis.mmd');
});

test('crossing groups are rejected while nested groups stay in the same canvas', async ({ page }) => {
  await createPracticeProject(page);
  await createProposition(page, 0, 3);
  await createProposition(page, 3, 6);
  await createProposition(page, 6, 10);
  await createProposition(page, 10, 13);
  await selectPropositions(page, [1, 2, 3]);
  await applyGroup(page);
  await expect(page.locator('.bracket')).toHaveCount(1);
  await selectPropositions(page, [2, 3, 4]);
  await applyGroup(page);
  await expect(page.locator('#feedback')).toContainText('cross an existing bracket');
  await expect(page.locator('.bracket')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close group editor' }).click();
  await page.getByRole('checkbox', { name: 'Select proposition 4', exact: true }).uncheck();
  await applyGroup(page);
  await expect(page.locator('.bracket')).toHaveCount(2);
  await expect(page.locator('.proposition')).toHaveCount(4);
});

test('dragging snaps a word into a grid cell, persists it, and supports undo/redo', async ({ page }, testInfo) => {
  await createPracticeProject(page);
  const word = page.locator('.canvas-word').first();
  await dragWord(page, word, 120, 52);
  await expect(word).toHaveAttribute('data-column', '5');
  await expect(word).toHaveAttribute('data-row', '1');
  await expect(page.locator('#selection-count')).toHaveText('Select words or propositions on the canvas');
  await page.getByRole('button', { name: 'Undo last edit' }).click();
  await expect(word).toHaveAttribute('data-column', '0');
  await expect(word).toHaveAttribute('data-row', '0');
  await page.getByRole('button', { name: 'Redo last edit' }).click();
  await expect(word).toHaveAttribute('data-column', '5');
  await page.reload();
  await page.getByRole('button', { name: 'Test analysis', exact: true }).click();
  await expect(word).toHaveAttribute('data-column', '5');
  await expect(word).toHaveAttribute('data-row', '1');
  await page.screenshot({ path: testInfo.outputPath('arranged-words.png'), fullPage: true });
});

test('canvas fills the viewport and can grow into horizontally scrollable space', async ({ page }) => {
  await createPracticeProject(page);
  const viewport = page.locator('#canvas-viewport');
  const canvas = page.locator('#analysis-canvas');
  const before = await viewport.evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  const canvasWidth = await canvas.evaluate(element => element.getBoundingClientRect().width);
  expect(canvasWidth).toBeGreaterThanOrEqual(before.clientWidth - 1);
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await page.getByRole('button', { name: 'Widen canvas', exact: true }).click();
  await expect(page.locator('#feedback')).toContainText('Scroll horizontally');
  const after = await viewport.evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(after.scrollWidth).toBeGreaterThan(before.scrollWidth);
  expect(after.scrollWidth).toBeGreaterThan(after.clientWidth);
  await page.getByRole('button', { name: 'Fit canvas to view', exact: true }).click();
  await expect(page.locator('#feedback')).toContainText('Canvas fit');
  await expect.poll(() => viewport.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await expect(page.locator('#canvas-zoom')).toHaveValue(/0\./);
  await page.reload();
  await page.getByRole('button', { name: 'Test analysis', exact: true }).click();
  await expect.poll(() => viewport.evaluate(element => element.scrollWidth)).toBe(after.scrollWidth);
});

test('dark theme covers the workbench and persists across reload', async ({ page }) => {
  await createPracticeProject(page);
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Light theme', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const colors = await page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor,
    canvas: getComputedStyle(document.querySelector('#analysis-canvas')).backgroundColor,
    word: getComputedStyle(document.querySelector('.canvas-word')).backgroundColor }));
  expect(new Set(Object.values(colors)).size).toBeGreaterThan(1);
  expect(Object.values(colors).every(color => !['rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)'].includes(color))).toBe(true);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Test analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Light theme', exact: true })).toBeVisible();
});

test('installed workbench and bundled edition remain usable offline', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.locator('#edition-select')).toBeEnabled();
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('.brand-name')).toContainText('Analytica Fidei');
    await expect(page.locator('#edition-select')).toBeEnabled();
    await expect(page.locator('#book-select')).toHaveValue('Matt');
    await page.getByRole('button', { name: 'Start discourse analysis', exact: true }).click();
    await expect(page.locator('#passage-reference')).toContainText('Matthew 1:1');
    await expect(page.locator('.canvas-word').first()).toBeVisible();
  } finally { await context.setOffline(false); }
});

test('a selected word can be authored and removed as a connective proposition anchor', async ({ page }) => {
  await createPracticeProject(page);
  await createProposition(page, 0, 3);
  await page.locator('.canvas-word').nth(3).click();
  await page.getByRole('checkbox', { name: 'Select proposition 1', exact: true }).check();
  await page.getByRole('button', { name: 'Anchor connective', exact: true }).click();
  await page.locator('#anchor-function').selectOption('contrast');
  await page.getByRole('button', { name: 'Add connective anchor', exact: true }).click();
  await expect(page.locator('#feedback')).toContainText('without asserting a discourse relationship');
  await expect(page.locator('.semantic-badge.connective')).toContainText('contrast');
  await expect(page.locator('#assignment-summary')).toContainText('0 relationships');
  await page.getByRole('button', { name: /Remove connective anchor/ }).click();
  await expect(page.locator('.semantic-badge.connective')).toHaveCount(0);
  await expect(page.locator('#feedback')).toContainText('Connective anchor removed');
});

test('an explicit verb can be defined once and reused implicitly in another proposition', async ({ page }) => {
  await createPracticeProject(page);
  await createProposition(page, 0, 3);
  await createProposition(page, 3, 6);
  await page.locator('.canvas-word').first().click();
  await page.getByRole('checkbox', { name: 'Select proposition 1', exact: true }).check();
  await page.getByRole('button', { name: 'Assign role', exact: true }).click();
  await page.locator('#role-label').fill('shared verb');
  await page.locator('#role-type').selectOption('predicate');
  await page.getByRole('button', { name: 'Save grammatical role', exact: true }).click();
  await expect(page.locator('#feedback')).toContainText('Explicit grammatical constituent');
  await expect(page.locator('.semantic-badge.role.explicit')).toContainText('predicate: shared verb');

  await page.getByRole('checkbox', { name: 'Select proposition 2', exact: true }).check();
  await page.getByRole('button', { name: 'Assign role', exact: true }).click();
  await page.locator('#role-type').selectOption('predicate');
  await expect(page.locator('#role-realization')).toHaveValue('implicit');
  await page.getByRole('button', { name: 'Save grammatical role', exact: true }).click();
  await expect(page.locator('#feedback')).toContainText('Reusable constituent assigned');
  await expect(page.locator('.semantic-badge.role.implicit')).toContainText('predicate: shared verb');
  await page.getByRole('button', { name: 'Inspector', exact: true }).click();
  await expect(page.locator('.constituent-item')).toContainText('2 uses');
  page.once('dialog', dialog => dialog.accept('renamed verb'));
  await page.getByRole('button', { name: 'Rename constituent shared verb' }).click();
  await expect(page.locator('.semantic-badge.role.explicit')).toContainText('predicate: renamed verb');
  await expect(page.locator('.semantic-badge.role.implicit')).toContainText('predicate: renamed verb');
  await expect(page.getByRole('button', { name: 'Delete constituent renamed verb' })).toBeDisabled();
  await page.getByRole('button', { name: 'Remove implicit predicate renamed verb' }).click();
  await expect(page.locator('.semantic-badge.role.implicit')).toHaveCount(0);
  await expect(page.locator('.semantic-badge.role.explicit')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove explicit predicate renamed verb' }).click();
  await page.getByRole('button', { name: 'Delete constituent renamed verb' }).click();
  await expect(page.locator('#constituent-library')).toBeHidden();
});

test('role and connective actions remain visible when enabled on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await createPracticeProject(page);
  await createProposition(page, 0, 3);
  await page.locator('.canvas-word').first().click();
  await page.getByRole('checkbox', { name: 'Select proposition 1', exact: true }).check();
  await expect(page.locator('#selection-count')).toContainText('1 word · 1 proposition selected');
  await expect(page.getByRole('button', { name: 'Assign role', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assign role', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Anchor connective', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anchor connective', exact: true })).toBeEnabled();
});

test('a proposition note can be authored, revised, persisted, and removed', async ({ page }) => {
  await createPracticeProject(page);
  await createProposition(page, 0, 3);
  await page.getByRole('checkbox', { name: 'Select proposition 1', exact: true }).check();
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.locator('#note-text').fill('The main assertion');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.locator('.semantic-badge.note')).toContainText('The main assertion');
  await page.getByRole('button', { name: 'Edit proposition note' }).click();
  await expect(page.locator('#note-text')).toHaveValue('The main assertion');
  await page.locator('#note-text').fill('The revised assertion');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.locator('.semantic-badge.note')).toContainText('The revised assertion');
  await page.reload();
  await page.getByRole('button', { name: 'Test analysis', exact: true }).click();
  await expect(page.locator('.semantic-badge.note')).toContainText('The revised assertion');
  await page.getByRole('button', { name: 'Remove proposition note' }).click();
  await expect(page.locator('.semantic-badge.note')).toHaveCount(0);
});

test('dragging an adjacent missed source word into a proposition assigns it', async ({ page }) => {
  await createPracticeProject(page);
  await createProposition(page, 1, 4);
  const missed = page.locator('.canvas-word').first();
  await expect(missed).toHaveAttribute('aria-label', /unassigned/);
  const sourceBox = await missed.boundingBox();
  const propositionBox = await page.locator('.proposition').boundingBox();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(propositionBox.x + propositionBox.width / 2, propositionBox.y + propositionBox.height / 2, { steps: 12 });
  await expect(page.locator('.proposition')).toHaveClass(/is-drop-target/);
  await page.mouse.up();
  await expect(page.locator('#feedback')).toContainText('Missed word added');
  await expect(missed).toHaveAttribute('aria-label', /proposition 1/);
  await expect(page.locator('#assignment-summary')).toContainText('4/');
  await page.getByRole('button', { name: 'Undo last edit' }).click();
  await expect(missed).toHaveAttribute('aria-label', /unassigned/);
});

test('an edge word can be dragged out of a proposition or returned with the toolbar', async ({ page }) => {
  await createPracticeProject(page);
  await createProposition(page, 0, 3);
  const edge = page.locator('.canvas-word').first();
  const edgeBox = await edge.boundingBox();
  const sourceBox = await page.locator('.source-block').boundingBox();
  await page.mouse.move(edgeBox.x + edgeBox.width / 2, edgeBox.y + edgeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2, { steps: 12 });
  await expect(page.locator('.source-block')).toHaveClass(/is-drop-target/);
  await page.mouse.up();
  await expect(page.locator('#feedback')).toContainText('returned to unassigned source');
  await expect(edge).toHaveAttribute('aria-label', /unassigned/);
  await expect(page.locator('#assignment-summary')).toContainText('2/');

  const remainingEdge = page.locator('.canvas-word').nth(1);
  await remainingEdge.click();
  await expect(page.getByRole('button', { name: 'Return to source', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Return to source', exact: true }).click();
  await expect(page.locator('#assignment-summary')).toContainText('1/');
});

test('drag coordinates respect zoom and keyboard nudges use the same grid', async ({ page }) => {
  await createPracticeProject(page);
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await page.locator('#canvas-zoom').selectOption('1.25');
  const word = page.locator('.canvas-word').first();
  await dragWord(page, word, 90, 65);
  await expect(word).toHaveAttribute('data-column', '3');
  await expect(word).toHaveAttribute('data-row', '1');
  await word.focus(); await word.press('ArrowRight');
  await expect(word).toHaveAttribute('data-column', '4');
  await word.press('ArrowDown');
  await expect(word).toHaveAttribute('data-row', '2');
});

test('range selection and optional inspector do not require a step workflow', async ({ page }) => {
  await createPracticeProject(page, 'grc');
  await page.locator('.canvas-word').first().click();
  await page.locator('.canvas-word').nth(2).click({ modifiers: ['Shift'] });
  await expect(page.locator('#selection-count')).toHaveText('3 words selected');
  await page.getByRole('button', { name: 'Create proposition', exact: true }).click();
  await expect(page.locator('.proposition')).toHaveCount(1);
  await page.locator('.canvas-word').first().dblclick();
  await expect(page.locator('#word-details')).toContainText('No lexical annotations supplied');
  await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
  await page.locator('.canvas-word').first().click();
  await expect(page.locator('#context-drawer')).toBeVisible();
  await expect(page.locator('#word-details')).toContainText('No lexical annotations supplied');
  await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
  await expect(page.locator('#context-drawer')).toBeHidden();
});

test('Hebrew uses RTL word flow on mobile and canvas scrolling stays inside its viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createPracticeProject(page, 'hbo');
  const word = page.locator('.canvas-word').first();
  await expect(word).toHaveText('הַמּוֹרֶה');
  await expect(word).toHaveAttribute('lang', 'hbo');
  const firstColumn = Number(await word.getAttribute('data-column'));
  expect(firstColumn).toBeGreaterThan(Number(await page.locator('.canvas-word').nth(1).getAttribute('data-column')));
  await word.click();
  await page.getByRole('button', { name: 'Create proposition', exact: true }).click();
  await expect(page.locator('.proposition')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('hebrew-mobile.png'), fullPage: true });
});

test('Hebrew vowel and cantillation display filters preserve the source token', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#storage-status')).toContainText(/ready|unavailable/);
  await page.getByText('Practice texts & single-passage import', { exact: true }).click();
  await page.locator('#project-name').fill('Hebrew marks');
  const pointed = 'בְּרֵאשִׁ֖ית';
  const passage = { source: { sourceId: 'hebrew-fixture', version: '1', language: 'hbo' }, unitKey: 'Gen.1.1', records: [{ text: pointed }] };
  await page.locator('#passage-file').setInputFiles({ name: 'hebrew.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(passage)) });
  const word = page.locator('.canvas-word').first();
  await expect(page.getByRole('button', { name: 'Hide vowels', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Hide cantillation', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Hide cantillation', exact: true }).click();
  await expect(word.locator('.word-surface')).not.toContainText('\u0596');
  await expect(word).toHaveAttribute('aria-label', new RegExp(pointed));
  await page.getByRole('button', { name: 'Hide vowels', exact: true }).click();
  await expect(word.locator('.word-surface')).toHaveText('בראשית');
  await page.reload();
  await page.getByRole('button', { name: 'Hebrew marks', exact: true }).click();
  await expect(word.locator('.word-surface')).toHaveText('בראשית');
});

test('supplied lexical glosses form a persistent optional canvas layer', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#storage-status')).toContainText(/ready|unavailable/);
  const passage = { source: { sourceId: 'gloss-fixture', version: '1', language: 'grc' }, unitKey: 'John.1.1',
    glossLanguage: 'en', text: 'λόγος', records: [{ text: 'λόγος', start: 0, end: 5, gloss: 'word' }] };
  await page.getByText('Practice texts & single-passage import', { exact: true }).click();
  await page.locator('#project-name').fill('Gloss analysis');
  await page.locator('#passage-file').setInputFiles({ name: 'gloss.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(passage)) });
  await expect(page.getByRole('button', { name: 'Show glosses', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Show glosses', exact: true }).click();
  await expect(page.locator('.word-gloss')).toHaveText('word');
  await expect(page.locator('.word-gloss')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: 'Hide glosses', exact: true }).click();
  await expect(page.locator('.word-gloss')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show glosses', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Gloss analysis', exact: true }).click();
  await expect(page.locator('.word-gloss')).toHaveText('word');
});

test('invalid imports preserve the active analysis and imported markup is text', async ({ page }) => {
  await createPracticeProject(page);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.locator('#project-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":9}') });
  await expect(page.locator('#feedback')).toContainText('Unsupported project format');
  await expect(page.locator('#active-project-name')).toHaveText('Test analysis');
  const passage = { source: { sourceId: 'test', version: '1', language: 'en' }, unitKey: 'x', records: [{ text: '<img src=x onerror=alert(1)>' }] };
  await page.locator('#passage-file').setInputFiles({ name: 'text.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(passage)) });
  await expect(page.locator('.canvas-word')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#analysis-canvas img')).toHaveCount(0);
});

test('storage unavailable is visible while the canvas remains editable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined }));
  await createPracticeProject(page);
  await expect(page.locator('#storage-status')).toContainText('Session only');
  await createProposition(page, 0, 3);
  await expect(page.locator('.proposition')).toHaveCount(1);
  await expect(page.locator('#storage-status')).toContainText('export before leaving');
});

test('touch dragging snaps directly without scrolling the word out from under the finger', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await createPracticeProject(page);
    const word = page.locator('.canvas-word').first();
    const box = await word.boundingBox();
    const session = await context.newCDPSession(page);
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (let step = 1; step <= 6; step += 1) await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: start.x + 48 * step / 6, y: start.y + 52 * step / 6 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(word).toHaveAttribute('data-column', '2');
    await expect(word).toHaveAttribute('data-row', '1');
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
  } finally { await context.close(); }
});

test('Escape cancels a drag preview without storing new positions', async ({ page }) => {
  await createPracticeProject(page);
  const word = page.locator('.canvas-word').first();
  const box = await word.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 67, { steps: 5 });
  await expect(page.locator('.grid-preview')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.grid-preview')).toHaveCount(0);
  await expect(word).toHaveAttribute('data-column', '0');
  await expect(word).toHaveAttribute('data-row', '0');
  await expect(page.getByRole('button', { name: 'Undo last edit' })).toBeDisabled();
});
