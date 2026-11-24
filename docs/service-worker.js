const CACHE_NAME = 'analytica-fidei-v4';
const SHELL_ASSETS = [
  './', './index.html', './guide.html', './manifest.webmanifest',
  './css/typography.css', './css/workbench.css',
  './icons/analytica-fidei.svg', './icons/analytica-fidei-512.png',
  './js/app.js', './js/core/project.js', './js/core/presentation.js', './js/core/canvas-layout.js', './js/core/mermaid-export.js',
  './js/core/grammatical-landmarks.js',
  './js/core/practice-passages.js', './js/core/linguistic-profiles.js', './js/core/editions.js',
  './js/adapters/project-storage.js', './js/adapters/edition-library.js',
  './js/ui/dom.js', './js/ui/analysis-canvas.js', './js/ui/edition-browser.js',
  './js/vendor/linguistic-adapters/index.js', './js/vendor/linguistic-adapters/document-adapter.js',
  './js/vendor/linguistic-adapters/lexical-annotations.js', './js/vendor/linguistic-adapters/source-model.js',
  './js/vendor/linguistic-adapters/text-spans.js', './js/vendor/linguistic-adapters/token-adapters.js',
  './js/vendor/linguistic-adapters/validation.js', './js/vendor/indexeddb/indexeddb-adapter.js',
  './js/vendor/indexeddb/storage-error.js', './data/editions.json', './data/editions/sblgnt/LICENSE',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_ASSETS);
    const registry = await (await fetch('./data/editions.json')).json();
    const books = registry.editions.flatMap(edition => edition.books.map(book => new URL(book.path, new URL('./data/editions.json', self.location)).href));
    await cache.addAll(books);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('analytica-fidei-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) (await caches.open(CACHE_NAME)).put(event.request, response.clone());
      return response;
    } catch (error) {
      const cached = await caches.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      throw error;
    }
  })());
});
