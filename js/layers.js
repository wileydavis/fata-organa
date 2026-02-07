/* ============================================
   FATA ORGANA — Layers of Artifice
   
   Documents present the most constructed version
   first (highest artifice) and can be peeled back
   toward raw production materials (artifice zero).
   
   Highest number = most artifice (in-world, fictional)
   Zero = no artifice (raw notes, scratchpad)
   ============================================ */

(function() {
    'use strict';

    var container = document.querySelector('[data-layers]');
    if (!container) return;

    var layers = {};
    var maxLayer = -1;
    var minLayer = Infinity;
    var currentLayer = -1;
    var isTransitioning = false;

    // Collect layer content
    var layerEls = container.querySelectorAll('[data-layer]');
    for (var i = 0; i < layerEls.length; i++) {
        var el = layerEls[i];
        var num = parseInt(el.getAttribute('data-layer'), 10);
        layers[num] = el;
        if (num > maxLayer) maxLayer = num;
        if (num < minLayer) minLayer = num;
    }

    // Start at highest artifice
    currentLayer = maxLayer;

    // Hide all but the starting layer
    for (var key in layers) {
        var k = parseInt(key, 10);
        if (k !== currentLayer) layers[k].style.display = 'none';
    }

    var layerCount = maxLayer - minLayer + 1;
    if (layerCount < 2) return;

    // --- Build controls ---
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
        var scrollTarget = controlBar.getBoundingClientRect().top + window.scrollY - 80;

        fromEl.classList.add('layer-dissolving');

        setTimeout(function() {
            fromEl.style.display = 'none';
            fromEl.classList.remove('layer-dissolving');

            toEl.style.display = '';
            toEl.classList.add('layer-forming');

            currentLayer = toLayer;
            updateDisplay();

            window.scrollTo({ top: scrollTarget, behavior: 'smooth' });

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
            if (pipNum >= currentLayer) {
                pips[i].classList.add('active');
            } else {
                pips[i].classList.remove('active');
            }
        }

        var classEl = container.querySelector('.document-classification');
        if (classEl && activeEl) {
            var classText = activeEl.getAttribute('data-layer-classification');
            if (classText) classEl.textContent = classText;
        }
    }

    btnRemove.addEventListener('click', function() {
        if (currentLayer > minLayer && !isTransitioning) {
            transition(currentLayer, currentLayer - 1);
        }
    });

    btnAdd.addEventListener('click', function() {
        if (currentLayer < maxLayer && !isTransitioning) {
            transition(currentLayer, currentLayer + 1);
        }
    });

})();
