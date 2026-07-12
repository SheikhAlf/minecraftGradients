// cache-worker.js
// Runs in a dedicated Web Worker. Given a list of texture URLs, fetches
// each one and stores it in the same Cache Storage bucket that sw.js
// reads from, so images are already cached by the time they're needed.

const CACHE_NAME = 'minecraft-textures-v1'; // keep in sync with sw.js
const CONCURRENCY = 8;

self.addEventListener('message', async (event) => {
    const { urls } = event.data;
    const cache = await caches.open(CACHE_NAME);

    let index = 0;
    let cached = 0;

    async function worker() {
        while (index < urls.length) {
            const url = urls[index++];
            try {
                const existing = await cache.match(url);
                if (!existing) {
                    const response = await fetch(url);
                    if (response && (response.ok || response.type === 'opaque')) {
                        await cache.put(url, response);
                    }
                }
            } catch (err) {
                // A single texture failing isn't fatal, just skip it
            }
            cached++;
            self.postMessage({ type: 'progress', cached, total: urls.length });
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    self.postMessage({ type: 'done', total: urls.length });
});