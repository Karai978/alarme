const CACHE_NAME = 'notes-alarme-complet-v11';
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
/* Dashboard: keep title, tags and tools aligned without changing the DOM */
.content-header {
  min-width:0;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:8px;
}
.content-header > div:first-child {
  display:contents;
}
.content-header > div:first-child #viewTitle {
  flex:0 0 auto;
  min-width:0;
  margin:0;
  white-space:nowrap;
}
.content-header > div:first-child #viewSubtitle {
  display:none !important;
}
.content-header > #tagBar {
  display:flex;
  align-items:center;
  gap:5px;
  flex:1 1 auto;
  min-width:0;
  margin:0;
  overflow-x:auto;
  scrollbar-width:none;
}
.content-header > #tagBar::-webkit-scrollbar { display:none; }
.content-header > #tagBar .tag-label {
  flex:0 0 auto;
  white-space:nowrap;
  font-size:.72rem;
  color:var(--text-secondary);
}
.content-header > #tagBar .tag-label::after { content:' :'; }
.content-header > #tagBar .tag-chip {
  flex:0 0 auto;
  padding:4px 8px;
  font-size:.67rem;
  white-space:nowrap;
}
.content-header > #tagBar:empty { display:none; }

/* Robust Android/Chrome scrolling: only the note grid scrolls */
.app-shell {
  min-height:0;
  height:100dvh;
  overflow:hidden;
}
.workspace {
  min-height:0;
  flex:1 1 0%;
  overflow:hidden;
}
.content-area {
  min-width:0;
  min-height:0;
  flex:1 1 auto;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  overscroll-behavior:contain;
}
.notes-grid {
  min-width:0;
  min-height:0;
  flex:1 1 auto;
  overflow-x:hidden;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  overscroll-behavior:contain;
  touch-action:pan-y;
  align-content:start;
  scrollbar-width:thin;
  padding-bottom:max(30px, env(safe-area-inset-bottom));
}

@media (max-width:720px) {
  .content-header { gap:6px; }
  .content-header > #tagBar { flex:1 1 auto; }
  .content-header > #tagBar .tag-chip {
    max-width:130px;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .content-area { padding-top:14px; }
}
@media (max-width:390px) {
  .content-header { gap:5px; }
  .content-header > #viewTitle { font-size:1.05rem; }
  .content-header > #tagBar .tag-label { font-size:.66rem; }
  .content-header > #tagBar .tag-chip { font-size:.62rem; padding:3px 7px; }
}
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

    return response;
  })());
});
