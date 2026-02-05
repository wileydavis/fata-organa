/* ============================================
   FATA ORGANA — Atmosphere
   Canvas-based particle/signal animation
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
    var particles = [];
    var signalLines = [];
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

    function createParticle() {
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
            lit: 55 + Math.random() * 25
        };
    }

    function resetParticle(p) {
        p.x = Math.random() * width;
        p.y = Math.random() * height;
        p.size = Math.random() * 2 + 0.5;
        p.baseAlpha = Math.random() * 0.5 + 0.15;
        p.vx = (Math.random() - 0.5) * 0.2;
        p.vy = (Math.random() - 0.5) * 0.1 - 0.08;
        p.life = Math.random() * 500 + 200;
        p.maxLife = p.life;
        p.phase = Math.random() * Math.PI * 2;
    }

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

    var count = Math.min(Math.floor(width * height / 6000), 150);
    for (var i = 0; i < count; i++) {
        var p = createParticle();
        p.maxLife = p.life;
        particles.push(p);
    }
    for (var j = 0; j < 10; j++) {
        var s = createSignal();
        s.maxLife = s.life;
        signalLines.push(s);
    }

    function render() {
        time++;

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

        ctx.clearRect(0, 0, width, height);

        var grad = ctx.createRadialGradient(
            width / 2, height / 2, height * 0.2,
            width / 2, height / 2, height * 0.9
        );
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, 'rgba(10, 10, 12, 0.25)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        for (var si = 0; si < signalLines.length; si++) {
            var sl = signalLines[si];
            sl.life--;
            var slPct = sl.life / sl.maxLife;
            var slFade = slPct < 0.1 ? slPct / 0.1 : slPct > 0.9 ? (1 - slPct) / 0.1 : 1;
            sl.alpha = sl.targetAlpha * slFade;
            sl.y += sl.speed;
            sl.x += Math.sin(time * 0.001 + sl.phase) * 0.3;

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

        for (var pi = 0; pi < particles.length; pi++) {
            var pt = particles[pi];
            pt.life--;

            var breathe = Math.sin(time * pt.freq + pt.phase) * 0.5 + 0.5;
            var lifeFade = pt.life < 50 ? pt.life / 50 :
                           pt.life > pt.maxLife - 50 ? (pt.maxLife - pt.life) / 50 : 1;
            pt.alpha = pt.baseAlpha * breathe * lifeFade;

            pt.x += pt.vx + Math.sin(time * 0.003 + pt.phase) * 0.12;
            pt.y += pt.vy + Math.cos(time * 0.002 + pt.phase) * 0.06;

            if (glitchActive && Math.random() > 0.9) {
                pt.x += (Math.random() - 0.5) * glitchIntensity * 25;
                pt.alpha = Math.min(pt.alpha * 2.5, 0.8);
            }

            if (pt.alpha > 0.01) {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
                ctx.fillStyle = 'hsla(' + pt.hue + ', ' + pt.sat + '%, ' + pt.lit + '%, ' + pt.alpha + ')';
                ctx.fill();
            }

            if (pt.life <= 0 || pt.x < -30 || pt.x > width + 30 || pt.y < -30 || pt.y > height + 30) {
                resetParticle(pt);
            }
        }

        if (glitchActive && Math.random() > 0.6) {
            var tearY = Math.random() * height;
            var tearH = Math.random() * 3 + 1;
            ctx.fillStyle = 'hsla(40, 20%, 50%, ' + (glitchIntensity * 0.08) + ')';
            ctx.fillRect(0, tearY, width, tearH);
        }

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
