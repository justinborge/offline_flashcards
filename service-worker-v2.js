const APP_CACHE_NAME = 'portugues-flashcards-app-v2-network';
const DATA_CACHE_NAME = 'portugues-flashcards-data-v2';

const APP_SHELL_URLS = [
  '/',
  'index.html',
  'style.css',
  'app.js',
  'assets/android-chrome-192x192.png',
  'assets/android-chrome-512x512.png',
  'assets/apple-touch-icon.png',
  'assets/logo-wordmark.png'
];

// 1. Install the service worker and cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell');
        return cache.addAll(APP_SHELL_URLS);
      })
  );
});

// 2. Clean up old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== APP_CACHE_NAME && key !== DATA_CACHE_NAME) {
          console.log('Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
});

// 3. Intercept fetch requests
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Strategy for Google Sheet data: Stale-While-Revalidate
  if (url.startsWith('https://docs.google.com/spreadsheets/')) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          // Return cached version immediately, while the fetch happens in the background.
          return cachedResponse || fetchPromise;
        });
      })
    );
  } 
  // Strategy for App Shell files: Network-First
  else {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        // Only cache a successful response
        if (networkResponse.ok) {
            caches.open(APP_CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
            });
        }
        return networkResponse;
      }).catch(() => {
        // If network fails, fall back to cache
        return caches.match(event.request);
      })
    );
  }
});