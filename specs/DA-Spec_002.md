# Analytica Fidei Completion and Data Acquisition Specification

## Document status

| Item | Specification |
| --- | --- |
| Status | Working completion roadmap and data-shopping specification, v0.1 |
| Date | 2026-11-25 |
| Parent specification | [DA-Spec_001.md](DA-Spec_001.md) |
| Purpose | Define practical completion targets and the datasets, licenses, identifiers, and mappings needed to reach them |
| Requirement authority | Existing UR identifiers and semantics in DA-Spec_001 remain authoritative |

This document does not replace `DA-Spec_001.md`. It converts that product vision into
an acquisition and delivery plan. Candidate datasets named here are leads, not approved
dependencies. A package is usable only after its exact release, contents, identifiers,
coverage, provenance, and legal terms have been reviewed.

## 1. Current position

Analytica Fidei is already a usable local-first manual discourse-analysis prototype.
It supports passage loading, proposition construction, correction of token assignment,
reusable explicit and implicit constituents, grammatical roles, modifier dependencies,
discourse groups and relationships, connective anchors, notes, undo/redo, large canvases,
landmark overlays, Hebrew-aware presentation, offline installation, and portable backups.

It also has the beginning of a human-reviewed automation pipeline. Identified parsed
datasets can enter the project as immutable, provenance-bearing proposals. Clause and
constituent proposals can be accepted; all proposal types can be rejected and restored.

Approximate completion depends on the release boundary:

| Release boundary | Approximate position | Meaning |
| --- | ---: | --- |
| Manual-analysis MVP | 75–85% | A user can complete a real analysis manually, but phrase layout, exports, and release hardening remain |
| Public beta | 55–65% | Requires robust datasets, complete proposal review, accessibility, migrations, and better long-analysis behavior |
| Full DA-Spec vision | 35–45% | Includes multilingual working editions, reviewed alignments, richer automation, and publication-quality exports |

These figures are planning estimates, not acceptance results. Completion is determined
by the gates below.

## 2. Proposed release boundaries

### 2.1 Release A — complete manual-analysis workbench

A user can perform a complete Fee-style sentence-flow and discourse analysis without
requiring an automatic parser.

Required outcomes:

1. Build, revise, group, and relate propositions without corrupting source text.
2. Build reusable phrases and grammatical roles, including implicit reuse.
3. Attach modifiers through a semantic snap preview and render accepted indentation.
4. Move a phrase or attached structure coherently while retaining manual offsets.
5. Collapse and reopen lengthy subordinate structures.
6. Complete primary workflows using keyboard as well as pointer/touch interaction.
7. Export a portable project plus stable SVG and PNG renderings.
8. Recover safely from invalid imports, unavailable storage, and older project versions.

### 2.2 Release B — data-assisted Greek analysis

The application can turn an identified Greek parse into a reviewable draft rather than
requiring the user to construct every clause and role manually.

Required outcomes:

1. Load Greek token metadata and syntax against the exact working-edition token IDs.
2. Propose clauses, constituents, roles, dependencies, verbal features, and connective cues.
3. Accept, edit, reject, restore, and visibly bulk-review compatible proposal sets.
4. Preserve provider, dataset, version, source record, confidence, and review status.
5. Leave unmapped, conflicting, or unsupported records unresolved and visible.
6. Never treat morphology, Strong’s identifiers, or spelling equality as proof of syntax.

### 2.3 Release C — English support and cross-edition assistance

An identified English edition can be a working text in its own right and can also appear
as a supporting display for Greek where a supplied alignment justifies the connection.

Required outcomes:

1. Select an English edition independently of Greek analysis.
2. Import English-specific token metadata or syntax without projecting Greek grammar.
3. Display Greek–English many-to-many span alignments with provenance and gaps.
4. Distinguish lexical gloss, translation text, and alignment assertions.
5. Preserve analysis identities and selection when switching supported views.

### 2.4 Release D — Hebrew and Aramaic analysis

