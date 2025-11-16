const CACHE_NAME = 'brauna-prof-v2'; 
const FILES_TO_CACHE = [
    '/', 
    'index.html', 
    'manifest.json', 
    'icon-192.png', 
    'icon-512.png', 
    'icon-64.png', 
    // ESTES SÃO OS ARQUIVOS QUE FALTAVAM NO SEU CACHE:
    'assets/style.css', 
    'assets/main.js',
    // Caching das bibliotecas externas
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://apis.google.com/js/api.js',
    'https://accounts.google.com/gsi/client'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', evt => evt.waitUntil(self.clients.claim()));

self.addEventListener('fetch', evt => {
  if (evt.request.mode === 'navigate') {
    evt.respondWith(fetch(evt.request).catch(()=>caches.match('index.html')));
    return;
  }
  evt.respondWith(caches.match(evt.request).then(resp => resp || fetch(evt.request)));
});
