export function updateHex() {
    const h = document.getElementById('hex-stream');
    h.innerHTML = Math.random().toString(16).toUpperCase().slice(2,10) + "<br>" + h.innerHTML.slice(0, 500);
}

export function buildSlices(container, level, sectorColors) {
    container.innerHTML = '';
    const count = Math.floor(3 + (level - 0.7) * 20);
    const colHex = '#' + sectorColors.light.toString(16).padStart(6,'0');

    for(let i = 0; i < count; i++) {
        const top = Math.random() * 100;
        const height = Math.random() * 6 + 2;
        const delay = (Math.random() * 0.15).toFixed(3);
        const alpha = (0.05 + Math.random() * 0.15).toFixed(2);

        const s = document.createElement('div');
        s.className = 'slice';
        s.style.cssText = `
            top: ${top}vh;
            height: ${height}vh;
            background: ${colHex};
            opacity: ${alpha};
            animation-delay: -${delay}s;
            transform-origin: left center;
        `;
        container.appendChild(s);
    }
}