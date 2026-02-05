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
    var needleAngle = -0.65;
    var targetAngle = -0.65;
    var peakAngle = -0.65;
    var peakDecay = 0;
    var glowIntensity = 0;
    var time = 0;

    // --- Canvas setup ---
    var canvas = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    var W = 380;
    var H = 180;
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
    var cy = H - 8; // pivot visible near bottom edge
    var needleLen = H * 0.82;
    var arcRadius = needleLen * 0.78;
    var minAngle = -0.65;
    var maxAngle = 0.65;
    var clipY = H - 4; // mechanical stop
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

    // Clip a line from (x0,y0)→(x1,y1) so endpoint doesn't exceed maxY
    function clipLine(x0, y0, x1, y1, maxY) {
        if (y1 <= maxY) return { x: x1, y: y1 };
        if (y0 >= maxY) return { x: x0, y: maxY };
        var t = (maxY - y0) / (y1 - y0);
        return { x: x0 + t * (x1 - x0), y: maxY };
    }

    // --- Draw ---
    function draw() {
        time++;
        ctx.clearRect(0, 0, W, H);

        // Face background
        var faceGrad = ctx.createRadialGradient(cx - 60, cy - H * 1.2, 10, cx, cy, H * 1.4);
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
        ctx.fillText('VU', cx, 24);

        // Scale arc
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius, Math.PI + minAngle, Math.PI + maxAngle);
        ctx.stroke();

        // Red zone
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

            var mx1 = cx + Math.cos(Math.PI + a) * markInner;
            var my1 = cy + Math.sin(Math.PI + a) * markInner;
            var mx2 = cx + Math.cos(Math.PI + a) * markOuter;
            var my2 = cy + Math.sin(Math.PI + a) * markOuter;

            if (my1 < clipY && my2 < clipY) {
                ctx.beginPath();
                ctx.moveTo(mx1, my1);
                ctx.lineTo(mx2, my2);
                ctx.strokeStyle = db >= 0 ? 'rgba(180, 60, 50, 0.4)' : 'rgba(196, 163, 90, 0.3)';
                ctx.lineWidth = db === 0 || db === -20 ? 1 : 0.5;
                ctx.stroke();
            }

            var tx = cx + Math.cos(Math.PI + a) * textR;
            var ty = cy + Math.sin(Math.PI + a) * textR + 3;
            if (ty < clipY - 4) {
                ctx.fillStyle = db >= 0 ? 'rgba(180, 60, 50, 0.45)' : 'rgba(196, 163, 90, 0.4)';
                var label = db === 0 ? '0' : db > 0 ? '+' + db : String(db);
                ctx.fillText(label, tx, ty);
            }
        }

        // Sub-ticks
        for (var d = -20; d <= 3; d += 1) {
            if (dbMarks.indexOf(d) !== -1) continue;
            var sa = dbToAngle(d);
            var si1 = arcRadius - 2;
            var si2 = arcRadius + 2;
            var stx1 = cx + Math.cos(Math.PI + sa) * si1;
            var sty1 = cy + Math.sin(Math.PI + sa) * si1;
            var stx2 = cx + Math.cos(Math.PI + sa) * si2;
            var sty2 = cy + Math.sin(Math.PI + sa) * si2;
            if (sty1 < clipY && sty2 < clipY) {
                ctx.beginPath();
                ctx.moveTo(stx1, sty1);
                ctx.lineTo(stx2, sty2);
                ctx.strokeStyle = d >= 0 ? 'rgba(180, 60, 50, 0.15)' : 'rgba(196, 163, 90, 0.12)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }

        // --- Needle ---
        var needleTipX = cx + Math.cos(Math.PI + needleAngle) * needleLen;
        var needleTipY = cy + Math.sin(Math.PI + needleAngle) * needleLen;

        // Clip both ends to visible area
        var baseY = Math.min(cy, clipY);
        var tip = clipLine(cx, baseY, needleTipX, needleTipY, clipY);
        var drawTipX = needleTipY <= clipY ? needleTipX : tip.x;
        var drawTipY = needleTipY <= clipY ? needleTipY : tip.y;
        var drawBaseY = baseY;

        // Needle shadow
        ctx.beginPath();
        ctx.moveTo(cx + 2, drawBaseY + 1);
        ctx.lineTo(drawTipX + 2, drawTipY + 1);
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.12)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Needle body
        ctx.beginPath();
        ctx.moveTo(cx, drawBaseY);
        ctx.lineTo(drawTipX, drawTipY);
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Needle tip glow when active
        if (glowIntensity > 0.1 && drawTipY < clipY - 2) {
            var tipGrad = ctx.createRadialGradient(drawTipX, drawTipY, 0, drawTipX, drawTipY, 8);
            tipGrad.addColorStop(0, 'rgba(196, 163, 90, ' + (glowIntensity * 0.25) + ')');
            tipGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = tipGrad;
            ctx.beginPath();
            ctx.arc(drawTipX, drawTipY, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Peak hold
        if (peakAngle > minAngle + 0.05) {
            var pkTipX = cx + Math.cos(Math.PI + peakAngle) * (needleLen * 0.9);
            var pkTipY = cy + Math.sin(Math.PI + peakAngle) * (needleLen * 0.9);
            var pkBaseX = cx + Math.cos(Math.PI + peakAngle) * (needleLen * 0.6);
            var pkBaseY = cy + Math.sin(Math.PI + peakAngle) * (needleLen * 0.6);
            if (pkTipY < clipY && pkBaseY < clipY) {
                ctx.beginPath();
                ctx.moveTo(pkBaseX, pkBaseY);
                ctx.lineTo(pkTipX, pkTipY);
                ctx.strokeStyle = 'rgba(196, 163, 90, 0.12)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // Pivot cap at bottom
        ctx.beginPath();
        ctx.arc(cx, clipY + 2, 5, Math.PI, 0);
        ctx.fillStyle = '#2a2520';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, clipY + 2, 5, Math.PI, 0);
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.12)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // --- RECEIVE indicator (upper right, inside meter) ---
        if (!hasStarted) {
            // Flashing
            var flash = Math.sin(time * 0.08) * 0.5 + 0.5;
            var recAlpha = 0.3 + flash * 0.45;

            // Background
            ctx.fillStyle = 'rgba(50, 140, 60, ' + (recAlpha * 0.3) + ')';
            ctx.fillRect(recX, recY, recW, recH);

            // Border
            ctx.strokeStyle = 'rgba(60, 160, 70, ' + (recAlpha * 0.55) + ')';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(recX, recY, recW, recH);

            // Dot
            ctx.beginPath();
            ctx.arc(recX + 9, recY + recH / 2, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(70, 180, 80, ' + recAlpha + ')';
            ctx.fill();

            // Text
            ctx.font = '500 6px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(70, 175, 80, ' + (recAlpha * 0.9) + ')';
            ctx.fillText('RECEIVE TRANSMISSION', recX + 16, recY + recH / 2 + 2);
        } else if (isPlaying) {
            // Solid, not flashing
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

        // Inner bezel shadow (top edge)
        var ibGrad = ctx.createLinearGradient(0, 0, 0, 6);
        ibGrad.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
        ibGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = ibGrad;
        ctx.fillRect(1, 1, W - 2, 6);
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
            statusEl.textContent = 'TRANSMISSION COMPLETE \u2014 CLICK TO REPLAY';
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
            statusEl.textContent = 'PAUSED \u2014 CLICK TO RESUME';
        } else {
            audio.play().then(function() {
                isPlaying = true;
                statusEl.textContent = 'RECEIVING TRANSMISSION';
            });
        }
    }

    // --- Click handling ---
    canvas.addEventListener('click', function(e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = W / rect.width;
        var scaleY = H / rect.height;
        var mx = (e.clientX - rect.left) * scaleX;
        var my = (e.clientY - rect.top) * scaleY;

        // Check if click is on REC indicator
        if (!hasStarted && mx >= recX && mx <= recX + recW && my >= recY && my <= recY + recH) {
            startPlayback();
            return;
        }

        togglePlay();
    });

    // Progress bar seeking
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

        draw();
        requestAnimationFrame(animate);
    }

    draw();
    animate();

})();
