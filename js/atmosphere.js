/* ============================================
   FATA ORGANA — Atmosphere
   Canvas-based particle/signal animation
   Subtle, unsettling, but with warmth
   ============================================ */

(function() {
    'use strict';

    const canvas = document.createElement('canvas');
    canvas.id = 'atmosphere';
    canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
        opacity: 0.6;
    `;
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let signals = [];
    let time = 0;
    let glitchTimer = 0;
    let glitchActive = false;
    let glitchIntensity = 0;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resize);
    resize();

    // --- Particles: drifting motes of consciousness ---
    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 1.5 + 0.3;
            this.baseAlpha = Math.random() * 0.3 + 0.05;
            this.alpha = this.baseAlpha;
            this.vx = (Math.random() - 0.5) * 0.15;
            this.vy = (Math.random() - 0.5) * 0.1 - 0.05; // slight upward drift
            this.life = Math.random() * 600 + 200;
            this.maxLife = this.life;
            this.phase = Math.random() * Math.PI * 2;
            this.frequency = Math.random() * 0.02 + 0.005;
            // warm amber to pale gold
            this.hue = 38 + Math.random() * 15;
            this.saturation = 30 + Math.random() * 30;
            this.lightness = 55 + Math.random() * 25;
        }

        update() {
            this.life--;

            // Breathing opacity
            let breathe = Math.sin(time * this.frequency + this.phase) * 0.5 + 0.5;
            let lifeFade = this.life < 60 ? this.life / 60 : 
                           this.life > this.maxLife - 60 ? (this.maxLife - this.life) / 60 : 1;
            this.alpha = this.baseAlpha * breathe * lifeFade;

            // Gentle drift with slight wave
            this.x += this.vx + Math.sin(time * 0.003 + this.phase) * 0.1;
            this.y += this.vy + Math.cos(time * 0.002 + this.phase) * 0.05;

            // Glitch displacement
            if (glitchActive && Math.random() > 0.92) {
                this.x += (Math.random() - 0.5) * glitchIntensity * 20;
                this.alpha = Math.min(this.alpha * 2, 0.6);
            }

            if (this.life <= 0 || this.x < -20 || this.x > width + 20 || this.y < -20 || this.y > height + 20) {
                this.reset();
            }
        }

        draw() {
            if (this.alpha < 0.01) return;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${this.alpha})`;
            ctx.fill();
        }
    }

    // --- Signals: horizontal scan lines that drift through ---
    class Signal {
        constructor() {
            this.reset();
        }

        reset() {
            this.y = Math.random() * height;
            this.alpha = 0;
            this.targetAlpha = Math.random() * 0.04 + 0.01;
            this.width = Math.random() * width * 0.6 + width * 0.1;
            this.x = Math.random() * (width - this.width);
            this.thickness = Math.random() < 0.3 ? 1 : Math.random() * 0.5 + 0.2;
            this.speed = (Math.random() - 0.5) * 0.3;
            this.life = Math.random() * 400 + 100;
            this.maxLife = this.life;
            this.phase = Math.random() * Math.PI * 2;
        }

        update() {
            this.life--;
            
            let lifePct = this.life / this.maxLife;
            let fade = lifePct < 0.1 ? lifePct / 0.1 :
                       lifePct > 0.9 ? (1 - lifePct) / 0.1 : 1;
            this.alpha = this.targetAlpha * fade;

            this.y += this.speed;
            this.x += Math.sin(time * 0.001 + this.phase) * 0.3;

            // During glitch, signals flare
            if (glitchActive && Math.random() > 0.85) {
                this.alpha = Math.min(this.targetAlpha * 4, 0.15);
                this.x += (Math.random() - 0.5) * 10;
            }

            if (this.life <= 0) this.reset();
        }

        draw() {
            if (this.alpha < 0.005) return;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.width, this.y);
            ctx.strokeStyle = `hsla(40, 25%, 70%, ${this.alpha})`;
            ctx.lineWidth = this.thickness;
            ctx.stroke();
        }
    }

    // --- Initialize ---
    const particleCount = Math.min(Math.floor(width * height / 8000), 120);
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    for (let i = 0; i < 8; i++) {
        signals.push(new Signal());
    }

    // --- Glitch system ---
    function updateGlitch() {
        glitchTimer--;
        
        if (glitchTimer <= 0 && !glitchActive) {
            // Random chance of glitch event
            if (Math.random() > 0.997) {
                glitchActive = true;
                glitchIntensity = Math.random() * 0.8 + 0.2;
                glitchTimer = Math.floor(Math.random() * 15) + 3; // short bursts
            }
        }

        if (glitchActive) {
            glitchTimer--;
            if (glitchTimer <= 0) {
                glitchActive = false;
                glitchTimer = Math.floor(Math.random() * 300) + 200; // wait between glitches
            }
        }
    }

    // --- Render ---
    function render() {
        time++;
        updateGlitch();

        ctx.clearRect(0, 0, width, height);

        // Very subtle vignette
        let gradient = ctx.createRadialGradient(
            width / 2, height / 2, height * 0.2,
            width / 2, height / 2, height * 0.9
        );
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, 'rgba(10, 10, 12, 0.3)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Draw signals (behind particles)
        for (let s of signals) {
            s.update();
            s.draw();
        }

        // Draw particles
        for (let p of particles) {
            p.update();
            p.draw();
        }

        // Glitch: occasional horizontal tear
        if (glitchActive && Math.random() > 0.7) {
            let tearY = Math.random() * height;
            let tearH = Math.random() * 3 + 1;
            let shift = (Math.random() - 0.5) * glitchIntensity * 8;
            
            // Subtle color shift on the tear line
            ctx.fillStyle = `hsla(40, 20%, 50%, ${glitchIntensity * 0.06})`;
            ctx.fillRect(0, tearY, width, tearH);
        }

        // Very rare: warm pulse from center (the hopeful part)
        if (Math.random() > 0.9985) {
            let pulseAlpha = 0.015;
            let pulseGrad = ctx.createRadialGradient(
                width / 2, height * 0.4, 0,
                width / 2, height * 0.4, height * 0.5
            );
            pulseGrad.addColorStop(0, `hsla(38, 40%, 60%, ${pulseAlpha})`);
            pulseGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = pulseGrad;
            ctx.fillRect(0, 0, width, height);
        }

        requestAnimationFrame(render);
    }

    // Start after a brief delay
    setTimeout(render, 100);

    // Reduce particle count on low-performance devices
    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 60;

    function checkPerformance() {
        frameCount++;
        let now = performance.now();
        if (now - lastTime >= 2000) {
            fps = Math.round(frameCount / ((now - lastTime) / 1000));
            frameCount = 0;
            lastTime = now;
            
            if (fps < 30 && particles.length > 30) {
                particles.splice(0, Math.floor(particles.length * 0.3));
                signals.splice(0, Math.floor(signals.length * 0.3));
            }
        }
        requestAnimationFrame(checkPerformance);
    }
    checkPerformance();

})();
