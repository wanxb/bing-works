function getFiltersContainer() {
  return document.querySelector('.filters');
}

function getFilterMeta() {
  const filtersContainer = getFiltersContainer();
  if (!filtersContainer) {
    return { totalCount: 0, tagCounts: {} };
  }

  return {
    totalCount: parseInt(filtersContainer.dataset.totalCount, 10) || 0,
    tagCounts: JSON.parse(filtersContainer.dataset.tagCounts || '{}')
  };
}

function setActiveFilter(filter) {
  const { totalCount, tagCounts } = getFilterMeta();
  const chips = document.querySelectorAll('.filter-chip');

  chips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
    chip.querySelector('.filter-count')?.remove();
  });

  const activeChip = document.querySelector(`.filter-chip[data-filter="${filter}"]`);
  if (!activeChip) return;

  const count = filter === 'all' ? totalCount : (tagCounts[filter] || 0);
  const countSpan = document.createElement('span');
  countSpan.className = 'filter-count';
  countSpan.textContent = count;
  activeChip.appendChild(countSpan);
}

function getActiveFilter() {
  return document.querySelector('.filter-chip.active')?.dataset.filter || 'all';
}

function initFilters() {
  const filtersContainer = getFiltersContainer();
  if (!filtersContainer || window._bingWorksFilterBound) return;

  filtersContainer.addEventListener('click', (e) => {
    if (e.target.closest('.info-dot')) return;

    const chip = e.target.closest('.filter-chip');
    if (!chip) return;

    const filter = chip.dataset.filter;
    setActiveFilter(filter);
    document.dispatchEvent(new CustomEvent('filterChanged', { detail: { filter } }));
  });

  window._bingWorksFilterBound = true;
}

export { getActiveFilter, initFilters, setActiveFilter };
