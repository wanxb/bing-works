// Blog search
function initBlogSearch() {
  const searchWrap = document.getElementById('topbarBlogSearch');
  const input = searchWrap && searchWrap.querySelector('.blog-search__input');
  if (!input) return;

  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      document.dispatchEvent(new CustomEvent('blogSearchChanged', { detail: { query: input.value.trim() } }));
    }, 200);
  });

  function updateVisibility(route) {
    const visible = route === 'blog-list';
    searchWrap.style.display = visible ? '' : 'none';
    if (!visible) input.value = '';
  }

  // initial: router has already dispatched before this module inits
  const hash = (window.location.hash || '').replace(/^#\/?/, '');
  updateVisibility(hash === 'blog' ? 'blog-list' : hash);

  document.addEventListener('routeChanged', (e) => {
    updateVisibility(e.detail.route);
  });
}

export { initBlogSearch };
