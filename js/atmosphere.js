/* ============================================
   FATA ORGANA — Atmosphere
   Particle system driven by per-track visual
   score (JSON cue sheets).
   ============================================ */

(function() {
    'use strict';

    var canvas = document.createElement('canvas');
    canvas.id = 'atmosphere';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    document.body.insertBefore(canvas, document.body.firstChild);

    var ctx = canvas.getContext('2d');
    var width = 0;
    var height = 0;
    var time = 0;
    var glitchTimer = 200;
    var glitchActive = false;
    var glitchIntensity = 0;

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }

    window.addEventListener('resize', resize);
    resize();

    function getSignal() {
        return window.vuSignal || {
            rms: 0, low: 0, high: 0, peak: 0,
            isPlaying: false, hasStarted: false,
            smoothRms: 0, smoothLow: 0
        };
    }

    // Seeded PRNG for deterministic positions
    function seedRandom(seed) {
        return function() {
            seed = (seed * 16807 + 0) % 2147483647;
            return (seed - 1) / 2147483646;
        };
    }

    function clampX(x) { return Math.max(30, Math.min(width - 30, x)); }
    function clampY(y) { return Math.max(30, Math.min(height - 30, y)); }

    // =========================================
    // VISUAL SCORE — Cue System
    // =========================================

    var scoreMap = {
        'https://media.fataorgana.fm/episodes/Teaser-Intro.mp3': '/data/score_intro.json',
        'https://media.fataorgana.fm/episodes/E1%20V3.mp3?v=2': '/data/score_ep01.json',
        'https://media.fataorgana.fm/episodes/E1%20V3.mp3': '/data/score_ep01.json',
        'https://media.fataorgana.fm/episodes/Attrition%20Final.mp3?v=2': '/data/score_ep01_score.json',
        'https://media.fataorgana.fm/episodes/Attrition%20Final.mp3': '/data/score_ep01_score.json'
    };

    var activeCues = null;
    var currentCueIdx = -1;

    // The interpolated state that drives particles each frame
    var cueState = cloneState(DEFAULT_STATE);
    var cueTransitionStart = 0;
    var cueTransitionDur = 0;
    var cueFrom = {};
    var cueTo = {};
    // Track the "accumulated" state — each cue overrides only the fields it specifies
    var accumulatedState = cloneState(DEFAULT_STATE);
    // Pattern position blending
    var prevPattern = 'scatter';
    var prevParams = {};
    var positionBlend = 1; // 1 = fully at current pattern, 0 = fully at previous

    var DEFAULT_STATE = {
        speed: 1,
        pattern: 'scatter',
        rotation: 0.0002,
        attraction: 0.006,
        wander: 0.006,
        damping: 0.95,
        connectionDist: 0,
        connectionAlpha: 0,
        brightness: 1,
        size: 1,
        hueShift: 0,
        satShift: 0,
        litShift: 0,
        params: {}
    };

    function cloneState(s) {
        var out = {};
        for (var k in s) {
            if (k === 'params') out.params = JSON.parse(JSON.stringify(s[k] || {}));
            else out[k] = s[k];
        }
        return out;
    }

    // Merge override fields onto base
    function mergeState(base, override) {
        var out = cloneState(base);
        for (var k in override) {
            if (k === 't' || k === 'transition') continue;
            if (k === 'params') {
                if (!out.params) out.params = {};
                for (var pk in override.params) out.params[pk] = override.params[pk];
            } else {
                out[k] = override[k];
            }
        }
        return out;
    }

    // Lerp numeric fields, snap string fields at t=1
    function lerpState(a, b, t) {
        var out = {};
        for (var k in DEFAULT_STATE) {
            if (k === 'pattern') {
                // Always use the target pattern — position blending handles the visual transition
                out[k] = b[k] || DEFAULT_STATE[k];
            } else if (k === 'params') {
                // Lerp numeric params, snap others
                out.params = {};
                var ap = a.params || {};
                var bp = b.params || {};
                var allKeys = {};
                for (var pk in ap) allKeys[pk] = true;
                for (var pk2 in bp) allKeys[pk2] = true;
                for (var pk3 in allKeys) {
                    if (typeof ap[pk3] === 'number' && typeof bp[pk3] === 'number') {
                        out.params[pk3] = ap[pk3] + (bp[pk3] - ap[pk3]) * t;
                    } else {
                        out.params[pk3] = t < 0.5 ? (ap[pk3] !== undefined ? ap[pk3] : bp[pk3]) : (bp[pk3] !== undefined ? bp[pk3] : ap[pk3]);
                    }
                }
            } else {
                var va = (a[k] !== undefined) ? a[k] : DEFAULT_STATE[k];
                var vb = (b[k] !== undefined) ? b[k] : DEFAULT_STATE[k];
                out[k] = va + (vb - va) * t;
            }
        }
        return out;
    }

    // Init
    cueState = cloneState(DEFAULT_STATE);
    accumulatedState = cloneState(DEFAULT_STATE);

    function loadScore(audioUrl) {
        activeCues = null;
        currentCueIdx = -1;
        cueState = cloneState(DEFAULT_STATE);
        accumulatedState = cloneState(DEFAULT_STATE);

        var path = scoreMap[audioUrl] || scoreMap[audioUrl.split('?')[0]];
        if (!path) return;

        fetch(path)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (data && data.cues && data.cues.length > 0) {
                    activeCues = data.cues;
                    // Apply first cue if t=0
                    if (activeCues[0].t === 0) {
                        accumulatedState = mergeState(DEFAULT_STATE, activeCues[0]);
                        cueState = cloneState(accumulatedState);
                        currentCueIdx = 0;
                    }
                }
            })
            .catch(function(e) { console.error('Score load error:', e); });
    }

    function updateCues(audioTime) {
        if (!activeCues) return;

        // Find which cue we should be on
        var newIdx = -1;
        for (var i = 0; i < activeCues.length; i++) {
            if (activeCues[i].t <= audioTime) newIdx = i;
            else break;
        }

        // New cue triggered
        if (newIdx !== currentCueIdx && newIdx >= 0) {
            // If seeking backward, rebuild accumulated state from scratch
            if (newIdx < currentCueIdx || currentCueIdx < 0) {
                accumulatedState = cloneState(DEFAULT_STATE);
                for (var ri = 0; ri <= newIdx; ri++) {
                    accumulatedState = mergeState(accumulatedState, activeCues[ri]);
                }
            } else {
                // Forward: merge all skipped cues in order
                for (var fi = currentCueIdx + 1; fi <= newIdx; fi++) {
                    accumulatedState = mergeState(accumulatedState, activeCues[fi]);
                }
            }

            var cue = activeCues[newIdx];
            cueFrom = cloneState(cueState);
            cueTo = cloneState(accumulatedState);

            // Capture previous pattern for position blending
            prevPattern = cueFrom.pattern || 'scatter';
            prevParams = cueFrom.params ? JSON.parse(JSON.stringify(cueFrom.params)) : {};
            
            // Transition duration — clamp to gap before next cue
            var requestedDur = cue.transition || 0;
            if (requestedDur > 0 && newIdx < activeCues.length - 1) {
                var gap = activeCues[newIdx + 1].t - cue.t;
                if (requestedDur > gap) requestedDur = gap;
            }
            cueTransitionDur = requestedDur;
            cueTransitionStart = audioTime;
            positionBlend = 0;
            currentCueIdx = newIdx;

            // No transition — snap immediately
            if (cueTransitionDur <= 0) {
                cueState = cloneState(cueTo);
                positionBlend = 1;
            }
        }

        // Interpolate during transition
        if (cueTransitionDur > 0 && positionBlend < 1) {
            var elapsed = audioTime - cueTransitionStart;
            var t = Math.min(1, elapsed / cueTransitionDur);
            // Smoothstep
            t = t * t * (3 - 2 * t);
            cueState = lerpState(cueFrom, cueTo, t);
            positionBlend = t;
        }
    }

    // Track changes — check frequently and also load on first detection
    var lastSrc = '';
    function checkTrackChange() {
        var a = window._fataAudio;
        var src = a ? a.src : '';
        if (src && src !== lastSrc) {
            lastSrc = src;
            loadScore(src);
        }
    }

    checkTrackChange();
    setInterval(checkTrackChange, 1000);

    // =========================================
    // PATTERN LIBRARY
    // =========================================

    function patternPosition(name, idx, count, params, sig) {
        var cx = width / 2;
        var cy = height / 2;
        var t = idx / count;
        var margin = 30;
        var deadR = Math.min(width, height) * 0.23;

        switch (name) {

        case 'scatter': {
            var rng = seedRandom(idx * 7919);
            return {
                x: margin + rng() * (width - margin * 2),
                y: margin + rng() * (height - margin * 2)
            };
        }

        case 'grid': {
            var cols = Math.ceil(Math.sqrt(count * (width / height)));
            var rows = Math.ceil(count / cols);
            var col = idx % cols;
            var row = Math.floor(idx / cols);
            var gx = margin + (col + 0.5) * ((width - margin * 2) / cols);
            var gy = margin + (row + 0.5) * ((height - margin * 2) / rows);
            var gdx = gx - cx, gdy = gy - cy;
            var gDist = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
            if (gDist < deadR) {
                gx = cx + (gdx / gDist) * (deadR + 20);
                gy = cy + (gdy / gDist) * (deadR + 20);
            }
            return { x: gx, y: gy };
        }

        case 'spiral': {
            var arms = (params && params.arms) || 3;
            var tightness = (params && params.tightness) || 0.8;
            var arm = idx % arms;
            var armT = Math.floor(idx / arms) / Math.ceil(count / arms);
            var sa = armT * Math.PI * 6 * tightness + (arm * Math.PI * 2 / arms);
            var sr = deadR + 30 + armT * (Math.max(width, height) * 0.42);
            return { x: clampX(cx + Math.cos(sa) * sr), y: clampY(cy + Math.sin(sa) * sr) };
        }

        case 'concentric': {
            var numRings = (params && params.rings) || 5;
            var ring = Math.floor(t * numRings);
            var ringT = (t * numRings) % 1;
            var ringR = deadR + 40 + ring * ((Math.min(width, height) * 0.42) / numRings);
            var ringA = ringT * Math.PI * 2 + ring * 0.4;
            return { x: clampX(cx + Math.cos(ringA) * ringR), y: clampY(cy + Math.sin(ringA) * ringR) };
        }

        case 'lattice': {
            var spacing = (params && params.spacing) || 40;
            var side = Math.ceil(Math.pow(count, 1/3));
            var xi = idx % side;
            var yi = Math.floor(idx / side) % side;
            var zi = Math.floor(idx / (side * side));
            var ox = (xi - side/2) * spacing;
            var oy = (yi - side/2) * spacing;
            var oz = (zi - side/2) * spacing * 0.6;
            var perspective = 400;
            var lScale = perspective / (perspective + oz);
            var lx = cx + ox * lScale, ly = cy + oy * lScale;
            // Push outward if inside dead zone
            var ldx = lx - cx, ldy = ly - cy, lDist = Math.sqrt(ldx*ldx + ldy*ldy);
            var lDeadR = Math.min(width, height) * 0.22;
            if (lDist < lDeadR && lDist > 0) {
                var lPush = (lDeadR + spacing * 0.5) / lDist;
                lx = cx + ldx * lPush; ly = cy + ldy * lPush;
            }
            return { x: lx, y: ly };
        }

        case 'waveform': {
            var freq = (params && params.frequency) || 2;
            var amp = (params && params.amplitude) || 80;
            var wx = margin + t * (width - margin * 2);
            var wy = cy + Math.sin(t * Math.PI * 2 * freq) * amp;
            return { x: wx, y: wy };
        }

        case 'helix': {
            var strand = idx % 2;
            var helixT = Math.floor(idx / 2) / Math.ceil(count / 2);
            var hFreq = (params && params.frequency) || 3;
            var hAmp = (params && params.amplitude) || 60;
            var hx = margin + helixT * (width - margin * 2);
            var phase = strand * Math.PI;
            var hy = cy + Math.sin(helixT * Math.PI * 2 * hFreq + phase) * hAmp;
            return { x: hx, y: hy };
        }

        case 'fibonacci': {
            var golden = (1 + Math.sqrt(5)) / 2;
            var fAngle = idx * golden * Math.PI * 2;
            var fR = deadR + Math.sqrt(idx / count) * (Math.min(width, height) * 0.42);
            return { x: clampX(cx + Math.cos(fAngle) * fR), y: clampY(cy + Math.sin(fAngle) * fR) };
        }

        case 'lissajous': {
            var la = (params && params.a) || 3;
            var lb = (params && params.b) || 2;
            var ld = (params && params.delta) || Math.PI / 2;
            var lScale = Math.min(width, height) * 0.35;
            return {
                x: cx + Math.sin(la * t * Math.PI * 2 + ld) * lScale,
                y: cy + Math.sin(lb * t * Math.PI * 2) * lScale
            };
        }

        case 'converge': {
            var tx = (params && params.x !== undefined) ? params.x * width : cx;
            var ty = (params && params.y !== undefined) ? params.y * height : cy;
            var cAngle = (idx / count) * Math.PI * 2;
            var cR = (params && params.radius) || 3;
            return { x: tx + Math.cos(cAngle) * cR, y: ty + Math.sin(cAngle) * cR };
        }

        case 'explode': {
            var eAngle = seedRandom(idx * 3571)() * Math.PI * 2;
            var eR = Math.max(width, height) * 0.6 + seedRandom(idx * 9137)() * 100;
            return { x: clampX(cx + Math.cos(eAngle) * eR), y: clampY(cy + Math.sin(eAngle) * eR) };
        }

        case 'ring': {
            var ringRadius = (params && params.radius) || Math.min(width, height) * 0.3;
            var rAngle = t * Math.PI * 2;
            return { x: cx + Math.cos(rAngle) * ringRadius, y: cy + Math.sin(rAngle) * ringRadius };
        }

        case 'column': {
            var colW = (params && params.width) || 60;
            var rng2 = seedRandom(idx * 4513);
            return {
                x: cx + (rng2() - 0.5) * colW,
                y: margin + t * (height - margin * 2)
            };
        }

        case 'horizon': {
            var hY = (params && params.y !== undefined) ? params.y * height : cy;
            var spread = (params && params.spread) || 8;
            var rng3 = seedRandom(idx * 2741);
            return {
                x: margin + t * (width - margin * 2),
                y: hY + (rng3() - 0.5) * spread
            };
        }

        case 'stl': {
            var stlFile = params && params.file;
            if (stlFile && window.stlLoader) {
                window.stlLoader.loadSTLFromURL(stlFile, count, function() {});
                var autoRotY = (params && params.rotateY) || 0;
                var stlParams = {
                    file: stlFile,
                    rotateX: (params && params.rotateX) || 0,
                    rotateY: autoRotY + time * ((params && params.spinY) || 0),
                    rotateZ: (params && params.rotateZ) || 0,
                    scale: (params && params.scale) || 1,
                    perspective: (params && params.perspective) || 400,
                    offsetX: (params && params.offsetX) || 0,
                    offsetY: (params && params.offsetY) || 0
                };
                var pos = window.stlLoader.getSTLPosition(idx, count, width, height, stlParams);
                if (pos) return pos;
            }
            return patternPosition('scatter', idx, count, params, sig);
        }

        case 'waveform_reactive': {
            var wrAmp = (params && params.amplitude) || 120;
            var wrFreq = (params && params.frequency) || 3;
            var wrLayers = (params && params.layers) || 1;
            var s = sig || { smoothRms: 0, low: 0, high: 0, rms: 0, smoothLow: 0, isPlaying: false };
            
            var layer = idx % wrLayers;
            var layerT = Math.floor(idx / wrLayers) / Math.ceil(count / wrLayers);
            var layerOffset = (layer - (wrLayers - 1) / 2) * 25;
            
            var xPos = margin + layerT * (width - margin * 2);
            
            // When not playing, particles sit flat on the horizon
            if (!s.isPlaying || s.smoothRms < 0.01) {
                return { x: xPos, y: cy + layerOffset };
            }
            
            // Voice energy = mid range (rms minus bass and treble)
            var voice = Math.max(0, s.rms - s.smoothLow * 0.5 - s.high * 0.3);
            var bassEnergy = s.smoothLow;
            var highEnergy = s.high;
            
            // Voice is the primary driver
            var voiceWave = Math.sin(layerT * Math.PI * 2 * wrFreq) * voice * wrAmp * 2.5;
            var bassWave = Math.sin(layerT * Math.PI * 2 * 1.5) * bassEnergy * wrAmp * 0.6;
            var highWave = Math.sin(layerT * Math.PI * 2 * 8 + time * 0.02) * highEnergy * wrAmp * 0.3;
            
            var yPos = cy + voiceWave + bassWave + highWave + layerOffset;
            
            return { x: xPos, y: clampY(yPos) };
        }

        case 'grid_reactive': {
            var grCols = (params && params.cols) || 16;
            var grRows = (params && params.rows) || Math.ceil(count / grCols);
            var grAmp = (params && params.amplitude) || 150;
            var grSphereR = (params && params.sphereRadius) || 3;
            var s2 = sig || { smoothRms: 0, low: 0, high: 0, rms: 0, smoothLow: 0, isPlaying: false };
            
            var col = idx % grCols;
            var row = Math.floor(idx / grCols);
            if (row >= grRows) row = grRows - 1;
            
            var gx = margin + (col + 0.5) * ((width - margin * 2) / grCols);
            var baseGy = margin + (row + 0.5) * ((height - margin * 2) / grRows);
            
            // When not playing, particles sit in a static grid
            if (!s2.isPlaying || s2.smoothRms < 0.01) {
                return { x: gx, y: baseGy };
            }
            
            // Voice energy = sphere size and movement speed
            var voice2 = Math.max(0, s2.rms - s2.smoothLow * 0.5 - s2.high * 0.3);
            
            // Sphere position travels across the grid driven by audio
            // Main sphere follows a lissajous-like path, speed driven by voice
            var sphereSpeed = 0.003 + voice2 * 0.008;
            var sphereX = (Math.sin(time * sphereSpeed * 2.3) * 0.5 + 0.5);
            var sphereY = (Math.sin(time * sphereSpeed * 1.7 + 1.2) * 0.5 + 0.5);
            
            // Second smaller sphere from bass
            var sphere2X = (Math.sin(time * 0.004 * 1.5 + 3.0) * 0.5 + 0.5);
            var sphere2Y = (Math.sin(time * 0.004 * 1.1 + 0.7) * 0.5 + 0.5);
            
            // Normalized grid position (0-1)
            var normCol = col / (grCols - 1);
            var normRow = row / (grRows - 1);
            
            // Distance from each grid point to the sphere center
            var dx1 = normCol - sphereX;
            var dy1 = normRow - sphereY;
            var dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            
            // Sphere influence: gaussian falloff
            var radius1 = grSphereR * 0.1 * (0.5 + voice2 * 1.5);
            var push1 = Math.exp(-(dist1 * dist1) / (2 * radius1 * radius1));
            var displacement1 = push1 * grAmp * (0.3 + voice2 * 1.0);
            
            // Second sphere from bass — smaller, subtler
            var dx2 = normCol - sphere2X;
            var dy2 = normRow - sphere2Y;
            var dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            var radius2 = grSphereR * 0.06 * (0.3 + s2.smoothLow * 1.0);
            var push2 = Math.exp(-(dist2 * dist2) / (2 * radius2 * radius2));
            var displacement2 = push2 * grAmp * 0.5 * s2.smoothLow;
            
            // High frequencies add subtle ripple across the whole grid
            var ripple = Math.sin(normCol * 20 + time * 0.05) * s2.high * grAmp * 0.08;
            
            var totalDisp = -(displacement1 + displacement2 + ripple);
            
            return { x: gx, y: clampY(baseGy + totalDisp) };
        }

        case 'drift': {
            // Ocean current — all particles flow in a direction with variance
            var dSpeed = (params && params.speed) || 0.3;
            var dAngle = (params && params.angle) || 0; // radians, 0 = rightward
            var dSpread = (params && params.spread) || 0.15;
            var dRng = seedRandom(idx * 6133);
            var s3 = sig || { smoothRms: 0, isPlaying: false };

            // Each particle has a slightly different drift angle
            var pAngle = dAngle + (dRng() - 0.5) * dSpread * 2;
            // Audio shifts the drift direction slightly
            var audioShift = s3.isPlaying ? s3.smoothRms * 0.3 : 0;
            pAngle += audioShift;

            // Position wraps around screen — use time to create continuous flow
            var flowT = (time * dSpeed * 0.01 + dRng() * 1000) % 1;
            var crossT = (dRng() * 1000 + time * dSpeed * 0.003 * (0.5 + dRng())) % 1;

            var dx = Math.cos(pAngle), dy = Math.sin(pAngle);
            // Flow along the drift direction, spread perpendicular
            var px = flowT * width * 1.2 - width * 0.1;
            var py = crossT * height;
            // Rotate by drift angle
            var finalX = cx + (px - cx) * Math.cos(dAngle) - (py - cy) * Math.sin(dAngle);
            var finalY = cy + (px - cx) * Math.sin(dAngle) + (py - cy) * Math.cos(dAngle);

            return { x: clampX(finalX), y: clampY(finalY) };
        }

        case 'dissolve': {
            // Particles hold positions then randomly detach and drift away
            var dRate = (params && params.rate) || 0.3; // 0-1, how dissolved
            var dBase = (params && params.base) || 'ring'; // base pattern to dissolve from
            var dRng2 = seedRandom(idx * 4271);
            var s4 = sig || { smoothRms: 0, isPlaying: false };

            // Audio increases dissolution rate
            var effectiveRate = dRate + (s4.isPlaying ? s4.smoothRms * 0.2 : 0);

            // Each particle has a dissolve threshold
            var threshold = dRng2();
            if (threshold < effectiveRate) {
                // Dissolved — drift away from center
                var driftAngle = dRng2() * Math.PI * 2;
                var driftDist = (effectiveRate - threshold) * Math.max(width, height) * 0.5;
                var basePos = patternPosition(dBase, idx, count, params, sig);
                return {
                    x: clampX(basePos.x + Math.cos(driftAngle) * driftDist),
                    y: clampY(basePos.y + Math.sin(driftAngle) * driftDist)
                };
            } else {
                // Still in formation
                return patternPosition(dBase, idx, count, params, sig);
            }
        }

        case 'breathe': {
            // Synchronized expand/contract pulse from center
            var bRate = (params && params.rate) || 0.5;
            var bMin = (params && params.min) || 0.6;
            var bMax = (params && params.max) || 1.3;
            var s5 = sig || { smoothRms: 0, isPlaying: false };
            var bDeadR = Math.min(width, height) * 0.23;

            var breathPhase;
            if (s5.isPlaying && s5.smoothRms > 0.01) {
                breathPhase = bMin + (bMax - bMin) * s5.smoothRms * 2;
                breathPhase = Math.min(breathPhase, bMax);
            } else {
                breathPhase = bMin + (bMax - bMin) * (Math.sin(time * bRate * 0.02) * 0.5 + 0.5);
            }

            // Distribute in layers, starting OUTSIDE the dead zone
            var bAngle = (idx / count) * Math.PI * 2;
            var bLayers = Math.ceil(Math.sqrt(count / Math.PI));
            var bLayer = Math.floor(idx / Math.max(1, Math.ceil(count / bLayers)));
            var bLayerT = bLayer / bLayers;
            var bMinR = bDeadR + 15; // start just outside the transmitter
            var bMaxR = Math.min(width, height) * 0.42;
            var bRadius = (bMinR + bLayerT * (bMaxR - bMinR)) * breathPhase;
            var bA = bAngle + bLayer * 0.3;

            return { x: cx + Math.cos(bA) * bRadius, y: cy + Math.sin(bA) * bRadius };
        }

        case 'interference': {
            // Two overlapping wave patterns creating moiré
            var iFreq1 = (params && params.freq1) || 3;
            var iFreq2 = (params && params.freq2) || 3.7;
            var iAngle2 = (params && params.angle) || 0.4; // radians offset
            var iAmp = (params && params.amplitude) || 80;
            var s6 = sig || { smoothRms: 0, isPlaying: false };

            // Grid base position
            var iCols = Math.ceil(Math.sqrt(count * (width / height)));
            var iRows = Math.ceil(count / iCols);
            var iCol = idx % iCols;
            var iRow = Math.floor(idx / iCols);
            var ix = margin + (iCol + 0.5) * ((width - margin * 2) / iCols);
            var iy = margin + (iRow + 0.5) * ((height - margin * 2) / iRows);

            // Two wave systems
            var wave1 = Math.sin((ix / width) * Math.PI * 2 * iFreq1 + time * 0.008);
            var wave2 = Math.sin(((ix * Math.cos(iAngle2) + iy * Math.sin(iAngle2)) / width) * Math.PI * 2 * iFreq2 + time * 0.006);

            // Interference = sum
            var combined = (wave1 + wave2) * iAmp * 0.5;
            // Audio amplifies the interference
            if (s6.isPlaying) combined *= (0.5 + s6.smoothRms * 1.5);
            else combined *= 0.3;

            return { x: ix, y: clampY(iy + combined) };
        }

        case 'fragment': {
            // Small clusters orbiting independently — isolated consciousness islands
            var fGroups = (params && params.groups) || 7;
            var fOrbitSpeed = (params && params.orbitSpeed) || 0.3;
            var fSpread = (params && params.spread) || 15;
            var fRng = seedRandom(idx * 8311);
            var s7 = sig || { smoothRms: 0, isPlaying: false };

            // Assign particle to a group
            var group = idx % fGroups;
            var gRng = seedRandom(group * 1337);

            // Each group has its own orbit center and radius
            var gAngle = (group / fGroups) * Math.PI * 2 + gRng() * 0.5;
            var fDeadR = Math.min(width, height) * 0.24;
            var gRadius = fDeadR + 30 + gRng() * (Math.min(width, height) * 0.25);
            var gOrbitPhase = time * fOrbitSpeed * 0.005 * (0.5 + gRng() * 0.5) + gRng() * Math.PI * 2;

            var gCenterX = cx + Math.cos(gAngle + gOrbitPhase) * gRadius;
            var gCenterY = cy + Math.sin(gAngle + gOrbitPhase * 0.7) * gRadius;

            // Particles within group cluster tightly
            var localAngle = fRng() * Math.PI * 2;
            var localR = fRng() * fSpread;
            // Audio makes groups drift further apart
            if (s7.isPlaying) gRadius *= (1 + s7.smoothRms * 0.5);

            return {
                x: clampX(gCenterX + Math.cos(localAngle) * localR),
                y: clampY(gCenterY + Math.sin(localAngle) * localR)
            };
        }

        case 'filament': {
            // Thin threads stretching between anchor points
            var fAnchors = (params && params.anchors) || 5;
            var fThickness = (params && params.thickness) || 4;
            var s8 = sig || { smoothRms: 0, isPlaying: false };
            var fRng2 = seedRandom(idx * 5591);

            // Create anchor points around the space
            var thread = idx % fAnchors;
            var threadT = Math.floor(idx / fAnchors) / Math.ceil(count / fAnchors);
            var tRng = seedRandom(thread * 2903);

            // Two anchor points per thread
            var ax1 = margin + tRng() * (width - margin * 2);
            var ay1 = margin + tRng() * (height - margin * 2);
            var ax2 = margin + tRng() * (width - margin * 2);
            var ay2 = margin + tRng() * (height - margin * 2);

            // Position along the thread with slight perpendicular offset
            var perpAngle = Math.atan2(ay2 - ay1, ax2 - ax1) + Math.PI / 2;
            var perpOffset = (fRng2() - 0.5) * fThickness;
            // Audio makes filaments vibrate
            if (s8.isPlaying) {
                perpOffset += Math.sin(threadT * Math.PI * 8 + time * 0.03) * s8.smoothRms * 20;
            }

            return {
                x: clampX(ax1 + (ax2 - ax1) * threadT + Math.cos(perpAngle) * perpOffset),
                y: clampY(ay1 + (ay2 - ay1) * threadT + Math.sin(perpAngle) * perpOffset)
            };
        }

        default:
            return patternPosition('scatter', idx, count, params, sig);
        }
    }

    // Push any position outside the center dead zone
    // This applies to ALL patterns universally
    function excludeDeadZone(pos) {
        var cx = width / 2, cy = height / 2;
        var deadR = Math.min(width, height) * 0.22; // slightly larger than the transmitter
        var dx = pos.x - cx, dy = pos.y - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < deadR && dist > 0) {
            // Push to the edge of the dead zone + small buffer
            var scale = (deadR + 10) / dist;
            return { x: cx + dx * scale, y: cy + dy * scale };
        }
        if (dist === 0) {
            // Exactly at center — push in a seeded direction
            var angle = (pos.x * 7 + pos.y * 13) % (Math.PI * 2);
            return { x: cx + Math.cos(angle) * (deadR + 10), y: cy + Math.sin(angle) * (deadR + 10) };
        }
        return pos;
    }

    // =========================================
    // PARTICLES
    // =========================================

    var PARTICLE_COUNT = Math.min(Math.floor(window.innerWidth * window.innerHeight / 4000), 300);
    // Reduce on mobile for performance
    var isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobileDevice) PARTICLE_COUNT = Math.min(PARTICLE_COUNT, 150);
    var particles = [];

    function createParticle(idx) {
        var rng = seedRandom(idx * 7919);
        return {
            x: rng() * width,
            y: rng() * height,
            size: rng() * 1.8 + 0.5,
            baseAlpha: rng() * 0.4 + 0.15,
            alpha: 0,
            vx: 0,
            vy: 0,
            phase: rng() * Math.PI * 2,
            freq: rng() * 0.008 + 0.002,
            hue: 38 + rng() * 15,
            sat: 30 + rng() * 30,
            lit: 55 + rng() * 25,
            idx: idx,
            wanderAngle: rng() * Math.PI * 2
        };
    }

    for (var i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(createParticle(i));
    }

    // Signal lines
    var signalLines = [];
    function createSignal() {
        return {
            y: Math.random() * height, alpha: 0,
            targetAlpha: Math.random() * 0.06 + 0.02,
            w: Math.random() * width * 0.6 + width * 0.1,
            x: Math.random() * width * 0.5,
            thickness: Math.random() < 0.3 ? 1.5 : 0.5,
            speed: (Math.random() - 0.5) * 0.15,
            life: Math.random() * 600 + 200, maxLife: 0,
            phase: Math.random() * Math.PI * 2
        };
    }
    function resetSignal(s) {
        s.y = Math.random() * height;
        s.targetAlpha = Math.random() * 0.06 + 0.02;
        s.w = Math.random() * width * 0.6 + width * 0.1;
        s.x = Math.random() * width * 0.5;
        s.thickness = Math.random() < 0.3 ? 1.5 : 0.5;
        s.speed = (Math.random() - 0.5) * 0.15;
        s.life = Math.random() * 600 + 200; s.maxLife = s.life;
        s.phase = Math.random() * Math.PI * 2;
    }
    for (var j = 0; j < 8; j++) {
        var sl = createSignal(); sl.maxLife = sl.life; signalLines.push(sl);
    }

    var reactivity = 0;

    // =========================================
    // RENDER
    // =========================================

    var lastFrameTime = 0;

    function render(timestamp) {
        // Delta time — normalize to 60fps (16.67ms)
        var dt = 1;
        if (lastFrameTime > 0 && timestamp) {
            var rawDt = timestamp - lastFrameTime;
            dt = Math.min(rawDt / 16.67, 3); // cap at 3x to prevent huge jumps
        }
        lastFrameTime = timestamp || 0;

        time++;
        var sig = getSignal();

        var targetReactivity = sig.isPlaying ? 1 : 0;
        reactivity += (targetReactivity - reactivity) * 0.005;

        // Audio time
        var audioTime = 0;
        var a = window._fataAudio;
        if (a && a.duration > 0 && !isNaN(a.duration)) {
            audioTime = a.currentTime;
        }

        updateCues(audioTime);

        // Read state
        var speed = cueState.speed || 1;
        var pattern = cueState.pattern || 'scatter';
        var rotation = cueState.rotation || 0.0002;
        var attraction = cueState.attraction || 0.006;
        var wander = cueState.wander || 0.006;
        var damping = cueState.damping || 0.95;
        var connDist = cueState.connectionDist || 0;
        var connAlpha = cueState.connectionAlpha || 0;
        var brightness = cueState.brightness || 1;
        var sizeMult = cueState.size || 1;
        var hueShift = cueState.hueShift || 0;
        var satShift = cueState.satShift || 0;
        var litShift = cueState.litShift || 0;
        var params = cueState.params || {};

        // Glitch
        glitchTimer--;
        if (!glitchActive && glitchTimer <= 0) {
            if (Math.random() > 0.6) {
                glitchActive = true;
                glitchIntensity = Math.random() * 0.6 + 0.1;
                glitchTimer = Math.floor(Math.random() * 8) + 2;
            } else {
                glitchTimer = Math.floor(Math.random() * 300) + 150;
            }
        }
        if (glitchActive) {
            glitchTimer--;
            if (glitchTimer <= 0) {
                glitchActive = false;
                glitchTimer = Math.floor(Math.random() * 400) + 200;
            }
        }
        if (sig.peak > 0.7 && sig.isPlaying && Math.random() > 0.92) {
            glitchActive = true;
            glitchIntensity = sig.peak * 0.5;
            glitchTimer = Math.floor(Math.random() * 6) + 2;
        }

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Vignette
        var grad = ctx.createRadialGradient(
            width / 2, height / 2, height * 0.2,
            width / 2, height / 2, height * 0.9
        );
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, 'rgba(10, 10, 12, 0.2)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Signal lines
        for (var si = 0; si < signalLines.length; si++) {
            var sln = signalLines[si];
            sln.life--;
            var slPct = sln.life / sln.maxLife;
            var slFade = slPct < 0.1 ? slPct / 0.1 : slPct > 0.9 ? (1 - slPct) / 0.1 : 1;
            sln.alpha = sln.targetAlpha * slFade;
            sln.y += sln.speed;
            sln.x += Math.sin(time * 0.0005 + sln.phase) * 0.15;
            if (sig.isPlaying) sln.alpha *= (1 + sig.smoothRms * 1.5);
            if (glitchActive && Math.random() > 0.85) {
                sln.alpha = Math.min(sln.targetAlpha * 4, 0.15);
                sln.x += (Math.random() - 0.5) * 10;
            }
            if (sln.alpha > 0.005) {
                ctx.beginPath();
                ctx.moveTo(sln.x, sln.y);
                ctx.lineTo(sln.x + sln.w, sln.y);
                ctx.strokeStyle = 'hsla(40, 25%, 70%, ' + sln.alpha + ')';
                ctx.lineWidth = sln.thickness;
                ctx.stroke();
            }
            if (sln.life <= 0) resetSignal(sln);
        }

        // Global rotation
        var cx = width / 2;
        var cy = height / 2;
        var deadR = Math.min(width, height) * 0.23;
        var patternRotation = time * rotation;
        var cosR = Math.cos(patternRotation);
        var sinR = Math.sin(patternRotation);

        // Particles
        for (var pi = 0; pi < particles.length; pi++) {
            var pt = particles[pi];

            var targetX, targetY;
            if (positionBlend >= 1) {
                var target = patternPosition(pattern, pt.idx, particles.length, params, sig);
                targetX = target.x;
                targetY = target.y;
            } else {
                // Blend between previous and current pattern positions
                var fromPos = patternPosition(prevPattern, pt.idx, particles.length, prevParams, sig);
                var toPos = patternPosition(pattern, pt.idx, particles.length, params, sig);
                targetX = fromPos.x + (toPos.x - fromPos.x) * positionBlend;
                targetY = fromPos.y + (toPos.y - fromPos.y) * positionBlend;
            }

            // Rotation
            var rtx = targetX - cx;
            var rty = targetY - cy;
            targetX = cx + rtx * cosR - rty * sinR;
            targetY = cy + rtx * sinR + rty * cosR;

            // Audio displacement
            var audioDisp = sig.smoothRms * reactivity;
            var dispAngle = time * 0.001 + pt.phase;
            targetX += Math.sin(dispAngle) * audioDisp * 15;
            targetY += Math.cos(dispAngle * 0.7) * audioDisp * 10;

            // Exclude from center dead zone (transmitter area)
            var excluded = excludeDeadZone({ x: targetX, y: targetY });
            targetX = excluded.x;
            targetY = excluded.y;

            // Movement — always attract to pattern, stronger when playing
            var activeAttraction = attraction * speed * dt;
            if (reactivity < 0.1) {
                pt.vx += (targetX - pt.x) * activeAttraction * 0.3;
                pt.vy += (targetY - pt.y) * activeAttraction * 0.3;
                pt.wanderAngle += (Math.random() - 0.5) * 0.02 * dt;
                pt.vx += Math.cos(pt.wanderAngle) * wander * dt;
                pt.vy += Math.sin(pt.wanderAngle) * wander * dt;
            } else {
                pt.vx += (targetX - pt.x) * activeAttraction;
                pt.vy += (targetY - pt.y) * activeAttraction;
                pt.wanderAngle += (Math.random() - 0.5) * 0.01 * dt;
                pt.vx += Math.cos(pt.wanderAngle) * wander * 0.3 * speed * dt;
                pt.vy += Math.sin(pt.wanderAngle) * wander * 0.3 * speed * dt;
            }

            // Center repulsion — strong push to keep particles out of transmitter
            var cdx = pt.x - cx;
            var cdy = pt.y - cy;
            var cDist = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
            if (cDist < deadR) {
                var repel = (1 - cDist / deadR) * 0.3 * dt;
                pt.vx += (cdx / cDist) * repel;
                pt.vy += (cdy / cDist) * repel;
            }

            // Frame-rate independent damping: damping^dt
            var frameDamping = Math.pow(damping, dt);
            pt.vx *= frameDamping;
            pt.vy *= frameDamping;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;

            if (pt.x < 10) { pt.x = 10; pt.vx *= -0.5; }
            if (pt.x > width - 10) { pt.x = width - 10; pt.vx *= -0.5; }
            if (pt.y < 10) { pt.y = 10; pt.vy *= -0.5; }
            if (pt.y > height - 10) { pt.y = height - 10; pt.vy *= -0.5; }

            // Alpha
            var breathe = Math.sin(time * pt.freq + pt.phase) * 0.3 + 0.7;
            pt.alpha = pt.baseAlpha * breathe * brightness;
            if (sig.isPlaying) pt.alpha *= (1 + sig.smoothRms * 0.8);
            if (glitchActive && Math.random() > 0.93) {
                pt.x += (Math.random() - 0.5) * glitchIntensity * 15;
                pt.alpha = Math.min(pt.alpha * 2, 0.7);
            }

            if (pt.alpha > 0.01) {
                var drawSize = pt.size * sizeMult * (1 + sig.smoothRms * 0.3);
                var h = pt.hue + hueShift;
                var s = Math.max(0, Math.min(100, pt.sat + satShift));
                var l = Math.max(0, Math.min(100, pt.lit + litShift));
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, drawSize, 0, Math.PI * 2);
                ctx.fillStyle = 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + pt.alpha + ')';
                ctx.fill();
            }
        }

        // Connection lines
        if (connAlpha > 0.002 && connDist > 0) {
            var connDistSq = connDist * connDist;
            var maxConns = Math.min(particles.length, 200);
            ctx.lineWidth = 0.4;
            for (var ci = 0; ci < maxConns; ci++) {
                var pa = particles[ci];
                if (pa.alpha < 0.03) continue;
                for (var cj = ci + 1; cj < maxConns; cj++) {
                    var pb = particles[cj];
                    if (pb.alpha < 0.03) continue;
                    var ldx = pa.x - pb.x;
                    var ldy = pa.y - pb.y;
                    var ldSq = ldx * ldx + ldy * ldy;
                    if (ldSq < connDistSq) {
                        var proximity = 1 - ldSq / connDistSq;
                        var lineAlpha = connAlpha * proximity * Math.min(pa.alpha, pb.alpha) * 1.5;
                        if (lineAlpha > 0.002) {
                            ctx.beginPath();
                            ctx.moveTo(pa.x, pa.y);
                            ctx.lineTo(pb.x, pb.y);
                            ctx.strokeStyle = 'hsla(40, 25%, 65%, ' + lineAlpha + ')';
                            ctx.stroke();
                        }
                    }
                }
            }
        }

        // Glitch tear
        if (glitchActive && Math.random() > 0.7) {
            var tearY = Math.random() * height;
            var tearH = Math.random() * 2 + 0.5;
            ctx.fillStyle = 'hsla(40, 20%, 50%, ' + (glitchIntensity * 0.06) + ')';
            ctx.fillRect(0, tearY, width, tearH);
        }

        // Ambient pulse
        if (Math.random() > 0.999) {
            var pg = ctx.createRadialGradient(width / 2, height * 0.4, 0, width / 2, height * 0.4, height * 0.5);
            pg.addColorStop(0, 'hsla(38, 40%, 60%, 0.02)');
            pg.addColorStop(1, 'transparent');
            ctx.fillStyle = pg;
            ctx.fillRect(0, 0, width, height);
        }

        requestAnimationFrame(render);
    }

    render();

})();
