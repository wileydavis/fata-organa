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

        // Read signal data for backlight
        var sig = window.vuSignal || {};
        var energy = sig.smoothRms || 0;
        var lowE = sig.smoothLow || 0;
        var playing = sig.isPlaying && sig.hasStarted;

        // Breathing modulation (slow sine, matches ambient-light.js)
        var breath = Math.sin(time * 0.006 / (60/1000) + 0) * 0.5 + 0.5;
        // Simpler: use frame count
        var breathSlow = Math.sin(time * 0.01) * 0.5 + 0.5;
        var breathMod = 0.85 + breathSlow * 0.15;

        // Color temperature from energy (matches ambient-light.js palette)
        var cTemp = Math.min(1, energy * 2);
        var cr, cg, cb;
        if (cTemp < 0.5) {
            var t = cTemp * 2;
            cr = 196 + t * (220 - 196);
            cg = 163 + t * (190 - 163);
            cb = 90  + t * (110 - 90);
        } else {
            var t2 = (cTemp - 0.5) * 2;
            cr = 220 + t2 * (240 - 220);
            cg = 190 + t2 * (220 - 190);
            cb = 110 + t2 * (170 - 110);
        }

        // Backlight intensity: base level + audio-driven boost
        var blBase = playing ? (0.14 + energy * 0.35) : 0.16;
        var blIntensity = blBase * breathMod;

        // Face background — darken when playing for more contrast
        var faceBright = playing ? Math.max(0.4, 1 - energy * 0.8) : 1;
        var faceGrad = ctx.createRadialGradient(cx, cy - H * 0.3, 10, cx, cy, H * 1.3);
        var fr = Math.round(37 * faceBright);
        var fg = Math.round(32 * faceBright);
        var fb = Math.round(24 * faceBright);
        faceGrad.addColorStop(0, 'rgb(' + fr + ',' + fg + ',' + fb + ')');
        fr = Math.round(26 * faceBright);
        fg = Math.round(23 * faceBright);
        fb = Math.round(16 * faceBright);
        faceGrad.addColorStop(0.5, 'rgb(' + fr + ',' + fg + ',' + fb + ')');
        faceGrad.addColorStop(1, 'rgb(' + Math.round(17 * faceBright) + ',' + Math.round(16 * faceBright) + ',' + Math.round(16 * faceBright) + ')');
        ctx.fillStyle = faceGrad;
        ctx.fillRect(0, 0, W, H);

        // Warm backlight — signal-driven color and intensity
        var blGrad = ctx.createRadialGradient(cx, H * 0.35, 0, cx, H * 0.35, W * (0.5 + energy * 0.15));
        blGrad.addColorStop(0, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + blIntensity + ')');
        blGrad.addColorStop(0.35, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + (blIntensity * 0.45) + ')');
        blGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = blGrad;
        ctx.fillRect(0, 0, W, H);

        // Subtle warm wash — also signal-driven
        var washAlpha = playing ? (0.02 + energy * 0.05) * breathMod : 0.03;
        var warmLR = ctx.createLinearGradient(0, 0, W, 0);
        warmLR.addColorStop(0, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + (washAlpha * 0.8) + ')');
        warmLR.addColorStop(0.5, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + washAlpha + ')');
        warmLR.addColorStop(1, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + (washAlpha * 0.6) + ')');
        ctx.fillStyle = warmLR;
        ctx.fillRect(0, 0, W, H);

        // VU label
        ctx.font = '500 11px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(196, 163, 90, 0.3)';
        ctx.textAlign = 'center';
        ctx.fillText('VU', cx, cy - needleLen + 20);

        // Scale arc
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.45)';
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
        ctx.fillStyle = 'rgba(180, 60, 50, 0.3)';
        ctx.fill();

        // DB markings
        ctx.font = '10px "JetBrains Mono", monospace';
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
            ctx.strokeStyle = db >= 0 ? 'rgba(180, 60, 50, 0.55)' : 'rgba(196, 163, 90, 0.45)';
            ctx.lineWidth = db === 0 || db === -20 ? 1.2 : 0.6;
            ctx.stroke();

            ctx.fillStyle = db >= 0 ? 'rgba(180, 60, 50, 0.6)' : 'rgba(196, 163, 90, 0.55)';
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
            ctx.strokeStyle = d >= 0 ? 'rgba(180, 60, 50, 0.22)' : 'rgba(196, 163, 90, 0.18)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // --- Needle ---
        var nt = tip(needleAngle, needleLen);

        // Shadow
        ctx.beginPath();
        ctx.moveTo(cx + 2, cy + 1);
        ctx.lineTo(nt.x + 2, nt.y + 1);
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.15)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nt.x, nt.y);
        ctx.strokeStyle = 'rgba(210, 178, 100, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Tip glow
        var tipGlowAlpha = playing ? Math.min(0.4, energy * 0.5) : 0;
        if (tipGlowAlpha > 0.02) {
            var tipGrad = ctx.createRadialGradient(nt.x, nt.y, 0, nt.x, nt.y, 10);
            tipGrad.addColorStop(0, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + tipGlowAlpha + ')');
            tipGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = tipGrad;
            ctx.beginPath();
            ctx.arc(nt.x, nt.y, 10, 0, Math.PI * 2);
            ctx.fill();
        }

        // Peak hold
        if (peakAngle > minAngle + 0.05) {
            var pkTip = tip(peakAngle, needleLen * 0.9);
            var pkBase = tip(peakAngle, needleLen * 0.6);
            ctx.beginPath();
            ctx.moveTo(pkBase.x, pkBase.y);
            ctx.lineTo(pkTip.x, pkTip.y);
            ctx.strokeStyle = 'rgba(196, 163, 90, 0.18)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Pivot cap
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#2a2520';
        ctx.fill();
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.18)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // --- RECEIVE indicator ---
        if (!hasStarted) {
            var flash = Math.sin(time * 0.08) * 0.5 + 0.5;
            var recAlpha = 0.35 + flash * 0.5;

            ctx.fillStyle = 'rgba(50, 140, 60, ' + (recAlpha * 0.35) + ')';
            ctx.fillRect(recX, recY, recW, recH);
            ctx.strokeStyle = 'rgba(60, 160, 70, ' + (recAlpha * 0.6) + ')';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(recX, recY, recW, recH);

            ctx.beginPath();
            ctx.arc(recX + 9, recY + recH / 2, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(70, 190, 80, ' + recAlpha + ')';
            ctx.fill();

            ctx.font = '500 7px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(70, 185, 80, ' + (recAlpha * 0.95) + ')';
            ctx.fillText('RECEIVE TRANSMISSION', recX + 16, recY + recH / 2 + 2.5);
        } else if (isPlaying) {
            ctx.fillStyle = 'rgba(50, 140, 60, 0.2)';
            ctx.fillRect(recX, recY, recW, recH);
            ctx.strokeStyle = 'rgba(60, 160, 70, 0.35)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(recX, recY, recW, recH);

            ctx.beginPath();
            ctx.arc(recX + 9, recY + recH / 2, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(70, 190, 80, 0.65)';
            ctx.fill();

            ctx.font = '500 7px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(70, 185, 80, 0.55)';
            ctx.fillText('RECEIVING', recX + 16, recY + recH / 2 + 2.5);
        }

    }

    // --- Audio ---
    var isLoading = false;
    var analyserConnected = false;

    function isSameOrigin(src) {
        if (!src || src.charAt(0) === '/') return true;
        try {
            var url = new URL(src, window.location.href);
            return url.origin === window.location.origin;
        } catch(e) { return false; }
    }

    function initAudio() {
        if (audio) return;
        audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.preload = 'auto';

        audio.addEventListener('ended', function() {
            isPlaying = false;
            isLoading = false;
            statusEl.textContent = 'TRANSMISSION COMPLETE \u2014 CLICK TO REPLAY';
        });

        audio.addEventListener('timeupdate', function() {
            if (audio.duration) {
                progressBar.style.width = (audio.currentTime / audio.duration * 100) + '%';
            }
        });

        // Loading states
        audio.addEventListener('loadstart', function() {
            if (isLoading) {
                statusEl.textContent = 'TUNING SIGNAL\u2026';
                statusEl.classList.add('loading');
            }
        });

        audio.addEventListener('waiting', function() {
            if (isPlaying || isLoading) {
                statusEl.textContent = 'BUFFERING SIGNAL\u2026';
                statusEl.classList.add('loading');
            }
        });

        audio.addEventListener('canplay', function() {
            statusEl.classList.remove('loading');
            if (isLoading && !isPlaying) {
                // Auto-start when enough data is buffered
                isLoading = false;
                doPlay();
            } else if (isPlaying) {
                statusEl.textContent = 'RECEIVING TRANSMISSION';
            }
        });

        audio.addEventListener('error', function() {
            isLoading = false;
            isPlaying = false;
            statusEl.classList.remove('loading');
            statusEl.textContent = 'SIGNAL LOST \u2014 TRY AGAIN';
        });

        audio.src = audioSrc;
    }

    function initAnalyser() {
        if (audioCtx) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            source = audioCtx.createMediaElementSource(audio);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            analyser.connect(audioCtx.destination);
            analyserConnected = true;
        } catch(e) {
            analyserConnected = false;
        }
    }

    function doPlay() {
        if (!audioCtx) initAnalyser();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        audio.play().then(function() {
            isPlaying = true;
            hasStarted = true;
            isLoading = false;
            statusEl.classList.remove('loading');
            statusEl.textContent = 'RECEIVING TRANSMISSION';
        }).catch(function(err) {
            isLoading = false;
            statusEl.classList.remove('loading');
            // Autoplay blocked — user needs to click
            if (err.name === 'NotAllowedError') {
                statusEl.textContent = 'SIGNAL READY \u2014 CLICK TO RECEIVE';
            } else {
                statusEl.textContent = 'SIGNAL ERROR \u2014 TRY AGAIN';
            }
        });
    }

    function startPlayback() {
        if (!audio) initAudio();

        // If audio has enough data, play immediately
        if (audio.readyState >= 3) {
            doPlay();
        } else {
            // Start loading, will auto-play on canplay
            isLoading = true;
            statusEl.textContent = 'TUNING SIGNAL\u2026';
            audio.load();
        }
    }

    function togglePlay() {
        if (!hasStarted) { startPlayback(); return; }
        if (isPlaying) {
            audio.pause();
            isPlaying = false;
            statusEl.textContent = 'PAUSED \u2014 CLICK TO RESUME';
        } else {
            doPlay();
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

    // --- Expose signal data for ambient light system ---
    window.vuSignal = {
        rms: 0,           // overall level 0-1
        low: 0,           // low frequency energy 0-1 (kick/drone)
        high: 0,          // high frequency energy 0-1 (hiss/texture)
        peak: 0,          // recent peak 0-1
        isPlaying: false,
        hasStarted: false,
        smoothRms: 0,     // heavily smoothed for slow breathing
        smoothLow: 0      // heavily smoothed low end
    };

    // --- Public API for loading new audio sources ---
    window.vuPlayer = {
        loadSource: function(src, autoplay) {
            if (!src) return;

            // Stop current playback
            if (audio) {
                audio.pause();
                isPlaying = false;
            }

            // Update source
            audioSrc = src;
            hasStarted = false;
            isLoading = false;
            progressBar.style.width = '0%';

            if (audio) {
                audio.src = src;
                if (autoplay) {
                    isLoading = true;
                    statusEl.textContent = 'TUNING SIGNAL\u2026';
                    statusEl.classList.add('loading');
                    audio.load();
                } else {
                    statusEl.classList.remove('loading');
                    statusEl.textContent = 'RECEIVE TRANSMISSION';
                }
            } else {
                if (autoplay) {
                    isLoading = true;
                    statusEl.textContent = 'TUNING SIGNAL\u2026';
                    statusEl.classList.add('loading');
                    startPlayback();
                } else {
                    statusEl.classList.remove('loading');
                    statusEl.textContent = 'RECEIVE TRANSMISSION';
                }
            }
        },
        play: function() { startPlayback(); },
        pause: function() { if (audio && isPlaying) { audio.pause(); isPlaying = false; } },
        isPlaying: function() { return isPlaying; },
        getCurrentSrc: function() { return audioSrc; }
    };

    // --- Animate ---
    // Smoothed values for needle drive
    var smoothedLevel = 0;
    var smoothedLow = 0;
    var smoothedMid = 0;
    var smoothedHigh = 0;
    var prevLevel = 0;
    var transientBoost = 0;

    function animate() {
        if (isPlaying && analyser && analyserConnected) {
            var dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);

            // Frequency bin layout (fftSize=256, 128 bins, ~172Hz per bin at 44100Hz):
            //   bins 0-1:   0-344Hz    (sub-bass, kick drum)
            //   bins 1-3:   172-688Hz  (bass, low voice)
            //   bins 3-12:  516-2064Hz (voice fundamental, midrange)
            //   bins 12-23: 2064-3956Hz (voice presence, clarity)
            //   bins 23+:   4000Hz+    (sibilance, air)

            var binCount = analyser.frequencyBinCount;

            // Sub-bass / kick: bins 0-2 (0-516Hz)
            var subSum = 0;
            for (var i = 0; i < 3 && i < binCount; i++) subSum += dataArray[i];
            var subLevel = subSum / (3 * 255);

            // Voice band: bins 2-23 (344-3956Hz)
            var voiceSum = 0;
            var voiceBins = Math.min(23, binCount) - 2;
            for (var i = 2; i < 23 && i < binCount; i++) voiceSum += dataArray[i];
            var voiceLevel = voiceBins > 0 ? voiceSum / (voiceBins * 255) : 0;

            // High presence: bins 23-40
            var highSum = 0;
            var highBins = Math.min(40, binCount) - 23;
            for (var i = 23; i < 40 && i < binCount; i++) highSum += dataArray[i];
            var highLevel = highBins > 0 ? highSum / (highBins * 255) : 0;

            // Overall RMS for signal data
            var totalSum = 0;
            var totalCount = Math.min(binCount, 64);
            for (var i = 0; i < totalCount; i++) totalSum += dataArray[i];
            var rmsLevel = totalSum / (totalCount * 255);

            // --- Band-aware needle drive ---
            var needleLevel;
            var isScore = window.currentBand === 'score';

            if (isScore) {
                // Score mode: follow kick/bass pulse
                // Weight heavily toward sub-bass with some mid for melodic movement
                needleLevel = subLevel * 0.7 + voiceLevel * 0.2 + highLevel * 0.1;
            } else {
                // Transmission mode: follow voice energy
                // Weight toward voice band with sub for room/breath
                needleLevel = voiceLevel * 0.65 + subLevel * 0.15 + highLevel * 0.2;
            }

            // Transient detection — boost the needle on sudden increases
            var delta = needleLevel - prevLevel;
            if (delta > 0.02) {
                transientBoost = Math.min(delta * 3, 0.25);
            }
            transientBoost *= 0.85; // decay
            prevLevel = needleLevel;

            // Apply transient boost
            needleLevel += transientBoost;

            // Heavy smoothing — different rates for attack vs release
            // Fast attack (voice onset / kick hit), slow release (natural decay)
            if (needleLevel > smoothedLevel) {
                smoothedLevel += (needleLevel - smoothedLevel) * 0.25; // attack
            } else {
                smoothedLevel += (needleLevel - smoothedLevel) * 0.06; // release
            }

            // Smooth the sub-bands for vuSignal exposure
            smoothedLow += (subLevel - smoothedLow) * 0.08;
            smoothedMid += (voiceLevel - smoothedMid) * 0.1;
            smoothedHigh += (highLevel - smoothedHigh) * 0.1;

            // Drive the needle from smoothed level
            // Scale to use more of the needle range
            var scaledLevel = Math.pow(smoothedLevel, 0.7) * 1.4; // compress + expand range
            scaledLevel = Math.min(scaledLevel, 1.0);
            targetAngle = dbToAngle(-20 + scaledLevel * 26);
            glowIntensity += (1 - glowIntensity) * 0.05;

            // Update exposed signal data
            window.vuSignal.rms = rmsLevel;
            window.vuSignal.low = smoothedLow;
            window.vuSignal.high = smoothedHigh;
            window.vuSignal.peak = Math.max(scaledLevel, window.vuSignal.peak * 0.98);
            window.vuSignal.isPlaying = true;
            window.vuSignal.smoothRms += (rmsLevel - window.vuSignal.smoothRms) * 0.03;
            window.vuSignal.smoothLow += (smoothedLow - window.vuSignal.smoothLow) * 0.02;
        } else if (isPlaying && !analyserConnected) {
            // Cross-origin audio without CORS — simulate gentle needle activity
            time += 0.016;
            var fakeLevel = 0.35 + Math.sin(time * 1.7) * 0.08 + Math.sin(time * 3.1) * 0.05 + Math.random() * 0.03;
            targetAngle = dbToAngle(-20 + fakeLevel * 26);
            glowIntensity += (1 - glowIntensity) * 0.05;

            window.vuSignal.rms = fakeLevel;
            window.vuSignal.low = fakeLevel * 0.6;
            window.vuSignal.high = fakeLevel * 0.3;
            window.vuSignal.peak = Math.max(fakeLevel, window.vuSignal.peak * 0.98);
            window.vuSignal.isPlaying = true;
            window.vuSignal.smoothRms += (fakeLevel - window.vuSignal.smoothRms) * 0.03;
            window.vuSignal.smoothLow += (fakeLevel * 0.6 - window.vuSignal.smoothLow) * 0.02;
        } else {
            targetAngle = minAngle;
            glowIntensity *= 0.95;
            window.vuSignal.rms *= 0.95;
            window.vuSignal.low *= 0.95;
            window.vuSignal.high *= 0.95;
            window.vuSignal.peak *= 0.97;
            window.vuSignal.smoothRms *= 0.98;
            window.vuSignal.smoothLow *= 0.98;
            window.vuSignal.isPlaying = false;
        }

        window.vuSignal.hasStarted = hasStarted;

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
