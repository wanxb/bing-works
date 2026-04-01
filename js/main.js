// 从 index.html 拆分的 JS
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const media = window.matchMedia('(prefers-color-scheme: dark)');

// 初始化主题：没有存储值时跟随系统，否则使用存储的值
let storedTheme = localStorage.getItem('bing-works-theme');
if (!storedTheme) {
  themeMode = media.matches ? 'dark' : 'light';
} else {
  themeMode = storedTheme;
}

function syncThemeUi(theme) {
  root.setAttribute('data-theme', theme);

  if (theme === 'dark') {
    themeIcon.textContent = '☾';
  } else {
    themeIcon.textContent = '☼';
  }

  if (themeMeta) {
    themeMeta.setAttribute('content', theme === 'dark' ? '#0e1117' : '#f3f4f6');
  }
}

syncThemeUi(themeMode);
console.log('主题初始化完成，当前主题:', themeMode);

themeToggle.addEventListener('click', () => {
  console.log('点击主题按钮，当前主题:', themeMode);
  themeMode = themeMode === 'dark' ? 'light' : 'dark';
  localStorage.setItem('bing-works-theme', themeMode);
  syncThemeUi(themeMode);
  console.log('主题切换后:', themeMode);
});

function renderFilters(filters, works) {
  const filtersContainer = document.querySelector('.filters');
  if (!filtersContainer) return;

  // 计算每个标签的数量
  const tagCounts = {};
  let totalCount = 0;

  for (const authorWorks of Object.values(works)) {
    for (const work of authorWorks) {
      totalCount++;
      for (const tag of work.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }

  // 存储数量数据供后续更新使用
  filtersContainer.dataset.totalCount = totalCount;
  filtersContainer.dataset.tagCounts = JSON.stringify(tagCounts);

  filtersContainer.innerHTML = filters.map(filter => {
    const infoDot = filter.hasInfo ? `<span class="info-dot" tabindex="0" aria-label="关于${filter.label}" data-tip="${filter.info}">i</span>` : '';
    const activeClass = filter.id === 'all' ? ' active' : '';
    const authorClass = filter.id === 'arodes' ? ' author-filter' : '';

    // 初始只有"全部"显示数量
    const count = filter.id === 'all' ? totalCount : (tagCounts[filter.id] || 0);
    const countDisplay = filter.id === 'all' ? `<span class="filter-count">${count}</span>` : '';

    return `<button class="filter-chip${activeClass}${authorClass}" data-filter="${filter.id}" type="button">${filter.label}${countDisplay}${infoDot}</button>`;
  }).join('');
}

function renderWorks(works) {
  const catalog = document.getElementById('catalog');
  if (!catalog) return;

  // 将按作者分组的数组转换为扁平数组（按顺序加载，无需额外排序）
  const worksArray = [];
  for (const authorWorks of Object.values(works)) {
    for (const work of authorWorks) {
      worksArray.push(work);
    }
  }

  catalog.innerHTML = worksArray.map(work => {
    const demoBtn = work.links.demo
      ? `<a class="primary-link" href="${work.links.demo}" target="_blank" rel="noopener noreferrer">打开作品</a>`
      : '';
    const sourceBtn = work.links.source
      ? `<a class="secondary-link" href="${work.links.source}" target="_blank" rel="noopener noreferrer">源码</a>`
      : '';
    return `
    <article class="card reveal delay-${work.delay}" data-tags="${work.tags.join(' ')}">
      <div class="visual thumb" style="background-image: url('${work.thumb}'); --thumb-image: url('${work.thumb}')"></div>
      <div class="card-body">
        <div class="card-top">
          <span class="chip-author">${work.author}</span>
          <span class="tag">${work.category}</span>
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
  `}).join('');
}

function initFilters() {
  const filtersContainer = document.querySelector('.filters');
  const chips = document.querySelectorAll('.filter-chip');
  const cards = document.querySelectorAll('.card');

  // 获取存储的数量数据
  const totalCount = parseInt(filtersContainer.dataset.totalCount) || 0;
  const tagCounts = JSON.parse(filtersContainer.dataset.tagCounts || '{}');

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter;

      chips.forEach((item) => {
        item.classList.remove('active');
        // 移除数量显示
        const countSpan = item.querySelector('.filter-count');
        if (countSpan) countSpan.remove();
      });
      chip.classList.add('active');

      const count = filter === 'all' ? totalCount : (tagCounts[filter] || 0);
      const countSpan = document.createElement('span');
      countSpan.className = 'filter-count';
      countSpan.textContent = count;
      chip.appendChild(countSpan);

      cards.forEach((card) => {
        const tags = card.dataset.tags.split(' ');
        const matched = filter === 'all' || tags.includes(filter);
        card.style.display = matched ? '' : 'none';
      });
    });
  });
}

// 加载作品数据
async function loadWorksData() {
  console.log('开始加载作品数据...');

  try {
    const response = await fetch('./data/works.json');
    if (!response.ok) throw new Error('无法加载数据文件');
    const data = await response.json();
    const workCount = Object.values(data.works).reduce((sum, arr) => sum + arr.length, 0);
    console.log('数据加载成功，作品数量:', workCount);
    renderFilters(data.filters, data.works);
    renderWorks(data.works);
    initFilters();
  } catch (error) {
    console.error('加载失败:', error);
    alert('无法加载作品数据，请通过本地服务器访问页面。\n\n启动本地服务器示例：\npython -m http.server 8000');
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM加载完成');
  loadWorksData();
});
