/* ============================================
   FATA ORGANA — Document Viewer
   
   Fetches archive pages and displays them in a
   full-screen overlay projected from the transmitter.
   No page navigation — everything stays on index.
   ============================================ */

(function() {
    'use strict';

    // --- Build the overlay DOM ---
    var overlay = document.createElement('div');
    overlay.className = 'doc-viewer-overlay';
    overlay.innerHTML = ''
        + '<div class="doc-viewer-backdrop"></div>'
        + '<div class="doc-viewer-glow"></div>'
        + '<div class="doc-viewer-panel">'
        +   '<div class="doc-viewer-chrome">'
        +     '<button class="doc-viewer-close" aria-label="Close document">&times;</button>'
        +   '</div>'
        +   '<div class="doc-viewer-scroll">'
        +     '<div class="doc-viewer-content"></div>'
        +   '</div>'
        + '</div>';

    document.body.appendChild(overlay);

    var panel = overlay.querySelector('.doc-viewer-panel');
    var content = overlay.querySelector('.doc-viewer-content');
    var scrollArea = overlay.querySelector('.doc-viewer-scroll');
    var closeBtn = overlay.querySelector('.doc-viewer-close');
    var backdrop = overlay.querySelector('.doc-viewer-backdrop');
    var isOpen = false;
    var originalPath = window.location.pathname;

    // --- Public API ---
    window.docViewer = {
        open: openDoc,
        close: closeDoc,
        isOpen: function() { return isOpen; }
    };

    // --- Open a document ---
    function openDoc(url, pushState) {
        if (isOpen) closeDoc(true); // close without popstate

        content.innerHTML = '<div class="doc-viewer-loading"><span>RECEIVING SIGNAL</span></div>';
        overlay.classList.add('open');
        isOpen = true;

        // Lock body scroll
        document.documentElement.classList.add('doc-viewer-active');

        // Reset scroll
        scrollArea.scrollTop = 0;

        // Update URL
        if (pushState !== false) {
            history.pushState({ docViewer: true, url: url }, '', url);
        }

        // Fetch the page
        fetch(url)
            .then(function(res) {
                if (!res.ok) throw new Error('Not found');
                return res.text();
            })
            .then(function(html) {
                injectContent(html, url);
            })
            .catch(function() {
                content.innerHTML = '<div class="doc-viewer-error">'
                    + '<p>SIGNAL LOST</p>'
                    + '<p style="font-size:0.75rem;color:var(--text-dim);">Could not retrieve document.</p>'
                    + '</div>';
            });
    }

    // --- Inject fetched HTML into the viewer ---
    function injectContent(html, sourceUrl) {
        // Parse the fetched page
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');

        // Extract the main content area
        var main = doc.querySelector('main') || doc.querySelector('.page-content');
        if (!main) {
            content.innerHTML = '<p>No content found.</p>';
            return;
        }

        // Check what CSS the page needs
        var needsLayers = !!doc.querySelector('link[href*="layers.css"]');
        var needsDocument = !!doc.querySelector('link[href*="document.css"]');

        // Inject the content — preserve data-layers attribute if present
        var hasLayers = main.hasAttribute('data-layers');
        if (hasLayers) {
            // Wrap in a div that carries the data-layers attr
            var wrapper = document.createElement('div');
            wrapper.setAttribute('data-layers', '');
            // Copy class from main (e.g., 'page-content document')
            wrapper.className = main.className || '';
            wrapper.innerHTML = main.innerHTML;
            content.innerHTML = '';
            content.appendChild(wrapper);
        } else {
            content.innerHTML = main.innerHTML;
        }

        // Ensure required CSS is loaded
        ensureCSS('/css/document.css');
        ensureCSS('/css/spoiler.css');
        if (needsLayers) ensureCSS('/css/layers.css');

        // Rewrite internal links to use the viewer
        var links = content.querySelectorAll('a[href]');
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var href = link.getAttribute('href');
            // Internal links that point to site pages
            if (href && href.charAt(0) === '/' && !href.match(/\.(mp3|pdf|xml|png|jpg)$/i)) {
                (function(h) {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        // If it's a link back to home, just close
                        if (h === '/' || h === '') {
                            closeDoc();
                        } else {
                            openDoc(h);
                        }
                    });
                })(href);
            }
        }

        // Re-init spoiler system on injected content
        reinitSpoilers();

        // Re-init layers system if the document has layers
        if (content.querySelector('[data-layers]')) {
            reinitLayers();
        }

        // Scroll to anchor if present
        var hash = sourceUrl.split('#')[1];
        if (hash) {
            setTimeout(function() {
                var target = content.querySelector('#' + hash);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    }

    // --- Close the viewer ---
    function closeDoc(skipPopstate) {
        if (!isOpen) return;
        overlay.classList.remove('open');
        overlay.classList.add('closing');
        isOpen = false;

        document.documentElement.classList.remove('doc-viewer-active');

        setTimeout(function() {
            overlay.classList.remove('closing');
            content.innerHTML = '';
        }, 500);

        // Restore URL
        if (!skipPopstate) {
            history.pushState(null, '', originalPath);
        }
    }

    // --- Ensure a CSS file is loaded ---
    var loadedCSS = {};
    function ensureCSS(href) {
        if (loadedCSS[href]) return;
        // Check if already in <head>
        var existing = document.querySelector('link[href="' + href + '"]');
        if (existing) { loadedCSS[href] = true; return; }

        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
        loadedCSS[href] = true;
    }

    // --- Reinitialize spoiler system on new content ---
    function reinitSpoilers() {
        // The spoiler.js exposes functionality via its IIFE closure,
        // so we re-run the core logic on the new DOM
        var spoilerEls = content.querySelectorAll('[data-spoiler]');
        if (!spoilerEls.length) return;

        var level = 0;
        try {
            var stored = localStorage.getItem('fataorgana_clearance');
            if (stored !== null) {
                var n = parseInt(stored, 10);
                if (!isNaN(n) && n >= 0 && n <= 12) level = n;
            }
        } catch(e) {}

        // Pre-measure inline spans
        for (var i = 0; i < spoilerEls.length; i++) {
            var el = spoilerEls[i];
            if (el.tagName === 'SPAN' && !el.getAttribute('data-redact-width')) {
                preMeasureSpan(el);
            }
        }

        // Apply redactions
        for (var j = 0; j < spoilerEls.length; j++) {
            var sel = spoilerEls[j];
            var required = parseInt(sel.getAttribute('data-spoiler'), 10);
            if (isNaN(required)) continue;
            if (level >= required) {
                sel.classList.remove('redacted');
                sel.classList.add('declassified');
                sel.setAttribute('aria-hidden', 'false');
            } else {
                sel.classList.add('redacted');
                sel.classList.remove('declassified');
                sel.setAttribute('aria-hidden', 'true');
            }
        }
    }

    function preMeasureSpan(el) {
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

    // --- Reinitialize layers system ---
    function reinitLayers() {
        var container = content.querySelector('[data-layers]');
        if (!container) return;

        var layers = {};
        var maxLayer = -1;
        var minLayer = Infinity;
        var currentLayer = -1;
        var isTransitioning = false;

        var layerEls = container.querySelectorAll('[data-layer]');
        for (var i = 0; i < layerEls.length; i++) {
            var el = layerEls[i];
            var num = parseInt(el.getAttribute('data-layer'), 10);
            layers[num] = el;
            if (num > maxLayer) maxLayer = num;
            if (num < minLayer) minLayer = num;
        }

        currentLayer = maxLayer;
        for (var key in layers) {
            var k = parseInt(key, 10);
            if (k !== currentLayer) layers[k].style.display = 'none';
        }

        if (maxLayer - minLayer + 1 < 2) return;

        // Build controls
        var controlBar = document.createElement('div');
        controlBar.className = 'layer-control';

        var gauge = document.createElement('div');
        gauge.className = 'layer-gauge';
        var gaugeLabel = document.createElement('span');
        gaugeLabel.className = 'layer-gauge-label';
        var gaugePips = document.createElement('div');
        gaugePips.className = 'layer-gauge-pips';
        for (var p = maxLayer; p >= minLayer; p--) {
            var pip = document.createElement('span');
            pip.className = 'layer-pip' + (p === currentLayer ? ' active' : '');
            pip.setAttribute('data-pip', p);
            gaugePips.appendChild(pip);
        }
        gauge.appendChild(gaugeLabel);
        gauge.appendChild(gaugePips);

        var layerInfo = document.createElement('div');
        layerInfo.className = 'layer-info';

        var btnAdd = document.createElement('button');
        btnAdd.className = 'layer-btn layer-btn-surface';
        btnAdd.textContent = '\u2191 MORE ARTIFICE';
        btnAdd.disabled = true;

        var btnRemove = document.createElement('button');
        btnRemove.className = 'layer-btn layer-btn-deeper';
        btnRemove.innerHTML = '\u2193 LESS ARTIFICE';

        controlBar.appendChild(gauge);
        controlBar.appendChild(layerInfo);
        controlBar.appendChild(btnAdd);
        controlBar.appendChild(btnRemove);

        // Tooltip
        var tooltip = document.createElement('div');
        tooltip.className = 'layer-tooltip';
        tooltip.textContent = 'Archive documents have layers of artifice. The highest layer is in-world fiction. Strip it away to find the real production materials underneath.';
        controlBar.appendChild(tooltip);

        var header = container.querySelector('.document-header');
        if (header && header.nextSibling) {
            header.parentNode.insertBefore(controlBar, header.nextSibling);
        } else {
            container.insertBefore(controlBar, container.firstChild);
        }

        updateDisplay();

        function transition(fromLayer, toLayer) {
            if (isTransitioning) return;
            if (!layers[fromLayer] || !layers[toLayer]) return;
            isTransitioning = true;
            var fromEl = layers[fromLayer];
            var toEl = layers[toLayer];

            fromEl.classList.add('layer-dissolving');
            setTimeout(function() {
                fromEl.style.display = 'none';
                fromEl.classList.remove('layer-dissolving');
                toEl.style.display = '';
                toEl.classList.add('layer-forming');
                currentLayer = toLayer;
                updateDisplay();
                // Re-init spoilers on newly visible layer
                reinitSpoilers();
                setTimeout(function() {
                    toEl.classList.remove('layer-forming');
                    isTransitioning = false;
                }, 800);
            }, 700);
        }

        function updateDisplay() {
            var activeEl = layers[currentLayer];
            var layerName = activeEl ? (activeEl.getAttribute('data-layer-name') || '') : '';
            gaugeLabel.textContent = 'ARTIFICE: ' + currentLayer;
            layerInfo.textContent = layerName;
            btnAdd.disabled = currentLayer >= maxLayer;
            btnRemove.disabled = currentLayer <= minLayer;
            var pips = gaugePips.querySelectorAll('.layer-pip');
            for (var i = 0; i < pips.length; i++) {
                var pipNum = parseInt(pips[i].getAttribute('data-pip'), 10);
                pips[i].classList[pipNum >= currentLayer ? 'add' : 'remove']('active');
            }
            var classEl = container.querySelector('.document-classification');
            if (classEl && activeEl) {
                var classText = activeEl.getAttribute('data-layer-classification');
                if (classText) classEl.textContent = classText;
            }
        }

        btnRemove.addEventListener('click', function() {
            if (currentLayer > minLayer && !isTransitioning) transition(currentLayer, currentLayer - 1);
        });
        btnAdd.addEventListener('click', function() {
            if (currentLayer < maxLayer && !isTransitioning) transition(currentLayer, currentLayer + 1);
        });
    }

    // --- Event: close button ---
    closeBtn.addEventListener('click', function() { closeDoc(); });

    // --- Event: click backdrop ---
    backdrop.addEventListener('click', function() { closeDoc(); });

    // --- Event: Escape key ---
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isOpen) closeDoc();
    });

    // --- Event: browser back/forward ---
    window.addEventListener('popstate', function(e) {
        if (e.state && e.state.docViewer) {
            openDoc(e.state.url, false);
        } else if (isOpen) {
            closeDoc(true);
        }
    });

    // --- Intercept all internal links ---
    // Archive drawer links, nav links, any link that points to a site page
    document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href]');
        if (!link) return;

        var href = link.getAttribute('href');
        if (!href || href.charAt(0) !== '/') return;

        // Skip audio/file links
        if (href.match(/\.(mp3|pdf|xml|png|jpg|css|js)$/i)) return;

        // Home link — just close viewer if open
        if (href === '/' || href === '') {
            if (isOpen) {
                e.preventDefault();
                closeDoc();
            }
            return;
        }

        // All other internal links open in viewer
        e.preventDefault();
        openDoc(href);

        // Close any open drawers
        if (window.closeAllDrawers) window.closeAllDrawers();
    });

    // --- Handle direct URL load ---
    // Check for ?doc= param (from spa-redirect.js on subpages)
    // or if pushState put us on a subpage path
    (function() {
        var params = new URLSearchParams(window.location.search);
        var docParam = params.get('doc');
        if (docParam) {
            // Clean the URL and open viewer
            history.replaceState(null, '', '/');
            originalPath = '/';
            setTimeout(function() { openDoc(decodeURIComponent(docParam)); }, 150);
            return;
        }

        var path = window.location.pathname.replace(/\/+$/, '') || '/';
        if (path !== '' && path !== '/') {
            originalPath = '/';
            openDoc(window.location.pathname + window.location.hash, false);
        }
    })();

})();
