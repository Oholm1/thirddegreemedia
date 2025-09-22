// SVG trail functionality stub
// Lean privacy mode: trail particles disabled by default

(function() {
  'use strict';
  
  // Expose trail control functions for compatibility
  window.setTrailMode = function(mode) {
    console.log('Lean privacy mode: Trail particles are disabled for better privacy');
  };
  
  // Kill switch activated by default
  function killTrailParticles() {
    const trailElements = document.querySelectorAll('.trail');
    trailElements.forEach(el => el.remove());
  }
  
  // Clean up any existing trail particles
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', killTrailParticles);
  } else {
    killTrailParticles();
  }
  
  // Monitor for new trail particles and remove them
  const observer = new MutationObserver(killTrailParticles);
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  console.log('Lean privacy mode: SVG trail stub loaded, particles disabled');
})();