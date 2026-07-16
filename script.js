(async () => {
    if (localStorage.getItem('data') === null) {
        const response = await fetch('blocks.json');
        const blocks = await response.json();
        localStorage.setItem('data', JSON.stringify(blocks));
    }

    const blocksAll = JSON.parse(localStorage.getItem('data'));

    const blocksSolid = blocksAll.filter(b => b.isSolid);

    const startColor = document.querySelector('#start');
    const destColor = document.querySelector('#destination');
    const result = document.querySelector('#result');

    const enterButton = document.querySelector('#done');
    const filterNonSolidCheckbox = document.querySelector('#filterNonBlocks');

    enterButton.addEventListener('click', renderGradient);
    filterNonSolidCheckbox.addEventListener('click', () => {
        if (result.innerHTML === '') {
            return;
        }
        renderGradient();
    });

    const clearCacheButton = document.querySelector('#clearCache');
    clearCacheButton.addEventListener('click', () => {
        localStorage.clear();
    });

    function renderGradient() {
        result.innerHTML = '';
        const source = filterNonSolidCheckbox.checked ? blocksSolid : blocksAll;
        const gradient = createGradient(startColor.value, destColor.value, source);
        gradient.forEach(block => {
            const texture = document.createElement('img');
            texture.src = block.url;
            texture.alt = block.name;
            texture.loading = 'lazy';
            result.appendChild(texture);
        });
    }


    function createGradient(startHex, destHex, blocks, steps = 10) {
        const startLab = hexToLab(startHex);
        const destLab = hexToLab(destHex);

        const result = [];
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const target = {
                l: startLab.l + (destLab.l - startLab.l) * t,
                a: startLab.a + (destLab.a - startLab.a) * t,
                b: startLab.b + (destLab.b - startLab.b) * t,
            };

            let closest = blocks[0];
            let closestDist = labDistance(target, blocks[0].lab);
            for (const candidate of blocks) {
                const d = labDistance(target, candidate.lab);
                if (d < closestDist) {
                    closest = candidate;
                    closestDist = d;
                }
            }
            result.push(closest);
        }

        return result;
    }

    function labDistance(c1, c2) {
        return Math.hypot(c1.l - c2.l, c1.a - c2.a, c1.b - c2.b);
    }

    function hexToLab(hex) {
        const n = parseInt(hex.slice(1), 16);
        let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;

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
})();