/* ============================================
   FATA ORGANA — VU Meter Audio Player
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
    var hasStarted = false;
    var needleAngle = -0.75;
    var targetAngle = -0.75;
    var peakAngle = -0.75;
    var peakDecay = 0;
    var glowIntensity = 0;
    var time = 0;

    // --- Canvas setup ---
    var canvas = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    var W = 480;
    var H = 220;
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

    container.appendChild(canvas);
    container.appendChild(progressWrap);
    container.appendChild(statusEl);

    // --- Meter geometry ---
    var cx = W / 2;
    var cy = H * 0.88;
    var needleLen = H * 0.72;
    var arcRadius = needleLen * 0.78;
    var BASE_ANGLE = -Math.PI / 2; // straight up
    var minAngle = -0.75; // sweep left of center
    var maxAngle = 0.75;  // sweep right of center
    var dbMarks = [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3];

    // Indicator geometry
    var recX = W - 138;
    var recY = 12;
    var recW = 128;
    var recH = 16;

    function dbToAngle(db) {
        var normalized = (db + 20) / 23;
        normalized = Math.max(0, Math.min(1, normalized));
        normalized = Math.pow(normalized, 0.7);
        return minAngle + normalized * (maxAngle - minAngle);
    }

    // Convert needle-space angle to canvas angle
    function toCanvas(a) {
        return BASE_ANGLE + a;
    }

    // Get tip position
    function tip(a, len) {
        var ca = toCanvas(a);
        return { x: cx + Math.cos(ca) * len, y: cy + Math.sin(ca) * len };
    }

    // --- Draw ---
    function draw() {
        time++;
        ctx.clearRect(0, 0, W, H);

        // Face background
        var faceGrad = ctx.createRadialGradient(cx - 60, cy - H * 0.6, 10, cx, cy, H * 1.2);
        faceGrad.addColorStop(0, '#1e1b14');
        faceGrad.addColorStop(0.5, '#171510');
        faceGrad.addColorStop(1, '#0f0e0c');
        ctx.fillStyle = faceGrad;
        ctx.fillRect(0, 0, W, H);

        // Warm backlight — left-biased
        var blAlpha = 0.10 + glowIntensity * 0.08;
        var blGrad = ctx.createRadialGradient(cx - 80, H * 0.35, 0, cx - 80, H * 0.35, W * 0.55);
        blGrad.addColorStop(0, 'rgba(210, 175, 90, ' + blAlpha + ')');
        blGrad.addColorStop(0.4, 'rgba(196, 163, 90, ' + (blAlpha * 0.45) + ')');
        blGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = blGrad;
        ctx.fillRect(0, 0, W, H);

        // Left-to-right falloff
        var warmLR = ctx.createLinearGradient(0, 0, W, 0);
        warmLR.addColorStop(0, 'rgba(200, 165, 80, ' + (0.035 + glowIntensity * 0.025) + ')');
        warmLR.addColorStop(0.6, 'transparent');
        ctx.fillStyle = warmLR;
        ctx.fillRect(0, 0, W, H);

        // Bezel
        ctx.strokeStyle = 'rgba(60, 55, 42, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

        // VU label
        ctx.font = '500 10px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(196, 163, 90, 0.2)';
        ctx.textAlign = 'center';
        ctx.fillText('VU', cx, cy - needleLen + 20);

        // Scale arc
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius, toCanvas(minAngle), toCanvas(maxAngle));
        ctx.stroke();

        // Red zone
        var redStart = dbToAngle(0);
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius + 7, toCanvas(redStart), toCanvas(maxAngle));
        ctx.arc(cx, cy, arcRadius - 3, toCanvas(maxAngle), toCanvas(redStart), true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(180, 60, 50, 0.2)';
        ctx.fill();

        // DB markings
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        for (var i = 0; i < dbMarks.length; i++) {
            var db = dbMarks[i];
            var a = dbToAngle(db);
            var inner = tip(a, arcRadius - 5);
            var outer = tip(a, arcRadius + 4);
            var text = tip(a, arcRadius + 16);

            ctx.beginPath();
            ctx.moveTo(inner.x, inner.y);
            ctx.lineTo(outer.x, outer.y);
            ctx.strokeStyle = db >= 0 ? 'rgba(180, 60, 50, 0.4)' : 'rgba(196, 163, 90, 0.3)';
            ctx.lineWidth = db === 0 || db === -20 ? 1 : 0.5;
            ctx.stroke();

            ctx.fillStyle = db >= 0 ? 'rgba(180, 60, 50, 0.45)' : 'rgba(196, 163, 90, 0.4)';
            var label = db === 0 ? '0' : db > 0 ? '+' + db : String(db);
            ctx.fillText(label, text.x, text.y + 3);
        }

        // Sub-ticks
        for (var d = -20; d <= 3; d += 1) {
            if (dbMarks.indexOf(d) !== -1) continue;
            var sa = dbToAngle(d);
            var si = tip(sa, arcRadius - 2);
            var so = tip(sa, arcRadius + 2);
            ctx.beginPath();
            ctx.moveTo(si.x, si.y);
            ctx.lineTo(so.x, so.y);
            ctx.strokeStyle = d >= 0 ? 'rgba(180, 60, 50, 0.15)' : 'rgba(196, 163, 90, 0.12)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // --- Needle ---
        var nt = tip(needleAngle, needleLen);

        // Shadow
        ctx.beginPath();
        ctx.moveTo(cx + 2, cy + 1);
        ctx.lineTo(nt.x + 2, nt.y + 1);
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.12)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nt.x, nt.y);
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Tip glow
        if (glowIntensity > 0.1) {
            var tipGrad = ctx.createRadialGradient(nt.x, nt.y, 0, nt.x, nt.y, 8);
            tipGrad.addColorStop(0, 'rgba(196, 163, 90, ' + (glowIntensity * 0.25) + ')');
            tipGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = tipGrad;
            ctx.beginPath();
            ctx.arc(nt.x, nt.y, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Peak hold
        if (peakAngle > minAngle + 0.05) {
            var pkTip = tip(peakAngle, needleLen * 0.9);
            var pkBase = tip(peakAngle, needleLen * 0.6);
            ctx.beginPath();
            ctx.moveTo(pkBase.x, pkBase.y);
            ctx.lineTo(pkTip.x, pkTip.y);
            ctx.strokeStyle = 'rgba(196, 163, 90, 0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Pivot cap
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#2a2520';
        ctx.fill();
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.12)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // --- RECEIVE indicator ---
        if (!hasStarted) {
            var flash = Math.sin(time * 0.08) * 0.5 + 0.5;
            var recAlpha = 0.3 + flash * 0.45;

            ctx.fillStyle = 'rgba(50, 140, 60, ' + (recAlpha * 0.3) + ')';
            ctx.fillRect(recX, recY, recW, recH);
            ctx.strokeStyle = 'rgba(60, 160, 70, ' + (recAlpha * 0.55) + ')';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(recX, recY, recW, recH);

            ctx.beginPath();
            ctx.arc(recX + 9, recY + recH / 2, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(70, 180, 80, ' + recAlpha + ')';
            ctx.fill();

            ctx.font = '500 6px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(70, 175, 80, ' + (recAlpha * 0.9) + ')';
            ctx.fillText('RECEIVE TRANSMISSION', recX + 16, recY + recH / 2 + 2);
        } else if (isPlaying) {
            ctx.fillStyle = 'rgba(50, 140, 60, 0.15)';
            ctx.fillRect(recX, recY, recW, recH);
            ctx.strokeStyle = 'rgba(60, 160, 70, 0.25)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(recX, recY, recW, recH);

            ctx.beginPath();
            ctx.arc(recX + 9, recY + recH / 2, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(70, 180, 80, 0.55)';
            ctx.fill();

            ctx.font = '500 6px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(70, 175, 80, 0.45)';
            ctx.fillText('RECEIVING', recX + 16, recY + recH / 2 + 2);
        }

        // Inner bezel shadow
        var ibGrad = ctx.createLinearGradient(0, 0, 0, 6);
        ibGrad.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
        ibGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = ibGrad;
        ctx.fillRect(1, 1, W - 2, 6);
    }

    // --- Audio ---
    function initAudio() {
        if (audio) return;
        audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.src = audioSrc;
        audio.preload = 'auto';

        audio.addEventListener('ended', function() {
            isPlaying = false;
            statusEl.textContent = 'TRANSMISSION COMPLETE \u2014 CLICK TO REPLAY';
        });

        audio.addEventListener('timeupdate', function() {
            if (audio.duration) {
                progressBar.style.width = (audio.currentTime / audio.duration * 100) + '%';
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
            statusEl.textContent = 'RECEIVING TRANSMISSION';
        }).catch(function() {
            statusEl.textContent = 'SIGNAL ERROR \u2014 TRY AGAIN';
        });
    }

    function togglePlay() {
        if (!hasStarted) { startPlayback(); return; }
        if (isPlaying) {
            audio.pause();
            isPlaying = false;
            statusEl.textContent = 'PAUSED \u2014 CLICK TO RESUME';
        } else {
            audio.play().then(function() {
                isPlaying = true;
                statusEl.textContent = 'RECEIVING TRANSMISSION';
            });
        }
    }

    // --- Click ---
    canvas.addEventListener('click', function(e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = W / rect.width;
        var scaleY = H / rect.height;
        var mx = (e.clientX - rect.left) * scaleX;
        var my = (e.clientY - rect.top) * scaleY;

        if (!hasStarted && mx >= recX && mx <= recX + recW && my >= recY && my <= recY + recH) {
            startPlayback();
            return;
        }
        togglePlay();
    });

    progressWrap.addEventListener('click', function(e) {
        if (!audio || !audio.duration) return;
        var rect = progressWrap.getBoundingClientRect();
        audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    });

    // --- Animate ---
    function animate() {
        if (isPlaying && analyser) {
            var dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            var sum = 0;
            var count = Math.min(dataArray.length, 64);
            for (var i = 0; i < count; i++) {
                sum += dataArray[i] * (1 - (i / count) * 0.5);
            }
            var avg = sum / count / 255;
            targetAngle = dbToAngle(-20 + avg * 26);
            glowIntensity += (1 - glowIntensity) * 0.05;
        } else {
            targetAngle = minAngle;
            glowIntensity *= 0.95;
        }

        needleAngle += (targetAngle - needleAngle) * 0.15;

        if (needleAngle > peakAngle) {
            peakAngle = needleAngle;
            peakDecay = 60;
        } else {
            peakDecay--;
            if (peakDecay <= 0) peakAngle += (minAngle - peakAngle) * 0.03;
        }

        draw();
        requestAnimationFrame(animate);
    }

    draw();
    animate();

})();
