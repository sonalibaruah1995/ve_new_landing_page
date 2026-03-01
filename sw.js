const CACHE_NAME = 've-cache-v1';
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
    '/',
    '/offline',
    '/manifest.json',
    '/images/logo_ve.png',
    '/images/logo_name.png',
    '/images/logo.png',
    '/favicon.ico',
    '/favicon.svg'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignore cross-origin requests, API calls, and non-GET requests
    if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
        return;
    }

    // HTML Pages: Network-First Strategy 
    // (Ensures users always see the most recent content if online, falls back to cache, then offline page)
    if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                    return response;
                })
                .catch(async () => {
                    const cache = await caches.open(CACHE_NAME);
                    const cachedResponse = await cache.match(request);
                    return cachedResponse || cache.match(OFFLINE_URL);
                })
        );
        return;
    }

    // Static Assets (Images, CSS, JS, Fonts): Stale-While-Revalidate Strategy
    // (Serves from cache quickly while quietly updating the cache in the background)
    if (
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'image' ||
        request.destination === 'font'
    ) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                const networkFetch = fetch(request).then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                    return response;
                }).catch(() => null);

                return cachedResponse || networkFetch;
            })
        );
        return;
    }
});
