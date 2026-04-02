// 提示框位置管理
function initTooltipPositions() {
  let tooltip = document.createElement('div');
  tooltip.className = 'global-tooltip';
  document.body.appendChild(tooltip);

  let activeDot = null;
  let hideTimer = null;

  function showTooltip(dot) {
    if (!dot) return;
    activeDot = dot;
    tooltip.textContent = dot.getAttribute('data-tip') || '';
    tooltip.classList.add('active');
    tooltip.style.opacity = '1';
    tooltip.style.pointerEvents = 'auto';
    positionTooltip(dot);
  }

  function hideTooltip() {
    tooltip.classList.remove('active');
    tooltip.style.opacity = '0';
    tooltip.style.pointerEvents = 'none';
    activeDot = null;
  }

  function positionTooltip(dot) {
    const rect = dot.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    let left = rect.left + rect.width / 2;
    let top = rect.top + scrollY - tooltip.offsetHeight - 10;
    // 保证不超出视口
    left = Math.max(16, Math.min(left, window.innerWidth - 16));
    if (top < 8) top = rect.bottom + scrollY + 10;
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  document.addEventListener('mouseover', e => {
    const dot = e.target.closest('.info-dot');
    if (dot) {
      clearTimeout(hideTimer);
      showTooltip(dot);
    }
  });

  document.addEventListener('focusin', e => {
    const dot = e.target.closest('.info-dot');
    if (dot) {
      clearTimeout(hideTimer);
      showTooltip(dot);
    }
  });

  document.addEventListener('mouseout', e => {
    if (e.target.classList && e.target.classList.contains('info-dot')) {
      hideTimer = setTimeout(hideTooltip, 80);
    }
  });

  document.addEventListener('focusout', e => {
    if (e.target.classList && e.target.classList.contains('info-dot')) {
      hideTooltip();
    }
  });

  window.addEventListener('scroll', () => {
    if (activeDot) positionTooltip(activeDot);
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (activeDot) positionTooltip(activeDot);
  });
}

export { initTooltipPositions };
