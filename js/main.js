/* ============================================
   FATA ORGANA — Site Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    
    // Set "last signal" to current date
    const lastSignal = document.getElementById('last-signal');
    if (lastSignal) {
        const now = new Date();
        const formatted = now.toISOString().split('T')[0].replace(/-/g, '.');
        lastSignal.textContent = formatted;
    }
    
    // Subtle random flicker on the signal dot
    const dot = document.querySelector('.signal-dot');
    if (dot) {
        setInterval(() => {
            if (Math.random() > 0.95) {
                dot.style.opacity = '0';
                setTimeout(() => { dot.style.opacity = ''; }, 100 + Math.random() * 200);
            }
        }, 500);
    }
});
