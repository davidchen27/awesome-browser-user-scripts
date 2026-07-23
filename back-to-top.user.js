// ==UserScript==
// @name        一键回到顶部（优化版）
// @match       https://www.v2ex.com/*
// @match       https://www.youtube.com/*
// @match       https://github.com/*
// @run-at      document-idle
// ==/UserScript==

(() => {
  const THRESHOLD = 300;

  const btn = document.createElement('div');

  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
      <path d="M12 5L6 11H10V19H14V11H18L12 5Z" fill="white"/>
    </svg>
  `;

  Object.assign(btn.style, {
    position: 'fixed',
    right: '24px',
    bottom: '48px',
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(6px)',
    borderRadius: '50%',
    cursor: 'pointer',
    zIndex: 9999,
    opacity: '0',
    pointerEvents: 'none',
    transform: 'translateY(10px)',
    transition: 'all 0.25s ease',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
  });

  const updateButton = () => {
    const y = window.scrollY || document.documentElement.scrollTop;

    if (y > THRESHOLD) {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      btn.style.transform = 'translateY(0)';
    } else {
      btn.style.opacity = '0';
      btn.style.pointerEvents = 'none';
      btn.style.transform = 'translateY(10px)';
    }
  };

  btn.addEventListener('mouseenter', () => {
    if (window.scrollY > THRESHOLD) {
      btn.style.transform = 'translateY(0) scale(1.05)';
      btn.style.background = 'rgba(0,0,0,0.8)';
    }
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.transform = window.scrollY > THRESHOLD
      ? 'translateY(0) scale(1)'
      : 'translateY(10px) scale(1)';
    btn.style.background = 'rgba(0,0,0,0.65)';
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.body.appendChild(btn);

  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateButton();
        ticking = false;
      });
      ticking = true;
    }
  });

  updateButton();

  setTimeout(updateButton, 100);
})();