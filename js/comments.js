// Giscus comments integration
function initComments() {
  const container = document.getElementById('blogComments');
  if (!container) return;

  let scriptEl = null;

  function getTheme() {
    const t = document.documentElement.dataset.theme;
    return t === 'dark' ? 'dark_dimmed' : 'light';
  }

  function loadGiscus(post) {
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'giscus';

    scriptEl = document.createElement('script');
    scriptEl.src = 'https://giscus.app/client.js';
    scriptEl.setAttribute('data-repo', 'wanxb/bing-works');
    scriptEl.setAttribute('data-repo-id', 'R_kgDOR0WmbA');
    scriptEl.setAttribute('data-category', 'General');
    scriptEl.setAttribute('data-category-id', 'DIC_kwDOR0WmbM4C-D_-');
    scriptEl.setAttribute('data-mapping', 'specific');
    scriptEl.setAttribute('data-term', post.slug);
    scriptEl.setAttribute('data-reactions-enabled', '1');
    scriptEl.setAttribute('data-emit-metadata', '0');
    scriptEl.setAttribute('data-input-position', 'bottom');
    scriptEl.setAttribute('data-theme', getTheme());
    scriptEl.setAttribute('data-lang', 'zh-CN');
    scriptEl.crossOrigin = 'anonymous';

    wrapper.appendChild(scriptEl);
    container.appendChild(wrapper);
  }

  function clearGiscus() {
    if (scriptEl) {
      scriptEl.remove();
      scriptEl = null;
    }
    container.innerHTML = '';
  }

  document.addEventListener('postContentLoaded', (e) => {
    loadGiscus(e.detail.post);
  });

  document.addEventListener('routeChanged', (e) => {
    if (e.detail.route !== 'blog-post') {
      clearGiscus();
    }
  });

  // sync theme changes to giscus
  const observer = new MutationObserver(() => {
    const iframe = document.querySelector('.giscus iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        giscus: { setConfig: { theme: getTheme() } }
      }, 'https://giscus.app');
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

export { initComments };
