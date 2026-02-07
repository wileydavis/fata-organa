/* ============================================
   FATA ORGANA — SPA Redirect
   
   When a user lands directly on a subpage
   (e.g. /archive/terminology/), redirect to
   the homepage which will detect the path and
   open the document viewer.
   
   This is a progressive enhancement — if JS is
   disabled, the page renders normally.
   ============================================ */

(function() {
    'use strict';

    // Only redirect if we're NOT already on the homepage
    var path = window.location.pathname;
    if (path === '/' || path === '') return;

    // Redirect to homepage with the path as a query param
    // The doc-viewer on the homepage will pick this up
    window.location.replace('/?doc=' + encodeURIComponent(path + window.location.hash));
})();