Hebrew support includes identified source text, morphemes, morphology, alternate readings,
syntax where available, right-to-left interaction, and verified export—not only a font.

## 3. Data shopping list

Priority meanings in this section are acquisition priorities:

- **A0 — unlocks the next major release**
- **A1 — high-value enrichment**
- **A2 — later multilingual or scholarly depth**

### 3.1 Greek packages

| Priority | Package to obtain | Minimum required contents | Capabilities unlocked | Related URs |
| --- | --- | --- | --- | --- |
| A0 | Exact Greek working text release | Edition ID, release/version, canonical text, book/chapter/verse references, stable provider token IDs or a reproducible tokenizer | Stable analysis basis and dataset joining | UR-02, UR-03, UR-08, UR-14, UR-61, UR-66 |
| A0 | Greek token annotations | Exact token linkage, lemma, part of speech, morphology scheme and raw code, preferably lexical references; explicit missing values | Word inspection, finite-verb landmarks, morphology-aware rules | UR-11, UR-17, UR-43, UR-51, UR-52, UR-85 |
| A0 | Greek syntactic parse | Clause spans, constituent spans, subjects, predicates, objects, dependencies, coordination/subordination, verbal features, source record IDs | Draft sentence flow and grammatical proposal review | UR-15–21, UR-23–28, UR-52, UR-83 |
| A0 | Greek connective lexicon/rules | Form and preferably lemma; cue class; possible functions; construction/applicability conditions; exclusions; scope guidance; evidence/source | Draft connective and discourse-function cues | UR-17, UR-33, UR-82, UR-84, UR-85 |
| A1 | Greek lexical glosses | Token or lemma linkage, gloss language, sense limitations, provenance | Optional English gloss layer | UR-12, UR-43, UR-51, UR-62 |
| A1 | Strong’s or other lexical mappings | Explicit mapping assertion, namespace/version, ambiguity, provenance | Lexical lookup without using the reference as token identity | UR-11, UR-51, UR-66 |

The repository currently bundles an identified SBLGNT text release with deterministic
application tokenization, but its registry declares lemma, morphology, gloss, and Strong’s
coverage unavailable. Any Greek annotation or syntax package must therefore either use
the same provider tokens or include an explicit mapping to them.

### 3.2 English packages

| Priority | Package to obtain | Minimum required contents | Capabilities unlocked | Related URs |
| --- | --- | --- | --- | --- |
| A0 for Release C | Exact English/KJV-family text | Exact edition and revision, jurisdiction-aware rights statement, text, reference scheme, stable token IDs | English working analysis | UR-02, UR-03, UR-08, UR-14, UR-61, UR-66 |
| A1 | English token annotations | Lemmas where supplied, POS, morphology/features, punctuation policy, stable linkage | Landmarks and English-specific grammatical assistance | UR-11, UR-17, UR-43, UR-51, UR-52, UR-85 |
| A1 | English syntactic parse | Clauses, phrases, dependencies, roles, coordination, verbal features, provider record IDs | Draft English sentence-flow analysis | UR-15–21, UR-52, UR-83 |
| A1 | English connective lexicon/rules | Single- and multiword cues, functions, ambiguity, construction conditions, exclusions | Better cues for “therefore,” “because,” “in order that,” and similar expressions | UR-82, UR-84 |
| A1 | Greek–English alignment | Many-to-many ordered token spans, discontinuous spans, omissions/additions, confidence/review state, exact edition endpoints | Correspondence highlighting and supporting text | UR-49, UR-54, UR-62–65 |

An English translation is not a Greek gloss dataset. An English parse is not evidence for
Greek syntax unless an explicit alignment supports a separately reviewable suggestion.

### 3.3 Hebrew and Aramaic packages

