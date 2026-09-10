const CACHE_NAME = 'notes-alarme-dark-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './alarm.mp3',
  './icon-192.png',
  './icon-512.png'
];

// Installation du Service Worker et mise en cache des fichiers
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Mise en cache des ressources PWA...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Nettoyage des anciens caches lors des mises à jour
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Suppression de l'ancien cache :', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interception des requêtes pour le mode hors-ligne (Network-First avec Fallback Cache)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // En cas de panne de réseau, le cache prend le relais
      });
    })
  );
});
