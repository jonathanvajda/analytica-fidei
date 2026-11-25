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
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.locator('.canvas-word').first().click();
  await page.getByRole('button', { name: 'Anchor connective', exact: true }).click();
  await expect(page.locator('#anchor-selection')).toContainText('Reason relationship');
  await page.locator('#anchor-function').selectOption('cause');
  await page.getByRole('button', { name: 'Add connective anchor' }).click();
  await expect(page.locator('.relation-anchor')).toContainText('cause');
  await page.getByRole('button', { name: 'Add relationship note' }).click();
  await page.locator('#note-category').selectOption('discourse');
  await page.locator('#note-text').fill('Supports the main inference');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.locator('.relation-note')).toContainText('Supports the main inference');
  await page.getByRole('button', { name: 'Edit relationship note' }).click();
  await page.locator('#note-text').fill('Explains the main inference');
  await page.getByRole('button', { name: 'Save note' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Test_analysis.json');
  await page.reload();
  await page.getByRole('button', { name: 'Test analysis', exact: true }).click();
  await expect(page.locator('.bracket')).toHaveCount(1);
  await expect(page.locator('.relation-chip')).toHaveText('Reason → P2');
  await expect(page.locator('.relation-anchor')).toContainText('cause');
  await expect(page.locator('.relation-note')).toContainText('Explains the main inference');
  await expect(page.locator('.relation-note')).toContainText('discourse');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.locator('#project-file').setInputFiles(await download.path());
  await expect(page.locator('#active-project-name')).toHaveText('Test analysis (imported)');
  await expect(page.locator('.bracket')).toHaveCount(1);
  await page.locator('.relation-chip').click();
  await expect(page.locator('.relation-edge')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove relationship note' }).click();
  await expect(page.locator('.relation-note')).toHaveCount(0);
  await page.getByRole('button', { name: /Remove relationship connective anchor/ }).click();
  await expect(page.locator('.relation-anchor')).toHaveCount(0);
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

test('a focused relationship can expand to trace its connected argument', async ({ page }) => {
  await createPracticeProject(page);
  await createProposition(page, 0, 2);
  await createProposition(page, 2, 4);
  await createProposition(page, 4, 6);
  await selectPropositions(page, [1, 2]);
  await page.getByRole('button', { name: 'Connect selected', exact: true }).click();
  await page.locator('#relation-type').selectOption('evidence');
  await page.getByRole('button', { name: 'Add relation', exact: true }).click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await selectPropositions(page, [2, 3]);
  await page.getByRole('button', { name: 'Connect selected', exact: true }).click();
  await page.locator('#relation-type').selectOption('reason');
  await page.getByRole('button', { name: 'Add relation', exact: true }).click();
  await expect(page.locator('.relation-edge')).toHaveCount(1);
  await page.getByRole('button', { name: 'Trace connected argument' }).click();
  await expect(page.locator('.relation-edge')).toHaveCount(2);
  await expect(page.locator('.canvas-block.is-focused')).toHaveCount(3);
  await expect(page.locator('.relation-chip.is-traced')).toHaveCount(2);
  await expect(page.locator('#feedback')).toContainText('3 propositions across 2 relationships');
  await page.getByRole('button', { name: 'Show focused relationship only' }).click();
  await expect(page.locator('.relation-edge')).toHaveCount(1);
});

test('groups can be selected, connected, and anchored as discourse units', async ({ page }) => {
  await createPracticeProject(page);
  await createProposition(page, 0, 2);
  await createProposition(page, 2, 4);
  await createProposition(page, 4, 6);
  await createProposition(page, 6, 8);
  await selectPropositions(page, [1, 2]);
  await applyGroup(page, 'Premises');
  await selectPropositions(page, [3, 4]);
  await applyGroup(page, 'Conclusion');
  await page.getByRole('checkbox', { name: 'Select group 1' }).check();
  await page.getByRole('checkbox', { name: 'Select group 2' }).check();
  await page.getByRole('button', { name: 'Connect selected', exact: true }).click();
  await expect(page.locator('#relation-from')).toHaveValue(/.+/);
  await page.locator('#relation-type').selectOption('evidence');
  await expect(page.locator('#relation-description')).toContainText('From = evidence; To = supported claim');
  await page.getByRole('button', { name: 'Add relation' }).click();
  await expect(page.locator('.relation-chip')).toContainText('Evidence → G2');
  await expect(page.locator('.relation-edge')).toHaveCount(1);
  await page.locator('.canvas-word').first().click();
  await page.getByRole('checkbox', { name: 'Select group 1' }).check();
  await page.getByRole('button', { name: 'Anchor connective' }).click();
  await expect(page.locator('#anchor-selection')).toContainText('discourse group G1');
  await page.locator('#anchor-function').selectOption('coordination');
  await page.getByRole('button', { name: 'Add connective anchor' }).click();
  await expect(page.locator('.group-badge').first()).toContainText('coordination');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'Preview Mermaid' }).click();
  await expect(page.locator('#mermaid-source')).toContainText('g1 -->|"Evidence"| g2');
  await expect(page.locator('#mermaid-source')).toContainText('(coordination)');
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
  await page.getByRole('button', { name: 'Edit group Discourse group' }).click();
  await page.locator('#group-label').fill('Main development');
  await page.getByRole('button', { name: 'Save group label' }).click();
  await expect(page.locator('.group-badge')).toContainText('Main development');
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
  await page.getByRole('button', { name: 'Add note to constituent renamed verb' }).click();
  await page.locator('#note-category').selectOption('grammatical');
  await page.locator('#note-text').fill('Understood predicate carried forward');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.getByRole('button', { name: 'Inspector', exact: true }).click();
  await expect(page.locator('.constituent-notes')).toContainText('Understood predicate carried forward');
  await expect(page.locator('.constituent-notes')).toContainText('grammatical');
  await page.getByRole('button', { name: 'Edit constituent note' }).click();
  await page.locator('#note-text').fill('Shared predicate carried forward');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.getByRole('button', { name: 'Remove implicit predicate renamed verb' }).click();
  await expect(page.locator('.semantic-badge.role.implicit')).toHaveCount(0);
  await expect(page.locator('.semantic-badge.role.explicit')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove explicit predicate renamed verb' }).click();
  await page.getByRole('button', { name: 'Inspector', exact: true }).click();
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

test('a modifier can target another constituent and change adjective function', async ({ page }) => {
  await createPracticeProject(page);
  await createProposition(page, 0, 3);
  await page.locator('.canvas-word').nth(0).click();
  await page.getByRole('checkbox', { name: 'Select proposition 1', exact: true }).check();
  await page.getByRole('button', { name: 'Assign role' }).click();
  await page.locator('#role-label').fill('good');
  await page.locator('#role-type').selectOption('modifier');
  await page.getByRole('button', { name: 'Save grammatical role' }).click();
  await page.locator('.canvas-word').nth(1).click();
  await page.getByRole('checkbox', { name: 'Select proposition 1', exact: true }).check();
  await page.getByRole('button', { name: 'Assign role' }).click();
  await page.locator('#role-label').fill('work');
  await page.locator('#role-type').selectOption('direct object');
  await page.getByRole('button', { name: 'Save grammatical role' }).click();
  await page.getByRole('checkbox', { name: 'Select proposition 1', exact: true }).check();
  await page.getByRole('button', { name: 'Analyze modifier' }).click();
  await page.locator('#modifier-constituent').selectOption({ label: 'good' });
  await page.locator('#modifier-function').selectOption('attributive');
  await page.locator('#modifier-target').selectOption({ label: 'work' });
  await page.getByRole('button', { name: 'Save modifier analysis' }).click();
  await expect(page.locator('.semantic-badge.dependency')).toContainText('attributive: good → work');
  await page.getByRole('button', { name: 'Edit modifier good' }).click();
  await page.locator('#modifier-function').selectOption('predicative');
  await page.getByRole('button', { name: 'Save modifier changes' }).click();
  await expect(page.locator('.semantic-badge.dependency')).toContainText('predicative: good → work');
  await page.getByRole('button', { name: 'Remove modifier good' }).click();
  await expect(page.locator('.semantic-badge.dependency')).toHaveCount(0);
});

test('a proposition note can be authored, revised, persisted, and removed', async ({ page }) => {
  await createPracticeProject(page);
  await createProposition(page, 0, 3);
  await page.getByRole('checkbox', { name: 'Select proposition 1', exact: true }).check();
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.locator('#note-category').selectOption('interpretive');
  await page.locator('#note-text').fill('The main assertion');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.locator('.semantic-badge.note')).toContainText('The main assertion');
  await expect(page.locator('.semantic-badge.note')).toContainText('interpretive');
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
  await expect(page.locator('#toggle-vowels')).toBeVisible();
  await expect(page.locator('#toggle-cantillation')).toBeVisible();
  await expect(word.locator('.word-surface')).toHaveText('בראשית');
});

test('Hebrew display controls stay hidden for non-Hebrew working texts', async ({ page }) => {
  await createPracticeProject(page, 'en');
  await expect(page.locator('#toggle-vowels')).toBeHidden();
  await expect(page.locator('#toggle-cantillation')).toBeHidden();
});

test('a supplied Hebrew written/read alternative is inspectable without replacing the source word', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#storage-status')).toContainText(/ready|unavailable/);
  await page.getByText('Practice texts & single-passage import', { exact: true }).click();
  await page.locator('#project-name').fill('Reading alternatives');
  const passage = { source: { sourceId: 'reading-fixture', version: '1', language: 'hbo', provenance: { providerId: 'fixture-provider' } }, unitKey: '1',
    records: [{ id: 'w1', text: 'הוא', readingAlternative: { written: 'הוא', read: 'היא', type: 'qere-ketiv' } }] };
  await page.locator('#passage-file').setInputFiles({ name: 'readings.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(passage)) });
  const word = page.locator('.canvas-word').first();
  await expect(word.locator('.word-surface')).toHaveText('הוא');
  await word.dblclick();
  const alternative = page.locator('.reading-alternative');
  await expect(alternative).toContainText('Written: הוא');
  await expect(alternative).toContainText('Read: היא');
  await expect(alternative).toContainText('qere-ketiv');
  await expect(alternative).toContainText('fixture-provider');
  await expect(word.locator('.word-surface')).toHaveText('הוא');
  await page.reload();
  await page.getByRole('button', { name: 'Reading alternatives', exact: true }).click();
  await expect(word.locator('.word-surface')).toHaveText('הוא');
  await word.dblclick();
  await expect(page.locator('.reading-alternative')).toContainText('Read: היא');
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

test('grammatical landmarks expose supplied finite verbs and connectives with redundant symbols', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#storage-status')).toContainText(/ready|unavailable/);
  const passage = { source: { sourceId: 'pos-fixture', version: '1', language: 'grc' }, unitKey: '1', text: 'λέγει οὖν λόγος',
    records: [{ text: 'λέγει', start: 0, end: 5, pos: 'finite verb' }, { text: 'οὖν', start: 6, end: 9, pos: 'conjunction' },
      { text: 'λόγος', start: 10, end: 15, pos: 'noun' }] };
  await page.getByText('Practice texts & single-passage import', { exact: true }).click();
  await page.locator('#project-name').fill('Landmark analysis');
  await page.locator('#passage-file').setInputFiles({ name: 'pos.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(passage)) });
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('button', { name: 'Show grammatical landmarks' })).toBeEnabled();
  await page.getByRole('button', { name: 'Show grammatical landmarks' }).click();
  await expect(page.locator('.word-landmark')).toHaveCount(3);
  await expect(page.locator('.word-landmark')).toHaveText(['V', '◇', 'N']);
  await expect(page.locator('.canvas-word').first()).toHaveAttribute('aria-label', /Finite verb/);
  await expect(page.locator('.landmark-finite-verb')).toHaveCSS('border-top-style', 'double');
  await expect(page.locator('.landmark-connective')).toHaveCSS('border-bottom-style', 'dashed');
  await page.getByLabel('Other parts of speech').uncheck();
  await expect(page.locator('.word-landmark')).toHaveText(['V', '◇']);
  await page.getByLabel('Connective cues').uncheck();
  await expect(page.locator('.word-landmark')).toHaveText(['V']);
  await page.getByText('Landmark legend', { exact: true }).click();
  await expect(page.locator('#landmark-legend-list')).toContainText('Finite verb');
  await page.reload();
  await page.getByRole('button', { name: 'Landmark analysis', exact: true }).click();
  await expect(page.locator('.word-landmark')).toHaveText(['V']);
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByLabel('Connective cues')).not.toBeChecked();
  await page.getByRole('button', { name: 'Hide grammatical landmarks' }).click();
  await expect(page.locator('.word-landmark')).toHaveCount(0);
});

test('a lexical connective proposal is visibly draft and pre-fills review', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#storage-status')).toContainText(/ready|unavailable/);
  const passage = { source: { sourceId: 'cue-fixture', version: '1', language: 'grc' }, unitKey: '1', text: 'οὖν λόγος',
    records: [{ text: 'οὖν', start: 0, end: 3 }, { text: 'λόγος', start: 4, end: 9 }] };
  await page.getByText('Practice texts & single-passage import', { exact: true }).click();
  await page.locator('#project-name').fill('Cue proposals');
  await page.locator('#passage-file').setInputFiles({ name: 'cues.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(passage)) });
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('button', { name: 'Show grammatical landmarks' }).click();
  await expect(page.locator('.word-landmark.proposed')).toHaveText('◇');
  await page.locator('.canvas-word').first().click();
  await page.getByRole('button', { name: 'Dismiss suggestion' }).click();
  await expect(page.locator('.word-landmark.proposed')).toHaveCount(0);
  await expect(page.locator('#feedback')).toContainText('suggestion dismissed');
  await page.getByRole('button', { name: 'Restore suggestion' }).click();
  await expect(page.locator('.word-landmark.proposed')).toHaveText('◇');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await createProposition(page, 0, 2);
  await page.locator('.canvas-word').first().click();
  await selectPropositions(page, [1]);
  await page.getByRole('button', { name: 'Anchor connective' }).click();
  await expect(page.locator('#anchor-suggestion')).toContainText('Draft suggestion: result');
  await expect(page.locator('#anchor-function')).toHaveValue('result');
  await page.getByRole('button', { name: 'Add connective anchor' }).click();
  await expect(page.locator('.semantic-badge.connective')).toContainText('result');
  await expect(page.locator('.word-landmark.accepted')).toHaveCount(1);
  await expect(page.locator('.word-landmark.proposed')).toHaveCount(0);
});

test('parsed-analysis proposals require review before changing the analysis', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#storage-status')).toContainText(/ready|unavailable/);
  const passage = { source: { sourceId: 'fixture', version: '1', language: 'en' }, unitKey: '1', text: 'Hear this',
    records: [{ id: 'w1', text: 'Hear', start: 0, end: 4 }, { id: 'w2', text: 'this', start: 5, end: 9 }] };
  await page.getByText('Practice texts & single-passage import', { exact: true }).click();
  await page.locator('#project-name').fill('Parsed review');
  await page.locator('#passage-file').setInputFiles({ name: 'passage.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(passage)) });
  const prefix = 'urn:linguistic:fixture:1:1:token:provider:';
  const dataset = { dataset: { id: 'parser', version: '2', language: 'en', sourceId: 'fixture' }, proposals: [
    { id: 'clause-1', type: 'clause', tokenIds: [`${prefix}w1`, `${prefix}w2`], data: { clauseType: 'independent' }, confidence: 0.9 },
    { id: 'verb-1', type: 'verbal-feature', tokenIds: [`${prefix}w1`], data: { finite: true } },
    { id: 'phrase-1', type: 'constituent', tokenIds: [`${prefix}w2`], data: { label: 'demonstrative phrase' } },
  ] };
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.locator('#proposal-file').setInputFiles({ name: 'parse.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(dataset)) });
  await expect(page.locator('#proposal-summary')).toHaveText('3 awaiting review · 0 accepted · 0 rejected');
  await expect(page.locator('.proposal-item')).toHaveCount(3);
  await expect(page.locator('.proposal-item').nth(1)).toContainText('Acceptance for this proposal type is not implemented yet');
  await page.locator('.proposal-item').nth(1).getByRole('button', { name: 'Reject' }).click();
  await expect(page.locator('#proposal-summary')).toHaveText('2 awaiting review · 0 accepted · 1 rejected');
  await page.getByRole('button', { name: 'Restore proposal' }).click();
  await expect(page.locator('#proposal-summary')).toHaveText('3 awaiting review · 0 accepted · 0 rejected');
  await page.getByRole('button', { name: 'Accept clause' }).click();
  await expect(page.locator('#proposal-summary')).toHaveText('2 awaiting review · 1 accepted · 0 rejected');
  await expect(page.locator('.canvas-block.proposition')).toHaveCount(1);
  await page.getByRole('button', { name: 'Accept constituent' }).click();
  await expect(page.locator('#proposal-summary')).toHaveText('1 awaiting review · 2 accepted · 0 rejected');
  await expect(page.locator('#constituent-library')).toContainText('demonstrative phrase');
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
