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

0. **Parsed-analysis proposal ingestion (UR-15–21, UR-52, UR-83, UR-84):** inventory
   the user's Greek and possible KJV parsed datasets, licenses, versions, token IDs,
   annotation schemes, and coverage. Define an adapter contract that emits immutable,
   provenance-bearing draft proposals for clauses, constituents, grammatical roles,
   dependencies, verbal features, and connective cues. Add accept/reject/edit and
   reversible bulk-review commands before any imported parse can become accepted
   analysis. Greek and KJV parses remain edition-specific; projection requires an
   explicit supplied alignment. Build connective lexicons as language-specific,
   versioned rules with applicability conditions, not unconditional string lookup.

1. **Reusable constituent refinement (UR-23, UR-24, UR-28, UR-81):** basic
   inspector authoring is implemented: selected source words define a canonical
   constituent with an explicit role, and that identity can be reused implicitly in
   other propositions. Role assertions are independently removable, and the
   inspector library can rename a canonical constituent or delete it once no roles
   reference it. Next, add role-specific validation, multiword phrase structure,
   and dependency targets.
2. **Connective-anchor refinement (UR-82):** basic inspector authoring and removal
   are implemented for propositions, discourse groups, and focused relationships.
   All are non-exclusive source-token cues and do not determine relationship type.
   A first UR-84 suggestion slice now uses a versioned Greek/English connective
   lexicon to mark matches explicitly as draft, explain them in the Inspector, and
   pre-fill (but never auto-submit) the anchor review form. Accepted anchors replace
   their draft styling without creating or determining a discourse relationship.
   False positives can be dismissed, persist as provenance-specific rejected reviews,
   and be restored or undone. Next, add lemma-aware and multiword rules,
   applicability conditions, and freeform/extended functions.
3. **Relationship vocabulary completion (UR-33, UR-57):** extend the initial UI
   vocabulary with migration rules and RDF predicates. The controlled selector,
   accessible definitions, explicit From/To participant roles, reversal guidance,
   and stable-ID editing of type and endpoints are implemented.
4. **Grammatical-note refinement (UR-30):** basic word-anchored and
   proposition-anchored notes are implemented through the validated command/history
   path. Stable-ID text editing is implemented for both targets. Next, add
   provenance when automated or imported annotations are introduced. Controlled
   categories and word-, proposition-, constituent-, and relationship-targeted notes
   are implemented with stable-ID editing and lifecycle cleanup.

5. **Segment relationships (UR-55):** discourse groups are selectable semantic
   endpoints alongside propositions. Mixed proposition/group and group/group edges
   participate in editing, tracing, deletion cleanup, backup restore, and Mermaid
   export while ordered group membership remains a separate property.

6. **Modifier dependencies (UR-25, UR-26):** reusable constituents can participate
   in validated proposition-scoped modifier-to-target dependencies. General,
   attributive, predicative, and substantive adjective functions are editable;
   dependent role/constituent deletion is blocked until the assertion is removed.

7. **Grammatical landmark overlay (UR-11, UR-17, UR-43, UR-51, UR-84, UR-85):**
   add optional, independently selectable visual layers for supplied/proposed parts
   of speech, finite predicates, and connective cues. Define language/profile-specific
   class mappings and coverage states. Use redundant color plus glyph/pattern/label
   encoding, an accessible legend, dark/monochrome testing, and no mutation of source
   tokens or accepted grammatical roles.
   The first slice is implemented for explicit supplied POS values and accepted
   connective anchors, with a persistent toggle, coverage message, accessible names,
   redundant glyph/pattern styling, a legend, coverage counts, and independently
   selectable finite-verb, connective, and other-POS layers. Morphology-scheme
   decoders and finer-grained POS filters remain future work.

8. **Hierarchical semantic snapping (UR-22–26, UR-40, UR-42, UR-58, UR-78, UR-86):**
   extend the current token grid into word-to-phrase, phrase-to-head, and
   phrase-to-clause snap targets. Preview the proposed constituent membership,
   dependency target, role/function, and resulting indentation before confirmation.
   Render accepted modifiers beneath and offset from their heads with subtle shared
   containment/alignment feedback; retain free manual placement and never infer a
   dependency from coordinates alone. Add coherent parent/child movement and keyboard
   equivalents after the underlying nested layout constraints are stable.

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
(manual grammatical, proposition, relation, history, notes, and canvas editing), UR-11/51
(supplied annotations and explicit missing-data display), the reusable-constituent
authoring foundation for UR-81, basic connective-anchor authoring for UR-82, and the contiguous/laminar
constraints of UR-72–76. Model support without an authoring UI is not counted as a
complete requirement.

UR-38 now has a connected-argument inspection mode. Starting from a focused
relationship, it highlights all propositions and semantic edges in that connected
component without mutating the graph or primary bracket outline.

UR-37/74 group labels can be revised through the validated history path without
recreating the stable group or changing its ordered membership and nesting.

UR-48 has a persistent explicit light/dark theme covering the current interactive
workbench. Publication/export theme consistency remains future work under UR-59.
UR-43 has an initial optional lexical-gloss canvas layer. It renders only supplied
gloss annotations with their declared language, explicitly disables itself when
coverage is absent, and remains presentation state rather than analysis data. Other
annotation layers and export parity remain future work.
UR-68 has independent, persistent Hebrew vowel-point and cantillation display
filters. Filtering occurs only at measurement/render time over canonical token text;
source strings, identities, selections, and analysis assertions are unchanged.
UR-06 has an installable web-app manifest and a versioned service worker. Installation
pre-caches the application module graph, edition registry, and complete bundled
SBLGNT text; same-origin assets encountered later are refreshed online and retained
for offline fallback. IndexedDB analysis persistence remains independent of the cache.
UR-05's RDF export and other full-spec acceptance gates are not complete.

## Specification provenance

`DA-Spec_001.md` and `DA-Spec_000.md` were copied unchanged from the user's Discourse
Analysis directory on 2026-11-18. They are source requirements, not executable
instructions. Future specification edits should occur here to avoid divergence.
