const CACHE_NAME = 'notes-alarme-complet-v16';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './alarm.mp3',
  './icon-192.png',
  './icon-512.png'
];

const MOBILE_FOLDER_CSS = `
@media (max-width:650px) {
  .mobile-folder-bar {
    position:fixed !important;
    top:max(7px, env(safe-area-inset-top)) !important;
    right:151px !important;
    width:39px !important;
    height:39px !important;
    padding:0 !important;
    margin:0 !important;
    background:transparent !important;
    border:0 !important;
    z-index:500 !important;
  }
  .mobile-folder-btn {
    width:39px !important;
    min-width:39px !important;
    height:39px !important;
    min-height:39px !important;
    padding:0 !important;
    margin:0 !important;
    border:0 !important;
    border-radius:12px !important;
    background:var(--card-bg) !important;
    color:var(--text) !important;
    display:grid !important;
    place-items:center !important;
    font-size:1rem !important;
  }
  .mobile-folder-btn span:first-child {
    display:block !important;
    font-size:1rem !important;
    line-height:1 !important;
  }
  .mobile-folder-btn span:first-child::first-letter { font-size:1rem; }
  .mobile-folder-btn span:last-child { display:none !important; }
  .sidebar {
    position:fixed !important;
    top:56px !important;
    right:10px !important;
    left:auto !important;
    width:min(260px,calc(100vw - 20px)) !important;
    max-height:min(65dvh,440px) !important;
    z-index:600 !important;
  }
  .mobile-folder-bar + .sidebar { top:56px !important; }
}
`;

async function addMobileFolderCss(response) {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;
    const html = await response.text();
    if (html.includes('mobile-folder-position-fix')) return new Response(html, response);
    const patched = html.replace('</head>', `<style id="mobile-folder-position-fix">${MOBILE_FOLDER_CSS}</style></head>`);
    return new Response(patched, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (error) {
    return response;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cache) => cache !== CACHE_NAME ? caches.delete(cache) : undefined)
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse
          ? addMobileFolderCss(cachedResponse)
          : fetch(event.request).then(addMobileFolderCss);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
