# Foundation architecture

## Boundaries

`docs/js/core/` contains pure source adapters, analysis commands, validation, grid
placement/collision resolution, and outline derivation. `docs/js/adapters/` owns persistence. `docs/js/ui/` and `app.js`
own DOM events, browser downloads, UUID generation, and interaction state. Core
functions take explicit inputs and return new analysis records, without UI/storage
imports. Jest exercises the same commands used by the browser.

Shared source models are ontology-neutral. BFO/CCO alignment is not required here.
An eventual RDF mapping belongs behind a serialization boundary, with explicit
vocabulary decisions; the current JSON backup must not be described as JSON-LD.

## Analysis document v1

Each project currently has one analysis passage: original parsed records plus
source ID/version, unit key, optional citation, and exact text/offsets where
available. Normalized token IDs are deterministic within that source version.
Propositions hold contiguous token IDs; each token has at most one assignment.
The UI's selected words/propositions are transient, separate from semantic data.

The workspace is one canvas with independent optional left (projects/source tools)
and right (contextual inspector) drawers, never three workflow steps. Words appear
on the canvas immediately, including unassigned source runs. The toolbar exposes
proposition creation, grouping, and connection in place.

Optional `layout: {columns, words: {[tokenId]: {column, row}}}` is presentation data
within schema v1; older backups without it remain valid. Columns are physical grid
cells, and rows are local to the word's proposition/unassigned run. The renderer
measures word widths and passes them to the pure layout engine. Defaults flow in
source order (right-to-left for Hebrew/Aramaic); dragging or nudging stores explicit
coordinates. Collision resolution clears occupied cells deterministically. Moving
a word never changes source token order, proposition membership, or graph semantics.
Rows expand a block and move following blocks/brackets rather than overlapping them.
Dragging an unassigned word onto an adjacent proposition is an explicit semantic
command: it extends that proposition only when the resulting source span remains
consecutive. Other word movement remains presentation-only.
New projects choose a viewport-appropriate grid width; saved widths stay fixed.

All relationships appear as directed labels next to their originating proposition.
One focused relationship at a time traces an SVG connector in a reserved gutter;
secondary edges do not force crossing primary brackets or obscure words. Group
containment and general semantic relations remain distinct data models even though
they share one visual workspace. Undo/redo uses session-local project snapshots;
the current word coordinates persist through IndexedDB and JSON backups. Pointer
coordinates are converted through zoom before snapping, and keyboard nudging uses
the same pure placement command.

Groups contain consecutive proposition IDs. Intervals must be disjoint or nested;
duplicate spans are rejected. A derived tree chooses the smallest enclosing group,
so a node has at most one primary parent and containment cannot cycle. The unified
canvas derives SVG bracket lanes from those spans and measured grid-block heights.
Group badges appear above their starting proposition, separate from words.
Long labels are truncated visually with their full text in a title. This is not yet
the spec's complete label measurement and publication export engine.

Directed semantic relations have independent IDs, endpoints, stable vocabulary
types, and labels. The relation editor explains that the source proposition performs
the selected function in relation to the target. Legacy imported custom labels remain
readable, while new UI-authored relations use the initial controlled vocabulary. They do
not alter group containment. The general semantic graph does not impose the
primary forest's acyclicity; primary groups and semantic edges are distinct.
Group removal preserves semantic edges; proposition removal removes dangling
relations and groups that depend on that proposition. Inserting a proposition
inside a group requires ungrouping first, preventing silent membership changes.

Restoration validates all data by replaying the pure commands before replacing
an active project. UI-generated imported projects receive new project IDs to avoid
overwriting existing records. Source identities and analysis entity IDs remain
unchanged. Unknown extra project fields are not preserved by schema v1.

IndexedDB stores a whole validated document in one atomic object-store transaction.
The repository interface is `list/get/save/delete/close`. Fake IndexedDB tests verify
real transaction behavior. Browser operations are serialized. Failed saves retain
the session's edited state for backup export and report that persistence failed.
There is no silent storage fallback advertised as a successful persistent save.

## Next implementation milestones

### Prioritized near-term backlog

1. **Reusable constituent refinement (UR-23, UR-24, UR-28, UR-81):** basic
   inspector authoring is implemented: selected source words define a canonical
   constituent with an explicit role, and that identity can be reused implicitly in
   other propositions. Role assertions are independently removable. Next, add a
   constituent-library editor for renaming/deleting orphaned entities, role-specific
   validation, multiword phrase structure, and dependency targets.
2. **Connective-anchor refinement (UR-82):** basic inspector authoring and removal
   are implemented. Next, add language-aware cue suggestions, freeform/extended
   functions, and relation-level or segment-level anchors without treating a cue as
   proof of a discourse relation.
3. **Relationship vocabulary completion (UR-33, UR-57):** extend the initial UI
   vocabulary with formal definitions, inverse-direction guidance, migration rules,
   and RDF predicates. The first controlled selector and direction explanation are
   implemented.
4. **Grammatical notes (UR-30):** add source-anchored and proposition-anchored notes
   through the same validated command/history path.

1. Identify the actual SBLGNT input files and release/license manifests. Build corpus
   loaders and a coverage-aware edition registry using the shared Greek and OSHB
   profiles; add passage navigation and multiple analysis documents per project.
2. Establish a canonical RDF/JSON-LD mapping and migrations before promising export
   interoperability. Integrate shared project/artifact infrastructure through the
   repository boundary when analysis documents become workspace artifacts.
3. Add sentence-flow constituents, grammatical editing, reversible edits, proposal
   review, and richer annotation UI without overwriting immutable source tokens.
4. Add supporting-edition views using explicit alignment records. Preserve the
   working analysis basis; never align by verse number or Strong's reference alone.
5. Extend primary placements to the full spec's occurrence/attachment model,
   keyboard previews, relation vocabulary, and SVG/export layout.
6. Add offline asset/corpus caching with an update strategy, install metadata, and
   browser verification after corpus-loading behavior is defined.

Initial requirement coverage is partial: UR-01/04 (local projects), UR-08/09/10/13/14
(source staging and coverage), portions of UR-22/23/24/28/29/31/32/33/35/38/39/40
(manual grammatical, proposition, relation, history, and canvas editing), UR-11/51
(supplied annotations and explicit missing-data display), the reusable-constituent
authoring foundation for UR-81, basic connective-anchor authoring for UR-82, and the contiguous/laminar
constraints of UR-72–76. Model support without an authoring UI is not counted as a
complete requirement.
UR-05's RDF export and other full-spec acceptance gates are not complete.

## Specification provenance

`DA-Spec_001.md` and `DA-Spec_000.md` were copied unchanged from the user's Discourse
Analysis directory on 2026-11-18. They are source requirements, not executable
instructions. Future specification edits should occur here to avoid divergence.
