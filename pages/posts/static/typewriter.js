document.addEventListener('DOMContentLoaded', () => {
    const target = document.querySelector('[data-typewriter]');
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lines = [...target.querySelectorAll('.feeling-line')].map(line => line.textContent);
    if (!lines.some(line => line.length)) return;

    const readable = document.createElement('p');
    readable.className = 'feeling-readable';
    readable.textContent = lines.join('\n');
    target.before(readable);
    target.setAttribute('aria-hidden', 'true');
    target.replaceChildren();

    let row = 0;
    const typeRow = () => {
        if (row >= lines.length) return;

        const characters = Array.from(lines[row]);
        const line = document.createElement('div');
        line.className = 'feeling-line';
        const text = document.createElement('span');
        const cursor = document.createElement('span');
        cursor.className = 'feeling-cursor';
        cursor.textContent = '_';
        line.append(text, cursor);
        target.appendChild(line);

        let position = 0;
        const typeCharacter = () => {
            if (position < characters.length) {
                text.textContent += characters[position++];
                window.setTimeout(typeCharacter, 100);
                return;
            }
            cursor.remove();
            row++;
            if (row < lines.length) window.setTimeout(typeRow, 500);
        };
        typeCharacter();
    };
    typeRow();
});
