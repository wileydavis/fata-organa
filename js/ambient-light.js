/* ============================================
   FATA ORGANA — Ambient Light System
   
   Canvas-based glow with solar flare tendrils.
   Reads from window.vuSignal (set by vu-meter.js)
   ============================================ */

(function() {
    'use strict';

    // --- Configuration ---
    var FADE_IN_SPEED  = 0.0033;
    var FADE_OUT_SPEED = 0.012;
    var DARKNESS_MAX   = 0.97;

    var COLOR_COOL = { r: 180, g: 120, b: 50  };
    var COLOR_WARM = { r: 220, g: 180, b: 90  };
    var COLOR_HOT  = { r: 255, g: 240, b: 200 };

    // --- State ---
    var darkness = 0;
    var glowEnergy = 0;
    var colorTemp = 0;
    var breathPhase = 0;
    var isListening = false;
    var time = 0;

    // --- DOM elements to dim ---
    var dimTargets = [
        '.site-nav',
        '.tx-header',
        '.tx-frequency-bar',
        '.tx-band-selector',
        '.tx-status-strip',
        '.tx-panel-buttons',
        '.tx-tagline',
        '.tx-footer'
    ];
    var dimEls = [];
    dimTargets.forEach(function(sel) {
        var el = document.querySelector(sel);
        if (el) dimEls.push(el);
    });

    // --- Create glow canvas ---
    var glowCanvas = document.createElement('canvas');
    glowCanvas.className = 'ambient-glow';
    glowCanvas.style.cssText = ''
        + 'position:fixed;top:0;left:0;width:100%;height:100%;'
        + 'pointer-events:none;z-index:2;'
        + 'opacity:0;';
    document.body.appendChild(glowCanvas);
    var gCtx = glowCanvas.getContext('2d');

    // --- Create darkness overlay ---
    var darknessOverlay = document.createElement('div');
    darknessOverlay.className = 'ambient-darkness';
    darknessOverlay.style.cssText = ''
        + 'position:fixed;top:0;left:0;right:0;bottom:0;'
        + 'pointer-events:none;z-index:0;'
        + 'background:black;opacity:0;';
    document.body.appendChild(darknessOverlay);

    // --- Resize canvas ---
    var gW = 0, gH = 0;
    function resizeGlow() {
        gW = window.innerWidth;
        gH = window.innerHeight;
        glowCanvas.width = gW;
        glowCanvas.height = gH;
    }
    window.addEventListener('resize', resizeGlow);
    resizeGlow();

    // --- Helpers ---
    function lerp(a, b, t) { return a + (b - a) * t; }
    function lerpColor(c1, c2, t) {
        return {
            r: Math.round(lerp(c1.r, c2.r, t)),
            g: Math.round(lerp(c1.g, c2.g, t)),
            b: Math.round(lerp(c1.b, c2.b, t))
        };
    }

    // --- Solar flare system ---
    var NUM_FLARES = 8;
    var flares = [];
    for (var i = 0; i < NUM_FLARES; i++) {
        flares.push({
            angle: (Math.PI * 2 / NUM_FLARES) * i + Math.random() * 0.5,
            length: 0.3 + Math.random() * 0.4,  // relative to base radius
            width: 0.15 + Math.random() * 0.2,   // angular width
            speed: (Math.random() - 0.5) * 0.0003, // rotation speed
            phase: Math.random() * Math.PI * 2,
            pulseSpeed: 0.003 + Math.random() * 0.004,
            baseLength: 0.3 + Math.random() * 0.4
        });
    }

    // --- Draw flare glow ---
    function drawGlow(c, coreAlpha, energy, breath) {
        gCtx.clearRect(0, 0, gW, gH);
        if (coreAlpha < 0.005) return;

        var cx = gW * 0.5;
        var cy = gH * 0.45;
        var baseRadius = Math.min(gW, gH) * (0.25 + energy * 0.15) * 1.35;

        // Core glow — radial gradient
        var coreGrad = gCtx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius);
        coreGrad.addColorStop(0, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (coreAlpha * 0.6) + ')');
        coreGrad.addColorStop(0.15, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (coreAlpha * 0.35) + ')');
        coreGrad.addColorStop(0.35, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (coreAlpha * 0.15) + ')');
        coreGrad.addColorStop(0.6, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (coreAlpha * 0.05) + ')');
        coreGrad.addColorStop(1, 'transparent');
        gCtx.fillStyle = coreGrad;
        gCtx.fillRect(0, 0, gW, gH);

        // Solar flares — elongated radial gradients at various angles
        gCtx.globalCompositeOperation = 'screen';

        for (var fi = 0; fi < flares.length; fi++) {
            var f = flares[fi];

            // Animate flare
            f.angle += f.speed;
            f.phase += f.pulseSpeed;
            var pulse = Math.sin(f.phase) * 0.5 + 0.5;

            // Audio-reactive length boost
            var audioBoost = energy * 0.5 + (window.vuSignal && window.vuSignal.peak > 0.4 ? (window.vuSignal.peak - 0.4) * 0.8 : 0);
            f.length = f.baseLength + pulse * 0.3 + audioBoost * 0.4;

            var flareLen = baseRadius * (1 + f.length);
            var flareAlpha = coreAlpha * (0.15 + pulse * 0.1) * breath;

            if (flareAlpha < 0.003) continue;

            // Draw each flare as a tapered gradient along its angle
            var endX = cx + Math.cos(f.angle) * flareLen;
            var endY = cy + Math.sin(f.angle) * flareLen;

            // Midpoint for the gradient
            var midX = cx + Math.cos(f.angle) * baseRadius * 0.5;
            var midY = cy + Math.sin(f.angle) * baseRadius * 0.5;

            var flareGrad = gCtx.createRadialGradient(
                midX, midY, 0,
                midX, midY, flareLen * 0.7
            );
            flareGrad.addColorStop(0, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + flareAlpha + ')');
            flareGrad.addColorStop(0.3, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (flareAlpha * 0.5) + ')');
            flareGrad.addColorStop(0.7, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (flareAlpha * 0.1) + ')');
            flareGrad.addColorStop(1, 'transparent');

            // Draw as an elongated ellipse along the flare direction
            gCtx.save();
            gCtx.translate(midX, midY);
            gCtx.rotate(f.angle);
            gCtx.scale(1.8, f.width * 2);  // elongate along flare direction
            gCtx.beginPath();
            gCtx.arc(0, 0, flareLen * 0.5, 0, Math.PI * 2);
            gCtx.fillStyle = flareGrad;
            gCtx.fill();
            gCtx.restore();
        }

        gCtx.globalCompositeOperation = 'source-over';

        // Outer halo — very faint, large
        var haloRadius = baseRadius * 1.8;
        var haloGrad = gCtx.createRadialGradient(cx, cy, baseRadius * 0.8, cx, cy, haloRadius);
        haloGrad.addColorStop(0, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (coreAlpha * 0.03) + ')');
        haloGrad.addColorStop(0.5, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (coreAlpha * 0.01) + ')');
        haloGrad.addColorStop(1, 'transparent');
        gCtx.fillStyle = haloGrad;
        gCtx.fillRect(0, 0, gW, gH);
    }

    // --- Main loop ---
    function update() {
        time++;
        var signal = window.vuSignal || {};
        isListening = signal.isPlaying && signal.hasStarted;

        // --- Darkness ---
        if (isListening) {
            darkness = Math.min(DARKNESS_MAX, darkness + FADE_IN_SPEED);
        } else {
            darkness = Math.max(0, darkness - FADE_OUT_SPEED);
        }

        darknessOverlay.style.opacity = document.body.classList.contains('focus-mode') ? 0 : darkness;

        // --- Dim UI elements ---
        var uiOpacity = 1 - darkness * 0.95;
        for (var i = 0; i < dimEls.length; i++) {
            dimEls[i].style.opacity = uiOpacity;
        }

        // --- Glow energy from audio ---
        var targetEnergy = 0;
        var targetTemp = 0;

        if (isListening) {
            var rms = signal.smoothRms || 0;
            var low = signal.smoothLow || 0;
            targetEnergy = Math.min(1, rms * 1.5 + low * 0.5);
            targetTemp = Math.min(1, rms * 2);
        }

        glowEnergy += (targetEnergy - glowEnergy) * 0.02;
        colorTemp  += (targetTemp - colorTemp) * 0.015;

        breathPhase += 0.006;
        var breath = Math.sin(breathPhase) * 0.5 + 0.5;
        var breathMod = 0.85 + breath * 0.15;

        // --- Compute glow color ---
        var c;
        if (colorTemp < 0.5) {
            c = lerpColor(COLOR_COOL, COLOR_WARM, colorTemp * 2);
        } else {
            c = lerpColor(COLOR_WARM, COLOR_HOT, (colorTemp - 0.5) * 2);
        }

        // --- Draw glow with flares ---
        if (darkness > 0.01) {
            var glowAlpha = glowEnergy * breathMod * darkness;
            var coreAlpha = Math.min(0.22, glowAlpha * 0.25);

            glowCanvas.style.opacity = 1;
            drawGlow(c, coreAlpha, glowEnergy, breathMod);
        } else {
            glowCanvas.style.opacity = 0;
        }

        // --- Panel border glow ---
        var txPanel = document.querySelector('.tx-panel');
        if (txPanel) {
            if (darkness > 0.1 && glowEnergy > 0.01) {
                var borderAlpha = Math.min(0.25, glowEnergy * breathMod * 0.3);
                var shadowSpread = 10 + glowEnergy * 40;
                txPanel.style.boxShadow = ''
                    + '0 0 ' + shadowSpread + 'px rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + borderAlpha + '), '
                    + '0 0 ' + (shadowSpread * 2.5) + 'px rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (borderAlpha * 0.3) + ')';
            } else {
                txPanel.style.boxShadow = 'none';
            }
        }

        requestAnimationFrame(update);
    }

    requestAnimationFrame(update);

})();