| Priority | Package to obtain | Minimum required contents | Capabilities unlocked | Related URs |
| --- | --- | --- | --- | --- |
| A0 for Release D | Identified Hebrew Bible text | Exact edition/version, Hebrew and Aramaic language tagging, references, stable word IDs, unchanged pointed text | Hebrew/Aramaic working edition | UR-61, UR-66–71 |
| A0 for Release D | Morpheme segmentation | Ordered morphemes linked to complete source words; prefix/suffix identities; dataset normalization rules | Subword inspection without destroying word identity | UR-50, UR-67, UR-70 |
| A0 for Release D | Hebrew/Aramaic annotations | Lemma, POS, morphology codes and scheme, lexical references, per-assertion provenance | Inspection, landmarks, language-aware rules | UR-11, UR-17, UR-51, UR-52, UR-70, UR-85 |
| A0 for Release D | Reading alternatives | Qere/ketiv or comparable supplied alternatives, separate anchors and annotations | Honest alternate-reading inspection | UR-69 |
| A1 | Hebrew syntax | Clauses, constituents, dependencies, roles, verbal features, coordination, source record IDs | Reviewable Hebrew sentence-flow drafts | UR-15–21, UR-52, UR-83 |
| A1 | Hebrew connective rules | Form/lemma, construction conditions, functions, ambiguity and scope | Language-appropriate cue proposals | UR-82, UR-84 |
| A1 | Hebrew–English alignment | Exact edition endpoints, many-to-many spans, omissions, confidence and provenance | Supporting English display | UR-49, UR-62–65 |
| A2 | Greek–Hebrew reference/alignment resources | Explicit scope and mapping semantics; never inferred from verse equality alone | Carefully scoped cross-canonical comparison | UR-49, UR-63–65 |
| A1 | Hebrew-capable font package | Exact font files, version, license, redistribution and web-embedding permission | Reliable shaping and exports | UR-66, UR-71 |

WLC/OSHB-related sources are candidates identified in `DA-Spec_001.md`; selection and
redistribution are not approved merely by naming those projects. Text, morphology,
lemmas, syntax, and fonts may have different licenses and must be reviewed separately.

### 3.4 Reference, alignment, and display packages

| Priority | Package to obtain | Why it is separate |
| --- | --- | --- |
| A0 when multiple editions are enabled | Versification and reference mappings | Chapter/verse labels are not universal alignment identifiers; variants and splits require explicit mappings |
| A0 when supporting texts are enabled | Edition-pair alignment dataset | Alignment belongs to one exact source-edition pair and may be many-to-many or incomplete |
| A1 | Abbreviation and book-identity registry | Prevents UI labels from becoming canonical identities |
| A1 | Relation vocabulary documentation | Defines direction, participant roles, abbreviations, and export predicates |
| A1 | Export fonts and embedding rights | Browser display permission does not necessarily permit embedding in SVG/PNG or distributed packages |

## 4. Non-negotiable intake information

Every acquired package must answer all applicable questions below before integration.
“Unknown” is a valid intake answer but blocks capabilities that depend on it.

### 4.1 Identity and provenance

- Dataset name and provider
- Exact release, revision, commit, or archive checksum
- Download/source URL and acquisition date
- Language and exact edition or corpus analyzed
- Reference or versification scheme
- Provider documentation and schema
- Generation method, including whether assertions are manual, automatic, or reviewed

### 4.2 Legal record

- Copyright holder or public-domain basis
- Exact license name and full license text or authoritative URL
- Whether redistribution is permitted
- Whether modification and derived tokenization are permitted
- Attribution wording and placement requirements
- Share-alike, notice-file, or source-offer obligations
- Territory or jurisdiction limitations, where relevant
- Separate decisions for text, annotations, alignment, code, and fonts

An informal statement that a work is “free,” “open,” or “public domain” is not enough.
The repository should retain the evidence used for the decision.

### 4.3 Token identity and joining

- Stable provider word and morpheme IDs
- Token order and punctuation policy
- Exact character offsets where available
- Unicode and normalization policy
- Treatment of enclitics, crasis, elision, maqaf, prefixes, and punctuation
- A complete mapping to the chosen working edition when IDs differ
- Explicit unmapped, split, merged, reordered, omitted, and conflicting records

