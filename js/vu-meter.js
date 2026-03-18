/* ============================================
   FATA ORGANA — VU Meter Audio Player
   Round semicircular meter face
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

    // --- Canvas setup (square for round meter) ---
    var canvas = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    var W = 400;
    var H = 280; // semicircle + sconce area
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

    // Get current track title from the now-playing element
    function getTrackTitle() {
        var el = document.getElementById('now-playing-title');
        return (el && el.textContent) ? el.textContent : '';
    }

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
    // Semicircle centered horizontally, pivot near bottom
    var cx = W / 2;
    var cy = H * 0.78;
    var meterRadius = W * 0.44; // radius of the semicircle face
    var needleLen = meterRadius * 0.88;
    var arcRadius = needleLen * 0.78;
    var BASE_ANGLE = -Math.PI / 2; // straight up
    var minAngle = -1.0;  // sweep left
    var maxAngle = 1.0;   // sweep right
    var dbMarks = [-20, -10, -7, -5, -3, -1, 0, +1, +3];

    function dbToAngle(db) {
        // Map -20 to +3 across the arc
        // Use less compression so the red zone (+0 to +3) gets more space
        var normalized = (db + 20) / 23;
        normalized = Math.max(0, Math.min(1, normalized));
        normalized = Math.pow(normalized, 0.55);
        return minAngle + normalized * (maxAngle - minAngle);
    }

    function toCanvas(a) {
        return BASE_ANGLE + a;
    }

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
        var playing = sig.isPlaying && sig.hasStarted;

        var breathSlow = Math.sin(time * 0.01) * 0.5 + 0.5;
        var breathMod = 0.85 + breathSlow * 0.15;

        // Color temperature from energy
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

        var blBase = playing ? (0.14 + energy * 0.35) : 0.16;
        var blIntensity = blBase * breathMod;

        // === SEMICIRCULAR FACE ===
        // Clip to semicircle for all face painting
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, meterRadius + 2, Math.PI, 0); // upper semicircle
        ctx.lineTo(cx + meterRadius + 2, cy + 8);
        ctx.lineTo(cx - meterRadius - 2, cy + 8);
        ctx.closePath();
        ctx.clip();

        // Warm face background — like backlit amber glass
        var faceBright = playing ? Math.max(0.5, 1 - energy * 0.6) : 1;
        var faceGrad = ctx.createRadialGradient(cx, cy + meterRadius * 0.3, 0, cx, cy - meterRadius * 0.2, meterRadius * 1.1);
        // Warm amber tones — brighter than before, like the reference photo
        var r1 = Math.round(55 * faceBright);
        var g1 = Math.round(42 * faceBright);
        var b1 = Math.round(22 * faceBright);
        faceGrad.addColorStop(0, 'rgb(' + r1 + ',' + g1 + ',' + b1 + ')');
        var r2 = Math.round(40 * faceBright);
        var g2 = Math.round(33 * faceBright);
        var b2 = Math.round(16 * faceBright);
        faceGrad.addColorStop(0.5, 'rgb(' + r2 + ',' + g2 + ',' + b2 + ')');
        faceGrad.addColorStop(1, 'rgb(' + Math.round(25 * faceBright) + ',' + Math.round(22 * faceBright) + ',' + Math.round(14 * faceBright) + ')');
        ctx.fillStyle = faceGrad;
        ctx.fillRect(0, 0, W, H);

        // Sconce light — from below the pivot, illuminating upward
        var sconceY = cy + 15;
        var sconceR = meterRadius * (1.1 + energy * 0.1);
        var sconceGrad = ctx.createRadialGradient(cx, sconceY, 0, cx, sconceY, sconceR);
        var si = blIntensity * 0.6;
        sconceGrad.addColorStop(0, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + (si * 0.8) + ')');
        sconceGrad.addColorStop(0.08, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + (si * 0.5) + ')');
        sconceGrad.addColorStop(0.2, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + (si * 0.2) + ')');
        sconceGrad.addColorStop(0.45, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + (si * 0.05) + ')');
        sconceGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = sconceGrad;
        ctx.fillRect(0, 0, W, H);

        // Upward wash
        var washI = playing ? (0.02 + energy * 0.025) * breathMod : 0.015;
        var upGrad = ctx.createLinearGradient(0, cy, 0, cy - meterRadius);
        upGrad.addColorStop(0, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + washI + ')');
        upGrad.addColorStop(0.3, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + (washI * 0.2) + ')');
        upGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = upGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.restore(); // end semicircle clip

        // === SEMICIRCLE EDGE ===
        // Subtle rim around the face
        ctx.beginPath();
        ctx.arc(cx, cy, meterRadius, Math.PI, 0);
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Outer glow on the rim
        ctx.beginPath();
        ctx.arc(cx, cy, meterRadius + 1, Math.PI, 0);
        var rimGlow = playing ? 0.04 + energy * 0.03 : 0.02;
        ctx.strokeStyle = 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + rimGlow + ')';
        ctx.lineWidth = 3;
        ctx.stroke();

        // === VU LABEL ===
        ctx.font = '600 13px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(196, 163, 90, 0.35)';
        ctx.textAlign = 'center';
        ctx.fillText('VU', cx, cy - needleLen + 28);

        // === SCALE ARC ===
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.5)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius, toCanvas(minAngle), toCanvas(maxAngle));
        ctx.stroke();

        // Percent scale arc (inner)
        var pctRadius = arcRadius - 18;
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.2)';
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.arc(cx, cy, pctRadius, toCanvas(minAngle), toCanvas(maxAngle));
        ctx.stroke();

        // === RED ZONE ===
        var redStart = dbToAngle(0);
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius + 8, toCanvas(redStart), toCanvas(maxAngle));
        ctx.arc(cx, cy, arcRadius - 3, toCanvas(maxAngle), toCanvas(redStart), true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(180, 60, 50, 0.35)';
        ctx.fill();

        // === DB MARKINGS ===
        ctx.font = '500 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        for (var i = 0; i < dbMarks.length; i++) {
            var db = dbMarks[i];
            var a = dbToAngle(db);
            var inner = tip(a, arcRadius - 6);
            var outer = tip(a, arcRadius + 5);
            var text = tip(a, arcRadius + 18);

            ctx.beginPath();
            ctx.moveTo(inner.x, inner.y);
            ctx.lineTo(outer.x, outer.y);
            ctx.strokeStyle = db >= 0 ? 'rgba(180, 60, 50, 0.6)' : 'rgba(196, 163, 90, 0.5)';
            ctx.lineWidth = db === 0 || db === -20 ? 1.2 : 0.7;
            ctx.stroke();

            ctx.fillStyle = db >= 0 ? 'rgba(180, 60, 50, 0.65)' : 'rgba(196, 163, 90, 0.6)';
            var label = db === 0 ? '0' : db > 0 ? '+' + db : String(db);
            ctx.fillText(label, text.x, text.y + 3);
        }

        // === PERCENT MARKINGS (inner scale) ===
        var pctMarks = [0, 30, 50, 70, 100];
        var pctDbMap = { 0: -20, 30: -10, 50: -7, 70: -5, 100: 0 };
        ctx.font = '400 8px "JetBrains Mono", monospace';
        for (var pi = 0; pi < pctMarks.length; pi++) {
            var pct = pctMarks[pi];
            var pctDb = pctDbMap[pct];
            var pa = dbToAngle(pctDb);
            var pInner = tip(pa, pctRadius - 3);
            var pOuter = tip(pa, pctRadius + 3);
            var pText = tip(pa, pctRadius - 14);

            ctx.beginPath();
            ctx.moveTo(pInner.x, pInner.y);
            ctx.lineTo(pOuter.x, pOuter.y);
            ctx.strokeStyle = 'rgba(196, 163, 90, 0.25)';
            ctx.lineWidth = 0.5;
            ctx.stroke();

            ctx.fillStyle = 'rgba(196, 163, 90, 0.3)';
            ctx.fillText(pct + '%', pText.x, pText.y + 3);
        }

        // === SUB-TICKS ===
        for (var d = -20; d <= 3; d += 1) {
            if (dbMarks.indexOf(d) !== -1) continue;
            var sa = dbToAngle(d);
            var sti = tip(sa, arcRadius - 2);
            var sto = tip(sa, arcRadius + 2);
            ctx.beginPath();
            ctx.moveTo(sti.x, sti.y);
            ctx.lineTo(sto.x, sto.y);
            ctx.strokeStyle = d >= 0 ? 'rgba(180, 60, 50, 0.25)' : 'rgba(196, 163, 90, 0.2)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // === NEEDLE ===
        var nt = tip(needleAngle, needleLen);

        // Shadow
        ctx.beginPath();
        ctx.moveTo(cx + 1.5, cy + 1);
        ctx.lineTo(nt.x + 1.5, nt.y + 1);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Body — dark needle like the reference
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nt.x, nt.y);
        ctx.strokeStyle = 'rgba(30, 25, 20, 0.9)';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Tip glow
        var tipGlowAlpha = playing ? Math.min(0.3, energy * 0.4) : 0;
        if (tipGlowAlpha > 0.02) {
            var tipGrad = ctx.createRadialGradient(nt.x, nt.y, 0, nt.x, nt.y, 12);
            tipGrad.addColorStop(0, 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + tipGlowAlpha + ')');
            tipGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = tipGrad;
            ctx.beginPath();
            ctx.arc(nt.x, nt.y, 12, 0, Math.PI * 2);
            ctx.fill();
        }

        // Peak hold
        if (peakAngle > minAngle + 0.05) {
            var pkTip = tip(peakAngle, needleLen * 0.9);
            var pkBase = tip(peakAngle, needleLen * 0.6);
            ctx.beginPath();
            ctx.moveTo(pkBase.x, pkBase.y);
            ctx.lineTo(pkTip.x, pkTip.y);
            ctx.strokeStyle = 'rgba(196, 163, 90, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // === SCONCE ===
        // Physical sconce — chrome/metal housing at the pivot
        var sconceW = meterRadius * 0.32;
        var sconceH = 16;
        var sconceTop = cy - 6;

        // Sconce body
        ctx.beginPath();
        ctx.ellipse(cx, sconceTop + sconceH, sconceW, sconceH, 0, Math.PI, 0);
        ctx.lineTo(cx + sconceW, cy + 20);
        ctx.lineTo(cx - sconceW, cy + 20);
        ctx.closePath();
        var sBodyGrad = ctx.createLinearGradient(0, sconceTop, 0, sconceTop + sconceH + 10);
        sBodyGrad.addColorStop(0, '#2a2722');
        sBodyGrad.addColorStop(0.3, '#1e1c18');
        sBodyGrad.addColorStop(1, '#121110');
        ctx.fillStyle = sBodyGrad;
        ctx.fill();

        // Sconce chrome rim
        ctx.beginPath();
        ctx.ellipse(cx, sconceTop + sconceH, sconceW, sconceH, 0, Math.PI, Math.PI * 2);
        var edgeA = playing ? 0.15 + energy * 0.1 : 0.08;
        ctx.strokeStyle = 'rgba(' + Math.round(cr) + ',' + Math.round(cg) + ',' + Math.round(cb) + ',' + edgeA + ')';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pivot dot (on sconce)
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1815';
        ctx.fill();
        ctx.strokeStyle = 'rgba(196, 163, 90, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Red dot (reference point like in the photo)
        var dotAngle = dbToAngle(0);
        var dotPos = tip(dotAngle, arcRadius - 22);
        ctx.beginPath();
        ctx.arc(dotPos.x, dotPos.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180, 60, 50, 0.5)';
        ctx.fill();

        // === PLAY INDICATOR ===
        if (!hasStarted) {
            var flash = Math.sin(time * 0.08) * 0.5 + 0.5;

            // Play triangle — centered on meter face
            var triSize = 30;
            var triX = cx + 3;
            var triY = cy - arcRadius * 0.5;
            var triPulse = 0.12 + Math.sin(time * 0.06) * 0.06;

            ctx.beginPath();
            ctx.moveTo(triX - triSize * 0.42, triY - triSize * 0.5);
            ctx.lineTo(triX + triSize * 0.55, triY);
            ctx.lineTo(triX - triSize * 0.42, triY + triSize * 0.5);
            ctx.closePath();
            ctx.fillStyle = 'rgba(196, 163, 90, ' + (triPulse * 0.3) + ')';
            ctx.fill();
            ctx.strokeStyle = 'rgba(196, 163, 90, ' + (triPulse + 0.08) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // === COUNTDOWN TIMER ===
        if (audio && audio.duration && hasStarted) {
            var remaining = Math.max(0, audio.duration - audio.currentTime);
            var mins = Math.floor(remaining / 60);
            var secs = Math.floor(remaining % 60);
            var timeStr = '-' + mins + ':' + (secs < 10 ? '0' : '') + secs;

            ctx.font = '400 13px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(196, 163, 90, 0.35)';
            ctx.fillText(timeStr, cx, cy + 42);
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
        // Mobile: allow background playback
        audio.setAttribute('playsinline', '');
        audio.setAttribute('webkit-playsinline', '');

        audio.addEventListener('ended', function() {
            isPlaying = false;
            isLoading = false;
            if (window.playNext && window.playNext()) {
                return;
            }
            statusEl.textContent = 'TRANSMISSION COMPLETE';
            updateMediaSession(false);
            if (window.focusMode && window.focusMode.isActive()) {
                window.focusMode.exit();
            }
        });

        audio.addEventListener('timeupdate', function() {
            if (audio.duration) {
                progressBar.style.width = (audio.currentTime / audio.duration * 100) + '%';
            }
        });

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
                isLoading = false;
                doPlay();
            } else if (isPlaying) {
                statusEl.textContent = 'RECEIVING TRANSMISSION';
            }
        });

        // Mobile: handle stall recovery
        audio.addEventListener('stalled', function() {
            if (isPlaying) {
                statusEl.textContent = 'RECOVERING SIGNAL\u2026';
                statusEl.classList.add('loading');
            }
        });

        audio.addEventListener('playing', function() {
            statusEl.classList.remove('loading');
            if (isPlaying) {
                statusEl.textContent = 'RECEIVING TRANSMISSION';
            }
        });

        // Mobile: handle audio interruptions (phone call, etc)
        audio.addEventListener('pause', function() {
            // Only handle external pauses (not our own togglePlay pause)
            if (isPlaying) {
                isPlaying = false;
                statusEl.textContent = 'SIGNAL INTERRUPTED \u2014 TAP TO RESUME';
            }
        });

        audio.addEventListener('error', function(e) {
            console.error('Audio error:', audio.error ? audio.error.code + ' ' + audio.error.message : e);
            isLoading = false;
            isPlaying = false;
            statusEl.classList.remove('loading');
            statusEl.textContent = 'SIGNAL LOST \u2014 TRY AGAIN';
        });

        audio.src = audioSrc;
    }

    // --- Media Session API (background playback on mobile) ---
    function updateMediaSession(playing) {
        if (!('mediaSession' in navigator)) return;

        if (playing) {
            // Get current track title
            var title = 'Fata Organa';
            var nowPlaying = document.getElementById('now-playing-title');
            if (nowPlaying && nowPlaying.textContent) {
                title = nowPlaying.textContent;
            }
            var epDisplay = document.getElementById('ep-display');
            var ep = epDisplay ? epDisplay.textContent.trim() : '';

            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: 'Fata Organa',
                album: ep ? 'Transmission ' + ep : 'Transmissions'
            });

            navigator.mediaSession.setActionHandler('play', function() {
                doPlay();
            });
            navigator.mediaSession.setActionHandler('pause', function() {
                if (audio && isPlaying) {
                    audio.pause();
                    isPlaying = false;
                    statusEl.textContent = 'PAUSED \u2014 TAP TO RESUME';
                }
            });
            navigator.mediaSession.setActionHandler('previoustrack', function() {
                if (window.playPrev) window.playPrev();
            });
            navigator.mediaSession.setActionHandler('nexttrack', function() {
                if (window.playNext) window.playNext();
            });
            navigator.mediaSession.setActionHandler('seekto', function(details) {
                if (audio && details.seekTime !== undefined) {
                    audio.currentTime = details.seekTime;
                }
            });
        }
    }

    // Detect mobile for background playback compatibility
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    function initAnalyser() {
        if (audioCtx) return;
        // On mobile, skip AudioContext entirely — it takes exclusive ownership
        // of the audio element and kills playback when the page backgrounds.
        // The VU needle will use simulated movement on mobile.
        if (isMobile) {
            analyserConnected = false;
            return;
        }
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            connectAnalyser();
        } catch(e) {
            console.error('Analyser init error:', e);
            analyserConnected = false;
        }
    }

    function connectAnalyser() {
        if (!audioCtx || !audio) return;
        if (source) return;
        try {
            source = audioCtx.createMediaElementSource(audio);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            analyser.connect(audioCtx.destination);
            analyserConnected = true;
        } catch(e) {
            console.error('Analyser connect error:', e);
            analyserConnected = false;
        }
    }

    // --- Background/foreground handling ---
    document.addEventListener('visibilitychange', function() {
        if (!audio) return;

        if (!document.hidden) {
            // Page returning to foreground
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().catch(function() {});
            }
            // Resume if audio was interrupted
            if (audio.paused && isPlaying) {
                audio.play().catch(function() {});
            }
        }
    });

    function doPlay() {
        if (!audioCtx && audio) {
            initAnalyser();
        }

        // On mobile, AudioContext must be resumed before playing
        // Otherwise buffered audio replays causing stutter
        var resumePromise;
        if (audioCtx && audioCtx.state === 'suspended') {
            resumePromise = audioCtx.resume();
        } else {
            resumePromise = Promise.resolve();
        }

        resumePromise.then(function() {
            return audio.play();
        }).then(function() {
            isPlaying = true;
            hasStarted = true;
            isLoading = false;
            statusEl.classList.remove('loading');
            statusEl.textContent = 'RECEIVING TRANSMISSION';
            updateMediaSession(true);
            if (window.focusMode && !window.focusMode.isActive()) {
                window.focusMode.enter();
            }
        }).catch(function(err) {
            console.error('Playback error:', err);
            isLoading = false;
            statusEl.classList.remove('loading');
            if (err.name === 'NotAllowedError') {
                statusEl.textContent = 'SIGNAL READY \u2014 TAP TO RECEIVE';
            } else {
                statusEl.textContent = 'SIGNAL ERROR \u2014 TRY AGAIN';
            }
        });
    }

    function startPlayback() {
        if (!audio) initAudio();

        if (audio.readyState >= 3) {
            doPlay();
        } else {
            isLoading = true;
            statusEl.textContent = 'TUNING SIGNAL\u2026';
            audio.load();
        }
    }

    function togglePlay() {
        if (!hasStarted) {
            startPlayback();
            return;
        }
        if (isPlaying) {
            isPlaying = false; // set before pause so the pause event listener knows it's intentional
            audio.pause();
            statusEl.textContent = 'PAUSED \u2014 TAP TO RESUME';
            if (window.focusMode && window.focusMode.isActive()) {
                window.focusMode.exit();
            }
        } else {
            doPlay();
        }
    }

    // --- Click ---
    canvas.addEventListener('click', function(e) {
        e.stopPropagation();
        togglePlay();
    });

    progressWrap.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!audio || !audio.duration) return;
        var rect = progressWrap.getBoundingClientRect();
        audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    });

    // --- Expose signal data for ambient light system ---
    window.vuSignal = {
        rms: 0,
        low: 0,
        high: 0,
        peak: 0,
        isPlaying: false,
        hasStarted: false,
        smoothRms: 0,
        smoothLow: 0
    };

    // --- Public API ---
    window.vuPlayer = {
        loadSource: function(src, autoplay) {
            if (!src) return;

            if (audio) {
                audio.pause();
                isPlaying = false;
            }

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
                    statusEl.textContent = getTrackTitle() || 'RECEIVE TRANSMISSION';
                }
            } else {
                if (autoplay) {
                    isLoading = true;
                    statusEl.textContent = 'TUNING SIGNAL\u2026';
                    statusEl.classList.add('loading');
                    startPlayback();
                } else {
                    statusEl.classList.remove('loading');
                    statusEl.textContent = getTrackTitle() || 'RECEIVE TRANSMISSION';
                }
            }
        },
        play: function() { startPlayback(); },
        pause: function() { if (audio && isPlaying) { audio.pause(); isPlaying = false; } },
        isPlaying: function() { return isPlaying; },
        getCurrentSrc: function() { return audioSrc; }
    };

    // --- Animate ---
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

            var binCount = analyser.frequencyBinCount;

            var subSum = 0;
            for (var i = 0; i < 3 && i < binCount; i++) subSum += dataArray[i];
            var subLevel = subSum / (3 * 255);

            var voiceSum = 0;
            var voiceBins = Math.min(23, binCount) - 2;
            for (var i = 2; i < 23 && i < binCount; i++) voiceSum += dataArray[i];
            var voiceLevel = voiceBins > 0 ? voiceSum / (voiceBins * 255) : 0;

            var highSum = 0;
            var highBins = Math.min(40, binCount) - 23;
            for (var i = 23; i < 40 && i < binCount; i++) highSum += dataArray[i];
            var highLevel = highBins > 0 ? highSum / (highBins * 255) : 0;

            var totalSum = 0;
            var totalCount = Math.min(binCount, 64);
            for (var i = 0; i < totalCount; i++) totalSum += dataArray[i];
            var rmsLevel = totalSum / (totalCount * 255);

            var needleLevel;
            var isScore = window.currentBand === 'score';

            if (isScore) {
                needleLevel = subLevel * 0.7 + voiceLevel * 0.2 + highLevel * 0.1;
            } else {
                needleLevel = voiceLevel * 0.65 + subLevel * 0.15 + highLevel * 0.2;
            }

            var delta = needleLevel - prevLevel;
            if (delta > 0.02) {
                transientBoost = Math.min(delta * 3, 0.25);
            }
            transientBoost *= 0.85;
            prevLevel = needleLevel;

            needleLevel += transientBoost;

            if (needleLevel > smoothedLevel) {
                smoothedLevel += (needleLevel - smoothedLevel) * 0.25;
            } else {
                smoothedLevel += (needleLevel - smoothedLevel) * 0.06;
            }

            smoothedLow += (subLevel - smoothedLow) * 0.08;
            smoothedMid += (voiceLevel - smoothedMid) * 0.1;
            smoothedHigh += (highLevel - smoothedHigh) * 0.1;

            var scaledLevel = Math.pow(smoothedLevel, 0.5) * 0.75;
            scaledLevel = Math.min(scaledLevel, 1.0);
            targetAngle = dbToAngle(-20 + scaledLevel * 20);
            glowIntensity += (1 - glowIntensity) * 0.05;

            window.vuSignal.rms = rmsLevel;
            window.vuSignal.low = smoothedLow;
            window.vuSignal.high = smoothedHigh;
            window.vuSignal.peak = Math.max(scaledLevel, window.vuSignal.peak * 0.98);
            window.vuSignal.isPlaying = true;
            window.vuSignal.smoothRms += (rmsLevel - window.vuSignal.smoothRms) * 0.03;
            window.vuSignal.smoothLow += (smoothedLow - window.vuSignal.smoothLow) * 0.02;
        } else if (isPlaying && !analyserConnected) {
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

    // Set initial status to track title (after DOM is ready)
    setTimeout(function() {
        var title = getTrackTitle();
        if (title && !hasStarted) {
            statusEl.textContent = title;
        }
    }, 100);

})();
