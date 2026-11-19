import { createUiElement as el } from './dom.js';
import { getEditionKey } from '../adapters/edition-library.js';
import { selectEditionPassage } from '../core/editions.js';

/** Wire optional source-drawer tools; never replace an analysis until loading succeeds.
 * @param {object} options Injected library and explicit browser-effect callbacks.
 * @returns {{refresh:function(string=):void}} Catalog selection refresh.
 */
export function createEditionBrowser({ library, onOpenPassage, onImportCorpus, onError }) {
  const $ = selector => document.querySelector(selector);
  const editionSelect = $('#edition-select');
  const bookSelect = $('#book-select');
  const chapterSelect = $('#chapter-select');
  const startSelect = $('#verse-start');
  const endSelect = $('#verse-end');
  const button = $('#open-edition-passage');
  const currentEdition = () => library.list().find(edition => getEditionKey(edition) === editionSelect.value);
  const currentBook = () => currentEdition()?.books.find(book => book.id === bookSelect.value);
  const currentChapter = () => currentBook()?.chapters.find(chapter => chapter.number === Number(chapterSelect.value));

  function setOptions(select, options) {
    select.replaceChildren(...options.map(([value, text]) => el('option', { value, text })));
    select.disabled = !options.length;
  }

  function refreshVerseEnd() {
    const start = Number(startSelect.value);
    setOptions(endSelect, (currentChapter()?.verses ?? []).filter(verse => verse >= start && verse < start + 25).map(verse => [verse, verse]));
    button.disabled = !endSelect.options.length;
  }

  function refreshChapter() {
    setOptions(startSelect, (currentChapter()?.verses ?? []).map(verse => [verse, verse]));
    refreshVerseEnd();
  }

  function refreshBook() {
    setOptions(chapterSelect, (currentBook()?.chapters ?? []).map(chapter => [chapter.number, chapter.number]));
    refreshChapter();
  }

  function refreshEdition() {
    const edition = currentEdition();
    setOptions(bookSelect, (edition?.books ?? []).map(book => [book.id, book.name]));
    $('#edition-information').replaceChildren(...(edition ? [
      el('p', { text: `${edition.title} · ${edition.source.language}` }),
      el('p', { text: `Source version: ${edition.source.version}` }),
      el('p', { text: `Reference scheme: ${edition.source.referenceScheme}` }),
      el('p', { text: edition.capabilities?.morphology === false
        ? 'Text only. Lemmas, morphology, glosses, and Strong’s references are not supplied by this package.'
        : 'Annotations are shown only where supplied by the imported records.' }),
      ...edition.resources.map(resource => el('p', { text: `${resource.kind} · ${resource.license} · ${resource.attribution}` })),
    ] : []));
    $('#edition-status').textContent = edition ? `${edition.books.length} books available. Choose a range within one chapter (up to 25 verses).` : 'No edition is available. You can import a corpus or use a practice text.';
    refreshBook();
  }

  function refresh(preferredKey) {
    const previous = preferredKey ?? editionSelect.value;
    setOptions(editionSelect, library.list().map(edition => [getEditionKey(edition), `${edition.title} (${edition.source.language})`]));
    if ([...editionSelect.options].some(option => option.value === previous)) editionSelect.value = previous;
    refreshEdition();
  }

  editionSelect.addEventListener('change', refreshEdition);
  bookSelect.addEventListener('change', refreshBook);
  chapterSelect.addEventListener('change', refreshChapter);
  startSelect.addEventListener('change', refreshVerseEnd);
  $('#edition-browser').addEventListener('submit', async event => {
    event.preventDefault();
    const edition = currentEdition();
    if (!edition || button.disabled) return;
    const range = { chapter: Number(chapterSelect.value), start: Number(startSelect.value), end: Number(endSelect.value) };
    const bookId = bookSelect.value;
    const name = $('#analysis-name').value.trim();
    button.disabled = true;
    $('#edition-status').textContent = 'Loading source text…';
    try {
      const book = await library.loadBook(getEditionKey(edition), bookId);
      const passage = selectEditionPassage(edition, book, range);
      await onOpenPassage(passage, name || `${passage.reference.display} · ${edition.title}`);
      $('#edition-status').textContent = 'Passage opened as a separate analysis.';
    } catch (error) { $('#edition-status').textContent = error.message; onError(error); }
    finally { button.disabled = false; }
  });
  $('#edition-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const corpus = await onImportCorpus(JSON.parse(await file.text()));
      refresh(getEditionKey(corpus.edition));
      $('#edition-status').textContent = 'Edition imported. Choose a passage to start an analysis.';
    } catch (error) { onError(error); }
    finally { event.target.value = ''; }
  });
  refresh();
  return { refresh };
}
