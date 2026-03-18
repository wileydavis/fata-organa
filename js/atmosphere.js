/* ============================================
   FATA ORGANA — Atmosphere
   Slow particles that form geometric patterns
   over the duration of a track
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
        computePatternPositions();
    }

    window.addEventListener('resize', resize);
    resize();

    // --- Audio ---
    function getSignal() {
        return window.vuSignal || {
            rms: 0, low: 0, high: 0, peak: 0,
            isPlaying: false, hasStarted: false,
            smoothRms: 0, smoothLow: 0
        };
    }

    // --- Pattern generation ---
    // Each particle has target positions for different pattern phases.
    // Progress (0→1 over track) blends between them.

    var PARTICLE_COUNT = Math.min(Math.floor(width * height / 4000), 300);
    var particles = [];

    // Pattern target arrays (computed on resize)
    var gridPositions = [];
    var spiralPositions = [];
    var concentricPositions = [];

    function computePatternPositions() {
        gridPositions = [];
        spiralPositions = [];
        concentricPositions = [];

        var cx = width / 2;
        var cy = height / 2;
        var deadR = Math.min(width, height) * 0.18;
        var margin = 40;

        for (var i = 0; i < PARTICLE_COUNT; i++) {
            var t = i / PARTICLE_COUNT;

            // --- Grid: evenly spaced, avoiding center ---
            var cols = Math.ceil(Math.sqrt(PARTICLE_COUNT * (width / height)));
            var rows = Math.ceil(PARTICLE_COUNT / cols);
            var col = i % cols;
            var row = Math.floor(i / cols);
            var gx = margin + (col + 0.5) * ((width - margin * 2) / cols);
            var gy = margin + (row + 0.5) * ((height - margin * 2) / rows);
            // Push away from center
            var gdx = gx - cx;
            var gdy = gy - cy;
            var gDist = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
            if (gDist < deadR) {
                gx = cx + (gdx / gDist) * (deadR + 20);
                gy = cy + (gdy / gDist) * (deadR + 20);
            }
            gridPositions.push({ x: gx, y: gy });

            // --- Spiral: logarithmic spiral from center outward ---
            var spiralAngle = t * Math.PI * 8 + Math.PI * 0.5;
            var spiralR = deadR + 30 + t * (Math.max(width, height) * 0.45);
            var sx = cx + Math.cos(spiralAngle) * spiralR;
            var sy = cy + Math.sin(spiralAngle) * spiralR;
            // Clamp to screen
            sx = Math.max(margin, Math.min(width - margin, sx));
            sy = Math.max(margin, Math.min(height - margin, sy));
            spiralPositions.push({ x: sx, y: sy });

            // --- Concentric rings ---
            var numRings = 5;
            var ring = Math.floor(t * numRings);
            var ringT = (t * numRings) % 1;
            var ringR = deadR + 40 + ring * ((Math.min(width, height) * 0.42) / numRings);
            var ringAngle = ringT * Math.PI * 2 + ring * 0.4;
            var rx = cx + Math.cos(ringAngle) * ringR;
            var ry = cy + Math.sin(ringAngle) * ringR;
            rx = Math.max(margin, Math.min(width - margin, rx));
            ry = Math.max(margin, Math.min(height - margin, ry));
            concentricPositions.push({ x: rx, y: ry });
        }
    }

    function createParticle(idx) {
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            homeX: Math.random() * width,  // random scatter home
            homeY: Math.random() * height,
            size: Math.random() * 1.8 + 0.5,
            baseAlpha: Math.random() * 0.4 + 0.15,
            alpha: 0,
            vx: 0,
            vy: 0,
            phase: Math.random() * Math.PI * 2,
            freq: Math.random() * 0.008 + 0.002,
            hue: 38 + Math.random() * 15,
            sat: 30 + Math.random() * 30,
            lit: 55 + Math.random() * 25,
            idx: idx,
            // Wander — very slow random drift
            wanderAngle: Math.random() * Math.PI * 2,
            wanderSpeed: Math.random() * 0.0005 + 0.0002
        };
    }

    for (var i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(createParticle(i));
    }

    // --- Signal lines ---
    var signalLines = [];
    function createSignal() {
        return {
            y: Math.random() * height,
            alpha: 0,
            targetAlpha: Math.random() * 0.06 + 0.02,
            w: Math.random() * width * 0.6 + width * 0.1,
            x: Math.random() * width * 0.5,
            thickness: Math.random() < 0.3 ? 1.5 : 0.5,
            speed: (Math.random() - 0.5) * 0.15,
            life: Math.random() * 600 + 200,
            maxLife: 0,
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
        s.life = Math.random() * 600 + 200;
        s.maxLife = s.life;
        s.phase = Math.random() * Math.PI * 2;
    }
    for (var j = 0; j < 8; j++) {
        var s = createSignal();
        s.maxLife = s.life;
        signalLines.push(s);
    }

    // --- State ---
    var reactivity = 0;
    var progress = 0;       // 0→1 over track duration
    var smoothProgress = 0; // smoothed for gentle transitions
    var connectionAlpha = 0;

    computePatternPositions();

    // --- Render ---
    function render() {
        time++;
        var sig = getSignal();

        // --- Reactivity ---
        var targetReactivity = sig.isPlaying ? 1 : 0;
        reactivity += (targetReactivity - reactivity) * 0.005;

        // --- Track progress ---
        // Try to read from audio element duration
        try {
            var audioEls = document.querySelectorAll('audio');
            for (var ai = 0; ai < audioEls.length; ai++) {
                if (audioEls[ai].duration > 0 && !isNaN(audioEls[ai].duration)) {
                    progress = audioEls[ai].currentTime / audioEls[ai].duration;
                    break;
                }
            }
        } catch(e) {}

        // Smooth progress for pattern transitions (never goes backward)
        var targetSmooth = Math.max(smoothProgress, progress);
        smoothProgress += (targetSmooth - smoothProgress) * 0.001;

        // Pattern blend:
        // 0.0 - 0.3: scattered → grid
        // 0.3 - 0.6: grid → concentric rings
        // 0.6 - 1.0: concentric → spiral
        var patternBlend = smoothProgress;

        // Connection alpha grows with progress
        var targetConn = reactivity * smoothProgress * 0.08;
        connectionAlpha += (targetConn - connectionAlpha) * 0.003;

        // --- Glitch ---
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

        // --- Clear ---
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

        // --- Signal lines ---
        for (var si = 0; si < signalLines.length; si++) {
            var sl = signalLines[si];
            sl.life--;
            var slPct = sl.life / sl.maxLife;
            var slFade = slPct < 0.1 ? slPct / 0.1 : slPct > 0.9 ? (1 - slPct) / 0.1 : 1;
            sl.alpha = sl.targetAlpha * slFade;
            sl.y += sl.speed;
            sl.x += Math.sin(time * 0.0005 + sl.phase) * 0.15;

            if (sig.isPlaying) {
                sl.alpha *= (1 + sig.smoothRms * 1.5);
            }

            if (glitchActive && Math.random() > 0.85) {
                sl.alpha = Math.min(sl.targetAlpha * 4, 0.15);
                sl.x += (Math.random() - 0.5) * 10;
            }

            if (sl.alpha > 0.005) {
                ctx.beginPath();
                ctx.moveTo(sl.x, sl.y);
                ctx.lineTo(sl.x + sl.w, sl.y);
                ctx.strokeStyle = 'hsla(40, 25%, 70%, ' + sl.alpha + ')';
                ctx.lineWidth = sl.thickness;
                ctx.stroke();
            }

            if (sl.life <= 0) resetSignal(sl);
        }

        // --- Compute pattern targets per particle ---
        var cx = width / 2;
        var cy = height / 2;
        var deadR = Math.min(width, height) * 0.18;

        // Global rotation — starts visible, speeds up
        var patternRotation = time * (0.00015 + smoothProgress * 0.0003);
        var cosR = Math.cos(patternRotation);
        var sinR = Math.sin(patternRotation);

        // --- Particles ---
        for (var pi = 0; pi < particles.length; pi++) {
            var pt = particles[pi];
            var idx = pt.idx;

            // --- Determine target position based on progress ---
            var targetX, targetY;

            if (patternBlend < 0.3) {
                // Phase 1: scatter → grid
                var blend1 = patternBlend / 0.3;
                blend1 = blend1 * blend1 * (3 - 2 * blend1); // smoothstep
                var g = gridPositions[idx] || { x: pt.homeX, y: pt.homeY };
                targetX = pt.homeX + (g.x - pt.homeX) * blend1;
                targetY = pt.homeY + (g.y - pt.homeY) * blend1;
            } else if (patternBlend < 0.6) {
                // Phase 2: grid → concentric rings
                var blend2 = (patternBlend - 0.3) / 0.3;
                blend2 = blend2 * blend2 * (3 - 2 * blend2);
                var g2 = gridPositions[idx] || { x: cx, y: cy };
                var c = concentricPositions[idx] || { x: cx, y: cy };
                targetX = g2.x + (c.x - g2.x) * blend2;
                targetY = g2.y + (c.y - g2.y) * blend2;
            } else {
                // Phase 3: concentric → spiral
                var blend3 = (patternBlend - 0.6) / 0.4;
                blend3 = blend3 * blend3 * (3 - 2 * blend3);
                var c2 = concentricPositions[idx] || { x: cx, y: cy };
                var sp = spiralPositions[idx] || { x: cx, y: cy };
                targetX = c2.x + (sp.x - c2.x) * blend3;
                targetY = c2.y + (sp.y - c2.y) * blend3;
            }

            // Apply slow global rotation around center
            var rtx = targetX - cx;
            var rty = targetY - cy;
            targetX = cx + rtx * cosR - rty * sinR;
            targetY = cy + rtx * sinR + rty * cosR;

            // Audio-reactive displacement — gentle sway
            var audioDisp = sig.smoothRms * reactivity;
            var dispAngle = time * 0.001 + pt.phase;
            targetX += Math.sin(dispAngle) * audioDisp * 15;
            targetY += Math.cos(dispAngle * 0.7) * audioDisp * 10;

            // --- Move toward target ---
            // Speed starts faster (2x) and ramps to 8x over track duration
            var speedMult = 2 + smoothProgress * 6;
            var attractStrength = (0.004 + smoothProgress * 0.016) * speedMult;

            // When idle, just wander
            if (reactivity < 0.1) {
                pt.wanderAngle += (Math.random() - 0.5) * 0.02;
                pt.vx += Math.cos(pt.wanderAngle) * 0.006;
                pt.vy += Math.sin(pt.wanderAngle) * 0.006;
            } else {
                // Attract toward pattern
                pt.vx += (targetX - pt.x) * attractStrength;
                pt.vy += (targetY - pt.y) * attractStrength;

                // Very subtle wander on top
                pt.wanderAngle += (Math.random() - 0.5) * 0.01;
                pt.vx += Math.cos(pt.wanderAngle) * 0.002 * speedMult;
                pt.vy += Math.sin(pt.wanderAngle) * 0.002 * speedMult;
            }

            // --- Center repulsion ---
            var cdx = pt.x - cx;
            var cdy = pt.y - cy;
            var cDist = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
            if (cDist < deadR) {
                var repel = (1 - cDist / deadR) * 0.08;
                pt.vx += (cdx / cDist) * repel;
                pt.vy += (cdy / cDist) * repel;
            }

            // Damping: less friction from start (0.95), even less by end (0.98)
            var damping = 0.95 + smoothProgress * 0.03;
            pt.vx *= damping;
            pt.vy *= damping;

            pt.x += pt.vx;
            pt.y += pt.vy;

            // Keep on screen (soft bounce)
            if (pt.x < 10) { pt.x = 10; pt.vx *= -0.5; }
            if (pt.x > width - 10) { pt.x = width - 10; pt.vx *= -0.5; }
            if (pt.y < 10) { pt.y = 10; pt.vy *= -0.5; }
            if (pt.y > height - 10) { pt.y = height - 10; pt.vy *= -0.5; }

            // --- Alpha ---
            var breathe = Math.sin(time * pt.freq + pt.phase) * 0.3 + 0.7;
            pt.alpha = pt.baseAlpha * breathe;

            // Brighter as pattern forms
            pt.alpha *= (0.6 + smoothProgress * 0.4);

            // Audio brightness
            if (sig.isPlaying) {
                pt.alpha *= (1 + sig.smoothRms * 0.8);
            }

            // Glitch
            if (glitchActive && Math.random() > 0.93) {
                pt.x += (Math.random() - 0.5) * glitchIntensity * 15;
                pt.alpha = Math.min(pt.alpha * 2, 0.7);
            }

            // --- Draw ---
            if (pt.alpha > 0.01) {
                var drawSize = pt.size * (1 + sig.smoothRms * 0.3);
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, drawSize, 0, Math.PI * 2);
                ctx.fillStyle = 'hsla(' + pt.hue + ', ' + pt.sat + '%, ' + pt.lit + '%, ' + pt.alpha + ')';
                ctx.fill();
            }
        }

        // --- Connection lines (appear gradually with progress) ---
        if (connectionAlpha > 0.002) {
            var connDist = 40 + smoothProgress * 100;
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
                        var lineAlpha = connectionAlpha * proximity * Math.min(pa.alpha, pb.alpha) * 1.5;
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

        // --- Glitch tear ---
        if (glitchActive && Math.random() > 0.7) {
            var tearY = Math.random() * height;
            var tearH = Math.random() * 2 + 0.5;
            ctx.fillStyle = 'hsla(40, 20%, 50%, ' + (glitchIntensity * 0.06) + ')';
            ctx.fillRect(0, tearY, width, tearH);
        }

        // --- Rare ambient pulse ---
        if (Math.random() > 0.999) {
            var pg = ctx.createRadialGradient(
                width / 2, height * 0.4, 0,
                width / 2, height * 0.4, height * 0.5
            );
            pg.addColorStop(0, 'hsla(38, 40%, 60%, 0.02)');
            pg.addColorStop(1, 'transparent');
            ctx.fillStyle = pg;
            ctx.fillRect(0, 0, width, height);
        }

        requestAnimationFrame(render);
    }

    render();

})();
