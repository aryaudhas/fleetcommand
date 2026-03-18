// nav.js — injected into every page
(function () {
  const page = location.pathname.split('/').pop().replace('.html', '') || 'index';

  const html = `
    <nav id="nav">
      <a href="index.html" class="nav-logo">
        <div class="nav-logo-icon">🚛</div>
        <div class="nav-logo-text">Fleet<span>Command</span></div>
      </a>
      <div class="nav-links">
        <a href="index.html"     class="nav-link" data-page="index">
          <span class="icon">⌂</span><span class="label">Home</span>
        </a>
        <a href="tracking.html"  class="nav-link" data-page="tracking">
          <span class="icon">📡</span><span class="label">Live Tracking</span>
        </a>
        <a href="drivers.html"   class="nav-link" data-page="drivers">
          <span class="icon">👤</span><span class="label">Drivers</span>
        </a>
        <a href="analytics.html" class="nav-link" data-page="analytics">
          <span class="icon">📊</span><span class="label">Analytics</span>
        </a>
      </div>
      <div class="nav-right">
        <div class="nav-live"><div class="nav-live-dot"></div>LIVE</div>
      </div>
    </nav>`;

  document.body.insertAdjacentHTML('afterbegin', html);
  const active = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (active) active.classList.add('active');
})();
