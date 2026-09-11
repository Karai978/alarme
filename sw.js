const CACHE_NAME = 'notes-alarme-complet-v9';
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
/* Dashboard: compact title + tags on one aligned line */
.content-header { min-width:0; }
.content-header > .title-tag-row {
  display:flex;
  align-items:center;
  gap:8px;
  min-width:0;
  flex:1 1 auto;
  overflow:hidden;
}
.title-tag-row h2 {
  flex:0 0 auto;
  white-space:nowrap;
  margin:0;
}
.title-tag-row.has-tags h2::after { content:' -'; }
.title-tag-row #viewSubtitle { display:none !important; }
.title-tag-row #tagBar {
  display:flex;
  align-items:center;
  gap:5px;
  flex:0 1 auto;
  min-width:0;
  max-width:100%;
  margin:0;
  overflow-x:auto;
  scrollbar-width:none;
}
.title-tag-row #tagBar::-webkit-scrollbar { display:none; }
.title-tag-row #tagBar .tag-label {
  flex:0 0 auto;
  white-space:nowrap;
  font-size:.72rem;
  color:var(--text-secondary);
}
.title-tag-row #tagBar .tag-label::after { content:' :'; }
.title-tag-row #tagBar .tag-chip { padding:4px 8px; font-size:.67rem; }

/* Dashboard: the note list is always the vertical scroll area */
.app-shell { min-height:0; }
.workspace {
  min-height:0;
  height:0;
  flex:1 1 auto;
  overflow:hidden;
}
.content-area {
  min-height:0;
  height:100%;
  overflow-x:hidden;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  overscroll-behavior:contain;
  touch-action:pan-y;
  scrollbar-width:thin;
}
.notes-grid {
  min-height:0;
  align-content:start;
}

@media (max-width:720px) {
  .title-tag-row { gap:6px; }
  .title-tag-row #tagBar { flex:1 1 auto; min-width:0; }
  .title-tag-row #tagBar .tag-chip { max-width:130px; overflow:hidden; text-overflow:ellipsis; }
  .content-area { padding-top:14px; }
}
@media (max-width:390px) {
  .title-tag-row { gap:5px; }
  .title-tag-row h2 { font-size:1.05rem; }
  .title-tag-row #tagBar .tag-label { font-size:.66rem; }
  .title-tag-row #tagBar .tag-chip { font-size:.62rem; padding:3px 7px; }
}
`;

const UI_PATCH_JS = `
(function applyDashboardLayoutPatch() {
  function alignDashboardHeader() {
    const header = document.querySelector('.content-header');
    const titleWrap = header?.firstElementChild;
    const tagBar = document.getElementById('tagBar');
    if (!titleWrap || !tagBar) return;

    titleWrap.classList.add('title-tag-row');
    if (tagBar.parentElement !== titleWrap) titleWrap.appendChild(tagBar);

    const syncTags = () => titleWrap.classList.toggle('has-tags', tagBar.children.length > 0);
    syncTags();
    if (!tagBar.__layoutObserver) {
      const observer = new MutationObserver(syncTags);
      observer.observe(tagBar, { childList:true, subtree:true });
      tagBar.__layoutObserver = observer;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', alignDashboardHeader, { once:true });
  } else {
    alignDashboardHeader();
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
