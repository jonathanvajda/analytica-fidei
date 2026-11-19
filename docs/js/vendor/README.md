# Shared source snapshots

Copied from the local reasonlynx checkout on 2026-11-18:

- `packages/linguistic-adapters/src/*.js`: complete headless linguistic module source.
- `packages/indexeddb-data-management/src/indexeddb-adapter.js` and `storage-error.js`:
  the low-level storage boundary only. Broader workspace/RDF dependencies are not bundled.

The linguistic package was newly scaffolded in that checkout and may not yet have
an upstream commit. `manifest.json` records the exact content hashes and original
paths; these are snapshots, not an npm release. Distribution licensing for these
shared codebases still needs an explicit repository-level decision before public
release. No Bible dataset or third-party font is bundled.

Update shared behavior in reasonlynx first, recopy its source, regenerate the
manifest, and run both repositories' tests. Do not import `C:/GitHub/...` paths at
runtime or assume adjacent repositories exist on GitHub Pages. The linguistic
README's relative source examples refer to its original package layout.
