/* ============================================
   FATA ORGANA — STL Loader
   Parses STL files and distributes points
   across triangle surfaces for particle mapping.
   ============================================ */

(function() {
    'use strict';

    // Parse binary STL → array of triangles [{v1, v2, v3}]
    function parseBinarySTL(buffer) {
        var view = new DataView(buffer);
        var triangles = [];
        var numTriangles = view.getUint32(80, true);

        var offset = 84;
        for (var i = 0; i < numTriangles; i++) {
            // Skip normal (12 bytes)
            offset += 12;
            var v1 = { x: view.getFloat32(offset, true), y: view.getFloat32(offset + 4, true), z: view.getFloat32(offset + 8, true) };
            offset += 12;
            var v2 = { x: view.getFloat32(offset, true), y: view.getFloat32(offset + 4, true), z: view.getFloat32(offset + 8, true) };
            offset += 12;
            var v3 = { x: view.getFloat32(offset, true), y: view.getFloat32(offset + 4, true), z: view.getFloat32(offset + 8, true) };
            offset += 12;
            // Skip attribute byte count
            offset += 2;
            triangles.push({ v1: v1, v2: v2, v3: v3 });
        }
        return triangles;
    }

    // Parse ASCII STL
    function parseASCIISTL(text) {
        var triangles = [];
        var lines = text.split('\n');
        var verts = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.indexOf('vertex') === 0) {
                var parts = line.split(/\s+/);
                verts.push({ x: parseFloat(parts[1]), y: parseFloat(parts[2]), z: parseFloat(parts[3]) });
                if (verts.length === 3) {
                    triangles.push({ v1: verts[0], v2: verts[1], v3: verts[2] });
                    verts = [];
                }
            }
        }
        return triangles;
    }

    // Parse STL (auto-detect binary vs ASCII)
    function parseSTL(buffer) {
        // Check if ASCII by looking for "solid" at start
        var header = '';
        var bytes = new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength));
        for (var i = 0; i < bytes.length; i++) header += String.fromCharCode(bytes[i]);

        if (header.indexOf('solid') === 0 && header.indexOf('\n') > 0) {
            // Might be ASCII — verify by checking for "facet"
            var text = new TextDecoder().decode(buffer);
            if (text.indexOf('facet') > 0) {
                return parseASCIISTL(text);
            }
        }
        return parseBinarySTL(buffer);
    }

    // Compute triangle area
    function triangleArea(t) {
        var ax = t.v2.x - t.v1.x, ay = t.v2.y - t.v1.y, az = t.v2.z - t.v1.z;
        var bx = t.v3.x - t.v1.x, by = t.v3.y - t.v1.y, bz = t.v3.z - t.v1.z;
        var cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
        return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
    }

    // Compute triangle normal (unnormalized is fine for facing test)
    function triangleNormal(t) {
        var ax = t.v2.x - t.v1.x, ay = t.v2.y - t.v1.y, az = t.v2.z - t.v1.z;
        var bx = t.v3.x - t.v1.x, by = t.v3.y - t.v1.y, bz = t.v3.z - t.v1.z;
        return { x: ay * bz - az * by, y: az * bx - ax * bz, z: ax * by - ay * bx };
    }

    // Distribute N points across triangle surfaces (area-weighted)
    // Returns array of {x, y, z, nx, ny, nz} — position + face normal
    function distributePoints(triangles, count, seed) {
        if (triangles.length === 0) return [];

        // Compute cumulative area for weighted random selection
        var areas = [];
        var totalArea = 0;
        for (var i = 0; i < triangles.length; i++) {
            var a = triangleArea(triangles[i]);
            totalArea += a;
            areas.push(totalArea);
        }

        // Seeded random for deterministic distribution
        var rng = seed || 12345;
        function rand() {
            rng = (rng * 16807) % 2147483647;
            return (rng - 1) / 2147483646;
        }

        var points = [];
        for (var p = 0; p < count; p++) {
            // Pick triangle weighted by area
            var r = rand() * totalArea;
            var triIdx = 0;
            for (var j = 0; j < areas.length; j++) {
                if (areas[j] >= r) { triIdx = j; break; }
            }
            var tri = triangles[triIdx];
            var n = triangleNormal(tri);

            // Random point on triangle (barycentric coordinates)
            var u = rand(), v = rand();
            if (u + v > 1) { u = 1 - u; v = 1 - v; }
            var w = 1 - u - v;

            points.push({
                x: tri.v1.x * w + tri.v2.x * u + tri.v3.x * v,
                y: tri.v1.y * w + tri.v2.y * u + tri.v3.y * v,
                z: tri.v1.z * w + tri.v2.z * u + tri.v3.z * v,
                nx: n.x, ny: n.y, nz: n.z
            });
        }

        return points;
    }

    // Compute bounding box and center
    function computeBounds(points) {
        var minX = Infinity, minY = Infinity, minZ = Infinity;
        var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
            if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
        }
        return {
            center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
            size: Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1
        };
    }

    // Project 3D points to 2D with back-face culling
    // Points on back-facing triangles are redistributed to front-facing points
    function projectPoints(points, bounds, screenW, screenH, rotX, rotY, rotZ, scale, perspective, offsetX, offsetY) {
        var cx = screenW / 2 + (offsetX || 0) * screenW;
        var cy = screenH / 2 + (offsetY || 0) * screenH;
        var fitScale = Math.min(screenW, screenH) * 0.35 * scale / bounds.size;

        var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
        var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        var cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);

        // First pass: project all points, track which face the camera
        var allProjected = [];
        var frontIndices = [];

        for (var i = 0; i < points.length; i++) {
            var pt = points[i];
            // Center the model
            var x = pt.x - bounds.center.x;
            var y = pt.y - bounds.center.y;
            var z = pt.z - bounds.center.z;

            // Rotate position
            var y1 = y * cosX - z * sinX;
            var z1 = y * sinX + z * cosX;
            var x2 = x * cosY + z1 * sinY;
            var z2 = -x * sinY + z1 * cosY;
            var x3 = x2 * cosZ - y1 * sinZ;
            var y3 = x2 * sinZ + y1 * cosZ;

            // Rotate normal with same matrix
            var ny1 = pt.ny * cosX - pt.nz * sinX;
            var nz1 = pt.ny * sinX + pt.nz * cosX;
            var nz2 = -pt.nx * sinY + nz1 * cosY;

            // nz2 > 0 means normal faces toward camera (visible surface)
            var facing = nz2 > 0;

            x3 *= fitScale; y3 *= fitScale; z2 *= fitScale;
            var pScale = perspective / (perspective + z2);

            allProjected.push({
                x: cx + x3 * pScale,
                y: cy - y3 * pScale,
                facing: facing
            });

            if (facing) frontIndices.push(i);
        }

        // Second pass: back-face points get remapped to front-face points
        if (frontIndices.length === 0) return allProjected; // edge case: no visible faces

        var projected = [];
        var frontIdx = 0;
        for (var k = 0; k < allProjected.length; k++) {
            if (allProjected[k].facing) {
                projected.push({ x: allProjected[k].x, y: allProjected[k].y });
            } else {
                // Redistribute to a front-face point (round-robin for even spread)
                var donor = frontIndices[frontIdx % frontIndices.length];
                frontIdx++;
                projected.push({ x: allProjected[donor].x, y: allProjected[donor].y });
            }
        }

        return projected;
    }

    // === GLOBAL STL CACHE ===
    // Stores loaded models: { url: { points, bounds } }
    var stlCache = {};
    var stlProjectedCache = {};
    var stlLastParams = {};

    function loadSTLFromURL(url, count, callback) {
        if (stlCache[url]) {
            callback(stlCache[url]);
            return;
        }

        fetch(url)
            .then(function(res) { return res.arrayBuffer(); })
            .then(function(buffer) {
                var triangles = parseSTL(buffer);
                var points = distributePoints(triangles, count, 42);
                var bounds = computeBounds(points);
                var data = { points: points, bounds: bounds };
                stlCache[url] = data;
                callback(data);
            })
            .catch(function(err) {
                console.error('STL load error:', err);
            });
    }

    function loadSTLFromBuffer(buffer, count) {
        var triangles = parseSTL(buffer);
        var points = distributePoints(triangles, count, 42);
        var bounds = computeBounds(points);
        return { points: points, bounds: bounds };
    }

    // Get projected 2D position for a particle index
    // Uses cached projection, recomputes when params change
    function getSTLPosition(idx, count, screenW, screenH, params) {
        var url = params && params.file;
        var data = stlCache[url || '_upload'];
        if (!data) return null;

        // Check if we need to reproject
        var key = url || '_upload';
        var rotX = (params && params.rotateX) || 0;
        var rotY = (params && params.rotateY) || 0;
        var rotZ = (params && params.rotateZ) || 0;
        var scale = (params && params.scale) || 1;
        var persp = (params && params.perspective) || 400;
        var offX = (params && params.offsetX) || 0;
        var offY = (params && params.offsetY) || 0;

        var paramKey = rotX + ',' + rotY + ',' + rotZ + ',' + scale + ',' + persp + ',' + offX + ',' + offY + ',' + screenW + ',' + screenH;
        if (stlLastParams[key] !== paramKey) {
            stlProjectedCache[key] = projectPoints(data.points, data.bounds, screenW, screenH, rotX, rotY, rotZ, scale, persp, offX, offY);
            stlLastParams[key] = paramKey;
        }

        var projected = stlProjectedCache[key];
        if (!projected || idx >= projected.length) return null;
        return projected[idx];
    }

    // Expose globally
    window.stlLoader = {
        parseSTL: parseSTL,
        distributePoints: distributePoints,
        computeBounds: computeBounds,
        projectPoints: projectPoints,
        loadSTLFromURL: loadSTLFromURL,
        loadSTLFromBuffer: loadSTLFromBuffer,
        getSTLPosition: getSTLPosition,
        cache: stlCache,
        projectedCache: stlProjectedCache
    };

})();
