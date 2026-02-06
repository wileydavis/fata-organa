/* ============================================
   FATA ORGANA — Layers of Reality
   
   Documents can have multiple layers.
   Layer 1: In-world (field manual, recovered doc)
   Layer 2: Production notes (real techniques)
   Layer 3+: Raw notes, scratchpad
   
   Transition: text dissolves into signal noise,
   then reforms as the deeper layer.
   ============================================ */

(function() {
    'use strict';

    var container = document.querySelector('[data-layers]');
    if (!container) return;

    var layers = {};
    var currentLayer = 1;
    var totalLayers = 0;
    var isTransitioning = false;

    // Collect layer content
    var layerEls = container.querySelectorAll('[data-layer]');
    for (var i = 0; i < layerEls.length; i++) {
        var el = layerEls[i];
        var num = parseInt(el.getAttribute('data-layer'), 10);
        layers[num] = el;
        totalLayers = Math.max(totalLayers, num);
        if (num !== 1) el.style.display = 'none';
    }

    if (totalLayers < 2) return;

    // --- Build layer controls ---
    var controlBar = document.createElement('div');
    controlBar.className = 'layer-control';

    // Depth gauge
    var gauge = document.createElement('div');
    gauge.className = 'layer-gauge';

    var gaugeLabel = document.createElement('span');
    gaugeLabel.className = 'layer-gauge-label';

    var gaugePips = document.createElement('div');
    gaugePips.className = 'layer-gauge-pips';
    for (var p = 1; p <= totalLayers; p++) {
        var pip = document.createElement('span');
        pip.className = 'layer-pip' + (p === 1 ? ' active' : '');
        pip.setAttribute('data-pip', p);
        gaugePips.appendChild(pip);
    }

    gauge.appendChild(gaugeLabel);
    gauge.appendChild(gaugePips);

    // Layer info
    var layerInfo = document.createElement('div');
    layerInfo.className = 'layer-info';

    // Buttons
    var btnUp = document.createElement('button');
    btnUp.className = 'layer-btn layer-btn-surface';
    btnUp.textContent = '↑ SURFACE';
    btnUp.disabled = true;

    var btnDown = document.createElement('button');
    btnDown.className = 'layer-btn layer-btn-deeper';
    btnDown.innerHTML = '↓ GO DEEPER';

    controlBar.appendChild(gauge);
    controlBar.appendChild(layerInfo);
    controlBar.appendChild(btnUp);
    controlBar.appendChild(btnDown);

    // Insert control bar after document header
    var header = container.querySelector('.document-header');
    if (header && header.nextSibling) {
        header.parentNode.insertBefore(controlBar, header.nextSibling);
    } else {
        container.insertBefore(controlBar, container.firstChild);
    }

    updateDisplay();

    // --- Transition animation ---
    function transition(fromLayer, toLayer) {
        if (isTransitioning) return;
        isTransitioning = true;

        var fromEl = layers[fromLayer];
        var toEl = layers[toLayer];
        if (!fromEl || !toEl) { isTransitioning = false; return; }

        var scrollTarget = controlBar.getBoundingClientRect().top + window.scrollY - 80;

        // Phase 1: Dissolve current content
        fromEl.classList.add('layer-dissolving');

        setTimeout(function() {
            // Phase 2: Swap
            fromEl.style.display = 'none';
            fromEl.classList.remove('layer-dissolving');

            toEl.style.display = '';
            toEl.classList.add('layer-forming');

            currentLayer = toLayer;
            updateDisplay();

            window.scrollTo({ top: scrollTarget, behavior: 'smooth' });

            // Phase 3: Reform
            setTimeout(function() {
                toEl.classList.remove('layer-forming');
                isTransitioning = false;
            }, 800);
        }, 700);
    }

    function updateDisplay() {
        // Layer names from the layer elements
        var activeEl = layers[currentLayer];
        var layerName = activeEl ? (activeEl.getAttribute('data-layer-name') || 'Layer ' + currentLayer) : '';

        gaugeLabel.textContent = 'DEPTH: ' + currentLayer + ' / ' + totalLayers;
        layerInfo.textContent = layerName;

        btnUp.disabled = currentLayer <= 1;
        btnDown.disabled = currentLayer >= totalLayers;

        // Update pips
        var pips = gaugePips.querySelectorAll('.layer-pip');
        for (var i = 0; i < pips.length; i++) {
            var pipNum = parseInt(pips[i].getAttribute('data-pip'), 10);
            if (pipNum <= currentLayer) {
                pips[i].classList.add('active');
            } else {
                pips[i].classList.remove('active');
            }
        }

        // Update classification header
        var classEl = container.querySelector('.document-classification');
        if (classEl && activeEl) {
            var classText = activeEl.getAttribute('data-layer-classification');
            if (classText) classEl.textContent = classText;
        }
    }

    btnDown.addEventListener('click', function() {
        if (currentLayer < totalLayers && !isTransitioning) {
            transition(currentLayer, currentLayer + 1);
        }
    });

    btnUp.addEventListener('click', function() {
        if (currentLayer > 1 && !isTransitioning) {
            transition(currentLayer, currentLayer - 1);
        }
    });

})();
