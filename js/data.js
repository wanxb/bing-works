function getCatalog() {
  return document.getElementById('catalog');
}

function computeTagCounts(works) {
  const tagWorks = {};
  let totalCount = 0;

  for (const authorWorks of Object.values(works)) {
    for (const work of authorWorks) {
      totalCount++;
      for (const tag of work.tags) {
        if (!tagWorks[tag]) {
          tagWorks[tag] = new Set();
        }
        tagWorks[tag].add(work.id);
      }
    }
  }

  return {
    totalCount,
    tagCounts: Object.fromEntries(
      Object.entries(tagWorks).map(([tag, worksSet]) => [tag, worksSet.size])
    )
  };
}

function renderFilters(filters, works) {
  const filtersContainer = document.querySelector('.filters');
  if (!filtersContainer) return;

  const { totalCount, tagCounts } = computeTagCounts(works);
  filtersContainer.dataset.totalCount = String(totalCount);
  filtersContainer.dataset.tagCounts = JSON.stringify(tagCounts);
  filtersContainer.classList.toggle('scrollable', filters.length > 7);

  if (!filtersContainer.hasChildNodes()) {
    filtersContainer.innerHTML = filters.map((filter) => {
      const infoDot = filter.hasInfo
        ? `<span class="info-dot" tabindex="0" aria-label="关于${filter.label}" data-tip="${filter.info}">i</span>`
        : '';
      const activeClass = filter.id === 'all' ? ' active' : '';
      const authorClass = filter.id === 'arodes' ? ' author-filter' : '';
      const count = filter.id === 'all' ? totalCount : (tagCounts[filter.id] || 0);
      const countDisplay = filter.id === 'all' ? `<span class="filter-count">${count}</span>` : '';
      return `<button class="filter-chip${activeClass}${authorClass}" data-filter="${filter.id}" type="button">${filter.label}${countDisplay}${infoDot}</button>`;
    }).join('');
    return;
  }

  filters.forEach((filter) => {
    const chip = filtersContainer.querySelector(`.filter-chip[data-filter="${filter.id}"]`);
    if (!chip) return;
    chip.classList.toggle('active', filter.id === 'all');
    chip.querySelector('.filter-count')?.remove();

    if (filter.id === 'all') {
      const countSpan = document.createElement('span');
      countSpan.className = 'filter-count';
      countSpan.textContent = String(totalCount);
      chip.appendChild(countSpan);
    }
  });
}

function flattenWorks(works) {
  const worksArray = [];
  for (const authorWorks of Object.values(works)) {
    worksArray.push(...authorWorks);
  }
  return worksArray;
}

function renderWorks(works, filters) {
  const catalog = getCatalog();
  if (!catalog) return;

  const labelMap = Object.fromEntries(filters.map((filter) => [filter.id, filter.label]));
  const worksArray = flattenWorks(works);

  catalog.innerHTML = worksArray.map((work) => {
    const demoBtn = work.links.demo
      ? `<a class="primary-link icon-btn" href="${work.links.demo}" target="_blank" rel="noopener noreferrer" aria-label="打开作品"><svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></a>`
      : '';
    const sourceBtn = work.links.source
      ? `<a class="secondary-link icon-btn" href="${work.links.source}" target="_blank" rel="noopener noreferrer" aria-label="查看源码"><svg class="btn-icon github-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg></a>`
      : '';

    const excludedTags = [work.author.toLowerCase(), 'tool', 'visual', 'knowledge', 'wellness'];
    const displayTags = [...new Set(
      work.tags.filter((tagId) => !excludedTags.includes(tagId))
    )].slice(0, 3);
    const tagsHtml = displayTags.map((tagId) => {
      const label = labelMap[tagId] || tagId;
      return `<span class="tag">${label}</span>`;
    }).join('');

    return `
    <article class="card reveal delay-${work.delay}" data-tags="${work.tags.join(' ')}">
      <div class="visual thumb" style="background-image: url('${work.thumb}'); --thumb-image: url('${work.thumb}')"></div>
      <div class="card-body">
        <div class="card-top">
          <span class="chip-author">${work.author}</span>
          <span class="tag">${work.category}</span>
          ${tagsHtml}
        </div>
        <div class="title">
          <h3>${work.title}</h3>
          <div class="subtitle">${work.subtitle}</div>
        </div>
        <p class="desc">${work.description}</p>
        <div class="card-footer">
          ${demoBtn}
          ${sourceBtn}
        </div>
      </div>
    </article>
  `;
  }).join('');
}

function getFilteredWorks(data, filter) {
  if (!data) return {};
  if (filter === 'all') return data.works;

  const filteredWorks = {};
  for (const [author, worksArr] of Object.entries(data.works)) {
    const filteredArr = worksArr.filter((work) => work.tags.includes(filter));
    if (filteredArr.length) {
      filteredWorks[author] = filteredArr;
    }
  }

  return filteredWorks;
}

function renderFilteredWorks(filter) {
  const data = window._bingWorksData;
  if (!data) return;

  const filteredWorks = getFilteredWorks(data, filter);
  renderWorks(filteredWorks, data.filters);
  document.dispatchEvent(new CustomEvent('worksRendered', { detail: { filter } }));
}

async function loadWorksData() {
  try {
    const response = await fetch('./data/works.json');
    if (!response.ok) throw new Error('无法加载数据文件');

    const data = await response.json();
    renderFilters(data.filters, data.works);
    renderWorks(data.works, data.filters);
    window._bingWorksData = data;
    document.dispatchEvent(new CustomEvent('dataLoaded', { detail: data }));
  } catch (error) {
    console.error('加载失败:', error);
    alert('无法加载作品数据，请通过本地服务器访问页面。\n\n启动本地服务器示例：\npython -m http.server 8000');
  }
}

document.addEventListener('filterChanged', (e) => {
  renderFilteredWorks(e.detail.filter);
});

export { loadWorksData, renderFilteredWorks, renderFilters, renderWorks };
