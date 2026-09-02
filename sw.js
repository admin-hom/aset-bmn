// ===== Service Worker for PWA =====
const CACHE_NAME = 'aset-bmn-v6';
const BASE = '/aset-bmn/';

// CDN resources (versioned, safe to cache-first)
const CDN_URLS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js'
];

// Install - cache CDN only (app files fetched on-demand)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                CDN_URLS.map(url => cache.add(url).catch(() => null))
            );
        })
    );
    self.skipWaiting();
});

// Handle skip-waiting message from app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
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
            return self.clients.claim();
        })
    );
});

// Fetch strategy:
// - Firebase/Google APIs: network first
// - CDN (font-awesome, xlsx, jspdf): cache first (versioned, won't change)
// - App files (HTML, JS, CSS, pages): NETWORK FIRST (always get latest)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Network first for Firebase/Firestore
    if (url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('firestore.googleapis.com')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache first for CDN (versioned, safe)
    if (CDN_URLS.some(cdn => event.request.url.startsWith(cdn.split('?')[0]))) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
        return;
    }

    // NETWORK FIRST for all app files (HTML, JS, CSS, pages, images)
    // This ensures users always get the latest version
    event.respondWith(
        fetch(event.request).then((fetchResponse) => {
            // Cache the new version for offline use
            if (fetchResponse.status === 200 && url.origin === self.location.origin) {
                const responseClone = fetchResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
            }
            return fetchResponse;
        }).catch(() => {
            // Offline fallback: serve from cache
            return caches.match(event.request).then((response) => {
                if (response) return response;
                // For navigation requests, serve index.html
                if (event.request.mode === 'navigate') {
                    return caches.match(BASE + 'index.html');
                }
                return new Response('Offline', { status: 503 });
            });
        })
    );
});