Strong’s numbers, lemmas, surface spelling, and verse numbers are not acceptable as the
sole token-joining key.

### 4.4 Annotation semantics

- Annotation type and controlled vocabulary
- Morphology/POS scheme name and version
- Raw provider value retained alongside any normalized value
- Meaning of null, absent, unknown, not applicable, and ambiguous
- Confidence or review status where supplied
- Source record or evidence reference
- Coverage declaration by book, passage, language, and annotation type

### 4.5 Syntax and proposal semantics

- Clause and constituent boundary representation
- Whether discontinuous constituents are supported
- Dependency direction and relation vocabulary
- Subject, predicate, object, complement, modifier, and coordination semantics
- Treatment of ellipsis and implicit arguments
- Verbal feature vocabulary
- Alternative parses or ambiguity representation
- How syntax records anchor to source tokens

## 5. Preferred acquisition packet

Each dataset should arrive with, or be wrapped by, a small manifest such as:

```json
{
  "datasetId": "provider-package-id",
  "version": "exact-release-or-checksum",
  "kind": "syntax",
  "language": "grc",
  "edition": {
    "sourceId": "sblgnt",
    "version": "exact-working-edition-version",
    "referenceScheme": "identified-scheme"
  },
  "files": [
    { "path": "data.json", "sha256": "...", "format": "provider-schema-v1" }
  ],
  "coverage": {
    "books": ["Eph"],
    "annotations": ["clause", "constituent", "role", "dependency"]
  },
  "license": {
    "name": "exact-license",
    "url": "https://example.invalid/license",
    "redistribution": "verified-or-unknown",
    "attribution": "required wording"
  },
  "provenance": {
    "provider": "provider name",
    "sourceUrl": "https://example.invalid/release",
    "acquired": "YYYY-MM-DD"
  }
}
```

The actual adapter may consume the provider’s native files. This manifest is the local
contract that makes the input reproducible and reviewable.

## 6. Dataset acceptance gates

A package moves through these gates independently:

| Gate | Pass condition |
| --- | --- |
| D0 — inventoried | Exact files, provider, version, checksum, schema, and claimed coverage recorded |
| D1 — legally reviewed | Rights and obligations recorded separately for every distributed resource kind |
| D2 — structurally validated | Files parse deterministically; required fields and controlled values are validated |
| D3 — token-aligned | Exact working-edition token mappings are complete or every gap/conflict is explicit |
| D4 — semantically mapped | Provider annotation meanings are mapped without discarding raw values or uncertainty |
| D5 — proposal-tested | Representative passages generate provenance-bearing drafts and no accepted assertions |
| D6 — review-tested | Users can accept, edit, reject, restore, and undo supported proposals |
| D7 — release-ready | Coverage reports, attribution UI, offline packaging, regression tests, and update strategy pass |

Failure at one gate does not require discarding the package. For example, a legally
redistributable text can be used without its incompatible syntax annotations, or a parse
can remain a user-supplied local import when redistribution permission is absent.

## 7. Recommended acquisition order

The shortest path to a dramatic improvement is:

1. **Greek syntax package aligned to the bundled SBLGNT release.** This immediately
   exercises the proposal adapter and supplies most of the initial sentence flow.
2. **Greek morphology/POS/lemma package using the same token identities.** This improves
   inspection, finite-verb detection, role validation, and connective applicability.
3. **A documented Greek connective rule set.** This improves high-regularity cue proposals
   without conflating cues with discourse relations.
4. **One exact English edition plus Greek–English span alignment.** This unlocks supporting
   text and correspondence while preserving Greek as the analysis basis.
5. **English syntax only if direct English analysis is a real target.** It should not block
   supporting-English display.
6. **Hebrew/Aramaic text and morphology bundle, then syntax and alignment.** This is a
   separate language milestone and should not inherit Greek rules.

