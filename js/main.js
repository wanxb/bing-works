// 从 index.html 拆分的 JS
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const media = window.matchMedia('(prefers-color-scheme: dark)');
const catalog = document.getElementById('catalog');

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

  // 计算每个标签的作品数量（一个作品多个标签只算一次）
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

  // 存储数量数据供后续更新使用
  filtersContainer.dataset.totalCount = totalCount;
  filtersContainer.dataset.tagCounts = JSON.stringify(
    Object.fromEntries(
      Object.entries(tagWorks).map(([tag, worksSet]) => [tag, worksSet.size])
    )
  );

  // 检测标签数量，超过7个时启用滚动模式
  const shouldScroll = filters.length > 7;
  if (shouldScroll) {
    filtersContainer.classList.add('scrollable');
  } else {
    filtersContainer.classList.remove('scrollable');
  }

  if (!filtersContainer.hasChildNodes()) {
    filtersContainer.innerHTML = filters.map(filter => {
      const infoDot = filter.hasInfo ? `<span class="info-dot" tabindex="0" aria-label="关于${filter.label}" data-tip="${filter.info}">i</span>` : '';
      const activeClass = filter.id === 'all' ? ' active' : '';
      const authorClass = filter.id === 'arodes' ? ' author-filter' : '';
      const count = filter.id === 'all' ? totalCount : ((tagWorks[filter.id] && tagWorks[filter.id].size) || 0);
      const countDisplay = filter.id === 'all' ? `<span class="filter-count">${count}</span>` : '';
      return `<button class="filter-chip${activeClass}${authorClass}" data-filter="${filter.id}" type="button">${filter.label}${countDisplay}${infoDot}</button>`;
    }).join('');
  } else {
    // 只更新数量和active
    filters.forEach(filter => {
      const chip = filtersContainer.querySelector(`.filter-chip[data-filter="${filter.id}"]`);
      if (!chip) return;
      chip.classList.toggle('active', filter.id === 'all');
      let countSpan = chip.querySelector('.filter-count');
      if (countSpan) countSpan.remove();
      if (filter.id === 'all') {
        countSpan = document.createElement('span');
        countSpan.className = 'filter-count';
        countSpan.textContent = totalCount;
        chip.appendChild(countSpan);
      }
    });
  }
}

