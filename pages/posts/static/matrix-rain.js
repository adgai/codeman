(() => {
    if (!document.body.classList.contains('home-page')) return;

    const canvas = document.querySelector('.matrix-rain');
    const context = canvas.getContext('2d');
    if (!context) return;

    const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const spacing = 30;
    const lineHeight = 17;
    let streams = [];
    let width = 0;
    let height = 0;
    let lastFrame = 0;
    let animationFrame = 0;

    const randomCharacter = () => characters[Math.floor(Math.random() * characters.length)];

    function resize() {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
        context.textAlign = 'center';
        streams = Array.from({ length: Math.ceil(width / spacing) }, (_, index) => {
            const length = 7 + Math.floor(Math.random() * 9);
            return {
                x: index * spacing + spacing / 2,
                y: Math.random() * (height + length * lineHeight) - length * lineHeight,
                speed: 28 + Math.random() * 38,
                glyphs: Array.from({ length }, randomCharacter),
            };
        }).filter(() => Math.random() > .22);
        draw(0);
    }

    function draw(elapsed) {
        context.clearRect(0, 0, width, height);
        context.fillStyle = '#008f43';
        streams.forEach(stream => {
            if (!motion.matches) stream.y += stream.speed * elapsed / 1000;
            if (stream.y - stream.glyphs.length * lineHeight > height) {
                stream.y = -Math.random() * height * .35;
            }
            stream.glyphs.forEach((glyph, index) => {
                const y = stream.y - index * lineHeight;
                if (y < -lineHeight || y > height + lineHeight) return;
                context.globalAlpha = index === 0 ? .62 : .36 * (1 - index / stream.glyphs.length);
                context.fillText(glyph, stream.x, y);
                if (!motion.matches && Math.random() < .025) stream.glyphs[index] = randomCharacter();
            });
        });
        context.globalAlpha = 1;
    }

    function animate(now) {
        animationFrame = window.requestAnimationFrame(animate);
        if (now - lastFrame < 33) return;
        draw(Math.min(now - lastFrame || 33, 80));
        lastFrame = now;
    }

    function updateMotion() {
        window.cancelAnimationFrame(animationFrame);
        if (motion.matches || document.hidden) {
            draw(0);
            return;
        }
        lastFrame = 0;
        animationFrame = window.requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', updateMotion);
    motion.addEventListener('change', updateMotion);
    resize();
    updateMotion();
})();
