// 视图切换功能
function initViewToggle() {
  const viewToggle = document.getElementById('viewToggle');
  const viewIcon = viewToggle.querySelector('.view-icon');
  const catalog = document.getElementById('catalog');
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

    // 触发视图切换事件
    document.dispatchEvent(new CustomEvent('viewChanged', { detail: { view: currentView } }));
  });
}

export { initViewToggle };
