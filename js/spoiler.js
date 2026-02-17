/* ============================================
   FATA ORGANA — Spoiler / Redaction System
   
   Usage: Add data-spoiler="N" to any element.
   Content is redacted until episode N is reached.
   
   Levels:
     0  = No episodes released (most content redacted)
     1  = Episode 1 released (reveals ep1-related lore)
     ...
     12 = All episodes released (fully declassified)

   Clearance controls live inside the document
   viewer chrome bar. Onboarding modal appears
   once per session when a document with spoilers
   is first opened.
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
                if (el.tagName === 'SPAN' && !el.classList.contains('redacted')) {
                    measureAndStoreWidth(el);
                }
                el.classList.add('redacted');
                el.classList.remove('declassified');
                el.setAttribute('aria-hidden', 'true');
            }
        }
    }

    function measureAndStoreWidth(el) {
        if (el.getAttribute('data-redact-width')) return;
        var text = el.textContent || '';
        if (!text.trim()) return;
        var measurer = document.createElement('span');
        measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;';
        var cs = window.getComputedStyle(el);
        measurer.style.font = cs.font;
        measurer.style.letterSpacing = cs.letterSpacing;
        measurer.textContent = text;
        el.parentNode.insertBefore(measurer, el);
        var w = measurer.getBoundingClientRect().width;
        el.parentNode.removeChild(measurer);
        var jitter = 0.92 + Math.random() * 0.16;
        var finalW = Math.max(12, Math.round(w * jitter));
        el.style.setProperty('--redact-w', finalW + 'px');
        el.setAttribute('data-redact-width', String(finalW));
    }

    function preMeasureSpans() {
        var spans = document.querySelectorAll('span[data-spoiler]');
        for (var i = 0; i < spans.length; i++) {
            measureAndStoreWidth(spans[i]);
        }
    }

    // --- Clearance control in doc-viewer chrome ---
    var toggleBuilt = false;

    function buildViewerToggle() {
        if (toggleBuilt) return;
        var chrome = document.querySelector('.doc-viewer-chrome');
        if (!chrome) return;

        var wrapper = document.createElement('div');
        wrapper.className = 'clearance-toggle';

        var label = document.createElement('span');
        label.className = 'clearance-label';
        label.textContent = 'SPOILER CLEARANCE';

        var control = document.createElement('div');
        control.className = 'clearance-control';

        var btnDown = document.createElement('button');
        btnDown.className = 'clearance-btn';
        btnDown.textContent = '\u2212';
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

        // Insert before the close button
        var closeBtn = chrome.querySelector('.doc-viewer-close');
        chrome.insertBefore(wrapper, closeBtn);

        updateToggleDisplay(getLevel());

        btnDown.addEventListener('click', function() {
            var lvl = getLevel();
            if (lvl > 0) setLevel(lvl - 1);
        });

        btnUp.addEventListener('click', function() {
            var lvl = getLevel();
            if (lvl < MAX_LEVEL) setLevel(lvl + 1);
        });

        toggleBuilt = true;
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

    // --- First-visit interstitial (inside doc-viewer) ---
    function showOnboarding() {
        if (hasBeenOnboarded()) return;

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
            +     '<button class="clearance-modal-btn" id="modal-btn-down">\u2212</button>'
            +     '<span class="clearance-modal-display" id="modal-display">0</span>'
            +     '<button class="clearance-modal-btn" id="modal-btn-up">+</button>'
            +   '</div>'
            +   '<p class="clearance-modal-hint">You can change this anytime using the <strong>Spoiler Clearance</strong> control at the top of any document.</p>'
            + '</div>'
            + '<button class="clearance-modal-enter" id="modal-enter">Enter Archive</button>';

        overlay.appendChild(modal);

        // Place inside the doc-viewer panel so it overlays the document
        var viewerPanel = document.querySelector('.doc-viewer-panel');
        if (viewerPanel) {
            viewerPanel.appendChild(overlay);
        } else {
            document.body.appendChild(overlay);
        }

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

        requestAnimationFrame(function() {
            overlay.classList.add('visible');
        });

        updateModalDisplay(getLevel());

        document.getElementById('modal-btn-down').addEventListener('click', function() {
            var lvl = getLevel();
            if (lvl > 0) setLevel(lvl - 1);
        });

        document.getElementById('modal-btn-up').addEventListener('click', function() {
            var lvl = getLevel();
            if (lvl < MAX_LEVEL) setLevel(lvl + 1);
        });

        document.getElementById('modal-enter').addEventListener('click', function() {
            markOnboarded();
            staticRunning = false;
            overlay.classList.remove('visible');
            setTimeout(function() {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 500);
        });
    }

    function updateModalDisplay(level) {
        var display = document.getElementById('modal-display');
        if (!display) return;
        display.textContent = String(level);
    }

    // --- Inline clearance popover on redacted click ---
    var popover = null;
    var popoverTimeout = null;

    function buildPopover() {
        if (popover) return popover;
        popover = document.createElement('div');
        popover.className = 'clearance-popover';
        popover.innerHTML = ''
            + '<div class="clearance-popover-label">Spoiler Clearance</div>'
            + '<div class="clearance-popover-control">'
            +   '<button class="clearance-popover-btn" id="popover-down">\u2212</button>'
            +   '<span class="clearance-popover-display" id="popover-display">0</span>'
            +   '<button class="clearance-popover-btn" id="popover-up">+</button>'
            + '</div>'
            + '<div class="clearance-popover-hint">Set to number of episodes listened</div>';
        document.body.appendChild(popover);

        popover.querySelector('#popover-down').addEventListener('click', function(e) {
            e.stopPropagation();
            var lvl = getLevel();
            if (lvl > 0) setLevel(lvl - 1);
            updatePopoverDisplay(getLevel());
        });

        popover.querySelector('#popover-up').addEventListener('click', function(e) {
            e.stopPropagation();
            var lvl = getLevel();
            if (lvl < MAX_LEVEL) setLevel(lvl + 1);
            updatePopoverDisplay(getLevel());
        });

        // Prevent clicks inside from closing
        popover.addEventListener('click', function(e) { e.stopPropagation(); });

        return popover;
    }

    function updatePopoverDisplay(level) {
        var display = document.getElementById('popover-display');
        if (!display) return;
        display.textContent = String(level);
    }

    function showPopover(e) {
        var po = buildPopover();
        updatePopoverDisplay(getLevel());

        // Clear any pending hide
        if (popoverTimeout) { clearTimeout(popoverTimeout); popoverTimeout = null; }

        // Position near click — place above the click point, centered horizontally
        po.style.display = 'block';
        po.classList.add('visible');

        // Measure popover size after making visible
        var poRect = po.getBoundingClientRect();
        var poW = poRect.width || 180;
        var poH = poRect.height || 80;

        var x = e.clientX - poW / 2;
        var y = e.clientY - poH - 12;

        // Keep within viewport
        if (x < 8) x = 8;
        if (x + poW > window.innerWidth - 8) x = window.innerWidth - 8 - poW;
        if (y < 8) { y = e.clientY + 16; } // flip below if no room above

        po.style.left = x + 'px';
        po.style.top = y + 'px';
    }

    function hidePopover() {
        if (!popover) return;
        popover.classList.remove('visible');
        popoverTimeout = setTimeout(function() {
            if (popover) popover.style.display = 'none';
        }, 250);
    }

    // Close popover on any outside click; open on redacted click
    document.addEventListener('click', function(e) {
        // Check if click is inside the popover
        if (popover && popover.contains(e.target)) return;

        // Check if click is on a redacted element
        var target = e.target.closest ? e.target.closest('[data-spoiler].redacted') : null;
        if (target) {
            e.preventDefault();
            showPopover(e);
            return;
        }

        // Otherwise close
        hidePopover();
    });

    // --- Document viewer hook ---
    // Called by doc-viewer.js after content is injected
    window.spoilerSystem = {
        init: function() {
            preMeasureSpans();
            applyRedactions(getLevel());
        },
        onDocumentOpen: function() {
            // Build the clearance toggle in the viewer chrome (once)
            buildViewerToggle();

            // Check if this document has spoiler content
            var viewerContent = document.querySelector('.doc-viewer-content');
            if (viewerContent && viewerContent.querySelector('[data-spoiler]')) {
                if (!hasBeenOnboarded()) {
                    showOnboarding();
                }
            }
        }
    };

    // --- Init for homepage (handles homepage spoiler spans like log entries) ---
    preMeasureSpans();
    applyRedactions(getLevel());

})();
