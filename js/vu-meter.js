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
    var needleAngle = -0.65;
    var targetAngle = -0.65;
    var peakAngle = -0.65;
    var peakDecay = 0;
    var glowIntensity = 0;
    var hoverGlow = 0;
    var hasStarted = false;

    // --- Canvas setup ---
    var canvas = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    var W = 380;
    var H = 160;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.style.cursor = 'pointer';
    canvas.style.display = 'block';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Status label
    var statusEl = document.createElement('div');
    statusEl.className = 'vu-status';
    statusEl.textContent = '\u00A0';

    // Progress bar
    var progressWrap = document.createElement('div');
    progressWrap.className = 'vu-progress-wrap';
    var progressBar = document.createElement('div');
    progressBar.className = 'vu-progress-bar';
    progressWrap.appendChild(progressBar);

    // Receive button overlay
    var btnOverlay = document.createElement('div');
    btnOverlay.className = 'vu-receive-overlay';
    var btn = document.createElement('button');
    btn.className = 'vu-receive-btn';
    btn.innerHTML = '<span class="vu-receive-icon">&#9655;</span> RECEIVE TRANSMISSION';
    btnOverlay.appendChild(btn);

    container.appendChild(canvas);
    container.appendChild(btnOverlay);
    container.appendChild(progressWrap);
    container.appendChild(statusEl);

    // --- Meter geometry ---
    var cx = W / 2;
    var cy = H * 1.05;
    var needleLen = H * 0.88;
    var arcRadius = needleLen * 0.78;
    var minAngle = -0.60;
    var maxAngle = 0.60;
    var clipY = H - 6; // mechanical stop — needle can't go below this
    var dbMarks = [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3];

    function dbToAngle(db) {
        var normalized = (db + 20) / 23;
        normalized = Math.max(0, Math.min(1, normalized));
        normalized = Math.pow(normalized, 0.7);
        return minAngle + normalized * (maxAngle - minAngle);
    }

    // --- Draw ---
    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Save state for clipping
        ctx.save();

        // Face background
        var faceGrad = ctx.createRadialGradient(cx - 60, cy - H * 0.6, 10, cx, cy, H * 1.1);
        faceGrad.addColorStop(0, '#1e1b14');
        faceGrad.addColorStop(0.5, '#171510');
        faceGrad.addColorStop(1, '#0f0e0c');
        ctx.fillStyle = faceGrad;
        ctx.fillRect(0, 0, W, H);

        // Warm backlight — brighter, falls off toward right
        var backlightGrad = ctx.createRadialGradient(cx - 80, cy - H * 0.5, 0, cx - 80, cy - H * 0.5, W * 0.55);
        var backlightAlpha = 0.12 + glowIntensity * 0.08;
        backlightGrad.addColorStop(0, 'rgba(210, 175, 90, ' + backlightAlpha + ')');
        backlightGrad.addColorStop(0.4, 'rgba(196, 163, 90, ' + (backlightAlpha * 0.5) + ')');
        backlightGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = backlightGrad;
        ctx.fillRect(0, 0, W, H);

        // Additional warm wash from left
        var warmGrad = ctx.createLinearGradient(0, 0, W, 0);
        warmGrad.addColorStop(0, 'rgba(200, 165, 80, ' + (0.04 + glowIntensity * 0.03) + ')');
        warmGrad.addColorStop(0.6, 'transparent');
        ctx.fillStyle = warmGrad;
        ctx.fillRect(0, 0, W, H);

        // Bezel
        ctx.strokeStyle = 'rgba(60, 55, 42, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

        // Hover glow
        if (hoverGlow > 0.01 && !hasStarted) {
            var hGrad = ctx.createRadialGradient(cx, cy * 0.4, 0, cx, cy * 0.4, W * 0.4);
            hGrad.addColorStop(0, 'rgba(196, 163, 90, ' + (hoverGlow * 0.04) + ')');
            hGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = hGrad;
            ctx.fillRect(0, 0, W, H);
        }

        // VU label
        ctx.font = '500 10px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(196, 163, 90, 0.2)';
        ctx.textAlign = 'center';
        ctx.fillText('VU', cx, 22);

        // Scale arc
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius, Math.PI + minAngle, Math.PI + maxAngle);
        ctx.stroke();

        // Red zone background
        var redStart = dbToAngle(0);
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius + 7, Math.PI + redStart, Math.PI + maxAngle);
        ctx.arc(cx, cy, arcRadius - 3, Math.PI + maxAngle, Math.PI + redStart, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(180, 60, 50, 0.2)';
        ctx.fill();

        // DB markings
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        for (var i = 0; i < dbMarks.length; i++) {
            var db = dbMarks[i];
            var a = dbToAngle(db);
            var markInner = arcRadius - 5;
            var markOuter = arcRadius + 4;
            var textR = arcRadius + 15;

            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(Math.PI + a) * markInner, cy + Math.sin(Math.PI + a) * markInner);
            ctx.lineTo(cx + Math.cos(Math.PI + a) * markOuter, cy + Math.sin(Math.PI + a) * markOuter);
            ctx.strokeStyle = db >= 0 ? 'rgba(180, 60, 50, 0.4)' : 'rgba(196, 163, 90, 0.3)';
            ctx.lineWidth = db === 0 || db === -20 ? 1 : 0.5;
            ctx.stroke();

            var ty = cy + Math.sin(Math.PI + a) * textR + 3;
            if (ty < H - 2) {
                ctx.fillStyle = db >= 0 ? 'rgba(180, 60, 50, 0.45)' : 'rgba(196, 163, 90, 0.4)';
                var label = db === 0 ? '0' : db > 0 ? '+' + db : String(db);
                ctx.fillText(label, cx + Math.cos(Math.PI + a) * textR, ty);
            }
        }

        // Sub-ticks
        for (var d = -20; d <= 3; d += 1) {
            if (dbMarks.indexOf(d) !== -1) continue;
            var sa = dbToAngle(d);
            var si1 = arcRadius - 2;
            var si2 = arcRadius + 2;
            var sy1 = cy + Math.sin(Math.PI + sa) * si1;
            if (sy1 < H - 2) {
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(Math.PI + sa) * si1, sy1);
                ctx.lineTo(cx + Math.cos(Math.PI + sa) * si2, cy + Math.sin(Math.PI + sa) * si2);
                ctx.strokeStyle = d >= 0 ? 'rgba(180, 60, 50, 0.15)' : 'rgba(196, 163, 90, 0.12)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }

        // --- Needle (clipped to meter bounds) ---
        var needleTipX = cx + Math.cos(Math.PI + needleAngle) * needleLen;
        var needleTipY = cy + Math.sin(Math.PI + needleAngle) * needleLen;

        // If tip would go below clipY, calculate intersection
        var drawTipX = needleTipX;
        var drawTipY = needleTipY;
        if (needleTipY > clipY) {
            // Find where needle crosses clipY
            var t = (clipY - cy) / (needleTipY - cy);
            drawTipX = cx + t * (needleTipX - cx);
            drawTipY = clipY;
        }

        // Needle shadow
        ctx.beginPath();
        ctx.moveTo(cx + 1.5, Math.min(cy + 1.5, clipY));
        ctx.lineTo(drawTipX + 1.5, drawTipY + 1.5);
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.1)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Needle
        ctx.beginPath();
        ctx.moveTo(cx, Math.min(cy, clipY));
        ctx.lineTo(drawTipX, drawTipY);
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Needle tip glow
        if (glowIntensity > 0.1) {
            var tipGrad = ctx.createRadialGradient(drawTipX, drawTipY, 0, drawTipX, drawTipY, 6);
            tipGrad.addColorStop(0, 'rgba(196, 163, 90, ' + (glowIntensity * 0.25) + ')');
            tipGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = tipGrad;
            ctx.beginPath();
            ctx.arc(drawTipX, drawTipY, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Peak hold
        if (peakAngle > minAngle + 0.05) {
            var peakTipX = cx + Math.cos(Math.PI + peakAngle) * (needleLen * 0.9);
            var peakTipY = cy + Math.sin(Math.PI + peakAngle) * (needleLen * 0.9);
            var peakBaseX = cx + Math.cos(Math.PI + peakAngle) * (needleLen * 0.6);
            var peakBaseY = cy + Math.sin(Math.PI + peakAngle) * (needleLen * 0.6);
            if (peakTipY < clipY && peakBaseY < clipY) {
                ctx.beginPath();
                ctx.moveTo(peakBaseX, peakBaseY);
                ctx.lineTo(peakTipX, peakTipY);
                ctx.strokeStyle = 'rgba(196, 163, 90, 0.1)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // Pivot cap (at bottom edge)
        var pivotY = Math.min(cy, clipY);
        ctx.beginPath();
        ctx.arc(cx, pivotY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#2a2520';
        ctx.fill();
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Bottom edge line (mechanical stop visual)
        ctx.beginPath();
        ctx.moveTo(0, H - 1);
        ctx.lineTo(W, H - 1);
        ctx.strokeStyle = 'rgba(60, 55, 42, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
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
            statusEl.textContent = 'TRANSMISSION COMPLETE \u2014 CLICK METER TO REPLAY';
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

    function startPlayback() {
        if (!audio) initAudio();
        if (!audioCtx) initAnalyser();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        audio.play().then(function() {
            isPlaying = true;
            hasStarted = true;
            btnOverlay.classList.add('hidden');
            statusEl.textContent = 'RECEIVING TRANSMISSION';
        }).catch(function() {
            statusEl.textContent = 'SIGNAL ERROR \u2014 TRY AGAIN';
        });
    }

    function togglePlay() {
        if (!hasStarted) {
            startPlayback();
            return;
        }
        if (isPlaying) {
            audio.pause();
            isPlaying = false;
            statusEl.textContent = 'PAUSED \u2014 CLICK METER TO RESUME';
        } else {
            audio.play().then(function() {
                isPlaying = true;
                statusEl.textContent = 'RECEIVING TRANSMISSION';
            });
        }
    }

    // --- Interaction ---
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        startPlayback();
    });

    canvas.addEventListener('click', togglePlay);
    canvas.addEventListener('mouseenter', function() { hoverGlow = 0.5; });
    canvas.addEventListener('mouseleave', function() { hoverGlow = 0; });

    progressWrap.addEventListener('click', function(e) {
        if (!audio || !audio.duration) return;
        var rect = progressWrap.getBoundingClientRect();
        var pct = (e.clientX - rect.left) / rect.width;
        audio.currentTime = pct * audio.duration;
    });

    // --- Animation loop ---
    function animate() {
        if (isPlaying && analyser) {
            var dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            var sum = 0;
            var count = Math.min(dataArray.length, 64);
            for (var i = 0; i < count; i++) {
                var weight = 1 - (i / count) * 0.5;
                sum += dataArray[i] * weight;
            }
            var avg = sum / count / 255;
            var db = -20 + avg * 26;
            targetAngle = dbToAngle(db);
            glowIntensity += (1 - glowIntensity) * 0.05;
        } else {
            targetAngle = minAngle;
            glowIntensity *= 0.95;
        }

        var diff = targetAngle - needleAngle;
        needleAngle += diff * 0.15;

        if (needleAngle > peakAngle) {
            peakAngle = needleAngle;
            peakDecay = 60;
        } else {
            peakDecay--;
            if (peakDecay <= 0) {
                peakAngle += (minAngle - peakAngle) * 0.03;
            }
        }

        // Ease hover glow
        if (!canvas.matches(':hover')) {
            hoverGlow *= 0.9;
        }

        draw();
        requestAnimationFrame(animate);
    }

    draw();
    animate();

})();
