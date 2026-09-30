// This dependency-free escape route still works when the 3D module/CDN does not.
(() => {
  const loader = document.getElementById('loader');
  const notice = document.getElementById('boot-fallback');
  let timer;
  const ready = () => {
    clearTimeout(timer);
    loader.classList.add('done');
    notice.hidden = true;
  };
  const fail = () => {
    clearTimeout(timer);
    loader.classList.add('done');
    notice.hidden = false;
  };
  window.portfolioBoot = { ready, fail };
  timer = setTimeout(fail, 12000);
  document.addEventListener('error', (event) => {
    if (event.target.id === 'portfolio-main') fail();
  }, true);
  const menu = document.getElementById('section-menu');
  const dock = document.getElementById('experience-controls');
  const askButton = document.getElementById('ask-toggle');
  const compact = matchMedia('(max-width: 1100px), (max-height: 600px)');
  const header = document.querySelector('.hud-top');
  let dockActive;
  const arrangeControls = () => {
    const textScale = Math.max(1, parseFloat(getComputedStyle(document.documentElement).fontSize) / 16);
    const useDock = compact.matches || innerWidth < 1100 * textScale || innerHeight < 600 * textScale;
    if (useDock !== dockActive) {
      dockActive = useDock;
      document.documentElement.classList.toggle('controls-compact', useDock);
      (useDock ? dock : document.querySelector('.hud-actions')).prepend(askButton);
      menu.open = false;
    }
  };
  compact.addEventListener('change', arrangeControls);
  addEventListener('resize', arrangeControls);
  arrangeControls();
  const headerObserver = new ResizeObserver(() => {
    arrangeControls();
    document.documentElement.style.setProperty('--hud-h', `${header.getBoundingClientRect().height}px`);
  });
  [header, document.querySelector('.hud-actions'), document.querySelector('.brand'), document.documentElement].forEach((element) => headerObserver.observe(element));
  new ResizeObserver(() => document.documentElement.style.setProperty('--dock-h', `${dock.getBoundingClientRect().height}px`)).observe(dock);
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) menu.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) menu.open = false;
  });
  const viewport = window.visualViewport;
  if (viewport) {
    const updateViewport = () => {
      const style = document.documentElement.style;
      style.setProperty('--visible-height', `${viewport.height}px`);
      style.setProperty('--visible-top', `${viewport.offsetTop}px`);
      style.setProperty('--keyboard-inset', `${Math.max(0, innerHeight - viewport.height - viewport.offsetTop)}px`);
      document.documentElement.classList.toggle('keyboard-open', innerHeight - viewport.height - viewport.offsetTop > 120);
    };
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);
    updateViewport();
  }
})();
