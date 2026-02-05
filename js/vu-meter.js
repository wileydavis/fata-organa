/* ============================================
   FATA ORGANA — VU Meter Audio Player
   Canvas-rendered analog VU meter with 
   Web Audio API analysis. Click to play.
   ============================================ */

(function() {
    'use strict';

    var container = document.getElementById('vu-player');
    if (!container) return;

    var audioSrc = container.getAttribute('data-src');
    if (!audioSrc) return;

    // --- State ---
    var audio = null;
    var audioCtx = null;
    var analyser = null;
    var source = null;
    var isPlaying = false;
    var isLoaded = false;
    var needleAngle = -0.65; // resting position (radians from center)
    var targetAngle = -0.65;
    var peakAngle = -0.65;
    var peakDecay = 0;
    var glowIntensity = 0;
    var hoverGlow = 0;

    // --- Canvas setup ---
    var canvas = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    var W = 380;
    var H = 240;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.style.cursor = 'pointer';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Status label
    var status = document.createElement('div');
    status.className = 'vu-status';
    status.textContent = 'CLICK TO RECEIVE TRANSMISSION';

    // Progress bar
    var progressWrap = document.createElement('div');
    progressWrap.className = 'vu-progress-wrap';
    var progressBar = document.createElement('div');
    progressBar.className = 'vu-progress-bar';
    progressWrap.appendChild(progressBar);

    container.appendChild(canvas);
    container.appendChild(progressWrap);
    container.appendChild(status);

    // --- Colors ---
    var COLORS = {
        faceLight: '#1a1915',
        faceDark: '#111110',
        bezel: '#2a2822',
        needle: '#c4a35a',
        needleShadow: 'rgba(196, 163, 90, 0.15)',
        scaleMarks: 'rgba(196, 163, 90, 0.35)',
        scaleText: 'rgba(196, 163, 90, 0.5)',
        redZone: 'rgba(180, 60, 50, 0.25)',
        pivot: '#3a3530',
        glow: 'rgba(196, 163, 90, 0.06)'
    };

    // --- Meter geometry ---
    var cx = W / 2;
    var cy = H * 0.88;
    var needleLen = H * 0.72;
    var arcRadius = needleLen * 0.85;
    var minAngle = -0.65; // full left
    var maxAngle = 0.65;  // full right
    var dbMarks = [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3];

    function dbToAngle(db) {
        // Map -20..+3 to minAngle..maxAngle (logarithmic-ish feel)
        var normalized = (db + 20) / 23;
        normalized = Math.max(0, Math.min(1, normalized));
        // Apply slight curve for analog feel
        normalized = Math.pow(normalized, 0.7);
        return minAngle + normalized * (maxAngle - minAngle);
    }

    // --- Draw ---
    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Face background with gradient
        var faceGrad = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy, H);
        faceGrad.addColorStop(0, COLORS.faceLight);
        faceGrad.addColorStop(1, COLORS.faceDark);
        ctx.fillStyle = faceGrad;
        ctx.fillRect(0, 0, W, H);

        // Bezel border
        ctx.strokeStyle = COLORS.bezel;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

        // Active glow
        if (glowIntensity > 0.01) {
            var glowGrad = ctx.createRadialGradient(cx, cy * 0.5, 0, cx, cy * 0.5, W * 0.5);
            glowGrad.addColorStop(0, 'rgba(196, 163, 90, ' + (glowIntensity * 0.08) + ')');
            glowGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, 0, W, H);
        }

        // Hover glow
        if (hoverGlow > 0.01) {
            var hGrad = ctx.createRadialGradient(cx, cy * 0.5, 0, cx, cy * 0.5, W * 0.4);
            hGrad.addColorStop(0, 'rgba(196, 163, 90, ' + (hoverGlow * 0.04) + ')');
            hGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = hGrad;
            ctx.fillRect(0, 0, W, H);
        }

        // VU label
        ctx.font = '500 11px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(196, 163, 90, 0.25)';
        ctx.textAlign = 'center';
        ctx.fillText('VU', cx, cy - needleLen + 35);

        // Scale arc and markings
        ctx.strokeStyle = COLORS.scaleMarks;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius, Math.PI + minAngle, Math.PI + maxAngle);
        ctx.stroke();

        // Red zone background (0 to +3)
        var redStart = dbToAngle(0);
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius + 8, Math.PI + redStart, Math.PI + maxAngle);
        ctx.arc(cx, cy, arcRadius - 3, Math.PI + maxAngle, Math.PI + redStart, true);
        ctx.closePath();
        ctx.fillStyle = COLORS.redZone;
        ctx.fill();

        // DB markings
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        for (var i = 0; i < dbMarks.length; i++) {
            var db = dbMarks[i];
            var a = dbToAngle(db);
            var markInner = arcRadius - 6;
            var markOuter = arcRadius + 4;
            var textR = arcRadius + 16;

            // Tick
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(Math.PI + a) * markInner, cy + Math.sin(Math.PI + a) * markInner);
            ctx.lineTo(cx + Math.cos(Math.PI + a) * markOuter, cy + Math.sin(Math.PI + a) * markOuter);
            ctx.strokeStyle = db >= 0 ? 'rgba(180, 60, 50, 0.4)' : COLORS.scaleMarks;
            ctx.lineWidth = db === 0 || db === -20 ? 1 : 0.5;
            ctx.stroke();

            // Label
            ctx.fillStyle = db >= 0 ? 'rgba(180, 60, 50, 0.5)' : COLORS.scaleText;
            var label = db === 0 ? '0' : db > 0 ? '+' + db : String(db);
            ctx.fillText(label, cx + Math.cos(Math.PI + a) * textR, cy + Math.sin(Math.PI + a) * textR + 3);
        }

        // Sub-ticks
        for (var d = -20; d <= 3; d += 1) {
            if (dbMarks.indexOf(d) !== -1) continue;
            var sa = dbToAngle(d);
            var si1 = arcRadius - 3;
            var si2 = arcRadius + 2;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(Math.PI + sa) * si1, cy + Math.sin(Math.PI + sa) * si1);
            ctx.lineTo(cx + Math.cos(Math.PI + sa) * si2, cy + Math.sin(Math.PI + sa) * si2);
            ctx.strokeStyle = d >= 0 ? 'rgba(180, 60, 50, 0.2)' : 'rgba(196, 163, 90, 0.15)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // Needle shadow
        ctx.beginPath();
        ctx.moveTo(cx + 2, cy + 2);
        ctx.lineTo(
            cx + Math.cos(Math.PI + needleAngle) * needleLen + 2,
            cy + Math.sin(Math.PI + needleAngle) * needleLen + 2
        );
        ctx.strokeStyle = COLORS.needleShadow;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Needle
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
            cx + Math.cos(Math.PI + needleAngle) * needleLen,
            cy + Math.sin(Math.PI + needleAngle) * needleLen
        );
        ctx.strokeStyle = COLORS.needle;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Needle tip glow when active
        if (glowIntensity > 0.1) {
            var tipX = cx + Math.cos(Math.PI + needleAngle) * needleLen;
            var tipY = cy + Math.sin(Math.PI + needleAngle) * needleLen;
            var tipGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 8);
            tipGrad.addColorStop(0, 'rgba(196, 163, 90, ' + (glowIntensity * 0.3) + ')');
            tipGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = tipGrad;
            ctx.beginPath();
            ctx.arc(tipX, tipY, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Peak hold indicator (thin line)
        if (peakAngle > minAngle + 0.05) {
            ctx.beginPath();
            ctx.moveTo(
                cx + Math.cos(Math.PI + peakAngle) * (needleLen * 0.6),
                cy + Math.sin(Math.PI + peakAngle) * (needleLen * 0.6)
            );
            ctx.lineTo(
                cx + Math.cos(Math.PI + peakAngle) * (needleLen * 0.9),
                cy + Math.sin(Math.PI + peakAngle) * (needleLen * 0.9)
            );
            ctx.strokeStyle = 'rgba(196, 163, 90, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Pivot cap
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.pivot;
        ctx.fill();
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    // --- Audio setup ---
    function initAudio() {
        if (audio) return;
        audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.src = audioSrc;
        audio.preload = 'auto';

        audio.addEventListener('ended', function() {
            isPlaying = false;
            status.textContent = 'TRANSMISSION COMPLETE — CLICK TO REPLAY';
        });

        audio.addEventListener('canplay', function() {
            isLoaded = true;
        });

        audio.addEventListener('timeupdate', function() {
            if (audio.duration) {
                var pct = (audio.currentTime / audio.duration) * 100;
                progressBar.style.width = pct + '%';
            }
        });
    }

    function initAnalyser() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        source = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
    }

    function togglePlay() {
        if (!audio) {
            initAudio();
        }

        if (isPlaying) {
            audio.pause();
            isPlaying = false;
            status.textContent = 'PAUSED — CLICK TO RESUME';
        } else {
            if (!audioCtx) initAnalyser();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            audio.play().then(function() {
                isPlaying = true;
                status.textContent = 'RECEIVING TRANSMISSION';
            }).catch(function(e) {
                status.textContent = 'SIGNAL ERROR — TRY AGAIN';
            });
        }
    }

    // --- Interaction ---
    canvas.addEventListener('click', togglePlay);

    canvas.addEventListener('mouseenter', function() { hoverGlow = 0.5; });
    canvas.addEventListener('mouseleave', function() { hoverGlow = 0; });

    // Progress bar seeking
    progressWrap.addEventListener('click', function(e) {
        if (!audio || !audio.duration) return;
        var rect = progressWrap.getBoundingClientRect();
        var pct = (e.clientX - rect.left) / rect.width;
        audio.currentTime = pct * audio.duration;
    });

    // --- Animation loop ---
    function animate() {
        // Get level from analyser
        if (isPlaying && analyser) {
            var dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);

            // RMS-ish average weighted toward lower frequencies
            var sum = 0;
            var count = Math.min(dataArray.length, 64);
            for (var i = 0; i < count; i++) {
                var weight = 1 - (i / count) * 0.5;
                sum += dataArray[i] * weight;
            }
            var avg = sum / count / 255;

            // Map to dB range (-20 to +3)
            var db = -20 + avg * 26;
            targetAngle = dbToAngle(db);
            glowIntensity += (1 - glowIntensity) * 0.05;
        } else {
            targetAngle = minAngle;
            glowIntensity *= 0.95;
        }

        // Needle physics — slight overshoot and damping
        var diff = targetAngle - needleAngle;
        needleAngle += diff * 0.15;

        // Peak hold
        if (needleAngle > peakAngle) {
            peakAngle = needleAngle;
            peakDecay = 60; // hold for ~1 second
        } else {
            peakDecay--;
            if (peakDecay <= 0) {
                peakAngle += (minAngle - peakAngle) * 0.03;
            }
        }

        draw();
        requestAnimationFrame(animate);
    }

    draw();
    animate();

})();
