const CACHE_NAME = 'notes-alarme-complet-v13';
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

const UI_PATCH_CSS = `
/* Stable Android layout: the notes list gets an explicit viewport-sized scroll area. */
.app-shell {
  height:100dvh !important;
  min-height:0 !important;
  overflow:hidden !important;
}
.workspace {
  min-height:0 !important;
  height:auto !important;
  flex:1 1 auto !important;
  overflow:hidden !important;
}
.content-area {
  min-width:0 !important;
  min-height:0 !important;
  height:auto !important;
  flex:1 1 auto !important;
  overflow:hidden !important;
  display:flex !important;
  flex-direction:column !important;
}
.content-header { flex:0 0 auto !important; }
.tag-bar { flex:0 0 auto !important; }
.notes-grid {
  min-width:0 !important;
  min-height:0 !important;
  flex:0 0 auto !important;
  overflow-x:hidden !important;
  overflow-y:auto !important;
  -webkit-overflow-scrolling:touch !important;
  overscroll-behavior:contain !important;
  touch-action:pan-y !important;
  align-content:start !important;
  scrollbar-width:thin !important;
  padding-bottom:max(30px, env(safe-area-inset-bottom)) !important;
}

/* Keep the requested compact title/tags presentation when tagBar is a sibling. */
.content-header { min-width:0; }
.content-header > div:first-child { min-width:0; }
.content-header > div:first-child #viewTitle { white-space:nowrap; }
@media (max-width:720px) {
  .content-header { gap:6px; }
}
`;

const UI_PATCH_JS = `
/* Explicitly size the note list to the visible viewport on Android/Chrome. */
(function installStableNoteScroll() {
  function sizeNoteList() {
    const list = document.getElementById('emailList');
    if (!list) return;

    const rect = list.getBoundingClientRect();
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const bottomSpace = Math.max(8, Number.parseFloat(getComputedStyle(list).paddingBottom) || 0);
    const available = Math.max(120, Math.floor(viewportHeight - rect.top - bottomSpace));

    list.style.height = available + 'px';
    list.style.maxHeight = available + 'px';
    list.style.overflowY = 'auto';
    list.style.overflowX = 'hidden';
    list.style.webkitOverflowScrolling = 'touch';
    list.style.touchAction = 'pan-y';
  }

  function install() {
    sizeNoteList();
    window.addEventListener('resize', sizeNoteList, { passive:true });
    window.addEventListener('orientationchange', () => setTimeout(sizeNoteList, 80), { passive:true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', sizeNoteList, { passive:true });
    }
    const list = document.getElementById('emailList');
    if (list && !list.__stableScrollObserver) {
      const observer = new MutationObserver(() => requestAnimationFrame(sizeNoteList));
      observer.observe(list, { childList:true });
      list.__stableScrollObserver = observer;
    }
    requestAnimationFrame(sizeNoteList);
    setTimeout(sizeNoteList, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
`;

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
  event.respondWith((async () => {
    const cachedResponse = await caches.match(event.request);
    const response = cachedResponse || await fetch(event.request);
    const url = new URL(event.request.url);

    if (url.pathname.endsWith('/style.css')) {
      const css = await response.text();
      return new Response(css + '\n' + UI_PATCH_CSS, {
        headers: { 'Content-Type': 'text/css; charset=utf-8' }
      });
    }

    if (url.pathname.endsWith('/script.js')) {
      const js = await response.text();
      return new Response(js + '\n' + UI_PATCH_JS, {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
      });
    }

    return response;
  })());
});
