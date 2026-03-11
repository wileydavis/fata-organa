/* ============================================
   FATA ORGANA — Atmosphere
   Audio-reactive particle system with
   geometric pattern formation
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

    // --- Audio signal access ---
    function getSignal() {
        return window.vuSignal || {
            rms: 0, low: 0, high: 0, peak: 0,
            isPlaying: false, hasStarted: false,
            smoothRms: 0, smoothLow: 0
        };
    }

    // --- Particle system ---
    var particles = [];
    var baseCount = Math.min(Math.floor(width * height / 8000), 100);
    var maxCount = Math.min(Math.floor(width * height / 2500), 400);

    // Smoothed reactive values
    var reactivity = 0;
    var density = 0;
    var swirlForce = 0;
    var patternStrength = 0;
    var connectionAlpha = 0;
    var playDuration = 0; // seconds of audio played this session

    function createParticle(spread) {
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 2 + 0.5,
            baseAlpha: Math.random() * 0.5 + 0.15,
            alpha: 0,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.1 - 0.08,
            life: Math.random() * 500 + 200,
            maxLife: 0,
            phase: Math.random() * Math.PI * 2,
            freq: Math.random() * 0.02 + 0.005,
            hue: 38 + Math.random() * 15,
            sat: 30 + Math.random() * 30,
            lit: 55 + Math.random() * 25,
            attractIdx: Math.floor(Math.random() * 12),
            orbitDist: Math.random() * 180 + 40,
            orbitSpeed: (Math.random() - 0.5) * 0.006
        };
    }

    function resetParticle(p, spread) {
        p.x = Math.random() * width;
        p.y = Math.random() * height;
        p.size = Math.random() * 2 + 0.5;
        p.baseAlpha = Math.random() * 0.5 + 0.15;
        p.vx = (Math.random() - 0.5) * 0.2;
        p.vy = (Math.random() - 0.5) * 0.1 - 0.08;
        p.life = Math.random() * 500 + 200;
        p.maxLife = p.life;
        p.phase = Math.random() * Math.PI * 2;
        p.attractIdx = Math.floor(Math.random() * 12);
        p.orbitDist = Math.random() * 180 + 40;
        p.orbitSpeed = (Math.random() - 0.5) * 0.006;
    }

    for (var i = 0; i < baseCount; i++) {
        var p = createParticle(false);
        p.maxLife = p.life;
        particles.push(p);
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
            speed: (Math.random() - 0.5) * 0.3,
            life: Math.random() * 400 + 100,
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
        s.speed = (Math.random() - 0.5) * 0.3;
        s.life = Math.random() * 400 + 100;
        s.maxLife = s.life;
        s.phase = Math.random() * Math.PI * 2;
    }
    for (var j = 0; j < 10; j++) {
        var s = createSignal();
        s.maxLife = s.life;
        signalLines.push(s);
    }

    // --- Geometry vertices ---
    function getVertices(t, sides, cx, cy, radius) {
        var verts = [];
        var baseAngle = t * 0.0003;
        for (var i = 0; i < sides; i++) {
            var a = baseAngle + (Math.PI * 2 / sides) * i;
            var r = radius + Math.sin(t * 0.001 + i * 1.5) * radius * 0.2;
            verts.push({
                x: cx + Math.cos(a) * r,
                y: cy + Math.sin(a) * r
            });
        }
        return verts;
    }

    // --- Render ---
    function render() {
        time++;
        var sig = getSignal();

        // --- Smooth reactive values ---
        var targetReactivity = sig.isPlaying ? 1 : 0;
        reactivity += (targetReactivity - reactivity) * 0.008;

        // Density grows with cumulative play time (full at ~20 min)
        if (sig.isPlaying) {
            playDuration += 1 / 60; // ~60fps
        }
        var targetDensity = Math.min(playDuration / 1200, 1); // 1200s = 20 min
        if (!sig.isPlaying) targetDensity = density * 0.9995; // very slow decay when paused
        density += (targetDensity - density) * 0.003;

        // Swirl driven by low-end
        var targetSwirl = sig.smoothLow * 3.0 * reactivity;
        swirlForce += (targetSwirl - swirlForce) * 0.04;

        // Pattern strength grows with reactivity and density
        var targetPattern = reactivity * (0.15 + density * 0.85);
        patternStrength += (targetPattern - patternStrength) * 0.008;

        // Connection lines appear as density grows
        var targetConnAlpha = reactivity * density * 0.1;
        connectionAlpha += (targetConnAlpha - connectionAlpha) * 0.006;

        // --- Dynamic particle count ---
        var targetCount = Math.floor(baseCount + (maxCount - baseCount) * density * reactivity);
        if (!sig.isPlaying) targetCount = Math.max(baseCount, Math.floor(particles.length * 0.999));
        targetCount = Math.max(baseCount, Math.min(maxCount, targetCount));

        while (particles.length < targetCount) {
            var np = createParticle(reactivity > 0.3);
            np.maxLife = np.life;
            particles.push(np);
        }

        // --- Geometry ---
        var sides = Math.floor(3 + density * 9);
        var geoRadius = Math.max(width, height) * (0.35 + density * 0.25);
        var verts = getVertices(time, sides, width / 2, height / 2, geoRadius);

        // --- Glitch ---
        glitchTimer--;
        if (!glitchActive && glitchTimer <= 0) {
            if (Math.random() > 0.5) {
                glitchActive = true;
                glitchIntensity = Math.random() * 0.8 + 0.2;
                glitchTimer = Math.floor(Math.random() * 12) + 3;
            } else {
                glitchTimer = Math.floor(Math.random() * 200) + 100;
            }
        }
        if (glitchActive) {
            glitchTimer--;
            if (glitchTimer <= 0) {
                glitchActive = false;
                glitchTimer = Math.floor(Math.random() * 300) + 200;
            }
        }
        if (sig.peak > 0.7 && sig.isPlaying && Math.random() > 0.85) {
            glitchActive = true;
            glitchIntensity = sig.peak;
            glitchTimer = Math.floor(Math.random() * 8) + 2;
        }

        // --- Clear ---
        ctx.clearRect(0, 0, width, height);

        var grad = ctx.createRadialGradient(
            width / 2, height / 2, height * 0.2,
            width / 2, height / 2, height * 0.9
        );
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, 'rgba(10, 10, 12, 0.25)');
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
            sl.x += Math.sin(time * 0.001 + sl.phase) * 0.3;

            if (sig.isPlaying) {
                sl.alpha *= (1 + sig.smoothRms * 2);
            }

            if (glitchActive && Math.random() > 0.8) {
                sl.alpha = Math.min(sl.targetAlpha * 5, 0.2);
                sl.x += (Math.random() - 0.5) * 15;
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

        // --- Geometry wireframe ---
        if (patternStrength > 0.01 && verts.length > 0) {
            ctx.beginPath();
            ctx.moveTo(verts[0].x, verts[0].y);
            for (var vi = 1; vi < verts.length; vi++) {
                ctx.lineTo(verts[vi].x, verts[vi].y);
            }
            ctx.closePath();
            var geoAlpha = patternStrength * 0.04 * (1 + sig.smoothRms);
            ctx.strokeStyle = 'hsla(40, 30%, 60%, ' + geoAlpha + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // --- Particles ---
        for (var pi = particles.length - 1; pi >= 0; pi--) {
            var pt = particles[pi];
            pt.life--;

            var breathe = Math.sin(time * pt.freq + pt.phase) * 0.5 + 0.5;
            var lifeFade = pt.life < 50 ? pt.life / 50 :
                           pt.life > pt.maxLife - 50 ? (pt.maxLife - pt.life) / 50 : 1;
            pt.alpha = pt.baseAlpha * breathe * lifeFade;

            pt.x += pt.vx + Math.sin(time * 0.003 + pt.phase) * 0.12;
            pt.y += pt.vy + Math.cos(time * 0.002 + pt.phase) * 0.06;

            // --- Center repulsion (keep particles away from VU meter) ---
            var cdx = pt.x - width / 2;
            var cdy = pt.y - height / 2;
            var centerDist = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
            var deadZone = Math.min(width, height) * 0.22; // radius of the meter area
            if (centerDist < deadZone) {
                // Push outward — stronger the closer to center
                var repelStrength = (1 - centerDist / deadZone) * 0.15;
                pt.vx += (cdx / centerDist) * repelStrength;
                pt.vy += (cdy / centerDist) * repelStrength;
            }

            // --- Geometric attraction ---
            if (patternStrength > 0.01 && verts.length > 0) {
                var targetVert = verts[pt.attractIdx % verts.length];
                pt.phase += pt.orbitSpeed * (1 + swirlForce);
                var orbitX = targetVert.x + Math.cos(pt.phase) * pt.orbitDist;
                var orbitY = targetVert.y + Math.sin(pt.phase) * pt.orbitDist;

                var ax = (orbitX - pt.x) * patternStrength * 0.003;
                var ay = (orbitY - pt.y) * patternStrength * 0.003;
                pt.vx += ax;
                pt.vy += ay;

                // Transient push outward from center
                if (sig.peak > 0.5) {
                    var pushAngle = Math.atan2(pt.y - height / 2, pt.x - width / 2);
                    var pushForce = (sig.peak - 0.5) * 0.15 * reactivity;
                    pt.vx += Math.cos(pushAngle) * pushForce;
                    pt.vy += Math.sin(pushAngle) * pushForce;
                }
            }

            // --- Swirl (ring-shaped, strongest at mid-distance from center) ---
            if (swirlForce > 0.01) {
                var sdx = pt.x - width / 2;
                var sdy = pt.y - height / 2;
                var sDist = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
                // Bell curve: strongest swirl at ~40% of screen diagonal, fades at center and edges
                var optimalDist = Math.max(width, height) * 0.4;
                var swirlFalloff = Math.exp(-Math.pow((sDist - optimalDist) / (optimalDist * 0.6), 2));
                var swirlMag = swirlForce * 0.3 * swirlFalloff;
                pt.vx += -sdy / sDist * swirlMag;
                pt.vy += sdx / sDist * swirlMag;
            }

            // Damping
            pt.vx *= 0.985;
            pt.vy *= 0.985;

            // Audio brightness
            if (sig.isPlaying) {
                pt.alpha *= (1 + sig.smoothRms * 1.5);
                if (sig.high > 0.3 && Math.random() > 0.95) {
                    pt.alpha = Math.min(pt.alpha * 2, 0.9);
                }
            }

            // Glitch
            if (glitchActive && Math.random() > 0.9) {
                pt.x += (Math.random() - 0.5) * glitchIntensity * 25;
                pt.alpha = Math.min(pt.alpha * 2.5, 0.8);
            }

            // Draw
            if (pt.alpha > 0.01) {
                var drawSize = pt.size * (1 + sig.smoothRms * 0.5);
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, drawSize, 0, Math.PI * 2);
                ctx.fillStyle = 'hsla(' + pt.hue + ', ' + pt.sat + '%, ' + pt.lit + '%, ' + pt.alpha + ')';
                ctx.fill();
            }

            // Reset or cull
            if (pt.life <= 0 || pt.x < -60 || pt.x > width + 60 || pt.y < -60 || pt.y > height + 60) {
                if (particles.length > targetCount && pi >= baseCount) {
                    particles.splice(pi, 1);
                } else {
                    resetParticle(pt, reactivity > 0.3);
                }
            }
        }

        // --- Connection lines ---
        if (connectionAlpha > 0.003) {
            var connDist = 60 + density * 80;
            var connDistSq = connDist * connDist;
            var maxConns = Math.min(particles.length, 180);

            ctx.lineWidth = 0.5;
            for (var ci = 0; ci < maxConns; ci++) {
                var pa = particles[ci];
                if (pa.alpha < 0.02) continue;

                for (var cj = ci + 1; cj < maxConns; cj++) {
                    var pb = particles[cj];
                    if (pb.alpha < 0.02) continue;

                    var cdx = pa.x - pb.x;
                    var cdy = pa.y - pb.y;
                    var cdSq = cdx * cdx + cdy * cdy;

                    if (cdSq < connDistSq) {
                        var proximity = 1 - cdSq / connDistSq;
                        var lineAlpha = connectionAlpha * proximity * Math.min(pa.alpha, pb.alpha) * 2;
                        if (lineAlpha > 0.003) {
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
        if (glitchActive && Math.random() > 0.6) {
            var tearY = Math.random() * height;
            var tearH = Math.random() * 3 + 1;
            ctx.fillStyle = 'hsla(40, 20%, 50%, ' + (glitchIntensity * 0.08) + ')';
            ctx.fillRect(0, tearY, width, tearH);
        }

        // --- Rare ambient pulse ---
        if (Math.random() > 0.998) {
            var pg = ctx.createRadialGradient(
                width / 2, height * 0.4, 0,
                width / 2, height * 0.4, height * 0.5
            );
            pg.addColorStop(0, 'hsla(38, 40%, 60%, 0.03)');
            pg.addColorStop(1, 'transparent');
            ctx.fillStyle = pg;
            ctx.fillRect(0, 0, width, height);
        }

        requestAnimationFrame(render);
    }

    render();

})();
