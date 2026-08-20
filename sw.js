// ===== Service Worker for PWA =====
const CACHE_NAME = 'aset-bmn-v4';
const BASE = '/aset-bmn/';
const ASSETS = [
    BASE,
    BASE + 'index.html',
    BASE + 'style.css',
    BASE + 'app.js',
    BASE + 'manifest.json',
    BASE + 'icon-192.png',
    BASE + 'icon-512.png',
    BASE + 'icon-192.svg',
    BASE + 'icon-512.svg',
    BASE + 'firebase-config.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js'
];

// Install - cache all assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS).catch(err => {
                console.warn('SW cache addAll partial fail:', err);
                // Cache what we can, don't block install
                return Promise.allSettled(
                    ASSETS.map(url => cache.add(url).catch(() => null))
                );
            });
        })
    );
    // Activate immediately without waiting for old SW
    self.skipWaiting();
});

// Activate - clear old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('SW deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            // Take control of all pages immediately
            return self.clients.claim();
        })
    );
});

// Fetch - Network first for Firebase, Cache first for local
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
            if (response) return response;

            return fetch(event.request).then((fetchResponse) => {
                // Only cache successful same-origin responses
                if (fetchResponse.status === 200 && url.origin === self.location.origin) {
                    const responseClone = fetchResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return fetchResponse;
            });
        }).catch(() => {
            // Fallback for navigation requests
            if (event.request.mode === 'navigate') {
                return caches.match(BASE + 'index.html');
            }
        })
    );
});
