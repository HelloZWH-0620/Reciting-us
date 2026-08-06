// Service Worker for Reciting-us (背书哇！)
// Version: v0.2.0
// Strategy: cache-first for static assets, network-first for data

var CACHE_VERSION = 'reciting-us-v0.2.0';
var CACHE_ASSETS = [
  './',
  './index.html',
  './src/css/style.css',
  './src/js/app.js',
  './src/data/articles.js',
  './src/data/authors.js',
  './src/data/jushi.js',
  './src/data/ci-lei-huo-yong.js',
  './src/data/situational-questions.js',
  './config/manifest.json',
  './resource/logomini.ico'
];

// Install: pre-cache core assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return cache.addAll(CACHE_ASSETS).catch(function(err) {
        // Individual asset failure shouldn't break install
        console.warn('[SW] Some assets failed to cache:', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) {
          return name !== CACHE_VERSION;
        }).map(function(name) {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: cache-first for assets, network-first for data
self.addEventListener('fetch', function(event) {
  var request = event.request;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for static assets (CSS, JS, fonts, images)
  if (/\.(css|js|ttf|woff2?|png|jpg|jpeg|gif|ico|svg)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(function(cached) {
        return cached || fetch(request).then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_VERSION).then(function(cache) {
              cache.put(request, clone);
            });
          }
          return response;
        }).catch(function() {
          return cached;
        });
      })
    );
    return;
  }

  // Network-first for HTML pages (so updates are seen)
  if (request.headers.get('accept') && request.headers.get('accept').indexOf('text/html') !== -1) {
    event.respondWith(
      fetch(request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_VERSION).then(function(cache) {
            cache.put(request, clone);
          });
        }
        return response;
      }).catch(function() {
        return caches.match(request);
      })
    );
    return;
  }

  // Default: try cache, fall back to network
  event.respondWith(
    caches.match(request).then(function(cached) {
      return cached || fetch(request);
    })
  );
});

// Message handler for manual update
self.addEventListener('message', function(event) {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
