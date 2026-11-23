# Analytica Fidei — Biblical Discourse Analysis

An initial local-first workbench for the [Biblical Discourse Analysis specification](specs/DA-Spec_001.md). The name plays on the *analogia fidei* of Romans 12:6: biblical interpretation according to the proportion of faith, with Scripture interpreting Scripture.
The app is buildless: GitHub Pages serves `docs/` directly. Specifications live in
`specs/`, outside the published site; JavaScript and CSS live under `docs/js/` and
`docs/css/`.

## Run and verify

Requires a modern Node.js with `Intl.Segmenter` (CI uses Node 22).

```sh
npm ci
npm start
# Open http://127.0.0.1:4173
npm test
npx playwright install chromium
npm run test:browser
```

Use HTTP, not `file://`, for browser ES modules. Configure GitHub Pages to deploy
from your chosen branch's `/docs` directory. All runtime URLs are relative so a
repository subpath works. No bundler, CDN, font download, or server API is required.
The CI workflow runs tests; it does not publish the repository.

## First usable slice

- Create practice projects or import versioned, parsed passage records.
- Arrange words directly on a snapping grid, with pointer/touch dragging, keyboard
  nudging, zoom, and undo/redo. The canvas occupies the main workspace; projects
  and contextual details live in optional left/right drawers, not workflow steps.
- Assign consecutive source tokens to propositions without rewriting source text.
- Show propositions, non-crossing brackets, and directed relationship labels in
  one canvas. Focus a relationship to trace its connector in a reserved gutter.
- Inspect supplied lexical annotations, save to IndexedDB, and export/import JSON.

Practice texts are synthetic, not Bible editions. See the [user/import guide](docs/guide.html)
and [architecture and implementation plan](specs/architecture.md). The full product
spec is a target, not a list of completed features. This iteration does not include
RDF export, automatic analysis, corpus ingestion, or an installable offline PWA.

## Shared packages

The shared linguistic adapters and low-level IndexedDB utilities from reasonlynx
are vendored under `docs/js/vendor/`. This makes the static site self-contained
and keeps headless code reusable in DocxHund. See [vendor provenance](docs/js/vendor/README.md)
and its SHA-256 manifest before updating snapshots. Application code imports their
public modules rather than editing shared behavior locally.
