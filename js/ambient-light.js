/* ============================================
   FATA ORGANA — Ambient Light System
   
   When audio plays, the page fades to black.
   The transmitter becomes the only light source.
   Glow intensity, color temperature, and ambient
   spill are driven by the audio signal.
   
   Reads from window.vuSignal (set by vu-meter.js)
   ============================================ */

(function() {
    'use strict';

    // --- Configuration ---
    var FADE_IN_SPEED  = 0.008;  // how fast darkness comes (per frame)
    var FADE_OUT_SPEED = 0.012;  // how fast light returns
    var DARKNESS_MAX   = 0.97;   // max darkness of surrounding page

    // Color temperature range (warm amber → bright gold → pale warm white)
    var COLOR_COOL = { r: 196, g: 163, b: 90  };  // resting amber
    var COLOR_WARM = { r: 220, g: 190, b: 110 };   // mid energy
    var COLOR_HOT  = { r: 240, g: 220, b: 170 };   // peak energy

    // --- State ---
    var darkness = 0;       // 0 = normal, 1 = full dark
    var glowEnergy = 0;     // smoothed glow intensity
    var colorTemp = 0;      // 0 = cool amber, 1 = hot white
    var breathPhase = 0;    // slow sine for breathing overlay
    var isListening = false;
    var wasListening = false;

    // --- DOM elements to dim ---
    var dimTargets = [
        '.tx-header',
        '.tx-frequency-bar',
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

    // --- Create ambient glow element ---
    var ambientGlow = document.createElement('div');
    ambientGlow.className = 'ambient-glow';
    ambientGlow.style.cssText = ''
        + 'position:fixed;top:0;left:0;right:0;bottom:0;'
        + 'pointer-events:none;z-index:2;'
        + 'opacity:0;transition:none;';
    document.body.appendChild(ambientGlow);

    // --- Create darkness overlay ---
    var darknessOverlay = document.createElement('div');
    darknessOverlay.className = 'ambient-darkness';
    darknessOverlay.style.cssText = ''
        + 'position:fixed;top:0;left:0;right:0;bottom:0;'
        + 'pointer-events:none;z-index:1;'
        + 'background:black;opacity:0;';
    document.body.appendChild(darknessOverlay);

    // --- Lerp helper ---
    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function lerpColor(c1, c2, t) {
        return {
            r: Math.round(lerp(c1.r, c2.r, t)),
            g: Math.round(lerp(c1.g, c2.g, t)),
            b: Math.round(lerp(c1.b, c2.b, t))
        };
    }

    // --- Main loop ---
    function update() {
        var signal = window.vuSignal || {};
        isListening = signal.isPlaying && signal.hasStarted;

        // --- Darkness ---
        if (isListening) {
            darkness = Math.min(DARKNESS_MAX, darkness + FADE_IN_SPEED);
        } else {
            darkness = Math.max(0, darkness - FADE_OUT_SPEED);
        }

        darknessOverlay.style.opacity = darkness;

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

            // Glow energy: mostly from smoothed RMS, boosted by low end
            targetEnergy = Math.min(1, rms * 1.5 + low * 0.5);

            // Color temperature: driven by energy
            targetTemp = Math.min(1, rms * 2);
        }

        // Smooth toward target (slow, breathing feel)
        glowEnergy += (targetEnergy - glowEnergy) * 0.02;
        colorTemp  += (targetTemp - colorTemp) * 0.015;

        // Breathing overlay — very slow sine
        breathPhase += 0.006;
        var breath = Math.sin(breathPhase) * 0.5 + 0.5; // 0-1
        var breathMod = 0.85 + breath * 0.15; // gentle 15% modulation

        // --- Compute glow color ---
        var c;
        if (colorTemp < 0.5) {
            c = lerpColor(COLOR_COOL, COLOR_WARM, colorTemp * 2);
        } else {
            c = lerpColor(COLOR_WARM, COLOR_HOT, (colorTemp - 0.5) * 2);
        }

        // --- Apply ambient glow ---
        if (darkness > 0.01) {
            var glowAlpha = glowEnergy * breathMod * darkness;
            var innerAlpha = Math.min(0.18, glowAlpha * 0.2);
            var outerAlpha = Math.min(0.06, glowAlpha * 0.07);

            // Radial glow centered on transmitter area
            ambientGlow.style.opacity = 1;
            ambientGlow.style.background = ''
                + 'radial-gradient('
                + 'ellipse ' + (45 + glowEnergy * 20) + '% ' + (35 + glowEnergy * 15) + '% '
                + 'at 50% 45%, '
                + 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + innerAlpha + ') 0%, '
                + 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (innerAlpha * 0.4) + ') 40%, '
                + 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + outerAlpha + ') 70%, '
                + 'transparent 100%)';
        } else {
            ambientGlow.style.opacity = 0;
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

        // --- Meter border glow ---
        var txMeter = document.querySelector('.tx-meter');
        if (txMeter) {
            if (darkness > 0.1 && glowEnergy > 0.01) {
                var mBorderAlpha = Math.min(0.15, glowEnergy * breathMod * 0.18);
                txMeter.style.borderColor = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + mBorderAlpha + ')';
            } else {
                txMeter.style.borderColor = '';
            }
        }

        requestAnimationFrame(update);
    }

    // Start loop
    requestAnimationFrame(update);

})();