function renderWorks(works, filters) {
  const catalog = document.getElementById('catalog');
  if (!catalog) return;

  // 创建标签ID到名称的映射
  const labelMap = {};
  filters.forEach(filter => {
    labelMap[filter.id] = filter.label;
  });

  // 将按作者分组的数组转换为扁平数组（按顺序加载，无需额外排序）
  const worksArray = [];
  for (const authorWorks of Object.values(works)) {
    for (const work of authorWorks) {
      worksArray.push(work);
    }
  }

  catalog.innerHTML = worksArray.map(work => {
    const demoBtn = work.links.demo
      ? `<a class="primary-link icon-btn" href="${work.links.demo}" target="_blank" rel="noopener noreferrer" aria-label="打开作品"><svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></a>`
      : '';
    const sourceBtn = work.links.source
      ? `<a class="secondary-link icon-btn" href="${work.links.source}" target="_blank" rel="noopener noreferrer" aria-label="查看源码"><svg class="btn-icon github-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg></a>`
      : '';

    // 渲染额外标签（排除与作者和分类对应的标签，去重后最多显示3个）
    const excludedTags = [work.author.toLowerCase(), 'tool', 'visual', 'knowledge', 'wellness'];
    const extraTags = work.tags.filter(tagId => !excludedTags.includes(tagId) && tagId !== work.author.toLowerCase());
    const uniqueTags = [...new Set(extraTags)];
    const displayTags = uniqueTags.slice(0, 3);
    const tagsHtml = displayTags.map(tagId => {
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
  `}).join('');
}

function initFilters() {
  const filtersContainer = document.querySelector('.filters');
  const catalog = document.getElementById('catalog');
  const totalCount = parseInt(filtersContainer.dataset.totalCount) || 0;
  const tagCounts = JSON.parse(filtersContainer.dataset.tagCounts || '{}');
  // 只绑定一次事件
  if (!window._bingWorksFilterBound) {
    document.addEventListener('click', function(e) {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      const chips = document.querySelectorAll('.filter-chip');
      const filter = chip.dataset.filter;
      chips.forEach((item) => {
        item.classList.remove('active');
        const countSpan = item.querySelector('.filter-count');
        if (countSpan) countSpan.remove();
      });
      chip.classList.add('active');
      const count = filter === 'all' ? totalCount : (tagCounts[filter] || 0);
      const countSpan = document.createElement('span');
      countSpan.className = 'filter-count';
      countSpan.textContent = count;
      chip.appendChild(countSpan);

      // 重新渲染卡片
      const data = window._bingWorksData;
      if (!data) return;
      let filteredWorks = {};
      if (filter === 'all') {
        filteredWorks = data.works;
      } else {
        for (const [author, worksArr] of Object.entries(data.works)) {
          const filteredArr = worksArr.filter(work => work.tags.includes(filter));
          if (filteredArr.length) filteredWorks[author] = filteredArr;
        }
      }
      renderWorks(filteredWorks, data.filters);
      // 移动端大图标视图下重建轮播
      if (window.innerWidth <= 720 && catalog.dataset.view === 'large') {
        if (window.mobileCarousel) {
          window.mobileCarousel.destroy && window.mobileCarousel.destroy();
          window.mobileCarousel = null;
        }
        window.mobileCarousel = new MobileCarousel(catalog);
      }
    });
    window._bingWorksFilterBound = true;
  }
}

function initViewToggle() {
  const viewToggle = document.getElementById('viewToggle');
  const viewIcon = viewToggle.querySelector('.view-icon');
  const views = ['large', 'small', 'list'];
  const icons = {
    large: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    small: '<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="16" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/><rect x="16" y="9" width="5" height="5" rx="1"/><rect x="2" y="16" width="5" height="5" rx="1"/><rect x="9" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/>',
    list: '<rect x="2" y="4" width="20" height="3" rx="1"/><rect x="2" y="10" width="20" height="3" rx="1"/><rect x="2" y="16" width="20" height="3" rx="1"/>'
  };

  // 从localStorage读取保存的视图模式
  let currentView = localStorage.getItem('bing-works-view') || 'large';
  catalog.dataset.view = currentView;
  viewIcon.innerHTML = icons[currentView];

  viewToggle.addEventListener('click', () => {
    // 切换到下一个视图
    const currentIndex = views.indexOf(currentView);
    const nextIndex = (currentIndex + 1) % views.length;
    currentView = views[nextIndex];

    // 更新catalog视图和图标
    catalog.dataset.view = currentView;
    viewIcon.innerHTML = icons[currentView];

    // 保存到localStorage
    localStorage.setItem('bing-works-view', currentView);

    // 在移动端切换视图时更新轮播状态
    if (window.innerWidth <= 720) {
      if (currentView === 'large') {
        // 大图标视图，启用轮播
        if (!mobileCarousel) {
          mobileCarousel = new MobileCarousel(catalog);
        }
      } else {
        // 小图标或列表视图，销毁轮播并重置卡片显示
        if (mobileCarousel) {
          mobileCarousel.destroy();
          mobileCarousel = null;
        }

        // 重置所有卡片的显示状态
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
          card.style.display = '';
        });

        // 应用当前筛选
        const activeChip = document.querySelector('.filter-chip.active');
        if (activeChip) {
          const filter = activeChip.dataset.filter;
          cards.forEach(card => {
            const tags = card.dataset.tags.split(' ');
            const matched = filter === 'all' || tags.includes(filter);
            card.style.display = matched ? '' : 'none';
          });
        }
      }
    }
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
    console.log('过滤器列表:', data.filters);
    renderFilters(data.filters, data.works);
    renderWorks(data.works, data.filters);
    // 挂到全局，供筛选时用
    window._bingWorksData = data;
    initFilters();
    
    // 数据加载完成后初始化移动端轮播（仅在大图标视图时）
    const catalog = document.getElementById('catalog');
    if (catalog && window.innerWidth <= 720 && catalog.dataset.view === 'large') {
      mobileCarousel = new MobileCarousel(catalog);
    }
  } catch (error) {
    console.error('加载失败:', error);
    alert('无法加载作品数据，请通过本地服务器访问页面。\n\n启动本地服务器示例：\npython -m http.server 8000');
  }
}

// 初始化提示框位置
// body级tooltip方案，彻底绕开滚动条和overflow裁剪
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

// 全局变量用于存储轮播实例
let mobileCarousel = null;

// 移动端卡片轮播功能（仅大图标视图使用）
class MobileCarousel {
  constructor(catalog) {
    this.catalog = catalog;
    this.cards = [];
    this.currentIndex = 0;
    this.isDragging = false;
    this.startX = 0;
    this.currentX = 0;
    this.track = null;
    this.pagination = null;
    this.slideWidth = 0;
    this.init();
  }

  init() {
    // 检查是否为移动端
    if (window.innerWidth > 720) return;

    // 只在大图标视图启用轮播
    if (this.catalog.dataset.view !== 'large') return;

    // 只在有多个卡片时启用轮播
    this.cards = Array.from(this.catalog.querySelectorAll('.card:not([style*="display: none"])'));
    if (this.cards.length <= 1) return;

    // 创建轮播结构
    this.createCarousel();
    this.initPagination();
    this.initSwipe();
    this.initKeyboardNav();
    this.showSwipeHint();

    // 标记已启用轮播
    this.catalog.classList.add('mobile-carousel-enabled');

    // 监听窗口大小变化
    this.resizeHandler = () => {
      if (window.innerWidth <= 720 && this.catalog.dataset.view === 'large') {
        if (!this.track) this.createCarousel();
        if (!this.pagination) this.initPagination();
        this.updateTrack();
      } else {
        this.destroy();
      }
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  createCarousel() {
    // 创建轨道
    this.track = document.createElement('div');
    this.track.className = 'mobile-carousel-track';

    // 包装每个卡片
    this.cards.forEach((card, index) => {
      const slide = document.createElement('div');
      slide.className = 'mobile-carousel-slide';
      
      // 激活第一个卡片
      if (index === 0) {
        card.classList.add('active');
      }
      
      slide.appendChild(card);
      this.track.appendChild(slide);
    });

    // 创建容器
    this.carousel = document.createElement('div');
    this.carousel.className = 'mobile-carousel';
    this.carousel.appendChild(this.track);

    // 插入到catalog中
    this.catalog.appendChild(this.carousel);
  }

  initPagination() {
    // 创建分页指示器容器
    this.pagination = document.createElement('div');
    this.pagination.className = 'mobile-pagination';

    // 创建指示点
    this.cards.forEach((_, index) => {
      const dot = document.createElement('div');
      dot.className = 'mobile-pagination-dot' + (index === 0 ? ' active' : '');
      dot.addEventListener('click', () => this.goToSlide(index));
      this.pagination.appendChild(dot);
    });

    // 插入到catalog中
    this.catalog.appendChild(this.pagination);
  }

  updateTrack() {
    if (!this.track) return;

    // 计算需要跳过的隐藏幻灯片数量
    const slides = this.track.querySelectorAll('.mobile-carousel-slide');
    let offset = 0;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (i < this.currentIndex) {
        // 计算在这个索引之前有多少个可见的幻灯片
        const visibleBefore = Array.from(slides).slice(0, i).filter(s => s.style.display !== 'none').length;
        if (visibleBefore >= this.currentIndex) break;
      }
      if (slide.style.display !== 'none') {
        offset++;
        if (offset > this.currentIndex) break;
      }
    }

    this.slideWidth = this.carousel.offsetWidth;

    // 计算正确的偏移量（只考虑可见幻灯片）
    let translateOffset = 0;
    let visibleCount = 0;
    for (const slide of slides) {
      if (slide.style.display !== 'none') {
        if (visibleCount < this.currentIndex) {
          translateOffset += this.slideWidth;
        } else {
          break;
        }
        visibleCount++;
      }
    }

    this.track.style.transform = `translateX(-${translateOffset}px)`;
  }

  goToSlide(index) {
    // 获取所有可见的幻灯片
    const slides = this.track.querySelectorAll('.mobile-carousel-slide');
    const visibleSlides = Array.from(slides).filter(slide => slide.style.display !== 'none');

    if (index < 0 || index >= visibleSlides.length) return;

    // 更新卡片状态
    const currentSlide = visibleSlides[this.currentIndex];
    const nextSlide = visibleSlides[index];
    const currentCard = currentSlide.querySelector('.card');
    const nextCard = nextSlide.querySelector('.card');

    if (currentCard) currentCard.classList.remove('active');
    if (nextCard) nextCard.classList.add('active');

    // 更新指示器
    const dots = this.pagination.querySelectorAll('.mobile-pagination-dot');
    dots[this.currentIndex].classList.remove('active');
    dots[index].classList.add('active');

    // 更新轨道位置
    this.currentIndex = index;
    this.updateTrack();
  }

  initSwipe() {
    if (!this.carousel) return;

    let startTime = 0;
    let isSwipe = false;

    const handleStart = (x) => {
      if (window.innerWidth > 720) return;
      this.isDragging = true;
      this.startX = x;
      this.currentX = x;
      startTime = Date.now();
      isSwipe = false;
      this.track.style.transition = 'none';
    };

    const handleMove = (x) => {
      if (!this.isDragging) return;
      this.currentX = x;
      const diff = this.currentX - this.startX;
      
      // 如果移动距离超过阈值，认为是滑动
      if (Math.abs(diff) > 10) {
        isSwipe = true;
      }
      
      this.track.style.transform = `translateX(${-this.currentIndex * this.slideWidth + diff}px)`;
    };

    const handleEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;

      const diff = this.currentX - this.startX;
      const deltaTime = Date.now() - startTime;
      const velocity = Math.abs(diff) / deltaTime;

      // 恢复过渡动画
      this.track.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

      // 获取当前可见的幻灯片数量
      const slides = this.track.querySelectorAll('.mobile-carousel-slide');
      const visibleSlides = Array.from(slides).filter(slide => slide.style.display !== 'none');
      const maxIndex = visibleSlides.length - 1;

      // 判断是否切换
      if (isSwipe && (Math.abs(diff) > 50 || velocity > 0.5)) {
        if (diff > 0 && this.currentIndex > 0) {
          this.goToSlide(this.currentIndex - 1);
        } else if (diff < 0 && this.currentIndex < maxIndex) {
          this.goToSlide(this.currentIndex + 1);
        } else {
          this.updateTrack();
        }
      } else {
        this.updateTrack();
      }
    };

    // 触摸事件
    this.carousel.addEventListener('touchstart', (e) => {
      handleStart(e.touches[0].clientX);
    }, { passive: true });

    this.carousel.addEventListener('touchmove', (e) => {
      handleMove(e.touches[0].clientX);
    }, { passive: true });

    this.carousel.addEventListener('touchend', handleEnd);
    this.carousel.addEventListener('touchcancel', handleEnd);

    // 鼠标事件（桌面端测试）
    this.carousel.addEventListener('mousedown', (e) => {
      handleStart(e.clientX);
    });

    this.carousel.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        e.preventDefault();
        handleMove(e.clientX);
      }
    });

    this.carousel.addEventListener('mouseup', handleEnd);
    this.carousel.addEventListener('mouseleave', handleEnd);
  }

  initKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      if (window.innerWidth > 720) return;

      // 获取当前可见的幻灯片数量
      const slides = this.track.querySelectorAll('.mobile-carousel-slide');
      const visibleSlides = Array.from(slides).filter(slide => slide.style.display !== 'none');
      const maxIndex = visibleSlides.length - 1;

      if (e.key === 'ArrowLeft' && this.currentIndex > 0) {
        e.preventDefault();
        this.goToSlide(this.currentIndex - 1);
      } else if (e.key === 'ArrowRight' && this.currentIndex < maxIndex) {
        e.preventDefault();
        this.goToSlide(this.currentIndex + 1);
      }
    });
  }

  showSwipeHint() {
    // 检查是否已显示过提示
    const hasSeenHint = localStorage.getItem('bing-works-swipe-hint');
    if (hasSeenHint) return;

    // 创建滑动提示
    const hint = document.createElement('div');
    hint.className = 'mobile-swipe-hint';
    hint.innerHTML = `
      <div class="swipe-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
      <span>左右滑动查看更多</span>
    `;

    document.body.appendChild(hint);

    // 标记已显示
    localStorage.setItem('bing-works-swipe-hint', 'true');

    // 动画结束后移除
    setTimeout(() => {
      hint.remove();
    }, 3000);
  }

  destroy() {
    if (this.catalog) {
      // 彻底清空 catalog
      this.catalog.innerHTML = '';
      // 恢复原始卡片
      this.cards.forEach(card => {
        card.classList.remove('active');
        this.catalog.appendChild(card);
      });
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.track = null;
    this.pagination = null;
    this.carousel = null;
    this.resizeHandler = null;
    if (this.catalog) this.catalog.classList.remove('mobile-carousel-enabled');
  }

  // 更新卡片列表（用于筛选后）
  updateCards() {
    const newCards = Array.from(this.catalog.querySelectorAll('.card:not([style*="display: none"])'));
    if (newCards.length <= 1) {
      this.destroy();
      return;
    }

    this.destroy();
    this.cards = newCards;
    this.currentIndex = 0;
    this.init();
  }

  // 筛选卡片
  filterCards(filter) {
    // 获取所有幻灯片元素
    const slides = this.track.querySelectorAll('.mobile-carousel-slide');
    const visibleSlides = [];

    // 根据筛选条件显示/隐藏幻灯片
    slides.forEach(slide => {
      const card = slide.querySelector('.card');
      const tags = card.dataset.tags.split(' ');
      const matched = filter === 'all' || tags.includes(filter);
      slide.style.display = matched ? '' : 'none';
      if (matched) {
        visibleSlides.push(slide);
      }
    });

    if (visibleSlides.length <= 1) {
      this.destroy();
      return;
    }

    // 更新卡片列表和分页指示器
    this.currentIndex = 0;
    this.updatePagination(visibleSlides.length);

    // 更新卡片激活状态
    visibleSlides.forEach((slide, index) => {
      const card = slide.querySelector('.card');
      if (index === 0) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // 更新轨道位置
    this.track.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    this.track.style.transform = 'translateX(0)';
  }

  updatePagination(totalDots) {
    if (!this.pagination) return;

    // 清除旧的指示点
    this.pagination.innerHTML = '';

    // 创建新的指示点
    for (let i = 0; i < totalDots; i++) {
      const dot = document.createElement('div');
      dot.className = 'mobile-pagination-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => this.goToSlide(i));
      this.pagination.appendChild(dot);
    }
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM加载完成');
  loadWorksData();
  initViewToggle();
  initTooltipPositions();
});
