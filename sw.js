const CACHE_NAME = 'minecraft-textures-v1'; // bump this string to invalidate the cache
const TEXTURE_HOST = 'raw.githubusercontent.com';

// Activate the new service worker as soon as it's installed
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Take control of any already-open pages immediately, and clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
            await self.clients.claim();
        })()
    );
});

// Cache-first strategy, but only for the texture host.
// Everything else (your HTML/JS/CSS, the GitHub API call, etc.) is
// left completely untouched and goes to the network as normal.
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.hostname !== TEXTURE_HOST) {
        return;
    }

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(event.request);
            if (cached) {
                return cached;
            }

            try {
                const response = await fetch(event.request);
                // Cross-origin <img> requests without crossOrigin set come
                // through as opaque responses (ok is always false even on
                // success), so cache those too.
                if (response && (response.ok || response.type === 'opaque')) {
                    cache.put(event.request, response.clone());
                }
                return response;
            } catch (err) {
                // Network failed and nothing cached — nothing more we can do
                throw err;
            }
        })()
    );
});