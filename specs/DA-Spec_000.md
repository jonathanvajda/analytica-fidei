Perhaps the app automatically puts together the obvious sentence flow/ diagram (matching or similar to his convention) together, but the user can adapt it on the fly. Where things are under-determined, the elements remain available to be slotted. Like, every flow has a subject predicate, and then there are special rules when adjectives are substantive or qualitative, when participles are taking adverbial vs substantive forms, etc. These can be bubbles that get arranged

After that, there would need to be some special handling of proposition-to-proposition relations like dependence, purpose, cause and effect, etc.

I am imagining a canvas that a user effectively has a Bible verse to bring in (staging). Then the use can drag the verse onto the canvas, and it auto-structures what it can deterministically. The original verse is displayed in original word order in a bubble, with the words that are slotted already de-emphasized (e.g., dark grey text on light gray background; or vice-versa in dark mode) while the words that need to be slotted are bold and high contrast (e.g., black on white, or vice versa in dark mode).

As for the language, I want to assume someone will be working in SBL GNT. I have a fulltext access to it in JSON. I might also have every verse tagged as to its parts of speech (let me get back to that). However, I imagine that users would want to be able to toggle features like
- Language helpers: English gloss (or KJV translation of the term) like an interlinear.
- Parts of speech notation: indicate that the particular word plays a role in a sentence
- Color coding: words, word phrases (prepositional phrases, etc.)

A settings hamburger could allow someone to make these choices.

The thing I am having a harder time doing, at this point, is coming up with a very user-friendly, modern style that allows someone to use a large canvas for potentially long passages of scripture. A lot of words can be overwhelming on the screen.

I think unless you recommend otherwise, I'd want to design the app as a single page PWA with: banner + main content as 3 panel + footer.
- Left panel (drawer?): project management, verse selection and injection, saving/exporting/loading.
- Middle panel: canvas split between staged material (top), diagrammed/analyzed material (center)
- Right panel (drawer?): options (click on a word, what annotations and properties are relevant or may be added; click on a sentence blob, what annotations, relations, properties are relevant or may be added).

I think right-panel could replaced by a context menu that appears to the bottom-right of the object, upon selecting an object. Is there a good tradeoff to balance? I am thinking that a long proposition may need horizontal space that the right panel might be taking up needlessly.

I don't know what visual library would be most conducive to this, that would look easy on the eyes and modern. I think I don't want to use Mermaid or Cytoscape for the visual. Visual compaction, word order, snapping fit-- these are all critical to help the user be organized. We can also take advantage of placement on the screen as being semantic--> if an adjective is put under (and offset slightly to the right) some subject or object, then it modifies that subject or object. Merely exporting into Mermaid syntax might be enough (and that the user could preview that export?)

The advantages to this app over MS Word, is that Word
- can't capture and export the implicit semantics of placement,
- has no good way to diagram propositions to propositions (usually a student or pastor literally prints off the page and draws the connection on paper),
- involves a huge potential for user-error to keep styling consistent,
- cannot export into RDF
- cannot export into Mermaid
- cannot read/retrieve the semantics of placement from another

The advantages of this app over Mermaid Live or some other public Mermaid tool is, that Mermaid:
- Has no relations (edges) predefined
- Has no in-built way to handle a blob of text that needs to be manipulated into different nodes and edges
- Has no native ability to constrain visual placement of nodes (renderers are deterministic-- the user cannot force an object to be placed in exactly one spot).


I already have a codebase that supports JSON-LD, TTL, Mermaid. Assume that we need minimal adapters.

I also already have a codebase that has Strong's numbers for each term. Assume that we need minimal adapters.

I already have a codebase that supports the creation of projects in IndexedDB. Assume that we need minimal adapters.

Could we write out a software specification that distinguishes user requirements, technical capabilities, and UI expectations?