A well-aligned Greek syntax dataset is more valuable to the near-term product than several
large but mutually incompatible lexical datasets.

## 8. Implementation work unlocked by acquired data

| Data readiness | Immediate implementation chunk |
| --- | --- |
| Greek syntax reaches D3 | Add provider adapter, coverage report, and proposal import by passage |
| Greek syntax reaches D5 | Accept/edit role, dependency, verbal-feature, and connective proposals |
| Greek morphology reaches D4 | Add scheme-specific POS and finite-verb decoders plus role validation |
| Greek connective rules reach D4 | Replace surface-form lookup with lemma/construction-aware proposals |
| English text reaches D3 | Add English edition registry entry and working-text selection |
| Greek–English alignment reaches D4 | Add parallel/supporting display and correspondence highlighting |
| Hebrew text/morphology reaches D4 | Add Hebrew edition, morpheme Inspector, language coverage, and qere/ketiv display |
| Any edition pair reaches D4 | Add honest mapping status, gaps, and view switching without identity loss |

## 9. Remaining application work independent of data

Datasets will accelerate automation, but they do not remove these engineering requirements:

1. Hierarchical phrase/head/clause snapping and confirmation.
2. Modifier indentation and coherent structure movement.
3. Collapsing long subordinate structures.
4. Keyboard-complete grouping, attachment, and review.
5. JSON-LD/Turtle, SVG, and PNG exports with layout parity.
6. Project schema migrations and dataset-update behavior.
7. Accessibility, monochrome, mobile, and large-passage performance review.
8. Attribution, coverage, license, and unavailable-capability UI.

## 10. Definition of “data ready for integration”

A dataset is ready when a developer can answer all of the following without guessing:

- Which exact edition and version does it annotate?
- Which stable IDs join every record to the working text?
- What does each field mean, including missing and ambiguous values?
- Which passages and annotation types are covered?
- Who produced it, how, and under which exact release?
- May the application redistribute it, modify it, cache it offline, and display attribution?
- What happens when the package updates and token IDs or analyses change?
- Can a user inspect the source record behind a proposal?
- Can unmapped and conflicting records remain explicit rather than being discarded?

If any answer is unavailable, record the gap in the intake manifest and limit the exposed
capability accordingly.

## 11. Immediate owner shopping checklist

For each candidate you already possess, collect:

- [ ] Original archive or repository URL
- [ ] Exact filename, release, commit, and checksum
- [ ] License file and any attribution instructions
- [ ] Provider schema or column documentation
- [ ] One small representative excerpt, preferably Ephesians 4:11–13
- [ ] Stable token IDs and their mapping to the intended working edition
- [ ] Declared language and versification/reference scheme
- [ ] Coverage statement
- [ ] Examples of clauses, subjects, predicates, objects, dependencies, and verbal features
- [ ] Examples of ambiguous, implicit, discontinuous, omitted, or conflicting analyses
- [ ] Update history or versioning policy
- [ ] Whether redistribution is allowed or the dataset must remain a user-local import

The representative excerpt should be supplied in its native format, not manually rewritten.
It will become the adapter fixture and acceptance test. Ephesians 4:11–13 is especially
useful because the existing Greek and English examples already expose coordination,
implicit reuse, phrase structure, and proposition chunking questions.

## 12. Next decisions

1. Decide whether Release B targets the bundled SBLGNT tokenization or replaces it with
   the syntax provider’s exact text/token package.
2. Identify the first Greek syntax and morphology candidates and complete D0–D2 intake.
3. Decide which exact English edition is desired: KJV, a particular KJV revision, or another
   redistributable translation.
4. Decide whether English is initially a supporting display, a full analysis basis, or both.
5. Decide whether Hebrew is part of the first public beta or a later independent milestone.
6. Separate locally importable datasets from datasets the hosted application may redistribute.

Once the first Greek package reaches D3, implementation should shift from generic sample
proposals to its real schema and coverage. That is the point at which the application can
begin to look substantially closer to the intended data-assisted workbench.
