// ===== Service Worker for PWA =====
const CACHE_NAME = 'aset-bmn-v3';
const BASE = self.location.pathname.replace(/\/sw\.js$/, '/');
const ASSETS = [
    BASE,
    BASE + 'index.html',
    BASE + 'style.css',
    BASE + 'app.js',
    BASE + 'manifest.json',
    BASE + 'icon-192.svg',
    BASE + 'icon-512.svg',
    BASE + 'firebase-config.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js'
];

// Install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch - Network first for Firebase, Cache first for local assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Network first for Firebase/Firestore requests
    if (url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('firestore.googleapis.com')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache first for local assets
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((fetchResponse) => {
                if (fetchResponse.status === 200) {
                    const responseClone = fetchResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return fetchResponse;
            });
        }).catch(() => {
            // Fallback: serve index.html for navigation requests
            if (event.request.mode === 'navigate') {
                return caches.match(BASE + 'index.html');
            }
        })
    );
});
