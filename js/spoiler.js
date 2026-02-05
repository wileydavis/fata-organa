/* ============================================
   FATA ORGANA — Spoiler / Redaction System
   
   Usage: Add data-spoiler="N" to any element.
   Content is redacted until episode N is reached.
   
   Levels:
     0  = No episodes released (most content redacted)
     1  = Episode 1 released (reveals ep1-related lore)
     ...
     12 = All episodes released (fully declassified)
   ============================================ */

(function() {
    'use strict';

    var STORAGE_KEY = 'fataorgana_clearance';
    var SEEN_KEY = 'fataorgana_onboarded';
    var MAX_LEVEL = 12;

    // --- State ---
    function getLevel() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored !== null) {
                var n = parseInt(stored, 10);
                if (!isNaN(n) && n >= 0 && n <= MAX_LEVEL) return n;
            }
        } catch(e) {}
        return 0;
    }

    function setLevel(n) {
        try {
            localStorage.setItem(STORAGE_KEY, String(n));
        } catch(e) {}
        applyRedactions(n);
        updateToggleDisplay(n);
        updateModalDisplay(n);
    }

    function hasBeenOnboarded() {
        try {
            return sessionStorage.getItem(SEEN_KEY) === '1';
        } catch(e) { return false; }
    }

    function markOnboarded() {
        try {
            sessionStorage.setItem(SEEN_KEY, '1');
        } catch(e) {}
    }

    function shouldShowOnboarding() {
        if (hasBeenOnboarded()) return false;
        var path = window.location.pathname.replace(/\/+$/, '') || '/';
        return (path === '' || path === '/' || path === '/archive' || path.indexOf('/archive') === 0);
    }

    // --- Apply redactions ---
    function applyRedactions(level) {
        var elements = document.querySelectorAll('[data-spoiler]');
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var required = parseInt(el.getAttribute('data-spoiler'), 10);
            if (isNaN(required)) continue;

            if (level >= required) {
                el.classList.remove('redacted');
                el.classList.add('declassified');
                el.setAttribute('aria-hidden', 'false');
            } else {
                el.classList.add('redacted');
                el.classList.remove('declassified');
                el.setAttribute('aria-hidden', 'true');
            }
        }
    }

    // --- First-visit interstitial ---
    function showOnboarding() {
        if (!shouldShowOnboarding()) return;

        var overlay = document.createElement('div');
        overlay.className = 'clearance-modal-overlay';

        var modal = document.createElement('div');
        modal.className = 'clearance-modal';

        modal.innerHTML = ''
            + '<div class="clearance-modal-header">'
            +   '<span class="clearance-modal-classification">SIGNAL INTERCEPT NOTICE</span>'
            +   '<h2>Clearance Required</h2>'
            + '</div>'
            + '<div class="clearance-modal-body">'
            +   '<p>This archive contains recovered materials from the Containment Zone. '
            +   'Documents are <strong>redacted by default</strong> to preserve the integrity of the transmission sequence.</p>'
            +   '<p>Set your spoiler clearance to the number of transmissions (episodes) you have received. '
            +   'Material will be declassified accordingly.</p>'
            +   '<div class="clearance-modal-control">'
            +     '<button class="clearance-modal-btn" id="modal-btn-down">−</button>'
            +     '<span class="clearance-modal-display" id="modal-display">0</span>'
            +     '<button class="clearance-modal-btn" id="modal-btn-up">+</button>'
            +   '</div>'
            +   '<p class="clearance-modal-hint">You can change this anytime using the <strong>Spoiler Clearance</strong> control in the navigation bar.</p>'
            + '</div>'
            + '<button class="clearance-modal-enter" id="modal-enter">Enter Archive</button>';

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Static noise canvas
        var staticCanvas = document.createElement('canvas');
        staticCanvas.className = 'static-canvas';
        staticCanvas.width = window.innerWidth;
        staticCanvas.height = window.innerHeight;
        overlay.insertBefore(staticCanvas, modal);

        var sCtx = staticCanvas.getContext('2d');
        var staticRunning = true;

        function drawStatic() {
            if (!staticRunning) return;
            var w = staticCanvas.width;
            var h = staticCanvas.height;
            var imageData = sCtx.createImageData(w, h);
            var data = imageData.data;
            for (var si = 0; si < data.length; si += 4) {
                var v = Math.random() * 255;
                data[si] = v;
                data[si + 1] = v;
                data[si + 2] = v;
                data[si + 3] = 255;
            }
            sCtx.putImageData(imageData, 0, 0);
            setTimeout(function() { requestAnimationFrame(drawStatic); }, 100);
        }
        drawStatic();

        // Animate in
        requestAnimationFrame(function() {
            overlay.classList.add('visible');
        });

        // Wire up controls
        var modalLevel = getLevel();
        updateModalDisplay(modalLevel);

        document.getElementById('modal-btn-down').addEventListener('click', function() {
            var lvl = getLevel();
            if (lvl > 0) {
                setLevel(lvl - 1);
            }
        });

        document.getElementById('modal-btn-up').addEventListener('click', function() {
            var lvl = getLevel();
            if (lvl < MAX_LEVEL) {
                setLevel(lvl + 1);
            }
        });

        document.getElementById('modal-enter').addEventListener('click', function() {
            markOnboarded();
            staticRunning = false;
            overlay.classList.remove('visible');
            setTimeout(function() {
                overlay.parentNode.removeChild(overlay);
            }, 500);
        });
    }

    function updateModalDisplay(level) {
        var display = document.getElementById('modal-display');
        if (!display) return;
        display.textContent = String(level);
    }

    // --- Build nav toggle ---
    function buildToggle() {
        var nav = document.querySelector('.nav-links');
        if (!nav) return;

        var wrapper = document.createElement('div');
        wrapper.className = 'clearance-toggle';

        var label = document.createElement('span');
        label.className = 'clearance-label';
        label.textContent = 'SPOILER CLEARANCE';

        var control = document.createElement('div');
        control.className = 'clearance-control';

        var btnDown = document.createElement('button');
        btnDown.className = 'clearance-btn';
        btnDown.textContent = '−';
        btnDown.setAttribute('aria-label', 'Decrease clearance level');

        var display = document.createElement('span');
        display.className = 'clearance-display';
        display.id = 'clearance-display';

        var btnUp = document.createElement('button');
        btnUp.className = 'clearance-btn';
        btnUp.textContent = '+';
        btnUp.setAttribute('aria-label', 'Increase clearance level');

        control.appendChild(btnDown);
        control.appendChild(display);
        control.appendChild(btnUp);

        wrapper.appendChild(label);
        wrapper.appendChild(control);

        // Tooltip
        var tooltip = document.createElement('div');
        tooltip.className = 'clearance-tooltip';
        tooltip.textContent = 'Set to the number of episodes you\'ve listened to. Lore documents will be redacted to avoid spoilers.';
        wrapper.appendChild(tooltip);

        nav.appendChild(wrapper);

        var currentLevel = getLevel();
        updateToggleDisplay(currentLevel);

        btnDown.addEventListener('click', function() {
            var lvl = getLevel();
            if (lvl > 0) setLevel(lvl - 1);
        });

        btnUp.addEventListener('click', function() {
            var lvl = getLevel();
            if (lvl < MAX_LEVEL) setLevel(lvl + 1);
        });
    }

    function updateToggleDisplay(level) {
        var display = document.getElementById('clearance-display');
        if (!display) return;
        if (level === 0) {
            display.textContent = '\u25AE\u25AE';
        } else if (level === MAX_LEVEL) {
            display.textContent = level + ' \u2713';
        } else {
            display.textContent = String(level);
        }
    }

    // --- Init ---
    buildToggle();
    applyRedactions(getLevel());
    showOnboarding();

})();
