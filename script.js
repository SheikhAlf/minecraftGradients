if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service worker registered:', reg.scope))
        .catch((err) => console.error('Service worker registration failed:', err));
}

window.addEventListener('load', async () => {
    if (localStorage.getItem('data') === null) {
        const response = await fetch('blocks.json');
        const blocks = await response.json();
        localStorage.setItem('data', JSON.stringify(blocks));
        console.log('fetched');
    }

    const blocks = JSON.parse(localStorage.getItem('data'));

    // Off-main-thread cache warming: doesn't block rendering or interaction.
    // cache-worker.js checks Cache Storage before fetching, so redundant
    // runs on later page loads are cheap (mostly cache.match checks).
    if (window.Worker) {
        const cacheWorker = new Worker('cacheWorker.js');
        cacheWorker.postMessage({ urls: blocks.map(b => b.url) });
        cacheWorker.addEventListener('message', (event) => {
            if (event.data.type === 'done') {
                console.log(`Texture cache warmed: ${event.data.total} textures`);
                cacheWorker.terminate();
            }
        });
    }

    const startColor = document.querySelector('#start');
    const destColor = document.querySelector('#destination');
    const result = document.querySelector('#result');

    const enterButton = document.querySelector('#done');
    const filterNonSolidCheckbox = document.querySelector('#filterNonBlocks');
    enterButton.addEventListener('click', () => {
        result.innerHTML = '';
        const gradient = createGradient(
            startColor.value, 
            destColor.value, 
            filterNonSolidCheckbox.checked ? blocks.filter(b => b.isSolid) : blocks
        );
        gradient.forEach(block => {
            const texture = document.createElement('img');
            texture.src = block.url;
            result.appendChild(texture);
        });
    });
    filterNonSolidCheckbox.addEventListener('click', () => {
        if (result.innerHTML === '') {
            return;
        }
        result.innerHTML = '';
        const gradient = createGradient(
            startColor.value, 
            destColor.value, 
            filterNonSolidCheckbox.checked ? blocks.filter(b => b.isSolid) : blocks
        );
        gradient.forEach(block => {
            const texture = document.createElement('img');
            texture.src = block.url;
            result.appendChild(texture);
        });
    });

    const clearCacheButton = document.querySelector('#clearCache');
    clearCacheButton.addEventListener('click', async () => {
        localStorage.clear();
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
        location.reload(); 
    });

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    async function getLocalValue(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let aSum = 0;

        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            rSum += data[i] * a;
            gSum += data[i + 1] * a;
            bSum += data[i + 2] * a;
            aSum += a;
        }

        const pixelCount = data.length / 4;
        const isSolid = isSolidByBorder(data, canvas.width, canvas.height);

        return {
            color: {
                r: aSum === 0 ? 0 : Math.round(rSum / aSum),
                g: aSum === 0 ? 0 : Math.round(gSum / aSum),
                b: aSum === 0 ? 0 : Math.round(bSum / aSum),
                a: Math.round(aSum / pixelCount),
            },
            isSolid,
        };
    }

    function renderGallery(blocks) {
        const gallery = document.querySelector('#gallery');
        const showLocalValues = document.querySelector('#localValues');
        gallery.innerHTML = '';
        showLocalValues.innerHTML = '';

        for (const block of blocks) {
            const texture = document.createElement('img');
            texture.alt = block.name;
            texture.crossOrigin = 'anonymous';
            texture.src = block.url;
            texture.loading = 'lazy';
            texture.width = 16;
            texture.height = 16;
            gallery.appendChild(texture);

            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            showLocalValues.appendChild(canvas);

            const { r, g, b, a } = block.localValue;
            canvas.getContext('2d').fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
            canvas.getContext('2d').fillRect(0, 0, 1, 1);
        }
    }

    function isSolidByBorder(data, width, height, alphaThreshold = 250) {
        const alphaAt = (x, y) => data[(y * width + x) * 4 + 3];

        for (let x = 0; x < width; x++) {
            if (alphaAt(x, 0) < alphaThreshold) return false;
            if (alphaAt(x, height - 1) < alphaThreshold) return false;
        }
        for (let y = 0; y < height; y++) {
            if (alphaAt(0, y) < alphaThreshold) return false;
            if (alphaAt(width - 1, y) < alphaThreshold) return false;
        }
        return true;
    }

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    function rgbToLab({ r, g, b }) {
        // sRGB -> linear
        [r, g, b] = [r, g, b].map(v => {
            v /= 255;
            return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
        });

        // linear sRGB -> XYZ (D65)
        const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
        const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
        const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

        const f = t => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116);
        const [fx, fy, fz] = [f(x), f(y), f(z)];

        return {
            l: (116 * fy) - 16,
            a: 500 * (fx - fy),
            b: 200 * (fy - fz),
        };
    }

    function hexToLab(hex) {
        return rgbToLab(hexToRgb(hex));
    }

    function labDistance(c1, c2) {
        return Math.hypot(c1.l - c2.l, c1.a - c2.a, c1.b - c2.b);
    }

    function createGradient(startHex, destHex, blocks, steps = 10) {
        const startLab = hexToLab(startHex);
        const destLab = hexToLab(destHex);

        // cache each block's Lab value so we don't recompute it per step
        const withLab = blocks.map(block => ({
            block,
            lab: rgbToLab(block.localValue),
        }));

        const result = [];
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const target = {
                l: startLab.l + (destLab.l - startLab.l) * t,
                a: startLab.a + (destLab.a - startLab.a) * t,
                b: startLab.b + (destLab.b - startLab.b) * t,
            };

            let closest = withLab[0];
            let closestDist = labDistance(target, withLab[0].lab);
            for (const candidate of withLab) {
                const d = labDistance(target, candidate.lab);
                if (d < closestDist) {
                    closest = candidate;
                    closestDist = d;
                }
            }
            result.push(closest.block);
        }

        return result;
    }
});