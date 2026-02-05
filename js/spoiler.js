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

    // --- Build toggle UI ---
    function buildToggle() {
        var nav = document.querySelector('.nav-links');
        if (!nav) return;

        var wrapper = document.createElement('div');
        wrapper.className = 'clearance-toggle';

        var label = document.createElement('span');
        label.className = 'clearance-label';
        label.textContent = 'CLEARANCE';

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
            display.textContent = '▮▮';
        } else if (level === MAX_LEVEL) {
            display.textContent = level + ' ✓';
        } else {
            display.textContent = String(level);
        }
    }

    // --- Init ---
    buildToggle();
    applyRedactions(getLevel());

})();
