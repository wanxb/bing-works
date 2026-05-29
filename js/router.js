// Hash-based SPA router
function parseHash(hash) {
  const h = (hash || '').replace(/^#\/?/, '');
  if (!h || h === '/' || h === 'works') {
    return { route: 'works', params: {} };
  }
  if (h === 'blog') {
    return { route: 'blog-list', params: {} };
  }
  if (h.startsWith('blog/')) {
    const slug = h.slice(5).replace(/\/$/, '');
    if (slug) {
      return { route: 'blog-post', params: { slug } };
    }
    return { route: 'blog-list', params: {} };
  }
  return { route: 'works', params: {} };
}

function getCurrentRoute() {
  return parseHash(window.location.hash);
}

function initRouter() {
  if (window._bingRouterBound) return;

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  function dispatch() {
    const route = getCurrentRoute();
    document.dispatchEvent(new CustomEvent('routeChanged', { detail: route }));
  }

  window.addEventListener('hashchange', dispatch);
  dispatch();

  window._bingRouterBound = true;
}

export { initRouter, getCurrentRoute, parseHash };
