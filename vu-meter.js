// vu-meter.js – aparência bonita do skin, mantendo a dinâmica do vu-meter original
(function() {
    const TARGET_ID = 'el_239xlkuf';
    const W = 362;
    const H = 162;

    // ========== GEOMETRIA BASE ==========
    const CENTER_X = W / 2;
    const CENTER_Y = H - 18;
    const RADIUS   = H * 0.72;

    const ARC_START = -Math.PI * 0.75;
    const ARC_END   = -Math.PI * 0.25;
    const ARC_TOTAL = ARC_END - ARC_START;

    const POINTER_CENTER_X = CENTER_X;
    const POINTER_CENTER_Y = CENTER_Y;
    const POINTER_LENGTH = RADIUS - 8;

    const POINTER_ANGLE_MIN_DEG = 30;
    const POINTER_ANGLE_MAX_DEG = 135;
    const POINTER_ANGLE_MIN = -Math.PI / 2 + (POINTER_ANGLE_MIN_DEG * Math.PI / 180);
    const POINTER_ANGLE_MAX = -Math.PI / 2 + (POINTER_ANGLE_MAX_DEG * Math.PI / 180);
    const POINTER_ANGLE_RANGE = POINTER_ANGLE_MAX - POINTER_ANGLE_MIN;

    const POINTER_ANGLES = [];
    for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        POINTER_ANGLES.push(POINTER_ANGLE_MIN + t * POINTER_ANGLE_RANGE);
    }

    const PEAK_X = W - 28;
    const PEAK_Y = H - 24;
    const PEAK_RADIUS = 5;

    const CLOCK_X = 20;
    const CLOCK_Y = 120;
    const CLOCK_W = 106;
    const CLOCK_H = 28;

    // ========== DINÂMICA ORIGINAL ==========
    let lastAudioRead = 0;
    let rawTargetLevel = 0;
    let currentLevel = 0;
    let animationId = null;
    let container, canvas, ctx, backgroundCache;

    function roundedRect(pathCtx, x, y, w, h, r) {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        pathCtx.beginPath();
        pathCtx.moveTo(x + radius, y);
        pathCtx.arcTo(x + w, y, x + w, y + h, radius);
        pathCtx.arcTo(x + w, y + h, x, y + h, radius);
        pathCtx.arcTo(x, y + h, x, y, radius);
        pathCtx.arcTo(x, y, x + w, y, radius);
        pathCtx.closePath();
    }

    function buildStaticBackground() {
        const cacheCanvas = document.createElement('canvas');
        cacheCanvas.width = W;
        cacheCanvas.height = H;
        const bgCtx = cacheCanvas.getContext('2d');

        // Fundo externo azul bonito
        const outerGrad = bgCtx.createLinearGradient(0, 0, 0, H);
        outerGrad.addColorStop(0, '#173769');
        outerGrad.addColorStop(1, '#0c1c39');
        bgCtx.fillStyle = outerGrad;
        roundedRect(bgCtx, 0, 0, W, H, 12);
        bgCtx.fill();

        // Brilho superior
        const topGlow = bgCtx.createLinearGradient(0, 0, 0, H * 0.42);
        topGlow.addColorStop(0, 'rgba(255,255,255,0.14)');
        topGlow.addColorStop(1, 'rgba(255,255,255,0)');
        bgCtx.fillStyle = topGlow;
        roundedRect(bgCtx, 0, 0, W, H, 12);
        bgCtx.fill();

        // Painel interno claro
        roundedRect(bgCtx, 9, 9, W - 18, H - 18, 10);
        const panelGrad = bgCtx.createLinearGradient(0, 9, 0, H - 9);
        panelGrad.addColorStop(0, '#fbf6e4');
        panelGrad.addColorStop(0.5, '#efe5c9');
        panelGrad.addColorStop(1, '#ddcca6');
        bgCtx.fillStyle = panelGrad;
        bgCtx.fill();

        // Textura leve em cache
        bgCtx.save();
        roundedRect(bgCtx, 9, 9, W - 18, H - 18, 10);
        bgCtx.clip();
        bgCtx.globalAlpha = 0.05;
        for (let x = 14; x < W - 14; x += 6) {
            bgCtx.fillStyle = (x / 6) % 2 ? '#5d4b2f' : '#fff3d7';
            bgCtx.fillRect(x, 10, 2, H - 20);
        }
        bgCtx.restore();

        // Sombra interna superior
        const vignetteTop = bgCtx.createLinearGradient(0, 9, 0, 55);
        vignetteTop.addColorStop(0, 'rgba(0,0,0,0.12)');
        vignetteTop.addColorStop(1, 'rgba(0,0,0,0)');
        bgCtx.fillStyle = vignetteTop;
        roundedRect(bgCtx, 9, 9, W - 18, H - 18, 10);
        bgCtx.fill();

        // Arco principal
        bgCtx.beginPath();
        bgCtx.arc(CENTER_X, CENTER_Y, RADIUS, ARC_START, ARC_END);
        bgCtx.strokeStyle = '#27303d';
        bgCtx.lineWidth = 2;
        bgCtx.stroke();

        // Arco interno sutil
        bgCtx.beginPath();
        bgCtx.arc(CENTER_X, CENTER_Y, RADIUS - 10, ARC_START, ARC_END);
        bgCtx.strokeStyle = 'rgba(255,255,255,0.22)';
        bgCtx.lineWidth = 1;
        bgCtx.stroke();

        const marks = [
            { pos: 0.00, text: '-20', color: '#315d2d', len: 9 },
            { pos: 0.20, text: '-10', color: '#315d2d', len: 9 },
            { pos: 0.40, text: '-7',  color: '#3d6d33', len: 9 },
            { pos: 0.60, text: '-5',  color: '#916c18', len: 10 },
            { pos: 0.75, text: '-3',  color: '#b9841b', len: 11 },
            { pos: 0.90, text: '0',   color: '#b13a2f', len: 12 },
            { pos: 1.00, text: '+3',  color: '#b13a2f', len: 14 }
        ];

        marks.forEach(mark => {
            const angle = ARC_START + mark.pos * ARC_TOTAL;
            const x1 = CENTER_X + Math.cos(angle) * RADIUS;
            const y1 = CENTER_Y + Math.sin(angle) * RADIUS;
            const x2 = CENTER_X + Math.cos(angle) * (RADIUS - mark.len);
            const y2 = CENTER_Y + Math.sin(angle) * (RADIUS - mark.len);

            bgCtx.beginPath();
            bgCtx.moveTo(x1, y1);
            bgCtx.lineTo(x2, y2);
            bgCtx.strokeStyle = mark.color;
            bgCtx.lineWidth = mark.pos >= 0.9 ? 2.4 : 2;
            bgCtx.stroke();

            bgCtx.save();
            bgCtx.translate(
                CENTER_X + Math.cos(angle) * (RADIUS - 22),
                CENTER_Y + Math.sin(angle) * (RADIUS - 22)
            );
            bgCtx.rotate(angle + Math.PI / 2);
            bgCtx.fillStyle = mark.color;
            bgCtx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
            bgCtx.textAlign = 'center';
            bgCtx.textBaseline = 'middle';
            bgCtx.fillText(mark.text, 0, 0);
            bgCtx.restore();
        });

        // Faixa vermelha
        const dangerGrad = bgCtx.createLinearGradient(W * 0.68, 0, W, 0);
        dangerGrad.addColorStop(0, '#d86a54');
        dangerGrad.addColorStop(1, '#a91f17');
        bgCtx.beginPath();
        bgCtx.arc(CENTER_X, CENTER_Y, RADIUS - 2, ARC_START + 0.9 * ARC_TOTAL, ARC_END);
        bgCtx.strokeStyle = dangerGrad;
        bgCtx.lineWidth = 3.5;
        bgCtx.stroke();

        // Texto central
        bgCtx.fillStyle = 'rgba(42,36,27,0.34)';
        bgCtx.font = '700 22px "Segoe UI", Arial, sans-serif';
        bgCtx.textAlign = 'center';
        bgCtx.textBaseline = 'middle';
        bgCtx.fillText('VU', CENTER_X, 102);

        bgCtx.fillStyle = 'rgba(40,40,40,0.55)';
        bgCtx.font = '600 8px "Segoe UI", Arial, sans-serif';
        bgCtx.fillText('METER', CENTER_X, 118);

        bgCtx.fillStyle = '#4a4a4a';
        bgCtx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
        bgCtx.fillText('PEAK', PEAK_X, PEAK_Y + 13);

        // Moldura do relógio retrô na área vazia inferior esquerda
        const clockOuterGrad = bgCtx.createLinearGradient(CLOCK_X, CLOCK_Y, CLOCK_X, CLOCK_Y + CLOCK_H);
        clockOuterGrad.addColorStop(0, '#5c4221');
        clockOuterGrad.addColorStop(1, '#261a0b');
        bgCtx.fillStyle = clockOuterGrad;
        roundedRect(bgCtx, CLOCK_X, CLOCK_Y, CLOCK_W, CLOCK_H, 7);
        bgCtx.fill();

        const clockInnerGrad = bgCtx.createLinearGradient(CLOCK_X + 3, CLOCK_Y + 3, CLOCK_X + 3, CLOCK_Y + CLOCK_H - 3);
        clockInnerGrad.addColorStop(0, '#111111');
        clockInnerGrad.addColorStop(1, '#030303');
        bgCtx.fillStyle = clockInnerGrad;
        roundedRect(bgCtx, CLOCK_X + 3, CLOCK_Y + 3, CLOCK_W - 6, CLOCK_H - 6, 5);
        bgCtx.fill();

        bgCtx.strokeStyle = 'rgba(255,255,255,0.12)';
        bgCtx.lineWidth = 1;
        roundedRect(bgCtx, CLOCK_X + 0.5, CLOCK_Y + 0.5, CLOCK_W - 1, CLOCK_H - 1, 7);
        bgCtx.stroke();

        const clockGlass = bgCtx.createLinearGradient(CLOCK_X, CLOCK_Y, CLOCK_X, CLOCK_Y + (CLOCK_H * 0.55));
        clockGlass.addColorStop(0, 'rgba(255,255,255,0.18)');
        clockGlass.addColorStop(1, 'rgba(255,255,255,0)');
        bgCtx.fillStyle = clockGlass;
        roundedRect(bgCtx, CLOCK_X + 3, CLOCK_Y + 3, CLOCK_W - 6, CLOCK_H - 6, 5);
        bgCtx.fill();

        bgCtx.fillStyle = 'rgba(245, 191, 85, 0.32)';
        bgCtx.font = '600 7px "Segoe UI", Arial, sans-serif';
        bgCtx.textAlign = 'left';
        bgCtx.textBaseline = 'middle';
        bgCtx.fillText('TIME', CLOCK_X + 8, CLOCK_Y + 7);

        bgCtx.strokeStyle = 'rgba(255,255,255,0.2)';
        bgCtx.lineWidth = 1;
        roundedRect(bgCtx, 0.5, 0.5, W - 1, H - 1, 12);
        bgCtx.stroke();

        bgCtx.strokeStyle = 'rgba(0,0,0,0.22)';
        bgCtx.lineWidth = 1;
        roundedRect(bgCtx, 9.5, 9.5, W - 19, H - 19, 10);
        bgCtx.stroke();

        return cacheCanvas;
    }

    function getClockContext() {
        try {
            if (window.__reScheduleRuntime && typeof window.__reScheduleRuntime.getClockContext === 'function') {
                return window.__reScheduleRuntime.getClockContext() || null;
            }
        } catch (_e) {}

        try {
            const formatter = new Intl.DateTimeFormat('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const parts = formatter.formatToParts(new Date());
            const map = {};
            parts.forEach(part => {
                if (part && part.type) map[part.type] = part.value;
            });
            return { hour: Number(map.hour || 0), minute: Number(map.minute || 0) };
        } catch (_e) {
            const now = new Date();
            return { hour: now.getHours(), minute: now.getMinutes() };
        }
    }

    function getClockText() {
        const clock = getClockContext() || {};
        const totalMinutes = Number.isFinite(clock.minutes) ? clock.minutes : (((Number(clock.hour) || 0) * 60) + (Number(clock.minute) || 0));
        const hours = Math.floor(((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60) / 60);
        const minutes = ((totalMinutes % 60) + 60) % 60;
        return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    }

    function drawRetroClock() {
        const text = getClockText();
        const displayX = CLOCK_X + 8;
        const displayY = CLOCK_Y + 18;

        ctx.save();
        ctx.beginPath();
        roundedRect(ctx, CLOCK_X + 3, CLOCK_Y + 3, CLOCK_W - 6, CLOCK_H - 6, 5);
        ctx.clip();

        const glowGrad = ctx.createLinearGradient(CLOCK_X, CLOCK_Y, CLOCK_X + CLOCK_W, CLOCK_Y);
        glowGrad.addColorStop(0, 'rgba(255, 183, 64, 0.12)');
        glowGrad.addColorStop(0.5, 'rgba(255, 210, 128, 0.18)');
        glowGrad.addColorStop(1, 'rgba(255, 183, 64, 0.12)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(CLOCK_X + 4, CLOCK_Y + 4, CLOCK_W - 8, CLOCK_H - 8);

        ctx.fillStyle = '#ffd27a';
        ctx.shadowColor = 'rgba(255, 183, 64, 0.55)';
        ctx.shadowBlur = 7;
        ctx.font = 'bold 18px "Consolas", "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, displayX, displayY);

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 232, 184, 0.14)';
        ctx.fillRect(CLOCK_X + 5, CLOCK_Y + 5, CLOCK_W - 10, 4);
        ctx.restore();
    }

    function updateAudioLevel() {
        const now = Date.now();
        if (now - lastAudioRead < 60) return;
        lastAudioRead = now;

        let newLevel = 0;
        const engines = window.__reEngines;
        if (engines && engines.size) {
            for (let engine of engines.values()) {
                if (engine.wantPlay && engine.analyserNode && engine.frequencyData) {
                    try {
                        engine.analyserNode.getByteFrequencyData(engine.frequencyData);
                        let sum = 0;
                        const count = Math.min(engine.frequencyData.length, 48);
                        for (let i = 0; i < count; i++) sum += engine.frequencyData[i];
                        let avg = sum / (count * 255);
                        avg = Math.pow(avg, 0.7) * 1.2;
                        newLevel = Math.min(1, Math.max(0, avg));
                        break;
                    } catch(e) {}
                }
            }
        }
        rawTargetLevel = newLevel;
    }

    function renderFrame() {
        if (!ctx || !backgroundCache) return;

        // mesma lógica de atualização do original
        updateAudioLevel();
        currentLevel += (rawTargetLevel - currentLevel) * 0.22;

        const idx = Math.min(100, Math.max(0, Math.round(currentLevel * 100)));
        const angle = POINTER_ANGLES[idx];

        // mesmo estilo do original: fundo inteiro redesenhado do cache a cada frame
        ctx.drawImage(backgroundCache, 0, 0);

        // Ponteiro
        ctx.save();
        ctx.translate(POINTER_CENTER_X, POINTER_CENTER_Y);
        ctx.rotate(angle);
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 2;

        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.lineTo(0, -POINTER_LENGTH);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.stroke();

        // acabamento bonito pequeno sem interferir no movimento
        ctx.beginPath();
        ctx.moveTo(0, -POINTER_LENGTH + 10);
        ctx.lineTo(0, -POINTER_LENGTH);
        ctx.strokeStyle = '#9f2f28';
        ctx.lineWidth = 2.3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        // Pivô
        const hubGrad = ctx.createRadialGradient(
            POINTER_CENTER_X - 2,
            POINTER_CENTER_Y - 2,
            1,
            POINTER_CENTER_X,
            POINTER_CENTER_Y,
            11
        );
        hubGrad.addColorStop(0, '#faf7ef');
        hubGrad.addColorStop(0.35, '#d5d0c3');
        hubGrad.addColorStop(1, '#302f2c');

        ctx.beginPath();
        ctx.arc(POINTER_CENTER_X, POINTER_CENTER_Y, 11, 0, Math.PI * 2);
        ctx.fillStyle = hubGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(POINTER_CENTER_X, POINTER_CENTER_Y, 4.4, 0, Math.PI * 2);
        ctx.fillStyle = '#141414';
        ctx.fill();

        // Peak
        const isPeak = currentLevel > 0.9;
        ctx.beginPath();
        ctx.arc(PEAK_X, PEAK_Y, PEAK_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = isPeak ? '#ff4737' : '#5c2220';
        if (isPeak) {
            ctx.shadowColor = '#ff4737';
            ctx.shadowBlur = 8;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        drawRetroClock();

        animationId = requestAnimationFrame(renderFrame);
    }

    function initVUMeter() {
        container = document.querySelector(`[data-id="${TARGET_ID}"]`);
        if (!container) {
            setTimeout(initVUMeter, 500);
            return;
        }

        container.innerHTML = '';
        container.style.overflow = 'hidden';
        container.style.background = '#173769';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';

        canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        container.appendChild(canvas);

        try {
            ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        } catch (_e) {
            ctx = canvas.getContext('2d');
        }

        backgroundCache = buildStaticBackground();

        if (!window.__reEngines || window.__reEngines.size === 0) {
            setTimeout(initVUMeter, 500);
            return;
        }

        if (animationId) cancelAnimationFrame(animationId);
        renderFrame();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initVUMeter, 400));
    } else {
        setTimeout(initVUMeter, 400);
    }
})();
